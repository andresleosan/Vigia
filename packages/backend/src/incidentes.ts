import { analizarCuerpoIncidente, analizarRegistro, deB64u, hashRegistro, huella, MAX_JSON, verificarRegistro } from '@vigia/shared';
import { acusar } from './acuses.ts';
import { cupo, guardaD1 } from './cuotas.ts';
import type { Contexto } from './entorno.ts';
import { Rechazo, respuestaJson } from './errores.ts';
import { antirreenvio, comprobarFirma, cripto, type Firmante, leerCuerpo, resumen } from './firma.ts';
import { borrarAntirreenvio } from './programado.ts';

// Punto 4: el mismo incidente del mismo dueño con el mismo hash(r) devuelve el acuse guardado, sin tocar
// envolturas ni meta; con otro dueño u otro hash, 409. null: el incidente no existe.
async function yaAbierto(c: Contexto, id: string, dueno: string, rHash: string): Promise<Response | null> {
  const fila = await c.env.DB.prepare('SELECT dispositivo, r_hash, acuse FROM incidentes WHERE id = ?')
    .bind(id).first<{ dispositivo: string; r_hash: string; acuse: number[] }>();
  if (!fila) return null;
  if (fila.dispositivo !== dueno || fila.r_hash !== rHash) throw new Rechazo('conflicto');
  return respuestaJson(new Uint8Array(fila.acuse), 200);
}

// Tras un batch que no insertó o que chocó con una PK o una UNIQUE: se responde como a una repetición.
async function releer(c: Contexto, f: Firmante, h: string, id: string, rHash: string): Promise<Response | null> {
  return (await antirreenvio(c, f, h)) ?? (await yaAbierto(c, id, f.id, rHash));
}

// POST /v1/incidents (sección 11, "Apertura").
export async function abrir(c: Contexto, ahora: number): Promise<Response> {
  const cuerpo = await leerCuerpo(c, MAX_JSON);
  const pedido = analizarCuerpoIncidente(cuerpo);
  const bytesR = deB64u(pedido.r);
  const r = analizarRegistro(bytesR);
  const s = deB64u(pedido.s);
  if (r.tipo !== 'apertura') throw new Rechazo('formato');
  const meta = pedido.meta === undefined ? null : deB64u(pedido.meta);

  const f = await comprobarFirma(c, cuerpo, ahora, 'dispositivo', true); // el revocado sigue hasta el punto 5
  if (r.dispositivo !== await huella(cripto, f.spki)) throw new Rechazo('formato');
  if (!(await verificarRegistro(cripto, f.spki, bytesR, s))) throw new Rechazo('firma');

  const h = await resumen(c, cuerpo);
  const rHash = await hashRegistro(cripto, bytesR);
  const repetida = await releer(c, f, h, r.incidente, rHash);
  if (repetida) return repetida;
  if (f.revocado) throw new Rechazo('firma');
  await cupo(c.env.LIMITE_ORDENES, f.id);
  guardaD1(c.env, f.tamanoD1);

  // Punto 7. Cada sentencia que depende de la inserción lo comprueba con el acuse, que es único
  // (la firma ECDSA es aleatoria): la fila solo lo lleva si la insertó este batch.
  const acuse = await acusar(c.env, rHash, ahora);
  const db = c.env.DB;
  const id = r.incidente;
  let insertado: boolean;
  try {
    const resultados = await db.batch([
      db.prepare('INSERT INTO incidentes (id, dispositivo, r, s, r_hash, acuse, meta, recibido) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE (SELECT incidentes_usados FROM dispositivos WHERE id = ?2) < ?9')
        .bind(id, f.id, bytesR, s, rHash, acuse, meta, ahora, Number(c.env.TOPE_INCIDENTES)),
      ...pedido.envolturas.map((e) => db.prepare('INSERT INTO envolturas (incidente, rol, destino, k) SELECT ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM incidentes WHERE id = ?1 AND acuse = ?5)')
        .bind(id, e.rol, e.destino, deB64u(e.k), acuse)),
      db.prepare('UPDATE dispositivos SET incidentes_usados = incidentes_usados + 1 WHERE id = ?1 AND EXISTS (SELECT 1 FROM incidentes WHERE id = ?2 AND acuse = ?3)')
        .bind(f.id, id, acuse),
      db.prepare("INSERT INTO contadores (dia, nombre, valor) SELECT ?1, 'acuses', 1 WHERE EXISTS (SELECT 1 FROM incidentes WHERE id = ?2 AND acuse = ?3) ON CONFLICT (dia, nombre) DO UPDATE SET valor = valor + 1")
        .bind(Math.floor(ahora / 86_400_000), id, acuse),
      db.prepare('INSERT INTO antirreenvio (dispositivo, id_peticion, h, estado, cuerpo, creado) SELECT ?1, ?2, ?3, 201, ?4, ?5 WHERE EXISTS (SELECT 1 FROM incidentes WHERE id = ?6 AND acuse = ?4)')
        .bind(f.id, f.idPeticion, h, acuse, ahora, id),
      borrarAntirreenvio(db, ahora),
    ]);
    insertado = resultados[0].meta.changes === 1;
  } catch (e) {
    const ganadora = await releer(c, f, h, id, rHash);
    if (ganadora) return ganadora;
    throw e;
  }
  if (!insertado) {
    const ganadora = await releer(c, f, h, id, rHash);
    if (ganadora) return ganadora;
    throw new Rechazo('cuota'); // TOPE_INCIDENTES
  }
  return respuestaJson(acuse, 201);
}
