import { describe, expect, it } from 'vitest';
import { b64u, ErrorFormato, utf8 } from '../src/codificacion.ts';
import {
  analizarCuerpoAlta, analizarCuerpoCierre, analizarCuerpoIncidente, CODIGOS, cuerpoAlta, cuerpoCierre,
  cuerpoIncidente, ESTADO_DE, MAX_JSON, RUTA, rutaCierre, rutaFragmento, rutaIncidente, type CuerpoIncidente,
} from '../src/contratos.ts';
import { claveP256 } from './claves-prueba.ts';

const PUBLICA = b64u((await claveP256()).spki);
const LECTURA = b64u((await claveP256()).spki);
const ID = 'incidente-de-prueba-01';
const CONTACTO = 'contacto-de-prueba-001';
const k = (n: number) => b64u(new Uint8Array(n).fill(9));
const R = b64u(utf8('{"tipo":"apertura"}'));
const S = b64u(new Uint8Array(64).fill(1));
const INCIDENTE: CuerpoIncidente = {
  envolturas: [{ destino: CONTACTO, k: k(80), rol: 'contacto' }, { destino: '-', k: k(80), rol: 'escucha' }],
  meta: b64u(new Uint8Array(10)),
  r: R,
  s: S,
};
const texto = (b: Uint8Array) => new TextDecoder().decode(b);
const json = (o: unknown) => utf8(JSON.stringify(o));

describe('códigos y rutas (sección 11)', () => {
  it('lista cerrada de códigos con su estado HTTP', () => {
    expect(CODIGOS).toEqual(['formato', 'hash', 'firma', 'hora', 'no_existe', 'conflicto', 'demasiado_grande',
      'tipo_contenido', 'limite', 'cuota', 'tope_altas', 'interno']);
    expect(ESTADO_DE).toEqual({ formato: 400, hash: 400, firma: 401, hora: 401, no_existe: 404, conflicto: 409,
      demasiado_grande: 413, tipo_contenido: 415, limite: 429, cuota: 429, tope_altas: 429, interno: 500 });
    expect(MAX_JSON).toBe(16_384);
  });

  it('rutas canónicas', () => {
    expect(RUTA).toEqual({ dispositivos: '/v1/devices', incidentes: '/v1/incidents' });
    expect(rutaIncidente(ID)).toBe('/v1/incidents/incidente-de-prueba-01');
    expect(rutaFragmento(ID, 0)).toBe('/v1/incidents/incidente-de-prueba-01/chunks/0');
    expect(rutaFragmento(ID, 999_999)).toBe('/v1/incidents/incidente-de-prueba-01/chunks/999999');
    expect(rutaCierre(ID)).toBe('/v1/incidents/incidente-de-prueba-01/close');
  });

  it('rechaza ids y seq fuera del contrato', () => {
    for (const id of ['', 'corto', `${ID}x`, 'incidente/de/prueba/01', 'incidente%de%prueba%01']) {
      expect(() => rutaIncidente(id), id).toThrow(ErrorFormato);
    }
    for (const seq of [-1, 1_000_000, 1.5, Number.NaN]) {
      expect(() => rutaFragmento(ID, seq), String(seq)).toThrow(ErrorFormato);
    }
  });
});

describe('cuerpos JSON de la API (sección 11)', () => {
  it('alta: serialización fija', () => {
    expect(texto(cuerpoAlta({ lectura: LECTURA, publica: PUBLICA }))).toBe(`{"lectura":"${LECTURA}","publica":"${PUBLICA}"}`);
  });

  it('apertura: serialización fija, con meta y sin ella', () => {
    const env = `[{"destino":"${CONTACTO}","k":"${k(80)}","rol":"contacto"},{"destino":"-","k":"${k(80)}","rol":"escucha"}]`;
    expect(texto(cuerpoIncidente(INCIDENTE))).toBe(`{"envolturas":${env},"meta":"${INCIDENTE.meta}","r":"${R}","s":"${S}"}`);
    expect(texto(cuerpoIncidente({ envolturas: [], r: R, s: S }))).toBe(`{"envolturas":[],"r":"${R}","s":"${S}"}`);
  });

  it('cierre: serialización fija', () => {
    expect(texto(cuerpoCierre({ r: R, s: S }))).toBe(`{"r":"${R}","s":"${S}"}`);
  });

  it('el servidor acepta cualquier JSON válido con el esquema', () => {
    expect(analizarCuerpoCierre(utf8(` {\n "s": "${S}", "r": "${R}" } `))).toEqual({ r: R, s: S });
    expect(analizarCuerpoIncidente(cuerpoIncidente(INCIDENTE))).toEqual(INCIDENTE);
    expect(analizarCuerpoAlta(json({ publica: PUBLICA, lectura: LECTURA }))).toEqual({ lectura: LECTURA, publica: PUBLICA });
  });

  it('alta: rechaza claves desconocidas, tipos malos, una pública que no es P-256 de 91 bytes y la lectura igual a la pública', () => {
    const malos: Record<string, unknown> = {
      clave_desconocida: { lectura: LECTURA, publica: PUBLICA, extra: 'x' },
      falta_lectura: { publica: PUBLICA },
      tipo_malo: { lectura: 5, publica: PUBLICA },
      spki_de_90: { lectura: b64u(new Uint8Array(90)), publica: PUBLICA },
      misma_clave: { lectura: PUBLICA, publica: PUBLICA },
    };
    for (const [nombre, o] of Object.entries(malos)) expect(() => analizarCuerpoAlta(json(o)), nombre).toThrow(ErrorFormato);
  });

  it('apertura: rechaza claves desconocidas, tipos malos, más de 5 envolturas, pares repetidos y k que no mide 80 bytes', () => {
    const env = (rol: string, destino: string, kk = k(80)) => ({ destino, k: kk, rol });
    const base = { envolturas: [], r: R, s: S };
    const malos: Record<string, unknown> = {
      clave_desconocida: { ...base, extra: 1 },
      clave_desconocida_en_envoltura: { ...base, envolturas: [{ ...env('escucha', '-'), x: 1 }] },
      envolturas_no_array: { ...base, envolturas: {} },
      r_no_cadena: { ...base, r: 7 },
      meta_nula: { ...base, meta: null },
      seis_envolturas: { ...base, envolturas: ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => env('contacto', `contacto-de-prueba-00${x}`)) },
      par_repetido: { ...base, envolturas: [env('escucha', '-'), env('escucha', '-')] },
      k_de_79: { ...base, envolturas: [env('escucha', '-', k(79))] },
      k_de_81: { ...base, envolturas: [env('escucha', '-', k(81))] },
      rol_desconocido: { ...base, envolturas: [env('vecino', '-')] },
      contacto_sin_id: { ...base, envolturas: [env('contacto', '-')] },
      escucha_con_id: { ...base, envolturas: [env('escucha', CONTACTO)] },
      meta_vacia: { ...base, meta: '' },
      meta_de_4097: { ...base, meta: b64u(new Uint8Array(4097)) },
      s_de_63: { ...base, s: b64u(new Uint8Array(63)) },
      s_no_canonica: { ...base, s: `${S.slice(0, -1)}B` },
      raiz_array: [base],
    };
    for (const [nombre, o] of Object.entries(malos)) expect(() => analizarCuerpoIncidente(json(o)), nombre).toThrow(ErrorFormato);
  });

  it('rechaza lo que no es JSON en UTF-8 estricto, también con BOM', () => {
    const bueno = cuerpoCierre({ r: R, s: S });
    const malos: Record<string, Uint8Array> = {
      vacio: new Uint8Array(0),
      cortado: utf8('{"r":'),
      con_bom: Uint8Array.of(0xef, 0xbb, 0xbf, ...bueno),
      utf8_invalido: Uint8Array.of(...bueno.slice(0, 5), 0xff, ...bueno.slice(5)),
      nulo: utf8('null'),
    };
    for (const [nombre, b] of Object.entries(malos)) expect(() => analizarCuerpoCierre(b), nombre).toThrow(ErrorFormato);
  });

  it('nunca serializa un cuerpo que el servidor rechazaría', () => {
    expect(() => cuerpoIncidente({ ...INCIDENTE, envolturas: [...INCIDENTE.envolturas, ...INCIDENTE.envolturas] })).toThrow(ErrorFormato);
    expect(() => cuerpoCierre({ r: R, s: 'no es b64u' })).toThrow(ErrorFormato);
    expect(() => cuerpoAlta({ lectura: PUBLICA, publica: PUBLICA })).toThrow(ErrorFormato);
  });
});
