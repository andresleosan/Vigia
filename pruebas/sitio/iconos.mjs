// Genera los iconos de la página de presentación a partir de sus SVG, con el Chromium de la imagen de Playwright
// fijada (sin red). Escribe en $SALIDA: favicon.ico (PNG de 16 y 32 px dentro, para navegadores sin SVG) y
// apple-touch-icon.png (180 px, opaco). favicon.svg se sirve tal cual.
// Orden, desde la máquina de trabajo, con el repo sincronizado en /work/vigia de vigia-build (la misma imagen da los mismos
// bytes, los de .githooks/revisados.sha256):
//   docker run --rm --init --network none --cap-drop ALL --security-opt no-new-privileges --user 1001 \
//     -v vigia-trabajo:/work -w /work/vigia/pruebas/sitio -e SITIO=/work/vigia/sitio -e SALIDA=<carpeta de /work> \
//     mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 node iconos.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const sitio = process.env.SITIO ?? '../../sitio';
const salida = process.env.SALIDA ?? '.';
const uri = (ruta) => 'data:image/svg+xml;base64,' + readFileSync(ruta).toString('base64');

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
await pagina.setContent('<!doctype html><body>');
const png = (u, lado) => pagina.evaluate(async ({ u, lado }) => {
  const img = new Image(); img.src = u; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = lado;
  c.getContext('2d').drawImage(img, 0, 0, lado, lado);
  return c.toDataURL('image/png').split(',')[1];
}, { u, lado }).then((b64) => Buffer.from(b64, 'base64'));

const favicon = uri(join(sitio, 'favicon.svg'));
const imagenes = [[16, await png(favicon, 16)], [32, await png(favicon, 32)]];
const touch = await png(uri('fuentes/apple-touch-icon.svg'), 180);
await navegador.close();

// ICO con PNG dentro: cabecera de 6 bytes, una entrada de 16 bytes por imagen y los PNG seguidos.
const cabecera = Buffer.alloc(6);
cabecera.writeUInt16LE(0, 0); cabecera.writeUInt16LE(1, 2); cabecera.writeUInt16LE(imagenes.length, 4);
let desplazamiento = 6 + 16 * imagenes.length;
const entradas = imagenes.map(([lado, datos]) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(lado, 0); e.writeUInt8(lado, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(datos.length, 8); e.writeUInt32LE(desplazamiento, 12);
  desplazamiento += datos.length;
  return e;
});
writeFileSync(join(salida, 'favicon.ico'), Buffer.concat([cabecera, ...entradas, ...imagenes.map(([, d]) => d)]));
writeFileSync(join(salida, 'apple-touch-icon.png'), touch);
console.log(`favicon.ico (${desplazamiento} bytes) y apple-touch-icon.png (${touch.length} bytes)`);
