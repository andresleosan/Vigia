import type { Entorno } from './entorno.ts';
import { Rechazo } from './errores.ts';

// Paso 5 de la sección 9 (LIM-01): 120 peticiones por 60 s y dispositivo en cada binding.
export async function cupo(limite: RateLimit, dispositivo: string): Promise<void> {
  if (!(await limite.limit({ key: dispositivo })).success) throw new Rechazo('limite');
}

// Guarda de D1 (sección 13): con la base por encima del umbral no entra nada nuevo salvo cierres,
// para que las escrituras de estado no fallen. tamano es el size_after de la primera consulta.
export function guardaD1(env: Entorno, tamano: number): void {
  if (tamano > Number(env.UMBRAL_D1_BYTES)) throw new Rechazo('cuota');
}
