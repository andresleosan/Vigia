import type { Context } from 'hono';

export type Entorno = {
  DB: D1Database;
  EVIDENCIA: R2Bucket;
  LIMITE_ORDENES: RateLimit;
  LIMITE_SUBIDA: RateLimit;
  LIMITE_LECTURAS: RateLimit;
  CLAVE_ACUSE: string; // secreto: PKCS8 de la privada de acuse, en b64u
  KID_ACUSE: string;
  CUOTA_BYTES: string;
  TOPE_INCIDENTES: string;
  UMBRAL_D1_BYTES: string;
  TOPE_ALTAS_HORA: string;
};

export type Contexto = Context<{ Bindings: Entorno }>;
