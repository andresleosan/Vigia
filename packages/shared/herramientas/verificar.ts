/**
 * Verificador de paquetes de Vigía (docs/verificacion.md). Uso, desde packages/shared:
 *   node herramientas/verificar.ts <paquete.zip> --zona <zona IANA> (--claves <archivo> | --entorno produccion)
 *     [--huella <hex de 64>] [--clave-incidente | --clave-escucha] [--audio <archivo>]
 * La clave del incidente (K) o la privada de escucha llegan en b64u por la entrada estándar, nunca como argumento (ENV-01).
 * Sale con 0 si el paquete no tiene fallos, 1 si los tiene y 2 si la orden está mal escrita.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { hpkeCore, importarReceptora } from '../src/hpke-core.ts';
import {
  analizarJcv, analizarListaClaves, CLAVES_ACUSE_PRODUCCION, criptoWebCrypto, deB64u, desenvolverK, ESQUEMA_ENVOLTURA,
  ESQUEMA_INCIDENTE, leerZip, verificarPaquete, type ClavesAcuse,
} from '../src/index.ts';

const USO = `Uso: node herramientas/verificar.ts <paquete.zip> --zona <zona IANA> (--claves <archivo> | --entorno produccion)
         [--huella <hex de 64>] [--clave-incidente | --clave-escucha] [--audio <archivo>]
La clave del incidente o la privada de escucha se leen en b64u de la entrada estándar.`;

function uso(motivo: string): never {
  console.error(`${motivo}\n${USO}`);
  process.exit(2);
}

function leerArgumentos() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        zona: { type: 'string' },
        claves: { type: 'string' },
        entorno: { type: 'string' },
        huella: { type: 'string' },
        'clave-incidente': { type: 'boolean' },
        'clave-escucha': { type: 'boolean' },
        audio: { type: 'string' },
      },
    });
  } catch {
    return uso('Argumentos no válidos.');
  }
}

const { values: o, positionals } = leerArgumentos();
const [ruta, ...sobran] = positionals;
if (!ruta || sobran.length) uso('Indica un solo paquete.');
if (!o.zona) uso('Falta --zona.');
try {
  new Intl.DateTimeFormat('en-US', { timeZone: o.zona });
} catch {
  uso(`Zona horaria desconocida: ${o.zona}`);
}
if ((o.claves === undefined) === (o.entorno === undefined) || (o.entorno !== undefined && o.entorno !== 'produccion')) {
  uso('Indica --claves <archivo> o --entorno produccion.');
}
if (o.huella !== undefined && !/^[0-9a-f]{64}$/.test(o.huella)) uso('--huella son 64 caracteres hex en minúsculas.');
if (o['clave-incidente'] && o['clave-escucha']) uso('Usa --clave-incidente o --clave-escucha, no las dos.');

function lista(): [ClavesAcuse, string] {
  if (o.claves === undefined) return [CLAVES_ACUSE_PRODUCCION, 'lista de producción compilada en shared'];
  try {
    return [analizarListaClaves(readFileSync(o.claves)), o.claves];
  } catch {
    return uso(`No se puede leer la lista de claves: ${o.claves}`);
  }
}

function secreto(): Uint8Array {
  try {
    const clave = deB64u(new TextDecoder().decode(readFileSync(0)).trim());
    if (clave.length === 32) return clave;
  } catch {
    // se dice abajo
  }
  return uso('La entrada estándar no trae una clave de 32 bytes en b64u.');
}

/** K abierta con la privada de escucha desde envolturas/escucha-<n>.json, o undefined. */
async function abrirEscucha(zip: Uint8Array, privada: Uint8Array): Promise<Uint8Array | undefined> {
  const receptora = await importarReceptora(privada);
  let archivos: Map<string, Uint8Array>;
  let incidente: string;
  try {
    archivos = leerZip(zip);
    incidente = analizarJcv(archivos.get('incidente.json') ?? new Uint8Array(0), ESQUEMA_INCIDENTE).incidente as string;
  } catch {
    return undefined; // el paquete no vale: lo dice el verificador
  }
  for (const [nombre, bytes] of archivos) {
    if (!nombre.startsWith('envolturas/escucha-')) continue;
    try {
      const e = analizarJcv(bytes, ESQUEMA_ENVOLTURA);
      if (e.rol === 'escucha') return await desenvolverK(hpkeCore(), receptora, incidente, 'escucha', deB64u(e.k as string));
    } catch {
      // esta envoltura no es de esta clave: se prueba la siguiente
    }
  }
  console.log('La clave de escucha no abre ninguna envoltura del paquete.');
  return undefined;
}

let zip: Uint8Array;
try {
  zip = readFileSync(ruta);
} catch {
  uso(`No se puede leer el paquete: ${ruta}`);
}
const [claves, origen] = lista();
const clave = o['clave-incidente'] || o['clave-escucha'] ? secreto() : undefined;
const k = clave && o['clave-escucha'] ? await abrirEscucha(zip, clave) : clave;
console.log(`Claves del acuse: ${origen}`);
const informe = await verificarPaquete(criptoWebCrypto(), zip, { huella: o.huella, claves, k, zona: o.zona });
console.log(informe.resumen);
for (const h of informe.hallazgos) console.log(`- ${h.texto}`);
if (o.audio !== undefined) writeFileSync(o.audio, Buffer.concat([...informe.audio].sort(([a], [b]) => a - b).map(([, audio]) => audio)));
process.exitCode = informe.estado === 'fallido' ? 1 : 0;
