import { describe, expect, it } from 'vitest';
import type { ClavesAcuse } from '../src/acuse.ts';
import { deB64u, ErrorFormato, utf8 } from '../src/codificacion.ts';
import { criptoWebCrypto } from '../src/cripto.ts';
import { analizarEvento, firmarEvento, verificarEvento, type Evento } from '../src/evento.ts';
import { claveAcuse } from './claves-prueba.ts';

const cripto = criptoWebCrypto();
const T = 1_791_799_200_000;
const HUELLA = 'ab'.repeat(32);
const texto = (b: Uint8Array) => new TextDecoder().decode(b);

const activa = await claveAcuse('prueba_activa', 'activa', T - 1000);
const comprometida = await claveAcuse('prueba_comprometida', 'comprometida', 0);
const dev = await claveAcuse('dev_local', 'activa', 0);
const claves: ClavesAcuse = [activa.entrada, comprometida.entrada];
const ALERTA: Omit<Evento, 'firma'> = {
  v: 1, evento: 'alerta', dispositivo: HUELLA, incidente: 'incidente-de-prueba-01', hora_servidor: T, kid: 'prueba_activa',
};

describe('evento del servidor (sección 8)', () => {
  it('bytes exactos y firma sobre vigia/v1/evento ‖ 0x00 ‖ JCV del contenido', async () => {
    const m = /^\{"dispositivo":"(?:ab){32}","evento":"alerta","firma":"([A-Za-z0-9_-]{86})","hora_servidor":1791799200000,"incidente":"incidente-de-prueba-01","kid":"prueba_activa","v":1\}$/
      .exec(texto(await firmarEvento(cripto, activa.privada, ALERTA)));
    expect(m).not.toBeNull();
    const firmado = utf8(`vigia/v1/evento\0{"dispositivo":"${HUELLA}","evento":"alerta","hora_servidor":1791799200000,"incidente":"incidente-de-prueba-01","kid":"prueba_activa","v":1}`);
    expect(await cripto.verificarP256(activa.entrada.spki, firmado, deB64u(m![1]))).toBe(true);
  });

  it('con destino y con incidente "-"', async () => {
    const acceso = { ...ALERTA, evento: 'acceso', destino: 'contacto-de-prueba-001', incidente: '-' };
    expect(texto(await firmarEvento(cripto, activa.privada, acceso))).toMatch(
      /^\{"destino":"contacto-de-prueba-001","dispositivo":"(?:ab){32}","evento":"acceso","firma":"[A-Za-z0-9_-]{86}","hora_servidor":1791799200000,"incidente":"-","kid":"prueba_activa","v":1\}$/);
  });

  it('ida y vuelta y verificación con la lista fijada', async () => {
    const e = analizarEvento(await firmarEvento(cripto, activa.privada, ALERTA));
    expect(e).toEqual({ ...ALERTA, firma: e.firma });
    expect(await verificarEvento(cripto, claves, e)).toBe('valido');
  });

  it('un evento de otro dispositivo o de otro incidente no verifica', async () => {
    const e = analizarEvento(await firmarEvento(cripto, activa.privada, ALERTA));
    expect(await verificarEvento(cripto, claves, { ...e, dispositivo: 'cd'.repeat(32) })).toBe('invalido');
    expect(await verificarEvento(cripto, claves, { ...e, incidente: '-' })).toBe('invalido');
  });

  it('kid desconocido, clave comprometida y fuera de la ventana', async () => {
    const de = async (c: typeof activa, cambio: Partial<Evento> = {}) =>
      verificarEvento(cripto, claves, analizarEvento(await firmarEvento(cripto, c.privada, { ...ALERTA, kid: c.entrada.kid, ...cambio })));
    expect(await de(dev)).toBe('desconocido');
    expect(await de(comprometida)).toBe('comprometido');
    expect(await de(activa, { hora_servidor: T - 1001 })).toBe('invalido');
  });

  it('un nombre fuera de ^[a-z_]{1,32}$ no se firma ni se analiza', async () => {
    for (const evento of ['Alerta', 'alerta1', 'a.b', '', 'a'.repeat(33)]) {
      await expect(firmarEvento(cripto, activa.privada, { ...ALERTA, evento }), evento).rejects.toThrow(ErrorFormato);
    }
    const bueno = texto(await firmarEvento(cripto, activa.privada, ALERTA));
    expect(() => analizarEvento(utf8(bueno.replace('"alerta"', '"alerta1"')))).toThrow(ErrorFormato);
  });

  it('rechaza destino, dispositivo o incidente fuera del esquema', async () => {
    const malos: Partial<Evento>[] = [{ destino: 'corto' }, { dispositivo: 'ab' }, { dispositivo: HUELLA.toUpperCase() }, { incidente: 'x' }];
    for (const cambio of malos) {
      await expect(firmarEvento(cripto, activa.privada, { ...ALERTA, ...cambio }), JSON.stringify(cambio)).rejects.toThrow(ErrorFormato);
    }
  });
});
