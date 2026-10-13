import type { Entorno } from './entorno.ts';

// Borra las filas anti-reenvío con ahora − creado > 600 000 ms (sección 9, PRIV-01).
export function borrarAntirreenvio(db: D1Database, ahora: number): D1PreparedStatement {
  return db.prepare('DELETE FROM antirreenvio WHERE creado < ?').bind(ahora - 600_000);
}

export async function programado(env: Entorno, ahora: number): Promise<void> {
  await borrarAntirreenvio(env.DB, ahora).run();
}
