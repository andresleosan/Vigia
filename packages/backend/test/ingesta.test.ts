import { env } from 'cloudflare:workers';
import { analizarAcuse, b64u, CABECERA, hex, verificarAcuse } from '@vigia/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { TIPO_SOBRE } from '../src/errores.ts';
import { BASE, clavesAcuse, cripto, d1QueFalla, enLaMismaVentana, enviar, peticion, revocar, T, telefonoConAlta } from './ayudas.ts';
import {
  abrir, cadena, cerrar, type ConCifrado, type ConId, firmar, type Incidente, leer, nuevaApertura, nuevoCierre, nuevoFragmento, nuevoHueco, otraFirma, sobre, subir,
} from './cadena.ts';

const n = async (sql: string, ...v: unknown[]) => Number(await env.DB.prepare(sql).bind(...v).first('n'));
const objetos = async (inc: Incidente) => (await env.EVIDENCIA.list({ prefix: `i/${inc.id}/` })).objects.map((o) => o.key);
const filas = (inc: Incidente) => n('SELECT count(*) AS n FROM fragmentos WHERE incidente = ?', inc.id);
const contador = (nombre: string) => n('SELECT coalesce(sum(valor), 0) AS n FROM contadores WHERE nombre = ?', nombre);
const contadores = () => n('SELECT coalesce(sum(valor), 0) AS n FROM contadores');

async function conIncidente(): Promise<{ a: ConId; inc: Incidente }> {
  const a = await telefonoConAlta();
  const inc = await nuevaApertura(a);
  expect((await abrir(a, inc)).status).toBe(201);
  return { a, inc };
}

// Doble de R2 que nunca sobrescribe ni borra: un put a una clave que ya existe falla (foco de revisión 1).
function r2SinSobrescribir(r2: R2Bucket): R2Bucket {
  return new Proxy(r2, {
    get(destino, nombre) {
      if (nombre === 'put') {
        return async (clave: string, valor: Uint8Array, opciones?: R2PutOptions) => {
          if (await destino.head(clave)) throw new Error('sobrescritura');
          return destino.put(clave, valor, opciones);
        };
      }
      if (nombre === 'delete') return () => { throw new Error('borrado'); };
      const v = Reflect.get(destino, nombre);
      return typeof v === 'function' ? v.bind(destino) : v;
    },
  });
}

// Doble de D1 cuyo batch avisa al llegar y espera a que se abra la puerta: deja que otra petición
// escriba entre la lectura del estado y el batch, la carrera que solo decide la condición del batch (punto 9).
function d1ConPuerta(db: D1Database) {
  const llegada = Promise.withResolvers<void>();
  const puerta = Promise.withResolvers<void>();
  const doble = new Proxy(db, {
    get(destino, nombre) {
      if (nombre === 'batch') {
        return async (sentencias: D1PreparedStatement[]) => { llegada.resolve(); await puerta.promise; return destino.batch(sentencias); };
      }
      const v = Reflect.get(destino, nombre);
      return typeof v === 'function' ? v.bind(destino) : v;
    },
  });
  return { db: doble, enBatch: llegada.promise, abrirPuerta: () => puerta.resolve() };
}

describe('PUT /v1/incidents/:id/chunks/:seq (sección 11, "Ingesta del PUT")', () => {
  it('fragmento: 201 con el acuse; un objeto en R2 con su SHA-256, la fila con su acuse y la cuota sumada', async () => {
    const { a, inc } = await conIncidente();
    const [f1] = await cadena(a, inc, 1);
    const r = await subir(a, inc, 1, f1);
    expect([r.status, r.headers.get('Content-Type')]).toEqual([201, 'application/json']);
    const cuerpo = new Uint8Array(await r.arrayBuffer());
    const acuse = analizarAcuse(cuerpo);
    expect(acuse).toMatchObject({ r: f1.hash, hora_servidor: T });
    expect(await verificarAcuse(cripto, clavesAcuse(), acuse, f1.hash)).toBe('valido');
    const c = hex(await cripto.sha256(f1.cifrado));
    const objeto = await env.EVIDENCIA.head(`i/${inc.id}/1/${c}`);
    expect(objeto?.size).toBe(f1.cifrado.length);
    expect(hex(new Uint8Array(objeto!.checksums.sha256!))).toBe(c);
    const fila = await env.DB.prepare('SELECT tipo, c, tamano, acuse, recibido, bifurcacion, tras_revocacion FROM fragmentos WHERE incidente = ? AND seq = 1').bind(inc.id).first<{ acuse: number[] }>();
    expect({ ...fila, acuse: new Uint8Array(fila!.acuse) }).toEqual({ tipo: 'fragmento', c, tamano: f1.cifrado.length, acuse: cuerpo, recibido: T, bifurcacion: 0, tras_revocacion: 0 });
    expect(await n('SELECT bytes_usados AS n FROM dispositivos WHERE id = ?', a.id)).toBe(16_384);
    const leido = await leer(a, `/v1/incidents/${inc.id}/chunks/1`);
    expect([leido.status, leido.headers.get('Content-Type'), leido.headers.get('X-Vigia-Acuse')]).toEqual([200, TIPO_SOBRE, b64u(cuerpo)]);
    expect(new Uint8Array(await leido.arrayBuffer())).toEqual(sobre(f1));
    expect(await (await leer(a, `/v1/incidents/${inc.id}`)).text()).toBe('{"cerrado":0,"ultimo_recibido":1,"v":1}');
  });

  it('hueco: 201 sin objeto en R2 y se lee con el cifrado vacío; hueco con cifrado o fragmento sin él: 400 formato', async () => {
    const { a, inc } = await conIncidente();
    const h1 = await nuevoHueco(a, inc, 1, inc.apertura.hash);
    expect((await subir(a, inc, 1, h1)).status).toBe(201);
    expect(await objetos(inc)).toEqual([]);
    expect(new Uint8Array(await (await leer(a, `/v1/incidents/${inc.id}/chunks/1`)).arrayBuffer())).toEqual(sobre(h1));
    const conCifrado = await subir(a, inc, 2, { ...(await nuevoHueco(a, inc, 2, h1.hash)), cifrado: new Uint8Array(30) });
    const f = await nuevoFragmento(a, inc, 3, inc.apertura.hash);
    const sinCifrado = await subir(a, inc, 3, { ...f, cifrado: new Uint8Array(0) });
    for (const r of [conCifrado, sinCifrado]) expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
  });

  it('firma, c o esquema inválidos: 4xx con su código y nada escrito', async () => {
    const { a, inc } = await conIncidente();
    const b = await telefonoConAlta();
    const [f1] = await cadena(a, inc, 1);
    const firmadoPorB: ConCifrado = { ...f1, s: (await firmar(b, JSON.parse(new TextDecoder().decode(f1.bytes)))).s };
    const casos: [Promise<Response>, number, string][] = [
      [subir(a, inc, 1, firmadoPorB), 404, 'no_existe'], // s inválida sin firma de petición
      [subir(a, inc, 1, firmadoPorB, { firmada: true }), 401, 'firma'], // s inválida, la petición la firma el dueño
      [subir(a, inc, 1, { ...f1, cifrado: f1.cifrado.map((x, i) => (i === 20 ? x ^ 1 : x)) }), 400, 'hash'],
      [subir(a, inc, 2, f1), 400, 'formato'], // la URL no coincide con r
      [subir(a, inc, 1, f1, { cuerpo: sobre(f1).subarray(0, 50) }), 400, 'formato'], // sobre corto
      [subir(a, inc, 1, f1, { cuerpo: Uint8Array.of(0xff, 0xff, ...sobre(f1).subarray(2)) }), 400, 'formato'], // len_r imposible
      [subir(a, inc, 1, { ...inc.apertura, cifrado: new Uint8Array(0) }), 400, 'formato'], // una apertura no va por PUT
      [subir(a, inc, 0, f1), 400, 'formato'], // seq 0 en el PUT
    ];
    for (const [respuesta, estado, codigo] of casos) {
      const r = await respuesta;
      expect([r.status, await r.text()]).toEqual([estado, `{"codigo":"${codigo}"}`]);
    }
    expect([await filas(inc), await objetos(inc), await n('SELECT bytes_usados AS n FROM dispositivos WHERE id = ?', a.id)]).toEqual([0, [], 0]);
  });

  it('el mismo seq con otro c: 409 conflicto y el original intacto', async () => {
    const { a, inc } = await conIncidente();
    const original = await nuevoFragmento(a, inc, 1, inc.apertura.hash);
    const acuse = await (await subir(a, inc, 1, original)).text();
    const otro = await nuevoFragmento(a, inc, 1, inc.apertura.hash, new TextEncoder().encode('otro audio'));
    const r = await subir(a, inc, 1, otro);
    expect([r.status, await r.text()]).toEqual([409, '{"codigo":"conflicto"}']);
    const leido = await leer(a, `/v1/incidents/${inc.id}/chunks/1`);
    expect(leido.headers.get('X-Vigia-Acuse')).toBe(b64u(new TextEncoder().encode(acuse)));
    expect(new Uint8Array(await leido.arrayBuffer())).toEqual(sobre(original));
    expect(await objetos(inc)).toHaveLength(1);
  });

  it('el mismo r con la otra firma válida (r, n − s): 200 con el acuse guardado, sin fila ni objeto nuevos (sección 4)', async () => {
    const { a, inc } = await conIncidente();
    const [f1] = await cadena(a, inc, 1);
    const acuse = await (await subir(a, inc, 1, f1)).text();
    const r = await subir(a, inc, 1, { ...f1, s: otraFirma(f1.s) });
    expect([r.status, await r.text()]).toEqual([200, acuse]);
    expect([await filas(inc), (await objetos(inc)).length]).toEqual([1, 1]);
  });

  it('el dispositivo B en un incidente de A: 404, igual que un incidente inexistente (R2-01)', async () => {
    const { a, inc } = await conIncidente();
    const b = await telefonoConAlta();
    const deB = await nuevoFragmento(b, inc, 1, inc.apertura.hash);
    const inexistente = await nuevaApertura(b);
    const fantasma = await nuevoFragmento(b, inexistente, 1, inexistente.apertura.hash);
    const respuestas = [
      await subir(b, inc, 1, deB), await subir(b, inc, 1, deB, { firmada: true }),
      await subir(b, inexistente, 1, fantasma), await subir(b, inexistente, 1, fantasma, { firmada: true }),
    ];
    const vistas = await Promise.all(respuestas.map(async (r) => [r.status, [...r.headers], await r.text()]));
    for (const v of vistas) expect(v).toEqual(vistas[0]);
    expect(vistas[0][0]).toBe(404);
    expect([await filas(inc), await objetos(inc)]).toEqual([0, []]);
    expect((await subir(a, inc, 1, (await cadena(a, inc, 1))[0])).status).toBe(201); // el dueño, en cambio, sí
  });

  it('s se verifica también con el incidente ajeno o inexistente, con y sin firma de petición, para que el tiempo no lo delate (punto 2)', async () => {
    const { inc } = await conIncidente();
    const b = await telefonoConAlta();
    const deB = await nuevoFragmento(b, inc, 1, inc.apertura.hash);
    const inexistente = await nuevaApertura(b);
    const fantasma = await nuevoFragmento(b, inexistente, 1, inexistente.apertura.hash);
    const verificar = vi.spyOn(crypto.subtle, 'verify');
    onTestFinished(() => verificar.mockRestore());
    const llamadas: number[] = [];
    for (const [i, x, firmada] of [[inc, deB, false], [inc, deB, true], [inexistente, fantasma, false], [inexistente, fantasma, true]] as const) {
      verificar.mockClear();
      expect((await subir(b, i, 1, x, { firmada })).status).toBe(404);
      llamadas.push(verificar.mock.calls.length);
    }
    expect(llamadas).toEqual([1, 2, 1, 2]); // la de s y, con firma de petición, también la de la petición
  });

  it('64 KiB + 1: 413 con Content-Length y sin él; otro Content-Type: 415', async () => {
    const { a, inc } = await conIncidente();
    const grande = new Uint8Array(65_537);
    const ruta = `${BASE}/v1/incidents/${inc.id}/chunks/1`;
    const conLongitud = await enviar(new Request(ruta, { method: 'PUT', headers: { 'Content-Type': TIPO_SOBRE, 'Content-Length': '65537' }, body: grande }));
    const sinLongitud = await enviar(new Request(ruta, { method: 'PUT', headers: { 'Content-Type': TIPO_SOBRE }, body: new Blob([grande]).stream() }));
    for (const r of [conLongitud, sinLongitud]) expect([r.status, await r.text()]).toEqual([413, '{"codigo":"demasiado_grande"}']);
    const [f1] = await cadena(a, inc, 1);
    const otroTipo = await enviar(new Request(ruta, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: sobre(f1) }));
    expect([otroTipo.status, await otroTipo.text()]).toEqual([415, '{"codigo":"tipo_contenido"}']);
    expect(await filas(inc)).toBe(0);
  });

  it('fuera de orden: el 7 antes que el 6, los dos aceptados y sin marca si encadenan', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 7);
    for (const seq of [1, 2, 3, 4, 5, 7, 6]) expect((await subir(a, inc, seq, f[seq - 1])).status).toBe(201);
    expect(await n('SELECT count(*) AS n FROM fragmentos WHERE incidente = ? AND bifurcacion = 1', inc.id)).toBe(0);
  });

  it('el 7 que no encadena con el 6 queda marcado, llegue antes o después (decisión 40)', async () => {
    const bifurcaciones = await contador('bifurcaciones');
    for (const septimoPrimero of [true, false]) {
      const { a, inc } = await conIncidente();
      const f = await cadena(a, inc, 6);
      const roto = await nuevoFragmento(a, inc, 7, 'e'.repeat(64));
      for (const seq of [1, 2, 3, 4, 5]) await subir(a, inc, seq, f[seq - 1]);
      const orden: [number, ConCifrado][] = septimoPrimero ? [[7, roto], [6, f[5]]] : [[6, f[5]], [7, roto]];
      for (const [seq, x] of orden) expect((await subir(a, inc, seq, x)).status).toBe(201);
      const { results } = await env.DB.prepare('SELECT seq FROM fragmentos WHERE incidente = ? AND bifurcacion = 1').bind(inc.id).run<{ seq: number }>();
      expect(results).toEqual([{ seq: 7 }]);
    }
    expect(await contador('bifurcaciones')).toBe(bifurcaciones + 2);
  });

  it('el 1 que no sigue a la apertura queda marcado', async () => {
    const { a, inc } = await conIncidente();
    const roto = await nuevoFragmento(a, inc, 1, 'e'.repeat(64));
    expect((await subir(a, inc, 1, roto)).status).toBe(201);
    expect(await n('SELECT bifurcacion AS n FROM fragmentos WHERE incidente = ? AND seq = 1', inc.id)).toBe(1);
  });

  it('con el cierre guardado, un seq mayor: 409 y nada escrito; el ultimo_seq que no da hash_final se guarda marcado', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 3);
    expect((await cerrar(a, inc, await nuevoCierre(a, inc, 2, f[1].hash))).status).toBe(201);
    const r = await subir(a, inc, 3, f[2]);
    expect([r.status, await r.text()]).toEqual([409, '{"codigo":"conflicto"}']);
    expect([await filas(inc), await objetos(inc)]).toEqual([0, []]);
    expect((await subir(a, inc, 1, f[0])).status).toBe(201);
    const otro2 = await nuevoFragmento(a, inc, 2, f[0].hash, new TextEncoder().encode('no es el que cerró'));
    expect((await subir(a, inc, 2, otro2)).status).toBe(201);
    expect(await n('SELECT bifurcacion AS n FROM fragmentos WHERE incidente = ? AND seq = 2', inc.id)).toBe(1);
  });

  it('cuota agotada: 429 cuota con Retry-After: 3600 y nada escrito, ni en R2', async () => {
    const { a, inc } = await conIncidente();
    const dos = { ...env, CUOTA_BYTES: String(2 * 16_384) };
    const f = await cadena(a, inc, 3);
    for (const seq of [1, 2]) expect((await subir(a, inc, seq, f[seq - 1], { entorno: dos })).status).toBe(201);
    const r = await subir(a, inc, 3, f[2], { entorno: dos });
    expect([r.status, r.headers.get('Retry-After'), await r.text()]).toEqual([429, '3600', '{"codigo":"cuota"}']);
    expect([await filas(inc), (await objetos(inc)).length, await n('SELECT bytes_usados AS n FROM dispositivos WHERE id = ?', a.id)]).toEqual([2, 2, 32_768]);
  });

  it('dos PUT nuevos a la vez con cuota para uno: el batch que llega después da 429 cuota, sin fila ni contadores, y su objeto en R2 se cobra en la cuota (punto 9, OPS-02)', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 2);
    const uno = { ...env, CUOTA_BYTES: String(16_384) };
    const puerta = d1ConPuerta(env.DB);
    const primero = subir(a, inc, 1, f[0], { entorno: { ...uno, DB: puerta.db } });
    await Promise.race([puerta.enBatch, primero]); // el primero ya pasó la comprobación previa de la cuota
    const antes = await contadores();
    expect((await subir(a, inc, 2, f[1], { entorno: uno })).status).toBe(201);
    puerta.abrirPuerta();
    const r = await primero;
    expect([r.status, await r.text()]).toEqual([429, '{"codigo":"cuota"}']);
    const bytes = await n('SELECT bytes_usados AS n FROM dispositivos WHERE id = ?', a.id);
    expect([await filas(inc), (await objetos(inc)).length, bytes, await contadores()]).toEqual([1, 2, 2 * 16_384, antes + 1]); // solo el acuse del segundo
  });

  it('el cierre se guarda mientras el PUT de seq 3 espera su batch: 409 conflicto, ninguna fila de seq 3, los contadores sin cambiar y su objeto en R2 cobrado en la cuota (punto 9, OPS-02)', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 3);
    for (const seq of [1, 2]) expect((await subir(a, inc, seq, f[seq - 1])).status).toBe(201);
    const puerta = d1ConPuerta(env.DB);
    const put = subir(a, inc, 3, f[2], { entorno: { ...env, DB: puerta.db } });
    await Promise.race([puerta.enBatch, put]);
    expect((await cerrar(a, inc, await nuevoCierre(a, inc, 2, f[1].hash))).status).toBe(201);
    const antes = await contadores();
    puerta.abrirPuerta();
    const r = await put;
    expect([r.status, await r.text()]).toEqual([409, '{"codigo":"conflicto"}']);
    expect([await n('SELECT count(*) AS n FROM fragmentos WHERE incidente = ? AND seq = 3', inc.id), await contadores()]).toEqual([0, antes]);
    expect([(await objetos(inc)).length, await n('SELECT bytes_usados AS n FROM dispositivos WHERE id = ?', a.id)]).toEqual([3, 3 * 16_384]);
  });

  it('otro contenido gana el seq mientras el PUT espera su batch: 409 conflicto y los dos objetos que quedan en R2 se cobran en la cuota (OPS-02)', async () => {
    const { a, inc } = await conIncidente();
    const uno = await nuevoFragmento(a, inc, 1, inc.apertura.hash);
    const otro = await nuevoFragmento(a, inc, 1, inc.apertura.hash, new TextEncoder().encode('otro audio'));
    const puerta = d1ConPuerta(env.DB);
    const primero = subir(a, inc, 1, uno, { entorno: { ...env, DB: puerta.db } });
    await Promise.race([puerta.enBatch, primero]); // el primero ya escribió su objeto en R2
    expect((await subir(a, inc, 1, otro)).status).toBe(201);
    puerta.abrirPuerta();
    const r = await primero;
    expect([r.status, await r.text()]).toEqual([409, '{"codigo":"conflicto"}']);
    expect([await filas(inc), (await objetos(inc)).length, await n('SELECT bytes_usados AS n FROM dispositivos WHERE id = ?', a.id)]).toEqual([1, 2, 2 * 16_384]);
  });

  it('guarda de D1: 429 cuota para un registro nuevo; la repetición sigue dando 200', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 2);
    const acuse = await (await subir(a, inc, 1, f[0])).text();
    const llena = { ...env, UMBRAL_D1_BYTES: '1' };
    const nuevo = await subir(a, inc, 2, f[1], { entorno: llena });
    expect([nuevo.status, await nuevo.text()]).toEqual([429, '{"codigo":"cuota"}']);
    const repetido = await subir(a, inc, 1, f[0], { entorno: llena });
    expect([repetido.status, await repetido.text()]).toEqual([200, acuse]);
  });

  it('130 reenvíos del mismo sobre: el mismo acuse, sin 429 y sin cambiar la hora de recepción (ENT-02)', async () => {
    const { a, inc } = await conIncidente();
    const [f1] = await cadena(a, inc, 1);
    const acuse = await (await subir(a, inc, 1, f1)).text();
    for (let i = 1; i <= 130; i++) {
      const r = await subir(a, inc, 1, f1, { ahora: T + i * 1_000, firmada: i % 2 === 0 });
      expect([r.status, await r.text()]).toEqual([200, acuse]);
    }
    expect(await n('SELECT recibido AS n FROM fragmentos WHERE incidente = ? AND seq = 1', inc.id)).toBe(T);
    expect(await objetos(inc)).toHaveLength(1);
  });

  it('cupo de subida: solo cuentan los registros nuevos con s válida; el 121.º da 429 limite (LIM-01)', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 121);
    const malo: ConCifrado = { ...f[0], s: new Uint8Array(64).fill(1) };
    await enLaMismaVentana();
    for (let i = 0; i < 10; i++) expect((await subir(a, inc, 1, malo)).status).toBe(404);
    for (let seq = 1; seq <= 120; seq++) expect((await subir(a, inc, seq, f[seq - 1])).status).toBe(201);
    expect((await subir(a, inc, 1, f[0])).status).toBe(200); // un reenvío no cuenta
    const r = await subir(a, inc, 121, f[120]);
    expect([r.status, r.headers.get('Retry-After'), await r.text()]).toEqual([429, '60', '{"codigo":"limite"}']);
  }, 20_000);

  it('con firma de petición: el dueño pasa; fuera de hora, 401 hora; dueño revocado, aceptado y marcado (FIR-04)', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 3);
    expect((await subir(a, inc, 1, f[0], { firmada: true })).status).toBe(201);
    const p = await peticion({ metodo: 'PUT', ruta: `/v1/incidents/${inc.id}/chunks/2`, cuerpo: sobre(f[1]), tipo: TIPO_SOBRE, hora: T, firmante: { telefono: a, id: a.id } });
    const fueraDeHora = await enviar(p, T + 360_000);
    expect([fueraDeHora.status, fueraDeHora.headers.get('X-Vigia-Hora-Servidor'), await fueraDeHora.text()]).toEqual([401, String(T + 360_000), '{"codigo":"hora"}']);
    await revocar(a.id, T + 1);
    expect((await subir(a, inc, 2, f[1])).status).toBe(201);
    expect((await subir(a, inc, 3, f[2], { firmada: true })).status).toBe(201);
    expect(await n('SELECT count(*) AS n FROM fragmentos WHERE incidente = ? AND tras_revocacion = 1', inc.id)).toBe(2);
  });

  it('con solo parte de las cuatro cabeceras de firma: 400 formato y nada escrito (sección 9)', async () => {
    const { a, inc } = await conIncidente();
    const [f1] = await cadena(a, inc, 1);
    const firmada = await peticion({ metodo: 'PUT', ruta: `/v1/incidents/${inc.id}/chunks/1`, cuerpo: sobre(f1), tipo: TIPO_SOBRE, firmante: { telefono: a, id: a.id } });
    // Se quitan: todas menos X-Vigia-Firma; solo X-Vigia-Firma; solo X-Vigia-Hora.
    for (const quitar of [[CABECERA.dispositivo, CABECERA.hora, CABECERA.peticion], [CABECERA.firma], [CABECERA.hora]]) {
      const p = new Request(firmada.url, { method: 'PUT', headers: firmada.headers, body: sobre(f1) });
      for (const nombre of quitar) p.headers.delete(nombre);
      const r = await enviar(p);
      expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
    }
    expect([await filas(inc), await objetos(inc)]).toEqual([0, []]);
  });

  it('foco 1: R2 escrito y D1 que falla; el reintento da 201 con un objeto y una fila con su acuse', async () => {
    const { a, inc } = await conIncidente();
    const [f1] = await cadena(a, inc, 1);
    const reutilizados = await contador('r2_reutilizado');
    const roto = { ...env, DB: d1QueFalla(env.DB), EVIDENCIA: r2SinSobrescribir(env.EVIDENCIA) };
    const primero = await subir(a, inc, 1, f1, { entorno: roto });
    expect([primero.status, await primero.text()]).toEqual([500, '{"codigo":"interno"}']);
    expect([(await objetos(inc)).length, await filas(inc), await n('SELECT bytes_usados AS n FROM dispositivos WHERE id = ?', a.id)]).toEqual([1, 0, 0]);
    const reintento = await subir(a, inc, 1, f1, { entorno: roto, ahora: T + 5_000 });
    expect(reintento.status).toBe(201);
    const acuse = new Uint8Array(await reintento.arrayBuffer());
    expect(analizarAcuse(acuse).hora_servidor).toBe(T + 5_000);
    expect((await objetos(inc)).length).toBe(1);
    const fila = await env.DB.prepare('SELECT acuse FROM fragmentos WHERE incidente = ? AND seq = 1').bind(inc.id).first<{ acuse: number[] }>();
    expect(new Uint8Array(fila!.acuse)).toEqual(acuse);
    expect(await contador('r2_reutilizado')).toBe(reutilizados + 1);
  });

  it('foco 1 con el R2 de Miniflare: el put condicional del reintento devuelve null, el objeto se reutiliza y suma r2_reutilizado', async () => {
    const { a, inc } = await conIncidente();
    const [f1] = await cadena(a, inc, 1);
    const reutilizados = await contador('r2_reutilizado');
    const primero = await subir(a, inc, 1, f1, { entorno: { ...env, DB: d1QueFalla(env.DB) } });
    expect([primero.status, await primero.text()]).toEqual([500, '{"codigo":"interno"}']);
    expect((await subir(a, inc, 1, f1, { ahora: T + 5_000 })).status).toBe(201);
    expect([(await objetos(inc)).length, await filas(inc), await contador('r2_reutilizado')]).toEqual([1, 1, reutilizados + 1]);
  });

  it.each<[string, (cifrado: Uint8Array) => Uint8Array, boolean]>([
    ['otro tamaño', (x) => x.subarray(1), true],
    ['el mismo tamaño y otro SHA-256', (x) => x.map((b, i) => (i === 0 ? b ^ 1 : b)), true],
    ['el mismo contenido sin checksums.sha256', (x) => x, false],
  ])('otro objeto en la clave (%s): 500 interno, ninguna fila y el objeto intacto (punto 8)', async (_caso, otro, conSuma) => {
    const { a, inc } = await conIncidente();
    const [f1] = await cadena(a, inc, 1);
    const clave = `i/${inc.id}/1/${hex(await cripto.sha256(f1.cifrado))}`;
    const previo = otro(f1.cifrado);
    await env.EVIDENCIA.put(clave, previo, conSuma ? { sha256: hex(await cripto.sha256(previo)) } : {});
    const r = await subir(a, inc, 1, f1);
    expect([r.status, await r.text()]).toEqual([500, '{"codigo":"interno"}']);
    expect([await filas(inc), await n('SELECT bytes_usados AS n FROM dispositivos WHERE id = ?', a.id)]).toEqual([0, 0]);
    expect(new Uint8Array(await (await env.EVIDENCIA.get(clave))!.arrayBuffer())).toEqual(previo);
  });

  it('foco 5: dos PUT iguales a la vez dan un objeto, una fila y el mismo acuse byte a byte', async () => {
    const { a, inc } = await conIncidente();
    const [f1] = await cadena(a, inc, 1);
    const respuestas = await Promise.all([subir(a, inc, 1, f1), subir(a, inc, 1, f1)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    const [x, y] = await Promise.all(respuestas.map((r) => r.text()));
    expect(x).toBe(y);
    expect([(await objetos(inc)).length, await filas(inc)]).toEqual([1, 1]);
  });
});
