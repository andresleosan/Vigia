import { describe, expect, it } from 'vitest';
import type { Cripto } from '../src/cripto.ts';
import { PATRON_ID, esId, nuevoId } from '../src/ids.ts';

// Solo hace falta aleatorio: el resto del proveedor llega en la tarea 5.
const conAzar = (aleatorio: (n: number) => Uint8Array) => ({ aleatorio }) as Cripto;

describe('ids', () => {
  it('el patrón es el del contrato', () => {
    expect(PATRON_ID.source).toBe('^[A-Za-z0-9_-]{22}$');
    expect(PATRON_ID.flags).toBe('');
  });

  it('nuevoId pide 16 bytes y los escribe en b64u', () => {
    const pedidos: number[] = [];
    const id = nuevoId(conAzar((n) => {
      pedidos.push(n);
      return Uint8Array.from({ length: n }, (_, i) => i);
    }));
    expect(pedidos).toEqual([16]);
    expect(id).toBe('AAECAwQFBgcICQoLDA0ODw');
  });

  it('10 000 ids sin repetirse y con el patrón (ID-01)', () => {
    const cripto = conAzar((n) => crypto.getRandomValues(new Uint8Array(n)));
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const id = nuevoId(cripto);
      expect(PATRON_ID.test(id)).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(10_000);
  });

  it('esId acepta 22 caracteres del alfabeto y nada más', () => {
    expect(esId('AAECAwQFBgcICQoLDA0ODw')).toBe(true);
    expect(esId('-_-_-_-_-_-_-_-_-_-_-_')).toBe(true);
    for (const t of [
      '', 'AAECAwQFBgcICQoLDA0OD', 'AAECAwQFBgcICQoLDA0ODwA', 'AAECAwQFBgcICQoLDA0OD+',
      'AAECAwQFBgcICQoLDA0OD/', 'AAECAwQFBgcICQoLDA0OD=', 'AAECAwQFBgcICQoLDA0OD%',
      'AAECAwQFBgcICQoLDA0OD ', 'AAECAwQFBgcICQoLDA0ODw\n', 'AAECAwQFBgcICQoLDA0ODñ',
    ]) {
      expect(esId(t), JSON.stringify(t)).toBe(false);
    }
  });
});
