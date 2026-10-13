import { deB64u, ErrorFormato, utf8 } from './codificacion.ts';
import { esSpkiP256 } from './cripto.ts';
import type { Rol } from './envoltura.ts';
import { esId } from './ids.ts';

export const CODIGOS = [
  'formato', 'hash', 'firma', 'hora', 'no_existe', 'conflicto',
  'demasiado_grande', 'tipo_contenido', 'limite', 'cuota', 'tope_altas', 'interno',
] as const;
export type Codigo = (typeof CODIGOS)[number];

export const ESTADO_DE: Readonly<Record<Codigo, number>> = {
  formato: 400,
  hash: 400,
  firma: 401,
  hora: 401,
  no_existe: 404,
  conflicto: 409,
  demasiado_grande: 413,
  tipo_contenido: 415,
  limite: 429,
  cuota: 429,
  tope_altas: 429,
  interno: 500,
};

export const RUTA = { dispositivos: '/v1/devices', incidentes: '/v1/incidents' } as const;

/** Tope del cuerpo de las rutas JSON (sección 13). */
export const MAX_JSON = 16_384;

const MAX_SEQ = 999_999;
const MAX_ENVOLTURAS = 5;
const MAX_META = 4096;
const ROLES: readonly string[] = ['contacto', 'recuperacion', 'escucha'];

export function rutaIncidente(id: string): string {
  if (!esId(id)) throw new ErrorFormato('id');
  return `${RUTA.incidentes}/${id}`;
}

/** `seq` de 0 (la apertura, en el GET) a 999 999; el PUT exige además 1 o más. */
export function rutaFragmento(id: string, seq: number): string {
  if (!Number.isInteger(seq) || seq < 0 || seq > MAX_SEQ) throw new ErrorFormato('seq');
  return `${rutaIncidente(id)}/chunks/${seq}`;
}

export function rutaCierre(id: string): string {
  return `${rutaIncidente(id)}/close`;
}

export type EnvolturaCuerpo = { destino: string; k: string; rol: Rol };
export type CuerpoAlta = { lectura: string; publica: string };
export type CuerpoIncidente = { envolturas: EnvolturaCuerpo[]; meta?: string; r: string; s: string };
export type CuerpoCierre = { r: string; s: string };
export type EstadoIncidente = { cerrado: 0 | 1; ultimo_recibido: number; v: 1 };

// Serialización fija de la sección 11: el orden de las claves es el de cada literal y los
// valores (b64u, ids, `-` y roles) nunca necesitan escapes. Lo que sale se analiza: el
// cliente nunca envía un cuerpo que el servidor rechazaría por su forma.
export function cuerpoAlta(c: CuerpoAlta): Uint8Array {
  return comprobado(JSON.stringify({ lectura: c.lectura, publica: c.publica }), analizarCuerpoAlta);
}

export function cuerpoIncidente(c: CuerpoIncidente): Uint8Array {
  const envolturas = c.envolturas.map((e) => ({ destino: e.destino, k: e.k, rol: e.rol }));
  const json = c.meta === undefined
    ? JSON.stringify({ envolturas, r: c.r, s: c.s })
    : JSON.stringify({ envolturas, meta: c.meta, r: c.r, s: c.s });
  return comprobado(json, analizarCuerpoIncidente);
}

export function cuerpoCierre(c: CuerpoCierre): Uint8Array {
  return comprobado(JSON.stringify({ r: c.r, s: c.s }), analizarCuerpoCierre);
}

function comprobado(json: string, analizar: (bytes: Uint8Array) => unknown): Uint8Array {
  const bytes = utf8(json);
  analizar(bytes);
  return bytes;
}

// El servidor acepta cualquier JSON válido con el esquema (sección 11) y nada más.
export function analizarCuerpoAlta(bytes: Uint8Array): CuerpoAlta {
  const o = objeto(leerJson(bytes), ['lectura', 'publica']);
  const lectura = spki(o.lectura);
  const publica = spki(o.publica);
  if (lectura === publica) throw new ErrorFormato('lectura igual a publica');
  return { lectura, publica };
}

export function analizarCuerpoIncidente(bytes: Uint8Array): CuerpoIncidente {
  const o = objeto(leerJson(bytes), ['envolturas', 'r', 's'], ['meta']);
  if (!Array.isArray(o.envolturas) || o.envolturas.length > MAX_ENVOLTURAS) {
    throw new ErrorFormato('envolturas');
  }
  const vistas = new Set<string>();
  const envolturas = o.envolturas.map((x: unknown): EnvolturaCuerpo => {
    const e = objeto(x, ['destino', 'k', 'rol']);
    if (typeof e.rol !== 'string' || !ROLES.includes(e.rol)) throw new ErrorFormato('rol');
    const rol = e.rol as Rol;
    const destinoValido = rol === 'contacto'
      ? typeof e.destino === 'string' && esId(e.destino)
      : e.destino === '-';
    if (!destinoValido) throw new ErrorFormato('destino');
    const destino = e.destino as string;
    if (vistas.has(`${rol} ${destino}`)) throw new ErrorFormato('envoltura repetida');
    vistas.add(`${rol} ${destino}`);
    return { destino, k: b64uDe(e.k, 80, 80), rol };
  });
  const c: CuerpoIncidente = { envolturas, r: b64uDe(o.r, 1, MAX_JSON), s: b64uDe(o.s, 64, 64) };
  if (o.meta !== undefined) c.meta = b64uDe(o.meta, 1, MAX_META);
  return c;
}

export function analizarCuerpoCierre(bytes: Uint8Array): CuerpoCierre {
  const o = objeto(leerJson(bytes), ['r', 's']);
  return { r: b64uDe(o.r, 1, MAX_JSON), s: b64uDe(o.s, 64, 64) };
}

function leerJson(bytes: Uint8Array): unknown {
  try {
    // fatal: un UTF-8 inválido lanza; ignoreBOM: el BOM se queda en el texto y JSON.parse lo rechaza.
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  } catch {
    throw new ErrorFormato('json');
  }
}

function objeto(x: unknown, claves: readonly string[], opcionales: readonly string[] = []): Record<string, unknown> {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new ErrorFormato('objeto');
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!claves.includes(k) && !opcionales.includes(k)) throw new ErrorFormato('clave desconocida');
  }
  for (const k of claves) if (!Object.hasOwn(o, k)) throw new ErrorFormato('falta una clave');
  return o;
}

/** Cadena b64u canónica cuyos bytes miden de `min` a `max`. */
function b64uDe(x: unknown, min: number, max: number): string {
  if (typeof x !== 'string') throw new ErrorFormato('tipo');
  const n = deB64u(x).length;
  if (n < min || n > max) throw new ErrorFormato('longitud');
  return x;
}

function spki(x: unknown): string {
  if (typeof x !== 'string' || !esSpkiP256(deB64u(x))) throw new ErrorFormato('spki');
  return x;
}
