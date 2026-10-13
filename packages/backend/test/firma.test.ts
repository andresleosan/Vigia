import { env } from 'cloudflare:workers';
import { CABECERA } from '@vigia/shared';
import { describe, expect, it } from 'vitest';
import { enLaMismaVentana, enviar, nuevoTelefono, pedidoDeAlta, peticion, revocar, T, telefonoConAlta, type Telefono } from './ayudas.ts';

const INCIDENTE = '/v1/incidents/' + 'i'.repeat(22);

function lectura(t: Telefono, id: string, extra = {}) {
  return peticion({ metodo: 'GET', ruta: INCIDENTE, firmante: { telefono: t, id, clave: 'lectura' }, ...extra });
}

async function todo(r: Response) {
  return { estado: r.status, cabeceras: [...r.headers], cuerpo: await r.text() };
}

describe('firma de peticiones (sección 9, FIR-01, FIR-03, FIR-04, ERR-01)', () => {
  it('query, también vacía, con firma válida: 401 firma', async () => {
    const t = await nuevoTelefono();
    for (const sufijo of ['?', '?a=1']) {
      const p = await peticion(pedidoDeAlta(t));
      const r = await enviar(new Request(p.url + sufijo, p));
      expect([r.status, await r.text()]).toEqual([401, '{"codigo":"firma"}']);
    }
  });

  it.each([
    ['otro método', { metodo: 'PUT' }],
    ['otra ruta', { ruta: '/v1/incidents' }],
    ['otro cuerpo', { cuerpo: new TextEncoder().encode('{}') }],
    ['otra hora', { hora: T + 1 }],
    ['otro idPeticion', { idPeticion: 'q'.repeat(22) }],
  ])('alta firmada con %s: 401 firma', async (_caso, firmado) => {
    const r = await enviar(await peticion(pedidoDeAlta(await nuevoTelefono(), { firmado })));
    expect([r.status, await r.text()]).toEqual([401, '{"codigo":"firma"}']);
  });

  it('desconocido, firma inválida y revocado: la misma respuesta byte a byte', async () => {
    const a = await telefonoConAlta();
    const b = await telefonoConAlta();
    await revocar(b.id);
    const desconocido = await enviar(await lectura(a, 'z'.repeat(22)));
    const otraClave = await enviar(await lectura(await nuevoTelefono(), a.id));
    const revocado = await enviar(await lectura(b, b.id));
    const esperado = await todo(desconocido);
    expect(esperado.estado).toBe(401);
    expect(esperado.cuerpo).toBe('{"codigo":"firma"}');
    expect(await todo(otraClave)).toEqual(esperado);
    expect(await todo(revocado)).toEqual(esperado);
    // revocado con la hora fuera de la ventana: firma, no hora (no delata que la firma era buena)
    expect(await todo(await enviar(await lectura(b, b.id, { hora: T - 600_000 })))).toEqual(esperado);
  });

  it('una lectura firmada con la clave del dispositivo: 401 firma', async () => {
    const a = await telefonoConAlta();
    const r = await enviar(await peticion({ metodo: 'GET', ruta: INCIDENTE, firmante: { telefono: a, id: a.id, clave: 'dispositivo' } }));
    expect([r.status, await r.text()]).toEqual([401, '{"codigo":"firma"}']);
  });

  it('reloj desfasado 6 min: 401 hora con X-Vigia-Hora-Servidor y Date; el reintento corregido pasa', async () => {
    const t = await nuevoTelefono();
    const idPeticion = 'r'.repeat(22);
    const r = await enviar(await peticion(pedidoDeAlta(t, { hora: T - 360_000, idPeticion })));
    expect([r.status, await r.text()]).toEqual([401, '{"codigo":"hora"}']);
    expect(r.headers.get(CABECERA.horaServidor)).toBe(String(T));
    expect(r.headers.get('Date')).toBe(new Date(T).toUTCString());
    const desfase = Number(r.headers.get(CABECERA.horaServidor)) - (T - 360_000);
    const otra = await enviar(await peticion(pedidoDeAlta(t, { hora: T - 360_000 + desfase, idPeticion })));
    expect(otra.status).toBe(201);
  });

  it('frontera de la ventana: ±300 000 ms pasan y 300 001 no', async () => {
    for (const [hora, estado] of [[T - 300_000, 201], [T + 300_000, 201], [T + 300_001, 401], [T - 300_001, 401]]) {
      const r = await enviar(await peticion(pedidoDeAlta(await nuevoTelefono(), { hora })));
      expect(r.status).toBe(estado);
    }
  });

  it.each<[string, Record<string, string>]>([
    ['sin X-Vigia-Firma', { [CABECERA.firma]: '' }],
    ['hora con ceros a la izquierda', { [CABECERA.hora]: '0' + T }],
    ['hora negativa', { [CABECERA.hora]: '-1' }],
    ['idPeticion de 21', { [CABECERA.peticion]: 'p'.repeat(21) }],
    ['firma de 85 caracteres', { [CABECERA.firma]: 'A'.repeat(85) }],
    ['X-Vigia-Dispositivo en el alta', { [CABECERA.dispositivo]: 'd'.repeat(22) }],
  ])('cabecera mal formada (%s): 400 formato', async (_caso, cabeceras) => {
    const p = await peticion(pedidoDeAlta(await nuevoTelefono(), { cabeceras }));
    if (cabeceras[CABECERA.firma] === '') p.headers.delete(CABECERA.firma);
    const r = await enviar(p);
    expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
  });

  it('id de la ruta que no es un id: 400 formato', async () => {
    const a = await telefonoConAlta();
    const r = await enviar(await peticion({ metodo: 'GET', ruta: '/v1/incidents/corto', firmante: { telefono: a, id: a.id, clave: 'lectura' } }));
    expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
  });

  it('petición 121 del mismo dispositivo en lecturas: 429 limite con Retry-After: 60 (LIM-01)', async () => {
    const a = await telefonoConAlta();
    await enLaMismaVentana();
    for (let i = 0; i < 120; i++) expect((await enviar(await lectura(a, a.id))).status).toBe(404); // no existe, pero cuenta
    const r = await enviar(await lectura(a, a.id));
    expect([r.status, r.headers.get('Retry-After'), await r.text()]).toEqual([429, '60', '{"codigo":"limite"}']);
    // otro dispositivo tiene su propio cupo
    const b = await telefonoConAlta();
    expect((await enviar(await lectura(b, b.id))).status).toBe(404);
  }, 15_000);

  it('alta firmada con otra clave: 401 firma y no se guarda nada (FIR-04)', async () => {
    const t = await nuevoTelefono();
    const r = await enviar(await peticion(pedidoDeAlta(t, { firmante: { telefono: await nuevoTelefono(), id: 'registro' } })));
    expect([r.status, await r.text()]).toEqual([401, '{"codigo":"firma"}']);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM dispositivos WHERE spki = ?').bind(t.publica).first('n')).toBe(0);
  });
});
