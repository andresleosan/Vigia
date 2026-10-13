import { u32be, unir, utf8 } from './codificacion.ts';

export type TipoAad = 'ct' | 'loc' | 'meta';

export function aad(tipo: TipoAad, incidente: string, seq: number): Uint8Array {
  const cero = Uint8Array.of(0);
  return unir(utf8('vigia/v1'), cero, utf8(tipo), cero, utf8(incidente), cero, u32be(seq));
}
