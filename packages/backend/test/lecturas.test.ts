import { b64u, empaquetarSobre } from '@vigia/shared';
import { describe, expect, it } from 'vitest';
import { TIPO_SOBRE } from '../src/errores.ts';
import { enviar, peticion, revocar, T, telefonoConAlta } from './ayudas.ts';
import { abrir, leer, nuevaApertura } from './cadena.ts';

const ruta = (id: string, resto = '') => `/v1/incidents/${id}${resto}`;

async function todo(r: Response) {
  return { estado: r.status, cabeceras: [...r.headers], cuerpo: await r.text() };
}

describe('lecturas firmadas (sección 11, "Lecturas")', () => {
  it('GET de chunks/0: la apertura como sobre, con su acuse en X-Vigia-Acuse', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    const acuse = new Uint8Array(await (await abrir(a, inc)).arrayBuffer());
    const r = await leer(a, ruta(inc.id, '/chunks/0'));
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe(TIPO_SOBRE);
    expect(r.headers.get('X-Vigia-Acuse')).toBe(b64u(acuse));
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(empaquetarSobre({ r: inc.apertura.bytes, s: inc.apertura.s, cifrado: new Uint8Array(0) }));
  });

  it('GET del incidente: estado en JCV', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    await abrir(a, inc);
    const r = await leer(a, ruta(inc.id));
    expect([r.status, r.headers.get('Content-Type'), await r.text()]).toEqual([200, 'application/json', '{"cerrado":0,"ultimo_recibido":0,"v":1}']);
  });

  it('ajeno e inexistente: el mismo 404 byte a byte (R2-01, ERR-01)', async () => {
    const a = await telefonoConAlta();
    const b = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    await abrir(a, inc);
    const otro = 'n'.repeat(22);
    expect((await leer(a, ruta(inc.id, '/chunks/0'))).status).toBe(200); // el dueño sí lo lee
    for (const resto of ['', '/chunks/0']) {
      const ajeno = await todo(await leer(b, ruta(inc.id, resto)));
      expect(ajeno).toEqual(await todo(await leer(b, ruta(otro, resto))));
      expect([ajeno.estado, ajeno.cuerpo]).toEqual([404, '{"codigo":"no_existe"}']);
    }
    expect((await leer(a, ruta(inc.id, '/chunks/1'))).status).toBe(404); // seq sin registro
  });

  it.each(['007', '1000000', '-1', '1x'])('seq no canónico (%s): 400 formato', async (seq) => {
    const a = await telefonoConAlta();
    const r = await leer(a, ruta('n'.repeat(22), `/chunks/${seq}`));
    expect([r.status, await r.text()]).toEqual([400, '{"codigo":"formato"}']);
  });

  it('firmada con la clave del dispositivo, o por un teléfono revocado: 401 firma (decisiones 42, 49 y 60)', async () => {
    const a = await telefonoConAlta();
    const inc = await nuevaApertura(a);
    await abrir(a, inc);
    const conClaveDeFirma = await enviar(await peticion({ metodo: 'GET', ruta: ruta(inc.id, '/chunks/0'), firmante: { telefono: a, id: a.id, clave: 'dispositivo' } }));
    expect([conClaveDeFirma.status, await conClaveDeFirma.text()]).toEqual([401, '{"codigo":"firma"}']);
    await revocar(a.id, T + 1);
    const revocado = await leer(a, ruta(inc.id, '/chunks/0'), T + 2);
    expect([revocado.status, await revocado.text()]).toEqual([401, '{"codigo":"firma"}']);
  });
});
