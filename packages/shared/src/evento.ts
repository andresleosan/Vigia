import { CAMPOS_HECHO, firmarHecho, verificarHecho, type ClavesAcuse, type ResultadoAcuse } from './acuse.ts';
import { deB64u, unir } from './codificacion.ts';
import type { Cripto } from './cripto.ts';
import { analizarJcv, codificarJcv, type Esquema, type Valor } from './jcv.ts';
import { PREFIJO } from './prefijos.ts';

export type Evento = {
  v: 1;
  evento: string;
  dispositivo: string;
  incidente: string;
  destino?: string;
  hora_servidor: number;
  kid: string;
  firma: string;
};

const ID_O_GUION = /^(?:[A-Za-z0-9_-]{22}|-)$/;

const EVENTO: Esquema = {
  ...CAMPOS_HECHO,
  destino: { tipo: 'cadena', patron: ID_O_GUION, opcional: true },
  dispositivo: { tipo: 'cadena', patron: /^[0-9a-f]{64}$/ },
  evento: { tipo: 'cadena', patron: /^[a-z_]{1,32}$/ },
  incidente: { tipo: 'cadena', patron: ID_O_GUION },
};

function contenido(e: Omit<Evento, 'firma'>): Record<string, Valor> {
  const o: Record<string, Valor> = {
    dispositivo: e.dispositivo,
    evento: e.evento,
    hora_servidor: e.hora_servidor,
    incidente: e.incidente,
    kid: e.kid,
    v: e.v,
  };
  if (e.destino !== undefined) o.destino = e.destino;
  return o;
}

export function firmarEvento(cripto: Cripto, privada: CryptoKey, e: Omit<Evento, 'firma'>): Promise<Uint8Array> {
  return firmarHecho(cripto, privada, PREFIJO.evento, contenido(e), EVENTO);
}

export function analizarEvento(bytes: Uint8Array): Evento {
  const o = analizarJcv(bytes, EVENTO);
  deB64u(o.firma as string); // forma canónica (sección 1)
  const e: Evento = {
    v: 1,
    evento: o.evento as string,
    dispositivo: o.dispositivo as string,
    incidente: o.incidente as string,
    hora_servidor: o.hora_servidor as number,
    kid: o.kid as string,
    firma: o.firma as string,
  };
  if (o.destino !== undefined) e.destino = o.destino as string;
  return e;
}

/** Firma, estado y ventana con la lista fijada. Que `dispositivo` sea la huella del paquete lo comprueba el verificador. */
export function verificarEvento(cripto: Cripto, claves: ClavesAcuse, e: Evento): Promise<ResultadoAcuse> {
  return verificarHecho(cripto, claves, unir(PREFIJO.evento, codificarJcv(contenido(e))), e);
}
