import { describe, expect, it } from 'vitest';
import { ErrorFormato, unir, utf8 } from '../src/codificacion.ts';
import { analizarJcv, codificarJcv, type Esquema, type Valor } from '../src/jcv.ts';

const ESQUEMA: Esquema = {
  hora: { tipo: 'entero', min: 0, max: Number.MAX_SAFE_INTEGER },
  id: { tipo: 'cadena', patron: /^[A-Za-z0-9_-]{22}$/ },
  nota: { tipo: 'cadena', patron: /^[a-z.]{0,8}$/, opcional: true },
  v: { tipo: 'entero', min: 1, max: 1 },
};
const ID = 'AAECAwQFBgcICQoLDA0ODw';
const BASE = `{"hora":1760000000000,"id":"${ID}","v":1}`;

const texto = (b: Uint8Array) => new TextDecoder().decode(b);
const analizar = (t: string) => analizarJcv(utf8(t), ESQUEMA);
// Para probar valores que el tipo no deja escribir.
const codificarCualquiera = (o: Record<string, unknown>) => codificarJcv(o as Record<string, Valor>);

describe('codificarJcv', () => {
  it('ordena las claves por sus bytes y no deja espacios', () => {
    expect(texto(codificarJcv({ v: 1, id: ID, hora: 1760000000000 }))).toBe(BASE);
    // '0' (0x30) va antes que '_' (0x5f), y un prefijo antes que lo que lo alarga.
    expect(texto(codificarJcv({ b: 1, a_b: 2, a0: 3, a: 4 }))).toBe('{"a":4,"a0":3,"a_b":2,"b":1}');
    expect(texto(codificarJcv({}))).toBe('{}');
  });

  it('admite los límites del contrato', () => {
    const larga = 'a'.repeat(4096);
    expect(texto(codificarJcv({ t: larga }))).toBe(`{"t":"${larga}"}`);
    expect(texto(codificarJcv({ t: '' }))).toBe('{"t":""}');
    expect(texto(codificarJcv({ n: 0, m: Number.MAX_SAFE_INTEGER }))).toBe('{"m":9007199254740991,"n":0}');
    expect(texto(codificarJcv({ ['a'.repeat(32)]: 1 }))).toBe(`{"${'a'.repeat(32)}":1}`);
    expect(texto(codificarJcv({ c: 'Az09_.-' }))).toBe('{"c":"Az09_.-"}');
  });

  it('omite las claves sin valor (opcionales ausentes)', () => {
    expect(texto(codificarCualquiera({ a: 1, b: undefined }))).toBe('{"a":1}');
  });

  it('rechaza claves mal formadas', () => {
    for (const clave of ['A', '1a', '_a', 'a-b', 'a.b', 'ñ', '', 'a'.repeat(33)]) {
      expect(() => codificarJcv({ [clave]: 1 }), clave).toThrow(ErrorFormato);
    }
  });

  it('rechaza cadenas fuera del conjunto o de más de 4096 caracteres', () => {
    for (const v of ['a b', 'ñ', '"', '\\', '/', '+', 'a\n', 'a'.repeat(4097)]) {
      expect(() => codificarJcv({ t: v }), v).toThrow(ErrorFormato);
    }
  });

  it('rechaza enteros fuera de rango y otros tipos', () => {
    for (const v of [-1, 1.5, 2 ** 53, Number.NaN, Number.POSITIVE_INFINITY, true, null, {}, [], 1n]) {
      expect(() => codificarCualquiera({ n: v }), String(v)).toThrow(ErrorFormato);
    }
  });
});

describe('analizarJcv', () => {
  it('ida y vuelta: codificar(analizar(b)) == b', () => {
    expect(analizar(BASE)).toEqual({ hora: 1760000000000, id: ID, v: 1 });
    expect(texto(codificarJcv(analizar(BASE)))).toBe(BASE);
  });

  it('acepta 2^53 − 1 y 0', () => {
    expect(analizar(`{"hora":9007199254740991,"id":"${ID}","v":1}`).hora).toBe(Number.MAX_SAFE_INTEGER);
    expect(analizar(`{"hora":0,"id":"${ID}","v":1}`).hora).toBe(0);
  });

  it('opcionales: presentes o ausentes, pero siempre con su patrón', () => {
    expect(analizar(`{"hora":1,"id":"${ID}","nota":"a.b","v":1}`).nota).toBe('a.b');
    expect(analizar(`{"hora":1,"id":"${ID}","nota":"","v":1}`).nota).toBe('');
    expect(Object.keys(analizar(`{"hora":1,"id":"${ID}","v":1}`))).toEqual(['hora', 'id', 'v']);
    expect(() => analizar(`{"hora":1,"id":"${ID}","nota":"ABC","v":1}`)).toThrow(ErrorFormato);
  });

  const rechazos: Record<string, string[]> = {
    desordenadas: [`{"id":"${ID}","hora":1,"v":1}`, `{"hora":1,"v":1,"id":"${ID}"}`],
    duplicadas: [`{"hora":1,"hora":1,"id":"${ID}","v":1}`, `{"hora":1,"id":"${ID}","v":1,"v":1}`],
    espacios: [`{"hora": 1,"id":"${ID}","v":1}`, `{ "hora":1,"id":"${ID}","v":1}`, `${BASE} `, ` ${BASE}`],
    'claves desconocidas': [
      `{"hora":1,"id":"${ID}","v":1,"x":1}`,
      `{"constructor":1,"hora":1,"id":"${ID}","v":1}`,
      `{"__proto__":1,"hora":1,"id":"${ID}","v":1}`,
    ],
    'claves que faltan': [`{"hora":1,"v":1}`, `{"hora":1,"id":"${ID}"}`, '{}'],
    tipos: [
      `{"hora":"1","id":"${ID}","v":1}`, `{"hora":1,"id":1,"v":1}`,
      `{"hora":1,"id":"${ID}","v":true}`, `{"hora":1,"id":"${ID}","v":null}`,
    ],
    'patrón o rango': [`{"hora":1,"id":"${ID.slice(1)}","v":1}`, `{"hora":1,"id":"${ID}","v":2}`],
    'caracteres fuera del conjunto': [
      `{"hora":1,"id":"${ID}","nota":"a b","v":1}`,
      `{"hora":1,"id":"${ID}","nota":"\\u0061","v":1}`,
      `{"hora":1,"id":"${ID}","nota":"a\\/b","v":1}`,
    ],
    'ceros a la izquierda': [`{"hora":01,"id":"${ID}","v":1}`, `{"hora":00,"id":"${ID}","v":1}`],
    negativos: [`{"hora":-1,"id":"${ID}","v":1}`, `{"hora":-0,"id":"${ID}","v":1}`],
    'mayor que 2^53 − 1': [
      `{"hora":9007199254740992,"id":"${ID}","v":1}`,
      `{"hora":9007199254740993,"id":"${ID}","v":1}`,
      `{"hora":100000000000000000000,"id":"${ID}","v":1}`,
    ],
    decimales: [`{"hora":1.0,"id":"${ID}","v":1}`, `{"hora":1.5,"id":"${ID}","v":1}`],
    exponentes: [`{"hora":1e3,"id":"${ID}","v":1}`, `{"hora":1E3,"id":"${ID}","v":1}`, `{"hora":1e+3,"id":"${ID}","v":1}`],
    'objetos anidados': [`{"hora":1,"id":"${ID}","nota":{"a":1},"v":1}`],
    arrays: ['[]', `[${BASE}]`, `{"hora":1,"id":"${ID}","nota":["a"],"v":1}`],
    'basura al final': [`${BASE}x`, `${BASE}{}`, `${BASE},`],
    'entrada vacía o que no es un objeto': ['', '1', '"a"', 'null', 'true'],
    'otra sintaxis': [`{'hora':1,'id':'${ID}','v':1}`, `{hora:1,"id":"${ID}","v":1}`, `{"hora":1,"id":"${ID}","v":1,}`],
    'saltos de línea y tabuladores': [`${BASE}\n`, `{"hora":1,\n"id":"${ID}","v":1}`, `{"hora":\t1,"id":"${ID}","v":1}`],
    'bytes no ASCII': [`{"hora":1,"id":"${ID}","nota":"ñ","v":1}`],
  };

  for (const [caso, textos] of Object.entries(rechazos)) {
    it(`rechaza ${caso}`, () => {
      for (const t of textos) expect(() => analizar(t), JSON.stringify(t)).toThrow(ErrorFormato);
    });
  }

  it('rechaza el BOM y los bytes 0x00 y 0xff', () => {
    const base = utf8(BASE);
    for (const b of [unir(new Uint8Array([0xef, 0xbb, 0xbf]), base), unir(base, new Uint8Array([0])), unir(base, new Uint8Array([0xff]))]) {
      expect(() => analizarJcv(b, ESQUEMA)).toThrow(ErrorFormato);
    }
  });

  it('rechaza una cadena de 4097 caracteres aunque el esquema la admita', () => {
    const esquema: Esquema = { t: { tipo: 'cadena', patron: /^a*$/ } };
    expect(analizarJcv(utf8(`{"t":"${'a'.repeat(4096)}"}`), esquema).t).toHaveLength(4096);
    expect(() => analizarJcv(utf8(`{"t":"${'a'.repeat(4097)}"}`), esquema)).toThrow(ErrorFormato);
  });
});
