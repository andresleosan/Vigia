import { ErrorFormato, hex, unir, utf8 } from './codificacion.ts';
import type { Cripto } from './cripto.ts';
import { PATRON_ID } from './ids.ts';
import { analizarJcv, codificarJcv, type Campo, type Esquema, type Valor } from './jcv.ts';
import { PREFIJO } from './prefijos.ts';

export type Apertura = { v: 1; tipo: 'apertura'; incidente: string; seq: 0; hora_telefono: number; country_code: string; dispositivo: string; origen: 'grabar' | 'sos'; kc: string };
export type Fragmento = { v: 1; tipo: 'fragmento'; incidente: string; seq: number; hora_telefono: number; p: string; c: string; prev: string; loc?: string };
export type Hueco = { v: 1; tipo: 'hueco'; incidente: string; seq: number; hora_telefono: number; prev: string; fin: number; motivo: 'microfono' | 'interrupcion' };
export type Cierre = { v: 1; tipo: 'cierre'; incidente: string; hora_telefono: number; ultimo_seq: number; hash_final: string };
export type Registro = Apertura | Fragmento | Hueco | Cierre;

const cadena = (patron: RegExp, opcional = false): Campo => ({ tipo: 'cadena', patron, opcional });
const entero = (min: number, max: number): Campo => ({ tipo: 'entero', min, max });
const HEX64 = cadena(/^[0-9a-f]{64}$/);
const MS = entero(0, Number.MAX_SAFE_INTEGER);
const SEQ = entero(1, 999_999);
const comunes = (tipo: Registro['tipo']): Esquema => ({
  v: entero(1, 1),
  tipo: cadena(new RegExp(`^${tipo}$`)),
  incidente: cadena(PATRON_ID),
  hora_telefono: MS,
});

export const ESQUEMAS: Record<Registro['tipo'], Esquema> = {
  apertura: { ...comunes('apertura'), seq: entero(0, 0), country_code: cadena(/^[A-Z]{2}$/), dispositivo: HEX64, origen: cadena(/^(grabar|sos)$/), kc: HEX64 },
  fragmento: { ...comunes('fragmento'), seq: SEQ, p: HEX64, c: HEX64, prev: HEX64, loc: cadena(/^[A-Za-z0-9_-]{208}$/, true) },
  hueco: { ...comunes('hueco'), seq: SEQ, prev: HEX64, fin: MS, motivo: cadena(/^(microfono|interrupcion)$/) },
  cierre: { ...comunes('cierre'), ultimo_seq: entero(0, 999_999), hash_final: HEX64 },
};

export function analizarRegistro(bytes: Uint8Array): Registro {
  for (const esquema of Object.values(ESQUEMAS)) {
    let r: Record<string, Valor>;
    try {
      r = analizarJcv(bytes, esquema);
    } catch (e) {
      if (e instanceof ErrorFormato) continue;
      throw e;
    }
    if (r.tipo === 'hueco' && (r.fin as number) < (r.hora_telefono as number)) throw new ErrorFormato('fin');
    return r as Registro;
  }
  throw new ErrorFormato('registro');
}

export function bytesRegistro(r: Registro): Uint8Array {
  const bytes = codificarJcv(r);
  analizarRegistro(bytes); // nunca se firma un registro que el servidor o el verificador rechazarían
  return bytes;
}

export async function hashRegistro(cripto: Cripto, bytes: Uint8Array): Promise<string> {
  return hex(await cripto.sha256(bytes));
}

export function prefijoDe(r: Registro): Uint8Array {
  return r.tipo === 'cierre' ? PREFIJO.cierre : PREFIJO.registro;
}

export async function firmarRegistro(cripto: Cripto, privada: CryptoKey, r: Registro): Promise<{ bytes: Uint8Array; s: Uint8Array }> {
  const bytes = bytesRegistro(r);
  return { bytes, s: await cripto.firmarP256(privada, unir(prefijoDe(r), bytes)) };
}

export async function verificarRegistro(cripto: Cripto, spki: Uint8Array, bytes: Uint8Array, firma: Uint8Array): Promise<boolean> {
  let r: Registro;
  try {
    r = analizarRegistro(bytes);
  } catch (e) {
    if (e instanceof ErrorFormato) return false;
    throw e;
  }
  return cripto.verificarP256(spki, unir(prefijoDe(r), bytes), firma);
}

export async function compromisoK(cripto: Cripto, incidente: string, k: Uint8Array): Promise<string> {
  return hex(await cripto.sha256(unir(PREFIJO.compromiso, utf8(incidente), Uint8Array.of(0), k)));
}

export async function huellaAudio(cripto: Cripto, k: Uint8Array, audio: Uint8Array): Promise<string> {
  const kp = await cripto.hkdfSha256(k, new Uint8Array(32), utf8('vigia/v1/p'), 32);
  return hex(await cripto.hmacSha256(kp, audio));
}
