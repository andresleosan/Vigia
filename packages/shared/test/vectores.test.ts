import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { textoJson, vectoresDeterministas, type FirmasTs } from '../herramientas/generar-vectores.ts';
import { analizarAcuse, analizarListaClaves, verificarAcuse } from '../src/acuse.ts';
import { deB64u, deHex, utf8 } from '../src/codificacion.ts';
import { criptoWebCrypto, huella, p1363ADer } from '../src/cripto.ts';
import { analizarEvento, verificarEvento } from '../src/evento.ts';
import { verificarPeticion } from '../src/peticion.ts';
import { analizarRegistro, verificarRegistro } from '../src/registros.ts';

const cripto = criptoWebCrypto();
const leer = (nombre: string) => readFileSync(new URL(`../vectores/${nombre}`, import.meta.url), 'utf8');

describe('vectores dorados (sección 18)', () => {
  it('lo determinista se regenera byte a byte', async () => {
    const vectores = await vectoresDeterministas();
    expect(Object.keys(vectores)).toEqual(['codificacion.json', 'prefijos.json', 'spki.json', 'der.json', 'registros.json',
      'cifrado.json', 'envoltura.json', 'sobres.json', 'cuerpos.json', 'peticiones.json']);
    for (const [nombre, contenido] of Object.entries(vectores)) expect(leer(nombre), nombre).toBe(textoJson(contenido));
  });

  it('las firmas guardadas en firmas-ts.json verifican y dan el resultado anotado', async () => {
    const f = JSON.parse(leer('firmas-ts.json')) as FirmasTs;
    const spki = { dispositivo: deB64u(f.dispositivo), lectura: deB64u(f.lectura) };
    expect(analizarRegistro(utf8(f.registros[0].r))).toMatchObject({ tipo: 'apertura', dispositivo: await huella(cripto, spki.dispositivo) });
    for (const { nombre, r, s } of f.registros) {
      expect(await verificarRegistro(cripto, spki.dispositivo, utf8(r), deHex(s)), nombre).toBe(true);
    }
    for (const { nombre, firma, valida } of f.ecdsa.casos) {
      expect(await cripto.verificarP256(deB64u(f.ecdsa.spki), deHex(f.ecdsa.mensaje), deHex(firma)), nombre).toBe(valida);
    }
    // Casos obligatorios de la sección 18: r o s que ocupan 31 o 33 bytes en el DER de la firma.
    const enDer = (nombre: string, entero: 'r' | 's') => {
      const der = p1363ADer(deHex(f.ecdsa.casos.find((c) => c.nombre === nombre)!.firma));
      return entero === 'r' ? der[3] : der[5 + der[3]];
    };
    expect([enDer('r_de_31_bytes', 'r'), enDer('s_de_31_bytes', 's'), enDer('r_de_33_bytes', 'r'), enDer('s_de_33_bytes', 's')],
      'largo en DER de r o s').toEqual([31, 31, 33, 33]);
    for (const p of f.peticiones) {
      const d = { metodo: p.metodo, ruta: p.ruta, hora: p.hora, idPeticion: p.id_peticion, idDispositivo: p.id_dispositivo, cuerpo: deHex(p.cuerpo) };
      expect(await verificarPeticion(cripto, spki[p.firmante], d, p.firma), p.nombre).toBe(true);
    }
    const claves = analizarListaClaves(utf8(f.claves_acuse.map((linea) => `${linea}\n`).join('')));
    for (const { nombre, acuse, r, resultado } of f.acuses) {
      expect(await verificarAcuse(cripto, claves, analizarAcuse(utf8(acuse)), r), nombre).toBe(resultado);
    }
    for (const { nombre, evento, resultado } of f.eventos) {
      expect(await verificarEvento(cripto, claves, analizarEvento(utf8(evento))), nombre).toBe(resultado);
    }
  });
});
