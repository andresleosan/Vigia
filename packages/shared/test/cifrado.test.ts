import { describe, expect, it } from 'vitest';
import { aad } from '../src/aad.ts';
import { analizarPosicion, cifrar, codificarPosicion, descifrar, type Posicion, textoGrados } from '../src/cifrado.ts';
import { ErrorFormato, b64u, deB64u, deHex, hex, utf8 } from '../src/codificacion.ts';
import { criptoWebCrypto } from '../src/cripto.ts';
import { criptoDeterminista } from './cripto-determinista.ts';

const cripto = criptoWebCrypto();
const INCIDENTE = 'incidenteDePrueba0000A';
const K = Uint8Array.from({ length: 32 }, (_, i) => i);
const texto = (b: Uint8Array) => new TextDecoder().decode(b);
const POSICION: Posicion = { hora_fix: 1760000000000, lat_e6: 12_345_678, lon_e6: -123_456_789, precision_m: 25 };

describe('cifrar y descifrar', () => {
  it('es el nonce del Cripto seguido de AES-256-GCM (caso 16 de la especificación de GCM)', async () => {
    const k = deHex('feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308');
    const ad = deHex('feedfacedeadbeeffeedfacedeadbeefabaddad2');
    const claro = deHex('d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39');
    const cifrado = await cifrar(criptoDeterminista(deHex('cafebabefacedbaddecaf888')), k, ad, claro);
    expect(hex(cifrado)).toBe('cafebabefacedbaddecaf888'
      + '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662'
      + '76fc6ece0f4e1768cddf8853bb2d551b');
    expect(await descifrar(cripto, k, ad, cifrado)).toEqual(claro);
  });

  it('dos cifrados de lo mismo llevan nonces distintos', async () => {
    const a = await cifrar(cripto, K, aad('ct', INCIDENTE, 1), utf8('audio'));
    const b = await cifrar(cripto, K, aad('ct', INCIDENTE, 1), utf8('audio'));
    expect(hex(a.subarray(0, 12))).not.toBe(hex(b.subarray(0, 12)));
  });

  it('con la AAD de otro tipo, otro seq u otro incidente no descifra', async () => {
    const claro = utf8('audio de prueba');
    const cifrado = await cifrar(cripto, K, aad('ct', INCIDENTE, 1), claro);
    expect(await descifrar(cripto, K, aad('ct', INCIDENTE, 1), cifrado)).toEqual(claro);
    for (const otra of [aad('loc', INCIDENTE, 1), aad('meta', INCIDENTE, 1), aad('ct', INCIDENTE, 2), aad('ct', 'incidenteDePrueba0000Q', 1)]) {
      await expect(descifrar(cripto, K, otra, cifrado)).rejects.toThrow();
    }
  });
});

describe('posición', () => {
  it('pasa los microgrados a texto con aritmética entera', () => {
    expect(textoGrados(-1)).toBe('-0.000001');
    expect(textoGrados(0)).toBe('0.000000');
    expect(textoGrados(-0)).toBe('0.000000');
    expect(textoGrados(90_000_000)).toBe('90.000000');
    expect(textoGrados(-180_000_000)).toBe('-180.000000');
    expect(textoGrados(12_345_678)).toBe('12.345678');
    expect(() => textoGrados(1.5)).toThrow(ErrorFormato);
  });

  it('siempre mide 128 bytes, con el relleno justo, y se analiza de vuelta', () => {
    expect(texto(codificarPosicion(POSICION))).toBe(
      `{"hora_fix":1760000000000,"lat":"12.345678","lon":"-123.456789","precision_m":25,"relleno":"${'0'.repeat(34)}"}`);
    const extremos: Posicion[] = [
      POSICION,
      { hora_fix: 0, lat_e6: 0, lon_e6: 0, precision_m: 0 },
      { hora_fix: Number.MAX_SAFE_INTEGER, lat_e6: -90_000_000, lon_e6: -180_000_000, precision_m: 100_000 },
    ];
    for (const p of extremos) {
      const bytes = codificarPosicion(p);
      expect(bytes.length).toBe(128);
      expect(analizarPosicion(bytes)).toEqual(p);
    }
  });

  it('-0.000000 es imposible: el cero va sin signo y con signo se rechaza', () => {
    const cero = texto(codificarPosicion({ hora_fix: 1, lat_e6: -0, lon_e6: 0, precision_m: 1 }));
    expect(cero).toContain('"lat":"0.000000"');
    const conSigno = utf8(cero.replace('"lat":"0.000000"', '"lat":"-0.000000"').replace('"relleno":"0', '"relleno":"'));
    expect(conSigno.length).toBe(128);
    expect(() => analizarPosicion(conSigno)).toThrow(ErrorFormato);
  });

  it('rechaza lo que está fuera de rango al codificar y al analizar', () => {
    const base: Posicion = { hora_fix: 1, lat_e6: 0, lon_e6: 0, precision_m: 0 };
    for (const malo of [{ lat_e6: 90_000_001 }, { lat_e6: -90_000_001 }, { lon_e6: 180_000_001 }, { lon_e6: -180_000_001 },
      { precision_m: 100_001 }, { hora_fix: -1 }]) {
      expect(() => codificarPosicion({ ...base, ...malo })).toThrow(ErrorFormato);
    }
    const valida = texto(codificarPosicion({ ...base, lat_e6: 89_000_000 }));
    expect(() => analizarPosicion(utf8(valida.replace('"lat":"89.000000"', '"lat":"91.000000"')))).toThrow(ErrorFormato);
    expect(() => analizarPosicion(utf8(valida.replace('"relleno":"0', '"relleno":"')))).toThrow(ErrorFormato);
  });

  it('loc, la posición cifrada, mide 156 bytes: 208 caracteres en b64u', async () => {
    const loc = b64u(await cifrar(cripto, K, aad('loc', INCIDENTE, 3), codificarPosicion(POSICION)));
    expect(loc).toMatch(/^[A-Za-z0-9_-]{208}$/);
    expect(analizarPosicion(await descifrar(cripto, K, aad('loc', INCIDENTE, 3), deB64u(loc)))).toEqual(POSICION);
  });
});
