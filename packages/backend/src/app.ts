import { ErrorFormato, MAX_JSON, MAX_SOBRE } from '@vigia/shared';
import { Hono } from 'hono';
import { alta } from './alta.ts';
import { cerrar } from './cierre.ts';
import type { Entorno } from './entorno.ts';
import { Rechazo, respuestaError, TIPO_JSON, TIPO_SOBRE } from './errores.ts';
import { limite, tipoExacto } from './firma.ts';
import { abrir } from './incidentes.ts';
import { ingerir } from './ingesta.ts';
import { estado, leerCierre, leerRegistro } from './lecturas.ts';

export type Opciones = { ahora: () => number };

export function crearApp({ ahora }: Opciones) {
  const app = new Hono<{ Bindings: Entorno }>();

  // Paso 0 de la sección 9, antes de enrutar: el path crudo, sin decodificar, y ninguna query.
  app.use(async (c, next) => {
    if (!/^[A-Za-z0-9/_-]*$/.test(new URL(c.req.raw.url).pathname)) throw new Rechazo('formato');
    if (c.req.raw.url.includes('?')) throw new Rechazo('firma');
    await next();
  });

  app.post('/v1/devices', tipoExacto(TIPO_JSON), limite(MAX_JSON), (c) => alta(c, ahora()));
  app.post('/v1/incidents', tipoExacto(TIPO_JSON), limite(MAX_JSON), (c) => abrir(c, ahora()));
  app.get('/v1/incidents/:id', (c) => estado(c, ahora()));
  app.put('/v1/incidents/:id/chunks/:seq', tipoExacto(TIPO_SOBRE), limite(MAX_SOBRE), (c) => ingerir(c, ahora()));
  app.post('/v1/incidents/:id/close', tipoExacto(TIPO_JSON), limite(MAX_JSON), (c) => cerrar(c, ahora()));
  app.get('/v1/incidents/:id/chunks/:seq', (c) => leerRegistro(c, ahora()));
  app.get('/v1/incidents/:id/close', (c) => leerCierre(c, ahora()));

  app.notFound(() => respuestaError('no_existe'));
  // Sin console y sin el texto de la excepción (ERR-01, LOG-01).
  app.onError((e) => {
    if (e instanceof Rechazo) return respuestaError(e.codigo, e.cabeceras);
    if (e instanceof ErrorFormato) return respuestaError('formato');
    return respuestaError('interno');
  });
  return app;
}
