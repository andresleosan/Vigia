import { describe, expect, it } from 'vitest';
import {
  ErrorFormato, b64u, deB64u, deHex, hex, iguales, u16be, u32be, unir, utf8,
} from '../src/codificacion.ts';

const bytes = (...b: number[]) => new Uint8Array(b);
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

describe('hex', () => {
  it('escribe minúsculas, 2 caracteres por byte', () => {
    expect(hex(bytes(0, 1, 0xab, 0xff))).toBe('0001abff');
    expect(hex(bytes())).toBe('');
  });

  it('ida y vuelta con los 256 valores', () => {
    const todos = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(deHex(hex(todos))).toEqual(todos);
  });

  it('rechaza longitud impar, mayúsculas y caracteres de más', () => {
    for (const t of ['abc', 'AB', 'zz', '0x00', ' 00', '00\n', '00 ']) {
      expect(() => deHex(t), t).toThrow(ErrorFormato);
    }
  });
});

describe('b64u', () => {
  it('vectores de RFC 4648 sin relleno y alfabeto url', () => {
    const casos: [string, string][] = [
      ['', ''], ['f', 'Zg'], ['fo', 'Zm8'], ['foo', 'Zm9v'],
      ['foob', 'Zm9vYg'], ['fooba', 'Zm9vYmE'], ['foobar', 'Zm9vYmFy'],
    ];
    for (const [claro, t] of casos) {
      expect(b64u(utf8(claro))).toBe(t);
      expect(deB64u(t)).toEqual(utf8(claro));
    }
    expect(b64u(bytes(0xfb, 0xff))).toBe('-_8');
    expect(b64u(bytes(0xff, 0xff, 0xff))).toBe('____');
  });

  it('ida y vuelta de 0 a 64 bytes', () => {
    for (let n = 0; n <= 64; n++) {
      const b = crypto.getRandomValues(new Uint8Array(n));
      expect(deB64u(b64u(b))).toEqual(b);
    }
  });

  it('rechaza relleno, otro alfabeto, espacios y caracteres no ASCII', () => {
    for (const t of ['Zg==', 'Zg=', 'Zm8=', '+/8', 'Zm9v Yg', 'Zm9vYg\n', 'Zm9vñ']) {
      expect(() => deB64u(t), t).toThrow(ErrorFormato);
    }
  });

  it('rechaza una longitud con resto 1 al dividir por 4', () => {
    for (const t of ['A', 'AAAAA', 'Zm9vYmFyZ']) expect(() => deB64u(t), t).toThrow(ErrorFormato);
  });

  it('rechaza la forma no canónica (bits sobrantes distintos de 0)', () => {
    for (const t of ['AB', 'Zh', 'AAB', 'Zm9']) expect(() => deB64u(t), t).toThrow(ErrorFormato);
    expect(deB64u('AA')).toEqual(bytes(0));
    expect(deB64u('Zm8')).toEqual(utf8('fo'));
  });

  it('de las 4096 cadenas de 2 caracteres acepta exactamente las 256 de un byte', () => {
    const aceptadas: string[] = [];
    for (const a of ALFABETO) {
      for (const b of ALFABETO) {
        try {
          deB64u(a + b);
          aceptadas.push(a + b);
        } catch (e) {
          expect(e).toBeInstanceOf(ErrorFormato);
        }
      }
    }
    expect(aceptadas).toEqual(Array.from({ length: 256 }, (_, i) => b64u(bytes(i))));
  });
});

describe('utf8 y unir', () => {
  it('codifica en UTF-8', () => {
    expect(utf8('vigia/v1')).toEqual(bytes(0x76, 0x69, 0x67, 0x69, 0x61, 0x2f, 0x76, 0x31));
    expect(utf8('ñ')).toEqual(bytes(0xc3, 0xb1));
  });

  it('concatena en orden', () => {
    expect(unir()).toEqual(bytes());
    expect(unir(bytes(1), bytes(), bytes(2, 3), bytes(0))).toEqual(bytes(1, 2, 3, 0));
  });
});

describe('u16be y u32be', () => {
  it('escriben big-endian en sus límites', () => {
    expect(u16be(0)).toEqual(bytes(0, 0));
    expect(u16be(0x1234)).toEqual(bytes(0x12, 0x34));
    expect(u16be(65535)).toEqual(bytes(0xff, 0xff));
    expect(u32be(0)).toEqual(bytes(0, 0, 0, 0));
    expect(u32be(999_999)).toEqual(bytes(0x00, 0x0f, 0x42, 0x3f));
    expect(u32be(0xffffffff)).toEqual(bytes(0xff, 0xff, 0xff, 0xff));
  });

  it('rechazan lo que no cabe', () => {
    for (const n of [65536, -1, 1.5, Number.NaN]) expect(() => u16be(n), String(n)).toThrow(ErrorFormato);
    for (const n of [2 ** 32, -1, 0.5, Number.NaN]) expect(() => u32be(n), String(n)).toThrow(ErrorFormato);
  });
});

describe('iguales', () => {
  it('compara contenido y longitud', () => {
    expect(iguales(bytes(), bytes())).toBe(true);
    expect(iguales(bytes(1, 2, 3), bytes(1, 2, 3))).toBe(true);
    expect(iguales(bytes(1, 2, 3), bytes(0, 2, 3))).toBe(false);
    expect(iguales(bytes(1, 2, 3), bytes(1, 2, 4))).toBe(false);
    expect(iguales(bytes(1, 2, 3), bytes(1, 2))).toBe(false);
  });
});

describe('ErrorFormato', () => {
  it('es un Error', () => {
    expect(new ErrorFormato('x')).toBeInstanceOf(Error);
  });
});
