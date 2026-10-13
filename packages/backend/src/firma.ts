import { CABECERA, criptoWebCrypto, esId, PATRON_ID, resumenPeticion, VENTANA_HORA_MS, verificarPeticion } from '@vigia/shared';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Contexto } from './entorno.ts';
import { Rechazo, respuestaError, respuestaJson } from './errores.ts';

export const cripto = criptoWebCrypto();

// Paso 1 de la sección 9, antes de leer el cuerpo: Content-Type exacto y sin Content-Encoding (415).
export function tipoExacto(tipo: string): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.header('Content-Type') !== tipo || c.req.header('Content-Encoding') !== undefined) throw new Rechazo('tipo_contenido');
    await next();
  };
}

// Paso 1: 413 por Content-Length o, sin él, al pasar del límite mientras se lee.
export function limite(max: number): MiddlewareHandler {
  return bodyLimit({ maxSize: max, onError: () => respuestaError('demasiado_grande') });
}

// Una sola lectura del cuerpo y otra comprobación de su tamaño real.
export async function leerCuerpo(c: Contexto, max: number): Promise<Uint8Array> {
  const cuerpo = await c.req.arrayBuffer();
  if (cuerpo.byteLength > max) throw new Rechazo('demasiado_grande');
  return new Uint8Array(cuerpo);
}

export function idDeRuta(c: Contexto): string {
  const id = c.req.param('id') ?? '';
  if (!esId(id)) throw new Rechazo('formato');
  return id;
}

export function seqDeRuta(c: Contexto, minimo: 0 | 1): number {
  const seq = c.req.param('seq') ?? '';
  if (!/^(0|[1-9][0-9]{0,5})$/.test(seq) || Number(seq) < minimo) throw new Rechazo('formato');
  return Number(seq);
}

type Cabeceras = { dispositivo: string; hora: number; idPeticion: string; firma: string };

function cabecera(c: Contexto, nombre: string, patron: RegExp): string {
  const valor = c.req.header(nombre);
  if (valor === undefined || !patron.test(valor)) throw new Rechazo('formato');
  return valor;
}

// Paso 1: cabeceras de firma (400). En el alta no va X-Vigia-Dispositivo y el id firmado es "registro".
export function leerCabeceras(c: Contexto, alta = false): Cabeceras {
  if (alta && c.req.header(CABECERA.dispositivo) !== undefined) throw new Rechazo('formato');
  const hora = Number(cabecera(c, CABECERA.hora, /^(0|[1-9][0-9]{0,15})$/));
  if (!Number.isSafeInteger(hora)) throw new Rechazo('formato');
  return {
    dispositivo: alta ? 'registro' : cabecera(c, CABECERA.dispositivo, PATRON_ID),
    hora,
    idPeticion: cabecera(c, CABECERA.peticion, PATRON_ID),
    firma: cabecera(c, CABECERA.firma, /^[A-Za-z0-9_-]{86}$/),
  };
}

// RUTA son los bytes del path tal como llegan (sección 9).
export function datosFirmados(c: Contexto, cab: Cabeceras, cuerpo: Uint8Array) {
  return { metodo: c.req.method, ruta: new URL(c.req.raw.url).pathname, hora: cab.hora, idPeticion: cab.idPeticion, idDispositivo: cab.dispositivo, cuerpo };
}

// Paso 3 (FIR-03).
export function comprobarHora(hora: number, ahora: number): void {
  if (Math.abs(hora - ahora) > VENTANA_HORA_MS) {
    throw new Rechazo('hora', { [CABECERA.horaServidor]: String(ahora), Date: new Date(ahora).toUTCString() });
  }
}

export type Firmante = { id: string; idPeticion: string; spki: Uint8Array; revocado: boolean; tamanoD1: number };

// Pasos 1 (cabeceras), 2 y 3. Desconocido, firma inválida y revocado (donde la ruta no lo admite)
// dan el mismo 401 firma, antes de mirar la hora (ERR-01). tamanoD1 es el size_after de la primera consulta.
export async function comprobarFirma(c: Contexto, cuerpo: Uint8Array, ahora: number, clave: 'dispositivo' | 'lectura', admiteRevocado: boolean): Promise<Firmante> {
  const cab = leerCabeceras(c);
  const { results: [d], meta } = await c.env.DB.prepare('SELECT spki, spki_lectura, revocado_en FROM dispositivos WHERE id = ?')
    .bind(cab.dispositivo).run<{ spki: number[]; spki_lectura: number[]; revocado_en: number | null }>();
  const valida = d !== undefined
    && await verificarPeticion(cripto, new Uint8Array(clave === 'dispositivo' ? d.spki : d.spki_lectura), datosFirmados(c, cab, cuerpo), cab.firma);
  if (!valida || (d.revocado_en !== null && !admiteRevocado)) throw new Rechazo('firma');
  comprobarHora(cab.hora, ahora);
  return { id: cab.dispositivo, idPeticion: cab.idPeticion, spki: new Uint8Array(d.spki), revocado: d.revocado_en !== null, tamanoD1: meta.size_after };
}

// h de la fila anti-reenvío: sin HORA, para que el reintento tras un 401 hora sea la misma petición.
export function resumen(c: Contexto, cuerpo: Uint8Array): Promise<string> {
  return resumenPeticion(cripto, c.req.method, new URL(c.req.raw.url).pathname, cuerpo);
}

// Paso 4 (FIR-02): la misma petición recibe el estado y el cuerpo guardados, sin contar cupo;
// otra con el mismo idPeticion, 409 sin ejecutar nada. null: no hay fila.
export async function antirreenvio(c: Contexto, f: Firmante, h: string): Promise<Response | null> {
  const fila = await c.env.DB.prepare('SELECT h, estado, cuerpo FROM antirreenvio WHERE dispositivo = ? AND id_peticion = ?')
    .bind(f.id, f.idPeticion).first<{ h: string; estado: number; cuerpo: number[] }>();
  if (!fila) return null;
  if (fila.h !== h) throw new Rechazo('conflicto');
  return respuestaJson(new Uint8Array(fila.cuerpo), fila.estado);
}
