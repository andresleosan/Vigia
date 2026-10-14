// WEB-01: cabeceras, un solo origen y maquetación de la página de presentación.
import { test, expect } from '@playwright/test';

const BASE = process.env.SITIO ?? 'http://127.0.0.1:8788';
// La política entera: una fuente de más (https:, data:) también es una regresión.
const CSP = "default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

test('cabeceras y un solo origen', async ({ page }) => {
  const otros = [];
  page.on('request', (r) => { if (!r.url().startsWith(BASE)) otros.push(r.url()); });
  const respuesta = await page.goto(`${BASE}/`);
  const h = respuesta.headers();
  expect(h['content-security-policy']).toBe(CSP);
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('no-referrer');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vigía');
  await expect(page.getByText('Prototipo en construcción. Todavía no lo uses para protegerte.')).toBeVisible();
  expect(otros).toEqual([]);
});

test('sin scroll horizontal a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${BASE}/`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('iconos: del mismo origen, con su tipo y sin violaciones de la CSP', async ({ page, request }) => {
  await page.addInitScript(() => {
    window.violaciones = [];
    document.addEventListener('securitypolicyviolation', (e) => window.violaciones.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto(`${BASE}/`);
  const enlaces = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((ls) =>
    ls.map((l) => [l.rel, l.getAttribute('href'), l.getAttribute('type'), l.getAttribute('sizes')]));
  expect(enlaces).toEqual([
    ['icon', '/favicon.ico', null, '32x32'],
    ['icon', '/favicon.svg', 'image/svg+xml', null],
    ['apple-touch-icon', '/apple-touch-icon.png', null, null],
  ]);
  const tipos = { '/favicon.ico': /^image\/(x-icon|vnd\.microsoft\.icon)/, '/favicon.svg': /^image\/svg\+xml/, '/apple-touch-icon.png': /^image\/png/ };
  for (const [ruta, tipo] of Object.entries(tipos)) {
    const r = await request.get(`${BASE}${ruta}`);
    expect(r.status(), ruta).toBe(200);
    expect(r.headers()['content-type'], ruta).toMatch(tipo);
    expect(r.headers()['x-content-type-options'], ruta).toBe('nosniff');
    expect(r.headers()['content-security-policy'], ruta).toBe(CSP); // la que impide que el SVG ejecute nada si se abre solo
  }
  const svg = await (await request.get(`${BASE}/favicon.svg`)).text();
  expect(svg.length).toBeLessThan(1024);
  // Lista blanca: solo la placa, el filete y la V, sin atributos que carguen o ejecuten nada.
  const ajeno = await page.evaluate((texto) => {
    const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return ['no es un SVG válido'];
    const elementos = new Set(['svg', 'rect', 'path']);
    const atributos = new Set(['xmlns', 'viewBox', 'x', 'y', 'width', 'height', 'rx', 'fill', 'stroke', 'd']);
    const fuera = [];
    for (const el of doc.querySelectorAll('*')) {
      if (!elementos.has(el.localName)) fuera.push(`<${el.localName}>`);
      for (const a of el.attributes) if (!atributos.has(a.name)) fuera.push(`${el.localName}@${a.name}`);
    }
    return fuera;
  }, svg);
  expect(ajeno).toEqual([]);
  const ancho = await page.evaluate(async () => {
    const i = new Image();
    i.src = '/favicon.svg';
    await i.decode();
    return i.naturalWidth;
  });
  expect(ancho).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.violaciones)).toEqual([]);
});
