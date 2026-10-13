import { Rechazo } from './errores.ts';

// Paso 5 de la sección 9 (LIM-01): 120 peticiones por 60 s y dispositivo en cada binding.
export async function cupo(limite: RateLimit, dispositivo: string): Promise<void> {
  if (!(await limite.limit({ key: dispositivo })).success) throw new Rechazo('limite');
}
