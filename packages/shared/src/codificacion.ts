export class ErrorFormato extends Error {}

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function hex(b: Uint8Array): string {
  let t = '';
  for (const x of b) t += x.toString(16).padStart(2, '0');
  return t;
}

export function deHex(t: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/.test(t)) throw new ErrorFormato('hex no válido');
  const b = new Uint8Array(t.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(t.slice(2 * i, 2 * i + 2), 16);
  return b;
}

export function b64u(b: Uint8Array): string {
  let t = '';
  for (let i = 0; i < b.length; i += 3) {
    const grupo = Math.min(3, b.length - i);
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    // Un grupo de k bytes da k + 1 caracteres, sin relleno.
    for (let j = 0; j <= grupo; j++) t += ALFABETO[(n >> (18 - 6 * j)) & 63];
  }
  return t;
}

export function deB64u(t: string): Uint8Array {
  const b = new Uint8Array(Math.floor((t.length * 3) / 4));
  let acumulado = 0;
  let bits = 0;
  let k = 0;
  for (const c of t) {
    acumulado = ((acumulado << 6) | ALFABETO.indexOf(c)) & 0xfff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      b[k++] = (acumulado >> bits) & 0xff;
    }
  }
  // Regla equivalente de la sección 1: solo vale la forma canónica. Así se rechazan el relleno,
  // los caracteres de fuera del alfabeto, la longitud con resto 1 y los bits sobrantes distintos de 0.
  if (b64u(b) !== t) throw new ErrorFormato('b64u no válido');
  return b;
}

export function utf8(t: string): Uint8Array {
  return new TextEncoder().encode(t);
}

export function unir(...partes: Uint8Array[]): Uint8Array {
  const b = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    b.set(p, i);
    i += p.length;
  }
  return b;
}

export function u16be(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) throw new ErrorFormato('u16 fuera de rango');
  return new Uint8Array([n >>> 8, n & 0xff]);
}

export function u32be(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new ErrorFormato('u32 fuera de rango');
  return new Uint8Array([n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

/** Tiempo constante para dos entradas de igual longitud. */
export function iguales(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
