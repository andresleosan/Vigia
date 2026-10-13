import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { bytesEntradaClave } from '../src/acuse.ts';
import { b64u, unir } from '../src/codificacion.ts';
import { envolverK } from '../src/envoltura.ts';
import { hpkeCore, importarReceptora } from '../src/hpke-core.ts';
import { cripto, INCIDENTE, nuevaPrueba } from './incidente-prueba.ts';

const CLI = fileURLToPath(new URL('../herramientas/verificar.ts', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'verificar-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const p = await nuevaPrueba();
const lista = await p.cerrada(3);
const escucha = cripto.aleatorio(32); // privada X25519 de escucha, solo para esta prueba
const publicaEscucha = new Uint8Array(await crypto.subtle.exportKey('raw', (await importarReceptora(escucha)).publicKey));
const envoltura = await envolverK(hpkeCore(), publicaEscucha, INCIDENTE, 'escucha', p.k);
const paquete = join(dir, 'paquete.zip');
const claves = join(dir, 'claves.txt');
writeFileSync(paquete, p.paquete(lista, { envolturas: [{ rol: 'escucha', k: envoltura }] }));
writeFileSync(claves, unir(...p.claves.map((e) => unir(bytesEntradaClave(e), Uint8Array.of(0x0a)))));
const ok = `✓ 3 fragmentos, cadena íntegra, firmados por el dispositivo ${p.huella.slice(0, 16)}, recibidos entre 10:01 y 10:03 del 12-10-2026 (UTC-04:00)`;

function verificar(args: string[], entrada = '') {
  const r = spawnSync(process.execPath, [CLI, ...args], { input: entrada, encoding: 'utf8' });
  return { codigo: r.status, salida: r.stdout, error: r.stderr };
}

describe('CLI verificar', () => {
  it('con K por la entrada estándar: dice qué lista de claves usó, da el ✓ y escribe el audio', () => {
    const audio = join(dir, 'audio.aac');
    const r = verificar([paquete, '--zona', 'America/Caracas', '--claves', claves, '--huella', p.huella, '--clave-incidente', '--audio', audio], `${b64u(p.k)}\n`);
    expect(r).toMatchObject({ codigo: 0, salida: `Claves del acuse: ${claves}\n${ok}\n` });
    expect(readFileSync(audio)).toEqual(Buffer.concat(lista.slice(1, 4).map((e) => e.audio as Uint8Array)));
  });

  it('con la privada de escucha por la entrada estándar: abre envolturas/escucha-1.json', () => {
    const r = verificar([paquete, '--zona', 'America/Caracas', '--claves', claves, '--huella', p.huella, '--clave-escucha'], b64u(escucha));
    expect(r).toMatchObject({ codigo: 0, salida: `Claves del acuse: ${claves}\n${ok}\n` });
  });

  it('sin clave ni huella: los avisos, uno por línea', () => {
    const r = verificar([paquete, '--zona', 'America/Caracas', '--claves', claves]);
    expect(r.salida.split('\n')).toEqual([
      `Claves del acuse: ${claves}`, ok,
      `- Aviso: la identidad del teléfono (${p.huella.slice(0, 16)}) la afirma el propio paquete; compárala con la del enlace`,
      '- Audio sin comprobar: falta la clave para descifrar', '',
    ]);
  });

  it('con la lista de producción (vacía en H1) lo dice, y las claves de prueba no valen: falla el acuse, no la apertura', () => {
    const r = verificar([paquete, '--zona', 'America/Caracas', '--entorno', 'produccion', '--huella', p.huella]);
    expect(r.codigo).toBe(1);
    expect(r.salida.split('\n')).toEqual([
      'Claves del acuse: lista de producción compilada en shared',
      '✗ Hay fallos (1); lo que falla no cuenta. Fragmentos que verifican: 0',
      '- Apertura: sin acuse válido del servidor', '',
    ]);
  });

  it('nunca acepta la clave como argumento, y pide la zona y la lista', () => {
    for (const args of [
      [paquete, '--zona', 'UTC', '--claves', claves, `--clave-incidente=${b64u(p.k)}`],
      [paquete, b64u(p.k), '--zona', 'UTC', '--claves', claves],
      [paquete, '--claves', claves],
      [paquete, '--zona', 'Marte/Olimpo', '--claves', claves],
      [paquete, '--zona', 'UTC'],
      [paquete, '--zona', 'UTC', '--claves', claves, '--entorno', 'produccion'],
    ]) {
      const r = verificar(args);
      expect(r.codigo, args.join(' ')).toBe(2);
      expect(r.error).toContain('Uso:');
    }
  });
});
