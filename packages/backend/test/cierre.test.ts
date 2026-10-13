import { env } from 'cloudflare:workers';
import { analizarAcuse, b64u, empaquetarSobre, verificarAcuse } from '@vigia/shared';
import { describe, expect, it } from 'vitest';
import { TIPO_SOBRE } from '../src/errores.ts';
import { clavesAcuse, cripto, revocar, T, telefonoConAlta } from './ayudas.ts';
import { abrir, cadena, cerrar, type ConId, type Incidente, leer, nuevaApertura, nuevoCierre, otraFirma, subir } from './cadena.ts';

const n = async (sql: string, ...v: unknown[]) => Number(await env.DB.prepare(sql).bind(...v).first('n'));
const hayCierre = (inc: Incidente) => n('SELECT count(*) AS n FROM cierres WHERE incidente = ?', inc.id);
const contadores = () => n('SELECT coalesce(sum(valor), 0) AS n FROM contadores');

async function todo(r: Response) {
  return { estado: r.status, cabeceras: [...r.headers], cuerpo: await r.text() };
}

async function conIncidente(): Promise<{ a: ConId; inc: Incidente }> {
  const a = await telefonoConAlta();
  const inc = await nuevaApertura(a);
  expect((await abrir(a, inc)).status).toBe(201);
  return { a, inc };
}

describe('POST /v1/incidents/:id/close (sección 11, "Cierre")', () => {
  it('201 con el acuse; el GET del cierre da 404 antes y después lo devuelve como sobre; el estado dice cerrado', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 2);
    for (const seq of [1, 2]) await subir(a, inc, seq, f[seq - 1]);
    const antes = await leer(a, `/v1/incidents/${inc.id}/close`);
    expect([antes.status, await antes.text()]).toEqual([404, '{"codigo":"no_existe"}']);
    const cierre = await nuevoCierre(a, inc, 2, f[1].hash);
    const r = await cerrar(a, inc, cierre);
    expect([r.status, r.headers.get('Content-Type')]).toEqual([201, 'application/json']);
    const acuse = new Uint8Array(await r.arrayBuffer());
    expect(await verificarAcuse(cripto, clavesAcuse(), analizarAcuse(acuse), cierre.hash)).toBe('valido');
    const leido = await leer(a, `/v1/incidents/${inc.id}/close`);
    expect([leido.status, leido.headers.get('Content-Type'), leido.headers.get('X-Vigia-Acuse')]).toEqual([200, TIPO_SOBRE, b64u(acuse)]);
    expect(new Uint8Array(await leido.arrayBuffer())).toEqual(empaquetarSobre({ r: cierre.bytes, s: cierre.s, cifrado: new Uint8Array(0) }));
    expect(await (await leer(a, `/v1/incidents/${inc.id}`)).text()).toBe('{"cerrado":1,"ultimo_recibido":2,"v":1}');
  });

  it('el mismo cierre otra vez: 200 con el mismo acuse; otro cierre: 409', async () => {
    const { a, inc } = await conIncidente();
    const cierre = await nuevoCierre(a, inc, 0, inc.apertura.hash); // SOS sin grabación cancelado
    const acuse = await (await cerrar(a, inc, cierre)).text();
    const otraVez = await cerrar(a, inc, cierre, { ahora: T + 1_000 });
    expect([otraVez.status, await otraVez.text()]).toEqual([200, acuse]);
    const otro = await cerrar(a, inc, await nuevoCierre(a, inc, 0, inc.apertura.hash, T + 5));
    expect([otro.status, await otro.text()]).toEqual([409, '{"codigo":"conflicto"}']);
  });

  it('el mismo cierre dos veces a la vez: un 201 y un 200 con el mismo acuse', async () => {
    const { a, inc } = await conIncidente();
    const cierre = await nuevoCierre(a, inc, 0, inc.apertura.hash);
    const respuestas = await Promise.all([cerrar(a, inc, cierre), cerrar(a, inc, cierre)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    const [x, y] = await Promise.all(respuestas.map((r) => r.text()));
    expect(x).toBe(y);
    expect(await hayCierre(inc)).toBe(1);
  });

  it('el mismo cierre con la otra firma válida (r, n − s): 200 con el mismo acuse y un solo cierre (sección 4)', async () => {
    const { a, inc } = await conIncidente();
    const cierre = await nuevoCierre(a, inc, 0, inc.apertura.hash);
    const acuse = await (await cerrar(a, inc, cierre)).text();
    const r = await cerrar(a, inc, { ...cierre, s: otraFirma(cierre.s) });
    expect([r.status, await r.text()]).toEqual([200, acuse]);
    expect(await hayCierre(inc)).toBe(1);
  });

  it('foco 3: un cierre corto que llega después de fragmentos mayores: 409 y nada guardado, tampoco en los contadores', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 3);
    for (const seq of [1, 2, 3]) await subir(a, inc, seq, f[seq - 1]);
    const antes = await contadores();
    const r = await cerrar(a, inc, await nuevoCierre(a, inc, 2, f[1].hash), { idPeticion: 'k'.repeat(22) });
    expect([r.status, await r.text()]).toEqual([409, '{"codigo":"conflicto"}']);
    expect(await hayCierre(inc)).toBe(0);
    expect(await n('SELECT count(*) AS n FROM antirreenvio WHERE id_peticion = ?', 'k'.repeat(22))).toBe(0);
    expect(await contadores()).toBe(antes);
    expect((await leer(a, `/v1/incidents/${inc.id}/close`)).status).toBe(404);
  });

  it('un hash_final que no es el del registro ultimo_seq guardado (o de la apertura): 409', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 2);
    for (const seq of [1, 2]) await subir(a, inc, seq, f[seq - 1]);
    for (const cierre of [await nuevoCierre(a, inc, 2, 'e'.repeat(64)), await nuevoCierre(a, inc, 0, 'e'.repeat(64))]) {
      const r = await cerrar(a, inc, cierre);
      expect([r.status, await r.text()]).toEqual([409, '{"codigo":"conflicto"}']);
    }
    expect(await hayCierre(inc)).toBe(0);
  });

  it('un cierre que llega antes que sus fragmentos se guarda; después, los menores entran y el mayor da 409', async () => {
    const { a, inc } = await conIncidente();
    const f = await cadena(a, inc, 4);
    expect((await cerrar(a, inc, await nuevoCierre(a, inc, 3, f[2].hash))).status).toBe(201);
    for (const seq of [3, 1, 2]) expect((await subir(a, inc, seq, f[seq - 1])).status).toBe(201);
    expect((await subir(a, inc, 4, f[3])).status).toBe(409);
    expect(await n('SELECT count(*) AS n FROM fragmentos WHERE incidente = ? AND bifurcacion = 1', inc.id)).toBe(0);
  });

  it('teléfono revocado: cierra su incidente, marcado tras_revocacion; el de otro, 404 (FIR-04)', async () => {
    const { a, inc } = await conIncidente();
    const { inc: deOtro } = await conIncidente();
    await revocar(a.id, T + 1);
    expect((await cerrar(a, inc, await nuevoCierre(a, inc, 0, inc.apertura.hash), { ahora: T + 2 })).status).toBe(201);
    expect(await n('SELECT tras_revocacion AS n FROM cierres WHERE incidente = ?', inc.id)).toBe(1);
    const ajeno = await cerrar(a, deOtro, await nuevoCierre(a, deOtro, 0, deOtro.apertura.hash), { ahora: T + 3 });
    expect([ajeno.status, await ajeno.text()]).toEqual([404, '{"codigo":"no_existe"}']);
  });

  it('ajeno e inexistente: el mismo 404 byte a byte al cerrar y al leer el cierre (R2-01, ERR-01)', async () => {
    const { a, inc } = await conIncidente();
    expect((await cerrar(a, inc, await nuevoCierre(a, inc, 0, inc.apertura.hash))).status).toBe(201);
    const b = await telefonoConAlta();
    const inexistente = await nuevaApertura(b);
    const cierreAjeno = await todo(await cerrar(b, inc, await nuevoCierre(b, inc, 0, inc.apertura.hash)));
    const cierreInexistente = await todo(await cerrar(b, inexistente, await nuevoCierre(b, inexistente, 0, inexistente.apertura.hash)));
    const lecturaAjena = await todo(await leer(b, `/v1/incidents/${inc.id}/close`));
    const lecturaInexistente = await todo(await leer(b, `/v1/incidents/${inexistente.id}/close`));
    expect(cierreAjeno).toEqual(cierreInexistente);
    expect(lecturaAjena).toEqual(lecturaInexistente);
    expect([cierreAjeno.estado, cierreAjeno.cuerpo, lecturaAjena.estado, lecturaAjena.cuerpo]).toEqual([404, '{"codigo":"no_existe"}', 404, '{"codigo":"no_existe"}']);
    expect((await leer(a, `/v1/incidents/${inc.id}/close`)).status).toBe(200); // el dueño sí lo lee
  });

  it('s que no es del dueño: 401 firma; r de otro incidente o que no es un cierre: 400 formato', async () => {
    const { a, inc } = await conIncidente();
    const r1 = await cerrar(a, inc, await nuevoCierre(await telefonoConAlta(), inc, 0, inc.apertura.hash));
    expect([r1.status, await r1.text()]).toEqual([401, '{"codigo":"firma"}']);
    const otroIncidente = await nuevaApertura(a);
    const r2 = await cerrar(a, inc, await nuevoCierre(a, otroIncidente, 0, otroIncidente.apertura.hash));
    const r3 = await cerrar(a, inc, inc.apertura);
    for (const r of [r2, r3]) expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
    expect(await hayCierre(inc)).toBe(0);
  });

  it('el cierre nunca lo bloquean las cuotas ni la guarda de D1', async () => {
    const { a, inc } = await conIncidente();
    const sinSitio = { ...env, CUOTA_BYTES: '0', TOPE_INCIDENTES: '0', UMBRAL_D1_BYTES: '1' };
    expect((await cerrar(a, inc, await nuevoCierre(a, inc, 0, inc.apertura.hash), { entorno: sinSitio })).status).toBe(201);
  });

  it('anti-reenvío: el mismo cierre con el mismo idPeticion devuelve la respuesta guardada', async () => {
    const { a, inc } = await conIncidente();
    const cierre = await nuevoCierre(a, inc, 0, inc.apertura.hash);
    const primera = await cerrar(a, inc, cierre, { idPeticion: 'm'.repeat(22) });
    const acuse = await primera.text();
    const segunda = await cerrar(a, inc, cierre, { idPeticion: 'm'.repeat(22), ahora: T + 2_000 });
    expect([segunda.status, await segunda.text()]).toEqual([201, acuse]);
  });
});
