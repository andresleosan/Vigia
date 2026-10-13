import { ErrorFormato, u16be, unir } from './codificacion.ts';

export type Sobre = { r: Uint8Array; s: Uint8Array; cifrado: Uint8Array };

/** Tope del cuerpo del sobre (sección 10), también sin Content-Length. Se recalcula tras el pico (H0b). */
export const MAX_SOBRE = 65_536;

/** u16be(len(r)) ‖ r ‖ s ‖ cifrado; el cifrado va vacío en la apertura, el hueco y el cierre. */
export function empaquetarSobre(sobre: Sobre): Uint8Array {
  const { r, s, cifrado } = sobre;
  if (r.length === 0 || s.length !== 64 || 2 + r.length + 64 + cifrado.length > MAX_SOBRE) {
    throw new ErrorFormato('sobre');
  }
  return unir(u16be(r.length), r, s, cifrado);
}

export function desempaquetarSobre(cuerpo: Uint8Array): Sobre {
  if (cuerpo.length < 2 + 1 + 64 || cuerpo.length > MAX_SOBRE) throw new ErrorFormato('sobre');
  const n = new DataView(cuerpo.buffer, cuerpo.byteOffset, cuerpo.byteLength).getUint16(0); // u16be
  if (n === 0 || 2 + n + 64 > cuerpo.length) throw new ErrorFormato('sobre');
  return {
    r: cuerpo.slice(2, 2 + n),
    s: cuerpo.slice(2 + n, 2 + n + 64),
    cifrado: cuerpo.slice(2 + n + 64),
  };
}
