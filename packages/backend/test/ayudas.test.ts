import { env } from 'cloudflare:workers';
import { CABECERA, esSpkiP256, hex, verificarPeticion } from '@vigia/shared';
import { describe, expect, it } from 'vitest';
import { clavesAcuse, cripto, d1QueFalla, enviar, nuevoTelefono, peticion, revocar, T } from './ayudas.ts';

describe('ayudas de las pruebas del backend', () => {
  it('teléfono: dos públicas P-256 de 91 bytes, privadas no extraíbles y huella SHA-256', async () => {
    const t = await nuevoTelefono();
    expect(esSpkiP256(t.publica) && esSpkiP256(t.lectura)).toBe(true);
    expect(t.privada.extractable || t.privadaLectura.extractable).toBe(false);
    expect(t.huella).toBe(hex(await cripto.sha256(t.publica)));
  });

  it('petición firmada: cabeceras de la sección 9 y firma que verifica; el alta va sin X-Vigia-Dispositivo', async () => {
    const t = await nuevoTelefono();
    const cuerpo = new TextEncoder().encode('{}');
    const p = await peticion({ metodo: 'POST', ruta: '/v1/devices', cuerpo, firmante: { telefono: t, id: 'registro' }, idPeticion: 'p'.repeat(22) });
    expect(p.headers.has(CABECERA.dispositivo)).toBe(false);
    expect(p.headers.get(CABECERA.hora)).toBe(String(T));
    expect(p.headers.get(CABECERA.peticion)).toBe('p'.repeat(22));
    const datos = { metodo: 'POST', ruta: '/v1/devices', hora: T, idPeticion: 'p'.repeat(22), idDispositivo: 'registro', cuerpo };
    expect(await verificarPeticion(cripto, t.publica, datos, p.headers.get(CABECERA.firma) ?? '')).toBe(true);
    const lectura = await peticion({ metodo: 'GET', ruta: '/v1/incidents/' + 'i'.repeat(22), firmante: { telefono: t, id: 'd'.repeat(22), clave: 'lectura' } });
    expect(lectura.headers.get(CABECERA.dispositivo)).toBe('d'.repeat(22));
  });

  it('enviar usa la app de crearApp; claves de acuse de la configuración y revocación por fixture', async () => {
    expect((await enviar(new Request('https://api.prueba/v1/nada'))).status).toBe(404);
    expect(clavesAcuse()).toEqual([{ kid: env.KID_ACUSE, spki: expect.any(Uint8Array), estado: 'activa', desde: 0 }]);
    expect(esSpkiP256(clavesAcuse()[0].spki)).toBe(true);
    await env.DB.prepare('INSERT INTO dispositivos (id, spki, spki_lectura, huella) VALUES (?, ?, ?, ?)')
      .bind('r'.repeat(22), new Uint8Array(91), new Uint8Array(91).fill(1), 'f'.repeat(64)).run();
    await revocar('r'.repeat(22), T);
    expect(await env.DB.prepare('SELECT revocado_en FROM dispositivos WHERE id = ?').bind('r'.repeat(22)).first('revocado_en')).toBe(T);
  });

  it('d1QueFalla: el primer batch falla y no deja nada; el segundo pasa', async () => {
    const db = d1QueFalla(env.DB);
    const insertar = () => db.prepare('INSERT INTO altas_por_hora (hora, n) VALUES (1, 1) ON CONFLICT (hora) DO UPDATE SET n = n + 1');
    await expect(db.batch([insertar()])).rejects.toThrow('CHECK constraint failed');
    expect(await env.DB.prepare('SELECT count(*) AS n FROM altas_por_hora WHERE hora = 1').first('n')).toBe(0);
    await db.batch([insertar()]);
    expect(await env.DB.prepare('SELECT n FROM altas_por_hora WHERE hora = 1').first('n')).toBe(1);
  });
});
