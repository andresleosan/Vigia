import { utf8 } from './codificacion.ts';

const prefijo = (nombre: string) => utf8(`vigia/v1/${nombre}\0`);

// Separación de dominios (sección 4): cada firma lleva delante el prefijo de lo que firma.
export const PREFIJO = {
  registro: prefijo('registro'),
  cierre: prefijo('cierre'),
  peticion: prefijo('peticion'),
  acuse: prefijo('acuse'),
  evento: prefijo('evento'),
  compromiso: prefijo('compromiso'),
  recuperacion: prefijo('recuperacion'),
};
