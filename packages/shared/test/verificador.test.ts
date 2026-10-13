import { describe, expect, it } from 'vitest';
import { CLAVES_ACUSE_PRODUCCION, firmarAcuse } from '../src/acuse.ts';
import { deHex, hex, unir, utf8 } from '../src/codificacion.ts';
import { firmarEvento } from '../src/evento.ts';
import { leerZip } from '../src/paquete.ts';
import { PREFIJO } from '../src/prefijos.ts';
import { formatearHora, formatearIntervalo, TEXTOS, TIPO_DE, verificarPaquete, type OpcionesVerificacion } from '../src/verificador.ts';
import { claveAcuse, claveP256 } from './claves-prueba.ts';
import { cambiar, claves, cripto, INCIDENTE, MIN, nuevaPrueba, OTRO_INCIDENTE, T0, textos, ZIP_MALOS } from './incidente-prueba.ts';

const p = await nuevaPrueba();
const huella16 = p.huella.slice(0, 16);
const valido = p.paquete(await p.cerrada(2));
/** Por defecto, con la huella del enlace, la lista de prueba, la clave del incidente y la zona de Caracas. */
const verificar = (zip: Uint8Array, op: Partial<OpcionesVerificacion> = {}) =>
  verificarPaquete(cripto, zip, { huella: p.huella, claves: p.claves, k: p.k, zona: 'America/Caracas', ...op });
const archivo = (zip: Uint8Array, nombre: string) => leerZip(zip).get(nombre) as Uint8Array;
const sinArchivos = (seq: number) => Object.fromEntries(['registros/{}.r', 'registros/{}.s', 'cifrados/{}.bin', 'acuses/{}.json'].map((r) => [r.replace('{}', String(seq).padStart(6, '0')), null]));
/** Orden de la curva P-256 (sección 4): (r, n - s) es la otra firma válida del mismo mensaje. */
const ORDEN_P256 = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');

describe('horas de los mensajes', () => {
  it('HH:MM del DD-MM-AAAA (UTC±hh:mm), en la zona pedida', () => {
    const t = Date.UTC(2026, 9, 12, 14, 5, 59);
    expect(formatearHora(t, 'America/Caracas')).toBe('10:05 del 12-10-2026 (UTC-04:00)');
    expect(formatearHora(t, 'UTC')).toBe('14:05 del 12-10-2026 (UTC+00:00)');
  });

  it('un intervalo del mismo día lleva la fecha una vez', () => {
    expect(formatearIntervalo(T0 + MIN, T0 + 3 * MIN, 'America/Caracas')).toBe('entre 10:01 y 10:03 del 12-10-2026 (UTC-04:00)');
  });

  it('un intervalo que cruza la medianoche lleva las dos fechas', () => {
    const [desde, hasta] = [Date.UTC(2026, 9, 13, 3, 50), Date.UTC(2026, 9, 13, 4, 10)];
    expect(formatearIntervalo(desde, hasta, 'America/Caracas')).toBe('entre 23:50 del 12-10-2026 y 00:10 del 13-10-2026 (UTC-04:00)');
    expect(formatearIntervalo(desde, hasta, 'UTC')).toBe('entre 03:50 y 04:10 del 13-10-2026 (UTC+00:00)');
  });

  it('con desfases distintos, cada hora lleva el suyo', () => {
    // Fin del horario de verano: la misma hora de reloj dos veces.
    expect(formatearIntervalo(Date.UTC(2026, 10, 1, 5, 30), Date.UTC(2026, 10, 1, 6, 30), 'America/New_York'))
      .toBe('entre 01:30 del 01-11-2026 (UTC-04:00) y 01:30 del 01-11-2026 (UTC-05:00)');
  });

  it('cualquier hora de 0 a 2^53 - 1 tiene texto, también fuera del rango de Date', () => {
    // Valores calculados con aritmética entera de Python (días civiles de Hinnant).
    expect(formatearHora(8_640_000_000_000_000, 'UTC')).toBe('00:00 del 13-09-275760 (UTC+00:00)');
    expect(formatearHora(2 ** 53 - 1, 'UTC')).toBe('08:59 del 12-10-287396 (UTC+00:00)');
    expect(formatearHora(2 ** 53 - 1, 'America/Caracas')).toBe('04:59 del 12-10-287396 (UTC-04:00)');
  });
});

describe('lista cerrada de mensajes', () => {
  it('4 resúmenes, 18 fallos y 12 avisos, sin raya larga', () => {
    const por = (tipo: string) => Object.values(TIPO_DE).filter((t) => t === tipo).length;
    expect([por('resumen'), por('fallo'), por('aviso')]).toEqual([4, 18, 12]);
    expect(Object.keys(TEXTOS).sort()).toEqual(Object.keys(TIPO_DE).sort());
    for (const t of Object.values(TEXTOS)) expect(t).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('paquete auténtico', () => {
  it('con la clave y la huella del enlace: "✓ N fragmentos, cadena íntegra…" (DESIGN.md) y el audio de cada uno', async () => {
    const lista = await p.cerrada(3);
    const inf = await verificar(p.paquete(lista));
    expect(inf.resumen).toBe(`✓ 3 fragmentos, cadena íntegra, firmados por el dispositivo ${huella16}, recibidos entre 10:01 y 10:03 del 12-10-2026 (UTC-04:00)`);
    expect(inf).toMatchObject({ estado: 'integro', fragmentos: 3, desde: T0 + MIN, hasta: T0 + 3 * MIN, hallazgos: [], eventos: [] });
    expect([...inf.audio]).toEqual(lista.slice(1, 4).map((e) => [e.seq, e.audio]));
  });

  it('sin la huella del enlace ni la clave: dos avisos, el mismo ✓ y ningún audio', async () => {
    const inf = await verificar(p.paquete(await p.cerrada(3)), { huella: undefined, k: undefined });
    expect(textos(inf)).toEqual([
      `Aviso: la identidad del teléfono (${huella16}) la afirma el propio paquete; compárala con la del enlace`,
      'Audio sin comprobar: falta la clave para descifrar',
    ]);
    expect(inf.estado).toBe('integro');
    expect(inf.audio.size).toBe(0);
  });

  it('las claves de prueba no valen con la lista de producción (vacía en H1): el fallo es del acuse, no del teléfono', async () => {
    const inf = await verificar(p.paquete(await p.cerrada(1)), { claves: CLAVES_ACUSE_PRODUCCION });
    expect(textos(inf)).toEqual(['Apertura: sin acuse válido del servidor']);
  });

  it('una firma con s alto también vale: (r, s) y (r, n - s) verifican las dos, sin normalizar (sección 4)', async () => {
    const s = archivo(valido, 'registros/000001.s');
    const otra = unir(s.subarray(0, 32), deHex((ORDEN_P256 - BigInt(`0x${hex(s.subarray(32))}`)).toString(16).padStart(64, '0')));
    for (const firma of [s, otra]) { // una de las dos lleva el s alto
      const inf = await verificar(cambiar(valido, { 'registros/000001.s': firma }));
      expect(inf).toMatchObject({ estado: 'integro', fragmentos: 2, hallazgos: [] });
    }
  });
});

describe('resúmenes', () => {
  it('con un solo fragmento, ok y ok_incompleto van en singular y con su hora', async () => {
    const lista = await p.cerrada(1);
    const ok = await verificar(p.paquete(lista));
    expect(ok.resumen).toBe(`✓ 1 fragmento, cadena íntegra, firmado por el dispositivo ${huella16}, recibido a las 10:01 del 12-10-2026 (UTC-04:00)`);
    expect(ok).toMatchObject({ estado: 'integro', fragmentos: 1, desde: T0 + MIN, hasta: T0 + MIN, hallazgos: [] });
    const incompleto = await verificar(p.paquete(lista.slice(0, 2)));
    expect(incompleto.resumen).toBe(`✓ 1 fragmento firmado por el dispositivo ${huella16}, recibido a las 10:01 del 12-10-2026 (UTC-04:00); el paquete no está completo: mira los avisos`);
    expect(textos(incompleto)).toEqual(['El teléfono dejó de enviar a las 10:01 del 12-10-2026 (UTC-04:00)']);
  });

  it('con fallos: "Fragmentos que verifican: N", también con 0 y con 1', async () => {
    const zip = p.paquete(await p.cerrada(4));
    const romper = (seqs: readonly number[]) => cambiar(zip, Object.fromEntries(seqs.map((seq) => {
      const nombre = `cifrados/00000${seq}.bin`;
      const bin = archivo(zip, nombre).slice();
      bin[20] ^= 1;
      return [nombre, bin];
    })));
    for (const [seqs, resumen] of [
      [[2], '✗ Hay fallos (1); lo que falla no cuenta. Fragmentos que verifican: 3'],
      [[2, 3, 4], '✗ Hay fallos (3); lo que falla no cuenta. Fragmentos que verifican: 1'],
      [[1, 2, 3, 4], '✗ Hay fallos (4); lo que falla no cuenta. Fragmentos que verifican: 0'],
    ] as const) {
      expect((await verificar(romper(seqs))).resumen).toBe(resumen);
    }
  });
});

describe('acuse de la apertura y del cierre: si no vale, el fallo es del acuse y no del teléfono', () => {
  it('apertura con el acuse de un kid desconocido, o sin acuse: "Apertura: sin acuse válido del servidor", y se para', async () => {
    const lista = await p.cerrada(2);
    const otra = await claveAcuse('otra', 'activa', 0);
    const zip = p.paquete(lista);
    for (const acuse of [await firmarAcuse(cripto, otra.privada, 'otra', lista[0].hash, T0), null]) {
      const inf = await verificar(cambiar(zip, { 'acuses/000000.json': acuse }));
      expect(textos(inf)).toEqual(['Apertura: sin acuse válido del servidor']);
      expect(claves(inf)).not.toContain('apertura_invalida');
      expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 0, resumen: '✗ Hay fallos (1); lo que falla no cuenta. Fragmentos que verifican: 0' });
    }
  });

  it('apertura con el acuse de una clave comprometida: "Apertura: el acuse lo firmó una clave del servidor marcada como comprometida"', async () => {
    const lista = await p.cerrada(2);
    const vieja = await claveAcuse('vieja', 'comprometida', 0);
    const acuse = await firmarAcuse(cripto, vieja.privada, 'vieja', lista[0].hash, T0);
    const inf = await verificar(cambiar(p.paquete(lista), { 'acuses/000000.json': acuse }), { claves: [...p.claves, vieja.entrada] });
    expect(textos(inf)).toEqual(['Apertura: el acuse lo firmó una clave del servidor marcada como comprometida']);
    expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 0 });
  });

  it('cierre con un acuse que no vale: "Cierre: sin acuse válido del servidor", el cierre no cuenta y el teléfono dejó de enviar', async () => {
    const lista = await p.cerrada(2);
    const otra = await claveAcuse('otra', 'activa', 0);
    const acuse = await firmarAcuse(cripto, otra.privada, 'otra', lista[3].hash, T0 + 3 * MIN);
    const inf = await verificar(cambiar(p.paquete(lista), { 'acuses/cierre.json': acuse }));
    expect(textos(inf)).toEqual(['Cierre: sin acuse válido del servidor', 'El teléfono dejó de enviar a las 10:02 del 12-10-2026 (UTC-04:00)']);
    expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 2 });
    // Un cierre que no firmó el teléfono, o que es de otro incidente, sigue siendo cierre_invalido.
    const otro = await claveP256();
    const ajeno = utf8(new TextDecoder().decode(lista[3].r).replace(INCIDENTE, OTRO_INCIDENTE));
    const invalidos: Record<string, Uint8Array>[] = [
      { 'registros/cierre.s': await cripto.firmarP256(otro.privada, unir(PREFIJO.cierre, lista[3].r)) },
      { 'registros/cierre.r': ajeno, 'registros/cierre.s': await cripto.firmarP256(p.dispositivo.privada, unir(PREFIJO.cierre, ajeno)) },
    ];
    for (const cambios of invalidos) {
      expect(textos(await verificar(cambiar(p.paquete(lista), cambios)))).toEqual([
        'El cierre no está firmado por el teléfono o no es de este incidente',
        'El teléfono dejó de enviar a las 10:02 del 12-10-2026 (UTC-04:00)',
      ]);
    }
  });
});

describe('manipulación (criterios de H1, con el texto de DESIGN.md)', () => {
  it('1 byte cambiado en un cifrado: "Fragmento N: no coincide con lo que firmó el teléfono"', async () => {
    const zip = p.paquete(await p.cerrada(3));
    const bin = archivo(zip, 'cifrados/000002.bin').slice();
    bin[20] ^= 1;
    const inf = await verificar(cambiar(zip, { 'cifrados/000002.bin': bin }));
    expect(textos(inf)).toEqual(['Fragmento 2: no coincide con lo que firmó el teléfono']);
    expect(inf.resumen).toBe('✗ Hay fallos (1); lo que falla no cuenta. Fragmentos que verifican: 2');
    expect([...inf.audio.keys()]).toEqual([1, 3]);
  });

  it('sin la clave, el mismo byte cambiado también da "no coincide" y nunca ✓: c se comprueba siempre', async () => {
    const zip = p.paquete(await p.cerrada(3));
    const bin = archivo(zip, 'cifrados/000002.bin').slice();
    bin[20] ^= 1;
    const inf = await verificar(cambiar(zip, { 'cifrados/000002.bin': bin }), { k: undefined });
    expect(textos(inf)).toEqual(['Audio sin comprobar: falta la clave para descifrar', 'Fragmento 2: no coincide con lo que firmó el teléfono']);
    expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 2 });
  });

  it('dos fragmentos intercambiados: "Registro N: es de otro incidente o no corresponde a su lugar en el paquete"', async () => {
    const zip = p.paquete(await p.cerrada(3));
    const cambios: Record<string, Uint8Array> = {};
    for (const ruta of ['registros/{}.r', 'registros/{}.s', 'cifrados/{}.bin', 'acuses/{}.json']) {
      cambios[ruta.replace('{}', '000002')] = archivo(zip, ruta.replace('{}', '000003'));
      cambios[ruta.replace('{}', '000003')] = archivo(zip, ruta.replace('{}', '000002'));
    }
    const inf = await verificar(cambiar(zip, cambios));
    expect(textos(inf)).toEqual([
      'Registro 2: es de otro incidente o no corresponde a su lugar en el paquete',
      'Registro 3: es de otro incidente o no corresponde a su lugar en el paquete',
      'El cierre no se puede comprobar: falta el registro 3',
    ]);
    expect(inf.resumen).toBe('✗ Hay fallos (2); lo que falla no cuenta. Fragmentos que verifican: 1');
  });

  it('firma de otro dispositivo: "Registro N: no lo firmó el teléfono"', async () => {
    const lista = await p.cerrada(3);
    const otro = await claveP256();
    const s = await cripto.firmarP256(otro.privada, unir(PREFIJO.registro, lista[2].r));
    const inf = await verificar(cambiar(p.paquete(lista), { 'registros/000002.s': s }));
    expect(textos(inf)).toEqual(['Registro 2: no lo firmó el teléfono', 'Registro 3: falta el anterior y su enlace no se puede comprobar']);
    expect(inf.fragmentos).toBe(2);
  });

  it('paquete de otro teléfono: "El paquete no es del teléfono del enlace"', async () => {
    const otro = await nuevaPrueba();
    const inf = await verificar(otro.paquete(await otro.cerrada(1)), { claves: otro.claves });
    expect(textos(inf)).toEqual(['El paquete no es del teléfono del enlace']);
    expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 0, resumen: '✗ Hay fallos (1); lo que falla no cuenta. Fragmentos que verifican: 0' });
  });

  it('country_code alterado en la apertura: "La apertura falta, no es de este paquete o no la firmó el teléfono: la cadena no tiene origen"', async () => {
    const lista = await p.cerrada(2);
    const r = utf8(new TextDecoder().decode(lista[0].r).replace('"country_code":"VE"', '"country_code":"CO"'));
    const inf = await verificar(cambiar(p.paquete(lista), { 'registros/000000.r': r }));
    expect(textos(inf)).toEqual(['La apertura falta, no es de este paquete o no la firmó el teléfono: la cadena no tiene origen']);
    expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 0 });
  });

  it('cierre ausente: "El teléfono dejó de enviar a las HH:MM del DD-MM-AAAA (UTC±hh:mm)"', async () => {
    const inf = await verificar(p.paquete(await p.cadena(3)));
    expect(textos(inf)).toEqual(['El teléfono dejó de enviar a las 10:03 del 12-10-2026 (UTC-04:00)']);
    expect(inf.estado).toBe('incompleto');
    expect(inf.resumen).toBe(`✓ 3 fragmentos firmados por el dispositivo ${huella16}, recibidos entre 10:01 y 10:03 del 12-10-2026 (UTC-04:00); el paquete no está completo: mira los avisos`);
  });
});

describe('foco 3: el cierre que contradice lo recibido antes', () => {
  it('un cierre corto con acuse posterior a los fragmentos: cierre_contradice, los fragmentos cuentan y no hay despues_del_cierre', async () => {
    const lista = await p.cadena(4);
    const corto = await p.cierre(2, lista[2].hash, T0 + 10 * MIN);
    const inf = await verificar(p.paquete([...lista, corto]));
    expect(textos(inf)).toEqual([
      'El cierre contradice registros que el servidor recibió antes que él: el cierre no cuenta',
      'El teléfono dejó de enviar a las 10:10 del 12-10-2026 (UTC-04:00)',
    ]);
    expect(claves(inf)).not.toContain('despues_del_cierre');
    expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 4 });
    expect([...inf.audio.keys()]).toEqual([1, 2, 3, 4]);
  });

  it('un registro con acuse posterior al cierre: "Registro N: llegó después del cierre", y el cierre cuenta', async () => {
    const lista = await p.cadena(3, (seq) => T0 + (seq === 3 ? 10 : seq) * MIN);
    const inf = await verificar(p.paquete([...lista, await p.cierre(2, lista[2].hash, T0 + 5 * MIN)]));
    expect(textos(inf)).toEqual(['Registro 3: llegó después del cierre']);
    expect(inf.fragmentos).toBe(2);
  });

  it('hash_final que no es el del registro ultimo_seq: el hallazgo es del que llegó después', async () => {
    const lista = await p.cadena(2);
    const tarde = await verificar(p.paquete([...lista, await p.cierre(2, lista[1].hash, T0 + 5 * MIN)]));
    expect(textos(tarde)).toEqual([
      'El cierre contradice registros que el servidor recibió antes que él: el cierre no cuenta',
      'El teléfono dejó de enviar a las 10:05 del 12-10-2026 (UTC-04:00)',
    ]);
    const dosTarde = await p.cadena(2, (seq) => T0 + (seq === 2 ? 10 : seq) * MIN);
    const inf = await verificar(p.paquete([...dosTarde, await p.cierre(2, lista[2].hash, T0 + 5 * MIN)]));
    expect(textos(inf)).toEqual(['Registro 2: contradice lo que el servidor recibió antes']);
    expect(inf.fragmentos).toBe(1);
  });

  it('con ultimo_seq 0 y otro hash_final, el cierre contradice a la apertura sin comparar horas (la apertura siempre llegó antes)', async () => {
    const apertura = await p.apertura(T0, 'sos');
    for (const hora of [T0, T0 - MIN]) { // la misma hora que el acuse de la apertura, y una anterior
      const inf = await verificar(p.paquete([apertura, await p.cierre(0, 'ab'.repeat(32), hora)]));
      expect(textos(inf)).toEqual(['El cierre contradice registros que el servidor recibió antes que él: el cierre no cuenta']);
      expect(inf.hallazgos.filter((h) => h.seq === 0)).toEqual([]);
      expect(inf.estado).toBe('fallido');
    }
  });

  it('un registro de seq mayor con la misma hora que el cierre: el hallazgo es para los dos', async () => {
    const lista = await p.cadena(3);
    const inf = await verificar(p.paquete([...lista, await p.cierre(2, lista[2].hash, T0 + 3 * MIN)]));
    expect(textos(inf)).toEqual([
      'Registro 3: llegó después del cierre',
      'El cierre contradice registros que el servidor recibió antes que él: el cierre no cuenta',
      'El teléfono dejó de enviar a las 10:03 del 12-10-2026 (UTC-04:00)',
    ]);
    expect(inf.fragmentos).toBe(2);
  });

  it('un fragmento cuyo .bin no cuadra sigue contando frente al cierre: su r lo firmó el teléfono y lo acusó el servidor', async () => {
    const lista = await p.cadena(3);
    const zip = p.paquete([...lista, await p.cierre(2, lista[2].hash, T0 + 10 * MIN)]);
    const bin = archivo(zip, 'cifrados/000003.bin').slice();
    bin[20] ^= 1;
    const inf = await verificar(cambiar(zip, { 'cifrados/000003.bin': bin }));
    expect(textos(inf)).toEqual([
      'Fragmento 3: no coincide con lo que firmó el teléfono',
      'El cierre contradice registros que el servidor recibió antes que él: el cierre no cuenta',
      'El teléfono dejó de enviar a las 10:10 del 12-10-2026 (UTC-04:00)',
    ]);
    expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 2 });
  });
});

describe('enlaces: el hallazgo es para el registro que llegó después', () => {
  it('el siguiente llegó después: "Registro N: no sigue al anterior"', async () => {
    const lista = await p.cadena(2);
    const tres = await p.fragmento(3, 'ab'.repeat(32), T0 + 3 * MIN);
    const inf = await verificar(p.paquete([...lista, tres, await p.cierre(3, tres.hash, T0 + 4 * MIN)]));
    expect(textos(inf)).toEqual(['Registro 3: no sigue al anterior']);
    expect(inf.fragmentos).toBe(2);
  });

  it('el anterior llegó después: "Registro N: contradice lo que el servidor recibió antes", y el siguiente cuenta', async () => {
    const lista = await p.cerrada(3);
    const otroDos = await p.fragmento(2, lista[1].hash, T0 + 5 * MIN, { audio: utf8('otro audio') });
    const inf = await verificar(p.paquete(lista.map((e) => (e.seq === 2 ? otroDos : e))));
    expect(textos(inf)).toEqual(['Registro 2: contradice lo que el servidor recibió antes']);
    expect([...inf.audio.keys()]).toEqual([1, 3]);
  });

  it('con la misma hora, para los dos', async () => {
    const lista = await p.cadena(2);
    const tres = await p.fragmento(3, 'ab'.repeat(32), T0 + 2 * MIN);
    const inf = await verificar(p.paquete([...lista, tres, await p.cierre(3, tres.hash, T0 + 4 * MIN)]));
    expect(textos(inf)).toEqual(['Registro 2: contradice lo que el servidor recibió antes', 'Registro 3: no sigue al anterior']);
    expect(inf.fragmentos).toBe(1);
  });

  it('la apertura siempre llegó antes: el 1 que no la sigue tiene la culpa aunque su acuse sea anterior', async () => {
    const apertura = await p.apertura(T0);
    const uno = await p.fragmento(1, 'ab'.repeat(32), T0 - MIN);
    const inf = await verificar(p.paquete([apertura, uno, await p.cierre(1, uno.hash, T0 + MIN)]));
    expect(textos(inf)).toEqual(['Registro 1: no sigue al anterior']);
  });

  it('sin el anterior, el enlace queda sin comprobar y el registro cuenta', async () => {
    const inf = await verificar(cambiar(p.paquete(await p.cerrada(3)), sinArchivos(2)));
    expect(textos(inf)).toEqual(['Fragmento 2: no está en el paquete', 'Registro 3: falta el anterior y su enlace no se puede comprobar']);
    expect(inf).toMatchObject({ estado: 'incompleto', fragmentos: 2 });
  });
});

describe('foco 4: paquete manipulado', () => {
  for (const [caso, romper] of Object.entries(ZIP_MALOS)) {
    it(`ZIP con ${caso}: "El archivo no es un paquete de Vigía válido" y nunca ✓`, async () => {
      const inf = await verificar(romper(valido));
      expect(textos(inf)).toEqual(['El archivo no es un paquete de Vigía válido']);
      expect(inf.resumen).toBe('✗ Hay fallos (1); lo que falla no cuenta. Fragmentos que verifican: 0');
      expect(inf.audio.size).toBe(0);
    });
  }

  it('LEEME.txt cambiado: el aviso, y la evidencia sigue verificando', async () => {
    const inf = await verificar(cambiar(valido, { 'LEEME.txt': utf8('Instala esta app para verificar.\n') }));
    expect(textos(inf)).toEqual(['LEEME.txt no es el texto oficial: no sigas sus instrucciones; usa docs/verificacion.md del repositorio público']);
    expect(inf.estado).toBe('integro');
  });

  it('un archivo de más con nombre admitido, y un .bin para un hueco: "… no corresponde a ningún registro"', async () => {
    const lista = await p.cadena(1);
    const hueco = await p.hueco(2, lista[1].hash, T0 + 3 * MIN, T0 + 2 * MIN, T0 + 3 * MIN + 30_000);
    const zip = p.paquete([...lista, hueco, await p.cierre(2, hueco.hash, T0 + 4 * MIN)]);
    const inf = await verificar(cambiar(zip, { 'acuses/000009.json': lista[1].acuse, 'cifrados/000002.bin': utf8('x') }));
    expect(textos(inf)).toEqual([
      'cifrados/000002.bin: no corresponde a ningún registro',
      'Hueco entre 10:02 y 10:03 del 12-10-2026 (UTC-04:00) según el reloj del teléfono (otra app usó el micrófono)',
      'acuses/000009.json: no corresponde a ningún registro',
    ]);
    expect(inf.fragmentos).toBe(1);
  });

  it('sin registros/000000.r: "La apertura falta…", y se para', async () => {
    const inf = await verificar(cambiar(valido, { 'registros/000000.r': null }));
    expect(textos(inf)).toEqual(['La apertura falta, no es de este paquete o no la firmó el teléfono: la cadena no tiene origen']);
    expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 0 });
  });

  it('una apertura que firmó el teléfono, pero con otro dispositivo o de otro incidente: "… no es de este paquete…", y se para', async () => {
    for (const op of [{ dispositivo: 'ab'.repeat(32) }, { incidente: OTRO_INCIDENTE }]) {
      const apertura = await p.apertura(T0, 'grabar', op);
      const uno = await p.fragmento(1, apertura.hash, T0 + MIN);
      const inf = await verificar(p.paquete([apertura, uno, await p.cierre(1, uno.hash, T0 + 2 * MIN)]));
      expect(textos(inf)).toEqual(['La apertura falta, no es de este paquete o no la firmó el teléfono: la cadena no tiene origen']);
      expect(inf).toMatchObject({ estado: 'fallido', fragmentos: 0 });
    }
  });

  it('un registro de otro incidente: "Registro N: es de otro incidente…"', async () => {
    const lista = await p.cerrada(3);
    const ajeno = await p.fragmento(2, lista[1].hash, T0 + 2 * MIN, { incidente: OTRO_INCIDENTE });
    const inf = await verificar(p.paquete(lista.map((e) => (e.seq === 2 ? ajeno : e))));
    expect(textos(inf)).toEqual([
      'Registro 2: es de otro incidente o no corresponde a su lugar en el paquete',
      'Registro 3: falta el anterior y su enlace no se puede comprobar',
    ]);
  });

  it('un registro que no se analiza, uno sin firma y acuses que no valen', async () => {
    const lista = await p.cerrada(4);
    const vieja = await claveAcuse('vieja', 'comprometida', 0);
    const otra = await claveAcuse('otra', 'activa', 0);
    const zip = cambiar(p.paquete(lista), {
      'registros/000001.r': utf8('{"v":2}'),
      'registros/000002.s': null,
      'acuses/000003.json': await firmarAcuse(cripto, otra.privada, 'otra', lista[3].hash, T0 + 3 * MIN),
      'acuses/000004.json': await firmarAcuse(cripto, vieja.privada, 'vieja', lista[4].hash, T0 + 4 * MIN),
    });
    const inf = await verificar(zip, { claves: [...p.claves, vieja.entrada] });
    expect(textos(inf)).toEqual([
      'Registro 1: formato que esta versión del verificador no reconoce',
      'Registro 2: le falta registros/000002.s',
      'Registro 3: sin acuse válido del servidor',
      'Registro 4: el acuse lo firmó una clave del servidor marcada como comprometida',
      'El cierre no se puede comprobar: falta el registro 4',
    ]);
    expect(inf.resumen).toBe('✗ Hay fallos (4); lo que falla no cuenta. Fragmentos que verifican: 0');
  });
});

describe('clave del incidente', () => {
  it('kc incorrecto: "La clave no abre este incidente…" y no se descifra nada', async () => {
    const inf = await verificar(p.paquete(await p.cerrada(2)), { k: cripto.aleatorio(32) });
    expect(textos(inf)).toEqual(['La clave no abre este incidente: el audio no se puede comprobar']);
    expect(inf).toMatchObject({ estado: 'integro', fragmentos: 2 });
    expect(inf.audio.size).toBe(0);
  });

  it('ilegible si no descifra (audio o posición), no_coincide si p no es el del audio', async () => {
    const lista = await p.cadena(1);
    const aadAjena = await p.fragmento(2, lista[1].hash, T0 + 2 * MIN, { seqAad: 7 });
    const locFalsa = await p.fragmento(3, aadAjena.hash, T0 + 3 * MIN, { loc: 'A'.repeat(208) });
    const otroP = await p.fragmento(4, locFalsa.hash, T0 + 4 * MIN, { p: 'ab'.repeat(32) });
    const inf = await verificar(p.paquete([...lista, aadAjena, locFalsa, otroP, await p.cierre(4, otroP.hash, T0 + 5 * MIN)]));
    expect(textos(inf)).toEqual([
      'Fragmento 2: lo firmó el teléfono, pero no se puede descifrar',
      'Fragmento 3: lo firmó el teléfono, pero no se puede descifrar',
      'Fragmento 4: no coincide con lo que firmó el teléfono',
    ]);
    expect([...inf.audio.keys()]).toEqual([1]);
  });
});

describe('faltan, cierres extremos y medianoche', () => {
  it('los que faltan seguidos van juntos: "Fragmentos 2 a 4: no están en el paquete"', async () => {
    const zip = cambiar(p.paquete(await p.cerrada(6)), { ...sinArchivos(2), ...sinArchivos(3), ...sinArchivos(4), ...sinArchivos(6) });
    const inf = await verificar(zip);
    expect(textos(inf)).toEqual([
      'Fragmentos 2 a 4: no están en el paquete',
      'Registro 5: falta el anterior y su enlace no se puede comprobar',
      'Fragmento 6: no está en el paquete',
      'El cierre no se puede comprobar: falta el registro 6',
    ]);
    expect(inf.resumen).toBe(`✓ 2 fragmentos firmados por el dispositivo ${huella16}, recibidos entre 10:01 y 10:05 del 12-10-2026 (UTC-04:00); el paquete no está completo: mira los avisos`);
  });

  it('un cierre con ultimo_seq 999 999 no genera un millón de hallazgos', async () => {
    const lista = await p.cadena(2);
    const inf = await verificar(p.paquete([...lista, await p.cierre(999_999, 'ab'.repeat(32), T0 + 3 * MIN)]));
    expect(textos(inf)).toEqual(['Fragmentos 3 a 999999: no están en el paquete', 'El cierre no se puede comprobar: falta el registro 999999']);
    expect(inf.estado).toBe('incompleto');
  });

  it('un hueco firmado con la hora 2^53 - 1 no hace fallar al verificador', async () => {
    const lista = await p.cadena(1);
    const hueco = await p.hueco(2, lista[1].hash, T0 + 2 * MIN, 2 ** 53 - 1 - MIN, 2 ** 53 - 1);
    const inf = await verificar(p.paquete([...lista, hueco, await p.cierre(2, hueco.hash, T0 + 3 * MIN)]));
    expect(textos(inf)).toEqual(['Hueco entre 04:58 y 04:59 del 12-10-287396 (UTC-04:00) según el reloj del teléfono (otra app usó el micrófono)']);
  });

  it('recibidos a ambos lados de la medianoche: cada hora con su fecha', async () => {
    const medianoche = Date.UTC(2026, 9, 13, 4, 0); // 00:00 del 13-10-2026 en Caracas
    const lista = await p.cadena(2, (seq) => medianoche + (seq - 2) * MIN);
    const zip = p.paquete([...lista, await p.cierre(2, lista[2].hash, medianoche + MIN)]);
    expect((await verificar(zip)).resumen).toBe(`✓ 2 fragmentos, cadena íntegra, firmados por el dispositivo ${huella16}, recibidos entre 23:59 del 12-10-2026 y 00:00 del 13-10-2026 (UTC-04:00)`);
    expect((await verificar(zip, { zona: 'UTC' })).resumen).toBe(`✓ 2 fragmentos, cadena íntegra, firmados por el dispositivo ${huella16}, recibidos entre 03:59 y 04:00 del 13-10-2026 (UTC+00:00)`);
  });
});

describe('SOS sin grabación', () => {
  it('apertura sos con su cierre: "✓ Apertura firmada…"; sin cierre no se dice nada más', async () => {
    const apertura = await p.apertura(T0, 'sos');
    const resumen = `✓ Apertura firmada por el dispositivo ${huella16}, recibida a las 10:00 del 12-10-2026 (UTC-04:00); el paquete no trae fragmentos`;
    const conCierre = await verificar(p.paquete([apertura, await p.cierre(0, apertura.hash, T0 + MIN)]));
    expect(conCierre).toMatchObject({ estado: 'integro', fragmentos: 0, hallazgos: [], resumen });
    const sinCierre = await verificar(p.paquete([apertura]));
    expect(sinCierre).toMatchObject({ estado: 'incompleto', hallazgos: [], resumen });
  });

  it('sin ningún fragmento que cuente, aunque haya huecos, el resumen es el de la apertura', async () => {
    const apertura = await p.apertura();
    const hueco = await p.hueco(1, apertura.hash, T0 + MIN, T0, T0 + MIN);
    const inf = await verificar(p.paquete([apertura, hueco, await p.cierre(1, hueco.hash, T0 + 2 * MIN)]));
    expect(inf.resumen).toBe(`✓ Apertura firmada por el dispositivo ${huella16}, recibida a las 10:00 del 12-10-2026 (UTC-04:00); el paquete no trae fragmentos`);
    expect(textos(inf)).toEqual(['Hueco entre 10:00 y 10:01 del 12-10-2026 (UTC-04:00) según el reloj del teléfono (otra app usó el micrófono)']);
    expect(inf.estado).toBe('integro');
  });

  it('una apertura grabar sin nada más: dejó de enviar', async () => {
    const inf = await verificar(p.paquete([await p.apertura()]));
    expect(textos(inf)).toEqual(['El teléfono dejó de enviar a las 10:00 del 12-10-2026 (UTC-04:00)']);
  });
});

describe('marcas: después de la alerta y de la revocación', () => {
  it('transitiva (ejemplo 8-9-10): un sucesor con acuse anterior a la alerta fija a los que llegaron después', async () => {
    const minuto: Record<number, number> = { 8: 11, 9: 12, 10: 8 }; // el 10 llega antes de la alerta; el 8 y el 9, después
    const lista = await p.cadena(10, (seq) => T0 + (minuto[seq] ?? seq) * MIN);
    const eventos = [await p.evento('alerta', T0 + 9 * MIN)];
    const conDiez = await verificar(p.paquete(lista, { eventos }));
    expect(claves(conDiez)).toEqual(['sin_cierre']);
    expect(conDiez.eventos).toEqual([{ evento: 'alerta', hora: T0 + 9 * MIN, incidente: INCIDENTE }]);
    const sinDiez = await verificar(p.paquete(lista.slice(0, 10), { eventos }));
    expect(textos(sinDiez).slice(0, 2)).toEqual([
      'Registro 8: llegó después de la alerta; pudo enviarlo otra persona',
      'Registro 9: llegó después de la alerta; pudo enviarlo otra persona',
    ]);
    expect(sinDiez.fragmentos).toBe(9); // un aviso no excluye
  });

  it('el cierre anterior a la alerta fija la cadena hasta hash_final; uno posterior lleva la marca', async () => {
    const lista = await p.cadena(3, (seq) => T0 + (seq >= 2 ? 6 + seq : seq) * MIN); // el 2 y el 3 llegan a las 10:08 y 10:09
    const cierre = await p.cierre(3, lista[3].hash, T0 + 4 * MIN);
    const zip = async (alerta: number) => p.paquete([...lista, cierre], { eventos: [await p.evento('alerta', alerta)] });
    expect((await verificar(await zip(T0 + 5 * MIN))).hallazgos).toEqual([]);
    expect(textos(await verificar(await zip(T0 + 3 * MIN)))).toEqual([
      'Registro 2: llegó después de la alerta; pudo enviarlo otra persona',
      'Registro 3: llegó después de la alerta; pudo enviarlo otra persona',
      'Cierre: llegó después de la alerta; pudo enviarlo otra persona',
    ]);
  });

  it('con dos alertas, T_alerta es la menor, en cualquier orden de eventos.txt', async () => {
    const lista = await p.cerrada(3);
    const [primera, segunda] = [await p.evento('alerta', T0 + 90_000), await p.evento('alerta', T0 + 150_000)];
    const ordenado = p.paquete(lista, { eventos: [primera, segunda] });
    const salto = Uint8Array.of(0x0a);
    const inverso = cambiar(ordenado, { 'eventos.txt': unir(segunda, salto, primera, salto) });
    for (const zip of [inverso, ordenado]) {
      expect(textos(await verificar(zip))).toEqual([
        'Registro 2: llegó después de la alerta; pudo enviarlo otra persona',
        'Registro 3: llegó después de la alerta; pudo enviarlo otra persona',
        'Cierre: llegó después de la alerta; pudo enviarlo otra persona',
      ]);
    }
  });

  it('tras la revocación del teléfono (evento con incidente -): "Registro N: llegó después de revocar el teléfono"', async () => {
    const revocacion = await p.evento('revocacion', T0 + 90_000, { incidente: '-' });
    const inf = await verificar(p.paquete(await p.cerrada(2), { eventos: [revocacion] }));
    expect(textos(inf)).toEqual(['Registro 2: llegó después de revocar el teléfono', 'Cierre: llegó después de revocar el teléfono']);
  });

  it('una marca en la apertura dice "Apertura: …"', async () => {
    const revocacion = await p.evento('revocacion', T0 - MIN, { incidente: '-' });
    const inf = await verificar(p.paquete(await p.cerrada(1), { eventos: [revocacion] }));
    expect(textos(inf)).toEqual([
      'Apertura: llegó después de revocar el teléfono',
      'Registro 1: llegó después de revocar el teléfono',
      'Cierre: llegó después de revocar el teléfono',
    ]);
  });

  it('un evento que no verifica no cuenta: "Evento N: no lo firmó el servidor o no es de este incidente"', async () => {
    const otra = await claveAcuse('otra', 'activa', 0);
    const vieja = await claveAcuse('vieja', 'comprometida', 0); // está en la lista, marcada como comprometida
    const eventos = [
      await firmarEvento(cripto, otra.privada, { v: 1, evento: 'alerta', dispositivo: p.huella, incidente: INCIDENTE, hora_servidor: T0 + 30_000, kid: 'otra' }),
      await p.evento('alerta', T0 + 40_000, { incidente: OTRO_INCIDENTE }),
      await p.evento('alerta', T0 + 50_000, { dispositivo: 'ab'.repeat(32) }),
      await firmarEvento(cripto, vieja.privada, { v: 1, evento: 'alerta', dispositivo: p.huella, incidente: INCIDENTE, hora_servidor: T0 + 60_000, kid: 'vieja' }),
    ];
    const inf = await verificar(p.paquete(await p.cerrada(2), { eventos }), { claves: [...p.claves, vieja.entrada] });
    expect(textos(inf)).toEqual([1, 2, 3, 4].map((n) => `Evento ${n}: no lo firmó el servidor o no es de este incidente`));
    expect(inf.eventos).toEqual([]);
  });

  it('una última línea de eventos.txt sin 0x0A no es un evento: "Evento 1: …", y no cuenta', async () => {
    const zip = cambiar(p.paquete(await p.cerrada(2)), { 'eventos.txt': await p.evento('alerta', T0 + 90_000) });
    const inf = await verificar(zip);
    expect(textos(inf)).toEqual(['Evento 1: no lo firmó el servidor o no es de este incidente']);
    expect(inf.eventos).toEqual([]);
  });
});
