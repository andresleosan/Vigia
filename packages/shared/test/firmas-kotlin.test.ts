import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deB64u, deHex, utf8 } from '../src/codificacion.ts';
import { criptoWebCrypto, huella } from '../src/cripto.ts';
import { verificarPeticion } from '../src/peticion.ts';
import { analizarRegistro, hashRegistro, verificarRegistro } from '../src/registros.ts';

// Lo escribe la tarea firmasKotlin de packages/nucleo con una clave efímera (contrato, sección 18).
const f = JSON.parse(readFileSync(new URL('../vectores/firmas-kotlin.json', import.meta.url), 'utf8'));
const cripto = criptoWebCrypto();
const spki = deB64u(f.dispositivo);

describe('firmas del núcleo Kotlin (vectores/firmas-kotlin.json)', () => {
  it('shared analiza los registros de Kotlin y verifica sus firmas y su cadena', async () => {
    const tipos: string[] = [];
    let anterior = '';
    for (const { nombre, r, s } of f.registros) {
      const bytes = utf8(r);
      const registro = analizarRegistro(bytes);
      tipos.push(registro.tipo);
      expect(await verificarRegistro(cripto, spki, bytes, deHex(s)), nombre).toBe(true);
      if (registro.tipo === 'apertura') expect(registro.dispositivo).toBe(await huella(cripto, spki));
      if (registro.tipo === 'fragmento' || registro.tipo === 'hueco') expect(registro.prev, nombre).toBe(anterior);
      if (registro.tipo === 'cierre') expect(registro.hash_final).toBe(anterior);
      anterior = await hashRegistro(cripto, bytes);
    }
    expect(tipos).toEqual(['apertura', 'fragmento', 'hueco', 'cierre']);
  });

  it('una firma de Kotlin con un bit cambiado no verifica', async () => {
    const { r, s } = f.registros[1];
    const firma = deHex(s);
    firma[10] ^= 1;
    expect(await verificarRegistro(cripto, spki, utf8(r), firma)).toBe(false);
  });

  it('shared verifica la firma de petición de Kotlin, y con otra ruta no', async () => {
    for (const p of f.peticiones) {
      expect(p.firmante, p.nombre).toBe('dispositivo');
      const d = { metodo: p.metodo, ruta: p.ruta, hora: p.hora, idPeticion: p.id_peticion, idDispositivo: p.id_dispositivo, cuerpo: deHex(p.cuerpo) };
      expect(await verificarPeticion(cripto, spki, d, p.firma), p.nombre).toBe(true);
      expect(await verificarPeticion(cripto, spki, { ...d, ruta: '/v1/incidents' }, p.firma), p.nombre).toBe(false);
    }
  });
});
