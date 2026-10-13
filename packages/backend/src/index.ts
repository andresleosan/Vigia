import { crearApp } from './app.ts';
import type { Entorno } from './entorno.ts';
import { programado } from './programado.ts';

export default {
  fetch: crearApp({ ahora: Date.now }).fetch,
  scheduled: (_controlador, env) => programado(env, Date.now()),
} satisfies ExportedHandler<Entorno>;
