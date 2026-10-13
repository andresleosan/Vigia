import {
  b64u, compromisoK, cuerpoIncidente, firmarRegistro, hashRegistro, nuevoId,
  type Apertura, type EnvolturaCuerpo, type Registro,
} from '@vigia/shared';
import { TIPO_JSON } from '../src/errores.ts';
import { cripto, enviar, peticion, T, type Pedido, type Telefono } from './ayudas.ts';

export type Firmado = { bytes: Uint8Array; s: Uint8Array; hash: string };
export type Incidente = { id: string; k: Uint8Array; apertura: Firmado };
export type ConId = Telefono & { id: string };

export async function firmar(t: Telefono, r: Registro): Promise<Firmado> {
  const { bytes, s } = await firmarRegistro(cripto, t.privada, r);
  return { bytes, s, hash: await hashRegistro(cripto, bytes) };
}

// Apertura firmada de un incidente nuevo, con su K y su kc (sección 5).
export async function nuevaApertura(t: Telefono, cambios: Partial<Apertura> = {}): Promise<Incidente> {
  const id = cambios.incidente ?? nuevoId(cripto);
  const k = cripto.aleatorio(32);
  const r: Apertura = { v: 1, tipo: 'apertura', incidente: id, seq: 0, hora_telefono: T, country_code: 'VE', dispositivo: t.huella, origen: 'grabar', kc: await compromisoK(cripto, id, k), ...cambios };
  return { id, k, apertura: await firmar(t, r) };
}

// Envoltura opaca de 80 bytes: el servidor nunca la abre.
export function envoltura(rol: EnvolturaCuerpo['rol'], destino = '-'): EnvolturaCuerpo {
  return { destino, k: b64u(cripto.aleatorio(80)), rol };
}

export function cuerpoApertura(inc: Incidente, envolturas: EnvolturaCuerpo[] = [], meta?: Uint8Array): Uint8Array {
  return cuerpoIncidente({ envolturas, ...(meta ? { meta: b64u(meta) } : {}), r: b64u(inc.apertura.bytes), s: b64u(inc.apertura.s) });
}

export function pedidoApertura(t: ConId, cuerpo: Uint8Array, extra: Partial<Pedido> = {}): Pedido {
  return { metodo: 'POST', ruta: '/v1/incidents', cuerpo, tipo: TIPO_JSON, firmante: { telefono: t, id: t.id }, ...extra };
}

export async function abrir(t: ConId, inc: Incidente, ahora = T): Promise<Response> {
  return enviar(await peticion(pedidoApertura(t, cuerpoApertura(inc), { hora: ahora })), ahora);
}

// GET firmado con la clave de lectura.
export async function leer(t: ConId, ruta: string, ahora = T): Promise<Response> {
  return enviar(await peticion({ metodo: 'GET', ruta, firmante: { telefono: t, id: t.id, clave: 'lectura' }, hora: ahora }), ahora);
}
