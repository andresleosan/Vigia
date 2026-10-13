import { describe, expect, it } from 'vitest';
import { TIPO_JSON, TIPO_SOBRE } from '../src/errores.ts';
import { enviar, peticion, telefonoConAlta } from './ayudas.ts';

// ENT-01: casos 400, 415 y 404 de cada ruta de H1 (los de la forma de cada cuerpo están en su archivo).
const MAL = 'id-mal';
const BIEN = 'n'.repeat(22);

describe('validación de entrada por ruta (ENT-01)', () => {
  it.each([
    ['POST', '/v1/incidents', TIPO_JSON],
    ['PUT', `/v1/incidents/${BIEN}/chunks/1`, TIPO_SOBRE],
    ['POST', `/v1/incidents/${BIEN}/close`, TIPO_JSON],
    ['POST', '/v1/devices', TIPO_JSON],
  ])('%s %s con otro Content-Type: 415', async (metodo, ruta, tipo) => {
    const otro = tipo === TIPO_JSON ? TIPO_SOBRE : TIPO_JSON;
    const r = await enviar(await peticion({ metodo, ruta, tipo: otro, cuerpo: new Uint8Array(10) }));
    expect([r.status, await r.text()]).toEqual([415, '{"codigo":"tipo_contenido"}']);
  });

  it.each([
    ['GET', `/v1/incidents/${MAL}`, undefined],
    ['GET', `/v1/incidents/${MAL}/chunks/0`, undefined],
    ['GET', `/v1/incidents/${MAL}/close`, undefined],
    ['PUT', `/v1/incidents/${MAL}/chunks/1`, TIPO_SOBRE],
    ['POST', `/v1/incidents/${MAL}/close`, TIPO_JSON],
  ])('%s %s con un id mal formado: 400 formato', async (metodo, ruta, tipo) => {
    const a = await telefonoConAlta();
    const firmante = { telefono: a, id: a.id, clave: metodo === 'GET' ? 'lectura' as const : 'dispositivo' as const };
    const r = await enviar(await peticion({ metodo, ruta, tipo, cuerpo: new Uint8Array(10), firmante }));
    expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
  });

  it.each([
    ['GET', `/v1/incidents/${BIEN}/chunks`],
    ['DELETE', `/v1/incidents/${BIEN}`],
    ['PUT', '/v1/devices'],
    ['GET', `/v1/incidents/${BIEN}/chunks/1/x`],
  ])('%s %s: 404 no_existe', async (metodo, ruta) => {
    const r = await enviar(await peticion({ metodo, ruta }));
    expect([r.status, await r.text()]).toEqual([404, '{"codigo":"no_existe"}']);
  });
});
