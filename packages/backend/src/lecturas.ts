import { b64u, CABECERA, codificarJcv, empaquetarSobre } from '@vigia/shared';
import { cupo } from './cuotas.ts';
import type { Contexto } from './entorno.ts';
import { Rechazo, respuestaJson, TIPO_SOBRE } from './errores.ts';
import { comprobarFirma, idDeRuta, seqDeRuta } from './firma.ts';

type Guardado = { r: number[]; s: number[]; acuse: number[] };

function respuestaSobre(g: Guardado, cifrado: Uint8Array): Response {
  const cuerpo = empaquetarSobre({ r: new Uint8Array(g.r), s: new Uint8Array(g.s), cifrado });
  return new Response(cuerpo, { headers: { 'Content-Type': TIPO_SOBRE, [CABECERA.acuse]: b64u(new Uint8Array(g.acuse)) } });
}

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

// GET /v1/incidents/:id/chunks/:seq: el registro como sobre (seq 0 es la apertura) y su acuse.
export async function leerRegistro(c: Contexto, ahora: number): Promise<Response> {
  const id = idDeRuta(c);
  const seq = seqDeRuta(c, 0);
  const firmante = await comprobarFirma(c, new Uint8Array(0), ahora, 'lectura', false);
  await cupo(c.env.LIMITE_LECTURAS, firmante.id);
  const fila = await c.env.DB.prepare('SELECT r, s, acuse, NULL AS c FROM incidentes WHERE id = ?1 AND dispositivo = ?2 AND ?3 = 0 UNION ALL SELECT f.r, f.s, f.acuse, f.c FROM fragmentos f JOIN incidentes i ON i.id = f.incidente WHERE f.incidente = ?1 AND i.dispositivo = ?2 AND f.seq = ?3')
    .bind(id, firmante.id, seq).first<Guardado & { c: string | null }>();
  if (!fila) throw new Rechazo('no_existe');
  if (fila.c === null) return respuestaSobre(fila, new Uint8Array(0));
  const objeto = await c.env.EVIDENCIA.get(`i/${id}/${seq}/${fila.c}`);
  if (!objeto) throw new Error('r2'); // fila sin objeto: 500; la conciliación externa lo detecta
  return respuestaSobre(fila, new Uint8Array(await objeto.arrayBuffer()));
}

// GET /v1/incidents/:id/close: el cierre como sobre y su acuse; 404 si no hay cierre.
export async function leerCierre(c: Contexto, ahora: number): Promise<Response> {
  const id = idDeRuta(c);
  const firmante = await comprobarFirma(c, new Uint8Array(0), ahora, 'lectura', false);
  await cupo(c.env.LIMITE_LECTURAS, firmante.id);
  const fila = await c.env.DB.prepare('SELECT c.r, c.s, c.acuse FROM cierres c JOIN incidentes i ON i.id = c.incidente WHERE c.incidente = ?1 AND i.dispositivo = ?2').bind(id, firmante.id).first<Guardado>();
  if (!fila) throw new Rechazo('no_existe');
  return respuestaSobre(fila, new Uint8Array(0));
}
