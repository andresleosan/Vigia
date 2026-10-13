import { b64u } from './codificacion.ts';
import type { Cripto } from './cripto.ts';

export const PATRON_ID = /^[A-Za-z0-9_-]{22}$/;

/** 16 bytes del CSPRNG en b64u: 22 caracteres (ENT-01, ID-01). */
export function nuevoId(cripto: Cripto): string {
  return b64u(cripto.aleatorio(16));
}

export function esId(t: string): boolean {
  return PATRON_ID.test(t);
}
