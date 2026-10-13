import { describe, expect, it } from 'vitest';
import { b64u, deB64u, ErrorFormato, utf8 } from '../src/codificacion.ts';
import { criptoWebCrypto } from '../src/cripto.ts';
import {
  CABECERA, cadenaPeticion, firmarPeticion, resumenPeticion, VENTANA_HORA_MS, verificarPeticion, type DatosPeticion,
} from '../src/peticion.ts';
import { claveP256 } from './claves-prueba.ts';

const cripto = criptoWebCrypto();
const VACIO = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // SHA-256 de 0 bytes
const dispositivo = await claveP256();
const otra = await claveP256();
const d: DatosPeticion = {
  metodo: 'POST',
  ruta: '/v1/incidents/incidente-de-prueba-01/close',
  hora: 1_791_799_200_000,
  idPeticion: 'peticion-de-prueba-001',
  idDispositivo: 'dispositivo-de-prueba1',
  cuerpo: utf8('{"r":"x","s":"y"}'),
};
const texto = (b: Uint8Array) => new TextDecoder().decode(b);

describe('firma de las peticiones (sección 9)', () => {
  it('cadena exacta', async () => {
    expect(texto(await cadenaPeticion(cripto, d))).toBe('vigia/v1/peticion\0POST\n/v1/incidents/incidente-de-prueba-01/close\n'
      + '1791799200000\npeticion-de-prueba-001\ndispositivo-de-prueba1\n5f75e0153ad5156389fa12a22bd3ac1526ab6ad1af81f7c42fbbf9cf63cceed4');
  });

  it('alta: ID_DISPOSITIVO es el literal registro y el cuerpo vacío se resume como SHA-256 de 0 bytes', async () => {
    const alta = { ...d, ruta: '/v1/devices', idDispositivo: 'registro', cuerpo: new Uint8Array(0) };
    expect(texto(await cadenaPeticion(cripto, alta)))
      .toBe(`vigia/v1/peticion\0POST\n/v1/devices\n1791799200000\npeticion-de-prueba-001\nregistro\n${VACIO}`);
  });

  it('firma y verifica; cambiar el método, la ruta, la hora, un id o el cuerpo la invalida', async () => {
    const firma = await firmarPeticion(cripto, dispositivo.privada, d);
    expect(deB64u(firma)).toHaveLength(64);
    expect(await verificarPeticion(cripto, dispositivo.spki, d, firma)).toBe(true);
    const cambios: Record<string, Partial<DatosPeticion>> = {
      metodo: { metodo: 'PUT' },
      ruta: { ruta: '/v1/incidents/incidente-de-prueba-02/close' },
      hora: { hora: d.hora + 1 },
      idPeticion: { idPeticion: 'peticion-de-prueba-002' },
      idDispositivo: { idDispositivo: 'dispositivo-de-prueba2' },
      cuerpo: { cuerpo: utf8('{"r":"x","s":"z"}') },
    };
    for (const [nombre, cambio] of Object.entries(cambios)) {
      expect(await verificarPeticion(cripto, dispositivo.spki, { ...d, ...cambio }, firma), nombre).toBe(false);
    }
  });

  it('no verifica con otra clave, con una firma que no es b64u de 64 bytes ni con una ruta con query', async () => {
    const firma = await firmarPeticion(cripto, dispositivo.privada, d);
    expect(await verificarPeticion(cripto, dispositivo.spki, d, await firmarPeticion(cripto, otra.privada, d))).toBe(false);
    for (const mala of ['', 'no es b64u', b64u(deB64u(firma).slice(0, 63)), `${firma}AA`]) {
      expect(await verificarPeticion(cripto, dispositivo.spki, d, mala), mala).toBe(false);
    }
    expect(await verificarPeticion(cripto, dispositivo.spki, { ...d, ruta: `${d.ruta}?` }, firma)).toBe(false);
  });

  it('h exacto y sin HORA: el reintento tras un 401 hora tiene el mismo h y otra cadena', async () => {
    expect(await resumenPeticion(cripto, 'GET', '/v1/incidents/incidente-de-prueba-01', new Uint8Array(0)))
      .toBe('078e5239a95b278a50778edbb648c72fdd34cd15abca076ac98fc366c961a925');
    const h = await resumenPeticion(cripto, d.metodo, d.ruta, d.cuerpo);
    const reintento = { ...d, hora: d.hora + 360_000 };
    expect(await cadenaPeticion(cripto, reintento)).not.toEqual(await cadenaPeticion(cripto, d));
    expect(await resumenPeticion(cripto, reintento.metodo, reintento.ruta, reintento.cuerpo)).toBe(h);
    expect(await resumenPeticion(cripto, 'PUT', d.ruta, d.cuerpo)).not.toBe(h);
    expect(await resumenPeticion(cripto, d.metodo, '/v1/incidents', d.cuerpo)).not.toBe(h);
    expect(await resumenPeticion(cripto, d.metodo, d.ruta, new Uint8Array(0))).not.toBe(h);
  });

  it('rechaza campos que partirían la cadena', async () => {
    const malos: Record<string, Partial<DatosPeticion>> = {
      metodo_en_minusculas: { metodo: 'post' },
      ruta_con_query: { ruta: '/v1/devices?x' },
      ruta_con_porcentaje: { ruta: '/v1/incidents/%31' },
      ruta_con_salto: { ruta: '/v1/devices\nGET' },
      ruta_relativa: { ruta: 'v1/devices' },
      hora_negativa: { hora: -1 },
      hora_decimal: { hora: 1.5 },
      hora_enorme: { hora: 2 ** 53 },
      id_peticion_corto: { idPeticion: 'corto' },
      id_dispositivo_con_salto: { idDispositivo: 'registro\n' },
    };
    for (const [nombre, cambio] of Object.entries(malos)) {
      await expect(cadenaPeticion(cripto, { ...d, ...cambio }), nombre).rejects.toThrow(ErrorFormato);
    }
    await expect(resumenPeticion(cripto, 'GET', '/v1/devices?', new Uint8Array(0))).rejects.toThrow(ErrorFormato);
  });

  it('cabeceras y ventana del contrato', () => {
    expect(CABECERA).toEqual({ dispositivo: 'X-Vigia-Dispositivo', hora: 'X-Vigia-Hora', peticion: 'X-Vigia-Peticion',
      firma: 'X-Vigia-Firma', horaServidor: 'X-Vigia-Hora-Servidor', acuse: 'X-Vigia-Acuse' });
    expect(VENTANA_HORA_MS).toBe(300_000);
  });
});
