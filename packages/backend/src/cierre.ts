import { analizarCuerpoCierre, analizarRegistro, deB64u, hashRegistro, MAX_JSON, verificarRegistro } from '@vigia/shared';
import { acusar } from './acuses.ts';
import { cupo } from './cuotas.ts';
import type { Contexto } from './entorno.ts';
import { Rechazo, respuestaJson } from './errores.ts';
import { antirreenvio, comprobarFirma, cripto, idDeRuta, leerCuerpo, resumen } from './firma.ts';
import { borrarAntirreenvio } from './programado.ts';

// Punto 5: el mismo cierre devuelve su acuse; otro, 409. null: no hay cierre.
async function cierreGuardado(c: Contexto, id: string, rHash: string): Promise<Response | null> {
  const fila = await c.env.DB.prepare('SELECT r_hash, acuse FROM cierres WHERE incidente = ?').bind(id).first<{ r_hash: string; acuse: number[] }>();
  if (!fila) return null;
  if (fila.r_hash !== rHash) throw new Rechazo('conflicto');
  return respuestaJson(new Uint8Array(fila.acuse), 200);
}

// POST /v1/incidents/:id/close (sección 11, "Cierre"). Nunca lo bloquean las cuotas.
export async function cerrar(c: Contexto, ahora: number): Promise<Response> {
  const cuerpo = await leerCuerpo(c, MAX_JSON);
  const id = idDeRuta(c);
  const pedido = analizarCuerpoCierre(cuerpo);
  const bytesR = deB64u(pedido.r);
  const r = analizarRegistro(bytesR);
  const s = deB64u(pedido.s);
  if (r.tipo !== 'cierre' || r.incidente !== id) throw new Rechazo('formato');

  const f = await comprobarFirma(c, cuerpo, ahora, 'dispositivo', true); // el revocado cierra lo suyo
  const h = await resumen(c, cuerpo);
  const guardada = await antirreenvio(c, f, h);
  if (guardada) return guardada;
  await cupo(c.env.LIMITE_ORDENES, f.id);

  if (!(await c.env.DB.prepare('SELECT 1 FROM incidentes WHERE id = ? AND dispositivo = ?').bind(id, f.id).first())) throw new Rechazo('no_existe');
  if (!(await verificarRegistro(cripto, f.spki, bytesR, s))) throw new Rechazo('firma');
  const rHash = await hashRegistro(cripto, bytesR);
  const previo = await cierreGuardado(c, id, rHash);
  if (previo) return previo;

  // Puntos 6 y 7: el cierre entra solo si no contradice lo guardado; lo decide el batch.
  const acuse = await acusar(c.env, rHash, ahora);
  const db = c.env.DB;
  let insertado: boolean;
  try {
    const resultados = await db.batch([
      db.prepare('INSERT INTO cierres (incidente, ultimo_seq, hash_final, r, s, r_hash, acuse, recibido, tras_revocacion) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE NOT EXISTS (SELECT 1 FROM fragmentos WHERE incidente = ?1 AND seq > ?2) AND coalesce((SELECT r_hash FROM incidentes WHERE id = ?1 AND ?2 = 0), ?3) = ?3 AND coalesce((SELECT r_hash FROM fragmentos WHERE incidente = ?1 AND seq = ?2), ?3) = ?3')
        .bind(id, r.ultimo_seq, r.hash_final, bytesR, s, rHash, acuse, ahora, f.revocado ? 1 : 0),
      db.prepare("INSERT INTO contadores (dia, nombre, valor) SELECT ?1, 'acuses', 1 WHERE EXISTS (SELECT 1 FROM cierres WHERE incidente = ?2 AND acuse = ?3) ON CONFLICT (dia, nombre) DO UPDATE SET valor = valor + 1")
        .bind(Math.floor(ahora / 86_400_000), id, acuse),
      db.prepare('INSERT INTO antirreenvio (dispositivo, id_peticion, h, estado, cuerpo, creado) SELECT ?1, ?2, ?3, 201, ?4, ?5 WHERE EXISTS (SELECT 1 FROM cierres WHERE incidente = ?6 AND acuse = ?4)')
        .bind(f.id, f.idPeticion, h, acuse, ahora, id),
      borrarAntirreenvio(db, ahora),
    ]);
    insertado = resultados[0].meta.changes === 1;
  } catch (error) {
    const ganadora = (await antirreenvio(c, f, h)) ?? (await cierreGuardado(c, id, rHash));
    if (ganadora) return ganadora;
    throw error;
  }
  if (!insertado) {
    const ganadora = await cierreGuardado(c, id, rHash);
    if (ganadora) return ganadora;
    throw new Rechazo('conflicto'); // contradice lo guardado (punto 6)
  }
  return respuestaJson(acuse, 201);
}
