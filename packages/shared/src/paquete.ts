import { b64u, ErrorFormato, iguales, unir, utf8 } from './codificacion.ts';
import { esSpkiP256 } from './cripto.ts';
import type { Rol } from './envoltura.ts';
import { analizarEvento } from './evento.ts';
import { PATRON_ID } from './ids.ts';
import { analizarJcv, codificarJcv, type Esquema } from './jcv.ts';

/** Texto fijo de LEEME.txt (sección 14). Cambiarlo cambia SHA256_LEEME y docs/verificacion.md. */
export const LEEME = `Paquete de evidencia de Vigía

Este archivo contiene la evidencia de un incidente grabado con Vigía:
los registros firmados por el teléfono (registros/), el audio cifrado
(cifrados/) y los acuses de recibo firmados por el servidor (acuses/).

Para comprobar que nadie lo ha alterado:

1. Consigue el verificador en el repositorio público de Vigía. Nunca
   uses un verificador que venga dentro de un paquete ni uno que te
   envíe la misma persona que te envió el paquete.
2. Sigue docs/verificacion.md de ese repositorio: explica cada
   comprobación para que cualquiera pueda repetirla con otras
   herramientas.
3. Usa las claves del servidor publicadas en ese repositorio. El
   paquete no trae claves, y una clave que venga con él no vale.
4. Compara la huella del teléfono que muestra el verificador con la
   del enlace que recibiste.

Este texto es siempre el mismo. Si no coincide con el que publica
docs/verificacion.md, no sigas sus instrucciones.
`;

export const SHA256_LEEME = '86bed4d46a3eaf0646e4f07de08e1bb8287543871b604449ec0322e0c96c9dcd';

/** Nombres admitidos (sección 14): ni rutas absolutas, ni `..`, ni archivos fuera de la tabla. */
export const RUTA_PAQUETE =
  /^(?:LEEME\.txt|incidente\.json|registros\/(?:[0-9]{6}|cierre)\.[rs]|cifrados\/[0-9]{6}\.bin|acuses\/(?:[0-9]{6}|cierre)\.json|eventos\.txt|envolturas\/(?:contacto|recuperacion|escucha)-[1-9][0-9]*\.json)$/;

export const ESQUEMA_INCIDENTE: Esquema = {
  incidente: { tipo: 'cadena', patron: PATRON_ID },
  spki: { tipo: 'cadena', patron: /^[A-Za-z0-9_-]{122}$/ },
  v: { tipo: 'entero', min: 1, max: 1 },
};

/** `envolturas/<rol>-<n>.json`: la envoltura de 80 bytes en b64u, sin destino. */
export const ESQUEMA_ENVOLTURA: Esquema = {
  k: { tipo: 'cadena', patron: /^[A-Za-z0-9_-]{107}$/ },
  rol: { tipo: 'cadena', patron: /^(?:contacto|recuperacion|escucha)$/ },
};

export type DatosPaquete = {
  incidente: string;
  spki: Uint8Array;
  registros: ReadonlyArray<{ seq: number | 'cierre'; r: Uint8Array; s: Uint8Array; cifrado?: Uint8Array; acuse: Uint8Array }>;
  eventos?: ReadonlyArray<Uint8Array>;
  envolturas?: ReadonlyArray<{ rol: Rol; k: Uint8Array }>;
};

// Orden de la sección 14: el de los grupos de la tabla y, dentro de cada grupo, por los bytes del nombre (ASCII).
const GRUPOS = ['LEEME.txt', 'incidente.json', 'registros/', 'cifrados/', 'acuses/', 'eventos.txt', 'envolturas/'];
const grupo = (nombre: string) => GRUPOS.findIndex((g) => nombre === g || (g.endsWith('/') && nombre.startsWith(g)));
const comparar = (a: string, b: string) => grupo(a) - grupo(b) || (a < b ? -1 : a > b ? 1 : 0);

function comprobarNombres(nombres: readonly string[]): void {
  for (let i = 0; i < nombres.length; i++) {
    if (!RUTA_PAQUETE.test(nombres[i])) throw new ErrorFormato('paquete: nombre no admitido');
    // Estrictamente creciente: así también se rechaza un nombre repetido.
    if (i > 0 && comparar(nombres[i - 1], nombres[i]) >= 0) throw new ErrorFormato('paquete: orden');
  }
}

const TABLA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

/** CRC-32 de ZIP (el de ISO-HDLC, polinomio reflejado 0xEDB88320). */
function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Enteros little-endian de 2 o 4 bytes. Sin ZIP64: lo que no cabe es un error. */
function le(...campos: [2 | 4, number][]): Uint8Array {
  const b = new Uint8Array(campos.reduce((n, [t]) => n + t, 0));
  const v = new DataView(b.buffer);
  let i = 0;
  for (const [t, x] of campos) {
    if (x > (t === 2 ? 0xffff : 0xffffffff)) throw new ErrorFormato('zip: no cabe sin ZIP64');
    if (t === 2) v.setUint16(i, x, true);
    else v.setUint32(i, x, true);
    i += t;
  }
  return b;
}

// Campos fijos (sección 14): versión 10, flags 0 (sin descriptor de datos), método 0 (sin compresión), hora 0 y
// fecha 0x0021 (1980-01-01 00:00).
const FIJOS: [2 | 4, number][] = [[2, 10], [2, 0], [2, 0], [2, 0], [2, 0x0021]];

/** Las piezas del ZIP, en orden: cabecera local y datos de cada archivo, directorio central y EOCD. */
function piezasZip(archivos: ReadonlyArray<readonly [string, Uint8Array]>): Uint8Array[] {
  const piezas: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;
  for (const [nombre, datos] of archivos) {
    const n = utf8(nombre);
    if (n.some((b) => b > 0x7f)) throw new ErrorFormato('zip: nombre no ASCII');
    // CRC, tamaño comprimido y sin comprimir (iguales: método 0), largo del nombre y del campo extra (0).
    const comunes: [2 | 4, number][] = [...FIJOS, [4, crc32(datos)], [4, datos.length], [4, datos.length], [2, n.length], [2, 0]];
    const local = unir(le([4, 0x04034b50], ...comunes), n);
    // La central añade delante la versión con la que se hizo (10) y detrás el comentario, el disco y los
    // atributos internos y externos (todo 0) y dónde empieza la cabecera local.
    centrales.push(unir(le([4, 0x02014b50], [2, 10], ...comunes, [2, 0], [2, 0], [2, 0], [4, 0], [4, desplazamiento]), n));
    piezas.push(local, datos);
    desplazamiento += local.length + datos.length;
  }
  const tamanoCentral = centrales.reduce((t, c) => t + c.length, 0);
  const fin = le([4, 0x06054b50], [2, 0], [2, 0], [2, archivos.length], [2, archivos.length], [4, tamanoCentral], [4, desplazamiento], [2, 0]);
  return piezas.concat(centrales, [fin]);
}

/** ZIP con los campos fijos de la sección 14, con los archivos en el orden dado. */
export function crearZip(archivos: ReadonlyArray<readonly [string, Uint8Array]>): Uint8Array {
  const piezas = piezasZip(archivos);
  const zip = new Uint8Array(piezas.reduce((t, p) => t + p.length, 0));
  let i = 0;
  for (const p of piezas) {
    zip.set(p, i);
    i += p.length;
  }
  return zip;
}

/** Lectura estricta (sección 14): cualquier otra forma lanza ErrorFormato. */
export function leerZip(zip: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const archivos: [string, Uint8Array][] = [];
  let i = 0;
  // Las cabeceras locales, una detrás de otra desde el byte 0, dan los nombres y los datos.
  while (i + 30 <= zip.length && v.getUint32(i, true) === 0x04034b50) {
    const largoNombre = v.getUint16(i + 26, true);
    const datos = i + 30 + largoNombre + v.getUint16(i + 28, true);
    const fin = datos + v.getUint32(i + 18, true);
    if (fin > zip.length) throw new ErrorFormato('zip: entrada cortada');
    archivos.push([new TextDecoder().decode(zip.subarray(i + 30, i + 30 + largoNombre)), zip.subarray(datos, fin)]);
    i = fin;
  }
  comprobarNombres(archivos.map(([n]) => n));
  // ponytail: en vez de comprobar campo a campo, se rehace el ZIP con crearZip y se comparan los bytes, así que
  // solo hay una forma válida (campos fijos, CRC, central igual a la local, nada entre entradas, un único EOCD
  // al final y sin comentario). Límite: el error no dice qué campo falla.
  let j = 0;
  for (const pieza of piezasZip(archivos)) {
    if (!iguales(pieza, zip.subarray(j, j + pieza.length))) throw new ErrorFormato('zip: no es la forma fija');
    j += pieza.length;
  }
  if (j !== zip.length) throw new ErrorFormato('zip: bytes de más al final');
  return new Map(archivos);
}

/** Arma el paquete de la sección 14 con lo leído del servidor. */
export function crearPaquete(d: DatosPaquete): Uint8Array {
  const incidente = codificarJcv({ incidente: d.incidente, spki: b64u(d.spki), v: 1 });
  analizarJcv(incidente, ESQUEMA_INCIDENTE);
  if (!esSpkiP256(d.spki)) throw new ErrorFormato('paquete: spki');
  const archivos: [string, Uint8Array][] = [['LEEME.txt', utf8(LEEME)], ['incidente.json', incidente]];
  for (const x of d.registros) {
    const n = x.seq === 'cierre' ? 'cierre' : String(x.seq).padStart(6, '0');
    archivos.push([`registros/${n}.r`, x.r], [`registros/${n}.s`, x.s], [`acuses/${n}.json`, x.acuse]);
    // El sobre trae el cifrado vacío en la apertura, el hueco y el cierre: solo un fragmento tiene .bin.
    if (x.cifrado?.length) archivos.push([`cifrados/${n}.bin`, x.cifrado]);
  }
  if (d.eventos?.length) {
    const porHora = d.eventos.map((e) => ({ hora: analizarEvento(e).hora_servidor, e })).sort((a, b) => a.hora - b.hora);
    archivos.push(['eventos.txt', utf8(porHora.map(({ e }) => `${new TextDecoder().decode(e)}\n`).join(''))]);
  }
  const porRol = new Map<Rol, number>();
  for (const { rol, k } of d.envolturas ?? []) {
    const n = (porRol.get(rol) ?? 0) + 1;
    porRol.set(rol, n);
    const jcv = codificarJcv({ k: b64u(k), rol });
    analizarJcv(jcv, ESQUEMA_ENVOLTURA);
    archivos.push([`envolturas/${rol}-${n}.json`, jcv]);
  }
  archivos.sort(([a], [b]) => comparar(a, b));
  // Un seq fuera de 0..999 999 no da un nombre admitido, y uno repetido rompe el orden.
  comprobarNombres(archivos.map(([n]) => n));
  return crearZip(archivos);
}
