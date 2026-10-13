import { describe, expect, it } from 'vitest';
import { ErrorFormato, unir, utf8 } from '../src/codificacion.ts';
import { criptoWebCrypto } from '../src/cripto.ts';
import { PREFIJO } from '../src/prefijos.ts';
import {
  type Apertura, type Cierre, type Fragmento, type Hueco, type Registro,
  analizarRegistro, bytesRegistro, compromisoK, firmarRegistro, hashRegistro, huellaAudio, prefijoDe, verificarRegistro,
} from '../src/registros.ts';

const cripto = criptoWebCrypto();
const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
const spki = new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey));
const otro = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);

const INCIDENTE = 'incidenteDePrueba0000A';
const H = (c: string) => c.repeat(64);
const LOC = 'A'.repeat(208);
const texto = (b: Uint8Array) => new TextDecoder().decode(b);

const APERTURA: Apertura = { v: 1, tipo: 'apertura', incidente: INCIDENTE, seq: 0, hora_telefono: 1760000000000, country_code: 'VE', dispositivo: H('d'), origen: 'grabar', kc: H('a') };
const FRAGMENTO: Fragmento = { v: 1, tipo: 'fragmento', incidente: INCIDENTE, seq: 1, hora_telefono: 1760000004000, p: H('1'), c: H('2'), prev: H('3') };
const HUECO: Hueco = { v: 1, tipo: 'hueco', incidente: INCIDENTE, seq: 2, hora_telefono: 1760000008000, prev: H('4'), fin: 1760000012000, motivo: 'microfono' };
const CIERRE: Cierre = { v: 1, tipo: 'cierre', incidente: INCIDENTE, hora_telefono: 1760000016000, ultimo_seq: 2, hash_final: H('5') };

const TEXTO_APERTURA = `{"country_code":"VE","dispositivo":"${H('d')}","hora_telefono":1760000000000,"incidente":"${INCIDENTE}","kc":"${H('a')}","origen":"grabar","seq":0,"tipo":"apertura","v":1}`;
const TEXTO_FRAGMENTO = `{"c":"${H('2')}","hora_telefono":1760000004000,"incidente":"${INCIDENTE}","p":"${H('1')}","prev":"${H('3')}","seq":1,"tipo":"fragmento","v":1}`;
const TEXTO_CON_LOC = `{"c":"${H('2')}","hora_telefono":1760000004000,"incidente":"${INCIDENTE}","loc":"${LOC}","p":"${H('1')}","prev":"${H('3')}","seq":1,"tipo":"fragmento","v":1}`;
const TEXTO_HUECO = `{"fin":1760000012000,"hora_telefono":1760000008000,"incidente":"${INCIDENTE}","motivo":"microfono","prev":"${H('4')}","seq":2,"tipo":"hueco","v":1}`;
const TEXTO_CIERRE = `{"hash_final":"${H('5')}","hora_telefono":1760000016000,"incidente":"${INCIDENTE}","tipo":"cierre","ultimo_seq":2,"v":1}`;

describe('bytes de los registros', () => {
  it('cada tipo da su JCV exacto y se analiza de vuelta', () => {
    const casos: [Registro, string][] = [[APERTURA, TEXTO_APERTURA], [FRAGMENTO, TEXTO_FRAGMENTO],
      [{ ...FRAGMENTO, loc: LOC }, TEXTO_CON_LOC], [HUECO, TEXTO_HUECO], [CIERRE, TEXTO_CIERRE]];
    for (const [r, t] of casos) {
      expect(texto(bytesRegistro(r))).toBe(t);
      expect(analizarRegistro(utf8(t))).toEqual(r);
    }
  });

  it('hash es el SHA-256 en hex de los bytes', async () => {
    expect(await hashRegistro(cripto, utf8(TEXTO_APERTURA))).toBe('b29a6e98867b5eebf60fef45614caa4bf454987f6a0687ec3f4b161bfa700942');
  });

  it('bytesRegistro no codifica un registro fuera de su esquema', () => {
    expect(() => bytesRegistro({ ...FRAGMENTO, seq: 0 })).toThrow(ErrorFormato);
    expect(() => bytesRegistro({ ...HUECO, fin: HUECO.hora_telefono - 1 })).toThrow(ErrorFormato);
  });
});

describe('analizarRegistro rechaza', () => {
  it.each([
    ['tipo desconocido', TEXTO_CIERRE.replace('"tipo":"cierre"', '"tipo":"otro"')],
    ['seq de la apertura distinto de 0', TEXTO_APERTURA.replace('"seq":0', '"seq":1')],
    ['seq 1 000 000', TEXTO_FRAGMENTO.replace('"seq":1', '"seq":1000000')],
    ['fin menor que hora_telefono', TEXTO_HUECO.replace('"fin":1760000012000', '"fin":1760000007999')],
    ['country_code en minúsculas', TEXTO_APERTURA.replace('"VE"', '"ve"')],
    ['kc corto', TEXTO_APERTURA.replace(`"kc":"${H('a')}"`, `"kc":"${'a'.repeat(63)}"`)],
    ['clave duplicada', TEXTO_APERTURA.replace('"seq":0', '"seq":0,"seq":0')],
    ['v distinto de 1', TEXTO_CIERRE.replace('"v":1', '"v":2')],
    ['clave de otro tipo', TEXTO_CIERRE.replace('"tipo":"cierre"', '"seq":2,"tipo":"cierre"')],
    ['loc que no mide 208', TEXTO_CON_LOC.replace(LOC, LOC.slice(1))],
    ['motivo fuera de la lista', TEXTO_HUECO.replace('microfono', 'otro')],
    ['incidente que no es un id', TEXTO_CIERRE.replace(INCIDENTE, INCIDENTE.slice(1))],
  ])('%s', (_, t) => {
    expect(() => analizarRegistro(utf8(t))).toThrow(ErrorFormato);
  });
});

describe('firmas de los registros', () => {
  it('verifica con la clave que firmó, no con otra ni con un byte cambiado', async () => {
    const { bytes, s } = await firmarRegistro(cripto, par.privateKey, APERTURA);
    expect(bytes).toEqual(utf8(TEXTO_APERTURA));
    expect(await verificarRegistro(cripto, spki, bytes, s)).toBe(true);
    const otraSpki = new Uint8Array(await crypto.subtle.exportKey('spki', otro.publicKey));
    expect(await verificarRegistro(cripto, otraSpki, bytes, s)).toBe(false);
    const cambiado = utf8(TEXTO_APERTURA.replace('1760000000000', '1760000000001'));
    expect(await verificarRegistro(cripto, spki, cambiado, s)).toBe(false);
  });

  it('una firma de fragmento no verifica como cierre ni al revés (separación de dominios)', async () => {
    const { bytes, s } = await firmarRegistro(cripto, par.privateKey, FRAGMENTO);
    expect(await verificarRegistro(cripto, spki, bytes, s)).toBe(true);
    expect(await cripto.verificarP256(spki, unir(PREFIJO.cierre, bytes), s)).toBe(false);
    const conPrefijoDeCierre = await cripto.firmarP256(par.privateKey, unir(PREFIJO.cierre, bytes));
    expect(await verificarRegistro(cripto, spki, bytes, conPrefijoDeCierre)).toBe(false);
  });

  it('el cierre se firma con su prefijo y el resto con el de registro', async () => {
    expect(prefijoDe(CIERRE)).toEqual(PREFIJO.cierre);
    for (const r of [APERTURA, FRAGMENTO, HUECO]) expect(prefijoDe(r)).toEqual(PREFIJO.registro);
    const { bytes, s } = await firmarRegistro(cripto, par.privateKey, CIERRE);
    expect(await cripto.verificarP256(spki, unir(PREFIJO.cierre, bytes), s)).toBe(true);
    expect(await verificarRegistro(cripto, spki, bytes, s)).toBe(true);
  });

  it('unos bytes que no son un registro no verifican aunque estén firmados', async () => {
    const malos = utf8(TEXTO_APERTURA.replace('"VE"', '"ve"'));
    const s = await cripto.firmarP256(par.privateKey, unir(PREFIJO.registro, malos));
    expect(await verificarRegistro(cripto, spki, malos, s)).toBe(false);
  });
});

// Valores esperados calculados con otra implementación (hashlib y hmac de Python); el HMAC y el
// HKDF de criptoWebCrypto ya se comprueban con RFC 4231 y RFC 5869 en cripto.test.ts.
describe('kc y p', () => {
  const K = Uint8Array.from({ length: 32 }, (_, i) => i);
  const OTRA_K = Uint8Array.from({ length: 32 }, (_, i) => i + 32);
  const SILENCIO = new Uint8Array(64);

  it('kc liga K al incidente', async () => {
    expect(await compromisoK(cripto, INCIDENTE, K)).toBe('83cfa1a601c7a4f2e126eb4228aa95a9a19e34b90c381115a820afcad09ed7e7');
    expect(await compromisoK(cripto, 'incidenteDePrueba0000Q', K)).toBe('2b7b05d51de425c7e95a5cf3b819a84bfc05c035cf0dcaa49ba8b173e826045d');
  });

  it('p del mismo silencio cambia con K: no se compara audio conocido sin la clave', async () => {
    expect(await huellaAudio(cripto, K, SILENCIO)).toBe('c9afced83c07fcd1a275e8afab0229e57405af7f1da8e09cd04234d46ef21a6f');
    expect(await huellaAudio(cripto, OTRA_K, SILENCIO)).toBe('5b6bb5fb3fa5fe4ce026f19c86ecfc96a163b432ad31abec7177342bea0ee1d5');
  });
});
