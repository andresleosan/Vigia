import { ErrorFormato, iguales, utf8 } from './codificacion.ts';

export type Valor = string | number;
export type Campo = { tipo: 'cadena'; patron: RegExp; opcional?: boolean }
                  | { tipo: 'entero'; min: number; max: number; opcional?: boolean };
export type Esquema = Readonly<Record<string, Campo>>;

const CLAVE = /^[a-z][a-z0-9_]{0,31}$/;
const CADENA = /^[A-Za-z0-9_.-]{0,4096}$/;

/** JSON canónico de Vigía (contrato, sección 3). Una clave con valor undefined es un opcional ausente. */
export function codificarJcv(obj: Readonly<Record<string, Valor>>): Uint8Array {
  const pares: string[] = [];
  // Las claves son ASCII: el orden de sort() (unidades UTF-16) es el de sus bytes.
  for (const clave of Object.keys(obj).sort()) {
    const v = obj[clave];
    if (v === undefined) continue;
    if (!CLAVE.test(clave)) throw new ErrorFormato('JCV: clave no válida');
    if (typeof v === 'string' && CADENA.test(v)) pares.push(`"${clave}":"${v}"`);
    else if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) pares.push(`"${clave}":${v}`);
    else throw new ErrorFormato('JCV: valor no válido');
  }
  return utf8(`{${pares.join(',')}}`);
}

export function analizarJcv(bytes: Uint8Array, esquema: Esquema): Record<string, Valor> {
  // ponytail: JSON.parse y la comprobación final en lugar de un analizador propio. Límite: lee
  // la entrada entera antes de rechazarla; los cuerpos miden como mucho 64 KiB.
  let leido: unknown;
  try {
    leido = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ErrorFormato('JCV: no es JSON');
  }
  if (typeof leido !== 'object' || leido === null || Array.isArray(leido)) {
    throw new ErrorFormato('JCV: no es un objeto');
  }
  const obj = leido as Record<string, unknown>;
  for (const clave of Object.keys(obj)) {
    if (!Object.hasOwn(esquema, clave)) throw new ErrorFormato('JCV: clave desconocida');
  }
  for (const [clave, campo] of Object.entries(esquema)) {
    if (!Object.hasOwn(obj, clave)) {
      if (campo.opcional) continue;
      throw new ErrorFormato('JCV: falta una clave');
    }
    const v = obj[clave];
    // ponytail: los patrones del esquema van anclados (^…$) y sin las banderas g ni y; aquí no se comprueba.
    const vale = campo.tipo === 'cadena'
      ? typeof v === 'string' && campo.patron.test(v)
      : typeof v === 'number' && Number.isSafeInteger(v) && v >= campo.min && v <= campo.max;
    if (!vale) throw new ErrorFormato('JCV: valor fuera del esquema');
  }
  const valores = obj as Record<string, Valor>;
  // Comprobación final obligatoria: solo la forma canónica vuelve a dar los mismos bytes. Aquí
  // caen lo que JSON.parse admite y JCV no: claves desordenadas o repetidas, espacios y saltos de
  // línea, escapes, bytes no ASCII, -0, decimales y exponentes.
  if (!iguales(codificarJcv(valores), bytes)) throw new ErrorFormato('JCV: forma no canónica');
  return valores;
}
