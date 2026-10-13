// Extrae de test-vectors.json de CFRG (commit fijado, SHA-256 comprobado) el vector de la suite de
// Vigía en modo base. Deja fuera las privadas (skRm y skEm): se derivan de ikmR e ikmE.
// Uso: node herramientas/extraer-cfrg.ts <test-vectors.json> <salida.json>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEN = 'cfrg/draft-irtf-cfrg-hpke@5f503c564da00b0687b3de75f1dfbdfc4079ad31/test-vectors.json';
const SHA256_ORIGEN = '61fc662f01996cd06d713dacf5e133167bd309a1f329442d53f1e21a47b3ede6';
const CAMPOS = ['mode', 'kem_id', 'kdf_id', 'aead_id', 'info', 'ikmR', 'ikmE', 'pkRm', 'enc', 'key', 'base_nonce', 'encryptions'];

const [entrada, salida] = process.argv.slice(2);
const bytes = readFileSync(entrada);
if (createHash('sha256').update(bytes).digest('hex') !== SHA256_ORIGEN) throw new Error('test-vectors.json no es el del commit fijado');
const elegidos = (JSON.parse(bytes.toString('utf8')) as Record<string, unknown>[])
  .filter((x) => x.mode === 0 && x.kem_id === 0x20 && x.kdf_id === 1 && x.aead_id === 2);
if (elegidos.length !== 1) throw new Error(`se esperaba 1 vector y hay ${elegidos.length}`);
const vector = Object.fromEntries(CAMPOS.map((c) => [c, elegidos[0][c]]));
writeFileSync(salida, JSON.stringify({ origen: ORIGEN, sha256_origen: SHA256_ORIGEN, ...vector }, null, 2) + '\n');
console.log(`${salida}: ${(vector.encryptions as unknown[]).length} cifrados`);
