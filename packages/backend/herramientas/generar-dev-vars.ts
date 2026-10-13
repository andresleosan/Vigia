// Clave de acuse de `wrangler dev` (SEC-01): nueva en cada ejecución y escrita solo en /work, nunca en el repo.
// Uso, desde packages/backend: node herramientas/generar-dev-vars.ts <.dev.vars> <lista de claves>
// <.dev.vars> recibe CLAVE_ACUSE (PKCS8 en b64u) y KID_ACUSE; <lista de claves>, la entrada JCV de la pública
// (sección 7), que leen el teléfono simulado y el verificador.
import { writeFileSync } from 'node:fs';
import { b64u, bytesEntradaClave, unir } from '@vigia/shared';

const KID = 'dev_1';
const [destinoVars, destinoLista] = process.argv.slice(2);
if (!destinoVars || !destinoLista) {
  console.error('Uso: node herramientas/generar-dev-vars.ts <.dev.vars> <lista de claves>');
  process.exit(2);
}
// Extraíble solo aquí, para escribir el PKCS8: el Worker la importa no extraíble (ACU-01).
const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey));
const spki = new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey));
writeFileSync(destinoVars, `CLAVE_ACUSE=${b64u(pkcs8)}\nKID_ACUSE=${KID}\n`, { mode: 0o600 });
writeFileSync(destinoLista, unir(bytesEntradaClave({ kid: KID, spki, estado: 'activa', desde: Date.now() }), Uint8Array.of(0x0a)));
console.log(`Clave de acuse ${KID} generada; su pública está en ${destinoLista}.`);
