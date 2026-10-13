import { ErrorFormato, deHex, hex } from './codificacion.ts';

// @types/node declara CryptoKey y SubtleCrypto como globales, pero no CryptoKeyPair. Misma forma
// que en WebCrypto: se fusiona con la de lib.dom o la de workers-types donde existen.
declare global {
  interface CryptoKeyPair { privateKey: CryptoKey; publicKey: CryptoKey }
}

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

export interface Hpke {
  sellar(publica: Uint8Array, info: Uint8Array, claro: Uint8Array): Promise<{ enc: Uint8Array; cifrado: Uint8Array }>;
  abrir(receptor: CryptoKey | CryptoKeyPair, enc: Uint8Array, info: Uint8Array, cifrado: Uint8Array): Promise<Uint8Array>;
}

const PREFIJO_SPKI_P256 = deHex('3059301306072a8648ce3d020106082a8648ce3d03010703420004');
const ORDEN_P256 = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const ECDSA_SHA256 = { name: 'ECDSA', hash: 'SHA-256' };
const P256 = { name: 'ECDSA', namedCurve: 'P-256' };

// WebCrypto pide BufferSource, sin SharedArrayBuffer; los bytes de Vigía nunca vienen de uno.
const bufer = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>;

export function esSpkiP256(spki: Uint8Array): boolean {
  return spki.length === 91 && PREFIJO_SPKI_P256.every((b, i) => spki[i] === b);
}

// r o s de una firma P1363: entero big-endian de 32 bytes con 0 < x < n (sección 4).
function enRango(x: Uint8Array): boolean {
  const v = BigInt('0x' + hex(x));
  return v > 0n && v < ORDEN_P256;
}

export function criptoWebCrypto(sutil: SubtleCrypto = crypto.subtle): Cripto {
  // WebCrypto acepta claves de 16 y 24 bytes y nonces de otro largo: aquí solo AES-256 con 96 bits.
  const claveAes = (k: Uint8Array, nonce: Uint8Array, uso: 'encrypt' | 'decrypt') => {
    if (k.length !== 32 || nonce.length !== 12) throw new ErrorFormato('aes');
    return sutil.importKey('raw', bufer(k), 'AES-GCM', false, [uso]);
  };
  return {
    // ponytail: getRandomValues da como mucho 65 536 bytes por llamada; Vigía pide 12, 16 o 32.
    aleatorio: (n) => crypto.getRandomValues(new Uint8Array(n)),
    sha256: async (datos) => new Uint8Array(await sutil.digest('SHA-256', bufer(datos))),
    hmacSha256: async (clave, datos) => {
      const k = await sutil.importKey('raw', bufer(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      return new Uint8Array(await sutil.sign('HMAC', k, bufer(datos)));
    },
    hkdfSha256: async (ikm, sal, info, n) => {
      const k = await sutil.importKey('raw', bufer(ikm), 'HKDF', false, ['deriveBits']);
      return new Uint8Array(await sutil.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: bufer(sal), info: bufer(info) }, k, n * 8));
    },
    firmarP256: async (privada, mensaje) => new Uint8Array(await sutil.sign(ECDSA_SHA256, privada, bufer(mensaje))),
    verificarP256: async (spki, mensaje, firma) => {
      if (!esSpkiP256(spki) || firma.length !== 64) return false;
      if (!enRango(firma.subarray(0, 32)) || !enRango(firma.subarray(32))) return false;
      let publica: CryptoKey;
      try {
        publica = await sutil.importKey('spki', bufer(spki), P256, false, ['verify']);
      } catch {
        return false; // punto fuera de la curva
      }
      return sutil.verify(ECDSA_SHA256, publica, bufer(firma), bufer(mensaje));
    },
    cifrarAesGcm: async (k, nonce, aad, claro) => {
      const clave = await claveAes(k, nonce, 'encrypt');
      return new Uint8Array(await sutil.encrypt({ name: 'AES-GCM', iv: bufer(nonce), additionalData: bufer(aad) }, clave, bufer(claro)));
    },
    descifrarAesGcm: async (k, nonce, aad, cifrado) => {
      const clave = await claveAes(k, nonce, 'decrypt');
      return new Uint8Array(await sutil.decrypt({ name: 'AES-GCM', iv: bufer(nonce), additionalData: bufer(aad) }, clave, bufer(cifrado)));
    },
  };
}

export function p1363ADer(p1363: Uint8Array): Uint8Array {
  if (p1363.length !== 64) throw new ErrorFormato('p1363');
  const entero = (x: Uint8Array) => {
    let i = 0;
    while (i < 31 && x[i] === 0) i++;
    const v = x[i] & 0x80 ? [0, ...x.subarray(i)] : [...x.subarray(i)];
    return [0x02, v.length, ...v];
  };
  const cuerpo = [...entero(p1363.subarray(0, 32)), ...entero(p1363.subarray(32))];
  return Uint8Array.from([0x30, cuerpo.length, ...cuerpo]);
}

// DER estricto: SEQUENCE de dos INTEGER positivos, mínimos y de 256 bits como mucho.
export function derAP1363(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30 || der[1] !== der.length - 2) throw new ErrorFormato('der');
  const p1363 = new Uint8Array(64);
  let i = 2;
  for (const destino of [0, 32]) {
    const n = der[i + 1] ?? 0;
    const v = der.subarray(i + 2, i + 2 + n);
    if (der[i] !== 0x02 || n < 1 || n > 33 || v.length !== n) throw new ErrorFormato('der');
    if (v[0] & 0x80) throw new ErrorFormato('der'); // negativo
    if (n > 1 && v[0] === 0 && !(v[1] & 0x80)) throw new ErrorFormato('der'); // cero de más
    if (n === 33 && v[0] !== 0) throw new ErrorFormato('der'); // más de 256 bits
    const sinSigno = n === 33 ? v.subarray(1) : v;
    p1363.set(sinSigno, destino + 32 - sinSigno.length);
    i += 2 + n;
  }
  if (i !== der.length) throw new ErrorFormato('der');
  return p1363;
}

export async function huella(cripto: Cripto, spki: Uint8Array): Promise<string> {
  return hex(await cripto.sha256(spki));
}
