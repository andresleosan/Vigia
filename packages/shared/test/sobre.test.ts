import { describe, expect, it } from 'vitest';
import { ErrorFormato, hex, utf8 } from '../src/codificacion.ts';
import { desempaquetarSobre, empaquetarSobre, MAX_SOBRE } from '../src/sobre.ts';

const r = utf8('{"v":1}');
const s = new Uint8Array(64).fill(7);
const cifrado = Uint8Array.of(1, 2, 3);

describe('sobre binario (sección 10)', () => {
  it('bytes exactos: u16be(len r) ‖ r ‖ s ‖ cifrado', () => {
    expect(hex(empaquetarSobre({ r, s, cifrado }))).toBe(`0007${hex(r)}${'07'.repeat(64)}010203`);
  });

  it('ida y vuelta, también con el cifrado vacío', () => {
    for (const c of [cifrado, new Uint8Array(0)]) {
      expect(desempaquetarSobre(empaquetarSobre({ r, s, cifrado: c }))).toEqual({ r, s, cifrado: c });
    }
  });

  it('admite 65 536 bytes y rechaza 65 537', () => {
    const justo = new Uint8Array(MAX_SOBRE - 2 - r.length - 64);
    const cuerpo = empaquetarSobre({ r, s, cifrado: justo });
    expect(cuerpo).toHaveLength(65_536);
    expect(desempaquetarSobre(cuerpo).cifrado).toHaveLength(justo.length);
    expect(() => empaquetarSobre({ r, s, cifrado: new Uint8Array(justo.length + 1) })).toThrow(ErrorFormato);
    const grande = new Uint8Array(65_537);
    grande.set(cuerpo);
    expect(() => desempaquetarSobre(grande)).toThrow(ErrorFormato);
  });

  it('rechaza un len_r imposible y los cuerpos cortos', () => {
    const bueno = empaquetarSobre({ r, s, cifrado: new Uint8Array(0) });
    const malos: Record<string, Uint8Array> = {
      vacio: new Uint8Array(0),
      un_byte: Uint8Array.of(0),
      len_r_cero: new Uint8Array(2 + 1 + 64),
      len_r_mayor_que_el_resto: Uint8Array.of(0xff, 0xff, ...bueno.slice(2)),
      falta_un_byte_de_s: bueno.slice(0, -1),
    };
    for (const [nombre, cuerpo] of Object.entries(malos)) {
      expect(() => desempaquetarSobre(cuerpo), nombre).toThrow(ErrorFormato);
    }
  });

  it('no empaqueta un r vacío ni una s que no mide 64 bytes', () => {
    expect(() => empaquetarSobre({ r: new Uint8Array(0), s, cifrado })).toThrow(ErrorFormato);
    for (const n of [63, 65]) expect(() => empaquetarSobre({ r, s: new Uint8Array(n), cifrado })).toThrow(ErrorFormato);
  });
});
