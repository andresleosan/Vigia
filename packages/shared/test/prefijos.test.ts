import { describe, expect, it } from 'vitest';
import { PREFIJO } from '../src/prefijos.ts';

const ascii = (t: string) => new TextEncoder().encode(t);

describe('PREFIJO', () => {
  it('cada prefijo es vigia/v1/<nombre> seguido de 0x00', () => {
    expect(PREFIJO).toEqual({
      registro: ascii('vigia/v1/registro\0'),
      cierre: ascii('vigia/v1/cierre\0'),
      peticion: ascii('vigia/v1/peticion\0'),
      acuse: ascii('vigia/v1/acuse\0'),
      evento: ascii('vigia/v1/evento\0'),
      compromiso: ascii('vigia/v1/compromiso\0'),
      recuperacion: ascii('vigia/v1/recuperacion\0'),
    });
  });
});
