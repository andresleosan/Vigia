// Ejecutar únicamente en vigia-build: node demostracion/build.mjs /work/vigia-demo-web
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const dir=dirname(fileURLToPath(import.meta.url));
const out=resolve(process.argv[2]||'/work/vigia-demo-web');
if(!out.startsWith('/work/')) throw new Error('La salida debe estar dentro del entorno aislado');
mkdirSync(out,{recursive:true});
const tono=join(out,'tono.wav');
// Fuente sintética lavfi; ningún micrófono, archivo personal ni descarga.
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:sample_rate=16000:duration=4','-af','volume=0.12','-ac','1','-c:a','pcm_s16le','-f','wav',tono]);
const require=createRequire(resolve(dir,'../pruebas/sitio/package.json'));
const {build}=require('esbuild');
const compiled=await build({entryPoints:[join(dir,'app.ts')],bundle:true,write:false,platform:'browser',format:'iife',target:['es2022'],minify:true,legalComments:'none',define:{__TONO_BASE64__:JSON.stringify(readFileSync(tono).toString('base64'))}});
const js=compiled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const css=readFileSync(join(dir,'styles.css'),'utf8');
const hash=x=>createHash('sha256').update(x).digest('base64');
const csp="default-src 'none'; script-src 'sha256-"+hash(js)+"'; style-src 'sha256-"+hash(css)+"'; img-src data:; media-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'";
const template=readFileSync(join(dir,'index.template.html'),'utf8');
const html=template.replace('__CSP__',()=>csp).replace('<!-- STYLE -->',()=>'<style>'+css+'</style>').replace('<!-- SCRIPT -->',()=>'<script>'+js+'</script>');
writeFileSync(join(out,'vigia-demo.html'),html);
const manifest={artifact:'sitio/demo/index.html',bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),csp:csp+"; frame-ancestors 'none'"};
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({...manifest,output:join(out,'vigia-demo.html'),toneBytes:readFileSync(tono).length}));
