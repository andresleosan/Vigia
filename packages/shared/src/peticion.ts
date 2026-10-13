import { b64u, deB64u, ErrorFormato, hex, unir, utf8 } from './codificacion.ts';
import type { Cripto } from './cripto.ts';
import { esId } from './ids.ts';
import { PREFIJO } from './prefijos.ts';

export const CABECERA = {
  dispositivo: 'X-Vigia-Dispositivo',
  hora: 'X-Vigia-Hora',
  peticion: 'X-Vigia-Peticion',
  firma: 'X-Vigia-Firma',
  horaServidor: 'X-Vigia-Hora-Servidor',
  acuse: 'X-Vigia-Acuse',
} as const;

export type DatosPeticion = {
  metodo: string;
  ruta: string;
  hora: number;
  idPeticion: string;
  idDispositivo: string;
  cuerpo: Uint8Array;
};

/** |HORA − ahora| ≤ 300 000 ms (sección 9, FIR-03). */
export const VENTANA_HORA_MS = 300_000;

/** ID_DISPOSITIVO del alta, que aún no tiene id (sección 9). */
const REGISTRO = 'registro';
const METODO = /^[A-Z]{1,7}$/;
// Los caracteres que el Worker deja pasar antes de enrutar (sección 9, paso 0): así ningún
// campo de la cadena puede llevar 0x0A ni partirse en dos.
const RUTA_CRUDA = /^\/[A-Za-z0-9/_-]*$/;

/** prefijo ‖ MÉTODO ‖ 0x0A ‖ RUTA ‖ 0x0A ‖ HORA ‖ 0x0A ‖ ID_PETICION ‖ 0x0A ‖ ID_DISPOSITIVO ‖ 0x0A ‖ hex(SHA-256(cuerpo)). */
export async function cadenaPeticion(cripto: Cripto, d: DatosPeticion): Promise<Uint8Array> {
  const valida = METODO.test(d.metodo) && RUTA_CRUDA.test(d.ruta)
    && Number.isSafeInteger(d.hora) && d.hora >= 0
    && esId(d.idPeticion) && (d.idDispositivo === REGISTRO || esId(d.idDispositivo));
  if (!valida) throw new ErrorFormato('petición');
  const campos = [d.metodo, d.ruta, String(d.hora), d.idPeticion, d.idDispositivo, hex(await cripto.sha256(d.cuerpo))];
  return unir(PREFIJO.peticion, utf8(campos.join('\n')));
}

export async function firmarPeticion(cripto: Cripto, privada: CryptoKey, d: DatosPeticion): Promise<string> {
  return b64u(await cripto.firmarP256(privada, await cadenaPeticion(cripto, d)));
}

/** Una petición mal formada o una firma que no es b64u canónico nunca verifican. */
export async function verificarPeticion(cripto: Cripto, spki: Uint8Array, d: DatosPeticion, firma: string): Promise<boolean> {
  try {
    return await cripto.verificarP256(spki, await cadenaPeticion(cripto, d), deB64u(firma));
  } catch (e) {
    if (e instanceof ErrorFormato) return false;
    throw e;
  }
}

/** `h` de la fila anti-reenvío (sección 9). Sin HORA: el reintento tras un 401 `hora` es la misma petición. */
export async function resumenPeticion(cripto: Cripto, metodo: string, ruta: string, cuerpo: Uint8Array): Promise<string> {
  if (!METODO.test(metodo) || !RUTA_CRUDA.test(ruta)) throw new ErrorFormato('petición');
  return hex(await cripto.sha256(utf8(`${metodo}\n${ruta}\n${hex(await cripto.sha256(cuerpo))}`)));
}
