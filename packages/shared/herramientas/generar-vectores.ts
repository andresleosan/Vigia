/**
 * Vectores dorados de H1 (contrato, sección 18). Uso: pnpm --filter @vigia/shared vectores
 *
 * Reescribe los archivos deterministas y crea firmas-ts.json solo si no existe: las firmas se
 * generan una vez, con claves efímeras que se descartan, y cada lado verifica las del otro.
 * Ninguna privada de firma entra en los vectores; las de HPKE salen de semillas de prueba.
 */
import { createECDH } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { Aes256Gcm, CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from '@hpke/core';
import { bytesEntradaClave, firmarAcuse, type EntradaClave, type ResultadoAcuse } from '../src/acuse.ts';
import { aad, type TipoAad } from '../src/aad.ts';
import { cifrar, codificarPosicion, type Posicion } from '../src/cifrado.ts';
import { b64u, deB64u, deHex, ErrorFormato, hex, u16be, u32be, unir, utf8 } from '../src/codificacion.ts';
import {
  cuerpoAlta, cuerpoCierre, cuerpoIncidente, RUTA, rutaCierre, rutaFragmento, rutaIncidente,
} from '../src/contratos.ts';
import { criptoWebCrypto, derAP1363, esSpkiP256, huella, p1363ADer } from '../src/cripto.ts';
import { desenvolverK, envolverK, infoEnvoltura, type Rol } from '../src/envoltura.ts';
import { firmarEvento, type Evento } from '../src/evento.ts';
import { hpkeCore, hpkeCoreConSemilla } from '../src/hpke-core.ts';
import { cadenaPeticion, firmarPeticion, resumenPeticion, type DatosPeticion } from '../src/peticion.ts';
import { PREFIJO } from '../src/prefijos.ts';
import {
  bytesRegistro, compromisoK, firmarRegistro, hashRegistro, huellaAudio, prefijoDe, type Registro,
} from '../src/registros.ts';
import { desempaquetarSobre, empaquetarSobre } from '../src/sobre.ts';
import { criptoDeterminista } from '../test/cripto-determinista.ts';

const cripto = criptoWebCrypto();
const DIR = new URL('../vectores/', import.meta.url);

// Datos fijos: ids que casan con el patrón y no son de nadie, y bytes en serie fáciles de reconocer.
const INCIDENTE = 'incidente-de-prueba-01';
const DISPOSITIVO = 'dispositivo-de-prueba1';
const ID_PETICION = 'peticion-de-prueba-001';
const CONTACTO = 'contacto-de-prueba-001';
const T0 = 1_791_799_200_000; // 2026-10-12T10:00:00Z
const DIA = 86_400_000;
const K = serie(32, 0x00);
const S_RELLENO = serie(64, 0x70); // no es una firma: el sobre y los cuerpos se comparan "salvo s"
const SEMILLA_RECEPTOR = serie(32, 0x20);
const SEMILLA_EFIMERA = serie(32, 0x40);
const NONCE = { ct1: serie(12, 0xa0), loc1: serie(12, 0xb0), ct2: serie(12, 0xc0), meta: serie(12, 0xd0) };
const AUDIO_1 = serie(48, 0x10);
const AUDIO_2 = serie(48, 0x50);
const META = serie(40, 0x60);
const POSICION: Posicion = { hora_fix: T0 - 5_000, lat_e6: 12_345_678, lon_e6: -98_765_432, precision_m: 12 };
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n; // orden de P-256
const CABECERA_SPKI = deHex('3059301306072a8648ce3d020106082a8648ce3d030107034200'); // la de la sección 2, sin el 0x04

const texto = (b: Uint8Array) => new TextDecoder().decode(b);

/** Formato de todos los archivos de vectores: JSON con sangría de 2 espacios y un salto final. */
export const textoJson = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

function serie(n: number, desde: number): Uint8Array {
  return Uint8Array.from({ length: n }, (_, i) => (desde + i) & 0xff);
}

/** SPKI de k·G. Las públicas fijas son G y 2·G: su "privada" (1 o 2) no protege nada. */
function spkiFija(k: number): Uint8Array {
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(deHex(k.toString(16).padStart(64, '0')));
  return unir(CABECERA_SPKI, ecdh.getPublicKey());
}

function rechaza(intento: () => unknown, que: string): void {
  try {
    intento();
  } catch (e) {
    if (e instanceof ErrorFormato) return;
    throw e;
  }
  throw new Error(`se aceptó ${que}`);
}

/** Apertura, fragmento 1 (con posición), fragmento 2, hueco 3 y cierre de un incidente de prueba. */
async function cadena(dispositivo: string) {
  const ct1 = await cifrar(criptoDeterminista(NONCE.ct1), K, aad('ct', INCIDENTE, 1), AUDIO_1);
  const loc1 = await cifrar(criptoDeterminista(NONCE.loc1), K, aad('loc', INCIDENTE, 1), codificarPosicion(POSICION));
  const ct2 = await cifrar(criptoDeterminista(NONCE.ct2), K, aad('ct', INCIDENTE, 2), AUDIO_2);
  const hash = (r: Registro) => hashRegistro(cripto, bytesRegistro(r));
  const apertura: Registro = {
    v: 1, tipo: 'apertura', incidente: INCIDENTE, seq: 0, hora_telefono: T0, country_code: 'VE',
    dispositivo, origen: 'grabar', kc: await compromisoK(cripto, INCIDENTE, K),
  };
  const fragmento1: Registro = {
    v: 1, tipo: 'fragmento', incidente: INCIDENTE, seq: 1, hora_telefono: T0 + 1_000,
    p: await huellaAudio(cripto, K, AUDIO_1), c: hex(await cripto.sha256(ct1)), prev: await hash(apertura), loc: b64u(loc1),
  };
  const fragmento2: Registro = {
    v: 1, tipo: 'fragmento', incidente: INCIDENTE, seq: 2, hora_telefono: T0 + 5_000,
    p: await huellaAudio(cripto, K, AUDIO_2), c: hex(await cripto.sha256(ct2)), prev: await hash(fragmento1),
  };
  const hueco3: Registro = {
    v: 1, tipo: 'hueco', incidente: INCIDENTE, seq: 3, hora_telefono: T0 + 9_000,
    prev: await hash(fragmento2), fin: T0 + 12_500, motivo: 'microfono',
  };
  const cierre: Registro = {
    v: 1, tipo: 'cierre', incidente: INCIDENTE, hora_telefono: T0 + 13_000, ultimo_seq: 3, hash_final: await hash(hueco3),
  };
  const eslabones: [string, Registro, Uint8Array][] = [
    ['apertura', apertura, new Uint8Array(0)],
    ['fragmento_1', fragmento1, ct1],
    ['fragmento_2', fragmento2, ct2],
    ['hueco_3', hueco3, new Uint8Array(0)],
    ['cierre', cierre, new Uint8Array(0)],
  ];
  return { eslabones, ct1, ct2 };
}
type Cadena = Awaited<ReturnType<typeof cadena>>;

type Cuerpos = { alta: Uint8Array; incidente: Uint8Array; fragmento: Uint8Array; cierre: Uint8Array };

function peticiones(c: Cuerpos): (DatosPeticion & { nombre: string })[] {
  const base = { hora: T0 + 20_000, idPeticion: ID_PETICION, idDispositivo: DISPOSITIVO };
  const vacio = new Uint8Array(0);
  return [
    { nombre: 'alta', metodo: 'POST', ruta: RUTA.dispositivos, ...base, idDispositivo: 'registro', cuerpo: c.alta },
    { nombre: 'apertura', metodo: 'POST', ruta: RUTA.incidentes, ...base, cuerpo: c.incidente },
    {
      nombre: 'apertura_tras_401_hora', metodo: 'POST', ruta: RUTA.incidentes, ...base, hora: base.hora + 360_000, cuerpo: c.incidente,
    },
    { nombre: 'fragmento', metodo: 'PUT', ruta: rutaFragmento(INCIDENTE, 1), ...base, cuerpo: c.fragmento },
    { nombre: 'cierre', metodo: 'POST', ruta: rutaCierre(INCIDENTE), ...base, cuerpo: c.cierre },
    { nombre: 'estado', metodo: 'GET', ruta: rutaIncidente(INCIDENTE), ...base, cuerpo: vacio },
    { nombre: 'lectura_apertura', metodo: 'GET', ruta: rutaFragmento(INCIDENTE, 0), ...base, cuerpo: vacio },
    { nombre: 'lectura_cierre', metodo: 'GET', ruta: rutaCierre(INCIDENTE), ...base, cuerpo: vacio },
  ];
}

const peticionJson = (p: DatosPeticion & { nombre: string }) => ({
  nombre: p.nombre, metodo: p.metodo, ruta: p.ruta, hora: p.hora,
  id_peticion: p.idPeticion, id_dispositivo: p.idDispositivo, cuerpo: hex(p.cuerpo),
});

function codificacionJson() {
  const b64uCasos = ['', '00', 'ff', 'fbff', 'fbffbf', '0001020304', '000102030405', hex(serie(64, 0))];
  const rechazados = ['A', 'AB', 'AAB', 'AA==', 'AA=', 'A+', 'A/', 'A A', 'AAAAA', 'A.', 'Zg=', 'QUJD\n'];
  const hexRechazados = ['AB', 'abc', 'zz', '0g', ' 00'];
  for (const t of rechazados) rechaza(() => deB64u(t), `el b64u ${JSON.stringify(t)}`);
  for (const t of hexRechazados) rechaza(() => deHex(t), `el hex ${JSON.stringify(t)}`);
  return {
    b64u: b64uCasos.map((h) => ({ hex: h, b64u: b64u(deHex(h)) })),
    b64u_rechazados: rechazados,
    hex_rechazados: hexRechazados,
    u16be: [0, 1, 255, 256, 65_535].map((n) => ({ n, hex: hex(u16be(n)) })),
    u32be: [0, 1, 999_999, 16_777_216, 4_294_967_295].map((n) => ({ n, hex: hex(u32be(n)) })),
  };
}

function prefijosJson() {
  return Object.fromEntries(Object.entries(PREFIJO).map(([nombre, bytes]) => [nombre, hex(bytes)]));
}

async function spkiJson(g: Uint8Array, g2: Uint8Array) {
  const otroOid = Uint8Array.from(g);
  otroOid[22] = 0x08; // 1.2.840.10045.3.1.8 en lugar de prime256v1
  const rechazadas: Record<string, Uint8Array> = {
    comprimida: unir(
      deHex('3039301306072a8648ce3d020106082a8648ce3d030107032200'), Uint8Array.of(2 + (g[90] & 1)), g.subarray(27, 59),
    ),
    de_90_bytes: g.subarray(0, 90),
    de_92_bytes: unir(g, Uint8Array.of(0)),
    otro_oid: otroOid,
  };
  for (const [nombre, spki] of Object.entries(rechazadas)) if (esSpkiP256(spki)) throw new Error(`se aceptó la SPKI ${nombre}`);
  return {
    validas: await Promise.all([g, g2].map(async (spki) => ({ spki: hex(spki), b64u: b64u(spki), huella: await huella(cripto, spki) }))),
    rechazadas: Object.entries(rechazadas).map(([nombre, spki]) => ({ nombre, spki: hex(spki) })),
  };
}

function derJson() {
  const casos: [string, string, string][] = [
    ['normal', '11'.repeat(32), '22'.repeat(32)],
    ['r_de_31_bytes', `00${'7f'.repeat(31)}`, '22'.repeat(32)],
    ['s_de_31_bytes', '11'.repeat(32), `00${'7f'.repeat(31)}`],
    ['r_de_33_bytes_con_signo', '80'.repeat(32), '22'.repeat(32)],
    ['s_de_33_bytes_con_signo', '11'.repeat(32), '80'.repeat(32)],
    ['r_de_1_byte', `${'00'.repeat(31)}01`, '22'.repeat(32)],
    ['ambos_de_33_bytes', 'fe'.repeat(32), 'fe'.repeat(32)],
  ];
  return {
    casos: casos.map(([nombre, r, s]) => {
      const der = p1363ADer(deHex(r + s));
      if (hex(derAP1363(der)) !== r + s) throw new Error(`DER sin ida y vuelta: ${nombre}`);
      return { nombre, p1363: r + s, der: hex(der) };
    }),
  };
}

async function registrosJson(c: Cadena) {
  const extra: Record<string, object> = {
    fragmento_1: { audio: hex(AUDIO_1), nonce: hex(NONCE.ct1), cifrado: hex(c.ct1), posicion: POSICION, nonce_loc: hex(NONCE.loc1) },
    fragmento_2: { audio: hex(AUDIO_2), nonce: hex(NONCE.ct2), cifrado: hex(c.ct2) },
  };
  const registros = [];
  for (const [nombre, r] of c.eslabones) {
    const bytes = bytesRegistro(r);
    registros.push({ nombre, jcv: texto(bytes), hash: await hashRegistro(cripto, bytes), prefijo: hex(prefijoDe(r)), ...extra[nombre] });
  }
  return { incidente: INCIDENTE, k: hex(K), registros };
}

async function cifradoJson() {
  const aads: [TipoAad, number][] = [['ct', 1], ['loc', 1], ['meta', 0], ['ct', 999_999]];
  const aes: [string, TipoAad, number, Uint8Array, Uint8Array][] = [
    ['ct_1', 'ct', 1, AUDIO_1, NONCE.ct1],
    ['loc_1', 'loc', 1, codificarPosicion(POSICION), NONCE.loc1],
    ['meta', 'meta', 0, META, NONCE.meta],
    ['claro_vacio', 'ct', 2, new Uint8Array(0), NONCE.ct2],
  ];
  const posiciones: Posicion[] = [
    POSICION,
    { hora_fix: 0, lat_e6: 0, lon_e6: 0, precision_m: 0 },
    { hora_fix: 1, lat_e6: -1, lon_e6: 1, precision_m: 1 },
    { hora_fix: Number.MAX_SAFE_INTEGER, lat_e6: 90_000_000, lon_e6: -180_000_000, precision_m: 100_000 },
    { hora_fix: T0, lat_e6: -90_000_000, lon_e6: 180_000_000, precision_m: 5 },
  ];
  const rechazadas: Posicion[] = [
    { ...POSICION, lat_e6: 90_000_001 },
    { ...POSICION, lat_e6: -90_000_001 },
    { ...POSICION, lon_e6: 180_000_001 },
    { ...POSICION, lon_e6: -180_000_001 },
    { ...POSICION, precision_m: 100_001 },
    { ...POSICION, precision_m: -1 },
    { ...POSICION, hora_fix: -1 },
  ];
  for (const p of rechazadas) rechaza(() => codificarPosicion(p), `la posición ${JSON.stringify(p)}`);
  return {
    incidente: INCIDENTE,
    k: hex(K),
    aad: aads.map(([tipo, seq]) => ({ tipo, seq, aad: hex(aad(tipo, INCIDENTE, seq)) })),
    aes_gcm: await Promise.all(aes.map(async ([nombre, tipo, seq, claro, nonce]) => ({
      nombre, nonce: hex(nonce), aad: hex(aad(tipo, INCIDENTE, seq)), claro: hex(claro),
      cifrado: hex(await cifrar(criptoDeterminista(nonce), K, aad(tipo, INCIDENTE, seq), claro)),
    }))),
    posiciones: posiciones.map((p) => ({ ...p, jcv: texto(codificarPosicion(p)) })),
    posiciones_rechazadas: rechazadas,
  };
}

async function envolturas(): Promise<{ publica: Uint8Array; casos: { rol: Rol; envoltura: Uint8Array }[] }> {
  const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  const receptor = await suite.kem.deriveKeyPair(SEMILLA_RECEPTOR);
  const publica = new Uint8Array(await suite.kem.serializePublicKey(receptor.publicKey));
  const casos = [];
  for (const rol of ['contacto', 'recuperacion', 'escucha'] as const) {
    const envoltura = await envolverK(hpkeCoreConSemilla(SEMILLA_EFIMERA), publica, INCIDENTE, rol, K);
    if (hex(await desenvolverK(hpkeCore(), receptor, INCIDENTE, rol, envoltura)) !== hex(K)) throw new Error('la envoltura no abre');
    casos.push({ rol, envoltura });
  }
  return { publica, casos };
}

async function sobresJson(c: Cadena) {
  const rechazados: Record<string, Uint8Array> = {
    vacio: new Uint8Array(0),
    un_byte: Uint8Array.of(0),
    len_r_cero: unir(u16be(0), Uint8Array.of(0), S_RELLENO),
    len_r_mayor_que_el_resto: unir(u16be(0xffff), utf8('{}'), S_RELLENO),
    falta_un_byte_de_s: unir(u16be(2), utf8('{}'), S_RELLENO.subarray(1)),
  };
  for (const [nombre, cuerpo] of Object.entries(rechazados)) rechaza(() => desempaquetarSobre(cuerpo), `el sobre ${nombre}`);
  return {
    s: hex(S_RELLENO),
    casos: c.eslabones.map(([nombre, r, cifrado]) => ({
      nombre, r: texto(bytesRegistro(r)), cifrado: hex(cifrado),
      cuerpo: hex(empaquetarSobre({ r: bytesRegistro(r), s: S_RELLENO, cifrado })),
    })),
    rechazados: Object.entries(rechazados).map(([nombre, cuerpo]) => ({ nombre, cuerpo: hex(cuerpo) })),
  };
}

/** Todo lo determinista de la sección 18, por nombre de archivo. */
export async function vectoresDeterministas(): Promise<Record<string, unknown>> {
  const g = spkiFija(1);
  const g2 = spkiFija(2);
  const c = await cadena(await huella(cripto, g));
  const env = await envolturas();
  const [apertura, fragmento1, , , cierre] = c.eslabones.map(([, r]) => bytesRegistro(r));
  const envolturasCuerpo = env.casos.map(({ rol, envoltura }) => ({ destino: rol === 'contacto' ? CONTACTO : '-', k: envoltura, rol }));
  const cuerpos: Cuerpos = {
    alta: cuerpoAlta({ lectura: b64u(g2), publica: b64u(g) }),
    incidente: cuerpoIncidente({
      envolturas: envolturasCuerpo.map((e) => ({ ...e, k: b64u(e.k) })), meta: b64u(META), r: b64u(apertura), s: b64u(S_RELLENO),
    }),
    fragmento: empaquetarSobre({ r: fragmento1, s: S_RELLENO, cifrado: c.ct1 }),
    cierre: cuerpoCierre({ r: b64u(cierre), s: b64u(S_RELLENO) }),
  };
  return {
    'codificacion.json': codificacionJson(),
    'prefijos.json': prefijosJson(),
    'spki.json': await spkiJson(g, g2),
    'der.json': derJson(),
    'registros.json': await registrosJson(c),
    'cifrado.json': await cifradoJson(),
    'envoltura.json': {
      semilla_receptor: hex(SEMILLA_RECEPTOR),
      publica_receptor: hex(env.publica),
      semilla_efimera: hex(SEMILLA_EFIMERA),
      incidente: INCIDENTE,
      k: hex(K),
      casos: env.casos.map(({ rol, envoltura }) => ({ rol, info: hex(infoEnvoltura(INCIDENTE, rol)), envoltura: hex(envoltura) })),
    },
    'sobres.json': await sobresJson(c),
    'cuerpos.json': {
      s: hex(S_RELLENO),
      alta: { publica: hex(g), lectura: hex(g2), json: texto(cuerpos.alta) },
      incidentes: [
        {
          nombre: 'con_meta', r: texto(apertura), meta: hex(META), json: texto(cuerpos.incidente),
          envolturas: envolturasCuerpo.map((e) => ({ destino: e.destino, k: hex(e.k), rol: e.rol })),
        },
        {
          nombre: 'sin_meta_ni_envolturas', r: texto(apertura), envolturas: [],
          json: texto(cuerpoIncidente({ envolturas: [], r: b64u(apertura), s: b64u(S_RELLENO) })),
        },
      ],
      cierre: { r: texto(cierre), json: texto(cuerpos.cierre) },
    },
    'peticiones.json': {
      casos: await Promise.all(peticiones(cuerpos).map(async (p) => ({
        ...peticionJson(p),
        cadena: hex(await cadenaPeticion(cripto, p)),
        h: await resumenPeticion(cripto, p.metodo, p.ruta, p.cuerpo),
      }))),
    },
  };
}

export type FirmasTs = {
  dispositivo: string;
  lectura: string;
  registros: { nombre: string; r: string; s: string }[];
  ecdsa: { spki: string; mensaje: string; casos: { nombre: string; firma: string; valida: boolean }[] };
  peticiones: (ReturnType<typeof peticionJson> & { firmante: 'dispositivo' | 'lectura'; firma: string })[];
  claves_acuse: string[];
  acuses: { nombre: string; acuse: string; r: string; resultado: ResultadoAcuse }[];
  eventos: { nombre: string; evento: string; resultado: ResultadoAcuse }[];
};

async function claveEfimera(): Promise<{ privada: CryptoKey; spki: Uint8Array }> {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  return { privada: par.privateKey, spki: new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey)) };
}

/** Casos obligatorios de la verificación ECDSA (sección 18), con una firma real de una clave efímera. Los comprueba la prueba. */
async function casosEcdsa() {
  const clave = await claveEfimera();
  const mensaje = utf8('vigia: mensaje de prueba para ECDSA');
  const firmar = () => cripto.firmarP256(clave.privada, mensaje);
  const buscar = async (cumple: (f: Uint8Array) => boolean) => {
    for (let i = 0; i < 100_000; i++) {
      const f = await firmar();
      if (cumple(f)) return f;
    }
    throw new Error('ninguna firma con esa forma');
  };
  // Bytes que ocupa r o s en el DER de la firma, con el 0x00 de signo si lo lleva.
  const enDer = (f: Uint8Array, entero: 'r' | 's') => {
    const der = p1363ADer(f);
    return entero === 'r' ? der[3] : der[5 + der[3]];
  };
  const n32 = (x: bigint) => deHex(x.toString(16).padStart(64, '0'));
  const buena = await firmar();
  const r = buena.slice(0, 32);
  const s = buena.slice(32);
  const otroBit = Uint8Array.from(buena);
  otroBit[63] ^= 1;
  const casos: [string, Uint8Array, boolean][] = [
    ['valida', buena, true],
    ['n_menos_s', unir(r, n32(N - BigInt(`0x${hex(s)}`))), true],
    ['r_de_31_bytes', await buscar((f) => enDer(f, 'r') === 31), true],
    ['s_de_31_bytes', await buscar((f) => enDer(f, 's') === 31), true],
    ['r_de_33_bytes', await buscar((f) => enDer(f, 'r') === 33), true],
    ['s_de_33_bytes', await buscar((f) => enDer(f, 's') === 33), true],
    ['r_cero', unir(new Uint8Array(32), s), false],
    ['s_cero', unir(r, new Uint8Array(32)), false],
    ['r_igual_a_n', unir(n32(N), s), false],
    ['s_igual_a_n', unir(r, n32(N)), false],
    ['r_mayor_que_n', unir(new Uint8Array(32).fill(0xff), s), false],
    ['s_mayor_que_n', unir(r, new Uint8Array(32).fill(0xff)), false],
    ['firma_de_63_bytes', buena.slice(0, 63), false],
    ['firma_de_65_bytes', unir(buena, Uint8Array.of(0)), false],
    ['bit_cambiado', otroBit, false],
  ];
  return { spki: b64u(clave.spki), mensaje: hex(mensaje), casos: casos.map(([nombre, firma, v]) => ({ nombre, firma: hex(firma), valida: v })) };
}

/** Firmas que se generan una sola vez (sección 18): las claves se descartan al terminar. */
export async function firmasNuevas(): Promise<FirmasTs> {
  const dispositivo = await claveEfimera();
  const lectura = await claveEfimera();
  const huellaDispositivo = await huella(cripto, dispositivo.spki);
  const c = await cadena(huellaDispositivo);
  const firmados = [];
  for (const [nombre, r, cifrado] of c.eslabones) {
    firmados.push({ nombre, cifrado, ...(await firmarRegistro(cripto, dispositivo.privada, r)) });
  }
  const [apertura, fragmento1, , , cierre] = firmados;
  const cuerpos: Cuerpos = {
    alta: cuerpoAlta({ lectura: b64u(lectura.spki), publica: b64u(dispositivo.spki) }),
    incidente: cuerpoIncidente({ envolturas: [], r: b64u(apertura.bytes), s: b64u(apertura.s) }),
    fragmento: empaquetarSobre({ r: fragmento1.bytes, s: fragmento1.s, cifrado: fragmento1.cifrado }),
    cierre: cuerpoCierre({ r: b64u(cierre.bytes), s: b64u(cierre.s) }),
  };
  const firmadas: FirmasTs['peticiones'] = [];
  for (const p of peticiones(cuerpos)) {
    const firmante = p.metodo === 'GET' ? 'lectura' : 'dispositivo';
    const clave = firmante === 'lectura' ? lectura : dispositivo;
    firmadas.push({ ...peticionJson(p), firmante, firma: await firmarPeticion(cripto, clave.privada, p) });
  }

  const T = T0 + 30_000;
  const activa = await claveEfimera();
  const retirada = await claveEfimera();
  const comprometida = await claveEfimera();
  const desconocida = await claveEfimera();
  const entradas: EntradaClave[] = [
    { kid: 'prueba_activa', spki: activa.spki, estado: 'activa', desde: T0 - DIA },
    { kid: 'prueba_retirada', spki: retirada.spki, estado: 'retirada', desde: T0 - DIA, hasta: T },
    { kid: 'prueba_comprometida', spki: comprometida.spki, estado: 'comprometida', desde: T0 - DIA },
  ];
  const rApertura = await hashRegistro(cripto, apertura.bytes);
  const rFragmento = await hashRegistro(cripto, fragmento1.bytes);
  const acuse = async (clave: { privada: CryptoKey }, kid: string, hora: number, r = rApertura) =>
    texto(await firmarAcuse(cripto, clave.privada, kid, r, hora));
  const valido = await acuse(activa, 'prueba_activa', T);
  const firmaValida = /"firma":"([A-Za-z0-9_-]{86})"/.exec(valido)![1];
  const otraFirma = deB64u(firmaValida);
  otraFirma[0] ^= 1;
  const acuses: FirmasTs['acuses'] = [
    { nombre: 'valido', acuse: valido, r: rApertura, resultado: 'valido' },
    { nombre: 'del_fragmento_1', acuse: await acuse(activa, 'prueba_activa', T, rFragmento), r: rFragmento, resultado: 'valido' },
    { nombre: 'retirada_en_su_ventana', acuse: await acuse(retirada, 'prueba_retirada', T), r: rApertura, resultado: 'valido' },
    {
      nombre: 'retirada_fuera_de_su_ventana', acuse: await acuse(retirada, 'prueba_retirada', T + 1), r: rApertura, resultado: 'invalido',
    },
    { nombre: 'antes_de_desde', acuse: await acuse(activa, 'prueba_activa', T0 - DIA - 1), r: rApertura, resultado: 'invalido' },
    {
      nombre: 'clave_comprometida', acuse: await acuse(comprometida, 'prueba_comprometida', T), r: rApertura, resultado: 'comprometido',
    },
    { nombre: 'kid_desconocido', acuse: await acuse(desconocida, 'prueba_desconocida', T), r: rApertura, resultado: 'desconocido' },
    {
      nombre: 'hora_cambiada', acuse: valido.replace(`"hora_servidor":${T}`, `"hora_servidor":${T + 1}`), r: rApertura, resultado: 'invalido',
    },
    { nombre: 'firma_cambiada', acuse: valido.replace(firmaValida, b64u(otraFirma)), r: rApertura, resultado: 'invalido' },
    { nombre: 'r_de_otro_registro', acuse: valido, r: rFragmento, resultado: 'invalido' },
  ];
  const base = { v: 1, dispositivo: huellaDispositivo, hora_servidor: T, kid: 'prueba_activa' } as const;
  const evento = async (clave: { privada: CryptoKey }, e: Omit<Evento, 'firma'>) => texto(await firmarEvento(cripto, clave.privada, e));
  const alerta = await evento(activa, { ...base, evento: 'alerta', incidente: INCIDENTE });
  const eventos: FirmasTs['eventos'] = [
    { nombre: 'alerta', evento: alerta, resultado: 'valido' },
    { nombre: 'revocacion_del_telefono', evento: await evento(activa, { ...base, evento: 'revocacion', incidente: '-' }), resultado: 'valido' },
    {
      nombre: 'acceso_con_destino', resultado: 'valido',
      evento: await evento(activa, { ...base, evento: 'acceso', incidente: INCIDENTE, destino: CONTACTO }),
    },
    {
      nombre: 'clave_comprometida', resultado: 'comprometido',
      evento: await evento(comprometida, { ...base, kid: 'prueba_comprometida', evento: 'cancelacion', incidente: INCIDENTE }),
    },
    { nombre: 'de_otro_dispositivo', evento: alerta.replace(huellaDispositivo, 'cd'.repeat(32)), resultado: 'invalido' },
  ];
  return {
    dispositivo: b64u(dispositivo.spki),
    lectura: b64u(lectura.spki),
    registros: firmados.map((f) => ({ nombre: f.nombre, r: texto(f.bytes), s: hex(f.s) })),
    ecdsa: await casosEcdsa(),
    peticiones: firmadas,
    claves_acuse: entradas.map((e) => texto(bytesEntradaClave(e))),
    acuses,
    eventos,
  };
}

if (import.meta.main) {
  mkdirSync(DIR, { recursive: true });
  const deterministas = await vectoresDeterministas();
  for (const [nombre, contenido] of Object.entries(deterministas)) writeFileSync(new URL(nombre, DIR), textoJson(contenido));
  const firmas = new URL('firmas-ts.json', DIR);
  const nuevas = !existsSync(firmas);
  if (nuevas) writeFileSync(firmas, textoJson(await firmasNuevas()));
  console.log(`vectores: ${Object.keys(deterministas).length} archivos deterministas; firmas-ts.json ${nuevas ? 'creado' : 'conservado'}`);
}
