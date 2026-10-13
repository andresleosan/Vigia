import { deB64u, firmarAcuse } from '@vigia/shared';
import type { Entorno } from './entorno.ts';
import { cripto } from './firma.ts';

// La privada del acuse entra como PKCS8 y queda no extraíble (ACU-01).
// ponytail: se importa en cada petición; si la medida de CPU de H3a lo pide, se guarda por isolate.
export function claveAcuse(env: Entorno): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', deB64u(env.CLAVE_ACUSE) as Uint8Array<ArrayBuffer>, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

// JCV del acuse con firma (sección 7): lo que se guarda en D1 y lo que recibe el teléfono.
export async function acusar(env: Entorno, rHash: string, hora: number): Promise<Uint8Array> {
  return firmarAcuse(cripto, await claveAcuse(env), env.KID_ACUSE, rHash, hora);
}
