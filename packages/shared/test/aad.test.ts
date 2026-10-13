import { describe, expect, it } from 'vitest';
import { aad } from '../src/aad.ts';
import { hex } from '../src/codificacion.ts';

const INCIDENTE = 'incidenteDePrueba0000A';
const latin1 = (t: string) => Buffer.from(t, 'latin1').toString('hex');

describe('aad', () => {
  it('es vigia/v1, 0x00, tipo, 0x00, incidente, 0x00 y u32be(seq)', () => {
    expect(hex(aad('ct', INCIDENTE, 7))).toBe('76696769612f763100637400696e636964656e7465446550727565626130303030410000000007');
    expect(hex(aad('loc', INCIDENTE, 999_999))).toBe(latin1(`vigia/v1\0loc\0${INCIDENTE}\0`) + '000f423f');
    expect(hex(aad('meta', INCIDENTE, 0))).toBe(latin1(`vigia/v1\0meta\0${INCIDENTE}\0`) + '00000000');
  });
});
