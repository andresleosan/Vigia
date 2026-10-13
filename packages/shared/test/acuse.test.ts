import { describe, expect, it } from 'vitest';
import {
  analizarAcuse, analizarListaClaves, bytesEntradaClave, CLAVES_ACUSE_PRODUCCION, firmarAcuse, verificarAcuse,
  type ClavesAcuse, type EntradaClave,
} from '../src/acuse.ts';
import { b64u, deB64u, ErrorFormato, unir, utf8 } from '../src/codificacion.ts';
import { criptoWebCrypto } from '../src/cripto.ts';
import { claveAcuse } from './claves-prueba.ts';

const cripto = criptoWebCrypto();
const R = 'ab'.repeat(32);
const T = 1_791_799_200_000;
const DIA = 86_400_000;
const texto = (b: Uint8Array) => new TextDecoder().decode(b);

const activa = await claveAcuse('prueba_activa', 'activa', T - DIA);
const retirada = await claveAcuse('prueba_retirada', 'retirada', T - DIA, T);
const comprometida = await claveAcuse('prueba_comprometida', 'comprometida', T - DIA);
const dev = await claveAcuse('dev_local', 'activa', 0);
const impostora = await claveAcuse('prueba_activa', 'activa', 0);
const claves: ClavesAcuse = [activa.entrada, retirada.entrada, comprometida.entrada];

async function acuse(c: { privada: CryptoKey; entrada: EntradaClave }, hora = T, r = R) {
  return analizarAcuse(await firmarAcuse(cripto, c.privada, c.entrada.kid, r, hora));
}

describe('acuse (sección 7, ACU-01)', () => {
  it('bytes exactos y firma sobre vigia/v1/acuse ‖ 0x00 ‖ JCV del contenido', async () => {
    const bytes = await firmarAcuse(cripto, activa.privada, 'prueba_activa', R, T);
    const m = /^\{"firma":"([A-Za-z0-9_-]{86})","hora_servidor":1791799200000,"kid":"prueba_activa","r":"(?:ab){32}","v":1\}$/.exec(texto(bytes));
    expect(m).not.toBeNull();
    const firmado = utf8(`vigia/v1/acuse\0{"hora_servidor":1791799200000,"kid":"prueba_activa","r":"${R}","v":1}`);
    expect(await cripto.verificarP256(activa.entrada.spki, firmado, deB64u(m![1]))).toBe(true);
  });

  it('verifica con su clave activa', async () => {
    expect(await verificarAcuse(cripto, claves, await acuse(activa), R)).toBe('valido');
  });

  it('un bit cambiado en la firma o en el contenido no verifica', async () => {
    const a = await acuse(activa);
    const firma = deB64u(a.firma);
    firma[10] ^= 1;
    expect(await verificarAcuse(cripto, claves, { ...a, firma: b64u(firma) }, R)).toBe('invalido');
    expect(await verificarAcuse(cripto, claves, { ...a, hora_servidor: a.hora_servidor + 1 }, R)).toBe('invalido');
  });

  it('kid desconocido; la lista de producción frente a una clave de dev; el mismo kid con otra clave', async () => {
    expect(await verificarAcuse(cripto, claves, await acuse(dev), R)).toBe('desconocido');
    expect(CLAVES_ACUSE_PRODUCCION).toEqual([]);
    expect(await verificarAcuse(cripto, CLAVES_ACUSE_PRODUCCION, await acuse(dev), R)).toBe('desconocido');
    expect(await verificarAcuse(cripto, CLAVES_ACUSE_PRODUCCION, await acuse(activa), R)).toBe('desconocido');
    expect(await verificarAcuse(cripto, claves, await acuse(impostora), R)).toBe('invalido');
  });

  it('clave comprometida', async () => {
    expect(await verificarAcuse(cripto, claves, await acuse(comprometida), R)).toBe('comprometido');
  });

  it('ventana desde ≤ hora_servidor ≤ hasta, con los bordes dentro', async () => {
    expect(await verificarAcuse(cripto, claves, await acuse(retirada, T - DIA), R)).toBe('valido');
    expect(await verificarAcuse(cripto, claves, await acuse(retirada, T), R)).toBe('valido');
    expect(await verificarAcuse(cripto, claves, await acuse(retirada, T + 1), R)).toBe('invalido');
    expect(await verificarAcuse(cripto, claves, await acuse(activa, T - DIA - 1), R)).toBe('invalido');
  });

  it('r de otro registro no verifica', async () => {
    expect(await verificarAcuse(cripto, claves, await acuse(activa), 'cd'.repeat(32))).toBe('invalido');
  });

  it('analizarAcuse solo acepta el esquema exacto', async () => {
    const bueno = texto(await firmarAcuse(cripto, activa.privada, 'prueba_activa', R, T));
    const firma = /"firma":"([^"]+)"/.exec(bueno)![1];
    const malos: Record<string, string> = {
      v_2: bueno.replace('"v":1', '"v":2'),
      clave_de_mas: bueno.replace('"v":1}', '"v":1,"x":1}'),
      sin_firma: bueno.replace(`"firma":"${firma}",`, ''),
      kid_con_mayuscula: bueno.replace('prueba_activa', 'Prueba_activa'),
      r_en_mayusculas: bueno.replace(R, R.toUpperCase()),
      firma_no_canonica: bueno.replace(firma, `${firma.slice(0, -1)}B`),
      espacio: bueno.replace(',', ', '),
      salto_final: `${bueno}\n`,
    };
    for (const [nombre, t] of Object.entries(malos)) expect(() => analizarAcuse(utf8(t)), nombre).toThrow(ErrorFormato);
  });

  it('firmarAcuse no firma un kid o un r fuera del contrato', async () => {
    await expect(firmarAcuse(cripto, activa.privada, 'Kid', R, T)).rejects.toThrow(ErrorFormato);
    await expect(firmarAcuse(cripto, activa.privada, 'prueba', R.slice(2), T)).rejects.toThrow(ErrorFormato);
  });
});

describe('lista fijada de claves de acuse', () => {
  it('bytes exactos de una entrada, sin hasta y con él', () => {
    expect(texto(bytesEntradaClave(activa.entrada)))
      .toBe(`{"desde":${T - DIA},"estado":"activa","kid":"prueba_activa","spki":"${b64u(activa.entrada.spki)}","v":1}`);
    expect(texto(bytesEntradaClave(retirada.entrada)))
      .toBe(`{"desde":${T - DIA},"estado":"retirada","hasta":${T},"kid":"prueba_retirada","spki":"${b64u(retirada.entrada.spki)}","v":1}`);
  });

  it('una entrada por línea, ida y vuelta', () => {
    const archivo = unir(...claves.flatMap((e) => [bytesEntradaClave(e), Uint8Array.of(0x0a)]));
    expect(analizarListaClaves(archivo)).toEqual(claves);
    expect(analizarListaClaves(new Uint8Array(0))).toEqual([]);
  });

  it('rechaza una lista mal formada', () => {
    const spki = b64u(activa.entrada.spki);
    const una = `${texto(bytesEntradaClave(activa.entrada))}\n`;
    const malas: Record<string, string> = {
      sin_salto_final: una.slice(0, -1),
      linea_vacia: `${una}\n`,
      kid_repetido: una + una,
      retorno_de_carro: una.replace('\n', '\r\n'),
      estado_desconocido: una.replace('"activa"', '"caducada"'),
      spki_no_p256: una.replace(spki, b64u(Uint8Array.of(0x31, ...activa.entrada.spki.slice(1)))),
      spki_de_90: una.replace(spki, b64u(activa.entrada.spki.slice(0, 90))),
      hasta_antes_de_desde: `{"desde":10,"estado":"retirada","hasta":9,"kid":"prueba","spki":"${spki}","v":1}\n`,
    };
    for (const [nombre, t] of Object.entries(malas)) expect(() => analizarListaClaves(utf8(t)), nombre).toThrow(ErrorFormato);
  });
});
