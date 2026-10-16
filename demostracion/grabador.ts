const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const start = byId<HTMLButtonElement>('record-start');
const stop = byId<HTMLButtonElement>('record-stop');
const play = byId<HTMLButtonElement>('record-play');
const discard = byId<HTMLButtonElement>('record-discard');
const audio = byId<HTMLAudioElement>('record-audio');
const state = byId<HTMLParagraphElement>('record-state');
const note = byId<HTMLParagraphElement>('record-note');
const error = byId<HTMLParagraphElement>('record-error');
const seconds = byId<HTMLOutputElement>('record-time');
const player = byId<HTMLDivElement>('record-player');
const LIMIT_MS = 15000;
const MAX_BYTES = 2 * 1024 * 1024;
type Phase = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error' | 'interrupted' | 'unavailable';
type Capture = {
  generation: number; stream: MediaStream; recorder: MediaRecorder; chunks: Blob[];
  bytes: number; started: number; timer?: number; tick?: number; limited: boolean;
};
let phase: Phase = 'idle';
let generation = 0;
let capture: Capture | null = null;
let audioUrl: string | null = null;
let format = '';

function render(next: Phase, message: string, detail: string) {
  phase = next; state.textContent = message; note.textContent = detail;
  start.hidden = !['idle','error','interrupted','unavailable'].includes(next);
  start.disabled = next === 'unavailable';
  stop.hidden = !['recording','stopping'].includes(next); stop.disabled = next === 'stopping';
  play.hidden = next !== 'ready';
  discard.hidden = !['requesting','recording','stopping','ready'].includes(next);
  discard.textContent = next === 'requesting' ? 'Cancelar solicitud' : 'Descartar grabación';
  player.hidden = next !== 'ready';
}
function clearTimers(s: Capture) {
  window.clearTimeout(s.timer); window.clearInterval(s.tick);
}
function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) { track.onended = null; track.stop(); }
}
function removeAudio() {
  audio.pause(); audio.removeAttribute('src'); audio.load();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
}
function clean() {
  generation++;
  const s = capture; capture = null;
  if (s) {
    clearTimers(s);
    s.recorder.ondataavailable = null; s.recorder.onstop = null; s.recorder.onerror = null;
    if (s.recorder.state !== 'inactive') { try { s.recorder.stop(); } catch { /* Ya terminó. */ } }
    stopTracks(s.stream); s.chunks = [];
  }
  removeAudio(); seconds.value = '00';
}
function fail(message: string, interrupted = false) {
  clean(); error.textContent = message; error.hidden = false;
  render(interrupted ? 'interrupted' : 'error', interrupted ? 'Grabación interrumpida' : 'No se pudo grabar', 'No queda una grabación disponible. Puedes volver a intentarlo.');
  if (document.visibilityState === 'visible') start.focus({preventScroll:true});
}
function interrupted() {
  if (!['requesting','recording','stopping','ready'].includes(phase)) return;
  clean(); error.hidden = true;
  render('interrupted','Grabación interrumpida','La prueba se descartó al salir de esta pantalla. Vuelve a pulsar Grabar para empezar otra.');
}
function finish(limited = false) {
  const s = capture;
  if (!s || phase !== 'recording') return;
  s.limited = limited; clearTimers(s);
  render('stopping','Preparando escucha','El micrófono se está cerrando.');
  try { s.recorder.stop(); stopTracks(s.stream); }
  catch { fail('El navegador no pudo terminar la toma. Intenta una grabación nueva.'); }
}
async function begin() {
  if (!['idle','error','interrupted'].includes(phase)) return;
  clean(); error.hidden = true;
  const attempt = generation;
  render('requesting','Esperando permiso','Autoriza el micrófono en el aviso del navegador. También puedes cancelar esta solicitud.');
  discard.focus({preventScroll:true});
  let stream: MediaStream | null = null;
  try {
    // Único punto que solicita hardware: siempre procede del botón Grabar.
    stream = await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    if (attempt !== generation || document.visibilityState !== 'visible') { stopTracks(stream); return; }
    const recorder = new MediaRecorder(stream,{mimeType:format,audioBitsPerSecond:32000});
    const s: Capture = {generation:attempt,stream,recorder,chunks:[],bytes:0,started:performance.now(),limited:false};
    capture = s;
    const current = () => capture === s && s.generation === generation;
    for (const track of stream.getTracks()) track.onended = () => { if (current()) fail('El micrófono se desconectó o dejó de estar disponible. La toma se descartó.',true); };
    recorder.onerror = () => { if (current()) fail('El navegador interrumpió la grabación. La toma se descartó.'); };
    recorder.ondataavailable = event => {
      if (!current() || !event.data.size) return;
      s.bytes += event.data.size;
      if (s.bytes > MAX_BYTES) { fail('La toma superó el tamaño permitido para esta prueba y se descartó.'); return; }
      s.chunks.push(event.data);
    };
    recorder.onstop = () => {
      if (!current()) return;
      clearTimers(s); stopTracks(s.stream);
      if (!s.bytes) { fail('El navegador no entregó audio. Comprueba el micrófono y vuelve a intentarlo.'); return; }
      try {
        // Los bloques son partes de UNA toma, no fragmentos reproducibles independientes.
        const blob = new Blob(s.chunks,{type:recorder.mimeType || s.chunks[0].type || format});
        audioUrl = URL.createObjectURL(blob); audio.src = audioUrl; audio.preload = 'metadata';
        s.chunks = []; capture = null;
        recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null;
        render('ready','Lista para escuchar',s.limited ? 'Se alcanzó el límite de 15 segundos. Escucha la toma o descártala.' : 'Micrófono cerrado. Escucha la toma o descártala para empezar otra.');
        play.focus({preventScroll:true});
      } catch { fail('No se pudo preparar la escucha. La toma se descartó.'); }
    };
    // timeslice permite vigilar el tamaño; no define duración ni cortes del producto.
    recorder.start(1000);
    render('recording','Grabando','Mantén esta pantalla abierta. Se detendrá a los 15 segundos.');
    stop.focus({preventScroll:true});
    s.tick = window.setInterval(() => {
      if (!current()) return;
      const elapsed = performance.now()-s.started;
      seconds.value = String(Math.min(15,Math.floor(elapsed/1000))).padStart(2,'0');
      if (elapsed >= LIMIT_MS) finish(true);
    },200);
    s.timer = window.setTimeout(() => { if (current()) { seconds.value='15'; finish(true); } },LIMIT_MS);
  } catch (e) {
    if (stream) stopTracks(stream);
    if (attempt !== generation) return;
    const name = e instanceof DOMException ? e.name : '';
    const message = name === 'NotAllowedError' || name === 'SecurityError'
      ? 'No se concedió permiso al micrófono. Puedes autorizarlo desde el navegador y volver a intentarlo.'
      : name === 'NotFoundError' ? 'No se encontró un micrófono disponible en este dispositivo.'
      : name === 'NotReadableError' ? 'No se pudo abrir el micrófono. Puede estar ocupado por otra aplicación.'
      : 'No se pudo iniciar la grabación en este navegador. Inténtalo de nuevo.';
    fail(message);
  }
}
start.addEventListener('click',()=>void begin());
stop.addEventListener('click',()=>finish());
discard.addEventListener('click',()=>{
  clean(); error.hidden=true;
  render('idle','Lista para grabar','El audio de la prueba se descartó. No se ha guardado ni enviado.');
  start.focus({preventScroll:true});
});
play.addEventListener('click',async()=>{
  if (phase !== 'ready' || !audioUrl) return;
  try { audio.currentTime=0; await audio.play(); }
  catch { if (phase==='ready') {error.hidden=false;error.textContent='No se pudo reproducir esta toma. Puedes descartarla y probar de nuevo.';} }
});
audio.addEventListener('error',()=>{
  if (phase==='ready' && audioUrl) fail('El navegador no pudo reproducir su grabación. La toma se descartó.');
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')interrupted()});
window.addEventListener('pagehide',interrupted);

if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
  render('unavailable','Grabación no disponible','Prueba con un navegador actualizado y una conexión HTTPS.');
  error.hidden=false;error.textContent='Este navegador no permite iniciar la grabación aquí.';
} else {
  const candidates=['audio/webm;codecs=opus','audio/mp4;codecs=mp4a.40.2','audio/ogg;codecs=opus','audio/webm','audio/mp4'];
  format=candidates.find(type=>MediaRecorder.isTypeSupported(type)) || '';
  if(!format){
    render('unavailable','Grabación no disponible','Prueba con otro navegador actualizado.');
    error.hidden=false;error.textContent='No hay un formato de audio compatible para esta prueba en este navegador.';
  }
}
