import { crearDemostracion, type Caso } from './motor.ts';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const mostrar = (id: string, visible: boolean) => { el(id).hidden = !visible; };
const texto = (id: string, value: string) => { el(id).textContent = value; };
let demo: Awaited<ReturnType<typeof crearDemostracion>> | null = null;
let epoch = 0;
let audioUrls: string[] = [];
let etapa = 1;
let ocupado = false;

function limpiarAudio() {
  for (const audio of document.querySelectorAll('audio')) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  for (const url of audioUrls) URL.revokeObjectURL(url);
  audioUrls = [];
  el('fragments').replaceChildren();
}
function cambiarEtapa(n: number) {
  etapa = n;
  for (const [i,id] of ['session','notice','evidence'].entries()) {
    mostrar(id, i + 1 === n);
    const step=el('step-'+(i+1));
    step.classList.toggle('completed', i+1<n);
    if (i+1===n) step.setAttribute('aria-current','step'); else step.removeAttribute('aria-current');
  }
  texto('wordmark', n === 3 ? 'Demostración de evidencia' : 'Vigía / Demostración');
  window.scrollTo({top:0,behavior:'instant'});
  el(['session-title','notice-title','evidence-title'][n-1]).focus({preventScroll:true});
}
function error(e: unknown) {
  console.error(e instanceof Error ? e.name : 'Error de demostración');
  texto('error', 'No se pudo ejecutar la comprobación. Reinicia la demo en un navegador actualizado. No se ha dado por válida ninguna evidencia.');
  mostrar('error', true);
}
function bloquearCasos(valor: boolean) {
  ocupado=valor;
  document.querySelectorAll<HTMLButtonElement>('[data-case]').forEach(b=>{b.disabled=valor});
}
function iconoResultado(estado: 'integro'|'incompleto'|'fallido') {
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','24');svg.setAttribute('height','24');
  svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');
  svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',estado==='integro'?'M4 12l5 5L20 5':estado==='fallido'?'M6 6l12 12M18 6L6 18':'M12 3l9 9-9 9-9-9zM12 8v5M12 16h.01');
  svg.append(path);el('result-icon').replaceChildren(svg);
}
async function comprobar(caso: Caso) {
  if (!demo || ocupado) return;
  const actual=++epoch;
  limpiarAudio();
  el('findings').replaceChildren();
  texto('engine-summary','');
  texto('verified-count','0 de 3');
  texto('verification-state','Comprobando…');
  texto('result-caption','Ejecutando el verificador existente.');
  texto('result-icon','');
  el('report').removeAttribute('data-state');
  mostrar('error',false);
  document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.case===caso)));
  bloquearCasos(true);
  try {
    const resultado=await demo.verificar(caso);
    if(actual!==epoch) return;
    const estados={
      integro:['Cadena íntegra','Los tres fragmentos y el cierre verifican.'],
      incompleto:['Falta el cierre','Los fragmentos verifican, pero el paquete no está completo.'],
      fallido:['Hay una alteración','El fragmento que no coincide se excluye de la escucha.'],
    };
    const [titulo,caption]=estados[resultado.estado];
    texto('verification-state',titulo);
    texto('result-caption',caption);
    iconoResultado(resultado.estado);
    el('report').dataset.state=resultado.estado;
    texto('verified-count',resultado.fragmentos+' de 3');
    texto('engine-summary',resultado.resumen);
    texto('fingerprint',demo.huella);
    for(const h of resultado.hallazgos) {
      const li=document.createElement('li');li.textContent=h.texto;el('findings').append(li);
    }
    for(let seq=1;seq<=3;seq++) {
      const bytes=resultado.audio.get(seq);
      const row=document.createElement('article');row.className='fragment';row.dataset.testid='fragment-'+seq;
      const top=document.createElement('div');top.className='fragment-top';
      const title=document.createElement('h3');title.textContent='Fragmento '+seq;
      const badge=document.createElement('span');badge.className='badge';badge.textContent=bytes?'Verificado':'Excluido';
      top.append(title,badge);row.append(top);
      const note=document.createElement('p');
      note.textContent=bytes?'Tono sintético · Aproximadamente 4 segundos':'Este contenido no se reproduce porque no supera la comprobación.';
      row.append(note);
      if(bytes) {
        const audio=document.createElement('audio');
        const url=URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>],{type:'audio/wav'}));audioUrls.push(url);
        audio.controls=true;audio.preload='none';audio.src=url;audio.volume=.35;
        audio.setAttribute('aria-label','Escuchar fragmento '+seq+' de prueba');
        audio.addEventListener('play',()=>document.querySelectorAll('audio').forEach(other=>{if(other!==audio) other.pause()}));
        audio.addEventListener('error',()=>{note.textContent='El fragmento verifica, pero el navegador no pudo reproducir el tono de prueba.'});
        row.append(audio);
      } else row.dataset.excluded='true';
      el('fragments').append(row);
    }
  } catch(e) {
    if(actual!==epoch) return;
    limpiarAudio();
    el('report').removeAttribute('data-state');
    el('findings').replaceChildren();
    texto('result-icon','');texto('verified-count','0 de 3');texto('engine-summary','');
    texto('verification-state','Comprobación no disponible');texto('result-caption','No hay un resultado de integridad.');error(e);
  } finally {if(actual===epoch) bloquearCasos(false)}
}
function reiniciar() {
  epoch++;demo=null;ocupado=false;limpiarAudio();bloquearCasos(false);
  cambiarEtapa(1);mostrar('error',false);
  texto('session-count','0');texto('session-state','Lista para preparar');
  texto('axis-session','Sin preparar');texto('axis-backup','No realizado');
  texto('fingerprint','');texto('engine-summary','');el('findings').replaceChildren();
  texto('verification-state','Comprobando…');texto('verified-count','0 de 3');
  el('technical').removeAttribute('open');
  mostrar('prepare',true);(el('prepare') as HTMLButtonElement).disabled=false;
  texto('prepare','Preparar sesión de prueba');
  for(const id of ['backup','backup-note','show-notice']) mostrar(id,false);
}
el('prepare').addEventListener('click',async()=>{
  const actual=++epoch;
  (el('prepare') as HTMLButtonElement).disabled=true;texto('prepare','Preparando…');mostrar('error',false);
  try {
    const nueva=await crearDemostracion();
    if(actual!==epoch) return;
    demo=nueva;texto('session-count','3');texto('session-state','3 fragmentos preparados');
    texto('axis-session','Cerrada · De prueba');mostrar('prepare',false);mostrar('backup',true);
  } catch(e) {if(actual===epoch){error(e);(el('prepare') as HTMLButtonElement).disabled=false;texto('prepare','Preparar sesión de prueba')}}
});
el('backup').addEventListener('click',()=>{
  texto('axis-backup','Simulado · 3 de 3');mostrar('backup-note',true);mostrar('backup',false);mostrar('show-notice',true);
});
el('show-notice').addEventListener('click',()=>cambiarEtapa(2));
el('open-evidence').addEventListener('click',()=>{cambiarEtapa(3);void comprobar('original')});
el('reset').addEventListener('click',reiniciar);
document.querySelectorAll<HTMLButtonElement>('[data-case]').forEach(b=>b.addEventListener('click',()=>void comprobar(b.dataset.case as Caso)));
window.addEventListener('pagehide',()=>{epoch++;demo=null;limpiarAudio()});
window.addEventListener('pageshow',event=>{if(event.persisted) reiniciar()});
if(!window.isSecureContext||!crypto?.subtle){(el('prepare') as HTMLButtonElement).disabled=true;texto('error','Este navegador no permite la criptografía local. Abre el archivo en un navegador actualizado o desde localhost.');mostrar('error',true)}
