import { ErrorFormato } from '@vigia/shared';
import { describe, expect, it } from 'vitest';
import { conciliar } from '../herramientas/conciliacion.ts';

const INC = 'incidenteDePrueba00001';
const clave = (seq: number, cifra: string) => `i/${INC}/${seq}/${cifra.repeat(64)}`;
const UNO = { clave: clave(1, 'a'), tamano: 16_412 };
const DOS = { clave: clave(2, 'b'), tamano: 16_380 };
const d1 = (fragmentos: object[], meta?: object) => JSON.stringify(meta ? { d1: meta, fragmentos } : { fragmentos });
const r2 = (objetos: object[]) => JSON.stringify({ objetos });

describe('conciliar (decisión 40)', () => {
  it('todo casa: 0 diferencias, con el tamaño de D1 y las filas escritas del volcado', () => {
    expect(conciliar(d1([UNO, DOS], { rows_written: 89, size_after: 1_234_567 }), r2([DOS, UNO]))).toEqual({
      lineas: ['D1: 1234567 bytes y 89 filas escritas', '2 fragmentos en D1, 2 objetos en R2, 0 diferencias'],
      diferencias: 0,
    });
  });

  it('lista lo que no casa, lo que falta en R2 y lo que sobra, por orden de clave', () => {
    const huerfano = { clave: clave(3, 'c'), tamano: 16_400 }; // un put de R2 cuyo batch de D1 falló y no se reintentó
    const ajeno = { clave: 'otra/cosa', tamano: 5 };
    const r = conciliar(d1([DOS, UNO]), r2([huerfano, ajeno, { clave: UNO.clave, tamano: 16_000 }]));
    expect(r.lineas).toEqual([
      `no casa: ${UNO.clave} (D1 16412 bytes, R2 16000 bytes)`,
      `falta en R2: ${DOS.clave}`,
      `sobra en R2: ${huerfano.clave}`,
      'sobra en R2: otra/cosa',
      '2 fragmentos en D1, 3 objetos en R2, 4 diferencias',
    ]);
    expect(r.diferencias).toBe(4);
  });

  it.each([
    ['no es JSON', '{', r2([])],
    ['clave de D1 que no construye el servidor', d1([{ clave: `i/../1/${'a'.repeat(64)}`, tamano: 1 }]), r2([])],
    ['seq con un cero delante', d1([{ clave: `i/${INC}/01/${'a'.repeat(64)}`, tamano: 1 }]), r2([])],
    ['tamaño negativo', d1([{ ...UNO, tamano: -1 }]), r2([])],
    ['tamaño con decimales', d1([{ ...UNO, tamano: 1.5 }]), r2([])],
    ['clave desconocida', JSON.stringify({ fragmentos: [], otra: 1 }), r2([])],
    ['sin fragmentos', '{}', r2([])],
    ['d1 sin rows_written', d1([], { size_after: 1 }), r2([])],
    ['clave repetida en R2', d1([]), r2([UNO, UNO])],
    ['objetos que no son una lista', d1([]), JSON.stringify({ objetos: {} })],
  ])('rechaza una entrada mal formada: %s', (_, volcado, listado) => {
    expect(() => conciliar(volcado, listado)).toThrow(ErrorFormato);
  });
});
