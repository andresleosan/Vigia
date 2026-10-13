import { ErrorFormato, iguales, unir } from './codificacion.ts';
import type { Cripto } from './cripto.ts';
import { analizarJcv, codificarJcv, type Esquema } from './jcv.ts';

export async function cifrar(cripto: Cripto, k: Uint8Array, aad: Uint8Array, claro: Uint8Array): Promise<Uint8Array> {
  const nonce = cripto.aleatorio(12);
  return unir(nonce, await cripto.cifrarAesGcm(k, nonce, aad, claro));
}

export async function descifrar(cripto: Cripto, k: Uint8Array, aad: Uint8Array, cifrado: Uint8Array): Promise<Uint8Array> {
  return cripto.descifrarAesGcm(k, cifrado.subarray(0, 12), aad, cifrado.subarray(12));
}

export type Posicion = { hora_fix: number; lat_e6: number; lon_e6: number; precision_m: number };

// Con el relleno, `loc` mide siempre 12 + 128 + 16 bytes y su largo no delata la posición.
const LARGO_POSICION = 128;

const ESQUEMA_POSICION: Esquema = {
  hora_fix: { tipo: 'entero', min: 0, max: Number.MAX_SAFE_INTEGER },
  lat: { tipo: 'cadena', patron: /^-?(0|[1-9][0-9]?)[.][0-9]{6}$/ },
  lon: { tipo: 'cadena', patron: /^-?(0|[1-9][0-9]{0,2})[.][0-9]{6}$/ },
  precision_m: { tipo: 'entero', min: 0, max: 100_000 },
  relleno: { tipo: 'cadena', patron: /^0*$/ },
};

// Microgrados a texto con aritmética entera, nunca formateando un double; -0 da "0.000000".
export function textoGrados(e6: number): string {
  if (!Number.isSafeInteger(e6)) throw new ErrorFormato('grados');
  const a = Math.abs(e6);
  const fraccion = a % 1_000_000;
  return `${e6 < 0 ? '-' : ''}${(a - fraccion) / 1_000_000}.${String(fraccion).padStart(6, '0')}`;
}

export function codificarPosicion(p: Posicion): Uint8Array {
  if (Math.abs(p.lat_e6) > 90_000_000 || Math.abs(p.lon_e6) > 180_000_000) throw new ErrorFormato('posicion');
  const campos = { hora_fix: p.hora_fix, lat: textoGrados(p.lat_e6), lon: textoGrados(p.lon_e6), precision_m: p.precision_m };
  const sinRelleno = codificarJcv({ ...campos, relleno: '' }).length;
  const bytes = codificarJcv({ ...campos, relleno: '0'.repeat(LARGO_POSICION - sinRelleno) });
  analizarJcv(bytes, ESQUEMA_POSICION); // rangos de hora_fix y precision_m
  return bytes;
}

function microgrados(t: string): number {
  const [entera, fraccion] = t.replace('-', '').split('.');
  const v = Number(entera) * 1_000_000 + Number(fraccion);
  return t.startsWith('-') ? -v : v;
}

export function analizarPosicion(bytes: Uint8Array): Posicion {
  const o = analizarJcv(bytes, ESQUEMA_POSICION);
  const p = { hora_fix: o.hora_fix as number, lat_e6: microgrados(o.lat as string), lon_e6: microgrados(o.lon as string), precision_m: o.precision_m as number };
  // Rango, cero sin signo y relleno justo: volver a codificar tiene que dar los mismos bytes.
  if (!iguales(codificarPosicion(p), bytes)) throw new ErrorFormato('posicion');
  return p;
}
