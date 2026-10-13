import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { b64u, ErrorFormato, hex, utf8 } from '../src/codificacion.ts';
import { crearPaquete, crearZip, leerZip, LEEME, RUTA_PAQUETE, SHA256_LEEME } from '../src/paquete.ts';
import { INCIDENTE, MIN, nuevaPrueba, T0, ZIP_MALOS } from './incidente-prueba.ts';

const le16 = (n: number) => hex(Uint8Array.of(n & 0xff, n >>> 8));
const le32 = (n: number) => le16(n & 0xffff) + le16(n >>> 16);
const ascii = (t: string) => Buffer.from(t, 'latin1').toString('hex');
const texto = (b: Uint8Array | undefined) => new TextDecoder().decode(b);

const p = await nuevaPrueba();
const lista = await p.cerrada(2);
const valido = p.paquete(lista);

describe('crearZip (sección 14)', () => {
  it('escribe los campos fijos: bytes exactos de un archivo', () => {
    const crc = '88f9a06f'; // CRC-32 de "hola" (zlib.crc32 de Python: 0x6fa0f988), en little-endian
    const local = `504b0304${'0a00'}${'0000'}${'0000'}${'0000'}${'2100'}${crc}${le32(4)}${le32(4)}${le16(9)}0000${ascii('LEEME.txt')}`;
    const central = `504b0102${'0a00'}${'0a00'}${'0000'}${'0000'}${'0000'}${'2100'}${crc}${le32(4)}${le32(4)}${le16(9)}0000${'0000'}${'0000'}${'0000'}${'00000000'}${le32(0)}${ascii('LEEME.txt')}`;
    const fin = `504b0506${'0000'}${'0000'}${le16(1)}${le16(1)}${le32(55)}${le32(43)}0000`;
    expect(hex(crearZip([['LEEME.txt', utf8('hola')]]))).toBe(`${local}${ascii('hola')}${central}${fin}`);
  });

  it('sin ZIP64: 65 535 entradas sí, 65 536 no', () => {
    const vacios = (n: number) => Array.from({ length: n }, (_, i) => [`registros/${String(i).padStart(6, '0')}.r`, new Uint8Array(0)] as const);
    expect(leerZip(crearZip(vacios(65_535))).size).toBe(65_535);
    expect(() => crearZip(vacios(65_536))).toThrow(ErrorFormato);
  });

  it('solo nombres ASCII', () => {
    expect(() => crearZip([['registros/ñ.r', utf8('x')]])).toThrow(ErrorFormato);
  });
});

describe('leerZip: lectura estricta', () => {
  it('devuelve cada archivo con sus bytes', () => {
    const archivos = leerZip(valido);
    expect(archivos.get('registros/000001.r')).toEqual(lista[1].r);
    expect(archivos.get('cifrados/000002.bin')).toEqual(lista[2].cifrado);
    expect(archivos.get('acuses/cierre.json')).toEqual(lista[3].acuse);
  });

  for (const [caso, romper] of Object.entries(ZIP_MALOS)) {
    it(`rechaza ${caso}`, () => {
      expect(() => leerZip(romper(valido))).toThrow(ErrorFormato);
    });
  }
});

describe('RUTA_PAQUETE', () => {
  it('admite los nombres de la tabla', () => {
    for (const nombre of ['LEEME.txt', 'incidente.json', 'registros/000000.r', 'registros/999999.s', 'registros/cierre.r', 'registros/cierre.s',
      'cifrados/000001.bin', 'acuses/000000.json', 'acuses/cierre.json', 'eventos.txt', 'envolturas/contacto-1.json',
      'envolturas/recuperacion-1.json', 'envolturas/escucha-12.json']) {
      expect(RUTA_PAQUETE.test(nombre), nombre).toBe(true);
    }
  });

  it('rechaza todo lo demás', () => {
    for (const nombre of ['', '/LEEME.txt', '../LEEME.txt', 'registros/../incidente.json', 'claves-acuse.json', 'LEEME.TXT',
      'registros/1000000.r', 'registros/00001.r', 'registros/000001.bin', 'registros/000001.r/', 'cifrados/cierre.bin',
      'acuses/000001.JSON', 'envolturas/contacto-0.json', 'envolturas/contacto-01.json', 'envolturas/otro-1.json', 'registros\\000001.r']) {
      expect(RUTA_PAQUETE.test(nombre), nombre).toBe(false);
    }
  });
});

describe('LEEME.txt', () => {
  it('su SHA-256 es el que lleva el verificador', () => {
    expect(createHash('sha256').update(LEEME, 'utf8').digest('hex')).toBe(SHA256_LEEME);
  });

  it('manda a buscar el verificador al repositorio público, nunca al paquete', () => {
    expect(LEEME).toContain('Consigue el verificador en el repositorio público de Vigía. Nunca');
    expect(LEEME).toContain('docs/verificacion.md');
    expect(LEEME.endsWith('\n')).toBe(true);
    expect(LEEME).not.toContain(String.fromCharCode(0x2014));
  });
});

describe('crearPaquete', () => {
  it('ordena los archivos como la tabla, con los eventos por hora y las envolturas por rol', async () => {
    const alerta = await p.evento('alerta', T0 + 5 * MIN);
    const cancelacion = await p.evento('cancelacion', T0 + 6 * MIN);
    const k = (b: number) => new Uint8Array(80).fill(b);
    const zip = p.paquete(lista, {
      eventos: [cancelacion, alerta],
      envolturas: [{ rol: 'escucha', k: k(1) }, { rol: 'contacto', k: k(2) }, { rol: 'contacto', k: k(3) }],
    });
    const archivos = leerZip(zip);
    expect([...archivos.keys()]).toEqual([
      'LEEME.txt', 'incidente.json',
      'registros/000000.r', 'registros/000000.s', 'registros/000001.r', 'registros/000001.s', 'registros/000002.r', 'registros/000002.s',
      'registros/cierre.r', 'registros/cierre.s',
      'cifrados/000001.bin', 'cifrados/000002.bin',
      'acuses/000000.json', 'acuses/000001.json', 'acuses/000002.json', 'acuses/cierre.json',
      'eventos.txt',
      'envolturas/contacto-1.json', 'envolturas/contacto-2.json', 'envolturas/escucha-1.json',
    ]);
    expect(texto(archivos.get('LEEME.txt'))).toBe(LEEME);
    expect(texto(archivos.get('incidente.json'))).toBe(`{"incidente":"${INCIDENTE}","spki":"${b64u(p.dispositivo.spki)}","v":1}`);
    expect(texto(archivos.get('eventos.txt'))).toBe(`${texto(alerta)}\n${texto(cancelacion)}\n`);
    expect(texto(archivos.get('envolturas/contacto-2.json'))).toBe(`{"k":"${b64u(k(3))}","rol":"contacto"}`);
    expect(archivos.get('registros/cierre.s')).toEqual(lista[3].s);
  });

  it('rechaza un seq sin nombre posible, un seq repetido, una SPKI que no es P-256 y una envoltura que no mide 80 bytes', () => {
    const [apertura, uno] = lista;
    expect(() => p.paquete([apertura, { ...uno, seq: 1_000_000 }])).toThrow(ErrorFormato);
    expect(() => p.paquete([apertura, uno, uno])).toThrow(ErrorFormato);
    expect(() => crearPaquete({ incidente: INCIDENTE, spki: p.dispositivo.spki.subarray(1), registros: lista })).toThrow(ErrorFormato);
    expect(() => p.paquete(lista, { envolturas: [{ rol: 'escucha', k: new Uint8Array(79) }] })).toThrow(ErrorFormato);
  });
});
