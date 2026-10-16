# Demostración de evidencia

## Grabación web de prueba

`/demo/grabar/` es una prueba independiente: Grabar (permiso explícito), detener
manualmente o a los 15 segundos, escuchar y descartar. Usa `getUserMedia` y
`MediaRecorder` nativos. Conserva el MIME elegido por el navegador y reúne los
bloques como una única toma, sin fingir fragmentos ADTS. No aplica el verificador
criptográfico ni genera acuses para ese audio.

La aplicación mantiene el audio en memoria, con un tope adicional de 2 MiB.
No escribe audio ni claves a storage, caché, archivos o red; no ofrece descarga,
respaldo, alertas ni telemetría. Esto describe el código de la página, no promete
control forense sobre la memoria, archivos temporales o paginación del navegador.
Al descartar, cancelar, ocultar la página o salir se invalidan callbacks, se
detienen pistas y temporizadores, se vacían bloques y se revocan las URLs.
Un permiso resuelto tarde se cierra sin usarlo. No garantiza continuidad con
pantalla bloqueada o en segundo plano; una interrupción descarta la prueba.

La excepción `microphone=(self)` se limita a las tres rutas exactas del grabador;
el resto conserva `microphone=()`, cámara y ubicación bloqueadas. Se mantienen
`connect-src 'none'`, hashes CSP y medios `blob:`. El build emite también
`vigia-grabador.html` y `grabador-manifest.json`, para copiar a
`sitio/demo/grabar/index.html` y `demostracion/grabador-artifact.json`.

QA local aislada: `node_modules/.bin/playwright test --config grabador.config.mjs`.
En Chromium, el fixture sustituye la entrada por un oscilador conectado a
`MediaStreamDestination`, sin salida física. En Firefox se usa el dispositivo
sintético interno (`media.navigator.streams.fake`) de un perfil efímero de QA,
sin exponer hardware al contenedor. MediaRecorder y sus códecs son nativos.
El WebKit Linux de esta imagen no incluye MediaRecorder: solo se comprueban
degradación, contraste y cabeceras; no se afirma cobertura de captura en Safari.
Esto no equivale a validar hardware o teléfonos reales. La política HTTP se
comprueba aparte porque el fixture elude la petición nativa de permiso.

## Recorrido con datos sintéticos

Recorrido independiente de la página pública: sesión sintética, aviso simulado y verificación real de tres fragmentos. No cierra H0b, H2, H4 ni H5b.

- Reutiliza el fixture efímero de H1 y el verificador de packages/shared. El tono se genera con ffmpeg lavfi, sin voces ni micrófono.
- El contenido sintético es WAV para que la demostración se reproduzca en los tres navegadores. No es una captura del grabador Android, cuyo formato ADTS y pruebas siguen pendientes.
- Casos: original, byte alterado en el fragmento 2 y cierre ausente. Solo se ofrece el audio devuelto por el verificador.
- No usa red, cuentas, contactos, almacenamiento persistente, alertas ni temporizadores reales. No contiene consejo legal.
- Sigue los tokens de DESIGN: tinta/blanco, superficies planas, ámbar reservado al aviso, acciones táctiles y foco visible. Fuentes del sistema para evitar descargas.
- La captura y la entrega son simulaciones. Las claves efímeras se crean en memoria y no se exportan. Una prueba criptográfica no demuestra la veracidad del relato.

En el contenedor existente, tras sincronizar vigia:
`node demostracion/build.mjs /work/vigia-demo-web`

El resultado es un HTML autónomo que se puede abrir sin instalar nada ni conectar servicios. Pruebas Playwright desde esta carpeta con las dependencias ya fijadas de pruebas/sitio.

Para resolver esas dependencias en la copia aislada: crear el enlace local
`ln -s ../pruebas/sitio/node_modules demostracion/node_modules` después de sincronizar.
El HTML usa hashes CSP para su script y estilo, y bloquea conexiones externas.
La reproducción automatizada se ejecuta silenciada para no depender de una salida de audio en el contenedor.

## Sitio público

Pages conserva su salida estática `sitio/`. Tras el build, copiar `vigia-demo.html` a `sitio/demo/index.html` y el manifiesto a `demostracion/artifact.json`. No hay build remoto ni nuevas dependencias.

Las tres rutas exactas `/demo`, `/demo/` y `/demo/index.html` reemplazan la CSP general usando detach y set en el mismo bloque de `_headers`. Solo autorizan los hashes generados y medios blob; conexiones y marcos quedan bloqueados. El resto del sitio conserva su política original.

Para probar HTTP: `DEMO_URL=http://127.0.0.1:8788/demo/ node_modules/.bin/playwright test`, con Pages dev sirviendo `sitio/` en el entorno aislado. Revertir la publicación mediante un commit nuevo que quite la ruta, su enlace y sus excepciones; sin cambiar los hitos de producto.
