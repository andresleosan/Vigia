import { analizarRegistro, CABECERA, deHex, desempaquetarSobre, hashRegistro, hex, MAX_SOBRE, verificarRegistro } from '@vigia/shared';
import { acusar } from './acuses.ts';
import { cupo, guardaD1 } from './cuotas.ts';
import type { Contexto } from './entorno.ts';
import { Rechazo, respuestaJson } from './errores.ts';
import { comprobarFirma, cripto, idDeRuta, leerCuerpo, seqDeRuta } from './firma.ts';

// El generador G de P-256 (privada 1): pública ficticia para verificar `s` aunque el incidente no exista,
// para que el tiempo no lo delate (sección 11, ingesta, punto 2).
const FICTICIA = deHex('3059301306072a8648ce3d020106082a8648ce3d03010703420004'
  + '6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'
  + '4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5');

const FIRMA_DE_PETICION = [CABECERA.dispositivo, CABECERA.hora, CABECERA.peticion, CABECERA.firma];

type Estado = { dueno: string; spki: number[]; revocado_en: number | null; bytes_usados: number; r_hash: string | null; acuse: number[] | null; ultimo_seq: number | null };

// Lo que la ingesta necesita del incidente, en una consulta a la primaria.
function leerEstado(c: Contexto, id: string, seq: number) {
  return c.env.DB.prepare('SELECT i.dispositivo AS dueno, d.spki, d.revocado_en, d.bytes_usados, (SELECT r_hash FROM fragmentos WHERE incidente = ?1 AND seq = ?2) AS r_hash, (SELECT acuse FROM fragmentos WHERE incidente = ?1 AND seq = ?2) AS acuse, (SELECT ultimo_seq FROM cierres WHERE incidente = ?1) AS ultimo_seq FROM incidentes i JOIN dispositivos d ON d.id = i.dispositivo WHERE i.id = ?1')
    .bind(id, seq).run<Estado>();
}

// Punto 3: el mismo registro devuelve su acuse guardado; otro en el mismo seq, 409.
function repetido(e: Estado, rHash: string): Response {
  if (e.r_hash !== rHash) throw new Rechazo('conflicto');
  return respuestaJson(new Uint8Array(e.acuse ?? []), 200);
}

// Punto 8: escritura única. Si la clave ya existe (o el put falla), solo vale el mismo contenido:
// un intento anterior que escribió en R2 y no llegó a D1. Devuelve true si el objeto ya estaba.
async function guardarEnR2(r2: R2Bucket, clave: string, cifrado: Uint8Array, c: string): Promise<boolean> {
  try {
    if (await r2.put(clave, cifrado, { sha256: c, onlyIf: { etagDoesNotMatch: '*' } })) return false;
  } catch {
    // lo decide el head
  }
  const previo = await r2.head(clave);
  const suma = previo?.checksums.sha256;
  if (previo?.size !== cifrado.length || suma === undefined || hex(new Uint8Array(suma)) !== c) throw new Error('r2');
  return true;
}

// PUT /v1/incidents/:id/chunks/:seq (sección 11, "Ingesta del PUT"; decisión 40).
export async function ingerir(c: Contexto, ahora: number): Promise<Response> {
  const cuerpo = await leerCuerpo(c, MAX_SOBRE);
  const id = idDeRuta(c);
  const seq = seqDeRuta(c, 1);
  const sobre = desempaquetarSobre(cuerpo);
  const r = analizarRegistro(sobre.r);
  if ((r.tipo !== 'fragmento' && r.tipo !== 'hueco') || r.incidente !== id || r.seq !== seq) throw new Rechazo('formato');
  if ((r.tipo === 'fragmento') !== (sobre.cifrado.length > 0)) throw new Rechazo('formato');

  // Punto 2. La firma de petición es opcional hasta que H0b decida (P5).
  const firmada = FIRMA_DE_PETICION.some((nombre) => c.req.header(nombre) !== undefined);
  const firmante = firmada ? await comprobarFirma(c, cuerpo, ahora, 'dispositivo', true) : null;
  const { results: [e], meta } = await leerEstado(c, id, seq);
  const propio = e !== undefined && (firmante === null || firmante.id === e.dueno);
  const valida = await verificarRegistro(cripto, propio ? new Uint8Array(e.spki) : FICTICIA, sobre.r, sobre.s);
  if (!propio) throw new Rechazo('no_existe');
  if (!valida) throw new Rechazo(firmante ? 'firma' : 'no_existe');

  const rHash = await hashRegistro(cripto, sobre.r);
  if (e.r_hash !== null) return repetido(e, rHash);
  if (e.ultimo_seq !== null && seq > e.ultimo_seq) throw new Rechazo('conflicto');
  if (r.tipo === 'fragmento' && hex(await cripto.sha256(sobre.cifrado)) !== r.c) throw new Rechazo('hash');

  // Punto 6, solo con un registro nuevo. CUOTA_BYTES se mira ya aquí para no dejar en R2 objetos
  // que el batch rechazaría; la condición del batch decide en las carreras.
  const coste = Math.max(16_384, sobre.cifrado.length);
  await cupo(c.env.LIMITE_SUBIDA, e.dueno);
  guardaD1(c.env, firmante?.tamanoD1 ?? meta.size_after);
  if (e.bytes_usados + coste > Number(c.env.CUOTA_BYTES)) throw new Rechazo('cuota');

  const acuse = await acusar(c.env, rHash, ahora);
  const reutilizado = r.tipo === 'fragmento' && await guardarEnR2(c.env.EVIDENCIA, `i/${id}/${seq}/${r.c}`, sobre.cifrado, r.c);

  // Punto 9. Lo que depende de la inserción lo comprueba con el acuse, que solo lleva la fila de este batch.
  const db = c.env.DB;
  const dia = Math.floor(ahora / 86_400_000);
  const contar = (nombre: string) => db.prepare('INSERT INTO contadores (dia, nombre, valor) SELECT ?1, ?2, 1 WHERE EXISTS (SELECT 1 FROM fragmentos WHERE incidente = ?3 AND seq = ?4 AND acuse = ?5) ON CONFLICT (dia, nombre) DO UPDATE SET valor = valor + 1')
    .bind(dia, nombre, id, seq, acuse);
  const sentencias = [
    // Marca propia: el enlace con n − 1 (la apertura si n es 1) o con el cierre ya guardado no casa.
    db.prepare('INSERT INTO fragmentos (incidente, seq, tipo, r, s, r_hash, prev, c, tamano, acuse, recibido, bifurcacion, tras_revocacion) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, coalesce((SELECT r_hash FROM incidentes WHERE id = ?1 AND ?2 = 1) <> ?7, 0) OR coalesce((SELECT r_hash FROM fragmentos WHERE incidente = ?1 AND seq = ?2 - 1) <> ?7, 0) OR coalesce((SELECT hash_final FROM cierres WHERE incidente = ?1 AND ultimo_seq = ?2) <> ?6, 0), ?12 WHERE (SELECT bytes_usados FROM dispositivos WHERE id = ?13) + ?14 <= ?15 AND NOT EXISTS (SELECT 1 FROM cierres WHERE incidente = ?1 AND ultimo_seq < ?2)')
      .bind(id, seq, r.tipo, sobre.r, sobre.s, rHash, r.prev, r.tipo === 'fragmento' ? r.c : null, sobre.cifrado.length, acuse, ahora, e.revocado_en === null ? 0 : 1, e.dueno, coste, Number(c.env.CUOTA_BYTES)),
    db.prepare('UPDATE dispositivos SET bytes_usados = bytes_usados + ?1 WHERE id = ?2 AND EXISTS (SELECT 1 FROM fragmentos WHERE incidente = ?3 AND seq = ?4 AND acuse = ?5)')
      .bind(coste, e.dueno, id, seq, acuse),
    // Bifurcaciones que marca este batch: la propia y la del siguiente, antes de marcarlo.
    db.prepare("INSERT INTO contadores (dia, nombre, valor) SELECT ?1, 'bifurcaciones', n FROM (SELECT (SELECT bifurcacion FROM fragmentos WHERE incidente = ?2 AND seq = ?3 AND acuse = ?4) + EXISTS (SELECT 1 FROM fragmentos WHERE incidente = ?2 AND seq = ?3 + 1 AND bifurcacion = 0 AND prev <> ?5) AS n) WHERE n > 0 ON CONFLICT (dia, nombre) DO UPDATE SET valor = valor + excluded.valor")
      .bind(dia, id, seq, acuse, rHash),
    // Marca del vecino: n + 1 ya estaba y no encadena con este.
    db.prepare('UPDATE fragmentos SET bifurcacion = 1 WHERE incidente = ?1 AND seq = ?2 + 1 AND prev <> ?3 AND EXISTS (SELECT 1 FROM fragmentos WHERE incidente = ?1 AND seq = ?2 AND acuse = ?4)')
      .bind(id, seq, rHash, acuse),
    contar('acuses'),
    ...(reutilizado ? [contar('r2_reutilizado')] : []),
  ];

  let insertado: boolean;
  let ganador: Estado | undefined;
  try {
    insertado = (await db.batch(sentencias))[0].meta.changes === 1;
  } catch (error) {
    // Choque con la PK o con UNIQUE(r_hash): otro PUT ganó (punto 3). Si no, 500 y D1 sin cambios.
    ({ results: [ganador] } = await leerEstado(c, id, seq));
    if (!ganador?.r_hash) throw error;
    insertado = false;
  }
  if (insertado) return respuestaJson(acuse, 201);
  const releido = ganador ?? (await leerEstado(c, id, seq)).results[0];
  // Carrera perdida: el objeto que este PUT escribió en R2 no lo cobra ninguna fila, así que se cobra
  // aquí (OPS-02). ponytail: la lectura previa es anterior a la carrera; una ráfaga en vuelo al llegar
  // al tope puede pasarse una vez; reservar antes del put si eso llega a importar.
  if (r.tipo === 'fragmento' && !reutilizado && releido.r_hash !== rHash) {
    await db.prepare('UPDATE dispositivos SET bytes_usados = bytes_usados + ?1 WHERE id = ?2').bind(coste, e.dueno).run();
  }
  if (releido.r_hash !== null) return repetido(releido, rHash);
  if (releido.ultimo_seq !== null && releido.ultimo_seq < seq) throw new Rechazo('conflicto');
  throw new Rechazo('cuota');
}
