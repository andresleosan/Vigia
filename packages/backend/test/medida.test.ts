import { env } from 'cloudflare:workers';
import {
  b64u, CABECERA, criptoWebCrypto, cuerpoAlta, cuerpoCierre, cuerpoIncidente, empaquetarSobre, firmarPeticion,
  firmarRegistro, hashRegistro, hex, huella, nuevoId, RUTA, rutaCierre, rutaFragmento, type EnvolturaCuerpo, type Registro,
} from '@vigia/shared';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.ts';
import type { Entorno } from '../src/entorno.ts';

// Medida de la sección 13 del contrato (OPS-02): bytes de D1 por apertura, fragmento y cierre (meta.size_after),
// filas leídas y escritas (meta.rows_read y meta.rows_written) y consultas y operaciones de R2 por petición.
// Imprime la medida para el informe de cierre de H1 y falla si un registro pasa de su cota.

const cripto = criptoWebCrypto();
const T = 1_760_000_000_000;
const app = crearApp({ ahora: () => T });
const N_INCIDENTES = 40;
const N_FRAGMENTOS = 100;
// Cotas por registro, en bytes de D1, que anota el informe de H1. Con ellas, la huella en D1 de un dispositivo es
// como mucho 16 000 × 1 600 + 2 000 × (7 000 + 1 500) = 42,6 MB (contrato, sección 13).
const COTA = { apertura: 7_000, fragmento: 1_600, cierre: 1_500 };

type Medida = { consultas: number; leidas: number; escritas: number; r2: number; tamano: number };

// Entorno que suma el meta de cada consulta de D1 (first se resuelve con all para ver el suyo) y cuenta las
// llamadas a R2. El Worker no cambia: solo recibe este entorno en lugar del de Miniflare.
function medido(base: Entorno, m: Medida): Entorno {
  const sumar = <R extends D1Result>(r: R): R => {
    m.consultas++;
    m.leidas += r.meta.rows_read;
    m.escritas += r.meta.rows_written;
    m.tamano = r.meta.size_after;
    return r;
  };
  const sentencia = (s: D1PreparedStatement): D1PreparedStatement => {
    const original = { bind: s.bind.bind(s), all: s.all.bind(s), run: s.run.bind(s) };
    return Object.assign(s, {
      bind: (...valores: unknown[]) => sentencia(original.bind(...valores)),
      all: async () => sumar(await original.all()),
      run: async () => sumar(await original.run()),
      first: async (columna?: string) => {
        const fila = sumar(await original.all()).results[0] as Record<string, unknown> | undefined;
        return fila === undefined ? null : columna === undefined ? fila : fila[columna];
      },
    });
  };
  const DB = {
    prepare: (sql: string) => sentencia(base.DB.prepare(sql)),
    batch: async (sentencias: D1PreparedStatement[]) => (await base.DB.batch(sentencias)).map(sumar),
  } as unknown as D1Database;
  const EVIDENCIA = new Proxy(base.EVIDENCIA, {
    get(destino, nombre) {
      const valor = Reflect.get(destino, nombre);
      if (typeof valor !== 'function') return valor;
      return (...args: unknown[]) => {
        m.r2++;
        return valor.apply(destino, args);
      };
    },
  });
  return { ...base, DB, EVIDENCIA };
}

async function nuevoPar(): Promise<{ privada: CryptoKey; spki: Uint8Array }> {
  const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])) as CryptoKeyPair;
  return { privada: par.privateKey, spki: new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey) as ArrayBuffer) };
}

async function pedir(e: Entorno, metodo: string, ruta: string, tipo: string, cuerpo: Uint8Array, privada: CryptoKey, idDispositivo: string): Promise<Response> {
  const idPeticion = nuevoId(cripto);
  const cabeceras: Record<string, string> = {
    'Content-Type': tipo,
    [CABECERA.hora]: String(T),
    [CABECERA.peticion]: idPeticion,
    [CABECERA.firma]: await firmarPeticion(cripto, privada, { metodo, ruta, hora: T, idPeticion, idDispositivo, cuerpo }),
  };
  if (idDispositivo !== 'registro') cabeceras[CABECERA.dispositivo] = idDispositivo;
  return app.fetch(new Request(`https://api.prueba${ruta}`, { method: metodo, headers: cabeceras, body: cuerpo }), e);
}

/** Media por petición entre dos instantáneas de la medida. */
function por(de: Medida, a: Medida, n: number) {
  const media = (x: number) => Math.round((x * 10) / n) / 10;
  return {
    bytes: media(a.tamano - de.tamano),
    consultas: media(a.consultas - de.consultas),
    leidas: media(a.leidas - de.leidas),
    escritas: media(a.escritas - de.escritas),
    r2: media(a.r2 - de.r2),
  };
}

describe('medida de D1 y R2 por registro (contrato, sección 13; OPS-02)', () => {
  it('cada registro, en el peor caso, cabe en su cota de D1, y un fragmento nuevo hace un solo put en R2', async () => {
    const m: Medida = { consultas: 0, leidas: 0, escritas: 0, r2: 0, tamano: 0 };
    const e = medido(env, m);
    const dispositivo = await nuevoPar();
    const lectura = await nuevoPar();
    const alta = await pedir(e, 'POST', RUTA.dispositivos, 'application/json', cuerpoAlta({ lectura: b64u(lectura.spki), publica: b64u(dispositivo.spki) }), dispositivo.privada, 'registro');
    expect(alta.status).toBe(201);
    const id = (JSON.parse(await alta.text()) as { dispositivo: string }).dispositivo;
    const firmar = async (r: Registro) => {
      const { bytes, s } = await firmarRegistro(cripto, dispositivo.privada, r);
      return { bytes, s, hash: await hashRegistro(cripto, bytes) };
    };

    // Apertura en el peor caso: 5 envolturas y meta de 4096 bytes.
    const antes = { ...m };
    const incidentes: { id: string; hash: string }[] = [];
    for (let i = 0; i < N_INCIDENTES; i++) {
      const incidente = nuevoId(cripto);
      const a = await firmar({ v: 1, tipo: 'apertura', incidente, seq: 0, hora_telefono: T, country_code: 'VE', dispositivo: await huella(cripto, dispositivo.spki), origen: 'grabar', kc: hex(cripto.aleatorio(32)) });
      const envolturas: EnvolturaCuerpo[] = [
        ...[1, 2, 3].map((): EnvolturaCuerpo => ({ destino: nuevoId(cripto), k: b64u(cripto.aleatorio(80)), rol: 'contacto' })),
        { destino: '-', k: b64u(cripto.aleatorio(80)), rol: 'recuperacion' },
        { destino: '-', k: b64u(cripto.aleatorio(80)), rol: 'escucha' },
      ];
      const cuerpo = cuerpoIncidente({ envolturas, meta: b64u(cripto.aleatorio(4096)), r: b64u(a.bytes), s: b64u(a.s) });
      expect((await pedir(e, 'POST', RUTA.incidentes, 'application/json', cuerpo, dispositivo.privada, id)).status).toBe(201);
      incidentes.push({ id: incidente, hash: a.hash });
    }
    const trasAperturas = { ...m };

    // Fragmento en el peor caso: con `loc` y un cifrado de 16 KiB (lo mínimo que cuenta la cuota).
    const [primero] = incidentes;
    let prev = primero.hash;
    for (let seq = 1; seq <= N_FRAGMENTOS; seq++) {
      const cifrado = cripto.aleatorio(16_384);
      const f = await firmar({ v: 1, tipo: 'fragmento', incidente: primero.id, seq, hora_telefono: T, p: hex(cripto.aleatorio(32)), c: hex(await cripto.sha256(cifrado)), prev, loc: b64u(cripto.aleatorio(156)) });
      const sobre = empaquetarSobre({ r: f.bytes, s: f.s, cifrado });
      expect((await pedir(e, 'PUT', rutaFragmento(primero.id, seq), 'application/vnd.vigia.sobre', sobre, dispositivo.privada, id)).status).toBe(201);
      prev = f.hash;
    }
    const trasFragmentos = { ...m };

    for (const inc of incidentes) {
      const ultimo = inc === primero ? N_FRAGMENTOS : 0;
      const c = await firmar({ v: 1, tipo: 'cierre', incidente: inc.id, hora_telefono: T, ultimo_seq: ultimo, hash_final: inc === primero ? prev : inc.hash });
      const cuerpo = cuerpoCierre({ r: b64u(c.bytes), s: b64u(c.s) });
      expect((await pedir(e, 'POST', rutaCierre(inc.id), 'application/json', cuerpo, dispositivo.privada, id)).status).toBe(201);
    }
    const trasCierres = { ...m };

    const apertura = por(antes, trasAperturas, N_INCIDENTES);
    const fragmento = por(trasAperturas, trasFragmentos, N_FRAGMENTOS);
    const cierre = por(trasFragmentos, trasCierres, N_INCIDENTES);
    const huellaD1 = Math.round((Number(env.CUOTA_BYTES) / 16_384) * fragmento.bytes + Number(env.TOPE_INCIDENTES) * (apertura.bytes + cierre.bytes));
    console.log(`medida de H1: ${JSON.stringify({ apertura, fragmento, cierre, huellaD1 })}`);
    expect(fragmento.r2).toBe(1); // el put condicional; el head solo llega en un reintento
    expect({ apertura: apertura.bytes <= COTA.apertura, fragmento: fragmento.bytes <= COTA.fragmento, cierre: cierre.bytes <= COTA.cierre })
      .toEqual({ apertura: true, fragmento: true, cierre: true });
  });
});
