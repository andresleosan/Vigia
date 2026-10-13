import {
  aad, b64u, cifrar, compromisoK, cuerpoCierre, cuerpoIncidente, deHex, empaquetarSobre, firmarRegistro, hashRegistro, hex, huellaAudio, nuevoId,
  type Apertura, type EnvolturaCuerpo, type Fragmento, type Hueco, type Registro,
} from '@vigia/shared';
import type { Entorno } from '../src/entorno.ts';
import { TIPO_JSON, TIPO_SOBRE } from '../src/errores.ts';
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

export type ConCifrado = Firmado & { cifrado: Uint8Array };

// Fragmento con su audio de prueba cifrado de verdad (AAD ct) y sus p y c (sección 5).
export async function nuevoFragmento(t: Telefono, inc: Incidente, seq: number, prev: string, audio = new TextEncoder().encode(`audio ${seq}`)): Promise<ConCifrado> {
  const cifrado = await cifrar(cripto, inc.k, aad('ct', inc.id, seq), audio);
  const r: Fragmento = { v: 1, tipo: 'fragmento', incidente: inc.id, seq, hora_telefono: T + seq * 4_000, p: await huellaAudio(cripto, inc.k, audio), c: hex(await cripto.sha256(cifrado)), prev };
  return { ...(await firmar(t, r)), cifrado };
}

export async function nuevoHueco(t: Telefono, inc: Incidente, seq: number, prev: string): Promise<ConCifrado> {
  const r: Hueco = { v: 1, tipo: 'hueco', incidente: inc.id, seq, hora_telefono: T + seq * 4_000, prev, fin: T + seq * 4_000 + 2_000, motivo: 'microfono' };
  return { ...(await firmar(t, r)), cifrado: new Uint8Array(0) };
}

export function nuevoCierre(t: Telefono, inc: Incidente, ultimo_seq: number, hash_final: string, hora_telefono = T + 999_000): Promise<Firmado> {
  return firmar(t, { v: 1, tipo: 'cierre', incidente: inc.id, hora_telefono, ultimo_seq, hash_final });
}

// La otra firma válida del mismo registro: (r, n − s), con n el orden de P-256 (sección 4: se acepta s alto).
export function otraFirma(s: Uint8Array): Uint8Array {
  const n = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
  return Uint8Array.of(...s.subarray(0, 32), ...deHex((n - BigInt('0x' + hex(s.subarray(32)))).toString(16).padStart(64, '0')));
}

// Fragmentos 1..n que encadenan desde la apertura.
export async function cadena(t: Telefono, inc: Incidente, n: number): Promise<ConCifrado[]> {
  const lista: ConCifrado[] = [];
  for (let seq = 1; seq <= n; seq++) lista.push(await nuevoFragmento(t, inc, seq, lista.at(-1)?.hash ?? inc.apertura.hash));
  return lista;
}

export function sobre(f: ConCifrado): Uint8Array {
  return empaquetarSobre({ r: f.bytes, s: f.s, cifrado: f.cifrado });
}

type Subida = { firmada?: boolean; ahora?: number; entorno?: Entorno; cuerpo?: Uint8Array };

// PUT del sobre: sin firma de petición (P5), salvo que se pida.
export async function subir(t: ConId, inc: Incidente, seq: number, f: ConCifrado, o: Subida = {}): Promise<Response> {
  const ahora = o.ahora ?? T;
  const p = await peticion({
    metodo: 'PUT', ruta: `/v1/incidents/${inc.id}/chunks/${seq}`, cuerpo: o.cuerpo ?? sobre(f), tipo: TIPO_SOBRE, hora: ahora,
    ...(o.firmada ? { firmante: { telefono: t, id: t.id } } : {}),
  });
  return enviar(p, ahora, o.entorno);
}

export async function cerrar(t: ConId, inc: Incidente, f: Firmado, o: { ahora?: number; entorno?: Entorno; idPeticion?: string } = {}): Promise<Response> {
  const ahora = o.ahora ?? T;
  const cuerpo = cuerpoCierre({ r: b64u(f.bytes), s: b64u(f.s) });
  const p = await peticion({ metodo: 'POST', ruta: `/v1/incidents/${inc.id}/close`, cuerpo, tipo: TIPO_JSON, firmante: { telefono: t, id: t.id }, hora: ahora, idPeticion: o.idPeticion });
  return enviar(p, ahora, o.entorno);
}
