import { ErrorFormato } from '@vigia/shared';

// Conciliación externa D1/R2 (decisión 40, R2-01): el Worker nunca lista R2. Compara un volcado de D1 y un
// listado de R2, tomados con tokens de solo lectura (H3a), y dice qué falta, qué sobra y qué no casa.

export type Resultado = { lineas: string[]; diferencias: number };
type Objeto = { clave: string; tamano: number };

// La clave que construye el servidor (contrato, sección 11): i/<incidente>/<seq>/<c>.
const CLAVE_FRAGMENTO = /^i\/[A-Za-z0-9_-]{22}\/[1-9][0-9]{0,5}\/[0-9a-f]{64}$/;
// R2 admite claves de hasta 1024 bytes; aquí cualquier texto no vacío, porque todo lo que no está en D1 sobra.
const CLAVE_R2 = /^[\s\S]{1,1024}$/;

function leer(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErrorFormato('no es JSON');
  }
}

/** Objeto JSON con exactamente estas claves (las opcionales pueden faltar). */
function objeto(x: unknown, claves: readonly string[], opcionales: readonly string[] = []): Record<string, unknown> {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new ErrorFormato('se esperaba un objeto');
  const o = x as Record<string, unknown>;
  if (Object.keys(o).some((k) => !claves.includes(k) && !opcionales.includes(k))) throw new ErrorFormato('clave desconocida');
  if (claves.some((k) => !Object.hasOwn(o, k))) throw new ErrorFormato('falta una clave');
  return o;
}

function entero(x: unknown): number {
  if (!Number.isSafeInteger(x) || (x as number) < 0) throw new ErrorFormato('entero no válido');
  return x as number;
}

/** Lista de {clave, tamano} sin claves repetidas, ordenada por clave para que la salida no dependa del volcado. */
function objetos(x: unknown, patron: RegExp): Objeto[] {
  if (!Array.isArray(x)) throw new ErrorFormato('se esperaba una lista');
  const lista = x.map((e) => {
    const o = objeto(e, ['clave', 'tamano']);
    if (typeof o.clave !== 'string' || !patron.test(o.clave)) throw new ErrorFormato('clave no válida');
    return { clave: o.clave, tamano: entero(o.tamano) };
  });
  lista.sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));
  if (lista.some((o, i) => i > 0 && o.clave === lista[i - 1].clave)) throw new ErrorFormato('clave repetida');
  return lista;
}

/**
 * volcadoD1: {"d1":{"size_after":n,"rows_written":n},"fragmentos":[{"clave":…,"tamano":n}]} (`d1` opcional).
 * listadoR2: {"objetos":[{"clave":…,"tamano":n}]}. Lanza ErrorFormato si alguno no tiene esa forma.
 */
export function conciliar(volcadoD1: string, listadoR2: string): Resultado {
  const volcado = objeto(leer(volcadoD1), ['fragmentos'], ['d1']);
  const fragmentos = objetos(volcado.fragmentos, CLAVE_FRAGMENTO);
  const r2 = objetos(objeto(leer(listadoR2), ['objetos']).objetos, CLAVE_R2);
  const lineas: string[] = [];
  if (volcado.d1 !== undefined) {
    const d1 = objeto(volcado.d1, ['rows_written', 'size_after']);
    lineas.push(`D1: ${entero(d1.size_after)} bytes y ${entero(d1.rows_written)} filas escritas`);
  }
  const enR2 = new Map(r2.map((o) => [o.clave, o.tamano]));
  const enD1 = new Set(fragmentos.map((f) => f.clave));
  let diferencias = 0;
  for (const f of fragmentos) {
    const tamano = enR2.get(f.clave);
    if (tamano === f.tamano) continue;
    lineas.push(tamano === undefined ? `falta en R2: ${f.clave}` : `no casa: ${f.clave} (D1 ${f.tamano} bytes, R2 ${tamano} bytes)`);
    diferencias++;
  }
  for (const o of r2) {
    if (enD1.has(o.clave)) continue;
    lineas.push(`sobra en R2: ${o.clave}`);
    diferencias++;
  }
  lineas.push(`${fragmentos.length} fragmentos en D1, ${r2.length} objetos en R2, ${diferencias} diferencias`);
  return { lineas, diferencias };
}
