import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';

const ID = (c: string) => c.repeat(22);
const HEX = (c: string) => c.repeat(64);
const B = (n: number, v = 1) => new Uint8Array(n).fill(v);

const TABLAS = ['altas_por_hora', 'antirreenvio', 'cierres', 'contadores', 'dispositivos', 'envolturas', 'fragmentos', 'incidentes'];

const sql = (texto: string, ...valores: unknown[]) => env.DB.prepare(texto).bind(...valores).run();

beforeAll(async () => {
  // Una fila válida por tabla: los rechazos de abajo chocan con ellas.
  await sql('INSERT INTO dispositivos (id, spki, spki_lectura, huella) VALUES (?, ?, ?, ?)', ID('d'), B(91, 1), B(91, 2), HEX('d'));
  await sql('INSERT INTO incidentes (id, dispositivo, r, s, r_hash, acuse, meta, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), ID('d'), B(10), B(64), HEX('a'), B(10), B(4096), 1);
  await sql('INSERT INTO envolturas (incidente, rol, destino, k) VALUES (?, ?, ?, ?)', ID('i'), 'contacto', ID('c'), B(80));
  await sql('INSERT INTO fragmentos (incidente, seq, tipo, r, s, r_hash, prev, c, tamano, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 1, 'fragmento', B(10), B(64), HEX('b'), HEX('a'), HEX('c'), 100, B(10), 2);
  await sql('INSERT INTO fragmentos (incidente, seq, tipo, r, s, r_hash, prev, c, tamano, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 2, 'hueco', B(10), B(64), HEX('e'), HEX('b'), null, 0, B(10), 3);
  await sql('INSERT INTO cierres (incidente, ultimo_seq, hash_final, r, s, r_hash, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 2, HEX('e'), B(10), B(64), HEX('f'), B(10), 4);
  await sql('INSERT INTO antirreenvio (dispositivo, id_peticion, h, estado, cuerpo, creado) VALUES (?, ?, ?, ?, ?, ?)', ID('d'), ID('p'), HEX('h'), 201, B(10), 5);
  await sql('INSERT INTO altas_por_hora (hora, n) VALUES (?, ?)', 7, 1);
  await sql("INSERT INTO contadores (dia, nombre, valor) VALUES (?, 'acuses', ?)", 8, 1);
});

describe('esquema de D1 (D1-01, D1-02)', () => {
  it('las ocho tablas existen y son STRICT', async () => {
    const { results } = await env.DB.prepare('PRAGMA table_list').run<{ name: string; strict: number }>();
    const nuestras = results.filter((t) => TABLAS.includes(t.name));
    expect(nuestras.map((t) => t.name).sort()).toEqual(TABLAS);
    expect(nuestras.every((t) => t.strict === 1)).toBe(true);
  });

  it('sqlite_master muestra los índices de incidentes por dispositivo y de anti-reenvío por creado', async () => {
    const { results } = await env.DB.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%'").run<{ name: string; tbl_name: string }>();
    expect(results).toEqual(expect.arrayContaining([
      { name: 'incidentes_dispositivo', tbl_name: 'incidentes' },
      { name: 'antirreenvio_creado', tbl_name: 'antirreenvio' },
    ]));
  });

  it.each([
    ['id de dispositivo de 21', 'CHECK constraint failed: length(id) = 22', 'INSERT INTO dispositivos (id, spki, spki_lectura, huella) VALUES (?, ?, ?, ?)', 'x'.repeat(21), B(91, 3), B(91, 4), HEX('1')],
    ['pública repetida', 'UNIQUE constraint failed: dispositivos.spki', 'INSERT INTO dispositivos (id, spki, spki_lectura, huella) VALUES (?, ?, ?, ?)', ID('x'), B(91, 1), B(91, 4), HEX('1')],
    ['huella repetida', 'UNIQUE constraint failed: dispositivos.huella', 'INSERT INTO dispositivos (id, spki, spki_lectura, huella) VALUES (?, ?, ?, ?)', ID('x'), B(91, 3), B(91, 4), HEX('d')],
    ['SPKI de 90 bytes', 'CHECK constraint failed: length(spki) = 91', 'INSERT INTO dispositivos (id, spki, spki_lectura, huella) VALUES (?, ?, ?, ?)', ID('x'), B(90, 3), B(91, 4), HEX('1')],
    ['texto en una columna entera (STRICT)', 'cannot store TEXT value in INTEGER column', 'INSERT INTO dispositivos (id, spki, spki_lectura, huella, revocado_en) VALUES (?, ?, ?, ?, ?)', ID('x'), B(91, 3), B(91, 4), HEX('1'), 'ayer'],
    ['cuota negativa', 'CHECK constraint failed: bytes_usados >= 0', 'INSERT INTO dispositivos (id, spki, spki_lectura, huella, bytes_usados) VALUES (?, ?, ?, ?, ?)', ID('x'), B(91, 3), B(91, 4), HEX('1'), -1],
    ['incidente de un dispositivo inexistente', 'FOREIGN KEY constraint failed', 'INSERT INTO incidentes (id, dispositivo, r, s, r_hash, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?)', ID('j'), ID('z'), B(10), B(64), HEX('2'), B(10), 1],
    ['incidente repetido', 'UNIQUE constraint failed: incidentes.id', 'INSERT INTO incidentes (id, dispositivo, r, s, r_hash, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?)', ID('i'), ID('d'), B(10), B(64), HEX('2'), B(10), 1],
    ['hash de apertura repetido', 'UNIQUE constraint failed: incidentes.r_hash', 'INSERT INTO incidentes (id, dispositivo, r, s, r_hash, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?)', ID('j'), ID('d'), B(10), B(64), HEX('a'), B(10), 1],
    ['s de 63 bytes', 'CHECK constraint failed: length(s) = 64', 'INSERT INTO incidentes (id, dispositivo, r, s, r_hash, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?)', ID('j'), ID('d'), B(10), B(63), HEX('2'), B(10), 1],
    ['meta de 4097 bytes', 'CHECK constraint failed: meta IS NULL OR length(meta) <= 4096', 'INSERT INTO incidentes (id, dispositivo, r, s, r_hash, acuse, meta, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ID('j'), ID('d'), B(10), B(64), HEX('2'), B(10), B(4097), 1],
    ['envoltura repetida', 'UNIQUE constraint failed: envolturas.incidente, envolturas.rol, envolturas.destino', 'INSERT INTO envolturas (incidente, rol, destino, k) VALUES (?, ?, ?, ?)', ID('i'), 'contacto', ID('c'), B(80, 2)],
    ['rol fuera de la lista', 'CHECK constraint failed: rol IN', 'INSERT INTO envolturas (incidente, rol, destino, k) VALUES (?, ?, ?, ?)', ID('i'), 'otro', '-', B(80)],
    ['destino de 21', 'CHECK constraint failed: destino', 'INSERT INTO envolturas (incidente, rol, destino, k) VALUES (?, ?, ?, ?)', ID('i'), 'contacto', 'c'.repeat(21), B(80)],
    ['k de 79 bytes', 'CHECK constraint failed: length(k) = 80', 'INSERT INTO envolturas (incidente, rol, destino, k) VALUES (?, ?, ?, ?)', ID('i'), 'escucha', '-', B(79)],
    ['mismo (incidente, seq)', 'UNIQUE constraint failed: fragmentos.incidente, fragmentos.seq', 'INSERT INTO fragmentos (incidente, seq, tipo, r, s, r_hash, prev, tamano, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 1, 'hueco', B(10), B(64), HEX('3'), HEX('a'), 0, B(10), 1],
    ['mismo hash de registro', 'UNIQUE constraint failed: fragmentos.r_hash', 'INSERT INTO fragmentos (incidente, seq, tipo, r, s, r_hash, prev, tamano, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 3, 'hueco', B(10), B(64), HEX('b'), HEX('e'), 0, B(10), 1],
    ['seq 0 en fragmentos', 'CHECK constraint failed: seq BETWEEN 1 AND 999999', 'INSERT INTO fragmentos (incidente, seq, tipo, r, s, r_hash, prev, tamano, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 0, 'hueco', B(10), B(64), HEX('3'), HEX('a'), 0, B(10), 1],
    ['seq 1 000 000', 'CHECK constraint failed: seq BETWEEN 1 AND 999999', 'INSERT INTO fragmentos (incidente, seq, tipo, r, s, r_hash, prev, tamano, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 1_000_000, 'hueco', B(10), B(64), HEX('3'), HEX('a'), 0, B(10), 1],
    ['tipo apertura en fragmentos', 'CHECK constraint failed: tipo IN', 'INSERT INTO fragmentos (incidente, seq, tipo, r, s, r_hash, prev, tamano, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 3, 'apertura', B(10), B(64), HEX('3'), HEX('e'), 0, B(10), 1],
    ['marca que no es 0 ni 1', 'CHECK constraint failed: bifurcacion IN (0, 1)', 'INSERT INTO fragmentos (incidente, seq, tipo, r, s, r_hash, prev, tamano, acuse, recibido, bifurcacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 3, 'hueco', B(10), B(64), HEX('3'), HEX('e'), 0, B(10), 1, 2],
    ['segundo cierre', 'UNIQUE constraint failed: cierres.incidente', 'INSERT INTO cierres (incidente, ultimo_seq, hash_final, r, s, r_hash, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), 1, HEX('b'), B(10), B(64), HEX('4'), B(10), 1],
    ['ultimo_seq negativo', 'CHECK constraint failed: ultimo_seq BETWEEN 0 AND 999999', 'INSERT INTO cierres (incidente, ultimo_seq, hash_final, r, s, r_hash, acuse, recibido) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ID('i'), -1, HEX('b'), B(10), B(64), HEX('4'), B(10), 1],
    ['idPeticion repetido', 'UNIQUE constraint failed: antirreenvio.dispositivo, antirreenvio.id_peticion', 'INSERT INTO antirreenvio (dispositivo, id_peticion, h, estado, cuerpo, creado) VALUES (?, ?, ?, ?, ?, ?)', ID('d'), ID('p'), HEX('5'), 201, B(10), 6],
    ['idPeticion de 21', 'CHECK constraint failed: length(id_peticion) = 22', 'INSERT INTO antirreenvio (dispositivo, id_peticion, h, estado, cuerpo, creado) VALUES (?, ?, ?, ?, ?, ?)', ID('d'), 'p'.repeat(21), HEX('5'), 201, B(10), 6],
    ['hora de altas repetida', 'UNIQUE constraint failed: altas_por_hora.hora', 'INSERT INTO altas_por_hora (hora, n) VALUES (?, ?)', 7, 1],
    ['contador repetido', 'UNIQUE constraint failed: contadores.dia, contadores.nombre', "INSERT INTO contadores (dia, nombre, valor) VALUES (?, 'acuses', ?)", 8, 1],
    ['contador fuera de la lista', 'CHECK constraint failed: nombre IN', "INSERT INTO contadores (dia, nombre, valor) VALUES (?, 'otro', ?)", 9, 1],
  ])('rechaza: %s', async (_caso, motivo, texto, ...valores) => {
    await expect(sql(texto, ...valores)).rejects.toThrow(motivo);
  });

  it('un valor con comillas se trata como dato, no como SQL (D1-01)', async () => {
    const { results } = await env.DB.prepare('SELECT id FROM dispositivos WHERE id = ?').bind("' OR '1'='1").run();
    expect(results).toEqual([]);
  });
});
