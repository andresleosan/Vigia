import { test, expect } from '@playwright/test';
const URL = process.env.DEMO_URL || 'file:///work/vigia-demo-web/vigia-demo.html';

async function abrirEvidencia(page) {
  await page.goto(URL);
  await expect(page.getByRole('button', { name: 'Preparar sesión de prueba' })).toBeEnabled();
  await page.getByRole('button', { name: 'Preparar sesión de prueba' }).click();
  await expect(page.getByTestId('session-state')).toHaveText('3 fragmentos preparados');
  await page.getByRole('button', { name: 'Simular respaldo' }).click();
  await page.getByRole('button', { name: 'Mostrar aviso de prueba' }).click();
  await expect(page.getByRole('heading',{name:'Un aviso para saber por dónde empezar'})).toBeFocused();
  await page.getByRole('button', { name: 'Abrir evidencia de prueba' }).click();
  await expect(page.getByRole('heading',{name:'Evidencia de prueba',exact:true})).toBeFocused();
  await expect(page.getByTestId('verification-state')).toHaveText('Cadena íntegra');
}

test('recorrido: verifica el original y excluye el fragmento alterado', async ({page}) => {
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('blob:') && new globalThis.URL(r.url()).origin !== new globalThis.URL(URL).origin) requests.push(r.url()); });
  await abrirEvidencia(page);
  await expect(page.getByTestId('verified-count')).toHaveText('3 de 3');
  await expect(page.locator('audio')).toHaveCount(3);
  await page.getByRole('button', {name:'Alterar fragmento 2', exact:true}).click();
  await expect(page.getByTestId('verification-state')).toHaveText('Hay una alteración');
  await expect(page.getByTestId('verified-count')).toHaveText('2 de 3');
  await expect(page.getByTestId('fragment-2').locator('audio')).toHaveCount(0);
  await expect(page.getByTestId('fragment-2')).toContainText('Excluido');
  await expect(page.getByTestId('findings')).toContainText('no coincide con lo que firmó el teléfono');
  await page.getByRole('button', {name:'Quitar cierre', exact:true}).click();
  await expect(page.getByTestId('verification-state')).toHaveText('Falta el cierre');
  await expect(page.getByTestId('verified-count')).toHaveText('3 de 3');
  await expect(page.locator('audio')).toHaveCount(3);
  await expect(page.getByTestId('findings')).toContainText('dejó de enviar');
  await page.getByRole('button', {name:'Original', exact:true}).click();
  await expect(page.getByTestId('verification-state')).toHaveText('Cadena íntegra');
  await expect(page.getByTestId('findings')).toBeEmpty();
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});

test('reiniciar elimina contenido y permite una sesión nueva', async ({page}) => {
  await abrirEvidencia(page);
  const before=await page.getByTestId('device-fingerprint').textContent();
  await page.getByRole('button',{name:'Reiniciar demo'}).click();
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Preparar sesión de prueba'})).toBeEnabled();
  await page.getByRole('button',{name:'Preparar sesión de prueba'}).click();
  await expect(page.getByTestId('session-state')).toHaveText('3 fragmentos preparados');
  await page.getByRole('button',{name:'Simular respaldo'}).click();
  await page.getByRole('button',{name:'Mostrar aviso de prueba'}).click();
  await page.getByRole('button',{name:'Abrir evidencia de prueba'}).click();
  await expect(page.getByTestId('verification-state')).toHaveText('Cadena íntegra');
  expect(await page.getByTestId('device-fingerprint').textContent()).not.toBe(before);
});

test('320px, modo oscuro y zoom de texto sin scroll horizontal', async ({page}) => {
  await page.setViewportSize({width:320,height:740});
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  await abrirEvidencia(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('el tono verificado se decodifica y reproduce', async ({page}) => {
  await abrirEvidencia(page);
  const result=await page.locator('audio').first().evaluate(async audio=>{
    // El contenedor no tiene salida de audio: Firefox devuelve OnMediaSinkAudioError sin silenciar.
    // El producto conserva su volumen; aquí se comprueba decodificación, avance y finalización.
    audio.muted=true;
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Audio metadata timeout')),8000);
      audio.addEventListener('loadedmetadata',()=>{clearTimeout(timeout);resolve()},{once:true});
      audio.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('WAV decode failed'))},{once:true});
      audio.load();
    });
    // Se comprueba la reproducción completa del tono sintético.
    audio.playbackRate=4;
    const ended=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Audio playback timeout')),8000);
      audio.addEventListener('ended',()=>{clearTimeout(timeout);resolve()},{once:true});
      audio.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('Audio playback failed'))},{once:true});
    });
    await audio.play();
    await ended;
    const result={duration:audio.duration,time:audio.currentTime,ended:audio.ended,error:audio.error?.code??null};
    audio.pause();return result;
  });
  expect(result.duration).toBeGreaterThan(3.9);
  expect(result.duration).toBeLessThan(4.3);
  expect(result.time).toBeGreaterThan(0);
  expect(result.ended).toBe(true);
  expect(result.error).toBeNull();
});

test('un fallo de renderizado elimina audio y éxitos anteriores', async ({page}) => {
  await page.addInitScript(()=>{
    const original=URL.createObjectURL.bind(URL);let count=0;
    URL.createObjectURL=blob=>{if(++count===2)throw new Error('Injected render failure');return original(blob)};
  });
  await page.goto(URL);
  await page.getByRole('button',{name:'Preparar sesión de prueba'}).click();
  await expect(page.getByTestId('session-state')).toHaveText('3 fragmentos preparados');
  await page.getByRole('button',{name:'Simular respaldo'}).click();
  await page.getByRole('button',{name:'Mostrar aviso de prueba'}).click();
  await page.getByRole('button',{name:'Abrir evidencia de prueba'}).click();
  await expect(page.getByTestId('verification-state')).toHaveText('Comprobación no disponible');
  await expect(page.getByTestId('verified-count')).toHaveText('0 de 3');
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.locator('#report')).not.toHaveAttribute('data-state','integro');
});

test('hosting: rutas y CSP por hash sin relajar portada o iconos', async ({page,request})=>{
  test.skip(!URL.startsWith('http'),'Solo aplica a la publicación HTTP');
  const origin=new globalThis.URL(URL).origin;
  const root=await request.get(origin+'/');
  const originalCsp="default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  expect(root.headers()['content-security-policy']).toBe(originalCsp);
  expect(await root.text()).toContain('href="/demo/"');
  for(const path of ['/favicon.ico','/favicon.svg','/apple-touch-icon.png']){
    const icon=await request.get(origin+path);
    expect(icon.status()).toBe(200);expect(icon.headers()['content-type']).toMatch(/^image\//);
    expect(icon.headers()['content-security-policy']).toBe(originalCsp);
  }
  for(const path of ['/demo','/demo/','/demo/index.html']){
    const response=await request.get(origin+path);expect(response.status()).toBe(200);
    expect(await response.text()).toContain('id="evidence-title"');
    const csp=response.headers()['content-security-policy'];
    expect(csp).toContain("script-src 'sha256-");expect(csp).toContain("style-src 'sha256-");
    expect(csp).toContain("connect-src 'none'");expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');expect(csp).not.toContain(',');
    expect(response.headers()['x-frame-options']).toBe('DENY');
  }
  await page.goto(URL);
  const ran=await page.evaluate(()=>{
    window.unapprovedRan=false;
    const script=document.createElement('script');script.textContent='window.unapprovedRan=true';document.body.append(script);
    return window.unapprovedRan;
  });
  expect(ran).toBe(false);
});
