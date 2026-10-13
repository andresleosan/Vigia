/** Par P-256 efímero: la privada no es extraíble y muere con el proceso de la prueba. */
export async function claveP256(): Promise<{ privada: CryptoKey; spki: Uint8Array }> {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  return { privada: par.privateKey, spki: new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey)) };
}
