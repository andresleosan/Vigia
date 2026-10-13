import { analizarAcuse, verificarAcuse, type ClavesAcuse, type ResultadoAcuse } from './acuse.ts';
import { aad } from './aad.ts';
import { descifrar } from './cifrado.ts';
import { deB64u, ErrorFormato, hex } from './codificacion.ts';
import { esSpkiP256, huella as calcularHuella, type Cripto } from './cripto.ts';
import { analizarEvento, verificarEvento } from './evento.ts';
import { analizarJcv } from './jcv.ts';
import { ESQUEMA_INCIDENTE, leerZip, SHA256_LEEME } from './paquete.ts';
import { analizarRegistro, compromisoK, hashRegistro, huellaAudio, verificarRegistro, type Apertura, type Cierre, type Registro } from './registros.ts';

export type ClaveMensaje = 'ok' | 'ok_incompleto' | 'solo_apertura' | 'con_fallos' | 'paquete_invalido' | 'huella_distinta' | 'apertura_invalida' | 'registro_invalido' | 'ajeno' | 'falta_archivo' | 'sobra' | 'firma_invalida' | 'no_coincide' | 'ilegible' | 'cadena_rota' | 'enlace_contradicho' | 'cierre_invalido' | 'cierre_contradice' | 'despues_del_cierre' | 'sin_acuse' | 'acuse_no_fiable' | 'evento_invalido' | 'sin_huella' | 'leeme_alterado' | 'falta' | 'faltan' | 'sin_comprobar' | 'hueco' | 'cierre_sin_comprobar' | 'sin_cierre' | 'audio_sin_comprobar' | 'clave_incorrecta' | 'posterior_alerta' | 'tras_revocacion';

export const TIPO_DE: Readonly<Record<ClaveMensaje, 'resumen' | 'fallo' | 'aviso'>> = {
  ok: 'resumen', ok_incompleto: 'resumen', solo_apertura: 'resumen', con_fallos: 'resumen',
  paquete_invalido: 'fallo', huella_distinta: 'fallo', apertura_invalida: 'fallo', registro_invalido: 'fallo', ajeno: 'fallo',
  falta_archivo: 'fallo', sobra: 'fallo', firma_invalida: 'fallo', no_coincide: 'fallo', ilegible: 'fallo', cadena_rota: 'fallo',
  enlace_contradicho: 'fallo', cierre_invalido: 'fallo', cierre_contradice: 'fallo', despues_del_cierre: 'fallo', sin_acuse: 'fallo',
  acuse_no_fiable: 'fallo', evento_invalido: 'fallo',
  sin_huella: 'aviso', leeme_alterado: 'aviso', falta: 'aviso', faltan: 'aviso', sin_comprobar: 'aviso', hueco: 'aviso',
  cierre_sin_comprobar: 'aviso', sin_cierre: 'aviso', audio_sin_comprobar: 'aviso', clave_incorrecta: 'aviso',
  posterior_alerta: 'aviso', tras_revocacion: 'aviso',
};

/** Lista cerrada de la sección 15, la misma de docs/verificacion.md (una prueba lo comprueba). */
export const TEXTOS: Readonly<Record<ClaveMensaje, string>> = {
  ok: '✓ {n} fragmentos, cadena íntegra, firmados por el dispositivo {huella}, recibidos {intervalo}',
  ok_incompleto: '✓ {n} fragmentos firmados por el dispositivo {huella}, recibidos {intervalo}; el paquete no está completo: mira los avisos',
  solo_apertura: '✓ Apertura firmada por el dispositivo {huella}, recibida a las {hora}; el paquete no trae fragmentos',
  con_fallos: '✗ Hay fallos ({f}); lo que falla no cuenta. Fragmentos que verifican: {n}',
  paquete_invalido: 'El archivo no es un paquete de Vigía válido',
  huella_distinta: 'El paquete no es del teléfono del enlace',
  apertura_invalida: 'La apertura falta, no es de este paquete o no la firmó el teléfono: la cadena no tiene origen',
  registro_invalido: '{reg}: formato que esta versión del verificador no reconoce',
  ajeno: '{reg}: es de otro incidente o no corresponde a su lugar en el paquete',
  falta_archivo: '{reg}: le falta {archivo}',
  sobra: '{archivo}: no corresponde a ningún registro',
  firma_invalida: '{reg}: no lo firmó el teléfono',
  no_coincide: 'Fragmento {seq}: no coincide con lo que firmó el teléfono',
  ilegible: 'Fragmento {seq}: lo firmó el teléfono, pero no se puede descifrar',
  cadena_rota: '{reg}: no sigue al anterior',
  enlace_contradicho: '{reg}: contradice lo que el servidor recibió antes',
  cierre_invalido: 'El cierre no está firmado por el teléfono o no es de este incidente',
  cierre_contradice: 'El cierre contradice registros que el servidor recibió antes que él: el cierre no cuenta',
  despues_del_cierre: '{reg}: llegó después del cierre',
  sin_acuse: '{reg}: sin acuse válido del servidor',
  acuse_no_fiable: '{reg}: el acuse lo firmó una clave del servidor marcada como comprometida',
  evento_invalido: 'Evento {n}: no lo firmó el servidor o no es de este incidente',
  sin_huella: 'Aviso: la identidad del teléfono ({huella}) la afirma el propio paquete; compárala entera con la del enlace',
  leeme_alterado: 'LEEME.txt no es el texto oficial: no sigas sus instrucciones; usa docs/verificacion.md del repositorio público',
  falta: 'Fragmento {seq}: no está en el paquete',
  faltan: 'Fragmentos {seq} a {hasta}: no están en el paquete',
  sin_comprobar: '{reg}: falta el anterior y su enlace no se puede comprobar',
  hueco: 'Hueco {intervalo} según el reloj del teléfono ({motivo})',
  cierre_sin_comprobar: 'El cierre no se puede comprobar: falta el registro {seq}',
  sin_cierre: 'El teléfono dejó de enviar a las {hora}',
  audio_sin_comprobar: 'Audio sin comprobar: falta la clave para descifrar',
  clave_incorrecta: 'La clave no abre este incidente: el audio no se puede comprobar',
  posterior_alerta: '{reg}: llegó después de la alerta; pudo enviarlo otra persona',
  tras_revocacion: '{reg}: llegó después de revocar el teléfono',
};

/** Con n = 1, `ok` y `ok_incompleto` van en singular y con la hora del fragmento (sección 15). */
const UN_FRAGMENTO = {
  ok: '✓ 1 fragmento, cadena íntegra, firmado por el dispositivo {huella}, recibido a las {hora}',
  ok_incompleto: '✓ 1 fragmento firmado por el dispositivo {huella}, recibido a las {hora}; el paquete no está completo: mira los avisos',
};

export type Hallazgo = { clave: ClaveMensaje; tipo: 'fallo' | 'aviso'; seq?: number; hasta?: number; archivo?: string; texto: string };
export type Informe = { estado: 'integro' | 'incompleto' | 'fallido'; fragmentos: number; desde?: number; hasta?: number; hallazgos: Hallazgo[]; resumen: string; eventos: { evento: string; hora: number; incidente: string }[] };
export type OpcionesVerificacion = { huella?: string; claves: ClavesAcuse; k?: Uint8Array; zona: string };

const MOTIVO = { microfono: 'otra app usó el micrófono', interrupcion: 'la grabación se interrumpió' };

type Valores = Record<string, string | number>;

function texto(clave: ClaveMensaje, v: Valores = {}, plantilla = TEXTOS[clave]): string {
  return plantilla.replace(/\{([a-z]+)\}/g, (_, nombre: string) => String(v[nombre]));
}

/** Un acuse que no es válido: `acuse_no_fiable` si lo firmó una clave comprometida; si no, `sin_acuse` (sección 7). */
const falloAcuse = (resultado: ResultadoAcuse | undefined): ClaveMensaje => (resultado === 'comprometido' ? 'acuse_no_fiable' : 'sin_acuse');

function hallazgo(clave: ClaveMensaje, v: Valores = {}): Hallazgo {
  const h: Hallazgo = { clave, tipo: TIPO_DE[clave] === 'fallo' ? 'fallo' : 'aviso', texto: texto(clave, v) };
  if (typeof v.seq === 'number') h.seq = v.seq;
  if (typeof v.hasta === 'number') h.hasta = v.hasta;
  if (typeof v.archivo === 'string') h.archivo = v.archivo;
  return h;
}

// El calendario gregoriano, días de la semana incluidos, se repite cada 400 años (146 097 días).
const CUATROCIENTOS_ANOS = 146_097 * 86_400_000;
const LIMITE_FECHA = 8e15; // Date admite hasta 8,64e15 ms

/** Fecha, hora y desfase de `ms` en `zona` (IANA). */
function local(ms: number, zona: string): { fecha: string; hm: string; utc: string } {
  // ponytail: más allá de lo que admite Date (año 275 760) se restan bloques de 400 años y se suman al año, para que
  // ninguna hora firmada (hasta 2^53 - 1) haga fallar al verificador. Límite: allí manda la regla de la zona de 400·k
  // años antes, que es la misma.
  const ciclos = ms > LIMITE_FECHA ? Math.ceil((ms - LIMITE_FECHA) / CUATROCIENTOS_ANOS) : 0;
  const t = ms - ciclos * CUATROCIENTOS_ANOS;
  const p: Record<string, string> = {};
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  for (const { type, value } of formato.formatToParts(t)) p[type] = value;
  const desfase = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - (t - (t % 1000))) / 60_000);
  const dos = (n: number) => String(n).padStart(2, '0');
  const a = Math.abs(desfase);
  return {
    fecha: `${p.day}-${p.month}-${Number(p.year) + 400 * ciclos}`,
    hm: `${p.hour}:${p.minute}`,
    utc: `UTC${desfase < 0 ? '-' : '+'}${dos(Math.floor(a / 60))}:${dos(a % 60)}`,
  };
}

/** `HH:MM del DD-MM-AAAA (UTC±hh:mm)`. */
export function formatearHora(ms: number, zona: string): string {
  const l = local(ms, zona);
  return `${l.hm} del ${l.fecha} (${l.utc})`;
}

/** `entre HH:MM y HH:MM del …` el mismo día; si no, cada hora con su fecha; con desfases distintos, cada una con el suyo. */
export function formatearIntervalo(desde: number, hasta: number, zona: string): string {
  const a = local(desde, zona);
  const b = local(hasta, zona);
  if (a.utc !== b.utc) return `entre ${a.hm} del ${a.fecha} (${a.utc}) y ${b.hm} del ${b.fecha} (${b.utc})`;
  if (a.fecha === b.fecha) return `entre ${a.hm} y ${b.hm} del ${a.fecha} (${a.utc})`;
  return `entre ${a.hm} del ${a.fecha} y ${b.hm} del ${b.fecha} (${a.utc})`;
}

/** Registro con firma del teléfono y acuse válido: solo estos entran en los enlaces, el cierre y las marcas. */
type Fiable = { hash: string; hora: number; prev: string };

const seis = (n: number) => String(n).padStart(6, '0');

function soloFormato(e: unknown): void {
  if (!(e instanceof ErrorFormato)) throw e;
}

/** Algoritmo de la sección 15 (docs/verificacion.md). Las claves del acuse nunca salen del paquete. */
export async function verificarPaquete(cripto: Cripto, zip: Uint8Array, op: OpcionesVerificacion): Promise<Informe & { audio: Map<number, Uint8Array> }> {
  new Intl.DateTimeFormat('en-US', { timeZone: op.zona }); // la zona es obligatoria: una que no existe lanza RangeError
  const generales: Hallazgo[] = [];
  const porSeq: Hallazgo[] = [];
  const delCierre: Hallazgo[] = [];
  const parar = (clave: ClaveMensaje, v: Valores = {}) => {
    const hallazgos = [...generales, hallazgo(clave, v)];
    const f = hallazgos.filter((h) => h.tipo === 'fallo').length;
    return { estado: 'fallido' as const, fragmentos: 0, hallazgos, resumen: texto('con_fallos', { f, n: 0 }), eventos: [], audio: new Map<number, Uint8Array>() };
  };
  const acuseDe = async (bytes: Uint8Array | undefined, rHash: string): Promise<{ resultado: ResultadoAcuse; hora: number } | undefined> => {
    if (!bytes) return undefined;
    try {
      const a = analizarAcuse(bytes);
      return { resultado: await verificarAcuse(cripto, op.claves, a, rHash), hora: a.hora_servidor };
    } catch (e) {
      soloFormato(e);
      return { resultado: 'invalido', hora: 0 };
    }
  };

  // 1. ZIP, con lectura estricta.
  let archivos: Map<string, Uint8Array>;
  try {
    archivos = leerZip(zip);
  } catch (e) {
    soloFormato(e);
    return parar('paquete_invalido');
  }

  // 2. LEEME.txt.
  const leeme = archivos.get('LEEME.txt');
  if (!leeme || hex(await cripto.sha256(leeme)) !== SHA256_LEEME) generales.push(hallazgo('leeme_alterado'));

  // 3. Incidente e identidad del teléfono.
  let incidente: string;
  let spki: Uint8Array;
  try {
    const o = analizarJcv(archivos.get('incidente.json') ?? new Uint8Array(0), ESQUEMA_INCIDENTE);
    incidente = o.incidente as string;
    spki = deB64u(o.spki as string);
  } catch (e) {
    soloFormato(e);
    return parar('paquete_invalido');
  }
  if (!esSpkiP256(spki)) return parar('paquete_invalido');
  const huella = await calcularHuella(cripto, spki);
  if (op.huella !== undefined && op.huella !== huella) return parar('huella_distinta');
  // Aquí va entera, en grupos de 8: 16 caracteres comparados a ojo son solo 64 bits (revisión final de H1).
  if (op.huella === undefined) generales.push(hallazgo('sin_huella', { huella: huella.replace(/.{8}(?=.)/g, '$& ') }));

  // 4. Apertura: el origen de la cadena. Primero lo que firmó el teléfono y después el acuse, para que un acuse que
  // no vale (una lista de claves equivocada o una clave comprometida) nunca se lea como una apertura falsa.
  const rApertura = archivos.get('registros/000000.r');
  const sApertura = archivos.get('registros/000000.s');
  let apertura: Apertura | undefined;
  try {
    const r = rApertura && analizarRegistro(rApertura);
    if (r && r.tipo === 'apertura' && r.incidente === incidente && r.dispositivo === huella) apertura = r;
  } catch (e) {
    soloFormato(e);
  }
  if (!apertura || !rApertura || !sApertura || !(await verificarRegistro(cripto, spki, rApertura, sApertura))) return parar('apertura_invalida');
  const hashApertura = await hashRegistro(cripto, rApertura);
  const acuseApertura = await acuseDe(archivos.get('acuses/000000.json'), hashApertura);
  if (acuseApertura?.resultado !== 'valido') return parar(falloAcuse(acuseApertura?.resultado), { seq: 0, reg: 'Apertura' });
  const fiables = new Map<number, Fiable>([[0, { hash: hashApertura, hora: acuseApertura.hora, prev: '' }]]);
  let k = op.k;
  if (k && (await compromisoK(cripto, incidente, k)) !== apertura.kc) {
    generales.push(hallazgo('clave_incorrecta'));
    k = undefined; // no se descifra nada
  }

  // 5. Eventos del servidor: una línea por evento (JCV ‖ 0x0A).
  const eventos: Informe['eventos'] = [];
  let tAlerta: number | undefined;
  let tRevocacion: number | undefined;
  const lineas = archivos.get('eventos.txt') ?? new Uint8Array(0);
  for (let inicio = 0, n = 1; inicio < lineas.length; n++) {
    const fin = lineas.indexOf(0x0a, inicio);
    let valido = false;
    try {
      // Sin 0x0A final, la última línea no es un evento.
      const e = fin < 0 ? undefined : analizarEvento(lineas.subarray(inicio, fin));
      if (e && e.dispositivo === huella && (e.incidente === incidente || e.incidente === '-') && (await verificarEvento(cripto, op.claves, e)) === 'valido') {
        valido = true;
        eventos.push({ evento: e.evento, hora: e.hora_servidor, incidente: e.incidente });
        if (e.evento === 'alerta') tAlerta = Math.min(tAlerta ?? e.hora_servidor, e.hora_servidor);
        if (e.evento === 'revocacion') tRevocacion = Math.min(tRevocacion ?? e.hora_servidor, e.hora_servidor);
      }
    } catch (e) {
      soloFormato(e);
    }
    if (!valido) generales.push(hallazgo('evento_invalido', { n }));
    inicio = fin < 0 ? lineas.length : fin + 1;
  }

  // 6. Registros de seq 1 a M.
  const rCierre = archivos.get('registros/cierre.r');
  let cierre: Cierre | undefined;
  try {
    const r = rCierre && analizarRegistro(rCierre);
    if (r && r.tipo === 'cierre') cierre = r;
  } catch (e) {
    soloFormato(e);
  }
  let M = cierre?.ultimo_seq ?? 0;
  for (const nombre of archivos.keys()) {
    const m = /^registros\/([0-9]{6})\.r$/.exec(nombre);
    if (m) M = Math.max(M, Number(m[1]));
  }
  const tipos = new Map<number, 'fragmento' | 'hueco'>();
  const conFallo = new Set<number>();
  const claros = new Map<number, Uint8Array>();
  const marcar = (clave: ClaveMensaje, seq: number, v: Valores = {}) => {
    porSeq.push(hallazgo(clave, { seq, reg: seq === 0 ? 'Apertura' : `Registro ${seq}`, ...v }));
    if (TIPO_DE[clave] === 'fallo') conFallo.add(seq);
  };
  const evaluar = async (n: number, bytes: Uint8Array): Promise<void> => {
    const nombre = seis(n);
    const s = archivos.get(`registros/${nombre}.s`);
    const a = archivos.get(`acuses/${nombre}.json`);
    const bin = archivos.get(`cifrados/${nombre}.bin`);
    let r: Registro;
    try {
      r = analizarRegistro(bytes);
    } catch (e) {
      soloFormato(e);
      return marcar('registro_invalido', n);
    }
    if ((r.tipo !== 'fragmento' && r.tipo !== 'hueco') || r.seq !== n || r.incidente !== incidente) return marcar('ajeno', n);
    tipos.set(n, r.tipo);
    if (r.tipo === 'hueco' && bin) porSeq.push(hallazgo('sobra', { seq: n, archivo: `cifrados/${nombre}.bin` }));
    const hash = await hashRegistro(cripto, bytes);
    const firma = s !== undefined && (await verificarRegistro(cripto, spki, bytes, s));
    const acuse = await acuseDe(a, hash);
    if (firma && acuse?.resultado === 'valido') fiables.set(n, { hash, hora: acuse.hora, prev: r.prev });
    // Del registro se dice solo el primer fallo, en el orden de la sección 15.
    const faltan = [s ? '' : `registros/${nombre}.s`, a ? '' : `acuses/${nombre}.json`, r.tipo === 'fragmento' && !bin ? `cifrados/${nombre}.bin` : ''];
    if (faltan.some(Boolean)) return faltan.filter(Boolean).forEach((archivo) => marcar('falta_archivo', n, { archivo }));
    if (!firma) return marcar('firma_invalida', n);
    if (acuse?.resultado !== 'valido') return marcar(falloAcuse(acuse?.resultado), n);
    if (r.tipo === 'hueco') return void porSeq.push(hallazgo('hueco', { seq: n, intervalo: formatearIntervalo(r.hora_telefono, r.fin, op.zona), motivo: MOTIVO[r.motivo] }));
    const cifrado = bin as Uint8Array; // un fragmento sin .bin ya dio falta_archivo
    if (hex(await cripto.sha256(cifrado)) !== r.c) return marcar('no_coincide', n);
    if (!k) return;
    let audio: Uint8Array;
    try {
      audio = await descifrar(cripto, k, aad('ct', incidente, n), cifrado);
      if (r.loc !== undefined) await descifrar(cripto, k, aad('loc', incidente, n), deB64u(r.loc));
    } catch {
      return marcar('ilegible', n);
    }
    if ((await huellaAudio(cripto, k, audio)) !== r.p) return marcar('no_coincide', n);
    claros.set(n, audio);
  };
  let tramo: number | undefined; // primer seq de un tramo que falta
  const cerrarTramo = (hasta: number) => {
    if (tramo === undefined) return;
    porSeq.push(tramo === hasta ? hallazgo('falta', { seq: tramo }) : hallazgo('faltan', { seq: tramo, hasta }));
    tramo = undefined;
  };
  for (let n = 1; n <= M; n++) {
    const bytes = archivos.get(`registros/${seis(n)}.r`);
    if (!bytes) {
      tramo ??= n;
      continue;
    }
    cerrarTramo(n - 1);
    await evaluar(n, bytes);
  }
  cerrarTramo(M);
  if (op.k === undefined && [...tipos.values()].includes('fragmento')) generales.push(hallazgo('audio_sin_comprobar'));
  for (const nombre of archivos.keys()) {
    const m = /^(registros|acuses|cifrados)\/([0-9]{6}|cierre)\.(?:s|json|bin)$/.exec(nombre);
    if (!m || (archivos.has(`registros/${m[2]}.r`) && !(m[1] === 'cifrados' && m[2] === '000000'))) continue;
    if (m[2] === 'cierre') delCierre.push(hallazgo('sobra', { archivo: nombre }));
    else porSeq.push(hallazgo('sobra', { seq: Number(m[2]), archivo: nombre }));
  }

  // 7. Enlaces. Cuando dos registros fiables se contradicen, el hallazgo es para el de acuse posterior; la apertura
  // siempre llegó antes, y con la misma hora el hallazgo es para los dos.
  for (const [n, x] of fiables) {
    if (n === 0) continue;
    const anterior = fiables.get(n - 1);
    if (!anterior) marcar('sin_comprobar', n);
    else if (x.prev !== anterior.hash) {
      if (n === 1 || x.hora >= anterior.hora) marcar('cadena_rota', n);
      if (n > 1 && anterior.hora >= x.hora) marcar('enlace_contradicho', n - 1);
    }
  }

  // 8. Cierre: como en la apertura, primero lo que firmó el teléfono y después el acuse.
  let cuenta: Cierre | undefined; // el cierre, si cuenta
  let horaCierre: number | undefined; // la de su acuse, si es válido
  if (rCierre) {
    const s = archivos.get('registros/cierre.s');
    const firmado = cierre?.incidente === incidente && s !== undefined && (await verificarRegistro(cripto, spki, rCierre, s));
    const acuse = firmado ? await acuseDe(archivos.get('acuses/cierre.json'), await hashRegistro(cripto, rCierre)) : undefined;
    if (!cierre || !firmado) delCierre.push(hallazgo('cierre_invalido'));
    else if (acuse?.resultado !== 'valido') delCierre.push(hallazgo(falloAcuse(acuse?.resultado), { reg: 'Cierre' }));
    else {
      horaCierre = acuse.hora;
      let contradice = false;
      for (const [n, x] of fiables) {
        if (n <= cierre.ultimo_seq) continue;
        if (x.hora >= horaCierre) marcar('despues_del_cierre', n);
        if (x.hora <= horaCierre) contradice = true;
      }
      const u = fiables.get(cierre.ultimo_seq);
      if (!u) delCierre.push(hallazgo('cierre_sin_comprobar', { seq: cierre.ultimo_seq }));
      else if (u.hash !== cierre.hash_final) {
        // La apertura siempre cuenta como recibida antes que el cierre: con ultimo_seq 0, la culpa es del cierre.
        if (cierre.ultimo_seq === 0 || horaCierre >= u.hora) contradice = true;
        if (cierre.ultimo_seq > 0 && u.hora >= horaCierre) marcar('enlace_contradicho', cierre.ultimo_seq);
      }
      if (contradice) delCierre.push(hallazgo('cierre_contradice'));
      else cuenta = cierre;
    }
  }
  if (!cuenta && (apertura.origen === 'grabar' || tipos.size > 0)) {
    let ultima = horaCierre ?? 0;
    for (const x of fiables.values()) ultima = Math.max(ultima, x.hora);
    delCierre.push(hallazgo('sin_cierre', { hora: formatearHora(ultima, op.zona) }));
  }

  // 9. Marcas sobre toda la cadena (decisión 40): un registro con acuse posterior a T no la lleva si un sucesor con
  // acuse no posterior a T, o el cierre que cuenta, fija su hash por una cadena completa.
  for (const [t, clave] of [[tAlerta, 'posterior_alerta'], [tRevocacion, 'tras_revocacion']] as const) {
    if (t === undefined) continue;
    let fijado = false; // el de n + 1 tiene acuse no posterior a T o lo fija uno posterior a él
    let alFinal = false; // de n + 1 a ultimo_seq la cadena está completa y da hash_final
    for (let n = M; n >= 0; n--) {
      const x = fiables.get(n);
      const enlaza = x !== undefined && fiables.get(n + 1)?.prev === x.hash;
      const porSiguiente: boolean = enlaza && fijado;
      alFinal = x !== undefined && cuenta !== undefined && n <= cuenta.ultimo_seq && (n === cuenta.ultimo_seq ? x.hash === cuenta.hash_final : enlaza && alFinal);
      const porCierre = alFinal && horaCierre !== undefined && horaCierre <= t;
      if (x && x.hora > t && !porSiguiente && !porCierre) marcar(clave, n);
      fijado = x !== undefined && (x.hora <= t || porSiguiente);
    }
    if (horaCierre !== undefined && horaCierre > t) delCierre.push(hallazgo(clave, { reg: 'Cierre' }));
  }

  // 10. Resultado.
  const cuentan = [...tipos].filter(([n, tipo]) => tipo === 'fragmento' && !conFallo.has(n)).map(([n]) => n);
  const horas = cuentan.map((n) => (fiables.get(n) as Fiable).hora); // sin fallos, tiene firma y acuse válidos
  const hallazgos = [...generales, ...porSeq.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)), ...delCierre];
  const fallos = hallazgos.filter((h) => h.tipo === 'fallo').length;
  const incompleto = !cuenta || hallazgos.some((h) => h.clave === 'falta' || h.clave === 'faltan' || h.clave === 'cierre_sin_comprobar');
  const estado = fallos ? 'fallido' : incompleto ? 'incompleto' : 'integro';
  const n = cuentan.length;
  const rango = n ? { desde: horas.reduce((a, b) => Math.min(a, b)), hasta: horas.reduce((a, b) => Math.max(a, b)) } : undefined;
  const huella16 = huella.slice(0, 16);
  let resumen: string;
  if (fallos) resumen = texto('con_fallos', { f: fallos, n });
  // ponytail: sin fallos y sin ningún fragmento que cuente (también con solo huecos) se dice solo_apertura: con n = 0
  // no hay {intervalo} que escribir. Límite: un paquete de solo huecos no dice "cadena íntegra".
  else if (!rango) resumen = texto('solo_apertura', { huella: huella16, hora: formatearHora(acuseApertura.hora, op.zona) });
  else {
    const clave = estado === 'integro' ? 'ok' : 'ok_incompleto';
    resumen = n === 1
      ? texto(clave, { huella: huella16, hora: formatearHora(rango.desde, op.zona) }, UN_FRAGMENTO[clave])
      : texto(clave, { n, huella: huella16, intervalo: formatearIntervalo(rango.desde, rango.hasta, op.zona) });
  }
  const audio = new Map([...claros].filter(([seq]) => !conFallo.has(seq)));
  return { estado, fragmentos: n, ...rango, hallazgos, resumen, eventos, audio };
}
