import { afterEach, describe, expect, it, vi } from 'vitest';
import { esperarSiAcabaLaHora } from '../herramientas/hora.ts';

const HORA = 3_600_000;
const EN_PUNTO = 488_889 * HORA; // el principio de una hora UTC

/** Llama a la función con el reloj parado en `ahora`, sin dormir de verdad: lo que esperó y lo que imprimió. */
async function probar(ahora: number) {
  const esperas: number[] = [];
  const lineas = vi.spyOn(console, 'log').mockImplementation(() => {});
  await esperarSiAcabaLaHora(120_000, () => ahora, async (ms) => {
    esperas.push(ms);
  });
  return { esperas, lineas: lineas.mock.calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('esperarSiAcabaLaHora (el tope de altas cuenta por hora natural UTC)', () => {
  it('con 120 s o más hasta la hora siguiente no imprime nada ni espera', async () => {
    expect(await probar(EN_PUNTO - 120_000)).toEqual({ esperas: [], lineas: [] });
  });

  it('con menos de 120 s imprime una línea y espera justo hasta que empieza la hora siguiente', async () => {
    expect(await probar(EN_PUNTO - 119_999)).toEqual({
      esperas: [119_999],
      lineas: [['espera 120 s a que empiece la hora UTC siguiente: las altas de A, B y C tienen que caer en la misma hora']],
    });
  });
});
