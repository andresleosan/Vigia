import {
  analizarCuerpoAlta, analizarCuerpoCierre, analizarCuerpoIncidente, analizarRegistro, b64u, CABECERA, codificarJcv,
  criptoWebCrypto, deB64u, desempaquetarSobre, empaquetarSobre, firmarAcuse, hashRegistro, leerZip, utf8,
  verificarPeticion, type ClavesAcuse, type Sobre,
} from '@vigia/shared';
import { describe, expect, it } from 'vitest';
import { TelefonoSimulado, type Red } from '../src/telefono.ts';

const cripto = criptoWebCrypto();
const AHORA = 1_760_000_000_000; // reloj del servidor falso
const ID_DISPOSITIVO = 'dispositivoDePrueba001';
const parAcuse = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])) as CryptoKeyPair;
const CLAVES: ClavesAcuse = [{ kid: 'prueba_1', spki: new Uint8Array(await crypto.subtle.exportKey('spki', parAcuse.publicKey)), estado: 'activa', desde: 0 }];
const AUDIOS = [utf8('trozo-1'), utf8('trozo-2'), utf8('trozo-3')];
const sinRed: Red = () => Promise.reject(new TypeError('sin red'));

type Recibida = { metodo: string; ruta: string; cabeceras: Headers; cuerpo: Uint8Array };

const respuesta = (estado: number, cuerpo: string | Uint8Array, cabeceras: Record<string, string> = {}) =>
  new Response(cuerpo as string | Uint8Array<ArrayBuffer>, { status: estado, headers: cabeceras });
const error = (estado: number, codigo: string, cabeceras: Record<string, string> = {}) =>
  respuesta(estado, `{"codigo":"${codigo}"}`, cabeceras);

/**
 * Servidor falso con las respuestas de la sección 11: da de alta, acusa cada registro una vez (la repetición
 * devuelve el mismo acuse) y contesta los GET firmados con la clave de lectura. `antes` puede responder primero.
 */
function servidor(antes: (p: Recibida) => Response | undefined = () => undefined) {
  const recibidas: Recibida[] = [];
  const acuses = new Map<string, Uint8Array>(); // hash(r) → acuse
  const guardados = new Map<string, { sobre: Uint8Array; acuse: Uint8Array }>(); // ruta del GET → registro
  let lectura: Uint8Array = new Uint8Array(0);
  const red: Red = async (url, init) => {
    const p: Recibida = { metodo: init.method ?? 'GET', ruta: new URL(url).pathname, cabeceras: new Headers(init.headers), cuerpo: new Uint8Array((init.body ?? new Uint8Array(0)) as Uint8Array) };
    recibidas.push(p);
    const primero = antes(p);
    if (primero) return primero;
    if (p.ruta === '/v1/devices') {
      lectura = deB64u(analizarCuerpoAlta(p.cuerpo).lectura);
      return respuesta(201, `{"dispositivo":"${ID_DISPOSITIVO}"}`);
    }
    if (p.metodo === 'GET') {
      const firmada = { metodo: 'GET', ruta: p.ruta, hora: Number(p.cabeceras.get(CABECERA.hora)), idPeticion: p.cabeceras.get(CABECERA.peticion) ?? '', idDispositivo: ID_DISPOSITIVO, cuerpo: new Uint8Array(0) };
      if (!(await verificarPeticion(cripto, lectura, firmada, p.cabeceras.get(CABECERA.firma) ?? ''))) return error(401, 'firma');
      const g = guardados.get(p.ruta);
      if (g) return respuesta(200, g.sobre, { [CABECERA.acuse]: b64u(g.acuse) });
      const propias = [...guardados.keys()].filter((ruta) => ruta.startsWith(`${p.ruta}/`));
      const seqs = propias.filter((ruta) => ruta.includes('/chunks/')).map((ruta) => Number(ruta.split('/').pop()));
      return respuesta(200, codificarJcv({ cerrado: propias.some((ruta) => ruta.endsWith('/close')) ? 1 : 0, ultimo_recibido: Math.max(...seqs), v: 1 }));
    }
    let sobre: Sobre;
    let ruta = p.ruta;
    if (p.metodo === 'PUT') sobre = desempaquetarSobre(p.cuerpo);
    else {
      const c = p.ruta.endsWith('/close') ? analizarCuerpoCierre(p.cuerpo) : analizarCuerpoIncidente(p.cuerpo);
      sobre = { r: deB64u(c.r), s: deB64u(c.s), cifrado: new Uint8Array(0) };
      if (!p.ruta.endsWith('/close')) ruta = `${p.ruta}/${analizarRegistro(sobre.r).incidente}/chunks/0`;
    }
    const h = await hashRegistro(cripto, sobre.r);
    const repetido = acuses.get(h);
    const acuse = repetido ?? (await firmarAcuse(cripto, parAcuse.privateKey, 'prueba_1', h, AHORA));
    acuses.set(h, acuse);
    guardados.set(ruta, { sobre: empaquetarSobre(sobre), acuse });
    return respuesta(repetido ? 200 : 201, acuse);
  };
  return { red, recibidas, acuses };
}

const telefono = (red: Red, reloj = () => AHORA) =>
  TelefonoSimulado.crear({ base: 'http://api.prueba', red, reloj, claves: CLAVES, cripto });

describe('TelefonoSimulado', () => {
  it('sin red no envía nada ni pierde ningún sobre', async () => {
    const t = await telefono(sinRed);
    await t.grabar(AUDIOS);
    expect(await t.subir()).toBe('red');
    expect(t.pendientes()).toBe(5); // apertura, 3 fragmentos y cierre
    expect(t.historial).toEqual([]);
  });

  it('sube en orden, con el alta delante, y borra cada sobre con su acuse válido', async () => {
    const s = servidor();
    const t = await telefono(s.red);
    await t.grabar(AUDIOS);
    expect(await t.subir()).toBeNull();
    expect(t.pendientes()).toBe(0);
    expect(s.recibidas.map((p) => `${p.metodo} ${p.ruta.replace(/[A-Za-z0-9_-]{22}/, ':id')}`)).toEqual([
      'POST /v1/devices', 'POST /v1/incidents', 'PUT /v1/incidents/:id/chunks/1', 'PUT /v1/incidents/:id/chunks/2',
      'PUT /v1/incidents/:id/chunks/3', 'POST /v1/incidents/:id/close',
    ]);
  });

  it('corrige el desfase con un 401 hora y no toca la hora de r (FIR-03)', async () => {
    const adelanto = 2 * 3_600_000;
    let primera = true;
    const s = servidor(() => {
      if (!primera) return undefined;
      primera = false;
      return error(401, 'hora', { [CABECERA.horaServidor]: String(AHORA) });
    });
    const t = await telefono(s.red, () => AHORA + adelanto);
    await t.grabar(AUDIOS);
    expect(await t.subir()).toBeNull();
    expect(t.historial.slice(0, 2)).toEqual(['POST /v1/devices 401 hora', 'POST /v1/devices 201']);
    expect(s.recibidas.map((p) => Number(p.cabeceras.get(CABECERA.hora)))).toEqual([AHORA + adelanto, ...Array(6).fill(AHORA)]);
    expect(s.recibidas[1].cabeceras.get(CABECERA.peticion)).toBe(s.recibidas[0].cabeceras.get(CABECERA.peticion));
    const apertura = analizarRegistro(deB64u(analizarCuerpoIncidente(s.recibidas[2].cuerpo).r));
    expect(apertura.hora_telefono).toBe(AHORA + adelanto - 3 * 4000);
  });

  it('un segundo 401 hora seguido no se reintenta', async () => {
    const s = servidor(() => error(401, 'hora', { [CABECERA.horaServidor]: String(AHORA) }));
    const t = await telefono(s.red);
    await t.grabar(AUDIOS);
    expect(await t.subir()).toBe('401 hora');
    expect(s.recibidas).toHaveLength(2);
    expect(t.pendientes()).toBe(5);
  });

  it('con 429 tope_altas conserva los sobres y los sube cuando el alta entra (OPS-02)', async () => {
    let tope = true;
    const s = servidor((p) => (tope && p.ruta === '/v1/devices' ? error(429, 'tope_altas', { 'Retry-After': '1800' }) : undefined));
    const t = await telefono(s.red);
    await t.grabar(AUDIOS);
    expect(await t.subir()).toBe('429 tope_altas');
    expect(await t.subir()).toBe('429 tope_altas');
    expect(t.pendientes()).toBe(5);
    tope = false; // la hora UTC siguiente
    expect(await t.subir()).toBeNull();
    expect(t.pendientes()).toBe(0);
    const altas = s.recibidas.filter((p) => p.ruta === '/v1/devices').map((p) => p.cabeceras.get(CABECERA.peticion));
    expect(altas).toHaveLength(3);
    expect(new Set(altas).size).toBe(1); // el mismo idPeticion en cada reintento
  });

  it('un acuse que no verifica no borra la apertura ni deja salir sus fragmentos (ACU-02)', async () => {
    const deOtro = await firmarAcuse(cripto, parAcuse.privateKey, 'prueba_1', '0'.repeat(64), AHORA);
    const s = servidor((p) => (p.ruta === '/v1/incidents' ? respuesta(201, deOtro) : undefined));
    const t = await telefono(s.red);
    await t.grabar(AUDIOS);
    expect(await t.subir()).toBe('acuse no válido');
    expect(t.pendientes()).toBe(5);
    expect(s.recibidas.map((p) => p.ruta)).toEqual(['/v1/devices', '/v1/incidents']);
  });

  it('reenviar repite cada sobre con su idPeticion y falla si el acuse cambia', async () => {
    const s = servidor();
    const t = await telefono(s.red);
    await t.grabar(AUDIOS);
    await t.subir();
    const ids = (desde: number) => s.recibidas.slice(desde, desde + 5).map((p) => p.cabeceras.get(CABECERA.peticion));
    await t.reenviar();
    expect(ids(6)).toEqual(ids(1));
    s.acuses.clear(); // el servidor firmaría otro acuse para lo mismo
    await expect(t.reenviar()).rejects.toThrow('otro acuse');
  });

  it('lee con la clave de lectura y arma el paquete con lo que guardó el servidor', async () => {
    const s = servidor();
    const t = await telefono(s.red);
    const { incidente } = await t.grabar(AUDIOS);
    await t.subir();
    const archivos = leerZip(await t.paquete(incidente));
    expect([...archivos.keys()]).toEqual([
      'LEEME.txt', 'incidente.json',
      'registros/000000.r', 'registros/000000.s', 'registros/000001.r', 'registros/000001.s',
      'registros/000002.r', 'registros/000002.s', 'registros/000003.r', 'registros/000003.s',
      'registros/cierre.r', 'registros/cierre.s',
      'cifrados/000001.bin', 'cifrados/000002.bin', 'cifrados/000003.bin',
      'acuses/000000.json', 'acuses/000001.json', 'acuses/000002.json', 'acuses/000003.json', 'acuses/cierre.json',
    ]);
    expect(s.recibidas.filter((p) => p.metodo === 'GET')).toHaveLength(6); // estado, 0 a 3 y cierre
  });
});
