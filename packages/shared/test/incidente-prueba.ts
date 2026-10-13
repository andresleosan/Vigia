import { firmarAcuse, type ClavesAcuse } from '../src/acuse.ts';
import { aad } from '../src/aad.ts';
import { cifrar } from '../src/cifrado.ts';
import { hex, unir, utf8 } from '../src/codificacion.ts';
import { criptoWebCrypto, huella } from '../src/cripto.ts';
import { firmarEvento } from '../src/evento.ts';
import { crearPaquete, crearZip, leerZip, type DatosPaquete } from '../src/paquete.ts';
import { compromisoK, firmarRegistro, hashRegistro, huellaAudio, type Registro } from '../src/registros.ts';
import { claveAcuse, claveP256 } from './claves-prueba.ts';

export const cripto = criptoWebCrypto();
export const INCIDENTE = 'incidenteDePrueba0000A';
export const OTRO_INCIDENTE = 'incidenteDePrueba0000B';
/** 12-10-2026 a las 14:00 UTC: las 10:00 en Caracas (UTC-04:00). */
export const T0 = Date.UTC(2026, 9, 12, 14, 0);
export const MIN = 60_000;

export type Entrada = DatosPaquete['registros'][number] & { hash: string; audio?: Uint8Array };

/** Un teléfono y un servidor de prueba con claves efímeras, y lo necesario para armar sus paquetes. */
export async function nuevaPrueba() {
  const dispositivo = await claveP256();
  const servidor = await claveAcuse('prueba', 'activa', 0);
  const k = cripto.aleatorio(32);
  const huellaDispositivo = await huella(cripto, dispositivo.spki);
  const claves: ClavesAcuse = [servidor.entrada];

  async function entrada(r: Registro, hora: number, op: { cifrado?: Uint8Array; audio?: Uint8Array } = {}): Promise<Entrada> {
    const { bytes, s } = await firmarRegistro(cripto, dispositivo.privada, r);
    const hash = await hashRegistro(cripto, bytes);
    const acuse = await firmarAcuse(cripto, servidor.privada, 'prueba', hash, hora);
    return { seq: r.tipo === 'cierre' ? 'cierre' : r.seq, r: bytes, s, cifrado: op.cifrado, acuse, hash, audio: op.audio };
  }

  /** Apertura con acuse a la `hora` dada; el reloj del teléfono va 1 s por detrás. `op` sirve para fabricar una que no es de este paquete. */
  async function apertura(hora = T0, origen: 'grabar' | 'sos' = 'grabar', op: { incidente?: string; dispositivo?: string } = {}): Promise<Entrada> {
    const kc = await compromisoK(cripto, INCIDENTE, k);
    return entrada({ v: 1, tipo: 'apertura', incidente: op.incidente ?? INCIDENTE, seq: 0, hora_telefono: hora - 1000, country_code: 'VE', dispositivo: op.dispositivo ?? huellaDispositivo, origen, kc }, hora);
  }

  /** Fragmento con su audio cifrado; `seqAad`, `p` y `loc` sirven para fabricar uno que no cuadra. */
  async function fragmento(seq: number, prev: string, hora: number, op: { incidente?: string; audio?: Uint8Array; seqAad?: number; p?: string; loc?: string } = {}): Promise<Entrada> {
    const incidente = op.incidente ?? INCIDENTE;
    const audio = op.audio ?? utf8(`audio de prueba del fragmento ${seq}`);
    const cifrado = await cifrar(cripto, k, aad('ct', incidente, op.seqAad ?? seq), audio);
    const p = op.p ?? (await huellaAudio(cripto, k, audio));
    const r: Registro = { v: 1, tipo: 'fragmento', incidente, seq, hora_telefono: hora - 1000, p, c: hex(await cripto.sha256(cifrado)), prev, loc: op.loc };
    return entrada(r, hora, { cifrado, audio });
  }

  function hueco(seq: number, prev: string, hora: number, inicio: number, fin: number): Promise<Entrada> {
    return entrada({ v: 1, tipo: 'hueco', incidente: INCIDENTE, seq, hora_telefono: inicio, prev, fin, motivo: 'microfono' }, hora);
  }

  function cierre(ultimoSeq: number, hashFinal: string, hora: number): Promise<Entrada> {
    return entrada({ v: 1, tipo: 'cierre', incidente: INCIDENTE, hora_telefono: hora - 1000, ultimo_seq: ultimoSeq, hash_final: hashFinal }, hora);
  }

  /** Apertura y `n` fragmentos encadenados; por defecto, el acuse del seq i llega a T0 + i minutos. */
  async function cadena(n: number, hora = (seq: number) => T0 + seq * MIN): Promise<Entrada[]> {
    const lista = [await apertura(hora(0))];
    for (let seq = 1; seq <= n; seq++) lista.push(await fragmento(seq, lista[seq - 1].hash, hora(seq)));
    return lista;
  }

  /** La cadena con su cierre (ultimo_seq = el último de la lista) a la hora dada. */
  async function cerrada(n: number, horaCierre = T0 + (n + 1) * MIN): Promise<Entrada[]> {
    const lista = await cadena(n);
    return [...lista, await cierre(n, lista[n].hash, horaCierre)];
  }

  function evento(nombre: string, hora: number, op: { incidente?: string; dispositivo?: string } = {}): Promise<Uint8Array> {
    return firmarEvento(cripto, servidor.privada, { v: 1, evento: nombre, dispositivo: op.dispositivo ?? huellaDispositivo, incidente: op.incidente ?? INCIDENTE, hora_servidor: hora, kid: 'prueba' });
  }

  function paquete(registros: readonly Entrada[], extra: Partial<DatosPaquete> = {}): Uint8Array {
    return crearPaquete({ incidente: INCIDENTE, spki: dispositivo.spki, registros, ...extra });
  }

  return { dispositivo, k, huella: huellaDispositivo, claves, apertura, fragmento, hueco, cierre, cadena, cerrada, evento, paquete };
}

// Orden de los grupos de la sección 14, escrito aparte del código para que sirva de comprobación.
const GRUPOS = ['LEEME.txt', 'incidente.json', 'registros/', 'cifrados/', 'acuses/', 'eventos.txt', 'envolturas/'];
const grupo = (nombre: string) => GRUPOS.findIndex((g) => nombre.startsWith(g));

/** Cambia, quita (`null`) o añade archivos de un paquete y lo vuelve a armar en el orden de la sección 14. */
export function cambiar(zip: Uint8Array, cambios: Record<string, Uint8Array | null>): Uint8Array {
  const archivos = new Map(leerZip(zip));
  for (const [nombre, bytes] of Object.entries(cambios)) {
    if (bytes === null) archivos.delete(nombre);
    else archivos.set(nombre, bytes);
  }
  return crearZip([...archivos].sort(([a], [b]) => grupo(a) - grupo(b) || (a < b ? -1 : 1)));
}

export const claves = (inf: { hallazgos: { clave: string }[] }) => inf.hallazgos.map((h) => h.clave);
export const textos = (inf: { hallazgos: { texto: string }[] }) => inf.hallazgos.map((h) => h.texto);

const vista = (z: Uint8Array) => new DataView(z.buffer, z.byteOffset, z.byteLength);
const centralDe = (z: Uint8Array) => vista(z).getUint32(z.length - 22 + 16, true); // desplazamiento del directorio central

/** ZIP ambiguos o con algo de más, hechos a partir de un paquete válido: la lectura estricta los rechaza (foco 4). */
export const ZIP_MALOS: Record<string, (zip: Uint8Array) => Uint8Array> = {
  'un nombre con ..': (zip) => crearZip([...leerZip(zip), ['registros/../LEEME.txt', utf8('x')]]),
  'una ruta absoluta': (zip) => crearZip([['/LEEME.txt', utf8('x')], ...leerZip(zip)]),
  'un nombre repetido': (zip) => {
    const archivos = [...leerZip(zip)];
    return crearZip([...archivos, archivos[archivos.length - 1]]);
  },
  'los archivos fuera de orden': (zip) => {
    const [leeme, incidente, ...resto] = leerZip(zip);
    return crearZip([incidente, leeme, ...resto]);
  },
  'las claves del acuse dentro (claves-acuse.json)': (zip) => crearZip([...leerZip(zip), ['claves-acuse.json', utf8('{}')]]),
  'un CRC que no es el de los datos': (zip) => {
    const z = zip.slice();
    const v = vista(z);
    v.setUint32(14, v.getUint32(14, true) ^ 1, true); // el de la primera cabecera local
    v.setUint32(centralDe(z) + 16, v.getUint32(centralDe(z) + 16, true) ^ 1, true); // y el de su entrada central
    return z;
  },
  'una cabecera local distinta de la central': (zip) => {
    const z = zip.slice();
    z[centralDe(z) + 46] ^= 0x20; // el nombre de la primera entrada central: LEEME.txt pasa a lEEME.txt
    return z;
  },
  'datos entre dos entradas, con el directorio central corregido': (zip) => {
    const corte = 30 + vista(zip).getUint16(26, true) + vista(zip).getUint32(18, true); // fin de la primera entrada
    const z = unir(zip.subarray(0, corte), Uint8Array.of(0, 0, 0, 0), zip.subarray(corte));
    const v = vista(z);
    const eocd = z.length - 22;
    const central = v.getUint32(eocd + 16, true) + 4;
    v.setUint32(eocd + 16, central, true);
    for (let i = central, n = 0; n < v.getUint16(eocd + 10, true); n++, i += 46 + v.getUint16(i + 28, true)) {
      if (n > 0) v.setUint32(i + 42, v.getUint32(i + 42, true) + 4, true);
    }
    return z;
  },
  'un comentario del archivo': (zip) => {
    const z = unir(zip, utf8('hola'));
    vista(z).setUint16(zip.length - 2, 4, true);
    return z;
  },
  'la versión 20 en lugar de 10': (zip) => {
    const z = zip.slice();
    vista(z).setUint16(4, 20, true);
    vista(z).setUint16(centralDe(z) + 6, 20, true);
    return z;
  },
  'cortado al final': (zip) => zip.subarray(0, zip.length - 1),
  'un byte de más al final': (zip) => unir(zip, Uint8Array.of(0)),
  'vacío': () => new Uint8Array(0),
};
