import { env } from 'cloudflare:workers';
import {
  b64u, CABECERA, criptoWebCrypto, cuerpoAlta, deB64u, firmarPeticion, huella, nuevoId,
  type ClavesAcuse, type DatosPeticion,
} from '@vigia/shared';
import { expect } from 'vitest';
import { crearApp } from '../src/app.ts';
import type { Entorno } from '../src/entorno.ts';
import { TIPO_JSON } from '../src/errores.ts';

export const cripto = criptoWebCrypto();
export const T = 1_760_000_000_000; // hora de referencia de las pruebas, en ms
export const BASE = 'https://api.prueba';

export type Telefono = {
  privada: CryptoKey; // clave del dispositivo: alta, escrituras y órdenes
  publica: Uint8Array;
  privadaLectura: CryptoKey; // clave de lectura: los GET (decisión 60)
  lectura: Uint8Array;
  huella: string;
};

async function parP256() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']) as CryptoKeyPair;
  return { privada: par.privateKey, publica: new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey) as ArrayBuffer) };
}

// Teléfono de prueba: dos pares P-256 efímeros, con las privadas no extraíbles.
export async function nuevoTelefono(): Promise<Telefono> {
  const d = await parP256();
  const l = await parP256();
  return { privada: d.privada, publica: d.publica, privadaLectura: l.privada, lectura: l.publica, huella: await huella(cripto, d.publica) };
}

export type Pedido = {
  metodo: string;
  ruta: string;
  cuerpo?: Uint8Array;
  tipo?: string; // Content-Type; sin él no se envía
  firmante?: { telefono: Telefono; id: string; clave?: 'dispositivo' | 'lectura' }; // id 'registro' en el alta
  hora?: number; // X-Vigia-Hora; por defecto T
  idPeticion?: string; // por defecto uno nuevo
  firmado?: Partial<DatosPeticion>; // lo que se firma, si difiere de lo que se envía
  cabeceras?: Record<string, string>; // se añaden al final y pisan las anteriores
};

// Petición con las cabeceras de firma de la sección 9.
export async function peticion(p: Pedido): Promise<Request> {
  const cuerpo = p.cuerpo ?? new Uint8Array(0);
  const cabeceras: Record<string, string> = p.tipo ? { 'Content-Type': p.tipo } : {};
  if (p.firmante) {
    const { telefono, id, clave = 'dispositivo' } = p.firmante;
    const hora = p.hora ?? T;
    const idPeticion = p.idPeticion ?? nuevoId(cripto);
    const datos: DatosPeticion = { metodo: p.metodo, ruta: p.ruta, hora, idPeticion, idDispositivo: id, cuerpo, ...p.firmado };
    if (id !== 'registro') cabeceras[CABECERA.dispositivo] = id;
    cabeceras[CABECERA.hora] = String(hora);
    cabeceras[CABECERA.peticion] = idPeticion;
    cabeceras[CABECERA.firma] = await firmarPeticion(cripto, clave === 'dispositivo' ? telefono.privada : telefono.privadaLectura, datos);
  }
  return new Request(BASE + p.ruta, { method: p.metodo, headers: { ...cabeceras, ...p.cabeceras }, body: p.metodo === 'GET' ? undefined : cuerpo });
}

// Envía a una app con el reloj fijado en `ahora` y el entorno de Miniflare (o uno modificado).
export async function enviar(peticion: Request, ahora = T, entorno: Entorno = env): Promise<Response> {
  return crearApp({ ahora: () => ahora }).fetch(peticion, entorno);
}

export function pedidoDeAlta(t: Telefono, extra: Partial<Pedido> = {}): Pedido {
  const cuerpo = cuerpoAlta({ lectura: b64u(t.lectura), publica: b64u(t.publica) });
  return { metodo: 'POST', ruta: '/v1/devices', cuerpo, tipo: TIPO_JSON, firmante: { telefono: t, id: 'registro' }, ...extra };
}

// Alta por la API; devuelve el id que asigna el servidor.
export async function alta(t: Telefono, ahora = T): Promise<string> {
  const r = await enviar(await peticion(pedidoDeAlta(t, { hora: ahora })), ahora);
  expect(r.status).toBe(201);
  return (JSON.parse(await r.text()) as { dispositivo: string }).dispositivo;
}

export async function telefonoConAlta(ahora = T): Promise<Telefono & { id: string }> {
  const t = await nuevoTelefono();
  return { ...t, id: await alta(t, ahora) };
}

// Lista fijada de las pruebas: la pública de la clave que generó vitest.config.ts.
export function clavesAcuse(): ClavesAcuse {
  return [{ kid: env.KID_ACUSE, spki: deB64u(env.SPKI_ACUSE_PRUEBA), estado: 'activa', desde: 0 }];
}

// El rate limit de Miniflare cuenta en ventanas alineadas al minuto del reloj: si quedan menos de 5 s
// para la siguiente, se espera a que empiece, para que las 121 peticiones de una prueba caigan en una.
export async function enLaMismaVentana(): Promise<void> {
  const resto = 60_000 - (Date.now() % 60_000);
  if (resto < 5_000) await new Promise((listo) => setTimeout(listo, resto + 200));
}

// En H1 la revocación es un fixture de D1: la ruta llega en H6.
export async function revocar(id: string, hora = T): Promise<void> {
  await env.DB.prepare('UPDATE dispositivos SET revocado_en = ? WHERE id = ?').bind(hora, id).run();
}

// D1 cuyo batch falla dentro de la transacción las `veces` primeras: se le añade al final una
// sentencia que viola un CHECK, así que D1 ejecuta las anteriores y luego lo deshace todo.
export function d1QueFalla(db: D1Database, veces = 1): D1Database {
  let quedan = veces;
  return new Proxy(db, {
    get(destino, nombre) {
      if (nombre === 'batch') {
        return (sentencias: D1PreparedStatement[]) => destino.batch(quedan-- > 0
          ? [...sentencias, destino.prepare("INSERT INTO contadores (dia, nombre, valor) VALUES (0, 'fallo_inyectado', 1)")]
          : sentencias);
      }
      const valor = Reflect.get(destino, nombre);
      return typeof valor === 'function' ? valor.bind(destino) : valor;
    },
  });
}
