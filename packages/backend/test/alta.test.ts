import { env } from 'cloudflare:workers';
import { b64u, cuerpoAlta, deHex, hex, MAX_JSON, PATRON_ID } from '@vigia/shared';
import { describe, expect, it } from 'vitest';
import { TIPO_JSON } from '../src/errores.ts';
import { alta, BASE, cripto, enviar, nuevoTelefono, pedidoDeAlta, peticion, revocar, T, type Telefono } from './ayudas.ts';

const HORA = 3_600_000;
const utf8 = (t: string) => new TextEncoder().encode(t);
const n = async (sql: string, ...v: unknown[]) => Number(await env.DB.prepare(sql).bind(...v).first('n'));
const altasDeLaHora = (ahora: number) => n('SELECT coalesce(max(n), 0) AS n FROM altas_por_hora WHERE hora = ?', Math.floor(ahora / HORA));

describe('POST /v1/devices (sección 11, FIR-04, OPS-02)', () => {
  it('201 con un id nuevo; guarda las dos públicas y la huella, y cuenta el alta', async () => {
    const t = await nuevoTelefono();
    const ahora = T + 10 * HORA;
    const r = await enviar(await peticion(pedidoDeAlta(t, { hora: ahora })), ahora);
    expect(r.status).toBe(201);
    expect(r.headers.get('Content-Type')).toBe('application/json');
    const cuerpo = await r.text();
    const id = (JSON.parse(cuerpo) as { dispositivo: string }).dispositivo;
    expect(cuerpo).toBe(`{"dispositivo":"${id}"}`);
    expect(id).toMatch(PATRON_ID);
    const fila = await env.DB.prepare('SELECT spki, spki_lectura, huella, revocado_en FROM dispositivos WHERE id = ?').bind(id).first<{ spki: number[]; spki_lectura: number[]; huella: string; revocado_en: null }>();
    expect(new Uint8Array(fila!.spki)).toEqual(t.publica);
    expect(new Uint8Array(fila!.spki_lectura)).toEqual(t.lectura);
    expect(fila!.huella).toBe(hex(await cripto.sha256(t.publica)));
    expect(await altasDeLaHora(ahora)).toBe(1);
    expect(await n("SELECT valor AS n FROM contadores WHERE dia = ? AND nombre = 'altas'", Math.floor(ahora / 86_400_000))).toBeGreaterThan(0);
  });

  it('alta repetida: 200 con el mismo id y sin gastar tope', async () => {
    const t = await nuevoTelefono();
    const ahora = T + 11 * HORA;
    const id = await alta(t, ahora);
    const solo1 = { ...env, TOPE_ALTAS_HORA: '1' }; // la hora ya está llena
    const r = await enviar(await peticion(pedidoDeAlta(t, { hora: ahora })), ahora, solo1);
    expect([r.status, await r.text()]).toEqual([200, `{"dispositivo":"${id}"}`]);
    expect(await altasDeLaHora(ahora)).toBe(1);
  });

  it('dos altas iguales a la vez: un 201 y un 200 con el mismo id', async () => {
    const t = await nuevoTelefono();
    const respuestas = await Promise.all([1, 2].map(async () => enviar(await peticion(pedidoDeAlta(t)))));
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    const [x, y] = await Promise.all(respuestas.map((r) => r.text()));
    expect(x).toBe(y);
    expect(await n('SELECT count(*) AS n FROM dispositivos WHERE spki = ?', t.publica)).toBe(1);
  });

  it('la misma pública con otra lectura: 409 conflicto y la lectura no cambia', async () => {
    const t = await nuevoTelefono();
    const id = await alta(t);
    const otra = await nuevoTelefono();
    const cuerpo = cuerpoAlta({ lectura: b64u(otra.lectura), publica: b64u(t.publica) });
    const r = await enviar(await peticion(pedidoDeAlta(t, { cuerpo })));
    expect([r.status, await r.text()]).toEqual([409, '{"codigo":"conflicto"}']);
    const fila = await env.DB.prepare('SELECT spki_lectura FROM dispositivos WHERE id = ?').bind(id).first<{ spki_lectura: number[] }>();
    expect(new Uint8Array(fila!.spki_lectura)).toEqual(t.lectura);
  });

  it('pública revocada: 401 firma', async () => {
    const t = await nuevoTelefono();
    await revocar(await alta(t));
    const r = await enviar(await peticion(pedidoDeAlta(t)));
    expect([r.status, await r.text()]).toEqual([401, '{"codigo":"firma"}']);
  });

  it('100 altas a la vez con tope 2: 2 creadas y 98 con 429 tope_altas hasta la hora siguiente', async () => {
    const ahora = (Math.floor(T / HORA) + 20) * HORA + 1_000; // la hora siguiente empieza 3 599 s después
    const tope2 = { ...env, TOPE_ALTAS_HORA: '2' };
    const telefonos = await Promise.all(Array.from({ length: 100 }, () => nuevoTelefono()));
    const peticiones = await Promise.all(telefonos.map((t) => peticion(pedidoDeAlta(t, { hora: ahora }))));
    const respuestas = await Promise.all(peticiones.map((p) => enviar(p, ahora, tope2)));
    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(2);
    const rechazos = respuestas.filter((r) => r.status === 429);
    expect(rechazos).toHaveLength(98);
    expect(new Set(await Promise.all(rechazos.map((r) => r.text())))).toEqual(new Set(['{"codigo":"tope_altas"}']));
    expect(new Set(rechazos.map((r) => r.headers.get('Retry-After')))).toEqual(new Set(['3599']));
    expect(await altasDeLaHora(ahora)).toBe(100);
    const creados = await Promise.all(telefonos.map((t) => n('SELECT count(*) AS n FROM dispositivos WHERE spki = ?', t.publica)));
    expect(creados.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('en la hora siguiente vuelve a haber sitio', async () => {
    const ahora = (Math.floor(T / HORA) + 21) * HORA;
    const tope2 = { ...env, TOPE_ALTAS_HORA: '2' };
    const r = await enviar(await peticion(pedidoDeAlta(await nuevoTelefono(), { hora: ahora })), ahora, tope2);
    expect(r.status).toBe(201);
  });

  describe('forma (paso 1)', () => {
    const FUERA_DE_CURVA = deHex('3059301306072a8648ce3d020106082a8648ce3d03010703420004' + '07'.repeat(64));
    const crudo = (lectura: Uint8Array, publica: Uint8Array) => utf8(`{"lectura":"${b64u(lectura)}","publica":"${b64u(publica)}"}`);
    // La misma clave en SPKI comprimida (59 bytes): WebCrypto la importaría.
    const comprimida = (spki: Uint8Array) => Uint8Array.of(...deHex('3039301306072a8648ce3d020106082a8648ce3d030107032200'), 2 + (spki[90] & 1), ...spki.subarray(27, 59));

    it.each<[string, (t: Telefono) => Uint8Array]>([
      ['pública de 90 bytes', (t) => crudo(t.lectura, t.publica.subarray(1))],
      ['pública comprimida', (t) => crudo(t.lectura, comprimida(t.publica))],
      ['pública igual a la lectura', (t) => crudo(t.publica, t.publica)],
      ['pública fuera de la curva', (t) => crudo(t.lectura, FUERA_DE_CURVA)],
      ['lectura fuera de la curva', (t) => crudo(FUERA_DE_CURVA, t.publica)],
      ['clave desconocida', (t) => utf8(`{"lectura":"${b64u(t.lectura)}","otra":1,"publica":"${b64u(t.publica)}"}`)],
      ['BOM al principio', (t) => new Uint8Array([0xef, 0xbb, 0xbf, ...crudo(t.lectura, t.publica)])],
      ['UTF-8 inválido', () => new Uint8Array([0x7b, 0xff, 0x7d])],
      ['cuerpo vacío', () => new Uint8Array(0)],
    ])('%s: 400 formato', async (_caso, cuerpo) => {
      const t = await nuevoTelefono();
      const r = await enviar(await peticion(pedidoDeAlta(t, { cuerpo: cuerpo(t) })));
      expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
    });

    it.each([
      ['con parámetros', { 'Content-Type': 'application/json; charset=utf-8' }],
      ['otro tipo', { 'Content-Type': 'text/plain' }],
      ['en mayúsculas', { 'Content-Type': 'Application/JSON' }],
      ['con Content-Encoding', { 'Content-Encoding': 'gzip' }],
    ])('Content-Type %s: 415 tipo_contenido', async (_caso, cabeceras) => {
      const r = await enviar(await peticion(pedidoDeAlta(await nuevoTelefono(), { cabeceras })));
      expect([r.status, await r.text()]).toEqual([415, '{"codigo":"tipo_contenido"}']);
    });

    it('sin Content-Type: 415, y antes que el 413 de un cuerpo enorme', async () => {
      const sinTipo = await enviar(await peticion(pedidoDeAlta(await nuevoTelefono(), { tipo: undefined })));
      expect(sinTipo.status).toBe(415);
      const enorme = await enviar(await peticion(pedidoDeAlta(await nuevoTelefono(), { tipo: 'text/plain', cuerpo: new Uint8Array(100_000) })));
      expect([enorme.status, await enorme.text()]).toEqual([415, '{"codigo":"tipo_contenido"}']);
    });

    it('16 385 bytes: 413 con Content-Length, sin él y con un Content-Length que miente', async () => {
      const grande = new Uint8Array(MAX_JSON + 1).fill(0x20);
      const pedir = (init: RequestInit) => enviar(new Request(BASE + '/v1/devices', { method: 'POST', ...init }));
      const conLongitud = await pedir({ headers: { 'Content-Type': TIPO_JSON, 'Content-Length': String(grande.length) }, body: grande });
      const sinLongitud = await pedir({ headers: { 'Content-Type': TIPO_JSON }, body: new Blob([grande]).stream() });
      const mentirosa = await pedir({ headers: { 'Content-Type': TIPO_JSON, 'Content-Length': '10' }, body: new Blob([grande]).stream() });
      for (const r of [conLongitud, sinLongitud, mentirosa]) expect([r.status, await r.text()]).toEqual([413, '{"codigo":"demasiado_grande"}']);
      // 16 384 bytes no pasan del límite: siguen al paso de las cabeceras
      const justo = await pedir({ headers: { 'Content-Type': TIPO_JSON }, body: new Blob([grande.subarray(1)]).stream() });
      expect([justo.status, await justo.text()]).toEqual([400, '{"codigo":"formato"}']);
    });
  });
});
