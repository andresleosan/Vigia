import type { EntradaClave } from '../src/acuse.ts';

/** Par P-256 efímero: la privada no es extraíble y muere con el proceso de la prueba. */
export async function claveP256(): Promise<{ privada: CryptoKey; spki: Uint8Array }> {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  return { privada: par.privateKey, spki: new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey)) };
}

export async function claveAcuse(
  kid: string,
  estado: EntradaClave['estado'],
  desde: number,
  hasta?: number,
): Promise<{ privada: CryptoKey; entrada: EntradaClave }> {
  const { privada, spki } = await claveP256();
  return { privada, entrada: hasta === undefined ? { kid, spki, estado, desde } : { kid, spki, estado, desde, hasta } };
}
