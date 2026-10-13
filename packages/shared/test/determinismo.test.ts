import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as indice from '../src/index.ts';

// Lo determinista de la sección 18: la semilla de HPKE y el Cripto de pruebas.
const DETERMINISTA = /hpkeCoreConSemilla|criptoDeterminista|cripto-determinista/;
// Cualquier importación de HPKE: en src solo puede aparecer dentro de hpke-core.ts.
const HPKE = /(?:from|import)\s*\(?\s*['"](?:@hpke\/core|[^'"]*hpke-core(?:\.ts)?)['"]/;

/** Los .ts de src/ o de herramientas/, salvo `excepto`, cuyo texto casa con algún patrón. */
function culpables(dir: 'src' | 'herramientas', excepto: readonly string[], patrones: readonly RegExp[]): string[] {
  const base = new URL(`../${dir}/`, import.meta.url);
  return readdirSync(base, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') && !excepto.includes(f))
    .filter((f) => patrones.some((p) => p.test(readFileSync(new URL(f, base), 'utf8'))))
    .map((f) => `${dir}/${f}`);
}

describe('el determinismo solo entra por las pruebas y los vectores (sección 18)', () => {
  it('lo determinista no entra en src ni en las herramientas (salvo las de vectores), ni HPKE en src fuera de hpke-core.ts', () => {
    // El CLI verificar puede importar hpkeCore e importarReceptora: en herramientas/ solo se busca lo determinista.
    expect([
      ...culpables('src', ['hpke-core.ts'], [DETERMINISTA, HPKE]),
      ...culpables('herramientas', ['generar-vectores.ts', 'extraer-cfrg.ts'], [DETERMINISTA]),
    ].sort()).toEqual([]);
  });

  it('el índice no exporta nada de hpke-core.ts', () => {
    for (const nombre of ['hpkeCore', 'hpkeCoreConSemilla', 'importarReceptora']) expect(indice).not.toHaveProperty(nombre);
  });
});
