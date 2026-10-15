import { nuevaPrueba, cambiar, T0 } from '../packages/shared/test/incidente-prueba.ts';
import { leerZip } from '../packages/shared/src/paquete.ts';
import { criptoWebCrypto } from '../packages/shared/src/cripto.ts';
import { verificarPaquete } from '../packages/shared/src/verificador.ts';

declare const __TONO_BASE64__: string;
export type Caso = 'original' | 'alterado' | 'sin-cierre';

/** Solo datos sintéticos. Las claves no salen de esta clausura ni se persisten. */
export async function crearDemostracion() {
  const p = await nuevaPrueba();
  const tono = Uint8Array.from(atob(__TONO_BASE64__), c => c.charCodeAt(0));
  const registros = [await p.apertura(T0)];
  for (let seq = 1; seq <= 3; seq++) {
    registros.push(await p.fragmento(seq, registros[seq - 1].hash, T0 + seq * 4000, { audio: tono }));
  }
  registros.push(await p.cierre(3, registros[3].hash, T0 + 16000));
  const original = p.paquete(registros);
  const cambiado = leerZip(original).get('cifrados/000002.bin')!.slice();
  cambiado[20] ^= 1;
  const paquetes = {
    original,
    alterado: cambiar(original, { 'cifrados/000002.bin': cambiado }),
    'sin-cierre': p.paquete(registros.slice(0, -1)),
  };
  const cripto = criptoWebCrypto();
  return {
    huella: p.huella,
    async verificar(caso: Caso) {
      const inf = await verificarPaquete(cripto, paquetes[caso], {
        huella: p.huella, claves: p.claves, k: p.k, zona: 'UTC',
      });
      return {
        estado: inf.estado, resumen: inf.resumen, fragmentos: inf.fragmentos,
        hallazgos: inf.hallazgos.map(h => ({ ...h })),
        // Solo el contenido que el verificador devuelve; jamás el audio del fixture.
        audio: new Map([...inf.audio].map(([seq, bytes]) => [seq, bytes.slice()])),
      };
    },
  };
}
