import { test, expect } from '@playwright/test';
const origin='http://127.0.0.1:8788';
const address=origin+'/demo/grabar/';

// Solo cambia la entrada: MediaRecorder y el códec del navegador son reales.
// No se conecta el oscilador a la salida ni se solicita hardware.
async function fuente(page, mode='ok') {
  const nativeFake=page.context().browser().browserType().name()==='firefox';
  await page.addInitScript(({mode,nativeFake})=>{
    window.probe={calls:0,tracks:[],created:[],revoked:[],types:[]};
    const create=URL.createObjectURL.bind(URL), revoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=blob=>{
      if(mode==='render-error') throw new Error('Synthetic URL failure');
      const url=create(blob);window.probe.created.push({url,type:blob.type,bytes:blob.size});return url;
    };
    URL.revokeObjectURL=url=>{window.probe.revoked.push(url);revoke(url)};
    const nativeGet=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const stream=async()=>{
      let result,closeSource=()=>{};
      if(nativeFake) {
        // El perfil de grabador.config.mjs fuerza streams.fake; el contenedor no expone hardware.
        result=await nativeGet({audio:true,video:false});
      } else {
        const ctx=new AudioContext(), oscillator=ctx.createOscillator(), dest=ctx.createMediaStreamDestination();
        oscillator.frequency.value=440;oscillator.connect(dest);oscillator.start();await ctx.resume();
        result=dest.stream;closeSource=()=>{oscillator.stop();void ctx.close()};
      }
      for(const track of result.getTracks()) {
        window.probe.tracks.push(track);
        const stop=track.stop.bind(track);
        track.stop=()=>{if(track.readyState==='ended') return;stop();closeSource()};
      }
      return result;
    };
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
      window.probe.calls++;
      if(mode==='denied') throw new DOMException('Synthetic denial','NotAllowedError');
      if(mode==='pending') return new Promise(resolve=>{window.finishPermission=()=>resolve(stream())});
      const result=await stream();
      if(mode==='track-ended') window.endSyntheticTrack=()=>result.getTracks()[0].dispatchEvent(new Event('ended'));
      return result;
    }});
    if(mode==='unsupported') Object.defineProperty(window,'MediaRecorder',{value:undefined});
    if(mode==='codec-error') MediaRecorder.isTypeSupported=()=>false;
    const NativeRecorder=window.MediaRecorder;
    if(NativeRecorder) window.MediaRecorder=class extends NativeRecorder {
      constructor(...args){super(...args);window.testRecorder=this;this.addEventListener('dataavailable',e=>{if(e.data.size)window.probe.types.push(e.data.type)});}
    };
  },{mode,nativeFake});
}
test.beforeEach(async({page,browserName},info)=>{
  if(browserName==='webkit' && !(await page.evaluate(()=>typeof MediaRecorder!=='undefined'))) {
    const fallback=/^(sin API|HTTP|texto, acciones)/.test(info.title);
    test.skip(!fallback,'Este WebKit Linux no incluye MediaRecorder: solo se comprueba degradación, contraste y política HTTP.');
  }
});
const status=page=>page.getByRole('status');
const start=page=>page.getByRole('button',{name:'Grabar hasta 15 segundos',exact:true});
const stop=page=>page.getByRole('button',{name:'Detener grabación',exact:true});
const discard=page=>page.getByRole('button',{name:'Descartar grabación',exact:true});
async function abrir(page,mode='ok') {
  await fuente(page,mode);await page.goto(address);
  await expect(page.getByRole('heading',{name:'Prueba tu micrófono',exact:true})).toBeVisible();
}
async function iniciar(page) {await start(page).click();await expect(status(page)).toHaveText('Grabando');}
async function capturar(page) {
  await iniciar(page);await page.waitForTimeout(600);await stop(page).click();
  await expect(status(page)).toHaveText('Lista para escuchar');
}
async function todasCerradas(page) {
  expect(await page.evaluate(()=>window.probe.tracks.every(t=>t.readyState==='ended'))).toBe(true);
}

test('captura explícita, MIME real, escucha, descarte y ausencia de subida o persistencia',async({page})=>{
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  await abrir(page);
  expect(await page.evaluate(()=>window.probe.calls)).toBe(0);
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push({method:r.method(),url:r.url()})});
  await start(page).focus();await page.keyboard.press('Enter');
  await expect(status(page)).toHaveText('Grabando');await expect(stop(page)).toBeFocused();
  await page.waitForTimeout(800);await stop(page).click();
  await expect(status(page)).toHaveText('Lista para escuchar');await todasCerradas(page);
  await expect(page.getByRole('button',{name:'Escuchar grabación',exact:true})).toBeFocused();
  await page.locator('audio').evaluate(a=>{a.muted=true;a.playbackRate=4});
  await page.getByRole('button',{name:'Escuchar grabación',exact:true}).click();
  await expect.poll(()=>page.locator('audio').evaluate(a=>a.ended),{timeout:7000}).toBe(true);
  const blob=await page.evaluate(()=>window.probe.created[0]);
  expect(blob.bytes).toBeGreaterThan(0);expect(blob.type).toMatch(/^audio\//);
  expect(blob.type).toBe(await page.evaluate(()=>window.probe.types[0]));
  await discard(page).click();await expect(status(page)).toHaveText('Lista para grabar');
  await expect(page.locator('audio')).not.toHaveAttribute('src');
  await expect(start(page)).toBeFocused();
  expect(await page.evaluate(()=>window.probe.revoked)).toContain(blob.url);
  expect(requests).toEqual([]);expect(errors).toEqual([]);
  expect(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,dbs:(await indexedDB.databases()).length,caches:(await caches.keys()).length,workers:(await navigator.serviceWorker.getRegistrations()).length}))).toEqual({local:0,session:0,dbs:0,caches:0,workers:0});
});
test('se detiene automáticamente a los 15 segundos y cierra pistas',async({page})=>{
  await abrir(page);await iniciar(page);
  const began=await page.evaluate(()=>performance.now());
  await expect(status(page)).toHaveText('Lista para escuchar',{timeout:18000});
  const elapsed=await page.evaluate(()=>performance.now())-began;
  expect(elapsed).toBeGreaterThan(14000);expect(elapsed).toBeLessThan(18000);
  await expect(page.locator('#record-note')).toContainText('límite de 15 segundos');
  await todasCerradas(page);
  const duration=await page.locator('audio').evaluate(async a=>{
    a.muted=true;a.load();if(a.readyState<1) await new Promise((resolve,reject)=>{a.onloadedmetadata=resolve;a.onerror=reject});
    return a.duration;
  });
  // Algunos contenedores WebM no publican duración finita hasta reproducirse.
  if(Number.isFinite(duration)) {expect(duration).toBeGreaterThan(14);expect(duration).toBeLessThan(17);}
});
test('denegar permiso muestra error y permite volver a intentar',async({page})=>{
  await abrir(page,'denied');await start(page).click();
  await expect(page.getByRole('alert')).toContainText('permiso');
  await expect(start(page)).toBeEnabled();expect(await page.evaluate(()=>window.probe.created.length)).toBe(0);
});
test('cancelar permiso pendiente cierra cualquier pista que llegue tarde',async({page})=>{
  await abrir(page,'pending');await start(page).click();await expect(status(page)).toHaveText('Esperando permiso');
  await page.getByRole('button',{name:'Cancelar solicitud',exact:true}).click();await page.evaluate(()=>window.finishPermission());
  await expect.poll(()=>page.evaluate(()=>window.probe.tracks.length)).toBe(1);
  await todasCerradas(page);await expect(status(page)).toHaveText('Lista para grabar');
  expect(await page.evaluate(()=>window.probe.created.length)).toBe(0);
});
test('al ocultar la página descarta la captura y no finge éxito',async({page})=>{
  await abrir(page);await iniciar(page);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))});
  await todasCerradas(page);await expect(status(page)).toHaveText('Grabación interrumpida');
  await expect(page.locator('audio')).not.toHaveAttribute('src');
});
test('al salir revoca audio terminado y también cierra la captura activa',async({page})=>{
  await abrir(page);await capturar(page);
  const url=await page.locator('audio').getAttribute('src');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(()=>window.probe.revoked)).toContain(url);
  await todasCerradas(page);await expect(page.locator('audio')).not.toHaveAttribute('src');
  await iniciar(page);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await todasCerradas(page);await expect(status(page)).toHaveText('Grabación interrumpida');
});
test('texto, acciones y foco mantienen contraste en claro y oscuro',async({page})=>{
  await abrir(page);
  for(const colorScheme of ['light','dark']) {
    await page.emulateMedia({colorScheme});
    const ratios=await page.evaluate(()=>{
      const rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number);
      const lum=c=>rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
      const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
      return ['h1','.lead','#record-note','#record-start'].map(selector=>{
        const el=document.querySelector(selector),s=getComputedStyle(el);let p=el,bg=s.backgroundColor;
        while(bg==='rgba(0, 0, 0, 0)'&&p.parentElement){p=p.parentElement;bg=getComputedStyle(p).backgroundColor}
        return {selector,ratio:ratio(s.color,bg)};
      });
    });
    for(const item of ratios) expect(item.ratio,item.selector+' '+colorScheme).toBeGreaterThanOrEqual(4.5);
  }
});
test('desconexión de la fuente y fallo de URL limpian audio sin éxito falso',async({page})=>{
  await abrir(page,'track-ended');await iniciar(page);await page.evaluate(()=>window.endSyntheticTrack());
  await expect(status(page)).toHaveText('Grabación interrumpida');await todasCerradas(page);
  await expect(page.getByRole('alert')).toBeVisible();
});
test('un fallo al preparar reproducción libera las pistas y muestra error',async({page})=>{
  await abrir(page,'render-error');await iniciar(page);await page.waitForTimeout(200);await stop(page).click();
  await expect(page.getByRole('alert')).toBeVisible();await todasCerradas(page);
  await expect(page.locator('audio')).not.toHaveAttribute('src');await expect(start(page)).toBeEnabled();
});
test('sin API o códec disponible informa sin pedir micrófono',async({page})=>{
  await abrir(page,'unsupported');await expect(start(page)).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('navegador');
  expect(await page.evaluate(()=>window.probe.calls)).toBe(0);
});
test('sin formato compatible informa antes de pedir micrófono',async({page})=>{
  await abrir(page,'codec-error');await expect(start(page)).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('formato');
  expect(await page.evaluate(()=>window.probe.calls)).toBe(0);
});
test('320px oscuro, texto 200%, teclado y foco visible',async({page})=>{
  await page.setViewportSize({width:320,height:740});await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  await abrir(page);await page.evaluate(()=>{document.documentElement.style.fontSize='200%'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await start(page).focus();await page.keyboard.press('Enter');await expect(stop(page)).toBeFocused();
  const focus=await stop(page).evaluate(b=>getComputedStyle(b).outlineStyle);expect(focus).not.toBe('none');
  // Una pulsación inmediata puede producir cero muestras: damos tiempo al codificador.
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');await expect(status(page)).toHaveText('Lista para escuchar');
  await page.keyboard.press('Tab');await expect(discard(page)).toBeFocused();await page.keyboard.press('Enter');
  await expect(start(page)).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('error del recorder y exceso de bytes descartan sin dejar pistas o reproductor',async({page})=>{
  await abrir(page);await iniciar(page);
  await page.evaluate(()=>window.testRecorder.dispatchEvent(new Event('error')));
  await expect(page.getByRole('alert')).toContainText('interrumpió');await todasCerradas(page);
  await iniciar(page);
  await page.evaluate(()=>window.testRecorder.dispatchEvent(new BlobEvent('dataavailable',{data:new Blob([new Uint8Array(2*1024*1024+1)],{type:'audio/webm'})})));
  await expect(page.getByRole('alert')).toContainText('tamaño');await todasCerradas(page);
  await expect(page.locator('audio')).not.toHaveAttribute('src');
});
test('ocultar durante permiso pendiente invalida el resultado tardío',async({page})=>{
  await abrir(page,'pending');await start(page).click();
  await expect(status(page)).toHaveText('Esperando permiso');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.finishPermission()});
  await expect.poll(()=>page.evaluate(()=>window.probe.tracks.length)).toBe(1);
  await todasCerradas(page);await expect(status(page)).toHaveText('Grabación interrumpida');
  expect(await page.evaluate(()=>window.probe.created.length)).toBe(0);
});
test('doble parada y callbacks viejos no contaminan una toma nueva',async({page})=>{
  await abrir(page);await iniciar(page);await page.waitForTimeout(500);
  await page.evaluate(()=>{window.oldData=window.testRecorder.ondataavailable;window.oldStop=window.testRecorder.onstop});
  await stop(page).evaluate(b=>{b.click();b.click()});await expect(status(page)).toHaveText('Lista para escuchar');
  await discard(page).click();await iniciar(page);
  await page.evaluate(()=>{window.oldData(new BlobEvent('dataavailable',{data:new Blob(['old'])}));window.oldStop()});
  await expect(status(page)).toHaveText('Grabando');
  expect(await page.evaluate(()=>window.probe.created.length)).toBe(1);
  await discard(page).click();await todasCerradas(page);
});
test('capturas para revisión visual',async({page,browserName})=>{
  test.skip(!process.env.RECORDER_CAPTURE_DIR || browserName!=='chromium','Capturas solo cuando se solicitan');
  const dir=process.env.RECORDER_CAPTURE_DIR;
  await page.setViewportSize({width:1280,height:980});await abrir(page);
  await page.screenshot({path:dir+'/desktop-lista.png',fullPage:true});
  await iniciar(page);await page.waitForTimeout(1200);
  await page.screenshot({path:dir+'/desktop-grabando.png',fullPage:true});
  await stop(page).click();await expect(status(page)).toHaveText('Lista para escuchar');
  await page.screenshot({path:dir+'/desktop-escuchar.png',fullPage:true});
  await page.setViewportSize({width:320,height:740});await page.emulateMedia({colorScheme:'dark'});
  await page.screenshot({path:dir+'/mobile320-escuchar.png',fullPage:true});
  await discard(page).click();await todasCerradas(page);
});
test('HTTP permite micrófono solo en grabador y conserva CSP y demás permisos',async({request})=>{
  for(const path of ['/','/demo/','/favicon.svg','/demo/otra-ruta/']){
    const response=await request.get(origin+path);
    expect(response.headers()['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  }
  for(const path of ['/demo/grabar','/demo/grabar/','/demo/grabar/index.html']) {
    const response=await request.get(origin+path);expect(response.status()).toBe(200);
    expect(response.headers()['permissions-policy']).toBe('camera=(), microphone=(self), geolocation=()');
    const csp=response.headers()['content-security-policy'];
    expect(csp).toContain("connect-src 'none'");expect(csp).toContain("script-src 'sha256-");
    expect(csp).toContain("media-src blob:");expect(csp).not.toContain('unsafe-inline');
    expect(response.headers()['x-frame-options']).toBe('DENY');
  }
});
