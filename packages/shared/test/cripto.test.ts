import { createHash, createPublicKey, verify as verificarConNode } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ErrorFormato, deHex, hex, unir, utf8 } from '../src/codificacion.ts';
import { criptoWebCrypto, derAP1363, esSpkiP256, huella, p1363ADer } from '../src/cripto.ts';

const cripto = criptoWebCrypto();
const N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const MENSAJE = utf8('mensaje de prueba');
const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
const spki = new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey));

const entero32 = (v: bigint) => deHex(v.toString(16).padStart(64, '0'));

// Un Cripto cuyo SubtleCrypto anota cada llamada.
function criptoEspiado() {
  const llamadas: string[] = [];
  const sutil = new Proxy(crypto.subtle, {
    get: (destino, nombre) => (...args: unknown[]) => {
      llamadas.push(String(nombre));
      return Reflect.apply(Reflect.get(destino, nombre), destino, args);
    },
  });
  return { espiado: criptoWebCrypto(sutil), llamadas };
}

// Firma hasta que r o s ocupe `largo` bytes en DER (con 31, una de cada 256 firmas).
async function firmaConEntero(largo: number): Promise<Uint8Array> {
  for (let i = 0; i < 20_000; i++) {
    const f = await cripto.firmarP256(par.privateKey, MENSAJE);
    const der = p1363ADer(f);
    if (der[3] === largo || der[5 + der[3]] === largo) return f;
  }
  throw new Error(`ninguna firma con un entero de ${largo} bytes`);
}

describe('criptoWebCrypto con vectores publicados', () => {
  it('SHA-256 de "abc" (FIPS 180-2)', async () => {
    expect(hex(await cripto.sha256(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('HMAC-SHA-256, RFC 4231 caso 2', async () => {
    const mac = await cripto.hmacSha256(utf8('Jefe'), utf8('what do ya want for nothing?'));
    expect(hex(mac)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('HKDF-SHA256, RFC 5869 caso 1', async () => {
    const okm = await cripto.hkdfSha256(new Uint8Array(22).fill(0x0b), deHex('000102030405060708090a0b0c'), deHex('f0f1f2f3f4f5f6f7f8f9'), 42);
    expect(hex(okm)).toBe('3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865');
  });

  it('AES-256-GCM, caso 16 de la especificación de GCM', async () => {
    const k = deHex('feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308');
    const nonce = deHex('cafebabefacedbaddecaf888');
    const aad = deHex('feedfacedeadbeeffeedfacedeadbeefabaddad2');
    const claro = deHex('d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39');
    const cifrado = await cripto.cifrarAesGcm(k, nonce, aad, claro);
    expect(hex(cifrado)).toBe('522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662'
      + '76fc6ece0f4e1768cddf8853bb2d551b');
    expect(await cripto.descifrarAesGcm(k, nonce, aad, cifrado)).toEqual(claro);
    const tocado = cifrado.slice();
    tocado[tocado.length - 1] ^= 1;
    await expect(cripto.descifrarAesGcm(k, nonce, aad, tocado)).rejects.toThrow();
  });

  it('AES-GCM solo con clave de 32 bytes y nonce de 12', async () => {
    const claro = utf8('claro');
    await expect(cripto.cifrarAesGcm(new Uint8Array(16), new Uint8Array(12), new Uint8Array(0), claro)).rejects.toThrow(ErrorFormato);
    await expect(cripto.cifrarAesGcm(new Uint8Array(32), new Uint8Array(16), new Uint8Array(0), claro)).rejects.toThrow(ErrorFormato);
  });

  it('aleatorio da los bytes pedidos y distintos en cada llamada', () => {
    const a = cripto.aleatorio(32);
    expect(a.length).toBe(32);
    expect(hex(a)).not.toBe(hex(cripto.aleatorio(32)));
  });
});

describe('firmas P-256', () => {
  it('firma en P1363 de 64 bytes que verifica, y no con otro mensaje', async () => {
    const f = await cripto.firmarP256(par.privateKey, MENSAJE);
    expect(f.length).toBe(64);
    expect(await cripto.verificarP256(spki, MENSAJE, f)).toBe(true);
    expect(await cripto.verificarP256(spki, utf8('otro mensaje'), f)).toBe(false);
  });

  it('acepta s alto sin normalizar: (r, n - s) también verifica', async () => {
    const f = await cripto.firmarP256(par.privateKey, MENSAJE);
    const s = BigInt('0x' + hex(f.subarray(32)));
    expect(await cripto.verificarP256(spki, MENSAJE, unir(f.subarray(0, 32), entero32(N - s)))).toBe(true);
  });

  it('rechaza antes de llamar a la librería: 63 o 65 bytes, r o s nulos o mayores o iguales que n', async () => {
    const { espiado, llamadas } = criptoEspiado();
    const f = await cripto.firmarP256(par.privateKey, MENSAJE);
    const [r, s] = [f.subarray(0, 32), f.subarray(32)];
    const [cero, n, maximo] = [new Uint8Array(32), entero32(N), new Uint8Array(32).fill(0xff)];
    const malas = [f.subarray(0, 63), unir(f, Uint8Array.of(0)), unir(cero, s), unir(r, cero),
      unir(n, s), unir(r, n), unir(maximo, s), unir(r, maximo)];
    for (const mala of malas) expect(await espiado.verificarP256(spki, MENSAJE, mala)).toBe(false);
    expect(llamadas).toEqual([]);
    expect(await espiado.verificarP256(spki, MENSAJE, f)).toBe(true);
    expect(llamadas).toEqual(['importKey', 'verify']);
  });

  it('solo verifica con la SPKI sin comprimir de 91 bytes y el punto en la curva', async () => {
    const f = await cripto.firmarP256(par.privateKey, MENSAJE);
    const comprimida = unir(deHex('3039301306072a8648ce3d020106082a8648ce3d030107032200'),
      Uint8Array.of(2 + (spki[90] & 1)), spki.subarray(27, 59));
    const otraCurva = spki.slice();
    otraCurva[22] = 0x06; // último byte del OID de la curva: otra curva en lugar de P-256
    const fuera = spki.slice();
    fuera[90] ^= 1; // la Y ya no corresponde a la X
    expect(esSpkiP256(spki)).toBe(true);
    for (const mala of [comprimida, spki.subarray(0, 90), unir(spki, Uint8Array.of(0)), otraCurva]) {
      expect(esSpkiP256(mala)).toBe(false);
      expect(await cripto.verificarP256(mala, MENSAJE, f)).toBe(false);
    }
    expect(esSpkiP256(fuera)).toBe(true); // la forma es buena: el punto lo rechaza la importación
    expect(await cripto.verificarP256(fuera, MENSAJE, f)).toBe(false);
  });

  it('huella es el SHA-256 en hex de la SPKI', async () => {
    expect(await huella(cripto, spki)).toBe(createHash('sha256').update(spki).digest('hex'));
  });
});

describe('DER y P1363', () => {
  it('r de 31 bytes y s de 33 con el 0x00 de signo: bytes exactos e ida y vuelta', () => {
    const p1363 = deHex('007f' + '11'.repeat(30) + 'ff' + '22'.repeat(31));
    const der = p1363ADer(p1363);
    expect(hex(der)).toBe('3044' + '021f7f' + '11'.repeat(30) + '022100ff' + '22'.repeat(31));
    expect(derAP1363(der)).toEqual(p1363);
  });

  it('enteros pequeños: r = 1 y s = 0x80', () => {
    const p1363 = deHex('00'.repeat(31) + '01' + '00'.repeat(31) + '80');
    expect(hex(p1363ADer(p1363))).toBe('300702010102020080');
    expect(derAP1363(p1363ADer(p1363))).toEqual(p1363);
  });

  it.each([31, 33])('firma real con r o s de %i bytes: el DER verifica en node:crypto y vuelve igual', async (largo) => {
    const f = await firmaConEntero(largo);
    const der = p1363ADer(f);
    const publica = createPublicKey({ key: Buffer.from(spki), format: 'der', type: 'spki' });
    expect(verificarConNode('sha256', MENSAJE, { key: publica, dsaEncoding: 'der' }, der)).toBe(true);
    expect(derAP1363(der)).toEqual(f);
  });

  it('rechaza el DER que no es estricto', () => {
    const malos = [
      '', // vacío
      '3106020101020101', // no es una SEQUENCE
      '3007020101020101', // el largo de la SEQUENCE no cuadra
      '300702010102010100', // un byte de más dentro de la SEQUENCE
      '3006030101020101', // r no es un INTEGER
      '30050200020101', // r sin bytes
      '3006020180020101', // r negativo
      '300702020001020101', // r con un cero de más delante
      '3026022101' + '00'.repeat(32) + '020101', // r de 33 bytes sin el 0x00 de signo
      '3027022200ff' + '00'.repeat(32) + '020101', // r de 34 bytes
      '3003020101', // falta s
    ];
    for (const m of malos) expect(() => derAP1363(deHex(m)), m).toThrow(ErrorFormato);
  });

  it('p1363ADer solo acepta 64 bytes', () => {
    expect(() => p1363ADer(new Uint8Array(63))).toThrow(ErrorFormato);
    expect(() => p1363ADer(new Uint8Array(65))).toThrow(ErrorFormato);
  });
});
