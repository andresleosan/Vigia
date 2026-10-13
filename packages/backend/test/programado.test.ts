import { createScheduledController } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import trabajador from '../src/index.ts';
import { programado } from '../src/programado.ts';

const T = 1_760_000_000_000;

async function fila(idPeticion: string, creado: number) {
  await env.DB.prepare('INSERT INTO antirreenvio (dispositivo, id_peticion, h, estado, cuerpo, creado) VALUES (?, ?, ?, 201, ?, ?)')
    .bind('dispositivoDePrueba000A', idPeticion, 'f'.repeat(64), new Uint8Array(1), creado).run();
}

const quedan = async () => (await env.DB.prepare('SELECT id_peticion FROM antirreenvio ORDER BY id_peticion').run<{ id_peticion: string }>()).results.map((f) => f.id_peticion);

describe('scheduled: filas anti-reenvío (PRIV-01)', () => {
  it('borra solo las de ahora − creado > 600 000 ms: la frontera exacta se queda', async () => {
    await fila('a'.repeat(22), T - 600_001);
    await fila('b'.repeat(22), T - 600_000);
    await fila('c'.repeat(22), T);
    await programado(env, T);
    expect(await quedan()).toEqual(['b'.repeat(22), 'c'.repeat(22)]);
    await programado(env, T + 1);
    expect(await quedan()).toEqual(['c'.repeat(22)]);
  });

  it('el scheduled del export default borra con Date.now', async () => {
    await fila('d'.repeat(22), Date.now() - 700_000);
    await fila('e'.repeat(22), Date.now());
    await trabajador.scheduled(createScheduledController(), env);
    expect(await quedan()).toContain('e'.repeat(22));
    expect(await quedan()).not.toContain('d'.repeat(22));
  });
});
