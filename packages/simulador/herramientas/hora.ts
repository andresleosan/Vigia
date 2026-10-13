// El tope de altas cuenta por hora natural UTC (contrato, sección 11): para que C reciba 429, las altas de A, B y C
// tienen que caer en la misma hora.
const HORA = 3_600_000;

/** Si faltan menos de `margen` ms para la siguiente hora UTC, imprime una línea y espera a que empiece. */
export async function esperarSiAcabaLaHora(
  margen: number,
  ahora: () => number = Date.now,
  dormir: (ms: number) => Promise<void> = (ms) => new Promise((listo) => setTimeout(listo, ms)),
): Promise<void> {
  const faltan = HORA - (ahora() % HORA);
  if (faltan >= margen) return;
  console.log(`espera ${Math.ceil(faltan / 1000)} s a que empiece la hora UTC siguiente: las altas de A, B y C tienen que caer en la misma hora`);
  await dormir(faltan);
}
