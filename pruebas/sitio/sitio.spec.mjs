// WEB-01: cabeceras, un solo origen y maquetación de la página de presentación.
import { test, expect } from '@playwright/test';

const BASE = process.env.SITIO ?? 'http://127.0.0.1:8788';

test('cabeceras y un solo origen', async ({ page }) => {
  const otros = [];
  page.on('request', (r) => { if (!r.url().startsWith(BASE)) otros.push(r.url()); });
  const respuesta = await page.goto(`${BASE}/`);
  const h = respuesta.headers();
  expect(h['content-security-policy']).toContain("default-src 'none'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
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
