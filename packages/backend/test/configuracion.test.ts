import { describe, expect, it } from 'vitest';
import plantilla from '../wrangler.plantilla.jsonc?raw';
import prueba from '../wrangler.prueba.jsonc?raw';

type Config = {
  observability: unknown;
  preview_urls: boolean;
  ratelimits: { name: string; namespace_id: string; simple: unknown }[];
  vars: Record<string, string>;
  secrets?: unknown;
  d1_databases: unknown;
  r2_buckets: unknown;
};

// Los .jsonc de este paquete solo llevan comentarios de línea entera.
const leer = (texto: string): Config => JSON.parse(texto.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'));

describe('configuración del Worker (LOG-01, LIM-01, CFG-01)', () => {
  it.each([['plantilla', plantilla], ['prueba', prueba]])('%s: observability, logs y trazas apagados y preview_urls false', (_nombre, texto) => {
    const c = leer(texto);
    expect(c.observability).toEqual({ enabled: false, logs: { enabled: false, invocation_logs: false }, traces: { enabled: false } });
    expect(c.preview_urls).toBe(false);
  });

  it('plantilla: tres rate limits de 120 por 60 s con namespace_id distintos, las variables y el secreto aparte', () => {
    const c = leer(plantilla);
    expect(c.ratelimits.map((r) => r.name).sort()).toEqual(['LIMITE_LECTURAS', 'LIMITE_ORDENES', 'LIMITE_SUBIDA']);
    expect(new Set(c.ratelimits.map((r) => r.namespace_id)).size).toBe(3);
    for (const r of c.ratelimits) expect(r.simple).toEqual({ limit: 120, period: 60 });
    expect(c.vars).toEqual({ CUOTA_BYTES: '262144000', TOPE_INCIDENTES: '2000', UMBRAL_D1_BYTES: '400000000', TOPE_ALTAS_HORA: '2', KID_ACUSE: 'prueba_1' });
    expect(c.secrets).toEqual({ required: ['CLAVE_ACUSE'] });
  });

  it('prueba: los mismos bindings y variables que la plantilla, sin secretos', () => {
    const p = leer(prueba);
    const t = leer(plantilla);
    expect([p.ratelimits, p.d1_databases, p.r2_buckets]).toEqual([t.ratelimits, t.d1_databases, t.r2_buckets]);
    expect(Object.keys(p.vars).sort()).toEqual(Object.keys(t.vars).sort());
    expect(p.secrets).toBeUndefined();
  });

  it('con la cuota configurada, el paquete cabe en un ZIP sin ZIP64 (sección 13)', () => {
    expect(4 * Math.floor(Number(leer(plantilla).vars.CUOTA_BYTES) / 16_384) + 64).toBeLessThanOrEqual(65_535);
  });
});
