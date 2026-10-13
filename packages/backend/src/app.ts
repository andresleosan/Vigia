import { ErrorFormato, MAX_JSON } from '@vigia/shared';
import { Hono } from 'hono';
import { alta } from './alta.ts';
import type { Entorno } from './entorno.ts';
import { Rechazo, respuestaError, TIPO_JSON } from './errores.ts';
import { limite, tipoExacto } from './firma.ts';
import { estado } from './lecturas.ts';

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
  app.get('/v1/incidents/:id', (c) => estado(c, ahora()));

  app.notFound(() => respuestaError('no_existe'));
  // Sin console y sin el texto de la excepción (ERR-01, LOG-01).
  app.onError((e) => {
    if (e instanceof Rechazo) return respuestaError(e.codigo, e.cabeceras);
    if (e instanceof ErrorFormato) return respuestaError('formato');
    return respuestaError('interno');
  });
  return app;
}
