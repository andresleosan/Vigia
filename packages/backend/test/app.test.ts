import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../src/app.ts';
import trabajador from '../src/index.ts';

const CONSOLA = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;

function pedir(ruta: string, metodo = 'GET') {
  const app = crearApp({ ahora: () => 1_760_000_000_000 });
  // Rutas solo de esta prueba: una excepción cualquiera y un error real de D1 con SQL en el mensaje.
  app.get('/v1/prueba/excepcion', () => { throw new Error('SQLITE_ERROR: no such table: dispositivos'); });
  app.get('/v1/prueba/d1', async (c) => { await c.env.DB.prepare('SELECT * FROM tabla_que_no_existe').run(); return c.text('nunca'); });
  return app.fetch(new Request(`https://api.prueba${ruta}`, { method: metodo }), env);
}

async function esperar(r: Response, estado: number, cuerpo: string) {
  expect(r.status).toBe(estado);
  expect(r.headers.get('Content-Type')).toBe('application/json');
  expect(await r.text()).toBe(cuerpo);
}

describe('paso 0, notFound y onError (ERR-01, LOG-01)', () => {
  let espias: ReturnType<typeof vi.spyOn>[] = [];
  beforeEach(() => { espias = CONSOLA.map((m) => vi.spyOn(console, m)); });
  afterEach(() => {
    for (const e of espias) expect(e).not.toHaveBeenCalled(); // el Worker nunca escribe en la consola
    vi.restoreAllMocks();
  });

  it.each(['/v1/devices%2F', '/v1/incidents/%41%41', '/v1/incidents/a.b', '/v1/incidents/a b'])('path %s fuera de [A-Za-z0-9/_-]: 400 formato', async (ruta) => {
    await esperar(await pedir(ruta), 400, '{"codigo":"formato"}');
  });

  it.each(['/v1/devices?x=1', '/v1/devices?', '/v1/nada?'])('URL cruda con ? (%s): 401 firma, aunque la query esté vacía (FIR-01)', async (ruta) => {
    await esperar(await pedir(ruta, 'POST'), 401, '{"codigo":"firma"}');
  });

  it.each(['/', '/v1/nada', '/v1//devices', '/v1/devices/'])('ruta desconocida %s: 404 no_existe', async (ruta) => {
    await esperar(await pedir(ruta), 404, '{"codigo":"no_existe"}');
  });

  it.each(['/v1/prueba/excepcion', '/v1/prueba/d1'])('excepción en %s: 500 interno, sin pila, sin SQL y sin nombres de tablas', async (ruta) => {
    const r = await pedir(ruta);
    await esperar(r.clone(), 500, '{"codigo":"interno"}');
    expect(await r.text()).not.toMatch(/SQLITE|D1_|dispositivos|tabla_que_no_existe|Error|at /);
  });

  it('el export default usa la app con Date.now', async () => {
    await esperar(await trabajador.fetch(new Request('https://api.prueba/v1/nada'), env), 404, '{"codigo":"no_existe"}');
  });
});
