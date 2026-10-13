import { analizarCuerpoAlta, codificarJcv, deB64u, esSpkiP256, huella, iguales, MAX_JSON, nuevoId, verificarPeticion } from '@vigia/shared';
import type { Contexto } from './entorno.ts';
import { Rechazo, respuestaJson } from './errores.ts';
import { comprobarHora, cripto, datosFirmados, leerCabeceras, leerCuerpo } from './firma.ts';

type Registrado = { id: string; spki_lectura: number[]; revocado_en: number | null };

// Sección 2: 91 bytes con el prefijo antes de importar; importKey falla si el punto no está en la curva.
async function publicaValida(spki: Uint8Array): Promise<boolean> {
  if (!esSpkiP256(spki)) return false;
  try {
    await crypto.subtle.importKey('spki', spki as Uint8Array<ArrayBuffer>, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return true;
  } catch {
    return false;
  }
}

function buscar(c: Contexto, publica: Uint8Array) {
  return c.env.DB.prepare('SELECT id, spki_lectura, revocado_en FROM dispositivos WHERE spki = ?').bind(publica).first<Registrado>();
}

// Punto 3: la misma pública nunca se reemplaza ni gasta tope.
function yaRegistrado(r: Registrado, lectura: Uint8Array): Response {
  if (r.revocado_en !== null) throw new Rechazo('firma');
  if (!iguales(new Uint8Array(r.spki_lectura), lectura)) throw new Rechazo('conflicto');
  return respuestaJson(codificarJcv({ dispositivo: r.id }), 200);
}

// POST /v1/devices (sección 11, "Alta").
export async function alta(c: Contexto, ahora: number): Promise<Response> {
  const cuerpo = await leerCuerpo(c, MAX_JSON);
  const cab = leerCabeceras(c, true);
  const { publica: textoPublica, lectura: textoLectura } = analizarCuerpoAlta(cuerpo);
  const publica = deB64u(textoPublica);
  const lectura = deB64u(textoLectura);
  if (iguales(publica, lectura) || !(await publicaValida(publica)) || !(await publicaValida(lectura))) throw new Rechazo('formato');

  if (!(await verificarPeticion(cripto, publica, datosFirmados(c, cab, cuerpo), cab.firma))) throw new Rechazo('firma');
  comprobarHora(cab.hora, ahora);

  const previo = await buscar(c, publica);
  if (previo) return yaRegistrado(previo, lectura);

  // Punto 4: el contador de la hora se suma siempre (es el propio tope) y el dispositivo entra solo si cabe.
  const id = nuevoId(cripto);
  const hora = Math.floor(ahora / 3_600_000);
  const db = c.env.DB;
  let resultados: D1Result[];
  try {
    resultados = await db.batch([
      db.prepare('INSERT INTO altas_por_hora (hora, n) VALUES (?1, 1) ON CONFLICT (hora) DO UPDATE SET n = n + 1').bind(hora),
      db.prepare('INSERT INTO dispositivos (id, spki, spki_lectura, huella) SELECT ?1, ?2, ?3, ?4 WHERE (SELECT n FROM altas_por_hora WHERE hora = ?5) <= ?6')
        .bind(id, publica, lectura, await huella(cripto, publica), hora, Number(c.env.TOPE_ALTAS_HORA)),
      db.prepare("INSERT INTO contadores (dia, nombre, valor) SELECT ?1, 'altas', 1 WHERE EXISTS (SELECT 1 FROM dispositivos WHERE id = ?2) ON CONFLICT (dia, nombre) DO UPDATE SET valor = valor + 1")
        .bind(Math.floor(ahora / 86_400_000), id),
    ]);
  } catch (e) {
    // Otra alta con la misma pública ganó la carrera (UNIQUE): se responde como a una repetición.
    const ganadora = await buscar(c, publica);
    if (!ganadora) throw e;
    return yaRegistrado(ganadora, lectura);
  }
  if (resultados[1].meta.changes !== 1) {
    throw new Rechazo('tope_altas', { 'Retry-After': String(Math.ceil(((hora + 1) * 3_600_000 - ahora) / 1000)) });
  }
  return respuestaJson(codificarJcv({ dispositivo: id }), 201);
}
