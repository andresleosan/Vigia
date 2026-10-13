import { codificarJcv } from '@vigia/shared';
import { cupo } from './cuotas.ts';
import type { Contexto } from './entorno.ts';
import { Rechazo, respuestaJson } from './errores.ts';
import { comprobarFirma, idDeRuta } from './firma.ts';

// GET /v1/incidents/:id: pasos 0 a 5 con la clave de lectura; ajeno e inexistente, el mismo 404.
export async function estado(c: Contexto, ahora: number): Promise<Response> {
  const id = idDeRuta(c);
  const firmante = await comprobarFirma(c, new Uint8Array(0), ahora, 'lectura', false);
  await cupo(c.env.LIMITE_LECTURAS, firmante.id);
  const fila = await c.env.DB.prepare('SELECT EXISTS (SELECT 1 FROM cierres WHERE incidente = ?1) AS cerrado, (SELECT coalesce(max(seq), 0) FROM fragmentos WHERE incidente = ?1) AS ultimo FROM incidentes WHERE id = ?1 AND dispositivo = ?2')
    .bind(id, firmante.id).first<{ cerrado: number; ultimo: number }>();
  if (!fila) throw new Rechazo('no_existe');
  return respuestaJson(codificarJcv({ cerrado: fila.cerrado, ultimo_recibido: fila.ultimo, v: 1 }), 200);
}
