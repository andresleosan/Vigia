import { codificarJcv, ESTADO_DE, type Codigo } from '@vigia/shared';

export const TIPO_JSON = 'application/json';
export const TIPO_SOBRE = 'application/vnd.vigia.sobre';

// Rechazo de la lista cerrada (ERR-01): app.onError lo convierte en {"codigo":"…"}.
export class Rechazo extends Error {
  codigo: Codigo;
  cabeceras: Record<string, string>;
  constructor(codigo: Codigo, cabeceras: Record<string, string> = {}) {
    super(codigo);
    this.codigo = codigo;
    this.cabeceras = cabeceras;
  }
}

export function respuestaJson(cuerpo: Uint8Array, estado: number, cabeceras: Record<string, string> = {}): Response {
  return new Response(cuerpo, { status: estado, headers: { 'Content-Type': TIPO_JSON, ...cabeceras } });
}

// Retry-After fijo de la tabla de errores (sección 11); el de tope_altas lo calcula el alta.
const ESPERA: Partial<Record<Codigo, string>> = { limite: '60', cuota: '3600' };

export function respuestaError(codigo: Codigo, cabeceras: Record<string, string> = {}): Response {
  const espera = ESPERA[codigo];
  return respuestaJson(codificarJcv({ codigo }), ESTADO_DE[codigo], { ...(espera ? { 'Retry-After': espera } : {}), ...cabeceras });
}
