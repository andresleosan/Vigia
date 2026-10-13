import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { b64u } from '@vigia/shared';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      // Clave de acuse efímera: nueva en cada ejecución y nunca escrita en disco.
      const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
      const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey) as ArrayBuffer);
      const spki = new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey) as ArrayBuffer);
      return {
        wrangler: { configPath: './wrangler.prueba.jsonc' },
        miniflare: {
          bindings: {
            MIGRACIONES: await readD1Migrations('./migraciones'),
            CLAVE_ACUSE: b64u(pkcs8),
            SPKI_ACUSE_PRUEBA: b64u(spki),
          },
        },
      };
    }),
  ],
  test: { setupFiles: ['./test/aplicar-migraciones.ts'] },
});
