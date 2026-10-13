import { b64u, deB64u, ErrorFormato, unir } from './codificacion.ts';
import { esSpkiP256, type Cripto } from './cripto.ts';
import { analizarJcv, codificarJcv, type Esquema, type Valor } from './jcv.ts';
import { PREFIJO } from './prefijos.ts';

export type Acuse = { v: 1; kid: string; r: string; hora_servidor: number; firma: string };
export type EntradaClave = {
  kid: string;
  spki: Uint8Array;
  estado: 'activa' | 'retirada' | 'comprometida';
  desde: number;
  hasta?: number;
};
export type ClavesAcuse = readonly EntradaClave[];
export type ResultadoAcuse = 'valido' | 'desconocido' | 'comprometido' | 'invalido';

/** Vacía en H1: la primera clave de producción entra con el despliegue (H3a), como una rotación. */
export const CLAVES_ACUSE_PRODUCCION: ClavesAcuse = [];

const HORA = { tipo: 'entero', min: 0, max: Number.MAX_SAFE_INTEGER } as const;
const KID = { tipo: 'cadena', patron: /^[a-z][a-z0-9_]{0,31}$/ } as const;
const V1 = { tipo: 'entero', min: 1, max: 1 } as const;

/** Claves comunes a los hechos que firma el servidor: el acuse (sección 7) y el evento (sección 8). */
export const CAMPOS_HECHO: Esquema = {
  firma: { tipo: 'cadena', patron: /^[A-Za-z0-9_-]{86}$/ },
  hora_servidor: HORA,
  kid: KID,
  v: V1,
};

const ACUSE: Esquema = { ...CAMPOS_HECHO, r: { tipo: 'cadena', patron: /^[0-9a-f]{64}$/ } };

const ENTRADA: Esquema = {
  desde: HORA,
  estado: { tipo: 'cadena', patron: /^(?:activa|retirada|comprometida)$/ },
  hasta: { ...HORA, opcional: true },
  kid: KID,
  spki: { tipo: 'cadena', patron: /^[A-Za-z0-9_-]{122}$/ },
  v: V1,
};

/** Firma P1363 sobre prefijo ‖ JCV(contenido) y devuelve el JCV con la quinta clave `firma`. */
export async function firmarHecho(
  cripto: Cripto,
  privada: CryptoKey,
  prefijo: Uint8Array,
  contenido: Readonly<Record<string, Valor>>,
  esquema: Esquema,
): Promise<Uint8Array> {
  const firma = b64u(await cripto.firmarP256(privada, unir(prefijo, codificarJcv(contenido))));
  const bytes = codificarJcv({ ...contenido, firma });
  analizarJcv(bytes, esquema); // nunca sale un hecho que el otro lado no pueda analizar
  return bytes;
}

/**
 * Comprobación común con la lista fijada (sección 7): `kid` conocido, firma sobre `mensaje`
 * (prefijo ‖ JCV sin `firma`), estado y ventana `desde ≤ hora_servidor ≤ hasta`.
 */
export async function verificarHecho(
  cripto: Cripto,
  claves: ClavesAcuse,
  mensaje: Uint8Array,
  hecho: { kid: string; hora_servidor: number; firma: string },
): Promise<ResultadoAcuse> {
  const entrada = claves.find((e) => e.kid === hecho.kid);
  if (entrada === undefined) return 'desconocido';
  if (!(await cripto.verificarP256(entrada.spki, mensaje, deB64u(hecho.firma)))) return 'invalido';
  if (entrada.estado === 'comprometida') return 'comprometido';
  const hora = hecho.hora_servidor;
  if (hora < entrada.desde || (entrada.hasta !== undefined && hora > entrada.hasta)) return 'invalido';
  return 'valido';
}

export function firmarAcuse(cripto: Cripto, privada: CryptoKey, kid: string, rHash: string, hora: number): Promise<Uint8Array> {
  return firmarHecho(cripto, privada, PREFIJO.acuse, { hora_servidor: hora, kid, r: rHash, v: 1 }, ACUSE);
}

export function analizarAcuse(bytes: Uint8Array): Acuse {
  const o = analizarJcv(bytes, ACUSE);
  deB64u(o.firma as string); // forma canónica (sección 1)
  return { v: 1, kid: o.kid as string, r: o.r as string, hora_servidor: o.hora_servidor as number, firma: o.firma as string };
}

/** `r` de otro registro: inválido antes de mirar la clave. Después, el orden de verificarHecho. */
export async function verificarAcuse(cripto: Cripto, claves: ClavesAcuse, acuse: Acuse, rEsperado: string): Promise<ResultadoAcuse> {
  if (acuse.r !== rEsperado) return 'invalido';
  const contenido = codificarJcv({ hora_servidor: acuse.hora_servidor, kid: acuse.kid, r: acuse.r, v: acuse.v });
  return verificarHecho(cripto, claves, unir(PREFIJO.acuse, contenido), acuse);
}

export function bytesEntradaClave(e: EntradaClave): Uint8Array {
  const o: Record<string, Valor> = { desde: e.desde, estado: e.estado, kid: e.kid, spki: b64u(e.spki), v: 1 };
  if (e.hasta !== undefined) o.hasta = e.hasta;
  const bytes = codificarJcv(o);
  analizarEntrada(bytes);
  return bytes;
}

/** Archivo de la lista fijada: cada entrada es JCV ‖ 0x0A; un `kid` nunca se repite. */
export function analizarListaClaves(texto: Uint8Array): ClavesAcuse {
  if (texto.length > 0 && texto[texto.length - 1] !== 0x0a) throw new ErrorFormato('lista sin salto final');
  const lista: EntradaClave[] = [];
  let inicio = 0;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== 0x0a) continue;
    const e = analizarEntrada(texto.subarray(inicio, i));
    if (lista.some((x) => x.kid === e.kid)) throw new ErrorFormato('kid repetido');
    lista.push(e);
    inicio = i + 1;
  }
  return lista;
}

function analizarEntrada(bytes: Uint8Array): EntradaClave {
  const o = analizarJcv(bytes, ENTRADA);
  const spki = deB64u(o.spki as string);
  if (!esSpkiP256(spki)) throw new ErrorFormato('spki');
  const e: EntradaClave = {
    kid: o.kid as string,
    spki,
    estado: o.estado as EntradaClave['estado'],
    desde: o.desde as number,
  };
  if (o.hasta !== undefined) {
    if ((o.hasta as number) < e.desde) throw new ErrorFormato('hasta antes de desde');
    e.hasta = o.hasta as number;
  }
  return e;
}
