import { env } from 'cloudflare:workers';
import { analizarAcuse, b64u, cuerpoIncidente, verificarAcuse } from '@vigia/shared';
import { describe, expect, it } from 'vitest';
import { claveAcuse } from '../src/acuses.ts';
import { clavesAcuse, cripto, d1QueFalla, enLaMismaVentana, enviar, nuevoTelefono, peticion, revocar, T, telefonoConAlta } from './ayudas.ts';
import { abrir, cuerpoApertura, envoltura, firmar, type Incidente, leer, nuevaApertura, pedidoApertura } from './cadena.ts';

const n = async (sql: string, ...v: unknown[]) => Number(await env.DB.prepare(sql).bind(...v).first('n'));
const filasAntirreenvio = (id: string) => n('SELECT count(*) AS n FROM antirreenvio WHERE id_peticion = ?', id);
const contadores = () => n('SELECT coalesce(sum(valor), 0) AS n FROM contadores');

describe('POST /v1/incidents (sección 11, "Apertura")', () => {
  it('201 con el JCV del acuse, verificable con la lista de prueba, y lo guardado en un solo batch', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    const meta = new Uint8Array(100).fill(9);
    const r = await enviar(await peticion(pedidoApertura(a, cuerpoApertura(inc, [envoltura('contacto', 'c'.repeat(22)), envoltura('escucha')], meta))));
    expect(r.status).toBe(201);
    expect(r.headers.get('Content-Type')).toBe('application/json');
    const cuerpo = new Uint8Array(await r.arrayBuffer());
    const acuse = analizarAcuse(cuerpo);
    expect(acuse).toMatchObject({ v: 1, kid: env.KID_ACUSE, r: inc.apertura.hash, hora_servidor: T });
    expect(await verificarAcuse(cripto, clavesAcuse(), acuse, inc.apertura.hash)).toBe('valido');
    const fila = await env.DB.prepare('SELECT dispositivo, acuse, meta, recibido FROM incidentes WHERE id = ?').bind(inc.id).first<{ dispositivo: string; acuse: number[]; meta: number[]; recibido: number }>();
    expect(fila!.dispositivo).toBe(a.id);
    expect(new Uint8Array(fila!.acuse)).toEqual(cuerpo);
    expect(new Uint8Array(fila!.meta)).toEqual(meta);
    expect(fila!.recibido).toBe(T);
    expect(await n('SELECT count(*) AS n FROM envolturas WHERE incidente = ?', inc.id)).toBe(2);
    expect(await n('SELECT incidentes_usados AS n FROM dispositivos WHERE id = ?', a.id)).toBe(1);
  });

  it('la privada del acuse se importa no extraíble (ACU-01)', async () => {
    const clave = await claveAcuse(env);
    expect(clave.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('pkcs8', clave)).rejects.toThrow();
  });

  it('repetida con otras envolturas y otra meta: 200 con el mismo acuse, sin cambiar nada', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    const primera = await enviar(await peticion(pedidoApertura(a, cuerpoApertura(inc, [envoltura('escucha')]))));
    const acuse = await primera.text();
    const otra = await enviar(await peticion(pedidoApertura(a, cuerpoApertura(inc, [envoltura('recuperacion')], new Uint8Array(5)), { hora: T + 1000 })), T + 1000);
    expect([otra.status, await otra.text()]).toEqual([200, acuse]);
    const { results } = await env.DB.prepare('SELECT rol FROM envolturas WHERE incidente = ?').bind(inc.id).run<{ rol: string }>();
    expect(results).toEqual([{ rol: 'escucha' }]);
    expect(await n('SELECT count(*) AS n FROM incidentes WHERE id = ? AND meta IS NULL AND recibido = ?', inc.id, T)).toBe(1);
    expect(await n('SELECT incidentes_usados AS n FROM dispositivos WHERE id = ?', a.id)).toBe(1);
  });

  it('el mismo id con otra apertura, del mismo dueño o de otro: 409 conflicto', async () => {
    const a = await telefonoConAlta();
    const b = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    expect((await abrir(a, inc)).status).toBe(201);
    const otraHora = await nuevaApertura(a, { incidente: inc.id, hora_telefono: T + 1 });
    const deB = await nuevaApertura(b, { incidente: inc.id });
    for (const r of [await abrir(a, otraHora), await abrir(b, deB)]) expect([r.status, await r.text()]).toEqual([409, '{"codigo":"conflicto"}']);
  });

  it('r.dispositivo de otro teléfono: 400 formato; s que no es del firmante: 401 firma', async () => {
    const a = await telefonoConAlta();
    const b = await nuevoTelefono();
    const ajena = await nuevaApertura(a, { dispositivo: b.huella });
    const r1 = await abrir(a, ajena);
    expect([r1.status, await r1.text()]).toEqual([400, '{"codigo":"formato"}']);
    const inc = await nuevaApertura(a);
    const firmadaPorB = { ...inc, apertura: await firmar(b, { v: 1, tipo: 'apertura', incidente: inc.id, seq: 0, hora_telefono: T, country_code: 'VE', dispositivo: a.huella, origen: 'grabar', kc: 'a'.repeat(64) }) };
    const r2 = await abrir(a, firmadaPorB);
    expect([r2.status, await r2.text()]).toEqual([401, '{"codigo":"firma"}']);
    expect(await n('SELECT count(*) AS n FROM incidentes WHERE dispositivo = ?', a.id)).toBe(0);
  });

  it('teléfono revocado: apertura nueva 401 firma, aunque su hora sea anterior a la revocación; la ya recibida, 200 con su acuse (FIR-04)', async () => {
    const a = await telefonoConAlta();
    const vieja = await nuevaApertura(a);
    const acuse = await (await abrir(a, vieja)).text();
    await revocar(a.id, T + 1);
    const nueva = await abrir(a, await nuevaApertura(a), T + 2);
    expect([nueva.status, await nueva.text()]).toEqual([401, '{"codigo":"firma"}']);
    const repetida = await abrir(a, vieja, T + 3);
    expect([repetida.status, await repetida.text()]).toEqual([200, acuse]);
  });

  it('guarda de D1: con la base por encima del umbral, 429 cuota con Retry-After: 3600 y nada escrito', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    const r = await enviar(await peticion(pedidoApertura(a, cuerpoApertura(inc))), T, { ...env, UMBRAL_D1_BYTES: '1' });
    expect([r.status, r.headers.get('Retry-After'), await r.text()]).toEqual([429, '3600', '{"codigo":"cuota"}']);
    expect(await n('SELECT count(*) AS n FROM incidentes WHERE id = ?', inc.id)).toBe(0);
  });

  it('TOPE_INCIDENTES: la apertura de más recibe 429 cuota, sin incidente, sin fila anti-reenvío y sin cambiar los contadores', async () => {
    const a = await telefonoConAlta();
    const tope1 = { ...env, TOPE_INCIDENTES: '1' };
    expect((await enviar(await peticion(pedidoApertura(a, cuerpoApertura(await nuevaApertura(a)))), T, tope1)).status).toBe(201);
    const antes = await contadores();
    const segunda = await nuevaApertura(a);
    const r = await enviar(await peticion(pedidoApertura(a, cuerpoApertura(segunda), { idPeticion: 's'.repeat(22) })), T, tope1);
    expect([r.status, r.headers.get('Retry-After'), await r.text()]).toEqual([429, '3600', '{"codigo":"cuota"}']);
    expect(await n('SELECT count(*) AS n FROM incidentes WHERE id = ?', segunda.id)).toBe(0);
    expect(await filasAntirreenvio('s'.repeat(22))).toBe(0);
    // Un rechazo no escribe contadores (sección 12): ni acuses ni incidentes_usados.
    expect([await contadores(), await n('SELECT incidentes_usados AS n FROM dispositivos WHERE id = ?', a.id)]).toEqual([antes, 1]);
  });

  it('la misma apertura dos veces a la vez: un 201 y un 200 con el mismo acuse', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    const respuestas = await Promise.all([abrir(a, inc), abrir(a, inc)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    const [x, y] = await Promise.all(respuestas.map((r) => r.text()));
    expect(x).toBe(y);
    expect(await n('SELECT incidentes_usados AS n FROM dispositivos WHERE id = ?', a.id)).toBe(1);
  });

  it('con TOPE_INCIDENTES 1, la misma apertura dos veces a la vez con otras envolturas: un 201, un 200 y solo la envoltura de la ganadora', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    const tope1 = { ...env, TOPE_INCIDENTES: '1' };
    const roles = ['escucha', 'recuperacion'] as const;
    const peticiones = await Promise.all(roles.map((rol) => peticion(pedidoApertura(a, cuerpoApertura(inc, [envoltura(rol)])))));
    const respuestas = await Promise.all(peticiones.map((p) => enviar(p, T, tope1)));
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    const { results } = await env.DB.prepare('SELECT rol FROM envolturas WHERE incidente = ?').bind(inc.id).run<{ rol: string }>();
    expect(results).toEqual([{ rol: roles[respuestas.findIndex((r) => r.status === 201)] }]);
  });

  // Cuerpos que cuerpoIncidente nunca produciría: se escriben a mano.
  const crudo = (inc: Incidente, envolturas: unknown[], meta?: Uint8Array) => new TextEncoder().encode(JSON.stringify({
    envolturas, ...(meta ? { meta: b64u(meta) } : {}), r: b64u(inc.apertura.bytes), s: b64u(inc.apertura.s),
  }));

  it.each<[string, (inc: Incidente) => Uint8Array]>([
    ['6 envolturas', (inc) => crudo(inc, Array.from({ length: 6 }, (_, i) => envoltura('contacto', String(i).repeat(22))))],
    ['contacto sin destino', (inc) => crudo(inc, [envoltura('contacto', '-')])],
    ['escucha con destino', (inc) => crudo(inc, [envoltura('escucha', 'c'.repeat(22))])],
    ['par (rol, destino) repetido', (inc) => crudo(inc, [envoltura('escucha'), envoltura('escucha')])],
    ['k de 79 bytes', (inc) => crudo(inc, [{ destino: '-', k: b64u(new Uint8Array(79)), rol: 'escucha' }])],
    ['meta de 4097 bytes', (inc) => crudo(inc, [], new Uint8Array(4097))],
    ['clave desconocida', (inc) => new TextEncoder().encode(JSON.stringify({ envolturas: [], otra: 1, r: b64u(inc.apertura.bytes), s: b64u(inc.apertura.s) }))],
  ])('%s: 400 formato', async (_caso, cuerpo) => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    const r = await enviar(await peticion(pedidoApertura(a, cuerpo(inc))));
    expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
    expect(await n('SELECT count(*) AS n FROM incidentes WHERE id = ?', inc.id)).toBe(0);
  });

  it('r que no es una apertura: 400 formato', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    const cierre = await firmar(a, { v: 1, tipo: 'cierre', incidente: inc.id, hora_telefono: T, ultimo_seq: 0, hash_final: inc.apertura.hash });
    const cuerpo = cuerpoIncidente({ envolturas: [], r: b64u(cierre.bytes), s: b64u(cierre.s) });
    const r = await enviar(await peticion(pedidoApertura(a, cuerpo)));
    expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
  });
});

describe('anti-reenvío en la apertura (sección 9, paso 4; FIR-02, PRIV-01)', () => {
  it('la misma petición repetida devuelve la respuesta guardada, también 130 veces seguidas y sin 429', async () => {
    const a = await telefonoConAlta();
    const p = pedidoApertura(a, cuerpoApertura(await nuevaApertura(a)), { idPeticion: 'u'.repeat(22) });
    const primera = await enviar(await peticion(p));
    const acuse = await primera.text();
    for (let i = 0; i < 130; i++) {
      const r = await enviar(await peticion({ ...p, hora: T + i }), T + i);
      expect([r.status, await r.text()]).toEqual([201, acuse]);
    }
  });

  it('el mismo idPeticion con otro cuerpo: 409 conflicto sin ejecutar nada', async () => {
    const a = await telefonoConAlta();
    const idPeticion = 'v'.repeat(22);
    expect((await enviar(await peticion(pedidoApertura(a, cuerpoApertura(await nuevaApertura(a)), { idPeticion })))).status).toBe(201);
    const otra = await nuevaApertura(a);
    const r = await enviar(await peticion(pedidoApertura(a, cuerpoApertura(otra), { idPeticion })));
    expect([r.status, await r.text()]).toEqual([409, '{"codigo":"conflicto"}']);
    expect(await n('SELECT count(*) AS n FROM incidentes WHERE id = ?', otra.id)).toBe(0);
  });

  it('el reintento tras un 401 hora, con el mismo idPeticion y otra HORA, se ejecuta una vez', async () => {
    const a = await telefonoConAlta();
    const p = pedidoApertura(a, cuerpoApertura(await nuevaApertura(a)), { idPeticion: 'w'.repeat(22) });
    expect((await enviar(await peticion({ ...p, hora: T - 400_000 }))).status).toBe(401);
    expect((await enviar(await peticion(p))).status).toBe(201);
    expect((await enviar(await peticion({ ...p, hora: T + 5 }), T + 5)).status).toBe(201);
    expect(await filasAntirreenvio('w'.repeat(22))).toBe(1);
  });

  it('un 500 no deja fila ni incidente, y el reintento da 201', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    const p = pedidoApertura(a, cuerpoApertura(inc), { idPeticion: 'x'.repeat(22) });
    const fallo = await enviar(await peticion(p), T, { ...env, DB: d1QueFalla(env.DB) });
    expect([fallo.status, await fallo.text()]).toEqual([500, '{"codigo":"interno"}']);
    expect(await filasAntirreenvio('x'.repeat(22))).toBe(0);
    expect(await n('SELECT count(*) AS n FROM incidentes WHERE id = ?', inc.id)).toBe(0);
    expect((await enviar(await peticion(p))).status).toBe(201);
  });

  it('frontera exacta: la fila sigue con ahora − creado = 600 000 y se borra con 600 001', async () => {
    const a = await telefonoConAlta();
    expect((await enviar(await peticion(pedidoApertura(a, cuerpoApertura(await nuevaApertura(a)), { idPeticion: 'y'.repeat(22) })))).status).toBe(201);
    const otraEn = async (ahora: number) => expect((await abrir(a, await nuevaApertura(a), ahora)).status).toBe(201);
    await otraEn(T + 600_000);
    expect(await filasAntirreenvio('y'.repeat(22))).toBe(1);
    await otraEn(T + 600_001);
    expect(await filasAntirreenvio('y'.repeat(22))).toBe(0);
  });

  it('petición 121 de órdenes: 429 limite; las lecturas tienen su propio cupo (LIM-01)', async () => {
    const a = await telefonoConAlta();
    await enLaMismaVentana();
    for (let i = 0; i < 120; i++) expect((await abrir(a, await nuevaApertura(a))).status).toBe(201);
    const r = await abrir(a, await nuevaApertura(a));
    expect([r.status, r.headers.get('Retry-After'), await r.text()]).toEqual([429, '60', '{"codigo":"limite"}']);
    expect((await leer(a, '/v1/incidents/' + 'n'.repeat(22))).status).toBe(404);
  }, 15_000);
});
