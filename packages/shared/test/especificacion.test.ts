import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEEME, RUTA_PAQUETE, SHA256_LEEME } from '../src/paquete.ts';
import { formatearHora, TEXTOS, TIPO_DE, verificarPaquete, type ClaveMensaje } from '../src/verificador.ts';
import { cripto, MIN, nuevaPrueba, T0 } from './incidente-prueba.ts';

// La especificación pública y el código dicen lo mismo: un tribunal lee el documento, no el código.
const DOC = readFileSync(new URL('../../../docs/verificacion.md', import.meta.url), 'utf8');

describe('docs/verificacion.md', () => {
  it('trae cada mensaje con su clave, su tipo y su texto exactos', () => {
    for (const clave of Object.keys(TEXTOS) as ClaveMensaje[]) {
      expect(DOC).toContain(`| \`${clave}\` | ${TIPO_DE[clave]} | ${TEXTOS[clave]} |`);
    }
    expect(DOC).toContain('"otra app usó el micrófono"');
    expect(DOC).toContain('"la grabación se interrumpió"');
  });

  it('trae los resúmenes en singular de un solo fragmento, los mismos que da el verificador', async () => {
    const p = await nuevaPrueba();
    const lista = await p.cerrada(1); // el acuse del fragmento llega a T0 + 1 min
    const plantilla = (resumen: string) => resumen.replace(p.huella.slice(0, 16), '{huella}').replace(formatearHora(T0 + MIN, 'UTC'), '{hora}');
    for (const zip of [p.paquete(lista), p.paquete(lista.slice(0, 2))]) {
      const { resumen } = await verificarPaquete(cripto, zip, { huella: p.huella, claves: p.claves, k: p.k, zona: 'UTC' });
      expect(DOC).toContain(`"${plantilla(resumen)}"`);
    }
  });

  it('trae el texto fijo de LEEME.txt, su tamaño y su SHA-256', () => {
    expect(DOC).toContain(`\`\`\`text\n${LEEME}\`\`\``);
    expect(DOC).toContain(`(${new TextEncoder().encode(LEEME).length} bytes)`);
    expect(DOC).toContain(`Su SHA-256 es \`${SHA256_LEEME}\`.`);
  });

  it('trae la expresión exacta de los nombres admitidos', () => {
    expect(DOC).toContain(`\`\`\`text\n${RUTA_PAQUETE.source}\n\`\`\``);
  });

  it('sin la raya larga', () => {
    expect(DOC).not.toContain(String.fromCharCode(0x2014));
  });
});
