import { ErrorFormato, unir, utf8 } from './codificacion.ts';
import type { Hpke } from './cripto.ts';

export type Rol = 'contacto' | 'recuperacion' | 'escucha';

export function infoEnvoltura(incidente: string, rol: Rol): Uint8Array {
  const cero = Uint8Array.of(0);
  return unir(utf8('vigia/v1/envoltura'), cero, utf8(incidente), cero, utf8(rol));
}

// enc (32 bytes) ‖ cifrado de K (32 + 16 de etiqueta) = 80 bytes.
export async function envolverK(hpke: Hpke, publica: Uint8Array, incidente: string, rol: Rol, k: Uint8Array): Promise<Uint8Array> {
  if (k.length !== 32) throw new ErrorFormato('k');
  const { enc, cifrado } = await hpke.sellar(publica, infoEnvoltura(incidente, rol), k);
  return unir(enc, cifrado);
}

export async function desenvolverK(hpke: Hpke, receptor: CryptoKey | CryptoKeyPair, incidente: string, rol: Rol, envoltura: Uint8Array): Promise<Uint8Array> {
  if (envoltura.length !== 80) throw new ErrorFormato('envoltura');
  return hpke.abrir(receptor, envoltura.subarray(0, 32), infoEnvoltura(incidente, rol), envoltura.subarray(32));
}
