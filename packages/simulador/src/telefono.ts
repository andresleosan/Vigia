import {
  aad, analizarAcuse, analizarJcv, b64u, CABECERA, cifrar, CODIGOS, compromisoK, crearPaquete, cuerpoAlta,
  cuerpoCierre, cuerpoIncidente, deB64u, desempaquetarSobre, empaquetarSobre, ErrorFormato, firmarPeticion,
  firmarRegistro, hashRegistro, hex, huella, huellaAudio, iguales, nuevoId, PATRON_ID, RUTA, rutaCierre,
  rutaFragmento, rutaIncidente, verificarAcuse,
  type ClavesAcuse, type Cripto, type DatosPaquete, type Esquema, type Registro,
} from '@vigia/shared';

/** fetch, o una función que lanza para simular que no hay red. */
export type Red = (url: string, init: RequestInit) => Promise<Response>;

export type OpcionesTelefono = {
  base: string; // origen del Worker, sin barra final
  red: Red;
  reloj: () => number; // reloj de pared del teléfono, sin corregir: puede ir desfasado (FIR-03)
  claves: ClavesAcuse; // lista fijada del entorno: solo cuenta un acuse que verifica con ella (ACU-02)
  cripto: Cripto;
};

type Par = { privada: CryptoKey; spki: Uint8Array };
// Un sobre se reenvía igual y con el mismo idPeticion hasta tener un acuse válido (sección 9).
type Elemento = { id: string; metodo: string; ruta: string; tipo: string; cuerpo: Uint8Array; rHash: string; acuse?: Uint8Array };
type Respuesta = { cabeceras: Headers; cuerpo: Uint8Array };

const TIPO_JSON = 'application/json';
const TIPO_SOBRE = 'application/vnd.vigia.sobre';
// ponytail: cada fragmento avanza 4 s exactos de hora_telefono; el corte real da 62 o 63 tramas (3,968 o 4,032 s).
const DURACION_MS = 4000;
const ERROR: Esquema = { codigo: { tipo: 'cadena', patron: new RegExp(`^(?:${CODIGOS.join('|')})$`) } };
const ALTA: Esquema = { dispositivo: { tipo: 'cadena', patron: PATRON_ID } };
const ESTADO: Esquema = {
  cerrado: { tipo: 'entero', min: 0, max: 1 },
  ultimo_recibido: { tipo: 'entero', min: 0, max: 999_999 },
  v: { tipo: 'entero', min: 1, max: 1 },
};

async function nuevoPar(): Promise<Par> {
  const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])) as CryptoKeyPair;
  return { privada: par.privateKey, spki: new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey)) };
}

/** `codigo` de la lista cerrada, o "?" si el cuerpo no es un error de Vigía (una página de la plataforma). */
function codigoDe(cuerpo: Uint8Array): string {
  try {
    return analizarJcv(cuerpo, ERROR).codigo as string;
  } catch (e) {
    if (e instanceof ErrorFormato) return '?';
    throw e;
  }
}

/** Teléfono de pruebas (solo shared): graba sin red, sube con reintentos, lee con la clave de lectura y arma el paquete. */
export class TelefonoSimulado {
  red: Red;
  readonly historial: string[] = []; // "MÉTODO ruta estado [codigo]" de cada respuesta
  private readonly op: OpcionesTelefono;
  private readonly firma: Par; // alta, escrituras y órdenes
  private readonly lectura: Par; // los GET (decisión 60)
  private readonly idAlta: string;
  private readonly cola: Elemento[] = [];
  private dispositivo: string | undefined;
  private desfase = 0;

  private constructor(op: OpcionesTelefono, firma: Par, lectura: Par) {
    this.op = op;
    this.red = op.red;
    this.firma = firma;
    this.lectura = lectura;
    this.idAlta = nuevoId(op.cripto);
  }

  static async crear(op: OpcionesTelefono): Promise<TelefonoSimulado> {
    return new TelefonoSimulado(op, await nuevoPar(), await nuevoPar());
  }

  /** Graba sin red una sesión entera (apertura, un fragmento por audio y cierre) y la deja en la cola. */
  async grabar(audios: readonly Uint8Array[]): Promise<{ incidente: string; k: Uint8Array }> {
    const { cripto } = this.op;
    const k = cripto.aleatorio(32);
    const incidente = nuevoId(cripto);
    // La grabación acaba ahora: la apertura es de hace audios.length × 4 s según el reloj del teléfono.
    const inicio = this.op.reloj() - audios.length * DURACION_MS;
    let prev = await this.encolar({
      v: 1, tipo: 'apertura', incidente, seq: 0, hora_telefono: inicio, country_code: 'VE',
      dispositivo: await huella(cripto, this.firma.spki), origen: 'grabar', kc: await compromisoK(cripto, incidente, k),
    });
    for (const [i, audio] of audios.entries()) {
      const seq = i + 1;
      const cifrado = await cifrar(cripto, k, aad('ct', incidente, seq), audio);
      prev = await this.encolar({
        v: 1, tipo: 'fragmento', incidente, seq, hora_telefono: inicio + i * DURACION_MS,
        p: await huellaAudio(cripto, k, audio), c: hex(await cripto.sha256(cifrado)), prev,
      }, cifrado);
    }
    await this.encolar({ v: 1, tipo: 'cierre', incidente, hora_telefono: this.op.reloj(), ultimo_seq: audios.length, hash_final: prev });
    return { incidente, k };
  }

  /** Sube la cola en orden y se para en el primer fallo, que devuelve ("red", "429 tope_altas"…); null si todo tiene acuse. */
  async subir(): Promise<string | null> {
    if (this.dispositivo === undefined) {
      const cuerpo = cuerpoAlta({ lectura: b64u(this.lectura.spki), publica: b64u(this.firma.spki) });
      const r = await this.enviar('POST', RUTA.dispositivos, TIPO_JSON, cuerpo, this.idAlta, this.firma.privada);
      if (typeof r === 'string') return r;
      this.dispositivo = analizarJcv(r.cuerpo, ALTA).dispositivo as string;
    }
    // En orden: un fragmento nunca sale antes del acuse de su apertura, que va delante en la cola.
    for (const e of this.cola) {
      if (e.acuse) continue;
      const r = await this.enviar(e.metodo, e.ruta, e.tipo, e.cuerpo, e.id, this.firma.privada);
      if (typeof r === 'string') return r;
      if (!(await this.acuseValido(r.cuerpo, e.rHash))) return 'acuse no válido';
      e.acuse = r.cuerpo;
    }
    return null;
  }

  /** Reenvía lo ya acusado, como si se hubieran perdido las respuestas: cada una tiene que ser el mismo acuse. */
  async reenviar(): Promise<void> {
    for (const e of this.cola) {
      if (!e.acuse) continue;
      const r = await this.enviar(e.metodo, e.ruta, e.tipo, e.cuerpo, e.id, this.firma.privada);
      if (typeof r === 'string' || !iguales(r.cuerpo, e.acuse)) {
        throw new Error(`${e.metodo} ${e.ruta}: ${typeof r === 'string' ? r : 'otro acuse'}`);
      }
    }
  }

  pendientes(): number {
    return this.cola.filter((e) => !e.acuse).length;
  }

  /** Lee el incidente del servidor con la clave de lectura y arma el paquete (sección 14). */
  async paquete(incidente: string): Promise<Uint8Array> {
    const estado = analizarJcv((await this.leer(rutaIncidente(incidente))).cuerpo, ESTADO);
    const rutas: [number | 'cierre', string][] = [];
    for (let seq = 0; seq <= (estado.ultimo_recibido as number); seq++) rutas.push([seq, rutaFragmento(incidente, seq)]);
    if (estado.cerrado === 1) rutas.push(['cierre', rutaCierre(incidente)]);
    const registros: DatosPaquete['registros'][number][] = [];
    for (const [seq, ruta] of rutas) {
      // ponytail: un seq que falta en el servidor hace fallar el paquete; aquí nunca falta ninguno.
      const r = await this.leer(ruta);
      registros.push({ seq, ...desempaquetarSobre(r.cuerpo), acuse: deB64u(r.cabeceras.get(CABECERA.acuse) ?? '') });
    }
    return crearPaquete({ incidente, spki: this.firma.spki, registros });
  }

  /** Firma r, arma el cuerpo de su ruta y lo pone a la cola; devuelve hex(hash(r)) para el `prev` siguiente. */
  private async encolar(r: Registro, cifrado: Uint8Array = new Uint8Array(0)): Promise<string> {
    const { cripto } = this.op;
    const { bytes, s } = await firmarRegistro(cripto, this.firma.privada, r);
    const json = { r: b64u(bytes), s: b64u(s) };
    const destino = r.tipo === 'apertura'
      ? { metodo: 'POST', ruta: RUTA.incidentes, tipo: TIPO_JSON, cuerpo: cuerpoIncidente({ envolturas: [], ...json }) }
      : r.tipo === 'cierre'
        ? { metodo: 'POST', ruta: rutaCierre(r.incidente), tipo: TIPO_JSON, cuerpo: cuerpoCierre(json) }
        : { metodo: 'PUT', ruta: rutaFragmento(r.incidente, r.seq), tipo: TIPO_SOBRE, cuerpo: empaquetarSobre({ r: bytes, s, cifrado }) };
    const rHash = await hashRegistro(cripto, bytes);
    this.cola.push({ id: nuevoId(cripto), rHash, ...destino });
    return rHash;
  }

  private async leer(ruta: string): Promise<Respuesta> {
    const r = await this.enviar('GET', ruta, null, new Uint8Array(0), nuevoId(this.op.cripto), this.lectura.privada);
    if (typeof r === 'string') throw new Error(`GET ${ruta}: ${r}`);
    return r;
  }

  private async acuseValido(bytes: Uint8Array, rHash: string): Promise<boolean> {
    try {
      return (await verificarAcuse(this.op.cripto, this.op.claves, analizarAcuse(bytes), rHash)) === 'valido';
    } catch (e) {
      if (e instanceof ErrorFormato) return false;
      throw e;
    }
  }

  // Firma y envía. Un 401 hora corrige el desfase y se reintenta al momento, una sola vez (FIR-03); r no se toca.
  private async enviar(metodo: string, ruta: string, tipo: string | null, cuerpo: Uint8Array, idPeticion: string, privada: CryptoKey): Promise<Respuesta | string> {
    for (let intento = 1; ; intento++) {
      const hora = this.op.reloj() + this.desfase;
      const idDispositivo = this.dispositivo ?? 'registro';
      const cabeceras: Record<string, string> = {
        [CABECERA.hora]: String(hora),
        [CABECERA.peticion]: idPeticion,
        [CABECERA.firma]: await firmarPeticion(this.op.cripto, privada, { metodo, ruta, hora, idPeticion, idDispositivo, cuerpo }),
      };
      if (this.dispositivo !== undefined) cabeceras[CABECERA.dispositivo] = this.dispositivo;
      if (tipo !== null) cabeceras['Content-Type'] = tipo;
      let res: Response;
      try {
        res = await this.red(this.op.base + ruta, { method: metodo, headers: cabeceras, body: tipo === null ? undefined : cuerpo as Uint8Array<ArrayBuffer> });
      } catch {
        return 'red';
      }
      const r = { cabeceras: res.headers, cuerpo: new Uint8Array(await res.arrayBuffer()) };
      const resultado = res.ok ? String(res.status) : `${res.status} ${codigoDe(r.cuerpo)}`;
      this.historial.push(`${metodo} ${ruta} ${resultado}`);
      if (res.ok) return r;
      const horaServidor = Number(res.headers.get(CABECERA.horaServidor) ?? NaN);
      if (resultado !== '401 hora' || intento > 1 || !Number.isSafeInteger(horaServidor)) return resultado;
      this.desfase = horaServidor - this.op.reloj();
    }
  }
}
