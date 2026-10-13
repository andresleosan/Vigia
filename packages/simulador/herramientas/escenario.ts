// Aceptación de H1 de punta a punta contra `wrangler dev` en vigia-build (OPS-03: solo 127.0.0.1).
// Uso: node herramientas/escenario.ts <dir>, con <dir>/claves-dev.txt (de generar-dev-vars.ts) y <dir>/tono/
// (30 trozos ADTS de ffmpeg). Deja en <dir>/a el paquete de A y su audio descifrado.
// wrangler dev arranca con TOPE_ALTAS_HORA 2: las altas de A y B lo gastan y C recibe 429.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  analizarAcuse, analizarListaClaves, analizarRegistro, criptoWebCrypto, iguales, leerZip, unir, verificarPaquete,
} from '@vigia/shared';
import { TelefonoSimulado, type Red } from '../src/telefono.ts';
import { esperarSiAcabaLaHora } from './hora.ts';

const BASE = 'http://127.0.0.1:8787';
const HORA = 3_600_000;
const DIA = 24 * HORA;
const dir = process.argv[2];
const cripto = criptoWebCrypto();
const claves = analizarListaClaves(readFileSync(join(dir, 'claves-dev.txt')));
const audios = readdirSync(join(dir, 'tono')).sort().map((n) => new Uint8Array(readFileSync(join(dir, 'tono', n))));
const sinRed: Red = () => Promise.reject(new TypeError('sin red'));

function comprobar(cumple: boolean, que: string): void {
  if (!cumple) throw new Error(`MAL: ${que}`);
  console.log(`bien: ${que}`);
}

/** Cuánto se separa la hora del cierre guardado (la del teléfono) de la hora de su acuse (la del servidor). */
function desfaseDelCierre(paquete: Uint8Array): number {
  const archivos = leerZip(paquete);
  const cierre = analizarRegistro(archivos.get('registros/cierre.r') ?? new Uint8Array(0));
  return cierre.hora_telefono - analizarAcuse(archivos.get('acuses/cierre.json') ?? new Uint8Array(0)).hora_servidor;
}

const primeras = (t: TelefonoSimulado) => t.historial.slice(0, 2).join(', ');

comprobar(audios.length === 30, '30 trozos de 4 s del tono');
// Hasta el alta de C pasa menos de 1 min: con menos de 2 min para la hora UTC siguiente, se espera a que empiece.
await esperarSiAcabaLaHora(120_000);

// A: reloj 2 h adelantado; graba 2 min sin red y sube cuando vuelve la red.
const a = await TelefonoSimulado.crear({ base: BASE, red: sinRed, reloj: () => Date.now() + 2 * HORA, claves, cripto });
const { incidente, k } = await a.grabar(audios);
comprobar(await a.subir() === 'red' && a.pendientes() === 32, 'A sin red: la apertura, los 30 fragmentos y el cierre siguen en la cola');
a.red = fetch;
comprobar(await a.subir() === null && a.pendientes() === 0, 'A con red: los 32 sobres tienen acuse válido');
comprobar(primeras(a) === 'POST /v1/devices 401 hora, POST /v1/devices 201', 'A: el alta da 401 hora y, con el desfase corregido, 201 (FIR-03)');
const paquete = await a.paquete(incidente);
comprobar(Math.abs(desfaseDelCierre(paquete) - 2 * HORA) < 60_000, 'A: el cierre guardado conserva la hora del teléfono (2 h adelantada)');
const informe = await verificarPaquete(cripto, paquete, { claves, k, zona: 'UTC' });
comprobar(informe.estado === 'integro' && informe.fragmentos === 30, `A: ${informe.resumen}`);
const audio = unir(...[...informe.audio].sort(([x], [y]) => x - y).map(([, trozo]) => trozo));
comprobar(iguales(audio, unir(...audios)), 'A: el audio descifrado del paquete es el tono original, byte a byte');
mkdirSync(join(dir, 'a'), { recursive: true });
writeFileSync(join(dir, 'a', 'paquete.zip'), paquete);
writeFileSync(join(dir, 'a', 'audio.aac'), audio);

// Foco 5: 100 reenvíos de los 32 sobres, como si se hubieran perdido todas las respuestas.
for (let i = 0; i < 100; i++) await a.reenviar();
comprobar(!a.historial.some((h) => h.includes(' 429 ')), 'A: 100 reenvíos (3200 peticiones), cada uno con su mismo acuse y sin ningún 429');
comprobar(iguales(await a.paquete(incidente), paquete), 'A: el paquete releído es idéntico byte a byte: ninguna hora de recepción cambió');

// B: reloj 1 día atrasado.
const b = await TelefonoSimulado.crear({ base: BASE, red: fetch, reloj: () => Date.now() - DIA, claves, cripto });
const deB = await b.grabar(audios.slice(0, 3));
comprobar(await b.subir() === null, 'B: los 5 sobres tienen acuse válido');
comprobar(primeras(b) === 'POST /v1/devices 401 hora, POST /v1/devices 201', 'B: el alta da 401 hora y luego 201 (FIR-03)');
comprobar(Math.abs(desfaseDelCierre(await b.paquete(deB.incidente)) + DIA) < 60_000, 'B: el cierre guardado conserva la hora del teléfono (1 día atrasada)');

// C: por encima del tope de altas, que A y B ya gastaron en esta hora UTC.
const c = await TelefonoSimulado.crear({ base: BASE, red: fetch, reloj: Date.now, claves, cripto });
await c.grabar(audios.slice(0, 3));
comprobar(await c.subir() === '429 tope_altas' && c.pendientes() === 5, 'C: 429 tope_altas y sus 5 sobres siguen en la cola (OPS-02)');
comprobar(await c.subir() === '429 tope_altas' && c.pendientes() === 5, 'C: el reintento vuelve a dar 429 y no pierde ningún sobre');
console.log('fin del escenario');
