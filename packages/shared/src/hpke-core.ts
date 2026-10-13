// HPKE con @hpke/core: fuera del índice de shared, solo para pruebas, vectores, el CLI y la bóveda.
// El Worker nunca lo importa (SUM-02).
import { Aes256Gcm, CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from '@hpke/core';
import { ErrorFormato } from './codificacion.ts';
import type { Hpke } from './cripto.ts';

// RFC 9180, modo base, suite 0x0020 / 0x0001 / 0x0002. Un solo Seal por contexto y AAD vacía.
const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });

function crear(semilla?: Uint8Array): Hpke {
  return {
    async sellar(publica, info, claro) {
      const recipientPublicKey = await suite.kem.deserializePublicKey(publica);
      const { enc, ct } = await suite.seal({ recipientPublicKey, info, ekm: semilla }, claro);
      return { enc: new Uint8Array(enc), cifrado: new Uint8Array(ct) };
    },
    async abrir(receptor, enc, info, cifrado) {
      return new Uint8Array(await suite.open({ recipientKey: receptor, enc, info }, cifrado));
    },
  };
}

export function hpkeCore(): Hpke {
  return crear();
}

// Solo vectores: la efímera sale de la semilla (DeriveKeyPair de RFC 9180) y se repite en cada sello.
export function hpkeCoreConSemilla(semilla: Uint8Array): Hpke {
  return crear(semilla);
}

const PKCS8_X25519 = Uint8Array.of(0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20);

// Privada X25519 cruda (32 bytes, RFC 7748) a un par con la privada no extraíble (CIF-04, BOV-01C).
export async function importarReceptora(cruda: Uint8Array): Promise<CryptoKeyPair> {
  if (cruda.length !== 32) throw new ErrorFormato('privada');
  const pkcs8 = new Uint8Array(48);
  pkcs8.set(PKCS8_X25519);
  pkcs8.set(cruda, 16);
  const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'X25519' }, false, ['deriveBits']);
  pkcs8.fill(0); // no deja otra copia de la privada en memoria
  // La pública es X25519(privada, 9): sale de la privada sin exportarla.
  const base = new Uint8Array(32);
  base[0] = 9;
  const puntoBase = await crypto.subtle.importKey('raw', base, { name: 'X25519' }, true, []);
  const publica = await crypto.subtle.deriveBits({ name: 'X25519', public: puntoBase }, privateKey, 256);
  return { privateKey, publicKey: await crypto.subtle.importKey('raw', publica, { name: 'X25519' }, true, []) };
}
