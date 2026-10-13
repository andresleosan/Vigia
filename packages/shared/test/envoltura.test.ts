import { readFileSync } from 'node:fs';
import { Aes256Gcm, CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from '@hpke/core';
import { describe, expect, it } from 'vitest';
import { ErrorFormato, deHex, hex } from '../src/codificacion.ts';
import { criptoWebCrypto } from '../src/cripto.ts';
import { desenvolverK, envolverK, infoEnvoltura } from '../src/envoltura.ts';
import { hpkeCore, hpkeCoreConSemilla, importarReceptora } from '../src/hpke-core.ts';

type VectorCfrg = {
  info: string; ikmR: string; ikmE: string; pkRm: string; enc: string; key: string; base_nonce: string;
  encryptions: { aad: string; ct: string; nonce: string; pt: string }[];
};
const v = JSON.parse(readFileSync(new URL('../vectores/hpke-cfrg.json', import.meta.url), 'utf8')) as VectorCfrg;

const cripto = criptoWebCrypto();
const hpke = hpkeCore();
const INCIDENTE = 'incidenteDePrueba0000A';
const K = Uint8Array.from({ length: 32 }, (_, i) => i);
const par = await crypto.subtle.generateKey('X25519', false, ['deriveBits']) as CryptoKeyPair;
const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));

// La privada del receptor del vector, derivada de ikmR con la propia librería.
const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
const privadaDelVector = new Uint8Array(await suite.kem.serializePrivateKey((await suite.kem.deriveKeyPair(deHex(v.ikmR))).privateKey));

describe('vector de CFRG de la suite 0x0020/0x0001/0x0002 en modo base', () => {
  it('la efímera de ikmE da el enc del vector, y un solo Seal con AAD vacía usa su clave y su nonce base', async () => {
    const pt = deHex(v.encryptions[0].pt);
    const { enc, cifrado } = await hpkeCoreConSemilla(deHex(v.ikmE)).sellar(deHex(v.pkRm), deHex(v.info), pt);
    expect(hex(enc)).toBe(v.enc);
    expect(cifrado).toEqual(await cripto.cifrarAesGcm(deHex(v.key), deHex(v.base_nonce), new Uint8Array(0), pt));
    expect(await hpke.abrir(await importarReceptora(privadaDelVector), enc, deHex(v.info), cifrado)).toEqual(pt);
  });

  it('el receptor importado da pkRm, su privada no se exporta y abre los 257 cifrados del vector', async () => {
    const receptor = await importarReceptora(privadaDelVector);
    expect(hex(new Uint8Array(await crypto.subtle.exportKey('raw', receptor.publicKey)))).toBe(v.pkRm);
    await expect(crypto.subtle.exportKey('pkcs8', receptor.privateKey)).rejects.toThrow();
    const ctx = await suite.createRecipientContext({ recipientKey: receptor, enc: deHex(v.enc), info: deHex(v.info) });
    for (const e of v.encryptions) expect(hex(new Uint8Array(await ctx.open(deHex(e.ct), deHex(e.aad))))).toBe(e.pt);
    expect(v.encryptions.length).toBe(257);
  });

  it('importarReceptora solo acepta 32 bytes', async () => {
    await expect(importarReceptora(new Uint8Array(31))).rejects.toThrow(ErrorFormato);
  });
});

describe('envoltura de K', () => {
  it('info es vigia/v1/envoltura, 0x00, incidente, 0x00 y rol', () => {
    expect(hex(infoEnvoltura(INCIDENTE, 'contacto'))).toBe('76696769612f76312f656e766f6c7475726100696e636964656e74654465507275656261303030304100636f6e746163746f');
  });

  it('mide 80 bytes y se abre con un par no extraíble o con su privada sola', async () => {
    const envoltura = await envolverK(hpke, publica, INCIDENTE, 'contacto', K);
    expect(envoltura.length).toBe(80);
    expect(await desenvolverK(hpke, par, INCIDENTE, 'contacto', envoltura)).toEqual(K);
    expect(await desenvolverK(hpke, par.privateKey, INCIDENTE, 'contacto', envoltura)).toEqual(K);
    await expect(crypto.subtle.exportKey('pkcs8', par.privateKey)).rejects.toThrow();
  });

  it('con otro incidente u otro rol no abre', async () => {
    const envoltura = await envolverK(hpke, publica, INCIDENTE, 'contacto', K);
    await expect(desenvolverK(hpke, par, 'incidenteDePrueba0000Q', 'contacto', envoltura)).rejects.toThrow();
    await expect(desenvolverK(hpke, par, INCIDENTE, 'escucha', envoltura)).rejects.toThrow();
  });

  it('dos envolturas de la misma K llevan efímeras (enc) distintas', async () => {
    const a = await envolverK(hpke, publica, INCIDENTE, 'recuperacion', K);
    const b = await envolverK(hpke, publica, INCIDENTE, 'recuperacion', K);
    expect(hex(a.subarray(0, 32))).not.toBe(hex(b.subarray(0, 32)));
  });

  it('solo envuelve una K de 32 bytes y solo abre envolturas de 80', async () => {
    await expect(envolverK(hpke, publica, INCIDENTE, 'contacto', new Uint8Array(31))).rejects.toThrow(ErrorFormato);
    const envoltura = await envolverK(hpke, publica, INCIDENTE, 'contacto', K);
    await expect(desenvolverK(hpke, par, INCIDENTE, 'contacto', envoltura.subarray(0, 79))).rejects.toThrow(ErrorFormato);
  });
});
