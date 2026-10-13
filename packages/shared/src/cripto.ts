export interface Cripto {
  aleatorio(n: number): Uint8Array;
  sha256(datos: Uint8Array): Promise<Uint8Array>;
  hmacSha256(clave: Uint8Array, datos: Uint8Array): Promise<Uint8Array>;
  hkdfSha256(ikm: Uint8Array, sal: Uint8Array, info: Uint8Array, n: number): Promise<Uint8Array>;
  firmarP256(privada: CryptoKey, mensaje: Uint8Array): Promise<Uint8Array>; // P1363, 64 bytes
  verificarP256(spki: Uint8Array, mensaje: Uint8Array, firma: Uint8Array): Promise<boolean>; // rechaza antes lo de la sección 4
  cifrarAesGcm(k: Uint8Array, nonce: Uint8Array, aad: Uint8Array, claro: Uint8Array): Promise<Uint8Array>;
  descifrarAesGcm(k: Uint8Array, nonce: Uint8Array, aad: Uint8Array, cifrado: Uint8Array): Promise<Uint8Array>;
}
