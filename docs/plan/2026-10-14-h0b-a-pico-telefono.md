# H0b, tramo A: pico en el teléfono, sin Cloudflare. Plan de implementación

> **Para agentes:** sub-skill obligatoria: superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans, tarea a tarea. Los pasos usan casillas (`- [ ]`). Solo `main` en el repo de Vigía; el banco es un repo local aparte, sin remoto, donde también se hacen commits. Un solo agente escribe y hace commits a la vez, siempre con `git add <rutas>`.

**Objetivo:** medir en el teléfono de pruebas (Xiaomi/Redmi, Android 11 a 13) y en la máquina de build lo que H0b puede medir sin Cloudflare (P1 en el teléfono, P2, P3, P4 sin subida, P5 en el teléfono, P6 en navegadores reales, P7 en la máquina y la parte de P8 que sale de OONI), dejar cada respuesta en `docs/pico/informe.md` y DESIGN.md, y cerrar con la etiqueta `f2-h0b-a` para que H2 pueda empezar.

**Arquitectura:**
- El código del pico vive en el banco (`<banco>`, repo local sin remoto). Una sola app Expo con cuatro módulos Kotlin (`BancoInfo`, `BancoP2`, `BancoP3`, `BancoP5`), en release no depurable, que guarda cada resultado en logcat y en un archivo JSONL de su carpeta externa. Un proyecto Gradle JVM (`<banco>/jvm`) con el cortador ADTS incremental y las piezas puras de P2 y P5 (probadas con TDD y compiladas también dentro del APK), un teléfono simulado para probar las herramientas de análisis y el arnés de P7.
- El banco reutiliza H1 sin copiar fuentes a mano: `nucleo.jar` construido desde la etiqueta `f2-h1` y una copia de `packages/shared/src` de esa etiqueta, generadas en cada build e ignoradas por git.
- Claude no toca el teléfono. La persona responsable ejecuta bloques de PowerShell en su portátil Windows, saca los archivos con `adb pull` y los sube por code-server a la carpeta de intercambio; Claude los analiza en contenedores efímeros sin red y solo saca cifras.
- El audio en claro nunca toca el disco del teléfono: se cifra en RAM y se envuelve `K` para la clave de escucha de pruebas, cuya privada vive solo en la carpeta privada del proyecto (`<privada>/escucha/privada.b64u`, 600) y entra por la entrada estándar del contenedor que descifra: nunca se lee, se copia ni se imprime.
- P7 corre en la red interna `vigia-p7` (sin salida a internet) con netem en un contenedor auxiliar de un solo uso (excepción acotada a OPS-03, aprobada el 14-oct-2026).

**Stack** (lo de H0a y H1, más lo nuevo, todo con versión exacta y publicado hace 7 días o más el 14-oct-2026): Expo 57.0.26, React Native 0.86.3, op-sqlite 18.2.5 (sqlcipher y fts5), Kotlin 2.1.20, AGP 8.12.0 (el de RN 0.86.3), Gradle 9.3.1, JDK 17.0.20.1, Node 24.21.0, BouncyCastle bcprov-jdk18on 1.86, @hpke/core 1.9.0, ffmpeg 6.1.1, adb r37.0.1 (también en Windows). Nuevo en este tramo: `iproute2` 6.1.0-1ubuntu6.4 en la imagen `vigia-build:h0b` (tarea 2), `@noble/hashes`, `@noble/curves` y `@noble/ciphers` 2.4.0 en el banco (tarea 9), Tink 1.23.0 solo para medir su peso (tarea 9) y la imagen oficial de PowerShell 7.5 fijada por digest, solo para validar `servidor.ps1` en la máquina (tarea 10). Cada tarea da su versión y su suma.

**Spec:** `docs/plan/2026-10-12-plan-maestro-f2.md` (H0b, "Pico técnico" y requisitos de seguridad), `DESIGN.md`, `docs/pico/informe.md` y las decisiones de la persona responsable del 13 y 14-oct-2026 (abajo), que mandan sobre el plan maestro donde lo cambian (la tarea 1 las lleva a los documentos).

## Decisiones del 13 y 14-oct-2026 (persona responsable)

1. Teléfono de pruebas: Xiaomi/Redmi con Android 11 a 13. Portátil Windows: los guiones son bloques de PowerShell para pegar.
2. Sin llave física todavía: nada se despliega en Cloudflare hasta tenerla. H0b va en tramos: A (este plan, sin Cloudflare), B (con la llave y el token: endurecimiento de la cuenta, hosts neutros, P9, P4 con subida, P7 en el teléfono y P6 en un host real) y C (P8 con la persona en VE, que llega más adelante).
3. Cierre en dos etiquetas: `f2-h0b-a` al cerrar A, y H2 puede empezar con ella (H2 no usa Cloudflare); `f2-h0b` al cerrar B, con P8 en marcha o con Telegram declarado como canal principal. H3a sigue dependiendo de H0b entero.
4. Hosts neutros: cada host público es un proyecto de Pages con nombre neutro que reenvía por service binding a Workers sin URL pública (`workers_dev: false`), donde viven el cron, los límites, D1 y R2. No se cambia el subdominio de workers.dev de la cuenta. Se valida en P9 (tramo B). Va a DESIGN.md como decisión 74 (la 73 es la marca, del 14-oct).
5. P7: netem en un contenedor auxiliar de un solo uso con `NET_ADMIN`, en la red interna `vigia-p7`; el Worker escucha en esa red y no en 127.0.0.1. Es una excepción a OPS-03 limitada a una red interna sin salida a internet y sin puertos publicados.
6. Cuentas del teléfono: el teléfono de pruebas lleva cuentas reales (riesgo aceptado; el detalle está en el archivo privado) y, con la depuración USB activada, no sirve para protegerse. El banco no lee ninguna cuenta ni ningún identificador del aparato (ni número de serie ni IMEI).

## Reglas de decisión del tramo A (se aprueban con este plan)

La tarea 16 las aplica tal cual a las cifras; lo que no cubren se decide con la persona responsable. `D` es la duración del fragmento: 4 s mientras P7 en el teléfono no diga otra cosa. Las reglas que dependen de `D` (la cola, TEE o StrongBox, la firma del PUT y el verificador) valen para fragmentos de 4 s; si el tramo B fija otra duración, se recalculan con las mismas medidas (10 % de `D`, sobres de 32 kbit/s × `D` y 1 800 / `D` fragmentos).

| Pregunta (plan maestro) | Regla | Se mide en | Si no se cumple |
|---|---|---|---|
| Formato de audio (decisiones 20 y 29) | AAC-LC, 16 kHz, mono, si la grabación de 30 min pasa todos sus criterios: formato, muestras frente al tiempo, clics, arranques, verificación y carpeta | Tarea 14 (`sesion-2-p3.json` y `sesion-2-codificadores.json`) | Según el criterio que falle. Si falla `formato`, plan B de P3 (otra tasa u otro codificador), que antes de repetir la sesión 2 necesita una tarea nueva con sus pruebas (la tasa como parámetro del grabador, de la pantalla y del análisis). Si fallan de verdad `muestras_frente_al_tiempo` o `clics`, o un arranque pasa de 2 s, se declaran con sus cifras y se decide con la persona responsable. `carpeta` y `verificacion` son fallos del banco: se arreglan y se repite. Con la fuente `MIC`; si los clics llegan atenuados, el ensayo se repite con `VOICE_RECOGNITION` y la fuente usada va al informe |
| Dónde guarda la cola los sobres (Bases locales) | Archivos cifrados: con el Keystore por sobre si su p95 de escribir un sobre de 16 KiB es como mucho el 10 % de `D` (400 ms); si no, con una clave de datos que el Keystore envuelve una vez. La cola es de Kotlin (decisión 53), así que `vault.db` (op-sqlite, JS) no la guarda | Tarea 13 (`sesion-1-p2.txt`) | Si una cola no lee sus 450 sobres iguales, es un fallo del banco: se arregla y se repite |
| Librería HPKE en el teléfono | BouncyCastle (la del núcleo de H1) si el sellado del teléfono se abre en la máquina, sin R8 y con R8. Tink no se probó en el teléfono: solo entra si BouncyCastle falla, con una sesión más | Tarea 13 (`sesion-1-p5-sellado.txt` y `sesion-1-r8-p5-sellado.txt`); pesos en la tarea 9 | Plan B del plan maestro: HPKE propio en modo base sobre primitivas probadas, con los mismos vectores |
| Dónde verifica la app | La variante más ligera que pase los 72 vectores y verifique los 450 fragmentos con `K` en menos de 5 s, en este orden: JS con noble (sin código nativo nuevo); `verificarPaquete` de shared con las primitivas de Kotlin ("un único código" de verificación, en TS) | Tarea 13 (`sesion-1-p5-tiempos.txt`) | Si ninguna baja de 5 s, se declara la cifra y se decide con la persona responsable. La cota en Kotlin puro (sin cadena, cierre ni marcas) es solo una cota inferior: si solo ella baja de 5 s, se declara así y también se decide con la persona responsable |
| TEE o StrongBox | StrongBox si el teléfono lo tiene y 2 × p95 de su firma es como mucho el 10 % de `D`; si no, TEE ("StrongBox no disponible" se anota) | Tarea 13 (`sesion-1-p5-tiempos.txt`) | Si la llave sale `software`, se declara: el teléfono no sirve como referencia de gama baja con TEE |
| ¿El PUT de un fragmento lleva firma de petición? | Sí, si con la llave elegida 2 × p95 de una firma (la del registro y la de la petición) es como mucho el 10 % de `D` | Tarea 13 (`sesion-1-p5-tiempos.txt`) | No: le basta `s`, que ya autentica el contenido ante la clave del dueño, y el PUT es idempotente (plan B de P5) |
| Respaldo X25519 de la bóveda | Ya lo decide H4 en el plan maestro: la bóveda guarda la clave no extraíble donde el navegador tenga X25519 en WebCrypto y, donde no, usa el respaldo con `@noble/curves`, declarado. P6 dice qué navegadores medidos lo tienen hoy, con su motor y su versión mayor. Samsung Internet se instala desde Google Play y se mide en la versión del día, no en la que tendría un contacto sin actualizar; el motor a partir del cual hay X25519 sale de la documentación, no de la sesión. Safari iOS queda sin medir | Tarea 15, P6 (`sesion-3-p6.md`) | Con el respaldo, la clave del contacto es extraíble en esos navegadores: se declara |
| P4 sin subida: qué pide la guía por fabricante | Si el servicio aguanta 30 min con Doze forzado y MIUI como viene (sin huecos de latido de más de 65 s y cierre entero), la guía no pide nada; si solo aguanta con la configuración B, H3a pide los dos ajustes de B («Sin restricciones» e «Inicio automático», con los nombres que se anotaron). Las dos salidas son provisionales hasta P4 con subida (tramo B), que se mide sin el cable | Tarea 15, P4 (`sesion-3-p4-a.json` y `-b.json`) | Si muere en las dos, se declara y P4 con subida (tramo B) lo confirma antes de H3a |
| Duración del fragmento (provisional) | La más corta de 2, 4 y 8 s con la que, en el arnés de P7 (una tanda de 30 min por duración, con netem pesimista: 300 ± 100 ms y 3 % de pérdida en cada sentido), la cola del minuto 30 no supera a la del minuto 1 y el retraso es de 2 fragmentos o menos el 95 % del tiempo. "La cola del minuto" es lo que no llega a vaciarse en ese minuto, y el retraso se integra en el tiempo. Si 2 s cumple por menos de 3 puntos, se anota como justa y P7 en el teléfono prueba 2 y 4 s | Tarea 11 (`p7.txt` y `p7-calibracion.txt`) | Plan B de P7: 8 s con 2 subidas en vuelo, sin acuses fuera de orden; si aun así crece, se declara el límite. El valor es provisional hasta P7 en el teléfono (tramo B): la máquina no incluye la latencia del servidor de producción ni la firma en el Keystore de cada intento, y las dos favorecen a las duraciones cortas |

P8 no decide nada en este tramo: la tabla de OONI (tarea 12) va al informe y el canal principal en VE espera al tramo C.

## Decisiones de integración (Claude, 14-oct-2026)

Dudas de quienes escribieron las tareas que se resuelven con el criterio por defecto. La persona responsable puede cambiar cualquiera al revisar el plan; las tres últimas (21 a 23) son suyas y se le preguntan antes de empezar.

1. Las sesiones miden siempre el APK del último commit del banco (tarea 13, paso 1). Si el banco cambia entre sesiones, se recompila y la persona responsable reinstala (tarea 13, pasos 14, 15 y 53).
2. Los tamaños de APK y los recuentos de pruebas que da cada tarea se midieron sobre el andamio con solo esa tarea (o las de su mismo bloque). En la ejecución real cambian un poco: cuenta `salida: 0`, las fichas y que no falle ninguna prueba.
3. La sesión 3 son dos partes independientes (P4 y P6) que numeran sus pasos desde 1, en el orden que prefiera la persona responsable. Al acabar las dos, su cierre desinstala el banco del teléfono y apaga los ajustes de desarrollador.
4. Navegadores en P6: se miden como vienen y solo se actualizan los que fallan, guardando las dos medidas. Samsung Internet no viene en un Xiaomi: se instala desde Google Play (o se actualiza, si ya estaba) y se mide en su versión del día; al acabar se ofrece desinstalarlo. Mi Browser se mide si viene instalado. Cambiar cómo abre Telegram los enlaces es un paso opcional con ⚠️, que se deshace al acabar de medir (P6, pasos 22 a 25): si la persona responsable prefiere no tocarlo, el navegador interno queda "sin medir". Al acabar se borra el mensaje del enlace en Mensajes guardados.
5. La imagen de PowerShell (510 MB) se queda hasta cerrar H0b. La consulta de OONI la repite Claude al empezar los tramos B y C. `mtalk.google.com` no se añade: OONI no lo mide y daría 0; el informe lo declara como hueco.
6. Si `adb pull` de la carpeta del banco no funciona en la sesión 1, la copia de la grabación a `Download/` se añade entonces, antes de la sesión 2, como tarea nueva con su prueba (tarea 13, paso A7); no se escribe por adelantado.
7. La comprobación con R8 va en la sesión 1 (dos instalaciones más, con el APK de la ABI del teléfono), y la pantalla queda encendida durante P2 y P5 y durante los 20 arranques de P3 (se deshace al acabar).
8. La pista de clics dura 45 min, para que ninguna grabación acabe después de la pista, y va en WAV (86 MB, la abre el reproductor de Windows). Si los clics llegan atenuados con `MIC`, se repite el ensayo con `VOICE_RECOGNITION` (la pantalla de P3 lo permite) y las grabaciones siguientes usan la fuente del último ensayo bueno.
9. Pasar el APK a `proguard-android-optimize.txt` (BouncyCastle pasaría de unos 411 KB de dex a unos 54 KB) es una decisión de H2: el informe lo anota en "Para H2".
10. P7: la cola de un minuto es lo que no llega a vaciarse en él (con la foto al acabar el minuto, una cola estable de 2 s suspendía por azar); la foto queda en el CSV y en el análisis. La pérdida es del 3 % en cada sentido, la lectura pesimista del plan maestro, y el informe lo declara. Se hace una tanda de 30 min por duración, como dice el plan maestro.
11. Plan B de P7: un acuse que llega antes que el de un fragmento anterior cuenta como fuera de orden y el plan B exige 0. Si el plan B fallara solo por eso, se decide con la persona responsable si "romper el orden" incluye ese caso (la cadena de `prev` no se rompe).
12. El clasificador de respuestas y el adaptador HTTP del arnés se quedan en el banco como referencia para H3a, con lo aprendido: el cliente debe repetir la petición si el servidor ya cerró la conexión. El banco (el repo local) no se borra al cerrar H0b; la app se desinstala del teléfono al acabar la sesión 3, y el tramo B instala su propio APK.
13. La tarea 2 hace un commit en `main` que completa `packages/nucleo/gradle/verification-metadata.xml` con 4 sumas: sin ellas, el núcleo de `f2-h1` no compila con la caché de Gradle vacía (H1 se validó siempre con la caché llena). Se prefiere a copiar la caché vieja al contenedor nuevo, que escondería el defecto.
14. `<intercambio>` es una carpeta en 700 dentro de otra ya excluida de todo proceso automático de memoria, resumen o indexado (ENV-01), fuera de los repos y de la carpeta privada; code-server la ve. La ruta real va en `h0b-entorno.md`, y la tarea 16 comprueba que nada suyo ha entrado en esos procesos.
15. La imagen `vigia-build:h0a` y el contenedor viejo (renombrado y parado por la tarea 2) se conservan hasta cerrar H0b, para poder volver atrás.
16. La instantánea de apt de H0a no incluye `noble-security` (por ejemplo, `libx11-6` se queda sin su corrección): es un riesgo del entorno heredado, que el informe anota en "Para H2" para que la imagen de producto lo decida.
17. `app/package.json` del banco conserva dos `~` heredados de la plantilla de H0a (`@types/react` y `typescript`), fijados por el lockfile: el banco es desechable y regenerar el lockfile no aporta nada al pico. La regla de versiones exactas vale para todo lo nuevo.
18. La clave de escucha vive en `<privada>/escucha/` (700; la privada en 600) y no en `<intercambio>`: así no queda junto a lo que se navega en code-server en cada sesión. Solo se redirige a la entrada estándar de contenedores sin red.
19. Todo contenedor que recibe la privada o descifra audio lleva `--log-driver none` (el daemon no guarda su salida en disco) y `--memory 2g --memory-swap 2g` (sin memoria de intercambio, para que ni la privada ni el audio acaben en el disco), y monta el volumen de trabajo en solo lectura.
20. Los temporales del teléfono (capturas, volcados del registro, versiones, `exit-info`) se escriben en `/data/local/tmp/`, que es del usuario de adb y queda fuera del almacenamiento compartido (lo indexa MediaStore y lo pueden copiar las copias en la nube), y se borran al traerlos.
21. Decidida el 14 de octubre de 2026 (se acepta el riesgo para el tramo A): el 700 de `<intercambio>` y el 600 de la privada solo frenan a usuarios sin privilegios; lo que corre como root en la máquina puede leerlos. O se acepta el riesgo por escrito (la clave solo abre audio de prueba) o se reduce ese acceso mientras dure F2. Se acepta para el tramo A, porque la clave de escucha solo abre audio de prueba; el acceso de root a la máquina es un tema más amplio que Vigía y se revisa antes de que haya datos reales. La carpeta de salidas no cambia de dueño. La tarea 3 anota la decisión, con su fecha, en `h0b-entorno.md`.
22. Decidida el 14 de octubre de 2026 (se desactiva): al instalar el banco, el análisis de apps del teléfono (el de Google Play y el del instalador de MIUI) puede enviar el APK a Google y a Xiaomi, ligado a las cuentas del teléfono, en cada instalación del banco (también si se reinstala). Se desactiva antes de instalar: la persona responsable hace el paso 14 de la tarea 13, y el paso 53 lo vuelve a encender.
23. Comprobada el 14 de octubre de 2026, antes del primer commit de este plan: la lista privada de patrones de los hooks tiene que tener las huellas de los nombres de quienes participan también sueltos (cada nombre y cada apellido), para que los hooks paren un nombre suelto. Se añaden con `python3 -I .githooks/comprobar.py huellas-desde <archivo>` desde un archivo temporal en `/dev/shm`, sin escribir los nombres en la línea de órdenes, y el archivo se borra con `shred` al terminar. La lista ya tenía la huella del nombre suelto: el hook pre-commit rechaza un archivo de prueba que lo contiene. Si falta algún apellido suelto, la persona responsable lo añade por el mismo método.

## Foco de la revisión

Lo que ninguna prueba de la máquina puede ejercitar y que más fácilmente fallará con el teléfono y el portátil reales:

1. **MIUI no deja hacer algo** (sacar `Android/data` con `adb pull`, «Instalar vía USB», `svc power stayon`, Doze profundo): cada caso tiene su salida en los pasos, y el paso A7 de la tarea 13 decide antes de la sesión 2.
2. **Windows PowerShell 5.1 del portátil** (Defender o SmartScreen con `servidor.ps1`, `adb reverse` contra el 127.0.0.1 IPv4, la redirección `>` que escribe UTF-16, las comillas dobles dentro de una orden remota): ningún bloque redirige la salida de adb ni lleva comillas dobles dentro, y el servidor tiene plan B (pwsh o el host del tramo B).
3. **El códec del teléfono** (un AudioSpecificConfig que no sea `1408`, la cola que se pierde al vaciar, la supresión de ruido que apaga los clics): lo detecta el ensayo de 1 min de la tarea 14 antes de gastar 30 min.
4. **El tiempo de Hermes con noble** (minutos con BigInt y AES en JS interpretado): por eso la pantalla encendida, el aviso de 10 min y las otras dos variantes del verificador.
5. **La composición de las tareas** (cada bloque se validó solo sobre el andamio): la revisión del plan aplicó dos veces seguidas las tareas 5 a 12 sobre una copia del andamio; la segunda, con todos los arreglos, compuso, cuadró los recuentos de pruebas y de commit y compiló el APK desde un clon limpio. Y la tarea 13 compila el APK final desde un clon limpio.

## Cómo se ejecuta (ENV-01)

- `<repo>` es la ruta del repo de Vigía; `<banco>`, la del banco; `<intercambio>`, la carpeta de intercambio con el portátil; `<privada>`, la carpeta privada del proyecto (fuera de los repos), con la clave de escucha y los archivos privados `h0a-entorno.md` y `h0b-entorno.md` (que crea la tarea 3), donde están las rutas reales.
- Todo el código de terceros (npm, Gradle, Expo, el SDK de Android, wrangler, ffmpeg, @noble) corre en `vigia-build` o en contenedores efímeros hechos con su imagen. En la máquina de trabajo solo corren git, la biblioteca estándar de Python (`python3 -I`) y `docker`.
- Dentro del contenedor, el repo está en `/fuente/vigia` y el banco en `/fuente/banco`, de solo lectura; se trabaja en copias (`sincronizar vigia`, `sincronizar banco`) y en `/work/h0b/`. Lo que el contenedor genera y debe entrar al banco o al repo se trae archivo a archivo:

  ```sh
  docker cp -L vigia-build:<ruta> <destino> && test -f <destino> && ! test -L <destino>
  ```

- Nada que maneje un secreto (la privada de escucha) corre en `vigia-build`: un proceso del mismo usuario puede leer el entorno de otro. Corre en un contenedor efímero `--network none` con la imagen de `vigia-build`, y el secreto entra por la entrada estándar.
- Antes de cada commit se mira `git diff --cached`. En el repo de Vigía corren los hooks (raya larga, correos, teléfonos, lista privada y gitleaks).

## Restricciones globales

- ENV-01, DAT-01, CFG-01 y OPS-03 (con la excepción de la decisión 5) como en el plan maestro.
- Versiones exactas (sin `^` ni `~`) y publicadas hace 7 días o más; los lockfiles nuevos se generan en el contenedor con `npm install --before 2026-10-07` y se traen con `docker cp -L`.
- DAT-01: grabaciones sin voces de terceros (sala sin conversaciones; la única fuente de sonido es la pista de clics; una grabación con indicios de voces se borra del teléfono, del portátil y de `<intercambio>` y se repite); el audio en claro solo existe en la RAM del teléfono y en el tmpfs del contenedor que lo analiza; cada informe anota qué audio se subió; la clave de escucha de pruebas se destruye al cerrar F2; el banco se desinstala del teléfono al acabar la sesión 3 (el tramo B instala su propio APK).
- Nada del banco entra al repo de Vigía. Al repo solo llegan `docs/pico/informe.md` (sin números de serie, rutas, hosts, horas ni descripción del audio), los cambios a DESIGN.md y al plan maestro, este plan y los arreglos del entorno de las tareas 1 y 2 (`.gitignore`, `entorno/Dockerfile` y `packages/nucleo/gradle/verification-metadata.xml`). Este plan se publica como `docs/plan/2026-10-14-h0b-a-pico-telefono.md`. Ni el plan ni el informe nombran a quienes participan, y lo que sale del teléfono a terceros durante las sesiones (el enlace de P6 en Telegram, el historial de Chrome, lo que manda Mi Browser, el análisis de apps al instalar) se declara en su tarea.
- El banco no lee identificadores del aparato ni de cuentas, y los guiones nunca guardan la salida de `adb devices` (lleva el número de serie).
- Textos en español, sin la raya larga (U+2014; en código, con el escape `\u2014` si hace falta nombrarla).
- Tiempos medidos solo en el APK release no depurable, el mismo que se instala.
- Commits pequeños. En el repo de Vigía, con el trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`; en el banco, con su identidad local (`banco`).

## Contrato del banco (lo que comparten las tareas)

### Archivos

| Ruta en `<banco>` | Qué es | Tarea dueña |
|---|---|---|
| `compilar.sh` | Build del APK (sin R8 y con R8), fichas y salida en `/work/h0b/salida/apk/` | 4 |
| `.gitignore` | Añade `build/`, `/app/vigia-shared/`, las libs generadas, `Escucha.kt` y las salidas de P6 | 4 |
| `app/App.tsx` | Menú con una sección por prueba; importa `app/pruebas/*.tsx` | 4 |
| `app/package.json` y `app/package-lock.json` | Dependencias de la app; la tarea 9 añade `@noble/*` 2.4.0 | 4 (los scripts) y 9 |
| `app/pruebas/Info.tsx`, `comun.ts` | Pantalla de información y utilidades comunes | 4 |
| `app/pruebas/P2.tsx`, `p2.ts` | P2 | 8 |
| `app/pruebas/P3.tsx` | P3 y P4 sin subida (la misma pantalla) | 6 |
| `app/pruebas/P5.tsx`, `p5-verificador.ts`, `cripto-noble.ts`, `cripto-kotlin.ts` | P5 | 9 |
| `app/modules/banco/index.ts` | Tipos y `requireNativeModule` de los cuatro módulos, con todas las firmas desde el principio | 4 |
| `app/modules/banco/expo-module.config.json` | Los cuatro módulos: `BancoInfoModule`, `BancoP2Module`, `BancoP3Module`, `BancoP5Module` | 4 |
| `app/modules/banco/android/build.gradle` | Dependencias de archivo (`nucleo.jar`, `bcprov`), fuentes de `jvm/puro` | 4 |
| `app/modules/banco/android/src/main/AndroidManifest.xml` | Permisos, `<queries>` de los navegadores y Telegram, y el servicio en primer plano | 4 |
| `.../java/expo/modules/banco/Resultados.kt`, `Llaves.kt`, `BancoInfoModule.kt` | Comunes | 4 |
| `.../BancoP2Module.kt` | P2 | 8 |
| `.../BancoP3Module.kt`, `Grabador.kt`, `ServicioGrabacion.kt` | P3 y P4 sin subida | 6 |
| `.../BancoP5Module.kt` | P5 | 9 |
| `.../Escucha.kt` | Generado por `compilar.sh` desde `/work/h0b/escucha/publica.b64u` | 4 |
| `jvm/` (`settings.gradle.kts`, wrapper 9.3.1, `build.gradle.kts`, `verification-metadata.xml`) | Proyecto JVM con `puro`, `simulado` y `arnes`; ninguna tarea posterior añade dependencias | 4 |
| `jvm/puro/` | `vigia.banco.puro.CortadorAdts` (5); `vigia.banco.Estadistica` y `vigia.banco.p2.ColaArchivos` (8); `vigia.banco.p5.Primitivas` y `CosteVerificador` (9). Todo entra también al APK | 5, 8 y 9 |
| `jvm/simulado/` | Teléfono simulado que escribe la misma carpeta de grabación que el teléfono | 7 |
| `jvm/arnes/` | Arnés de P7: la `Cola` del núcleo de H1 con un adaptador HTTP, el clasificador de respuestas, la medida por minuto y las piezas del contrato (sustituye el `Main.kt` mínimo) | 11 |
| `p2/maquina/` | Resumen de P2 y su prueba con `node:sqlite` | 8 |
| `p3/maquina/` | Pista de clics, paquete con acuses de dev, verificación y análisis de P3 y P4 | 7 |
| `p5/maquina/` | Firmas del Keystore, sellado, tiempos, paquete de 450 sobres, vectores de `cripto-noble` y pesos con R8 | 9 |
| `p6/` | Página de primitivas ampliada, `servidor.ps1`, sus pruebas y `analizar.py` | 10 |
| `p7/` | `p7.sh` (montar, netem, calibrar, tandas, plan B, análisis y limpieza, en la máquina de trabajo), `worker.sh`, `calibrar.py` y `analizar.py` con su prueba | 11 |
| `p8/ooni.py` | Consulta de OONI y su prueba | 12 |

Cada tarea solo cambia sus archivos. Los puntos de registro comunes (lista de módulos, menú de `App.tsx`, `settings.gradle.kts`, las firmas de `index.ts`) los deja la tarea 4 completos desde el principio, con implementaciones mínimas que cada tarea sustituye.

### Módulos Kotlin (paquete `expo.modules.banco`)

Todas las funciones asíncronas devuelven una cadena JSON y guardan el mismo JSON con `Resultados.guardar`.

- `BancoInfo`: `AsyncFunction("info")` (fabricante, modelo, versión de Android y SDK, ABIs, RAM total, StrongBox, versiones de WebView, Chrome, Samsung Browser, Mi Browser y Telegram si están instalados, commit del banco y si el modo avión está activo); `Function("guardar") { prueba: String, json: String -> }` para los resultados que mide JS.
- `BancoP2`: `AsyncFunction("claveVault")` → `"x'<64 hex>'"` (32 bytes aleatorios envueltos con una clave AES-GCM del Keystore, alias `banco-vault`); `AsyncFunction("cabecera") { ruta: String -> }` → hex de los 16 primeros bytes; `AsyncFunction("colaArchivos")` → tiempos de 450 sobres de 16 KiB como archivos cifrados (Keystore directo y clave de datos envuelta).
- `BancoP3`: `AsyncFunction("codificadores")`; `AsyncFunction("iniciar") { fuente: String, segundosFragmento: Int, latidos: Boolean -> }`; `AsyncFunction("estado")`; `AsyncFunction("detener")`; `AsyncFunction("arranques") { n: Int -> }`. Alias del Keystore `banco-p3` (un par nuevo en cada grabación).
- `BancoP5`: `AsyncFunction("llaves")` (alias `banco-p5-tee` y `banco-p5-strongbox`); `AsyncFunction("sellado")`; `AsyncFunction("costeKotlin") { conK: Boolean -> }`; `AsyncFunction("leerAsset") { nombre: String -> }` → `Uint8Array`; y, síncronas, las primitivas del `Cripto` en Kotlin: `sha256`, `hmacSha256`, `hkdfSha256`, `verificarP256` y `descifrarAesGcm`.

Comunes de la tarea 4:
- `Resultados.guardar(contexto: Context, prueba: String, json: String)`: añade `{"prueba":…,"hora":<ms>,"datos":<json>}` en una línea a `getExternalFilesDir(null)/resultados.jsonl` y escribe en logcat (`Log.i("BANCO", …)`) la línea, recortada a 2 900 caracteres.
- `Llaves`: `firmanteKeystore(alias: String, strongBox: Boolean): FirmanteKeystore` (par EC P-256 generado dentro del Keystore, `SHA256withECDSA`, firma DER convertida a P1363 con `Der.aP1363`; guarda también la última DER) que implementa `vigia.nucleo.Firmante`; `envolver(alias, datos)` y `desenvolver(alias, envuelto)` con AES-256-GCM del Keystore (IV generado por el Keystore). Nunca `setUserAuthenticationRequired` ni `setUnlockedDeviceRequired` (se graba con la pantalla bloqueada; la segunda falla en Android 12 a 14).

### Carpeta de grabación en el teléfono (P3 y P4)

`getExternalFilesDir(null)/p3/<incidente>/`, es decir `/sdcard/Android/data/dev.banco.prueba/files/p3/<incidente>/`:
- `incidente.txt`; `spki.der` (91 bytes, la pública del Keystore que firma); `escucha.env` (80 bytes: `K` envuelta con HPKE para la clave de escucha, rol `escucha`);
- `000000.sobre` (apertura), `NNNNNN.sobre` (fragmentos) y `cierre.sobre`, cada uno con los bytes de `Sobre.cuerpo()` (el cuerpo del PUT);
- `tiempos.jsonl` (muestras leídas, `elapsedRealtimeNanos` al volver la lectura y, si hay, `AudioTimestamp` en base BOOTTIME), `eventos.jsonl` (códec y formato, arranque, silenciado, `ERROR_DEAD_OBJECT`, parada), `latidos.jsonl` (P4: uno por minuto) y `resumen.json`.

El teléfono simulado de la tarea 7 escribe exactamente esta carpeta, y las herramientas de la máquina solo leen esta carpeta.

### Protocolo de resultados

La persona responsable saca `/sdcard/Android/data/dev.banco.prueba/files/` con `adb pull` y lo sube a `<intercambio>/telefono/sesion-<n>/`. La sesión 1 comprueba que ese `adb pull` funciona nada más sacar la ficha del aparato (tarea 13, paso 20). Si MIUI no lo deja, el plan B de esa sesión es el registro del banco: se amplía el búfer de logcat, se vuelca con `adb shell logcat -d -v raw -s BANCO:I -f /data/local/tmp/banco-<parte>.txt` después de P2 y de P5, se trae con `adb pull` y se borra del teléfono. Para las grabaciones de P3 y P4, que son binarias, haría falta además que el banco las copie fuera de `Android/data` (tarea 13, paso A7).

### Herramientas de la máquina

- Corren en contenedores efímeros: `docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g vigia-build:h0b …`, con el volumen de trabajo y la carpeta de la sesión en solo lectura (`-v <intercambio>/telefono/sesion-<n>:/sesion:ro`). Los que reciben la privada de escucha (por la entrada estándar: `< <privada>/escucha/privada.b64u`) o descifran audio llevan además `--log-driver none --memory 2g --memory-swap 2g`.
- Lo que sube la persona responsable solo se abre al contenedor (uid 1001) si son archivos y carpetas normales: `test "$(find <carpeta> ! -type f ! -type d | wc -l)" -eq 0 && chmod -R a+rX <carpeta>`. `<intercambio>` sigue en 700.
- El audio descifrado solo existe en el `/tmp` (tmpfs) de ese contenedor y desaparece con él. Las herramientas imprimen cifras y veredictos, nunca audio, claves ni `K`.
- Las herramientas de Node importan `packages/shared/src` de `/work/f2-h1` (copia de la etiqueta `f2-h1` con sus dependencias instaladas, tarea 4) y ejecutan TypeScript directamente con Node 24.

### Convenciones de PowerShell (el portátil)

- Bloques para pegar, nunca archivos `.ps1` (evita ExecutionPolicy y la marca de la web), salvo `servidor.ps1` de P6 (tarea 10), que se lanza con `powershell.exe -NoProfile -ExecutionPolicy Bypass -File`: Bypass vale solo para ese proceso y no cambia la configuración de Windows. Cada bloque empieza por:

  ```powershell
  $h0b = Join-Path $HOME 'vigia-h0b'
  $env:Path = "$h0b\platform-tools;$env:Path"
  Set-Location $h0b
  ```

- adb r37.0.1 para Windows, comprobado con `Get-FileHash` (SHA-256 `45F4D63113E895EBDE0C90F194099A4676B6AC653BD28D54314A9E022BBC1A99`). Nunca 36.0.0 ni 36.0.1.
- Nunca redirigir con `>` la salida de `adb` (PowerShell 5.1 escribe UTF-16 y rompe los binarios): lo que haya que guardar se escribe en el teléfono, en `/data/local/tmp/`, se trae con `adb pull` y se borra.
- Las órdenes remotas con caracteres especiales van entre comillas simples: `adb shell 'cmd connectivity airplane-mode'`. Dentro no llevan comillas dobles (PowerShell 5.1 no las escapa al llamar a adb): si el teléfono necesita comillas, van simples dentro de una cadena con comillas dobles, sin `$` ni acento grave: `adb shell "logcat -d | grep -E 'uno|otro'"`.
- adb deja en el portátil un servicio suyo que escucha en 127.0.0.1:5037, solo para el propio portátil. El último bloque con adb de cada sesión (y de cada parte de la sesión 3) lo para con `adb kill-server`; el siguiente bloque con adb lo vuelve a arrancar solo.
- Cada bloque dice en qué terminal se pega, qué hace cada línea, qué debe salir y qué hacer si sale otra cosa; lo que reinicia o borra lleva ⚠️ antes.
- Subidas y bajadas por el explorador de code-server (clic derecho, Download o Upload, o arrastrar). Los archivos de prueba no se abren en el editor de code-server, que guarda historial local de lo que se edita.

### Cómo se validó este plan

Cada bloque de tareas se materializó en una copia del banco dentro de `vigia-build` (`/work/h0b-plan/`), se compiló y se probó allí con TDD (las pruebas vistas en rojo antes del código), y los bloques de código de cada tarea se generaron desde esos archivos validados. Las órdenes de cada tarea se ejecutaron con las rutas cambiadas a la copia; las salidas citadas como "Esperado" son las de esas ejecuciones. Lo que solo puede pasar en el teléfono o en el portátil está sin ejecutar y lo dice cada tarea. Después, una revisión adversarial (cuatro revisores, uno más para la tarea 11, y un escéptico por revisor) confirmó 59 hallazgos, que se arreglaron con TDD donde tocaban código; un segundo ensayo de las tareas 5 a 12 y tres verificadores comprobaron los arreglos.

## Tareas

1. Decisiones del 13 y 14-oct en los documentos y correcciones previas (repo de Vigía).
2. Entorno de build para H0b: `iproute2`, `--init` y cachés en `/work`; H1 sigue en verde en el contenedor nuevo.
3. Clave de escucha de pruebas, carpeta de intercambio y archivo privado `h0b-entorno.md`.
4. Andamio del banco para H0b: núcleo y shared de `f2-h1`, `compilar.sh` con R8 y fichas, módulos comunes y menú; el APK compila desde un clon limpio.
5. Cortador ADTS incremental (TDD en la JVM).
6. P3 y P4 sin subida: grabador, servicio en primer plano y latidos.
7. Herramientas de la máquina para P3 y P4, probadas con el teléfono simulado.
8. P2: FTS5, `vault.db` con SQLCipher y dónde guarda la cola los sobres.
9. P5: Keystore, sellado HPKE, verificador en el teléfono (tres variantes), pesos con R8 (BouncyCastle y Tink) y sus herramientas de la máquina.
10. P6: página de primitivas ampliada y servidor local en PowerShell.
11. P7 en la máquina: arnés con la cola real y netem en `vigia-p7`.
12. P8 sin la persona: consulta de OONI.
13. Sesión 1 con el teléfono: adb en Windows, instalación, P1, ficha del aparato, P2 y P5.
14. Sesión 2: P3 (30 min con clics y 20 arranques).
15. Sesión 3: P4 sin subida (MIUI por defecto y sin restricciones), P6 y cierre de las sesiones (desinstalar el banco).
16. Informe del tramo A, cambios a DESIGN.md, revisión final y parada para `f2-h0b-a`.

Las tareas 1 a 12 son de Claude en la máquina; de la 13 a la 15, la persona responsable hace los pasos con el teléfono y Claude prepara y analiza; la 16 es de Claude y termina con la aprobación de la persona responsable.

---

---

### Tarea 1: Decisiones del 13 y 14-oct en los documentos y correcciones previas

**Archivos:**
- Modificar: `DESIGN.md` (decisiones 18, 44 y 55, nueva decisión 74, diagrama de `packages/backend`, flujo E.1 y un límite declarado)
- Modificar: `docs/plan/2026-10-12-plan-maestro-f2.md` (estado, tabla de hitos, H0b, P4, P8, P9, OPS-03, "Al cerrar H0b", la fila del teléfono y una sección nueva, "Decisiones de H0b")
- Modificar: `.gitignore` (añade `.claude/`, el estado local de Claude Code)

**Interfaces:**
- Consume: las decisiones del 13 y 14-oct-2026 de la cabecera de este plan.
- Produce: la decisión 74 de DESIGN.md (hosts neutros), que citan las tareas del tramo B; la dependencia de H2 de `f2-h0b-a`; el prefijo `i/` de P9; `deviceidle unforce` en P4; las protecciones de P8 que faltaban; la excepción de OPS-03 para P7.

Solo se cambia lo que hoy es incorrecto o lo que decidió la persona responsable. Los demás textos del plan maestro que suponen hosts en workers.dev (H3a, H8b, riesgos y requisitos) los ajusta el cierre del tramo B, cuando P9 haya validado la decisión 4; la sección nueva "Decisiones de H0b" deja dicho que manda sobre ellos.

- [ ] **Paso 1: escribir el script de sustituciones**

📍 Máquina de trabajo, desde `<repo>`. Cada texto viejo debe aparecer exactamente una vez; si no, el script para sin escribir nada.

Ejecutar:

```sh
cat > /tmp/decisiones_h0b.py <<'PYEOF'
"""Tarea 1 del plan de H0b, tramo A: lleva a DESIGN.md y al plan maestro las decisiones del 13 y 14-oct-2026.

Uso, desde la raíz del repo: python3 -I -B decisiones_h0b.py
Cada texto viejo debe aparecer exactamente una vez; si no, para sin escribir nada.
"""
import pathlib

PM = "docs/plan/2026-10-12-plan-maestro-f2.md"
CAMBIOS = {
    "DESIGN.md": [
        ("(la 44 fija los hosts de F2)", "(la 44 y la 74 fijan los hosts de F2)"),
        ("Sin CORS, cookies ni desafíos de bot |",
         "Sin CORS, cookies ni desafíos de bot. La 63 cambia la cuenta y la 74, dónde viven los hosts |"),
        ("Workers Paid antes del piloto |", "Workers Paid antes del piloto. La 63 cambia la cuenta |"),
        ('sería una seña común a todas las bóvedas |\n',
         'sería una seña común a todas las bóvedas |\n'
         "| 74 | Hosts neutros | Cambia la 44 (14-oct-2026), como pide la 63: cada host público (`<host-api>`, "
         "`<host-bóveda>`, `<host-respaldo>` y los de prueba) es un proyecto de Pages con nombre neutro que reenvía "
         "por service binding a Workers sin URL pública (`workers_dev: false` y `preview_urls: false`), donde viven "
         "el cron, los límites de peticiones, D1 y R2. El subdominio de workers.dev de la cuenta no se cambia y no "
         "aparece nunca. Coste declarado: en F2 todo depende de pages.dev; antes del piloto, con los datos de P8 y "
         "de OONI, se valora un dominio propio. Lo valida P9 en el tramo B de H0b; si Pages no puede hacer de puerta, "
         "se vuelve a decidir |\n"),
        ("├─ packages/backend  Worker Hono, desplegado con nombres neutros (decisión 44):",
         "├─ packages/backend  Worker Hono, desplegado con nombres neutros (decisiones 44 y 74):"),
        ("│                    <host-respaldo> → el mismo código en pages.dev",
         "│                    <host-respaldo> → el mismo código (los tres, proyectos de Pages\n"
         "│                                      delante de Workers sin URL pública)"),
        ("`<host-api>` (workers.dev) → `<host-respaldo>` (pages.dev) → un segundo nombre de respaldo, con DNS cifrado "
         "de varios resolvedores (decisión 44).",
         "`<host-api>` → `<host-respaldo>` → un segundo nombre de respaldo, todos proyectos de Pages con nombre neutro "
         "(decisión 74), con DNS cifrado de varios resolvedores (decisión 44)."),
        ("si workers.dev y pages.dev quedan bloqueados a la vez en VE, no hay respaldo sin un dominio propio;",
         "si pages.dev queda bloqueado en VE, no hay respaldo sin un dominio propio (decisión 74: en F2 todos los "
         "hosts viven en pages.dev);"),
    ],
    PM: [
        ('versión con las decisiones del 12-oct-2026 (sección "Decisiones de F1"), pendiente de aprobación.',
         'versión con las decisiones del 12-oct-2026 (sección "Decisiones de F1"), aprobado el 12-oct-2026; '
         'las de H0b del 13 y 14-oct-2026 están en "Decisiones de H0b".'),
        ("| Informe completo del pico y sus cambios a DESIGN.md | H0a; teléfono y cuenta de Cloudflare |",
         "| Informe completo del pico y sus cambios a DESIGN.md, en tres tramos (A sin Cloudflare, B con la cuenta "
         "y C en VE) | H0a; teléfono y cuenta de Cloudflare |"),
        ("; variantes y build endurecido | H1 y H0b | M |",
         "; variantes y build endurecido | H1 y el tramo A de H0b (`f2-h0b-a`) | M |"),
        ("H1 va antes que H0b (con la regla de orden de los commits). Nada que dependa de MediaCodec, del servicio en "
         "primer plano o de la cola en el teléfono empieza antes de cerrar H0b.",
         "H1 va antes que H0b (con la regla de orden de los commits). Nada que dependa de MediaCodec, del servicio en "
         "primer plano o de la cola en el teléfono empieza antes de cerrar H0b. H2 empieza con el tramo A cerrado "
         "(`f2-h0b-a`); H3a espera a `f2-h0b`."),
        ("con marcadores en lugar de hosts reales) y los cambios a DESIGN.md que salen de él. Fuera del repo, los "
         "Workers y la página de prueba.\n",
         "con marcadores en lugar de hosts reales) y los cambios a DESIGN.md que salen de él. Fuera del repo, los "
         "Workers y la página de prueba.\n"
         "- **Tramos (13-oct-2026):** A, sin Cloudflare: P1 en el teléfono, P2, P3, P4 sin subida, P5 en el "
         "teléfono, P6 en navegadores reales, P7 en la máquina y la parte de P8 que sale de OONI; cierra con la "
         "etiqueta `f2-h0b-a`. B, con la llave y el token: endurecimiento de la cuenta, hosts neutros, P9, P4 con "
         "subida, P7 en el teléfono y P6 en un host real; cierra con `f2-h0b`, con P8 en marcha o con Telegram "
         "declarado como canal principal. C: P8 con la persona en VE. Ver \"Decisiones de H0b\".\n"),
        ("al terminar, `adb shell dumpsys battery reset`.",
         "al terminar, `adb shell dumpsys deviceidle unforce` y `adb shell dumpsys battery reset`."),
        ("  - el banco descarta el campo `from` y guarda solo el `chat_id` cifrado;\n"
         "  - al terminar se borran el bot, sus mensajes, el host y los datos;\n",
         "  - el banco guarda solo `chat.id` cifrado y descarta `from` y el resto de `chat` (nombre, apellido y "
         "usuario);\n"
         "  - el bot borra cada aviso antes de 48 h (Telegram no deja borrarlo después); al terminar, la persona "
         "borra el chat para los dos y se borran el bot, el host y los datos;\n"),
        ("  - su identidad nunca entra al repo.\n",
         "  - su identidad nunca entra al repo;\n"
         "  - textos y título neutros, sin \"Vigía\", y sub de VAPID neutro;\n"
         "  - una ventana horaria acordada para los avisos, y las horas de llegada vuelven por un canal privado;\n"
         "  - antes de borrar el host, limpia en su navegador el service worker, la suscripción y el "
         "almacenamiento;\n"
         "  - los identificadores de su cuenta secundaria de Telegram entran en la lista privada de patrones;\n"
         "  - el consentimiento nombra el riesgo de probar resolvedores anticensura desde su línea, y los "
         "resolvedores se prueban también por IP.\n"),
        ("Un bucket de prueba con una regla de 1 día en `incidents/`:", "Un bucket de prueba con una regla de 1 día en `i/`:"),
        ("nunca `expo start --tunnel` |",
         "nunca `expo start --tunnel`. Excepción (14-oct-2026): P7 de H0b corre el Worker en la red interna "
         "`vigia-p7` (sin salida a internet ni puertos publicados), con netem desde un contenedor auxiliar de un "
         "solo uso con `NET_ADMIN` |"),
        ('dónde verifica la app y, si es en Kotlin, la frase "un único código";',
         'dónde verifica la app (DESIGN.md, "Pruebas" y decisión 72);'),
        ("| Teléfono Android de gama baja con SIM y datos y la depuración USB activada |",
         "| Teléfono Android de gama baja con SIM y datos y la depuración USB activada (con cuentas reales: riesgo "
         "aceptado el 14-oct-2026; el detalle va en el archivo privado) |"),
        ("    7. el borrador del pack VE lo redacta Claude y la persona responsable revisa el tono y las fuentes (H2).\n",
         "    7. el borrador del pack VE lo redacta Claude y la persona responsable revisa el tono y las fuentes (H2).\n"
         "\n"
         "## Decisiones de H0b (13 y 14-oct-2026)\n"
         "\n"
         "Cambian lo que este plan dice antes; los textos de cada hito que suponen hosts en workers.dev se ajustan "
         "al cerrar el tramo B, con P9.\n"
         "\n"
         "1. **Teléfono y portátil:** Xiaomi o Redmi con Android 11 a 13; el portátil es Windows y los guiones son "
         "bloques de PowerShell para pegar.\n"
         "2. **Tramos:** sin llave física no se despliega nada en Cloudflare. H0b va en tres tramos: A (sin "
         "Cloudflare), B (con la llave y el token) y C (P8 con la persona en VE, que llega más adelante).\n"
         "3. **Cierre:** etiqueta `f2-h0b-a` al cerrar A, y H2 puede empezar; `f2-h0b` al cerrar B, con P8 en "
         "marcha o con Telegram declarado como canal principal. H3a espera a `f2-h0b`.\n"
         "4. **Hosts neutros:** proyectos de Pages con nombre neutro delante de Workers sin URL pública "
         "(DESIGN.md, decisión 74). No se cambia el subdominio de workers.dev de la cuenta.\n"
         "5. **P7:** netem en un contenedor auxiliar de un solo uso con `NET_ADMIN`, en la red interna `vigia-p7`; "
         "el Worker escucha en esa red y no en 127.0.0.1 (excepción acotada a OPS-03).\n"
         "6. **Cuentas del teléfono:** el teléfono de pruebas lleva cuentas reales (riesgo aceptado; el detalle va en el "
         "archivo privado) y, con la depuración USB activada, no sirve para protegerse. El banco no lee identificadores "
         "del aparato ni de las cuentas.\n"),
    ],
    ".gitignore": [
        ("# Bytecode de Python: lleva incrustada la ruta de la máquina\n",
         "# Estado local de Claude Code\n.claude/\n# Bytecode de Python: lleva incrustada la ruta de la máquina\n"),
    ],
}

nuevos = {}
for ruta, cambios in CAMBIOS.items():
    texto = pathlib.Path(ruta).read_text(encoding="utf-8")
    for viejo, nuevo in cambios:
        n = texto.count(viejo)
        if n != 1:
            raise SystemExit(f"{ruta}: el texto aparece {n} veces: {viejo[:70]!r}")
        texto = texto.replace(viejo, nuevo)
    if chr(0x2014) in texto:
        raise SystemExit(f"{ruta}: lleva la raya larga")
    nuevos[ruta] = texto
for ruta, texto in nuevos.items():
    pathlib.Path(ruta).write_text(texto, encoding="utf-8")
    print(f"{ruta}: {len(CAMBIOS[ruta])} cambios")
PYEOF
```

Esperado: ninguna salida.

- [ ] **Paso 2: aplicarlo**

Ejecutar (desde `<repo>`):

```sh
python3 -I -B /tmp/decisiones_h0b.py
```

Esperado:

```
DESIGN.md: 8 cambios
docs/plan/2026-10-12-plan-maestro-f2.md: 13 cambios
.gitignore: 1 cambios
```

Si sale `el texto aparece 0 veces` o `2 veces`, DESIGN.md o el plan maestro cambiaron desde que se escribió este plan (que parte del commit `2f42015`, el del favicon): parar y comparar con `git log --oneline 2f42015..HEAD -- DESIGN.md docs/plan/2026-10-12-plan-maestro-f2.md .gitignore`.

- [ ] **Paso 3: comprobar el resultado**

Ejecutar:

```sh
git diff --stat
python3 -I -B /tmp/decisiones_h0b.py; echo "salida: $?"
grep -c '^| 74 | Hosts neutros |' DESIGN.md
grep -c '^## Decisiones de H0b (13 y 14-oct-2026)$' docs/plan/2026-10-12-plan-maestro-f2.md
git status --short --ignored .claude
```

Esperado: `git diff --stat` con los tres archivos (`.gitignore`, `DESIGN.md` y el plan maestro); la segunda ejecución del script para con `DESIGN.md: el texto aparece 0 veces: '(la 44 fija los hosts de F2)'` y `salida: 1` (ya aplicado); `1` y `1`; y `!! .claude/` (ignorada).

- [ ] **Paso 4: commit**

Tras el `git add`, revisar `git diff --cached` antes del `git commit` (máquina de trabajo, desde `<repo>`):

```sh
git add .gitignore DESIGN.md docs/plan/2026-10-12-plan-maestro-f2.md
git diff --cached
git commit -q -F - <<'MENSAJE'
Lleva a DESIGN.md y al plan maestro las decisiones de H0b del 13 y 14-oct

H0b va en tres tramos (A sin Cloudflare, B con la cuenta y C en VE) y cierra
en dos etiquetas: f2-h0b-a, con la que puede empezar H2, y f2-h0b. Los hosts
públicos serán proyectos de Pages con nombre neutro delante de Workers sin
URL pública (decisión 74). P7 usa netem en la red interna vigia-p7, como
excepción acotada a OPS-03. Además: el prefijo i/ en P9, deviceidle unforce
en P4, las protecciones de P8 que faltaban y .claude/ en .gitignore.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MENSAJE
rm /tmp/decisiones_h0b.py
git log -1 --stat
```

Esperado: los hooks pasan (gitleaks `no leaks found`) y `git log -1 --stat` muestra los 3 archivos.

---

### Tarea 2: Entorno de build para H0b

**Archivos:**
- Modificar: `entorno/Dockerfile` (una capa al final con `iproute2`), `docs/pico/informe.md` (tabla "Versiones fijadas (H0b)" con la fila de `iproute2`) y `packages/nucleo/gradle/verification-metadata.xml` (las cuatro sumas que pide Gradle con la caché vacía).
- Fuera del repo: la imagen `vigia-build:h0b` y el contenedor `vigia-build` recreado con ella, con la orden de `docker run` del archivo privado `h0a-entorno.md` y cuatro cambios.

**Interfaces:**
- Consume:
  - H0a: `entorno/Dockerfile` y `entorno/sincronizar.sh`; la imagen `vigia-build:h0a`, hecha con el builder clásico de Docker, con sus capas intermedias en la caché local; los valores de sus argumentos (los de la tabla de versiones del informe), y la orden de `docker run` de la sección "Crear el entorno" de `h0a-entorno.md`.
  - H1: `/work/vigia` (copia de trabajo del repo), sus suites y su lockfile.
- Produce:
  - La imagen `vigia-build:h0b`: las 9 capas de `vigia-build:h0a`, iguales, y una más con iproute2 6.1.0-1ubuntu6.4 de la instantánea `20261005T000000Z` (`/usr/sbin/tc`, `/usr/bin/ss` e `/usr/bin/ip`, sin capacidades de archivo). Es la imagen de `vigia-build` y de todos los contenedores efímeros de H0b: herramientas de la máquina, clave de escucha (tarea 3) y netem de P7 (tarea 11).
  - El contenedor `vigia-build` con `--init` (el PID 1 es `docker-init`, que recoge los procesos huérfanos: sin zombis), `GRADLE_USER_HOME=/work/.gradle` y `npm_config_cache=/work/.npm` (las cachés viven en el volumen, sobreviven a recrear el contenedor y las ven los contenedores efímeros). Lo demás no cambia: usuario 1001, sin capacidades, `no-new-privileges`, sin puertos publicados, el repo y el banco en solo lectura y el `.git` del repo tapado.
  - `packages/nucleo/gradle/verification-metadata.xml` completo (SHA-256 `20b4c851e4c4e09a6375d14b5beb0146318f6ad6f593578e227583a90aacff24`): el de `f2-h1` más las cuatro sumas que pide Gradle cuando su caché está vacía. Lo copia el `jvm/` del banco (tarea 4).
  - En el contenedor nuevo: las suites de H1 en verde (shared 259, backend 194, simulador 10 y núcleo 15 clases y 107 pruebas), `/work/.gradle` llena con lo que verifica ese archivo (la copia de `f2-h1` de la tarea 4 compila con ella) y la caché de pnpm del HOME llena para el lockfile de H1 (la tarea 4 instala sin red con ella).

- [ ] **Paso 1: añadir la capa de `iproute2` al final de `entorno/Dockerfile`**

Las capas de arriba no se tocan: la imagen nueva reutiliza las de `vigia-build:h0a` y solo añade esta. apt sale de la misma instantánea (`APT_SNAPSHOT`, el argumento que el archivo ya declara), así que la versión es fija o el build falla. `tc` no da capacidades a nadie: aplicar netem exige `NET_ADMIN`, que solo tendrá el contenedor auxiliar de P7 (decisión 5); `ss` sirve sin capacidades para ver las escuchas (OPS-03).

Añadir al final de `<repo>/entorno/Dockerfile`:

```dockerfile
# H0b: iproute2 trae tc (netem de P7, en un contenedor auxiliar con NET_ADMIN) y ss (comprobación de OPS-03).
# Sale de la misma instantánea y va en una capa al final: las de arriba siguen siendo las de H0a.
USER root
RUN apt-get update --snapshot "$APT_SNAPSHOT" \
 && apt-get install -y --no-install-recommends --snapshot "$APT_SNAPSHOT" iproute2 \
 && rm -rf /var/lib/apt/lists/*
USER vigia
```

📍 Máquina de trabajo.

Ejecutar:

```sh
git -C <repo> diff --stat
```

Esperado: ` entorno/Dockerfile | 7 +++++++` y ` 1 file changed, 7 insertions(+)`.

- [ ] **Paso 2: construir `vigia-build:h0b` con el builder clásico**

`vigia-build:h0a` se construyó con el builder clásico (en la máquina no hay buildx), y su caché solo la usa ese builder: con BuildKit se rehacen todas las capas. `DOCKER_BUILDKIT=0` lo fija. Los argumentos son los de H0a, los de la tabla de versiones del informe; el contexto es `<repo>/entorno`.

📍 Máquina de trabajo.

Ejecutar:

```sh
DOCKER_BUILDKIT=0 docker build -t vigia-build:h0b \
  --build-arg BASE=ubuntu@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55 \
  --build-arg APT_ARRANQUE="ca-certificates=20260601~24.04.1 openssl=3.0.13-0ubuntu3.16 libssl3t64=3.0.13-0ubuntu3.16" \
  --build-arg APT_SNAPSHOT=20261005T000000Z \
  --build-arg NODE_VERSION=24.21.0 \
  --build-arg NODE_SHA256=fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6 \
  --build-arg PNPM_VERSION=12.9.1 \
  --build-arg PNPM_SHA256=44c80447645c2a1d8da9308d3efedcec6ca2db4579183abcb15d8a90a88277d4 \
  --build-arg CMDLINE_TOOLS_ZIP=commandlinetools-linux-15859902_latest.zip \
  --build-arg CMDLINE_TOOLS_SHA256=4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583 \
  --build-arg PLATFORM_TOOLS_ZIP=platform-tools_r37.0.1-linux.zip \
  --build-arg PLATFORM_TOOLS_SHA256=d230f13842f60f782a8645f9c813f8f845bf36089ea7289f28c48f17979313f1 \
  --build-arg SDK_PAQUETES="build-tools;35.0.0 build-tools;36.0.0 platforms;android-36 ndk;27.1.12297006 cmake;3.22.1" \
  <repo>/entorno
```

Esperado:
- arriba, `DEPRECATED: The legacy builder is deprecated and will be removed in a future release.` (normal: es el builder de H0a);
- del `Step 3/29` al `Step 26/29`, todos con `---> Using cache`, y el 26 (`WORKDIR /work`) termina en `---> fa33e15c33f4`, el id de `vigia-build:h0a`;
- el `Step 28/29` dice `The following NEW packages will be installed:` con `iproute2 libbpf1 libcap2-bin libmnl0 libxtables12`, baja `iproute2 amd64 6.1.0-1ubuntu6.4` de `https://snapshot.ubuntu.com/ubuntu/20261005T000000Z noble-updates/main` y acaba con `0 upgraded, 5 newly installed, 0 to remove and 2 not upgraded.`;
- al final, `Successfully tagged vigia-build:h0b`.

Si algún paso del 6 al 25 dice `Running in` en lugar de `Using cache`, la caché de H0a no está o un argumento no es igual: la imagen saldría con todas las capas nuevas. Parar y avisar a la persona responsable sin recrear el contenedor (borrar la imagen a medias con `docker rmi vigia-build:h0b`).

- [ ] **Paso 3: comprobar que solo cambia la capa nueva y que la imagen trae `tc` y `ss`**

📍 Máquina de trabajo.

Ejecutar:

```sh
docker inspect --format '{{json .RootFS.Layers}}' vigia-build:h0a vigia-build:h0b | python3 -I -c '
import json, sys
a, b = (json.loads(l) for l in sys.stdin)
print("capas h0a:", len(a), "capas h0b:", len(b))
print("las de h0a, iguales y en orden:", b[:len(a)] == a)
print("nuevas:", len(b) - len(a))'
docker run --rm --network none vigia-build:h0b sh -c 'tc -V; ss -V; dpkg-query -W -f "\${Package} \${Version}\n" iproute2'
```

Esperado:

```
capas h0a: 9 capas h0b: 10
las de h0a, iguales y en orden: True
nuevas: 1
tc utility, iproute2-6.1.0, libbpf 1.3.0
ss utility, iproute2-6.1.0
iproute2 6.1.0-1ubuntu6.4
```

Con `False` o más de una capa nueva, parar como en el paso 2.

- [ ] **Paso 4: recrear `vigia-build` con la imagen nueva**

⚠️ Esto para el contenedor `vigia-build`: termina lo que corra dentro (en H0a quedaron vivos el `http.server` de P6 y `wrangler pages dev`, que ya no hacen falta) y pierde las cachés de su HOME (unos 3,4 GB de Gradle y npm, que la primera build vuelve a bajar, ahora a `/work`). El volumen `vigia-trabajo` (`/work`) no se toca. Para poder volver atrás, el contenedor viejo no se borra todavía: se renombra y se para.

📍 Máquina de trabajo.

Ejecutar:

```sh
docker rename vigia-build vigia-build-h0a && docker stop vigia-build-h0a
```

Esperado: `vigia-build-h0a`.

Después, ejecutar la orden de `docker run` de la sección "Crear el entorno" de `h0a-entorno.md` con cuatro cambios y ninguno más:
1. la imagen `vigia-build:h0b` en lugar de `vigia-build:h0a`;
2. `--init`, antes de la imagen;
3. `-e GRADLE_USER_HOME=/work/.gradle`;
4. `-e npm_config_cache=/work/.npm`.

📍 Máquina de trabajo.

Ejecutar:

```sh
docker inspect --format '{{.Config.Image}} init={{.HostConfig.Init}} {{.State.Status}} {{.Config.User}}' vigia-build
```

Esperado: `vigia-build:h0b init=true running 1001:1001`.

Si la orden falla o el contenedor no queda en `running`, volver atrás (📍 máquina de trabajo):

```sh
docker rm -f vigia-build; docker rename vigia-build-h0a vigia-build && docker start vigia-build
```

- [ ] **Paso 5: comprobar ENV-01 en el contenedor nuevo**

Las comprobaciones de H0a (usuario, capacidades, socket de Docker, fuentes de solo lectura, `.git` del repo tapado, JDK, Node y pnpm) y las nuevas: `tc` y `ss`, el PID 1, las cachés en `/work`, que un proceso huérfano no queda como zombi y que nada escucha.

📍 Máquina de trabajo; el guion corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec -i vigia-build sh -s <<'EOF'
echo "usuario: $(id -u)"
grep CapEff /proc/self/status
test -S /var/run/docker.sock && echo "MAL: ve el socket de Docker" || echo "bien: sin socket de Docker"
touch /fuente/vigia/.prueba 2>/dev/null && echo "MAL: escribe en el repo" || echo "bien: el repo es de solo lectura"
touch /fuente/banco/.prueba 2>/dev/null && echo "MAL: escribe en el banco" || echo "bien: el banco es de solo lectura"
[ -z "$(ls -A /fuente/vigia/.git 2>/dev/null)" ] && echo "bien: no ve el .git del repo" || echo "MAL: ve el .git del repo"
ls /fuente
javac -version; jlink --version; node --version; pnpm --version
tc -V; ss -V
echo "PID 1: $(cat /proc/1/comm)"
echo "GRADLE_USER_HOME=$GRADLE_USER_HOME npm_config_cache=$npm_config_cache"
sh -c 'sleep 1 &'; sleep 2; echo "zombis: $(ps -eo stat= | grep -c '^Z')"
echo "escuchas: $(ss -ltnH | wc -l)"
EOF
echo "puertos publicados: $(docker port vigia-build | wc -l)"
```

Esperado:

```
usuario: 1001
CapEff:	0000000000000000
bien: sin socket de Docker
bien: el repo es de solo lectura
bien: el banco es de solo lectura
bien: no ve el .git del repo
banco
vigia
javac 17.0.20.1
17.0.20.1
v24.21.0
12.9.1
tc utility, iproute2-6.1.0, libbpf 1.3.0
ss utility, iproute2-6.1.0
PID 1: docker-init
GRADLE_USER_HOME=/work/.gradle npm_config_cache=/work/.npm
zombis: 0
escuchas: 0
puertos publicados: 0
```

Con una línea `MAL`, `zombis` distinto de 0 o un PID 1 que no sea `docker-init`, volver atrás como en el paso 4 y revisar la orden.

- [ ] **Paso 6: completar la verificación de Gradle del núcleo para una caché vacía**

`/work/.gradle` empieza vacía, y con la caché vacía el núcleo de H1 no compila: Gradle lee cuatro archivos de metadatos (dos `.pom` y dos `.module` de BOM) que `packages/nucleo/gradle/verification-metadata.xml` no tiene, porque H1 lo generó con la caché ya llena, y con la caché llena Gradle no los vuelve a leer. Comprobado el 14-oct con la etiqueta `f2-h1` y una caché vacía: `Dependency verification failed for configuration 'classpath'` y, en la siguiente vuelta, `One artifact failed verification: junit-bom-6.1.3.pom`; el `jvm/` del banco falla igual con `kotlinx-coroutines-bom-1.8.0.pom`. Las cuatro sumas que faltan son las que escribe `--write-verification-metadata sha256` partiendo de una caché vacía (el mismo archivo, byte a byte, en dos cachés vacías distintas). El script las añade sin tocar nada más y comprueba el resultado; si el archivo de partida no es el de `f2-h1`, no escribe nada.

📍 Máquina de trabajo, desde `<repo>`.

Ejecutar:

```sh
cat > /tmp/completar-verificacion.py <<'PYEOF'
"""Añade a packages/nucleo/gradle/verification-metadata.xml las cuatro sumas que Gradle pide con la caché vacía
(H0b, tarea 2). Uso, desde la raíz del repo: python3 -I -B completar-verificacion.py
Cada texto viejo debe aparecer exactamente una vez y el resultado debe tener la suma esperada; si no, no escribe nada."""
import hashlib
import pathlib

RUTA = pathlib.Path('packages/nucleo/gradle/verification-metadata.xml')
ESPERADA = '20b4c851e4c4e09a6375d14b5beb0146318f6ad6f593578e227583a90aacff24'


def artefacto(nombre: str, suma: str) -> str:
    return (f'         <artifact name="{nombre}">\n'
            f'            <sha256 value="{suma}" origin="Generated by Gradle"/>\n'
            '         </artifact>\n')


CAMBIOS = [
    ('      <component group="org.jetbrains.kotlinx" name="kotlinx-coroutines-core-jvm" version="1.8.0">\n',
     '      <component group="org.jetbrains.kotlinx" name="kotlinx-coroutines-bom" version="1.8.0">\n'
     + artefacto('kotlinx-coroutines-bom-1.8.0.pom', '1239e9dbe1397cd5971342956b2511bc3ace7b641842e4372a088dcfa8b9ad55')
     + '      </component>\n'
     '      <component group="org.jetbrains.kotlinx" name="kotlinx-coroutines-core-jvm" version="1.8.0">\n'),
    ('      <component group="org.junit" name="junit-bom" version="5.10.2">\n',
     '      <component group="org.junit" name="junit-bom" version="5.10.2">\n'
     + artefacto('junit-bom-5.10.2.module', 'de23b114b3e4119a8fe6eb17bed5a3852816698bace67071579d6d927ebb080a')),
    ('      <component group="org.junit" name="junit-bom" version="5.11.4">\n',
     '      <component group="org.junit" name="junit-bom" version="5.11.4">\n'
     + artefacto('junit-bom-5.11.4.module', 'a9a4f27be94e99b9d570162d246a80f686d277d5d31aeb5481047cf51daf46e4')),
    (artefacto('junit-bom-6.1.3.module', '9f5d57dadcfa07f7b38efcfb22b052ece188922a1df76b5a98e44a1df7a7701b'),
     artefacto('junit-bom-6.1.3.module', '9f5d57dadcfa07f7b38efcfb22b052ece188922a1df76b5a98e44a1df7a7701b')
     + artefacto('junit-bom-6.1.3.pom', 'a9000043610a3e90c852e779a6b1a8eb724a9f312cf5f7ddd57862b010c65dc8')),
]

texto = RUTA.read_text(encoding='utf-8')
for viejo, nuevo in CAMBIOS:
    if texto.count(viejo) != 1:
        raise SystemExit(f'No aparece exactamente una vez:\n{viejo}')
    texto = texto.replace(viejo, nuevo)
suma = hashlib.sha256(texto.encode('utf-8')).hexdigest()
if suma != ESPERADA:
    raise SystemExit(f'El resultado no tiene la suma esperada ({suma}): no se escribe nada')
RUTA.write_text(texto, encoding='utf-8')
print(f'{RUTA}: cuatro sumas añadidas, SHA-256 {suma}')
PYEOF
python3 -I -B /tmp/completar-verificacion.py && rm /tmp/completar-verificacion.py && git diff --stat -- packages/nucleo
```

Esperado: `packages/nucleo/gradle/verification-metadata.xml: cuatro sumas añadidas, SHA-256 20b4c851e4c4e09a6375d14b5beb0146318f6ad6f593578e227583a90aacff24` y ` packages/nucleo/gradle/verification-metadata.xml | 14 ++++++++++++++`. Con `No aparece exactamente una vez` o `El resultado no tiene la suma esperada`, el archivo no es el de `f2-h1` (`git -C <repo> diff f2-h1 -- packages/nucleo/gradle/verification-metadata.xml` lo enseña): parar y avisar.

- [ ] **Paso 7: las suites de H1 siguen en verde en el contenedor nuevo**

Con la caché de Gradle vacía de verdad: la distribución 9.3.1 baja a `/work/.gradle` (el wrapper la comprueba con `distributionSha256Sum`) y cada dependencia del núcleo se comprueba con el `verification-metadata.xml` del paso 6. pnpm usa su almacén de siempre, `/work/.pnpm-store`, y deja en el HOME del contenedor la caché de metadatos con la que la tarea 4 instala sin red. `cleanTest` obliga a ejecutar las pruebas del núcleo aunque Gradle las dé por hechas en `/work/vigia`. Al final, los cuatro archivos nuevos se comparan con el SHA-1 que publica Maven Central (no es una fuente independiente, pero descarta una descarga rota).

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar vigia && cd /work/vigia && pnpm install --frozen-lockfile && pnpm -r test > /tmp/h1-pnpm.log 2>&1; echo "salida: $?"; sed "s/\x1b\[[0-9;]*m//g" /tmp/h1-pnpm.log | grep -E "Test Files|Tests  "'
docker exec vigia-build sh -c 'cd /work/vigia/packages/nucleo && ./gradlew --no-daemon cleanTest test > /tmp/h1-nucleo.log 2>&1; echo "salida: $?"; grep -ho "tests=\"[0-9]*\" skipped=\"0\" failures=\"0\" errors=\"0\"" build/test-results/test/*.xml | awk -F"\"" "{n++; t+=\$2} END {print n \" clases, \" t \" pruebas, sin fallos\"}"; ls /work/.gradle/wrapper/dists'
docker exec -i vigia-build sh -s <<'EOF'
cd "$GRADLE_USER_HOME/caches/modules-2/files-2.1"
for a in 'org.jetbrains.kotlinx kotlinx-coroutines-bom 1.8.0 pom' 'org.junit junit-bom 5.10.2 module' 'org.junit junit-bom 5.11.4 module' 'org.junit junit-bom 6.1.3 pom'; do
    set -- $a
    f=$(find "$1/$2/$3" -name "$2-$3.$4" | head -n 1)
    url="https://repo1.maven.org/maven2/$(echo "$1" | tr . /)/$2/$3/$2-$3.$4"
    [ "$(curl -fsSL "$url.sha1" | cut -c1-40)" = "$(sha1sum "$f" | cut -c1-40)" ] && r='igual al de Maven Central' || r='MAL: distinto del de Maven Central'
    echo "$2-$3.$4: sha1 $r, sha256 $(sha256sum "$f" | cut -c1-64)"
done
EOF
```

Esperado (las líneas de pnpm pueden salir en otro orden; antes, la salida de `pnpm install` con `Lockfile is up to date, resolution step is skipped` y sin ningún `ERR_PNPM_`):

```
salida: 0
packages/shared test:  Test Files  22 passed (22)
packages/shared test:       Tests  259 passed (259)
packages/simulador test:  Test Files  2 passed (2)
packages/simulador test:       Tests  10 passed (10)
packages/backend test:  Test Files  14 passed (14)
packages/backend test:       Tests  194 passed (194)
salida: 0
15 clases, 107 pruebas, sin fallos
CACHEDIR.TAG
gradle-9.3.1-bin
kotlinx-coroutines-bom-1.8.0.pom: sha1 igual al de Maven Central, sha256 1239e9dbe1397cd5971342956b2511bc3ace7b641842e4372a088dcfa8b9ad55
junit-bom-5.10.2.module: sha1 igual al de Maven Central, sha256 de23b114b3e4119a8fe6eb17bed5a3852816698bace67071579d6d927ebb080a
junit-bom-5.11.4.module: sha1 igual al de Maven Central, sha256 a9a4f27be94e99b9d570162d246a80f686d277d5d31aeb5481047cf51daf46e4
junit-bom-6.1.3.pom: sha1 igual al de Maven Central, sha256 a9000043610a3e90c852e779a6b1a8eb724a9f312cf5f7ddd57862b010c65dc8
```

Si algo falla, el log entero está en `/tmp/h1-pnpm.log` o en `/tmp/h1-nucleo.log` del contenedor. Con `Dependency verification failed`, el paso 6 no se aplicó (o `sincronizar vigia` no lo copió): no se toca el archivo a mano, se avisa. Con `MAL: distinto del de Maven Central`, parar: la descarga no es la publicada.

- [ ] **Paso 8: borrar el contenedor viejo**

⚠️ Irreversible: desde aquí, volver a H0a exige recrear el contenedor con la orden de `h0a-entorno.md`. La imagen `vigia-build:h0a` se queda: sus capas son las de abajo de `vigia-build:h0b`, así que no ocupa más.

📍 Máquina de trabajo.

Ejecutar:

```sh
docker rm vigia-build-h0a
```

Esperado: `vigia-build-h0a`.

- [ ] **Paso 9: anotar `iproute2` en el informe**

En `<repo>/docs/pico/informe.md`, justo antes de `## Entorno de build aislado (ENV-01)`, añadir esta sección (la tarea 16 completa la tabla con las demás piezas nuevas de H0b):

```markdown
## Versiones fijadas (H0b)

Lo que H0b añade a lo de H0a, todo publicado hace 7 días o más el 14-oct-2026.

| Pieza | Versión | Comprobación |
|---|---|---|
| iproute2 (`tc` y `ss`) en el entorno de build | 6.1.0-1ubuntu6.4, de la instantánea `20261005T000000Z`, con libbpf1 1:1.3.0-2build2, libcap2-bin 1:2.66-5ubuntu2.4, libmnl0 1.0.5-2build1 y libxtables12 1.8.10-3ubuntu2 | `apt-get --snapshot`, en una capa nueva al final de la imagen `vigia-build:h0b`; las 9 capas de H0a no cambian |
```

- [ ] **Paso 10: commit de la verificación del núcleo**

📍 Máquina de trabajo, desde `<repo>`. Tras el `git add`, revisar `git diff --cached` antes del `git commit` (son las 14 líneas del paso 6):

```bash
git add packages/nucleo/gradle/verification-metadata.xml
git commit -m "Completa la verificación de Gradle del núcleo para una caché vacía

Con la caché de Gradle vacía (la del entorno de H0b), Gradle lee
cuatro archivos de metadatos de BOM que verification-metadata.xml no
tenía, porque se generó con la caché llena, y el núcleo no compilaba.
Añade sus sumas: las que escribe --write-verification-metadata desde
una caché vacía, que coinciden con el SHA-1 de Maven Central.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Esperado: los hooks pasan y `git log -1 --stat` muestra `packages/nucleo/gradle/verification-metadata.xml | 14 ++++++++++++++`.

- [ ] **Paso 11: commit del entorno**

📍 Máquina de trabajo, desde `<repo>`. Tras el `git add`, revisar `git diff --cached` antes del `git commit`:

```bash
git add entorno/Dockerfile docs/pico/informe.md
git commit -m "Añade iproute2 al entorno de build para H0b

tc, para netem en P7 desde un contenedor auxiliar con NET_ADMIN, y ss,
para comprobar OPS-03. Sale de la misma instantánea de apt y va en una
capa al final, así que las 9 capas de H0a no cambian. El contenedor se
recrea con --init y las cachés de Gradle y npm en el volumen de trabajo
(archivo privado). Anota la versión en el informe del pico.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Esperado: los hooks pasan y `git log -1 --stat` muestra los dos archivos.

**Notas:**

- **Nota:** validado el 14-oct-2026 con la etiqueta `vigia-build:h0b-validacion` (ya borrada): pasos 2 y 3 con estas salidas; el paso 5, en un contenedor efímero con las mismas opciones que `vigia-build` más los cuatro cambios (contra el contenedor de H0a, el mismo guion da `PID 1: sleep`, `zombis: 2203` y `tc: not found`); el script del paso 6, sobre el archivo de `f2-h1` (y se niega a aplicarse dos veces); y el paso 7, en un contenedor efímero de la imagen nueva con una copia de `f2-h1` y dos cachés vacías en el volumen, con estas salidas. Los pasos 4 y 8 recrean el contenedor de verdad y no se ensayaron.
- **Nota:** el builder clásico está obsoleto. Si un Docker futuro lo quita, construir con BuildKit da una imagen con las mismas versiones (todo está fijado por suma o por instantánea) pero con las 10 capas nuevas: se anota en el informe y se sigue.
- **Nota:** `2 not upgraded` son `libaudit1` y `libaudit-common` de la imagen base, que la instantánea tiene más nuevos; `apt-get install` no los toca, igual que en la capa de H0a. La instantánea solo trae `noble`, `noble-updates` y `noble-backports`: lo que está únicamente en `noble-security` (hoy, `libx11-6` 2:1.8.7-1ubuntu0.1) no entra en la imagen.
- **Nota:** la copia de `f2-h1` de la tarea 4 lleva el `verification-metadata.xml` de la etiqueta, sin las cuatro sumas: compila porque `/work/.gradle` ya está llena tras el paso 7. Si se vacía `/work/.gradle`, primero se repite el paso 7 (`/work/vigia` tiene el archivo completo).

---

### Tarea 3: Clave de escucha de pruebas, carpeta de intercambio y `h0b-entorno.md`

**Archivos:** ninguno en el repo ni en el banco. Fuera de los dos (`<privada>` es la carpeta privada del proyecto, la de `h0a-entorno.md`):
- `<intercambio>` (700), con `entrega/`, `telefono/` y `resultados/`.
- `<privada>/escucha/` (700), con `privada.b64u` (600) y `publica.b64u` (644).
- `/work/h0b/escucha/publica.b64u`, en el volumen de trabajo.
- `<privada>/h0b-entorno.md` (600).

**Interfaces:**
- Consume:
  - Tarea 2: la imagen `vigia-build:h0b`, el contenedor `vigia-build` recreado con ella y `/work/vigia` con shared de H1 y sus dependencias (las instala el paso 7 de la tarea 2).
  - shared de H1 (`/work/vigia/packages/shared/src`): `hpkeCore()` e `importarReceptora(cruda: Uint8Array): Promise<CryptoKeyPair>` (`hpke-core.ts`; la pública del par sale de la privada); `envolverK(hpke, publica, incidente, rol, k): Promise<Uint8Array>` y `desenvolverK(hpke, receptor, incidente, rol, envoltura): Promise<Uint8Array>` (`envoltura.ts`); `b64u`, `deB64u` e `iguales` (`codificacion.ts`).
- Produce:
  - `<intercambio>`: una carpeta nueva dentro de la de salidas de H0a (junto a `<repo>`), que ya está excluida de todo proceso automático de memoria, resumen o indexado (ENV-01). Queda fuera de los repos y de la carpeta privada, y code-server la ve. Modo 700. `entrega/` es lo que Claude deja para el portátil (los APK con su `.sha256`, con `docker cp -L`); `telefono/` es lo que la persona responsable sube del teléfono, una carpeta `sesion-<n>/` por sesión; `resultados/` recibe lo que sacan las herramientas de la máquina (cifras y veredictos, nunca audio).
  - `<privada>/escucha/privada.b64u` (600, 44 bytes): la privada X25519 de la clave de escucha de pruebas, 32 bytes crudos en b64u (43 caracteres y un salto de línea). Solo entra redirigida a la entrada estándar (`< <privada>/escucha/privada.b64u`) de contenedores efímeros sin red, con `--log-driver none`, `--memory 2g --memory-swap 2g` y el volumen en solo lectura (contrato del banco, "Herramientas de la máquina"). En la máquina nunca se lee, se copia ni se imprime, y nunca pasa por `vigia-build`. Se destruye al cerrar F2 (DAT-01).
  - `<privada>/escucha/publica.b64u` (644) y `/work/h0b/escucha/publica.b64u` (644, del uid 1001): la pública, en el mismo formato y también de 44 bytes. No es secreta. La del volumen la lee `compilar.sh` para generar `Escucha.kt` (tarea 4).
  - `<privada>/h0b-entorno.md` (600): las rutas reales de `<banco>`, `<intercambio>` y `<privada>/escucha`, cómo se crea `vigia-build` desde H0b, la nota de DAT-01 y la decisión sobre los procesos con root.

- [ ] **Paso 1: crear la carpeta de intercambio y la de la clave**

`<intercambio>` va dentro de la carpeta de salidas de H0a, que ya está excluida de todo proceso automático de memoria, resumen o indexado (ENV-01): code-server la ve (la persona responsable baja y sube archivos con su explorador) y no está dentro de ningún repo ni de la carpeta privada. La clave de escucha no va en `<intercambio>`, por donde se navega en cada sesión, sino en `<privada>/escucha/`. Las rutas reales van a `h0b-entorno.md` en el paso 5, nunca al repo.

El 700 de las carpetas y el 600 de la privada solo frenan a usuarios sin privilegios: los procesos con root en la máquina pueden leerlas. Es el riesgo que declara la cabecera y que decide la persona responsable; el paso 5 anota su decisión en `h0b-entorno.md`.

📍 Máquina de trabajo.

Ejecutar:

```sh
(umask 077 && mkdir -p <intercambio>/entrega <intercambio>/telefono <intercambio>/resultados <privada>/escucha) && chmod 700 <intercambio> <intercambio>/entrega <intercambio>/telefono <intercambio>/resultados <privada>/escucha && stat -c '%a %n' <intercambio> <intercambio>/* <privada>/escucha
```

Esperado: cinco líneas con `700`: `<intercambio>`, `entrega`, `resultados`, `telefono` y `<privada>/escucha`.

- [ ] **Paso 2: generar la privada en un contenedor efímero sin red y comprobar que abre lo que sella su pública**

El par sale de WebCrypto de Node (X25519, exportado en JWK, cuyos `d` y `x` ya son b64u). Antes de soltar nada, el mismo proceso sella una `K` de prueba para la pública con `envolverK` (rol `escucha`, como hará el banco en el teléfono) y la abre con la privada. Solo sale la privada, por la salida estándar, directa a un archivo creado con `umask 077`; el guion no escribe nada (el volumen va en solo lectura) y la pública se deriva de la privada en el paso 3.

- `--log-driver none`: el daemon de Docker no guarda la salida del contenedor. Con el driver por defecto la dejaría también en un archivo de su registro, en el disco, aunque se redirija.
- `--memory 2g --memory-swap 2g`: la memoria del contenedor (también su `/tmp`) no puede ir al swap de la máquina.
- `set -C`: no se pisa un archivo que ya exista; una clave no se sustituye sin decidirlo. Los paréntesis dejan `umask` y `set -C` solo para esta orden.

📍 Máquina de trabajo.

Ejecutar:

```sh
(umask 077 && set -C && generar=$(cat <<'EOF'
// Clave de escucha de pruebas (H0b, tarea 3): par X25519 con WebCrypto de Node, en un contenedor sin red.
// Solo sale la privada, 32 bytes en b64u, por la salida estándar; la pública se deriva de ella después (paso 3).
// Antes de soltarla comprueba con hpke-core de shared que la privada abre una envoltura de K sellada
// para su pública con el rol escucha, la misma que hace el banco en el teléfono. No escribe nada.
const shared = process.env.SHARED ?? '/work/vigia/packages/shared/src';
const { hpkeCore, importarReceptora } = await import(`${shared}/hpke-core.ts`);
const { desenvolverK, envolverK } = await import(`${shared}/envoltura.ts`);
const { b64u, deB64u, iguales } = await import(`${shared}/codificacion.ts`);

const par = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
const publica = deB64u(jwk.x); // deB64u solo acepta b64u canónico
if (deB64u(jwk.d).length !== 32 || publica.length !== 32) throw new Error('X25519 que no mide 32 bytes');

const k = crypto.getRandomValues(new Uint8Array(32));
const incidente = b64u(crypto.getRandomValues(new Uint8Array(16)));
const envoltura = await envolverK(hpkeCore(), publica, incidente, 'escucha', k);
const receptora = await importarReceptora(deB64u(jwk.d));
const abierta = await desenvolverK(hpkeCore(), receptora, incidente, 'escucha', envoltura);
if (envoltura.length !== 80 || !iguales(abierta, k)) throw new Error('la privada no abre lo que sella su pública');

console.error('bien: la privada abre una envoltura de K de 80 bytes sellada para su pública');
process.stdout.write(`${jwk.d}\n`);
EOF
) && docker run --rm --init --network none --log-driver none --memory 2g --memory-swap 2g --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g vigia-build:h0b node --input-type=module -e "$generar" > <privada>/escucha/privada.b64u)
```

Esperado: una sola línea en pantalla (va por la salida de error), `bien: la privada abre una envoltura de K de 80 bytes sellada para su pública`, y nada más: la privada no se ve.

Si sale otra cosa:
- `file exists` (zsh) o `cannot overwrite existing file` (bash): ya había una privada. No se pisa: parar y preguntar a la persona responsable.
- `la privada no abre lo que sella su pública` u otro error de Node o de Docker: el archivo de la privada se creó vacío antes de que fallara la orden. Comprobar que mide 0 (`stat -c %s <privada>/escucha/privada.b64u`), borrarlo (`rm <privada>/escucha/privada.b64u`) y avisar.

- [ ] **Paso 3: derivar la pública, llevarla al volumen y comprobar los dos archivos sin leer la privada**

Otro contenedor igual que el del paso 2 recibe la privada por la entrada estándar y escribe su pública (con `importarReceptora` de shared) por la salida estándar, directa a `<privada>/escucha/publica.b64u` con `umask 022`. Se niega si la privada no son 43 caracteres b64u canónicos y un salto de línea. Si todo va bien, la pública entra al volumen por la entrada estándar de `vigia-build`: así la escribe el uid 1001, con 644, y `set -C` no deja pisar una anterior. Con `docker cp` entraría como root y pisaría la anterior sin avisar.

📍 Máquina de trabajo.

Ejecutar:

```sh
(umask 022 && set -C && derivar=$(cat <<'EOF'
// Pública de la clave de escucha de pruebas (H0b, tarea 3): la privada llega por la entrada estándar y su pública
// X25519 sale por la salida estándar, 32 bytes en b64u y un salto de línea. Sale de la privada con importarReceptora
// de shared (X25519 con el punto base, sin exportar la privada). Nunca imprime la privada.
import { readFileSync } from 'node:fs';

const shared = process.env.SHARED ?? '/work/vigia/packages/shared/src';
const { importarReceptora } = await import(`${shared}/hpke-core.ts`);
const { b64u, deB64u } = await import(`${shared}/codificacion.ts`);

const texto = readFileSync(0, 'utf8');
if (!/^[A-Za-z0-9_-]{43}\n$/.test(texto)) throw new Error('la privada no son 43 caracteres b64u y un salto de línea');
const receptora = await importarReceptora(deB64u(texto.slice(0, 43))); // deB64u solo acepta b64u canónico
const publica = new Uint8Array(await crypto.subtle.exportKey('raw', receptora.publicKey));
if (publica.length !== 32) throw new Error('pública que no mide 32 bytes');
process.stdout.write(`${b64u(publica)}\n`);
EOF
) && docker run --rm -i --init --network none --log-driver none --memory 2g --memory-swap 2g --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g vigia-build:h0b node --input-type=module -e "$derivar" < <privada>/escucha/privada.b64u > <privada>/escucha/publica.b64u) && docker exec -i vigia-build sh -c 'mkdir -p /work/h0b/escucha && umask 022 && set -C && cat > /work/h0b/escucha/publica.b64u' < <privada>/escucha/publica.b64u
stat -c '%a %s %n' <privada>/escucha/privada.b64u <privada>/escucha/publica.b64u
docker exec vigia-build stat -c '%a %u %s %n' /work/h0b/escucha/publica.b64u
grep -cE '^[A-Za-z0-9_-]{43}$' <privada>/escucha/publica.b64u
docker exec vigia-build sha256sum /work/h0b/escucha/publica.b64u; sha256sum <privada>/escucha/publica.b64u
```

Esperado: la primera orden no imprime nada; después, `600 44 <privada>/escucha/privada.b64u` y `644 44 <privada>/escucha/publica.b64u`; `644 1001 44 /work/h0b/escucha/publica.b64u`; `1`; y la misma suma SHA-256 dos veces (va a `h0b-entorno.md`). La privada no se abre nunca en el editor de code-server, que guarda historial local de lo que se edita.

Si sale otra cosa:
- `file exists` (zsh) o `cannot overwrite existing file` (bash): ya había una pública en `<privada>/escucha`. No se pisa: parar y preguntar a la persona responsable.
- `cannot create /work/h0b/escucha/publica.b64u: File exists`: el volumen ya tenía una pública, quizá de otra clave. No se ha pisado: parar igual.
- `la privada no son 43 caracteres b64u y un salto de línea`, `b64u no válido` u otro error de Node o de Docker: nada ha entrado al volumen, y `<privada>/escucha/publica.b64u` se creó vacío. Comprobar que mide 0 (`stat -c %s <privada>/escucha/publica.b64u`), borrarlo y avisar.

- [ ] **Paso 4: comprobación independiente con la privada guardada**

Ahora con los archivos: la privada entra por la entrada estándar a otro contenedor efímero igual (sin red, con `--log-driver none`, sin swap y con el volumen en solo lectura). La pública se lee del volumen, que es la que usará `compilar.sh`, y se comprueba también que otra privada no abre. Solo imprime veredictos.

📍 Máquina de trabajo.

Ejecutar:

```sh
comprobar=$(cat <<'EOF'
// Comprueba la clave de escucha guardada (H0b, tarea 3): la privada llega por la entrada estándar y la
// pública se lee de $PUBLICA. La privada abre lo que se sella para la pública y otra privada no lo abre.
// Imprime solo veredictos, nunca la privada.
import { readFileSync } from 'node:fs';

const shared = process.env.SHARED ?? '/work/vigia/packages/shared/src';
const ruta = process.env.PUBLICA ?? '/work/h0b/escucha/publica.b64u';
const { hpkeCore, importarReceptora } = await import(`${shared}/hpke-core.ts`);
const { desenvolverK, envolverK } = await import(`${shared}/envoltura.ts`);
const { b64u, deB64u, iguales } = await import(`${shared}/codificacion.ts`);

const privada = deB64u(readFileSync(0, 'utf8').trim());
const publica = deB64u(readFileSync(ruta, 'utf8').trim());
if (privada.length !== 32 || publica.length !== 32) throw new Error('clave que no mide 32 bytes');

const k = crypto.getRandomValues(new Uint8Array(32));
const incidente = b64u(crypto.getRandomValues(new Uint8Array(16)));
const envoltura = await envolverK(hpkeCore(), publica, incidente, 'escucha', k);
const abierta = await desenvolverK(hpkeCore(), await importarReceptora(privada), incidente, 'escucha', envoltura).catch(() => undefined);
const abre = abierta !== undefined && iguales(abierta, k);
console.log(abre ? 'bien: la privada guardada abre lo que se sella para la pública' : 'MAL: la privada guardada no abre');

const otra = crypto.getRandomValues(new Uint8Array(32));
const otraAbre = await desenvolverK(hpkeCore(), await importarReceptora(otra), incidente, 'escucha', envoltura).then(() => true, () => false);
console.log(otraAbre ? 'MAL: otra privada también abre' : 'bien: otra privada no abre');
process.exitCode = abre && !otraAbre ? 0 : 1;
EOF
) && docker run --rm -i --init --network none --log-driver none --memory 2g --memory-swap 2g --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g vigia-build:h0b node --input-type=module -e "$comprobar" < <privada>/escucha/privada.b64u; echo "salida: $?"
```

Esperado:

```
bien: la privada guardada abre lo que se sella para la pública
bien: otra privada no abre
salida: 0
```

Con `MAL: la privada guardada no abre` y `salida: 1`, el archivo de la privada no es el par de la pública: destruir las tres copias (`shred -u <privada>/escucha/privada.b64u <privada>/escucha/publica.b64u` y `docker exec vigia-build rm /work/h0b/escucha/publica.b64u`) y repetir desde el paso 2.

- [ ] **Paso 5: escribir `h0b-entorno.md` en la carpeta privada**

Crear el archivo vacío con modo 600 (📍 máquina de trabajo):

```sh
install -m 600 /dev/null <privada>/h0b-entorno.md
```

Claude escribe en él este contenido (Write o Edit, que conservan el modo), con los valores reales en lugar de lo que va entre `<ruta real…>`, `<fecha>`, `<suma…>` y `<decisión…>`: la ruta del banco sale de `h0a-entorno.md`; las de la carpeta de intercambio y la de la clave, del paso 1; la suma, del paso 3; la decisión sobre los procesos con root, de la persona responsable (paso 1). Esos valores no se escriben en el plan, ni en un commit, ni en la salida de una orden.

```markdown
# H0b: entorno de la máquina (privado)

Junto a `h0a-entorno.md`, en la carpeta privada del proyecto (`<privada>`). Modo 600. Nunca entra en un repo ni se abre en el editor de code-server.

## Rutas

- `<repo>`: la de `h0a-entorno.md`.
- `<banco>`: <ruta real del banco> (repo local del pico, sin remoto).
- `<intercambio>`: <ruta real de la carpeta de intercambio> (700), dentro de la carpeta de salidas de H0a, que ya está excluida de todo proceso automático de memoria, resumen o indexado (ENV-01). Con `entrega/` (lo que Claude deja para el portátil), `telefono/` (lo que sube la persona responsable, una carpeta `sesion-<n>/` por sesión) y `resultados/` (cifras y veredictos de las herramientas de la máquina, nunca audio).
- `<privada>/escucha`: <ruta real de la carpeta de la clave> (700), con la clave de escucha de pruebas.

## Entorno de build desde H0b

`vigia-build` se crea con la orden de "Crear el entorno" de `h0a-entorno.md` con cuatro cambios: la imagen `vigia-build:h0b`, `--init`, `-e GRADLE_USER_HOME=/work/.gradle` y `-e npm_config_cache=/work/.npm` (tarea 2 del plan de H0b).

## Clave de escucha de pruebas (DAT-01)

- Creada el <fecha> (tarea 3 del plan de H0b), con WebCrypto de Node en un contenedor efímero sin red.
- Pública, no secreta: `<privada>/escucha/publica.b64u` (644) y `/work/h0b/escucha/publica.b64u` (644, del uid 1001), con SHA-256 <suma de publica.b64u>. Entra al APK del banco como `Escucha.kt`.
- Privada: solo en `<privada>/escucha/privada.b64u` (600). Solo entra redirigida a la entrada estándar de contenedores efímeros sin red, con `--log-driver none`, `--memory 2g --memory-swap 2g` y el volumen en solo lectura. En la máquina nunca se lee, se copia ni se imprime, y nunca pasa por `vigia-build` ni por un repo.
- El 700 y el 600 solo frenan a usuarios sin privilegios: los procesos con root en la máquina pueden leer la privada y lo que hay en `<intercambio>`. Decisión de la persona responsable (cabecera del plan de H0b): <decisión sobre los procesos con root, con su fecha>.
- Al cerrar F2 se destruye (DAT-01) con `shred -u <privada>/escucha/privada.b64u`, y se anota aquí la fecha. Desde entonces, el audio de prueba cifrado para ella no se puede abrir.
```

📍 Máquina de trabajo.

Ejecutar:

```sh
stat -c '%a %n' <privada>/h0b-entorno.md; grep -cE '<ruta real|<fecha>|<suma de|<decisión' <privada>/h0b-entorno.md
```

Esperado: `600 <privada>/h0b-entorno.md` y `0` (no queda ningún hueco sin rellenar).

- [ ] **Paso 6: verificación final**

📍 Máquina de trabajo.

Ejecutar:

```sh
stat -c '%a %n' <intercambio> <intercambio>/* <privada>/escucha <privada>/escucha/* <privada>/h0b-entorno.md
docker exec vigia-build stat -c '%a %u %n' /work/h0b/escucha/publica.b64u
git -C <repo> status --short; git -C <banco> status --short
```

Esperado: `700` en `<intercambio>`, en sus tres carpetas y en `<privada>/escucha`; `600` en `privada.b64u`, `644` en `publica.b64u` y `600` en `h0b-entorno.md`; `644 1001 /work/h0b/escucha/publica.b64u`; ni el repo ni el banco muestran cambios (`git status` no imprime nada).

**Notas:**

- **Nota:** validado el 14-oct-2026 con claves desechables que solo vivieron en el tmpfs de contenedores efímeros sin red y sin swap. Los tres guiones de los pasos 2 a 4, en un contenedor de la imagen de H0a (la de la tarea 2 solo le añade iproute2) con `--log-driver none`, `--memory 2g --memory-swap 2g` (`memory.swap.max` = 0) y el volumen en solo lectura: la privada sale con 600 y 44 bytes; la pública, con 644 y 44 bytes, igual a la que da `node:crypto` desde la misma privada; la comprobación da `bien` dos veces y `salida: 0`. Una privada con un carácter del medio cambiado da `MAL: la privada guardada no abre` y `salida: 1`; el paso 3 rechaza una privada corta, sin salto de línea, con un espacio de más o no canónica (salida 1, sin escribir nada), y ningún error imprime la privada. Las órdenes de los pasos 1 a 6, tal cual salvo las rutas, dan las salidas de arriba en bash y en zsh en la máquina (solo cambia el mensaje de `set -C`): las carpetas, en una copia; la pública del volumen, en otra; y la privada, servida por una FIFO desde un contenedor como esos cuando un paso la lee, así que nunca tocó el disco (el paso 2 la mandó a `/dev/null`). Repetir el paso 2 o el 3 sin borrar nada falla sin pisar ni escribir nada, y si la pública solo está en el volumen, `vigia-build` responde `File exists` y no la pisa.
- **Nota:** la privada pasa por la memoria de procesos que importan código del volumen (shared y `@hpke/core` de `/work/vigia`), igual que en las herramientas de la máquina del contrato. Esos procesos no tienen red, así que no pueden sacarla; con el volumen en solo lectura tampoco pueden dejarla en él, donde la leería `vigia-build`, que sí tiene red. Con `--log-driver none`, lo que impriman no queda en el registro de Docker, y sin swap su memoria no llega al disco. Lo que queda es el riesgo de los procesos con root de la máquina (paso 1).

---

### Tarea 4: Andamio del banco para H0b

**Archivos (banco, `<banco>`):**
- Modificar: `.gitignore`, `compilar.sh`, `app/package.json` (los dos scripts que reescribe `expo prebuild`), `app/App.tsx`, `app/modules/banco/index.ts`, `app/modules/banco/expo-module.config.json` y `app/modules/banco/android/build.gradle`.
- Crear:
  - `app/pruebas/comun.ts` e `Info.tsx` (completos) y `P2.tsx`, `P3.tsx` y `P5.tsx` (mínimos: los sustituyen las tareas 8, 6 y 9);
  - `app/modules/banco/android/src/main/AndroidManifest.xml`;
  - en `app/modules/banco/android/src/main/java/expo/modules/banco/`: `Resultados.kt`, `Llaves.kt` y `BancoInfoModule.kt` (completos); `BancoP2Module.kt`, `BancoP3Module.kt`, `BancoP5Module.kt` y `ServicioGrabacion.kt` (mínimos: los sustituyen las tareas 8, 6, 9 y 6);
  - `jvm/settings.gradle.kts`, `jvm/build.gradle.kts`, `jvm/puro/src/test/kotlin/vigia/banco/AndamioTest.kt`, `jvm/simulado/build.gradle.kts`, `jvm/simulado/src/main/kotlin/vigia/banco/simulado/Main.kt`, `jvm/arnes/build.gradle.kts` y `jvm/arnes/src/main/kotlin/vigia/banco/arnes/Main.kt`.
- Copiar del núcleo del repo (`packages/nucleo/`): de la etiqueta `f2-h1`, `jvm/gradlew`, `jvm/gradle/wrapper/gradle-wrapper.jar` y `jvm/gradle/wrapper/gradle-wrapper.properties`; de `main`, `jvm/gradle/verification-metadata.xml` (el que completó la tarea 2).
- Borrar: `app/modules/banco/android/src/main/java/expo/modules/banco/BancoModule.kt` (el `hola()` de H0a).
- Generados en cada build e ignorados por git: `app/vigia-shared/`, `app/modules/banco/android/libs/`, `app/modules/banco/android/src/main/assets/` y `app/modules/banco/android/src/main/java/expo/modules/banco/Escucha.kt`.
- Fuera del banco: `/work/f2-h1` (copia de la etiqueta con `nucleo.jar` y las dependencias de pnpm), `/work/h0b/limpio` (clon limpio) y `/work/h0b/salida/apk/` (APK, fichas y tamaños).

**Interfaces:**
- Consume:
  - Tarea 2: `vigia-build:h0b` con `GRADLE_USER_HOME=/work/.gradle`; `/work/.gradle` llena y la caché de pnpm del HOME, que deja su paso 7 (sin la de pnpm, `pnpm install --offline` falla con `ERR_PNPM_NO_OFFLINE_META`); y `packages/nucleo/gradle/verification-metadata.xml` completo en `main` (paso 6).
  - Tarea 3: `/work/h0b/escucha/publica.b64u`.
  - H1, etiqueta `f2-h1`: el núcleo (`vigia.nucleo`: `Firmante`, `Der`, `Codificacion`, `Adts`…) y `packages/shared/src`.
  - H0a: el banco (app Expo 57.0.26 con React Native 0.86.3 y op-sqlite 18.2.5, paquete `dev.banco.prueba`, firmada con la clave de depuración pública de la plantilla).
- Produce (lo usan las tareas 5 a 15):
  - `/work/f2-h1`: el árbol de la etiqueta, con `packages/nucleo/build/libs/nucleo.jar` (SHA-256 `188cec81ba0e2ce481e80a0fa3548c6c2d09acf1a7056e1841d75a8cbbc376d9`, el mismo que construyó H1: Gradle 9 hace archivos reproducibles) y `node_modules` de pnpm, para que las herramientas de Node importen `/work/f2-h1/packages/shared/src/*.ts` (incluido `hpke-core.ts`).
  - `compilar.sh`, dentro de `vigia-build` y desde un clon del banco. Entradas, por variables de entorno con su valor por defecto: `F2H1=/work/f2-h1`, `ESCUCHA=/work/h0b/escucha/publica.b64u`, `PAQUETE450=/work/h0b/p5/paquete450` (si existe, se copia a los assets del módulo como `paquete450/…`) y `SALIDA=/work/h0b/salida/apk`. Salida: `$SALIDA/sin-r8/` y `$SALIDA/con-r8/`, cada una con `app-<abi>-release.apk` y `app-<abi>-release.ficha.txt` para `arm64-v8a`, `armeabi-v7a` y `x86_64`, y `tamaños.txt` (`<bytes> <apk>`); y `$SALIDA/compilacion.txt` (versionName, sumas de `nucleo.jar` y `bcprov`, pública de escucha y si lleva `paquete450`). versionName: el commit corto del banco, con `-sucio` si el árbol tiene cambios sin commit. Se niega a compilar si `nucleo.jar` o `bcprov` no tienen su SHA-256, o si la pública no son 32 bytes en b64u canónico.
  - Kotlin, paquete `expo.modules.banco` (compilado con `nucleo.jar`, `bcprov-jdk18on-1.86.jar` y las fuentes de `jvm/puro/src/main/kotlin`):
    - `object Resultados { const val ETIQUETA = "BANCO"; const val ARCHIVO = "resultados.jsonl"; fun guardar(contexto: Context, prueba: String, json: String) }`: añade `{"prueba":…,"hora":<ms>,"datos":<json>}` en una línea a `getExternalFilesDir(null)/resultados.jsonl` y escribe en logcat (`Log.i("BANCO", …)`) esa línea, recortada a 2 900 caracteres con ` [recortado: <n> caracteres]` si es más larga. Lanza si `json` no es JSON o no hay carpeta externa. Es `@Synchronized`.
    - `class FirmanteKeystore : vigia.nucleo.Firmante` con `val alias: String`, `override val spki: ByteArray` (SPKI P-256 de 91 bytes), `val nivel: String` (`strongbox`, `tee` o `software` en API 31+; `hardware` o `software` antes), `ultimaDer: ByteArray` (de solo lectura: la firma DER de la última llamada, tal como la dio el Keystore) y `override fun firmar(mensaje: ByteArray): ByteArray` (SHA256withECDSA en el Keystore y `Der.aP1363`).
    - `object Llaves`: `fun firmanteKeystore(alias: String, strongBox: Boolean): FirmanteKeystore` (par EC P-256 nuevo en el Keystore bajo `alias`, que sustituye al que hubiera; con `strongBox` y sin StrongBox lanza, en Android 9+ con `StrongBoxUnavailableException`); `fun envolver(alias: String, datos: ByteArray): ByteArray` (AES-256-GCM con la clave del Keystore `alias`, que crea si falta; devuelve iv de 12 bytes, generado por el Keystore, ‖ cifrado ‖ etiqueta de 16) y `fun desenvolver(alias: String, envuelto: ByteArray): ByteArray` (lanza si la clave no existe o si el envuelto no es suyo). Ninguna clave pide autenticación ni el teléfono desbloqueado.
    - `object Escucha { const val PUBLICA_B64U: String; fun publica(): ByteArray }`, generado por `compilar.sh`.
    - Módulos (nombre en JS entre paréntesis): `BancoInfoModule` (`BancoInfo`), completo: `AsyncFunction("info")`, que devuelve y guarda (prueba `info`) el JSON `{"fabricante","modelo","android","sdk","abis","ram_bytes","strongbox","webview","chrome","samsung_browser","mi_browser","telegram","commit","modo_avion"}` (cada app, `{"paquete","version"}` o `null`), y `Function("guardar") { prueba: String, json: String -> }`. `BancoP2Module` (`BancoP2`), `BancoP3Module` (`BancoP3`) y `BancoP5Module` (`BancoP5`), mínimos, con las firmas del contrato: lo que devuelve texto devuelve `{"pendiente":true}`; lo que devuelve bytes, los de ese texto; `verificarP256`, `false`.
    - `ServicioGrabacion`: servicio declarado en el manifiesto del módulo (`exported=false`, `foregroundServiceType="microphone|dataSync"`); por ahora se para en cuanto arranca.
  - Manifiesto del módulo: `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `FOREGROUND_SERVICE_DATA_SYNC`, `POST_NOTIFICATIONS` y `WAKE_LOCK`, el servicio y `<queries>` para las versiones de Chrome, Samsung Browser, Mi Browser y Telegram.
  - JS: `app/modules/banco/index.ts` exporta `BancoInfo`, `BancoP2`, `BancoP3` y `BancoP5` y sus tipos `ModuloInfo`, `ModuloP2`, `ModuloP3` y `ModuloP5`; `app/pruebas/comun.ts` exporta `medir<T>(f: () => T | Promise<T>): Promise<{ valor: T; ms: number }>`, `guardar(prueba: string, datos: unknown): string`, `legible(texto: string): string`, `mensaje(e: unknown): string`, `useEjecucion(): { texto: string; ocupado: boolean; ejecutar: (prueba: () => Promise<string>) => Promise<void> }` y `estilos`; cada pantalla (`Info`, `P2`, `P3`, `P5`) es el `export default` sin props de su archivo, y `App.tsx` las importa así.
  - `jvm/`: proyectos `:puro` (paquete `vigia.banco`), `:simulado` (`vigia.banco.simulado`, con `application` y `puro`) y `:arnes` (`vigia.banco.arnes`, con `application`). Todos con Kotlin JVM 2.1.20, JDK 17, `nucleo.jar` de `$F2H1` (por defecto `/work/f2-h1`), `bcprov-jdk18on` 1.86 y JUnit 6.1.3, comprobados con el `verification-metadata.xml` del núcleo de `main`. `./gradlew test` en `jvm/`.

- [ ] **Paso 1: la copia de la etiqueta `f2-h1` en `/work/f2-h1`, con `nucleo.jar` y las dependencias de pnpm**

⚠️ La primera orden borra `/work/f2-h1` si existe: es una copia que se rehace entera desde la etiqueta.

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'rm -rf /work/f2-h1 && mkdir -p /work/f2-h1'
git -C <repo> archive f2-h1 | docker exec -i vigia-build tar -x -C /work/f2-h1
docker exec vigia-build sh -c 'cd /work/f2-h1/packages/nucleo && ./gradlew --no-daemon check jar && sha256sum build/libs/nucleo.jar'
docker exec vigia-build sh -c 'cd /work/f2-h1 && pnpm install --frozen-lockfile --offline'
```

Esperado: `BUILD SUCCESSFUL` (`check` pasa animal-sniffer y las 107 pruebas del núcleo) y `188cec81ba0e2ce481e80a0fa3548c6c2d09acf1a7056e1841d75a8cbbc376d9  build/libs/nucleo.jar`; después, `Lockfile is up to date, resolution step is skipped`, `Packages: +86` y `Done in …`, sin ningún `ERR_PNPM_`. pnpm avisa antes de que no usa el almacén del HOME y usa `/work/.pnpm-store/v11` (normal: es el de H1).

Si `nucleo.jar` da otra suma, parar: no es el núcleo de `f2-h1`. Si Gradle da `Dependency verification failed`, `/work/.gradle` está vacía: la copia lleva el `verification-metadata.xml` de la etiqueta, sin las cuatro sumas de la tarea 2, así que primero se repite el paso 7 de la tarea 2 y después este. Si pnpm da `ERR_PNPM_NO_OFFLINE_META`, falta su caché del mismo paso: repetir esa instalación (`docker exec vigia-build sh -c 'sincronizar vigia && cd /work/vigia && pnpm install --frozen-lockfile'`) y volver a esta.

- [ ] **Paso 2: el wrapper de Gradle de `f2-h1` y la verificación del núcleo de `main`, para `jvm/`**

📍 Máquina de trabajo.

Ejecutar:

```sh
mkdir -p <banco>/jvm/gradle/wrapper
git -C <repo> show f2-h1:packages/nucleo/gradlew > <banco>/jvm/gradlew && chmod 755 <banco>/jvm/gradlew
git -C <repo> show f2-h1:packages/nucleo/gradle/wrapper/gradle-wrapper.jar > <banco>/jvm/gradle/wrapper/gradle-wrapper.jar
git -C <repo> show f2-h1:packages/nucleo/gradle/wrapper/gradle-wrapper.properties > <banco>/jvm/gradle/wrapper/gradle-wrapper.properties
git -C <repo> show main:packages/nucleo/gradle/verification-metadata.xml > <banco>/jvm/gradle/verification-metadata.xml
cd <banco>/jvm && sha256sum gradlew gradle/wrapper/gradle-wrapper.jar gradle/wrapper/gradle-wrapper.properties gradle/verification-metadata.xml
```

Esperado:

```
fb68debc1b1acf8ec55dc0d5e5495e1dedd0bd6b61f304bee61613eeb2bd9b92  gradlew
b3a875ddc1f044746e1b1a55f645584505f4a10438c1afea9f15e92a7c42ec13  gradle/wrapper/gradle-wrapper.jar
137a45811ade89eb5d35fc3df0441aa891a69c55ae65780f23303e5acaf597f7  gradle/wrapper/gradle-wrapper.properties
20b4c851e4c4e09a6375d14b5beb0146318f6ad6f593578e227583a90aacff24  gradle/verification-metadata.xml
```

El jar es el wrapper oficial de Gradle 9.3.1 que comprobó H1, y `gradle-wrapper.properties` fija la distribución con `distributionSha256Sum`. Lo que pide `jvm/` (el plugin de Kotlin 2.1.20, la biblioteca de Kotlin, JUnit 6.1.3 y bcprov 1.86) es un subconjunto de lo que verifica el `verification-metadata.xml` del núcleo, componente a componente y suma a suma, así que se copia tal cual; tiene que ser el de `main`, con las cuatro sumas de la tarea 2: con el de `f2-h1`, `jvm/` falla con la caché vacía (`kotlinx-coroutines-bom-1.8.0.pom`). Si una tarea añade una dependencia a `jvm/`, regenera el archivo partiendo de una caché vacía (`GRADLE_USER_HOME` en una carpeta nueva y `./gradlew --write-verification-metadata sha256 test`) y revisa lo que añade.

- [ ] **Paso 3: escribir el proyecto JVM**

Tres proyectos: `puro` (el cortador ADTS de la tarea 5, que también entra al APK), `simulado` (el teléfono simulado de la tarea 7) y `arnes` (P7, tarea 11). La configuración común está en la raíz; cada proyecto es de su tarea. La única prueba del andamio comprueba que `nucleo.jar` está en el classpath.

`<banco>/jvm/settings.gradle.kts`:

```kotlin
pluginManagement {
    repositories { mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositories { mavenCentral() }
}
rootProject.name = "banco-jvm"
// puro: el cortador ADTS (tarea 5), que también entra al APK; simulado: el teléfono simulado (tarea 7);
// arnes: el arnés de P7 (tarea 11).
include("puro", "simulado", "arnes")
```

`<banco>/jvm/build.gradle.kts`:

```kotlin
// Proyecto JVM del banco (H0b), con Kotlin, JUnit y BouncyCastle como el núcleo de H1. El núcleo llega como
// nucleo.jar de la copia de la etiqueta f2-h1 ($F2H1, por defecto /work/f2-h1), igual que en el APK.
plugins {
    kotlin("jvm") version "2.1.20" apply false
}

val nucleo = file(providers.environmentVariable("F2H1").getOrElse("/work/f2-h1") + "/packages/nucleo/build/libs/nucleo.jar")
check(nucleo.isFile) { "Falta $nucleo: construye antes nucleo.jar en la copia de f2-h1 (tarea 4)" }

subprojects {
    apply(plugin = "org.jetbrains.kotlin.jvm")

    extensions.configure<org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension> { jvmToolchain(17) }

    dependencies {
        "implementation"(files(nucleo))
        "implementation"("org.bouncycastle:bcprov-jdk18on:1.86")
        "testImplementation"("org.junit.jupiter:junit-jupiter:6.1.3")
        "testRuntimeOnly"("org.junit.platform:junit-platform-launcher:6.1.3")
    }

    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
        jvmArgs("-Dfile.encoding=UTF-8")
    }
}
```

`<banco>/jvm/puro/src/test/kotlin/vigia/banco/AndamioTest.kt`:

```kotlin
package vigia.banco

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import vigia.nucleo.Adts
import vigia.nucleo.Codificacion

class AndamioTest {
    @Test
    fun `el nucleo de f2-h1 esta en el classpath`() {
        // Cabecera ADTS de una trama sin datos: AAC-LC, 16 kHz y mono (contrato de H1, sección 17).
        assertEquals("fff1604000fffc", Codificacion.hex(Adts.cabecera(0)))
    }
}
```

`<banco>/jvm/simulado/build.gradle.kts`:

```kotlin
// Teléfono simulado (tarea 7): escribe la misma carpeta de grabación que el teléfono, con el cortador de puro.
plugins {
    application
}

dependencies {
    implementation(project(":puro"))
}

application {
    mainClass.set("vigia.banco.simulado.MainKt")
}
```

`<banco>/jvm/simulado/src/main/kotlin/vigia/banco/simulado/Main.kt`:

```kotlin
package vigia.banco.simulado

/** Teléfono simulado de P3 y P4. Implementación mínima del andamio: la tarea 7 la sustituye. */
fun main() {
    println("simulado: pendiente (tarea 7)")
}
```

`<banco>/jvm/arnes/build.gradle.kts`:

```kotlin
// Arnés de P7 (tarea 11): la cola real del núcleo contra el Worker, con la red degradada por netem.
plugins {
    application
}

application {
    mainClass.set("vigia.banco.arnes.MainKt")
}
```

`<banco>/jvm/arnes/src/main/kotlin/vigia/banco/arnes/Main.kt`:

```kotlin
package vigia.banco.arnes

/** Arnés de P7. Implementación mínima del andamio: la tarea 11 la sustituye. */
fun main() {
    println("arnes: pendiente (tarea 11)")
}
```

- [ ] **Paso 4: ejecutar las pruebas de `jvm/` y ver que sabe fallar**

`sincronizar banco` copia el árbol de trabajo del banco (sin lo que ignora git) a `/work/banco`. Primero, con `F2H1` apuntando a un sitio sin núcleo.

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && F2H1=/no-existe ./gradlew --no-daemon test'
```

Esperado: `Falta /no-existe/packages/nucleo/build/libs/nucleo.jar: construye antes nucleo.jar en la copia de f2-h1 (tarea 4)` y `BUILD FAILED`.

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon test && grep -ho "tests=\"[0-9]*\" skipped=\"0\" failures=\"0\" errors=\"0\"" puro/build/test-results/test/*.xml | awk -F"\"" "{n++; t+=\$2} END {print n \" clases, \" t \" pruebas, sin fallos\"}"'
```

Esperado: `BUILD SUCCESSFUL` y `1 clases, 1 pruebas, sin fallos`. Gradle avisa de `Deprecated Gradle features were used in this build`: viene del plugin de Kotlin 2.1.20 (`java-api-jars`), igual que en el núcleo de H1.

- [ ] **Paso 5: el módulo Kotlin**

Todo lo que necesita la app va en el módulo, porque `expo prebuild --clean` regenera `app/android` en cada build. Cuatro módulos Expo en un mismo módulo local: `BancoInfo` es de esta tarea; `BancoP2`, `BancoP3` y `BancoP5` dejan ya las firmas del contrato con una respuesta mínima, y cada tarea sustituye su archivo entero.

Borrar el módulo de H0a (📍 máquina de trabajo):

```sh
git -C <banco> rm -q app/modules/banco/android/src/main/java/expo/modules/banco/BancoModule.kt
```

`<banco>/app/modules/banco/expo-module.config.json`:

```json
{
  "platforms": ["android"],
  "android": {
    "modules": [
      "expo.modules.banco.BancoInfoModule",
      "expo.modules.banco.BancoP2Module",
      "expo.modules.banco.BancoP3Module",
      "expo.modules.banco.BancoP5Module"
    ]
  }
}
```

`<banco>/app/modules/banco/android/build.gradle`:

```gradle
plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'expo.modules.banco'
version = '0.1.0'

android {
  namespace "expo.modules.banco"
  defaultConfig {
    versionCode 1
    versionName "0.1.0"
  }
  // El código de jvm/puro (el cortador ADTS de la tarea 5) entra al APK tal cual se prueba en la JVM.
  sourceSets {
    main.java.srcDir '../../../../jvm/puro/src/main/kotlin'
  }
}

dependencies {
  // El núcleo de la etiqueta f2-h1 y BouncyCastle 1.86: los copia compilar.sh a libs/ con su SHA-256 comprobado.
  implementation files('libs/nucleo.jar', 'libs/bcprov-jdk18on-1.86.jar')
}
```

`<banco>/app/modules/banco/android/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Permisos y servicio del banco. Van en el módulo porque prebuild regenera app/android en cada build. -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- P3 y P4: grabar con la pantalla apagada en un servicio en primer plano y vaciar la cola tras Detener. -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- BancoInfo lee la versión de estas apps si están instaladas (visibilidad de paquetes desde Android 11). -->
    <queries>
        <package android:name="com.android.chrome" />
        <package android:name="com.sec.android.app.sbrowser" />
        <package android:name="com.mi.globalbrowser" />
        <package android:name="com.android.browser" />
        <package android:name="org.telegram.messenger" />
        <package android:name="org.telegram.messenger.web" />
    </queries>

    <application>
        <service
            android:name="expo.modules.banco.ServicioGrabacion"
            android:exported="false"
            android:foregroundServiceType="microphone|dataSync" />
    </application>
</manifest>
```

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/Resultados.kt`:

```kotlin
package expo.modules.banco

import android.content.Context
import android.util.Log
import org.json.JSONObject
import org.json.JSONTokener
import java.io.File

/**
 * Salida común de las pruebas: una línea JSON por resultado en resultados.jsonl de la carpeta externa de la app
 * (la que saca `adb pull` sin run-as) y un resumen en logcat con la etiqueta BANCO (el plan B si no hay pull).
 */
object Resultados {
  const val ETIQUETA = "BANCO"
  const val ARCHIVO = "resultados.jsonl"
  private const val MAX_LOGCAT = 2_900 // logcat corta hacia los 4 000 bytes por línea

  /** Añade {"prueba":…,"hora":<ms>,"datos":<json>} en una línea y lo resume en logcat. Lanza si `json` no es JSON. */
  @Synchronized
  fun guardar(contexto: Context, prueba: String, json: String) {
    val datos = JSONTokener(json).nextValue()
    val linea = JSONObject().put("prueba", prueba).put("hora", System.currentTimeMillis()).put("datos", datos).toString()
    Log.i(ETIQUETA, if (linea.length <= MAX_LOGCAT) linea else "${linea.take(MAX_LOGCAT)} [recortado: ${linea.length} caracteres]")
    val carpeta = contexto.getExternalFilesDir(null) ?: throw IllegalStateException("sin carpeta externa")
    File(carpeta, ARCHIVO).appendText(linea + "\n")
  }
}
```

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/Llaves.kt`:

```kotlin
package expo.modules.banco

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import vigia.nucleo.Der
import vigia.nucleo.Firmante
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Firmante del contrato de H1 (vigia.nucleo.Firmante) con un par EC P-256 cuya privada nunca sale del Keystore. */
class FirmanteKeystore internal constructor(
  val alias: String,
  private val privada: PrivateKey,
  override val spki: ByteArray,
  /** Dónde vive la clave: strongbox, tee o software (API 31+); hardware o software antes de Android 12. */
  val nivel: String,
) : Firmante {
  /** La firma DER de la última llamada a firmar, tal como la dio el Keystore. */
  @Volatile
  var ultimaDer: ByteArray = ByteArray(0)
    private set

  override fun firmar(mensaje: ByteArray): ByteArray {
    val der = Signature.getInstance("SHA256withECDSA").run {
      initSign(privada)
      update(mensaje)
      sign()
    }
    ultimaDer = der
    return Der.aP1363(der)
  }
}

/**
 * Claves del Keystore de Android para el banco. Ninguna pide autenticación ni el teléfono desbloqueado: se graba
 * con la pantalla bloqueada, y setUnlockedDeviceRequired falla en Android 12 a 14.
 */
object Llaves {
  private const val PROVEEDOR = "AndroidKeyStore"
  private const val AES_GCM = "AES/GCM/NoPadding"

  /** Genera un par EC P-256 nuevo bajo `alias` (sustituye el que hubiera). Con `strongBox` y sin StrongBox, lanza. */
  fun firmanteKeystore(alias: String, strongBox: Boolean): FirmanteKeystore {
    val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
      .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
      .setDigests(KeyProperties.DIGEST_SHA256)
    if (strongBox) {
      if (Build.VERSION.SDK_INT < 28) throw UnsupportedOperationException("StrongBox necesita Android 9")
      spec.setIsStrongBoxBacked(true)
    }
    val par = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, PROVEEDOR).run {
      initialize(spec.build())
      generateKeyPair()
    }
    val info = KeyFactory.getInstance(KeyProperties.KEY_ALGORITHM_EC, PROVEEDOR).getKeySpec(par.private, KeyInfo::class.java)
    return FirmanteKeystore(alias, par.private, par.public.encoded, nivel(info))
  }

  /** AES-256-GCM con la clave del Keystore `alias` (la crea si falta): iv (12 bytes, del Keystore) ‖ cifrado ‖ etiqueta. */
  fun envolver(alias: String, datos: ByteArray): ByteArray {
    val cifrador = Cipher.getInstance(AES_GCM).apply { init(Cipher.ENCRYPT_MODE, claveAes(alias)) }
    val iv = cifrador.iv
    check(iv.size == 12) { "IV de ${iv.size} bytes" }
    return iv + cifrador.doFinal(datos)
  }

  /** Lo contrario de envolver. Lanza si la clave no existe o si el envuelto no es suyo o está cambiado. */
  fun desenvolver(alias: String, envuelto: ByteArray): ByteArray {
    require(envuelto.size >= 12 + 16) { "envuelto de ${envuelto.size} bytes" }
    val clave = almacen().getKey(alias, null) as? SecretKey ?: throw IllegalStateException("no hay clave $alias")
    return Cipher.getInstance(AES_GCM).run {
      init(Cipher.DECRYPT_MODE, clave, GCMParameterSpec(128, envuelto, 0, 12))
      doFinal(envuelto, 12, envuelto.size - 12)
    }
  }

  // getSecurityLevel es de la API 31; antes solo se sabe si está en hardware seguro.
  private fun nivel(info: KeyInfo): String =
    if (Build.VERSION.SDK_INT >= 31) {
      when (info.securityLevel) {
        KeyProperties.SECURITY_LEVEL_STRONGBOX -> "strongbox"
        KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT -> "tee"
        KeyProperties.SECURITY_LEVEL_SOFTWARE -> "software"
        else -> "desconocido"
      }
    } else {
      @Suppress("DEPRECATION")
      if (info.isInsideSecureHardware) "hardware" else "software"
    }

  private fun almacen(): KeyStore = KeyStore.getInstance(PROVEEDOR).apply { load(null) }

  private fun claveAes(alias: String): SecretKey {
    (almacen().getKey(alias, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVEEDOR).run {
      init(
        KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
          .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
          .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
          .setKeySize(256)
          .build(),
      )
      generateKey()
    }
  }
}
```

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/BancoInfoModule.kt`:

```kotlin
package expo.modules.banco

import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.webkit.WebView
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

/**
 * BancoInfo: datos del teléfono para el informe y guardado de lo que mide JS. No lee ningún identificador del
 * aparato ni de cuentas (ni número de serie, ni IMEI, ni ANDROID_ID).
 */
class BancoInfoModule : Module() {
  private val contexto: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BancoInfo")

    AsyncFunction("info") {
      val json = info(contexto).toString()
      Resultados.guardar(contexto, "info", json)
      json
    }

    Function("guardar") { prueba: String, json: String ->
      Resultados.guardar(contexto, prueba, json)
    }
  }

  private fun info(c: Context): JSONObject {
    val pm = c.packageManager
    val memoria = ActivityManager.MemoryInfo()
    (c.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memoria)
    return JSONObject()
      .put("fabricante", Build.MANUFACTURER)
      .put("modelo", Build.MODEL)
      .put("android", Build.VERSION.RELEASE)
      .put("sdk", Build.VERSION.SDK_INT)
      .put("abis", JSONArray(Build.SUPPORTED_ABIS.toList()))
      .put("ram_bytes", memoria.totalMem)
      .put("strongbox", pm.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE))
      .put("webview", webView())
      .put("chrome", app(pm, "com.android.chrome"))
      .put("samsung_browser", app(pm, "com.sec.android.app.sbrowser"))
      .put("mi_browser", app(pm, "com.mi.globalbrowser", "com.android.browser"))
      .put("telegram", app(pm, "org.telegram.messenger", "org.telegram.messenger.web"))
      .put("commit", paquete(pm, c.packageName)?.versionName ?: JSONObject.NULL)
      .put("modo_avion", Settings.Global.getInt(c.contentResolver, Settings.Global.AIRPLANE_MODE_ON, 0) == 1)
  }

  /** El primer paquete instalado de la lista, con su versión, o null. */
  private fun app(pm: PackageManager, vararg paquetes: String): Any {
    for (nombre in paquetes) {
      val p = paquete(pm, nombre) ?: continue
      return JSONObject().put("paquete", nombre).put("version", p.versionName ?: JSONObject.NULL)
    }
    return JSONObject.NULL
  }

  /** El WebView que usa el sistema (API 26+). */
  private fun webView(): Any {
    if (Build.VERSION.SDK_INT < 26) return JSONObject.NULL
    val p = WebView.getCurrentWebViewPackage() ?: return JSONObject.NULL
    return JSONObject().put("paquete", p.packageName).put("version", p.versionName ?: JSONObject.NULL)
  }

  @Suppress("DEPRECATION")
  private fun paquete(pm: PackageManager, nombre: String) =
    try {
      pm.getPackageInfo(nombre, 0)
    } catch (e: PackageManager.NameNotFoundException) {
      null
    }
}
```

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/BancoP2Module.kt`:

```kotlin
package expo.modules.banco

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PENDIENTE = """{"pendiente":true}"""

/** BancoP2 (P2): implementación mínima del andamio con las firmas del contrato. La tarea 8 la sustituye entera. */
class BancoP2Module : Module() {
  override fun definition() = ModuleDefinition {
    Name("BancoP2")

    AsyncFunction("claveVault") { PENDIENTE }

    AsyncFunction("cabecera") { ruta: String -> PENDIENTE }

    AsyncFunction("colaArchivos") { PENDIENTE }
  }
}
```

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/BancoP3Module.kt`:

```kotlin
package expo.modules.banco

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PENDIENTE = """{"pendiente":true}"""

/** BancoP3 (P3 y P4 sin subida): implementación mínima del andamio con las firmas del contrato. La tarea 6 la sustituye. */
class BancoP3Module : Module() {
  override fun definition() = ModuleDefinition {
    Name("BancoP3")

    AsyncFunction("codificadores") { PENDIENTE }

    AsyncFunction("iniciar") { fuente: String, segundosFragmento: Int, latidos: Boolean -> PENDIENTE }

    AsyncFunction("estado") { PENDIENTE }

    AsyncFunction("detener") { PENDIENTE }

    AsyncFunction("arranques") { n: Int -> PENDIENTE }
  }
}
```

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/BancoP5Module.kt`:

```kotlin
package expo.modules.banco

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PENDIENTE = """{"pendiente":true}"""

/**
 * BancoP5 (P5): implementación mínima del andamio con las firmas del contrato. La tarea 9 la sustituye entera.
 * Lo que devuelve bytes devuelve los de {"pendiente":true}, y verificarP256 devuelve false.
 */
class BancoP5Module : Module() {
  override fun definition() = ModuleDefinition {
    Name("BancoP5")

    AsyncFunction("llaves") { PENDIENTE }

    AsyncFunction("sellado") { PENDIENTE }

    AsyncFunction("costeKotlin") { conK: Boolean -> PENDIENTE }

    AsyncFunction("leerAsset") { nombre: String -> PENDIENTE.toByteArray() }

    // Las primitivas del Cripto de shared en Kotlin, síncronas.
    Function("sha256") { datos: ByteArray -> PENDIENTE.toByteArray() }

    Function("hmacSha256") { clave: ByteArray, datos: ByteArray -> PENDIENTE.toByteArray() }

    Function("hkdfSha256") { ikm: ByteArray, sal: ByteArray, info: ByteArray, n: Int -> PENDIENTE.toByteArray() }

    Function("verificarP256") { spki: ByteArray, mensaje: ByteArray, firma: ByteArray -> false }

    Function("descifrarAesGcm") { k: ByteArray, nonce: ByteArray, aad: ByteArray, cifrado: ByteArray -> PENDIENTE.toByteArray() }
  }
}
```

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/ServicioGrabacion.kt`:

```kotlin
package expo.modules.banco

import android.app.Service
import android.content.Intent
import android.os.IBinder

/**
 * Servicio en primer plano de P3 y P4 (tipos microphone y dataSync, sin exportar, declarado en el manifiesto del
 * módulo). Implementación mínima del andamio: se para en cuanto arranca. La tarea 6 la sustituye.
 */
class ServicioGrabacion : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    stopSelf(startId)
    return START_NOT_STICKY
  }
}
```

- [ ] **Paso 6: el JS de la app**

`<banco>/app/modules/banco/index.ts`:

```ts
import { requireNativeModule } from 'expo';

// Los cuatro módulos Kotlin del banco (paquete expo.modules.banco). Las funciones asíncronas devuelven una cadena
// JSON, que Kotlin guarda también con Resultados.guardar; claveVault y cabecera devuelven texto.

/** BancoInfo (tarea 4): datos del teléfono y guardado de lo que mide JS. */
export type ModuloInfo = {
  info(): Promise<string>;
  guardar(prueba: string, json: string): void;
};

/** BancoP2 (tarea 8): FTS5, vault.db con SQLCipher y dónde guarda la cola los sobres. */
export type ModuloP2 = {
  /** "x'<64 hex>'": 32 bytes aleatorios envueltos con una clave AES-GCM del Keystore (alias banco-vault). */
  claveVault(): Promise<string>;
  /** Hex de los 16 primeros bytes del archivo. */
  cabecera(ruta: string): Promise<string>;
  colaArchivos(): Promise<string>;
};

/** BancoP3 (tarea 6): P3 y P4 sin subida. */
export type ModuloP3 = {
  codificadores(): Promise<string>;
  iniciar(fuente: string, segundosFragmento: number, latidos: boolean): Promise<string>;
  estado(): Promise<string>;
  detener(): Promise<string>;
  arranques(n: number): Promise<string>;
};

/** BancoP5 (tarea 9): Keystore, sellado HPKE y las primitivas del Cripto en Kotlin (síncronas). */
export type ModuloP5 = {
  llaves(): Promise<string>;
  sellado(): Promise<string>;
  costeKotlin(conK: boolean): Promise<string>;
  leerAsset(nombre: string): Promise<Uint8Array>;
  sha256(datos: Uint8Array): Uint8Array;
  hmacSha256(clave: Uint8Array, datos: Uint8Array): Uint8Array;
  hkdfSha256(ikm: Uint8Array, sal: Uint8Array, info: Uint8Array, n: number): Uint8Array;
  verificarP256(spki: Uint8Array, mensaje: Uint8Array, firma: Uint8Array): boolean;
  descifrarAesGcm(k: Uint8Array, nonce: Uint8Array, aad: Uint8Array, cifrado: Uint8Array): Uint8Array;
};

export const BancoInfo = requireNativeModule<ModuloInfo>('BancoInfo');
export const BancoP2 = requireNativeModule<ModuloP2>('BancoP2');
export const BancoP3 = requireNativeModule<ModuloP3>('BancoP3');
export const BancoP5 = requireNativeModule<ModuloP5>('BancoP5');
```

`<banco>/app/pruebas/comun.ts`:

```ts
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { BancoInfo } from '../modules/banco';

/** Ejecuta f y devuelve su valor y lo que tardó, en ms, con el reloj monotónico de JS. */
export async function medir<T>(f: () => T | Promise<T>): Promise<{ valor: T; ms: number }> {
  const inicio = performance.now();
  const valor = await f();
  return { valor, ms: performance.now() - inicio };
}

/** Guarda lo que mide JS igual que Kotlin: una línea en resultados.jsonl y un resumen en logcat. Devuelve el JSON. */
export function guardar(prueba: string, datos: unknown): string {
  const json = JSON.stringify(datos);
  BancoInfo.guardar(prueba, json);
  return json;
}

/** Un JSON con sangría para la pantalla; si no es JSON, el texto tal cual. */
export function legible(texto: string): string {
  try {
    return JSON.stringify(JSON.parse(texto), null, 2);
  } catch {
    return texto;
  }
}

/** El mensaje de un error, para la pantalla. */
export function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Estado de una pantalla que lanza pruebas: el texto del último resultado y si hay una en marcha. */
export function useEjecucion() {
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ejecutar = useCallback(async (prueba: () => Promise<string>) => {
    setOcupado(true);
    setTexto('En marcha...');
    try {
      setTexto(legible(await prueba()));
    } catch (e) {
      setTexto(`Error: ${mensaje(e)}`);
    } finally {
      setOcupado(false);
    }
  }, []);
  return { texto, ocupado, ejecutar };
}

export const estilos = StyleSheet.create({
  raiz: { flex: 1, paddingTop: 48, backgroundColor: '#ffffff' },
  pantalla: { padding: 16, paddingBottom: 48, backgroundColor: '#ffffff' },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  destacado: { fontSize: 20, marginBottom: 4 },
  boton: { marginVertical: 6 },
  resultado: { fontFamily: 'monospace', fontSize: 12, marginTop: 12 },
});
```

`<banco>/app/pruebas/Info.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Button, ScrollView, Text } from 'react-native';
import { BancoInfo } from '../modules/banco';
import { estilos, legible, mensaje } from './comun';

type Datos = {
  fabricante: string;
  modelo: string;
  android: string;
  sdk: number;
  abis: string[];
  ram_bytes: number;
  strongbox: boolean;
  commit: string | null;
  modo_avion: boolean;
};

/** Información del teléfono (BancoInfo.info, que la guarda también): lo principal en grande, para las capturas. */
export default function Info() {
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  const leer = () => {
    setError('');
    BancoInfo.info().then(setJson, (e: unknown) => setError(mensaje(e)));
  };
  useEffect(leer, []);
  const d = json === '' ? undefined : (JSON.parse(json) as Datos);
  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text style={estilos.titulo}>Información del teléfono</Text>
      {d !== undefined && (
        <>
          <Text style={estilos.destacado}>
            {d.fabricante} {d.modelo}
          </Text>
          <Text style={estilos.destacado}>
            Android {d.android} (SDK {d.sdk})
          </Text>
          <Text style={estilos.destacado}>ABI: {d.abis.join(', ')}</Text>
          <Text style={estilos.destacado}>RAM: {(d.ram_bytes / 2 ** 30).toFixed(1)} GiB</Text>
          <Text style={estilos.destacado}>StrongBox: {d.strongbox ? 'sí' : 'no'}</Text>
          <Text style={estilos.destacado}>Modo avión: {d.modo_avion ? 'sí' : 'no'}</Text>
          <Text style={estilos.destacado}>Banco: {d.commit}</Text>
        </>
      )}
      {error !== '' && <Text style={estilos.destacado}>Error: {error}</Text>}
      <Button title="Leer otra vez" onPress={leer} />
      <Text style={estilos.resultado}>{legible(json)}</Text>
    </ScrollView>
  );
}
```

`<banco>/app/pruebas/P2.tsx`:

```tsx
import { Button, ScrollView, Text } from 'react-native';
import { BancoP2 } from '../modules/banco';
import { estilos, useEjecucion } from './comun';

/** P2: FTS5, vault.db con SQLCipher y dónde guarda la cola los sobres. Pantalla mínima del andamio (la escribe la tarea 8). */
export default function P2() {
  const { texto, ocupado, ejecutar } = useEjecucion();
  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text style={estilos.titulo}>P2</Text>
      <Text>Pendiente: la escribe la tarea 8.</Text>
      <Button title="Probar el módulo" disabled={ocupado} onPress={() => ejecutar(() => BancoP2.colaArchivos())} />
      <Text style={estilos.resultado}>{texto}</Text>
    </ScrollView>
  );
}
```

`<banco>/app/pruebas/P3.tsx`:

```tsx
import { Button, ScrollView, Text } from 'react-native';
import { BancoP3 } from '../modules/banco';
import { estilos, useEjecucion } from './comun';

/** P3 y P4 sin subida: grabación, servicio en primer plano y latidos. Pantalla mínima del andamio (la escribe la tarea 6). */
export default function P3() {
  const { texto, ocupado, ejecutar } = useEjecucion();
  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text style={estilos.titulo}>P3 y P4</Text>
      <Text>Pendiente: la escribe la tarea 6.</Text>
      <Button title="Probar el módulo" disabled={ocupado} onPress={() => ejecutar(() => BancoP3.estado())} />
      <Text style={estilos.resultado}>{texto}</Text>
    </ScrollView>
  );
}
```

`<banco>/app/pruebas/P5.tsx`:

```tsx
import { Button, ScrollView, Text } from 'react-native';
import { BancoP5 } from '../modules/banco';
import { estilos, useEjecucion } from './comun';

/** P5: Keystore, sellado HPKE y verificador. Pantalla mínima del andamio (la escribe la tarea 9). */
export default function P5() {
  const { texto, ocupado, ejecutar } = useEjecucion();
  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text style={estilos.titulo}>P5</Text>
      <Text>Pendiente: la escribe la tarea 9.</Text>
      <Button title="Probar el módulo" disabled={ocupado} onPress={() => ejecutar(() => BancoP5.llaves())} />
      <Text style={estilos.resultado}>{texto}</Text>
    </ScrollView>
  );
}
```

`<banco>/app/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { BackHandler, Button, ScrollView, Text, View } from 'react-native';
import Info from './pruebas/Info';
import P2 from './pruebas/P2';
import P3 from './pruebas/P3';
import P5 from './pruebas/P5';
import { estilos } from './pruebas/comun';

// Una sección por prueba. El menú es de la tarea 4; cada pantalla, de la tarea de su prueba.
const SECCIONES = [
  { id: 'info', titulo: 'Información del teléfono', Pantalla: Info },
  { id: 'p2', titulo: 'P2: FTS5, vault.db y cola', Pantalla: P2 },
  { id: 'p3', titulo: 'P3 y P4: grabación y servicio', Pantalla: P3 },
  { id: 'p5', titulo: 'P5: Keystore, sellado y verificador', Pantalla: P5 },
];

export default function App() {
  const [actual, setActual] = useState<string | null>(null);

  // El botón Atrás de Android vuelve al menú en lugar de cerrar la app.
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      if (actual === null) return false;
      setActual(null);
      return true;
    });
    return () => suscripcion.remove();
  }, [actual]);

  const seccion = SECCIONES.find((s) => s.id === actual);
  if (seccion !== undefined) {
    const { Pantalla } = seccion;
    return (
      <View style={estilos.raiz}>
        <Button title="Volver al menú" onPress={() => setActual(null)} />
        <Pantalla />
      </View>
    );
  }
  return (
    <View style={estilos.raiz}>
      <ScrollView contentContainerStyle={estilos.pantalla}>
        <Text style={estilos.titulo}>Banco de pruebas</Text>
        {SECCIONES.map((s) => (
          <View key={s.id} style={estilos.boton}>
            <Button title={s.titulo} onPress={() => setActual(s.id)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
```

`<banco>/app/package.json`: cambian solo los scripts `android` e `ios`, que `expo prebuild` reescribe en cada build (`expo start --android` y `expo start --ios` pasan a `expo run:android` y `expo run:ios`); así el clon limpio no queda sucio. `package-lock.json` no cambia: los scripts no van en el lockfile.

```json
{
  "name": "banco",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    "@op-engineering/op-sqlite": "18.2.5",
    "expo": "57.0.26",
    "react": "19.2.3",
    "react-native": "0.86.3"
  },
  "devDependencies": {
    "@types/react": "~19.2.2",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web"
  },
  "private": true,
  "op-sqlite": {
    "sqlcipher": true,
    "fts5": true
  }
}
```

- [ ] **Paso 7: `.gitignore` y `compilar.sh`**

`<banco>/.gitignore` (las líneas de H0a y, debajo, lo que genera cada build):

```gitignore
node_modules/
/app/android/
/app/ios/
*.apk
/p5/test-vectors.json
/p5/*.jar
/p5/vector.txt
/p5/cruce-*.txt
/p5/firma-java.txt
/p6/muestra.aac
/p6/resultado-*.json
test-results/
# H0b: lo que generan Gradle, Kotlin y compilar.sh en cada build (el clon limpio no queda sucio)
build/
.gradle/
.kotlin/
/app/vigia-shared/
/app/modules/banco/android/libs/
/app/modules/banco/android/src/main/assets/
/app/modules/banco/android/src/main/java/expo/modules/banco/Escucha.kt
```

`<banco>/compilar.sh` (sustituye al de P1; conserva el modo 755):

```sh
#!/bin/sh
# Banco de H0b: compila la app en release no depurable, sin R8 y con R8, un APK por ABI, y deja en
# $SALIDA/sin-r8 y $SALIDA/con-r8 cada APK con su ficha y los tamaños. Se ejecuta dentro de vigia-build,
# desde un clon del banco: las cifras del informe salen siempre de un clon limpio.
# Entradas, con su valor por defecto:
#   F2H1        copia de la etiqueta f2-h1, con nucleo.jar construido y las dependencias de pnpm (tarea 4)
#   ESCUCHA     pública de la clave de escucha de pruebas, 32 bytes en b64u (tarea 3)
#   PAQUETE450  recursos de P5 para los assets del módulo; si no existe, el APK va sin ellos (tarea 9)
#   SALIDA      carpeta de salida
set -eu
F2H1=${F2H1:-/work/f2-h1}
ESCUCHA=${ESCUCHA:-/work/h0b/escucha/publica.b64u}
PAQUETE450=${PAQUETE450:-/work/h0b/p5/paquete450}
SALIDA=${SALIDA:-/work/h0b/salida/apk}
# nucleo.jar de f2-h1 (./gradlew --no-daemon check jar da siempre los mismos bytes) y bcprov 1.86 (el de H0a).
NUCLEO_SHA256=188cec81ba0e2ce481e80a0fa3548c6c2d09acf1a7056e1841d75a8cbbc376d9
BCPROV_SHA256=2af190b300cbb0b35e248ccf5f4a06b6072030aeb3da7a98ec73abe5b4cb371f
BT=/opt/android-sdk/build-tools/36.0.0

banco=$(cd "$(dirname "$0")" && pwd)
modulo=$banco/app/modules/banco/android
fuentes=$modulo/src/main/java/expo/modules/banco

# versionName: el commit corto del banco, con -sucio si el árbol tiene cambios sin commit.
version=$(git -C "$banco" rev-parse --short HEAD)
[ -z "$(git -C "$banco" status --porcelain)" ] || version="$version-sucio"

# 1. El núcleo de f2-h1 y BouncyCastle, comprobados, a las libs del módulo. bcprov sale de la caché de
#    Gradle, donde lo deja (verificado con verification-metadata.xml) el build de nucleo.jar.
bcprov=$(find "${GRADLE_USER_HOME:-$HOME/.gradle}/caches/modules-2/files-2.1/org.bouncycastle/bcprov-jdk18on/1.86" -name bcprov-jdk18on-1.86.jar 2>/dev/null | head -n 1)
[ -n "$bcprov" ] || { echo "Falta bcprov-jdk18on-1.86.jar en la caché de Gradle: construye antes nucleo.jar en $F2H1" >&2; exit 1; }
mkdir -p "$modulo/libs"
cp "$F2H1/packages/nucleo/build/libs/nucleo.jar" "$modulo/libs/nucleo.jar"
cp "$bcprov" "$modulo/libs/bcprov-jdk18on-1.86.jar"
(cd "$modulo/libs" && printf '%s  nucleo.jar\n%s  bcprov-jdk18on-1.86.jar\n' "$NUCLEO_SHA256" "$BCPROV_SHA256" | sha256sum -c -)

# 2. shared de f2-h1 para el JS de la app (el verificador de P5), copiado en cada build.
rm -rf "$banco/app/vigia-shared"
cp -R "$F2H1/packages/shared/src" "$banco/app/vigia-shared"

# 3. Escucha.kt con la pública de la clave de escucha de pruebas: solo la pública entra al APK (DAT-01).
[ -f "$ESCUCHA" ] || { echo "Falta la pública de escucha: $ESCUCHA" >&2; exit 1; }
publica=$(tr -d '\n' < "$ESCUCHA")
python3 -I - "$publica" <<'EOF'
import base64, re, sys
t = sys.argv[1]
b = base64.urlsafe_b64decode(t + '=') if re.fullmatch('[A-Za-z0-9_-]{43}', t) else b''
if len(b) != 32 or base64.urlsafe_b64encode(b).decode().rstrip('=') != t:
    sys.exit('La pública de escucha no son 32 bytes en b64u canónico')
EOF
cat > "$fuentes/Escucha.kt" <<EOF
// Generado por compilar.sh desde la pública de la clave de escucha de pruebas: no se edita ni entra en git.
package expo.modules.banco

import vigia.nucleo.Codificacion

/** Pública X25519 (32 bytes crudos) de la clave de escucha de pruebas. Su privada nunca entra al APK (DAT-01). */
object Escucha {
    const val PUBLICA_B64U = "$publica"

    fun publica(): ByteArray = Codificacion.deB64u(PUBLICA_B64U)
}
EOF

# 4. Los recursos de P5, si existen, a los assets del módulo: leerAsset("paquete450/<archivo>").
assets=$modulo/src/main/assets
rm -rf "$assets"
if [ -d "$PAQUETE450" ]; then
    mkdir -p "$assets/paquete450"
    cp -R "$PAQUETE450/." "$assets/paquete450/"
    [ -z "$(find "$assets" ! -type f ! -type d)" ] || { echo "Los recursos de P5 solo pueden ser archivos y carpetas" >&2; exit 1; }
fi

# 5. Dependencias y proyecto Android: prebuild lo regenera entero en cada build.
cd "$banco/app"
npm ci
npx expo prebuild --platform android --clean --no-install
cat >> android/app/build.gradle <<EOF

// Banco H0b: un APK por ABI y el commit del banco como versionName
android {
    defaultConfig {
        versionName "$version"
    }
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86_64"
            universalApk false
        }
    }
}
EOF

# 6. Dos builds release no depurables, sin R8 y con R8 (y recorte de recursos), con una ficha por APK.
rm -rf "$SALIDA/sin-r8" "$SALIDA/con-r8"
mkdir -p "$SALIDA"
compilar() {
    destino=$SALIDA/$1
    shift
    rm -rf android/app/build/outputs/apk/release
    (cd android && ./gradlew --no-daemon assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86_64 "$@")
    mkdir -p "$destino"
    cp android/app/build/outputs/apk/release/*.apk "$destino/"
    (
        cd "$destino"
        for apk in *.apk; do
            {
                echo "## sha256sum"
                sha256sum "$apk"
                echo "## aapt2 dump badging"
                "$BT/aapt2" dump badging "$apk"
                echo "## aapt2 dump permissions"
                "$BT/aapt2" dump permissions "$apk"
                echo "## apksigner verify --verbose --print-certs"
                "$BT/apksigner" verify --verbose --print-certs "$apk"
            } > "${apk%.apk}.ficha.txt"
            echo "$(stat -c %s "$apk") $apk"
        done > tamaños.txt
    )
}
compilar sin-r8
compilar con-r8 -Pandroid.enableMinifyInReleaseBuilds=true -Pandroid.enableShrinkResourcesInReleaseBuilds=true
{
    echo "versionName: $version"
    echo "nucleo.jar: $NUCLEO_SHA256"
    echo "bcprov-jdk18on-1.86.jar: $BCPROV_SHA256"
    echo "pública de escucha: $publica"
    if [ -d "$assets" ]; then echo "paquete450: $(find "$assets" -type f | wc -l) archivos"; else echo "paquete450: no"; fi
} > "$SALIDA/compilacion.txt"
for variante in sin-r8 con-r8; do
    echo "== $variante"
    cat "$SALIDA/$variante/tamaños.txt"
done
```

`compilar.sh` copia `bcprov-jdk18on-1.86.jar` de la caché de Gradle, donde lo deja el build de `nucleo.jar` del paso 1, verificado con el `verification-metadata.xml` del núcleo, y lo vuelve a comprobar con su SHA-256. Las dos builds van seguidas sobre el mismo `app/android`: la segunda solo rehace lo que cambia con R8.

- [ ] **Paso 8: commit en el banco**

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit:

```sh
git -C <banco> add .gitignore compilar.sh app/package.json app/App.tsx app/pruebas/comun.ts app/pruebas/Info.tsx app/pruebas/P2.tsx app/pruebas/P3.tsx app/pruebas/P5.tsx app/modules/banco/index.ts app/modules/banco/expo-module.config.json app/modules/banco/android/build.gradle app/modules/banco/android/src/main/AndroidManifest.xml app/modules/banco/android/src/main/java/expo/modules/banco/Resultados.kt app/modules/banco/android/src/main/java/expo/modules/banco/Llaves.kt app/modules/banco/android/src/main/java/expo/modules/banco/BancoInfoModule.kt app/modules/banco/android/src/main/java/expo/modules/banco/BancoP2Module.kt app/modules/banco/android/src/main/java/expo/modules/banco/BancoP3Module.kt app/modules/banco/android/src/main/java/expo/modules/banco/BancoP5Module.kt app/modules/banco/android/src/main/java/expo/modules/banco/ServicioGrabacion.kt jvm/settings.gradle.kts jvm/build.gradle.kts jvm/gradlew jvm/gradle/wrapper/gradle-wrapper.jar jvm/gradle/wrapper/gradle-wrapper.properties jvm/gradle/verification-metadata.xml jvm/puro/src/test/kotlin/vigia/banco/AndamioTest.kt jvm/simulado/build.gradle.kts jvm/simulado/src/main/kotlin/vigia/banco/simulado/Main.kt jvm/arnes/build.gradle.kts jvm/arnes/src/main/kotlin/vigia/banco/arnes/Main.kt
git -C <banco> status --short | grep -c '^??'; git -C <banco> diff --cached --stat | tail -1
git -C <banco> commit -q -m "Andamio de H0b: núcleo y shared de f2-h1, compilar.sh con R8 y fichas, módulos comunes, menú y proyecto JVM

Etiqueta del repo: f2-h1 (nucleo.jar 188cec81ba0e2ce481e80a0fa3548c6c2d09acf1a7056e1841d75a8cbbc376d9). La verificación
de Gradle de jvm/ es la del núcleo en main, con las cuatro sumas que pide una caché vacía." && git -C <banco> log --oneline -1
```

Esperado: `0` (nada sin seguimiento), ` 32 files changed, 1593 insertions(+), 32 deletions(-)` y el commit con su hash corto, que es el versionName del paso 9.

- [ ] **Paso 9: compilar los dos APK desde un clon limpio**

La primera build en el contenedor de la tarea 2 baja otra vez a `/work` las cachés de Gradle y npm de la app (unos 3,4 GB), así que tarda bastante más (15 min o más, según la red); las siguientes, unos 6 min. Se lanza en segundo plano y se espera a la línea `salida:`.

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'rm -rf /work/h0b/limpio && git clone -q /fuente/banco /work/h0b/limpio && sh /work/h0b/limpio/compilar.sh > /work/h0b/compilar.log 2>&1; echo "salida: $?" >> /work/h0b/compilar.log'
docker exec vigia-build sh -c 'grep -E "^nucleo|^bcprov|BUILD|^==|^[0-9]+ app-|^salida" /work/h0b/compilar.log'
```

Esperado (los tamaños, de la validación del 14-oct; pueden variar unos cientos de bytes con el commit y la clave de escucha):

```
nucleo.jar: OK
bcprov-jdk18on-1.86.jar: OK
BUILD SUCCESSFUL in …
BUILD SUCCESSFUL in …
== sin-r8
35236284 app-arm64-v8a-release.apk
28354000 app-armeabi-v7a-release.apk
36009060 app-x86_64-release.apk
== con-r8
28025331 app-arm64-v8a-release.apk
21143047 app-armeabi-v7a-release.apk
28798107 app-x86_64-release.apk
salida: 0
```

Sin R8, el APK arm64 pesa unos 2,2 MB más que en P1 (33.002.634 bytes): es BouncyCastle entero, 5,6 MB de dex sin comprimir. Con R8 se queda en unos 28 MB, porque R8 quita lo que nadie usa todavía (los stubs no llaman al núcleo). Si falla, el error exacto está en `/work/h0b/compilar.log`.

- [ ] **Paso 10: comprobar las fichas, el clon limpio, las pruebas de `jvm/` y los tipos**

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec -i vigia-build sh -s <<'EOF'
salida=${SALIDA:-/work/h0b/salida/apk}
limpio=${LIMPIO:-/work/h0b/limpio}
commit=$(git -C "$limpio" rev-parse --short HEAD)
echo "cambios en el clon limpio tras compilar: $(git -C "$limpio" status --porcelain | wc -l)"
for f in "$salida"/sin-r8/*.ficha.txt "$salida"/con-r8/*.ficha.txt; do
    printf '%s/%s: ' "$(basename "$(dirname "$f")")" "$(basename "$f" .ficha.txt)"
    grep -q "versionName='$commit'" "$f" && printf 'versión %s' "$commit" || printf 'MAL: otra versión'
    grep -q application-debuggable "$f" && printf ', MAL: depurable' || printf ', no depurable'
    grep -q "^minSdkVersion:'24'" "$f" && grep -q "^targetSdkVersion:'36'" "$f" && printf ', SDK 24 a 36' || printf ', MAL: SDK'
    printf ', %s permisos de P3 y P4' "$(sed -n '/^## aapt2 dump permissions/,/^## apksigner/p' "$f" | grep -cE "'android.permission.(RECORD_AUDIO|FOREGROUND_SERVICE|FOREGROUND_SERVICE_MICROPHONE|FOREGROUND_SERVICE_DATA_SYNC|POST_NOTIFICATIONS|WAKE_LOCK)'")"
    grep -q 'Verified using v2 scheme (APK Signature Scheme v2): true' "$f" && grep -q 'certificate SHA-256 digest: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c' "$f" && printf ', firma v2 de la plantilla' || printf ', MAL: firma'
    printf ', %s\n' "$(grep -o "^native-code: '[^']*'" "$f")"
done
cat "$salida/compilacion.txt"
EOF
docker exec vigia-build sh -c 'cd /work/h0b/limpio/jvm && ./gradlew --no-daemon test -q; echo "jvm: $?"; cd /work/h0b/limpio/app && npx tsc --noEmit -p . --allowImportingTsExtensions; git -C /work/h0b/limpio status --porcelain | wc -l'
```

Esperado, con `<commit>` el del paso 8:

```
cambios en el clon limpio tras compilar: 0
sin-r8/app-arm64-v8a-release: versión <commit>, no depurable, SDK 24 a 36, 6 permisos de P3 y P4, firma v2 de la plantilla, native-code: 'arm64-v8a'
sin-r8/app-armeabi-v7a-release: versión <commit>, no depurable, SDK 24 a 36, 6 permisos de P3 y P4, firma v2 de la plantilla, native-code: 'armeabi-v7a'
sin-r8/app-x86_64-release: versión <commit>, no depurable, SDK 24 a 36, 6 permisos de P3 y P4, firma v2 de la plantilla, native-code: 'x86_64'
con-r8/app-arm64-v8a-release: versión <commit>, no depurable, SDK 24 a 36, 6 permisos de P3 y P4, firma v2 de la plantilla, native-code: 'arm64-v8a'
con-r8/app-armeabi-v7a-release: versión <commit>, no depurable, SDK 24 a 36, 6 permisos de P3 y P4, firma v2 de la plantilla, native-code: 'armeabi-v7a'
con-r8/app-x86_64-release: versión <commit>, no depurable, SDK 24 a 36, 6 permisos de P3 y P4, firma v2 de la plantilla, native-code: 'x86_64'
versionName: <commit>
nucleo.jar: 188cec81ba0e2ce481e80a0fa3548c6c2d09acf1a7056e1841d75a8cbbc376d9
bcprov-jdk18on-1.86.jar: 2af190b300cbb0b35e248ccf5f4a06b6072030aeb3da7a98ec73abe5b4cb371f
pública de escucha: <la de /work/h0b/escucha/publica.b64u>
paquete450: no
jvm: 0
vigia-shared/hpke-core.ts(3,75): error TS2307: Cannot find module '@hpke/core' or its corresponding type declarations.
0
```

El único error de tipos es el esperado: `hpke-core.ts` es de las herramientas de la máquina y la app no tiene `@hpke/core` (nadie lo importa en la app). El andamio (`App.tsx`, `pruebas/` y `modules/banco/index.ts`) no da ninguno. La firma es la de la plantilla (CN=Android Debug, solo v2): cualquiera puede firmar una actualización de `dev.banco.prueba`, por eso el banco se desinstala al cerrar H0b (DAT-01).

- [ ] **Paso 11: `compilar.sh` se niega con entradas malas**

En un clon aparte (`/tmp/neg`, que se borra al final), para no dejar un `nucleo.jar` falso en `/work/h0b/limpio`. Las tres fallan antes de `npm ci`, en segundos, y no tocan `$SALIDA`.

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'rm -rf /tmp/neg && git clone -q /fuente/banco /tmp/neg/banco && printf "%s\n" "$(cut -c1-42 /work/h0b/escucha/publica.b64u)_" > /tmp/neg/mala.b64u && mkdir -p /tmp/neg/f2h1/packages/nucleo/build/libs && echo otra-cosa > /tmp/neg/f2h1/packages/nucleo/build/libs/nucleo.jar; ESCUCHA=/tmp/neg/mala.b64u sh /tmp/neg/banco/compilar.sh; echo "salida: $?"; ESCUCHA=/tmp/neg/no-existe.b64u sh /tmp/neg/banco/compilar.sh; echo "salida: $?"; F2H1=/tmp/neg/f2h1 sh /tmp/neg/banco/compilar.sh; echo "salida: $?"; rm -rf /tmp/neg'
```

Esperado:

```
nucleo.jar: OK
bcprov-jdk18on-1.86.jar: OK
La pública de escucha no son 32 bytes en b64u canónico
salida: 1
nucleo.jar: OK
bcprov-jdk18on-1.86.jar: OK
Falta la pública de escucha: /tmp/neg/no-existe.b64u
salida: 1
nucleo.jar: FAILED
bcprov-jdk18on-1.86.jar: OK
sha256sum: WARNING: 1 computed checksum did NOT match
salida: 1
```

Los mensajes de error (`La pública…`, `Falta…` y el aviso de `sha256sum`) van por la salida de error y pueden salir un poco antes o después de las líneas que los rodean.

**Notas:**

- **Nota:** validado el 14-oct-2026 en `vigia-build` (todavía la imagen de H0a), en una copia del banco con `git init` y este andamio en un commit, clonada y compilada con `F2H1`, `ESCUCHA` (una pública desechable cuya privada no se guardó) y `SALIDA` de la copia: las dos builds en verde (3 min 6 s sin R8 y 1 min 7 s con R8, con las cachés llenas), las fichas como en el paso 10, el clon sin cambios, `jvm/` en verde con el `verification-metadata.xml` completo, también con una caché de Gradle vacía (en rojo con una suma de bcprov cambiada y, con la caché vacía, con el archivo de `f2-h1`), y las tres negativas del paso 11. Una segunda build del mismo commit dio los mismos tamaños pero otros bytes: el APK todavía no es reproducible (SUM-05 es para antes del piloto).
- **Nota:** comprobado aparte en la validación: con `PAQUETE450` apuntando a una carpeta con dos archivos, el APK lleva `assets/paquete450/a.txt` y `assets/paquete450/sub/b.bin` (también con R8); un `.kt` puesto en `jvm/puro/src/main/kotlin` entra en el dex del APK sin R8, y con un archivo sin commit el versionName sale con `-sucio`. Metro y hermesc aceptan `app/vigia-shared/index.ts` (18 módulos, 113 KB de bundle; hermesc avisa de que `crypto` e `Intl` no están declarados, que es lo que P5 tiene que resolver en Hermes).
- **Nota:** con R8, las clases del módulo salen renombradas (las reglas de expo-modules-core conservan las subclases de `Module` y su `definition()`; `ServicioGrabacion` se conserva por el manifiesto) y el núcleo y BouncyCastle desaparecen mientras nadie los use. Que el APK con R8 arranque en el teléfono no está comprobado hasta la sesión 1.
- **Nota:** `Resultados`, `Llaves` y `BancoInfo` solo se compilan aquí: necesitan Android (Keystore, carpeta externa, PackageManager) y se ejecutan por primera vez en la sesión 1. `app/package.json` conserva dos `~` de la plantilla de H0a (`@types/react` y `typescript`, fijados por el lockfile); quitarlos obliga a regenerar el lockfile y se deja como está.

---

### Tarea 5: Cortador ADTS incremental (TDD en la JVM)

**Archivos (banco, `<banco>`):**
- Crear: `jvm/puro/src/main/kotlin/vigia/banco/puro/CortadorAdts.kt` (entra también al APK: el módulo compila `jvm/puro/src/main/kotlin`, tarea 4).
- Prueba: `jvm/puro/src/test/kotlin/vigia/banco/puro/CortadorAdtsTest.kt`.

**Interfaces:**
- Consume:
  - Tarea 4: el proyecto `jvm/` (`:puro` con Kotlin 2.1.20, JDK 17, JUnit 6.1.3 y `nucleo.jar` de `$F2H1`, por defecto `/work/f2-h1`) y `./gradlew test`.
  - H1, `nucleo.jar` de `f2-h1` (contrato de H1, sección 17): `Adts.MUESTRAS_POR_TRAMA = 1024`, `Adts.cabecera(longitudPayload: Int, frecuencia: Int = 16_000, canales: Int = 1): ByteArray` (lanza `ErrorFormato` con una frecuencia fuera de la tabla, canales fuera de 1 a 6 o un payload de más de 8 184 bytes), `Adts.tramas(flujo: ByteArray): List<IntRange>` (lectura estricta), `Adts.cortar(flujo: ByteArray, muestrasObjetivo: Int): List<ByteArray>` (la referencia por lotes), `Codificacion.hex`, `Codificacion.deHex` y `class ErrorFormato`.
- Produce, para el grabador del teléfono (tarea 6) y el teléfono simulado (tarea 7):

```kotlin
package vigia.banco.puro

class CortadorAdts(muestrasObjetivo: Int, frecuencia: Int = 16_000, canales: Int = 1) {   // ErrorFormato con un objetivo de menos de 1 024 muestras o una frecuencia o unos canales que ADTS no admite
  class Fragmento(val indice: Int, val muestraInicial: Long, val muestras: Int, val adts: ByteArray)
  val configuracionEsperada: ByteArray        // AudioSpecificConfig de AAC-LC con esa frecuencia y esos canales: 14 08 a 16 kHz mono
  fun configuracion(csd: ByteArray)           // el búfer CODEC_CONFIG del códec; ErrorFormato si no es el esperado (solo o seguido de 56 e5 00)
  fun agregar(unidad: ByteArray): Fragmento?  // una unidad AAC cruda; devuelve el fragmento que cierra, o null
  fun terminar(): Fragmento?                  // lo que quede; después no admite más unidades
}
```

Reglas (contrato de H1, sección 17, y plan de H0b): MediaCodec entrega AAC crudo, una unidad por búfer y antes un búfer CODEC_CONFIG con el AudioSpecificConfig, que no va al flujo. El cortador comprueba ese búfer aparte (`configuracion`, antes de la primera unidad: `agregar` lanza `IllegalStateException` sin él): vale el AudioSpecificConfig esperado, solo o seguido de `56 e5 00` (la señal explícita de que no hay SBR, que sigue siendo AAC-LC y que ffmpeg 6.1.1 escribe en MP4); cualquier otro lanza `ErrorFormato`. Después antepone a cada unidad `Adts.cabecera(len)`, cuenta 1 024 muestras por unidad desde el inicio de la grabación y cierra el fragmento k en la unidad con la que las muestras alcanzan k × `muestrasObjetivo`, sin deriva: los mismos cortes que `Adts.cortar` sobre el flujo entero. `terminar()` vacía lo que quede, más corto. Cada fragmento lleva su índice (1, 2…), su primera muestra (contada desde el inicio: la hora del fragmento es la de la primera lectura más `muestraInicial / frecuencia`) y su número de muestras. Una unidad vacía o que no cabe en una trama lanza `ErrorFormato` sin tocar lo pendiente. La frecuencia y los canales son parámetros por el plan B de P3 (24 o 44,1 kHz). La prueba de propiedad compara con `Adts.cortar` 40 grabaciones por objetivo (2, 4 y 8 s a 16 kHz), de 0 a 699 unidades de 1 a 1 199 bytes al azar, con semillas fijas.

- [ ] **Paso 1: escribir la prueba que falla**

`<banco>/jvm/puro/src/test/kotlin/vigia/banco/puro/CortadorAdtsTest.kt`:

```kotlin
package vigia.banco.puro

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import vigia.nucleo.Adts
import vigia.nucleo.Codificacion
import vigia.nucleo.ErrorFormato
import java.io.ByteArrayOutputStream
import kotlin.random.Random

class CortadorAdtsTest {
    // AudioSpecificConfig de AAC-LC a 16 kHz mono: el búfer CODEC_CONFIG de c2.android.aac.encoder y de ffmpeg 6.1.1.
    private val csd = Codificacion.deHex("1408")

    private fun nuevo(objetivo: Int) = CortadorAdts(objetivo).also { it.configuracion(csd) }

    // Unidades AAC sintéticas de largo y contenido distintos, como las del AdtsTest del núcleo.
    private fun unidades(n: Int) = List(n) { i -> ByteArray(50 + (i * 37) % 300) { (i + it).toByte() } }

    private fun cortar(cortador: CortadorAdts, unidades: List<ByteArray>) =
        unidades.mapNotNull { cortador.agregar(it) } + listOfNotNull(cortador.terminar())

    private fun flujo(unidades: List<ByteArray>) = ByteArrayOutputStream().also { s ->
        for (u in unidades) {
            s.write(Adts.cabecera(u.size))
            s.write(u)
        }
    }.toByteArray()

    private fun tramas(fragmentos: List<CortadorAdts.Fragmento>) = fragmentos.map { Adts.tramas(it.adts).size }

    @Test
    fun `cada unidad lleva la cabecera ADTS de AAC-LC a 16 kHz mono`() {
        assertEquals("1408", Codificacion.hex(CortadorAdts(64_000).configuracionEsperada))
        val unidad = ByteArray(4) { 7 }
        val fragmento = nuevo(1_024).agregar(unidad)!!
        assertEquals("fff16040017ffc07070707", Codificacion.hex(fragmento.adts))
    }

    @Test
    fun `125 unidades con 64 000 muestras dan 63 y 62, con su indice, su muestra inicial y sus muestras`() {
        val fragmentos = cortar(nuevo(64_000), unidades(125))
        assertEquals(listOf(63, 62), tramas(fragmentos))
        assertEquals(listOf(1, 2), fragmentos.map { it.indice })
        assertEquals(listOf(0L, 64_512L), fragmentos.map { it.muestraInicial })
        assertEquals(listOf(64_512, 63_488), fragmentos.map { it.muestras })
    }

    @Test
    fun `sin deriva, las muestras se cuentan desde el inicio de la grabacion`() {
        // Si la cuenta empezara de cero en cada fragmento saldrían 63, 63, 63 y 61.
        val fragmentos = cortar(nuevo(64_000), unidades(250))
        assertEquals(listOf(63, 62, 63, 62), tramas(fragmentos))
        assertEquals(listOf(0L, 64_512L, 128_000L, 192_512L), fragmentos.map { it.muestraInicial })
    }

    @Test
    fun `agregar devuelve el fragmento en la unidad que lo cierra`() {
        val cortador = nuevo(64_000)
        val lista = unidades(64)
        for (i in 0 until 62) assertNull(cortador.agregar(lista[i]), "unidad ${i + 1}")
        assertEquals(63, Adts.tramas(cortador.agregar(lista[62])!!.adts).size)
        assertNull(cortador.agregar(lista[63]))
    }

    @Test
    fun `terminar vacia lo que queda y despues no admite mas unidades`() {
        val cortador = nuevo(64_000)
        val lista = unidades(100)
        assertEquals(listOf(63), tramas(lista.mapNotNull { cortador.agregar(it) }))
        val ultimo = cortador.terminar()!!
        assertEquals(37, Adts.tramas(ultimo.adts).size)
        assertEquals(2, ultimo.indice)
        assertEquals(64_512L, ultimo.muestraInicial)
        assertEquals(37 * 1_024, ultimo.muestras)
        assertNull(cortador.terminar())
        assertThrows<IllegalStateException> { cortador.agregar(lista[0]) }
    }

    @Test
    fun `terminar sin nada pendiente da null`() {
        assertNull(nuevo(64_000).terminar())
        val cortador = nuevo(64_000)
        assertEquals(1, unidades(63).mapNotNull { cortador.agregar(it) }.size)
        assertNull(cortador.terminar())
    }

    @Test
    fun `rechaza un objetivo de menos de una trama y una frecuencia o unos canales que ADTS no admite`() {
        assertThrows<ErrorFormato> { CortadorAdts(1_023) }
        assertThrows<ErrorFormato> { CortadorAdts(64_000, 15_999) }
        assertThrows<ErrorFormato> { CortadorAdts(64_000, 16_000, 0) }
        assertThrows<ErrorFormato> { CortadorAdts(64_000, 16_000, 7) }
    }

    @Test
    fun `el bufer CODEC_CONFIG se comprueba antes de la primera unidad`() {
        val cortador = CortadorAdts(64_000)
        assertThrows<IllegalStateException> { cortador.agregar(ByteArray(10)) }
        for (malo in listOf("", "12", "1208", "1410", "2c08", "140800", "1488")) {
            assertThrows<ErrorFormato>(malo) { cortador.configuracion(Codificacion.deHex(malo)) }
        }
        assertThrows<IllegalStateException> { cortador.agregar(ByteArray(10)) }
        cortador.configuracion(csd)
        assertNull(cortador.agregar(ByteArray(10)))
        assertEquals(1, Adts.tramas(cortador.terminar()!!.adts).size)
    }

    @Test
    fun `vale la senal explicita de que no hay SBR, que sigue siendo AAC-LC`() {
        // ffmpeg 6.1.1 en MP4: 14 08 y 56 e5 00 (syncExtensionType 0x2B7, tipo 5 y sbrPresentFlag 0). Con
        // sbrPresentFlag 1 (56 e5 80) sería HE-AAC: no vale.
        val cortador = CortadorAdts(64_000)
        cortador.configuracion(Codificacion.deHex("140856e500"))
        assertThrows<ErrorFormato> { cortador.configuracion(Codificacion.deHex("140856e580")) }
        assertThrows<ErrorFormato> { CortadorAdts(64_000, 44_100).configuracion(Codificacion.deHex("140856e500")) }
        assertNull(cortador.agregar(ByteArray(10)))
    }

    @Test
    fun `la configuracion esperada sigue a la frecuencia y a los canales del plan B`() {
        // ISO/IEC 14496-3: tipo 2 (LC) en 5 bits, índice de frecuencia en 4, canales en 4 y tres bits a 0.
        assertEquals("1308", Codificacion.hex(CortadorAdts(64_000, 24_000).configuracionEsperada))
        assertEquals("1208", Codificacion.hex(CortadorAdts(64_000, 44_100).configuracionEsperada))
        assertEquals("1188", Codificacion.hex(CortadorAdts(64_000, 48_000).configuracionEsperada))
        assertEquals("1410", Codificacion.hex(CortadorAdts(64_000, 16_000, 2).configuracionEsperada))
    }

    @Test
    fun `rechaza una unidad vacia o que no cabe en una trama sin estropear lo pendiente`() {
        val cortador = nuevo(64_000)
        assertThrows<ErrorFormato> { cortador.agregar(ByteArray(0)) }
        assertThrows<ErrorFormato> { cortador.agregar(ByteArray(8_185)) }
        cortador.agregar(ByteArray(8_184))
        val ultimo = cortador.terminar()!!
        assertEquals(1, Adts.tramas(ultimo.adts).size)
        assertEquals(1_024, ultimo.muestras)
    }

    @Test
    fun `con unidades de tamano aleatorio da los mismos cortes que Adts cortar sobre el flujo entero`() {
        // 2, 4 y 8 s a 16 kHz; 40 grabaciones por objetivo, de 0 a 699 unidades de 1 a 1 199 bytes (hasta 44,8 s).
        for (objetivo in listOf(32_000, 64_000, 128_000)) {
            for (semilla in 1..40) {
                val azar = Random(objetivo + semilla)
                val lista = List(azar.nextInt(0, 700)) { ByteArray(azar.nextInt(1, 1_200)) { azar.nextInt().toByte() } }
                val fragmentos = cortar(nuevo(objetivo), lista)
                val esperados = Adts.cortar(flujo(lista), objetivo)
                val caso = "objetivo $objetivo, semilla $semilla, ${lista.size} unidades"
                assertEquals(esperados.size, fragmentos.size, caso)
                var inicio = 0L
                for ((i, f) in fragmentos.withIndex()) {
                    assertArrayEquals(esperados[i], f.adts, "$caso, fragmento ${i + 1}")
                    assertEquals(i + 1, f.indice, caso)
                    assertEquals(inicio, f.muestraInicial, caso)
                    assertEquals(Adts.tramas(esperados[i]).size * 1_024, f.muestras, caso)
                    inicio += f.muestras
                }
                assertEquals(lista.size * 1_024L, inicio, caso)
            }
        }
    }
}
```

- [ ] **Paso 2: ejecutarla y ver que falla**

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon :puro:test --tests vigia.banco.puro.CortadorAdtsTest'
```

Esperado: `BUILD FAILED`, con `Execution failed for task ':puro:compileTestKotlin'.` y, la primera, `e: file:///work/banco/jvm/puro/src/test/kotlin/vigia/banco/puro/CortadorAdtsTest.kt:18:40 Unresolved reference 'CortadorAdts'.` (las demás líneas `e:` son de lo mismo). Si lo que no se resuelve es `Adts`, `Codificacion` o `ErrorFormato`, falta `nucleo.jar` (tarea 4, paso 1): no seguir.

- [ ] **Paso 3: escribir `CortadorAdts.kt`**

`<banco>/jvm/puro/src/main/kotlin/vigia/banco/puro/CortadorAdts.kt`:

```kotlin
package vigia.banco.puro

import vigia.nucleo.Adts
import vigia.nucleo.Codificacion
import vigia.nucleo.ErrorFormato
import java.io.ByteArrayOutputStream

/**
 * Corte ADTS en vivo (H0b, tarea 5): recibe una a una las unidades AAC crudas que entrega MediaCodec (MediaCodec no da
 * ADTS), les antepone la cabecera del núcleo y cierra el fragmento k en la unidad con la que las muestras contadas
 * desde el inicio de la grabación alcanzan k × muestrasObjetivo, sin deriva. Da los mismos cortes que Adts.cortar
 * sobre el flujo entero (contrato de H1, sección 17). Lo usan el grabador del teléfono y el teléfono simulado.
 * No es seguro entre hilos: lo usa un solo hilo.
 */
class CortadorAdts(private val muestrasObjetivo: Int, private val frecuencia: Int = 16_000, private val canales: Int = 1) {
    /** Un fragmento cerrado: su índice (1, 2…), su primera muestra contada desde el inicio, sus muestras y sus tramas ADTS. */
    class Fragmento(val indice: Int, val muestraInicial: Long, val muestras: Int, val adts: ByteArray)

    /**
     * El AudioSpecificConfig que debe dar el códec en su búfer CODEC_CONFIG (ISO/IEC 14496-3): tipo 2 (LC) en 5 bits,
     * índice de frecuencia en 4, canales en 4 y tres bits a 0. A 16 kHz y mono, 14 08.
     */
    val configuracionEsperada: ByteArray

    private val pendiente = ByteArrayOutputStream()
    private var configurado = false
    private var terminado = false
    private var muestras = 0L // codificadas desde el inicio
    private var inicioFragmento = 0L
    private var cerrados = 0

    init {
        if (muestrasObjetivo < Adts.MUESTRAS_POR_TRAMA) throw ErrorFormato("ADTS: objetivo de menos de una trama")
        // La cabecera lanza ErrorFormato si ADTS no admite la frecuencia o los canales; su byte 2 lleva el índice.
        val indice = (Adts.cabecera(0, frecuencia, canales)[2].toInt() shr 2) and 0xF
        configuracionEsperada = byteArrayOf(((2 shl 3) or (indice shr 1)).toByte(), (((indice and 1) shl 7) or (canales shl 3)).toByte())
    }

    /**
     * Comprueba el búfer CODEC_CONFIG del códec (va antes de la primera unidad): si no es el esperado, lanza
     * ErrorFormato. Vale también seguido de la señal explícita de que no hay SBR (56 E5 00: syncExtensionType 0x2B7,
     * tipo 5 y sbrPresentFlag 0), que sigue siendo AAC-LC y que escribe, por ejemplo, ffmpeg 6.1.1 en MP4.
     */
    fun configuracion(csd: ByteArray) {
        if (!csd.contentEquals(configuracionEsperada) && !csd.contentEquals(configuracionEsperada + SIN_SBR)) {
            throw ErrorFormato("AudioSpecificConfig ${Codificacion.hex(csd)}: se esperaba ${Codificacion.hex(configuracionEsperada)}")
        }
        configurado = true
    }

    /**
     * Añade una unidad AAC cruda, sin cabecera y nunca la de CODEC_CONFIG, que son 1 024 muestras. Devuelve el
     * fragmento que esa unidad cierra, o null. Una unidad vacía o que no cabe en una trama lanza ErrorFormato sin
     * tocar lo pendiente.
     */
    fun agregar(unidad: ByteArray): Fragmento? {
        check(configurado) { "falta comprobar el búfer CODEC_CONFIG" }
        check(!terminado) { "el cortador ya terminó" }
        if (unidad.isEmpty()) throw ErrorFormato("ADTS: unidad AAC vacía")
        val cabecera = Adts.cabecera(unidad.size, frecuencia, canales)
        pendiente.write(cabecera)
        pendiente.write(unidad)
        muestras += Adts.MUESTRAS_POR_TRAMA
        return if (muestras >= (cerrados + 1L) * muestrasObjetivo) cerrar() else null
    }

    /** El último fragmento con lo que quede, o null si no queda nada. Después no admite más unidades. */
    fun terminar(): Fragmento? {
        terminado = true
        return if (pendiente.size() > 0) cerrar() else null
    }

    private fun cerrar(): Fragmento {
        cerrados++
        val fragmento = Fragmento(cerrados, inicioFragmento, (muestras - inicioFragmento).toInt(), pendiente.toByteArray())
        pendiente.reset()
        inicioFragmento = muestras
        return fragmento
    }

    private companion object {
        val SIN_SBR = byteArrayOf(0x56, 0xE5.toByte(), 0x00)
    }
}
```

- [ ] **Paso 4: ejecutar todo y ver que pasa**

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon test && grep -ho "tests=\"[0-9]*\" skipped=\"0\" failures=\"0\" errors=\"0\"" puro/build/test-results/test/*.xml | awk -F"\"" "{n++; t+=\$2} END {print n \" clases, \" t \" pruebas, sin fallos\"}"'
```

Esperado: `BUILD SUCCESSFUL` y `2 clases, 13 pruebas, sin fallos` (la del andamio y las 12 de esta tarea). El aviso `Deprecated Gradle features were used in this build` viene del plugin de Kotlin, como en la tarea 4.

- [ ] **Paso 5: commit en el banco**

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit:

```sh
git -C <banco> add jvm/puro/src/main/kotlin/vigia/banco/puro/CortadorAdts.kt jvm/puro/src/test/kotlin/vigia/banco/puro/CortadorAdtsTest.kt
git -C <banco> diff --cached --stat | tail -1
git -C <banco> commit -q -m "Cortador ADTS en vivo para P3 (H0b, tarea 5)

Recibe las unidades AAC crudas de MediaCodec, les antepone la cabecera ADTS del
núcleo de f2-h1 y corta sin deriva, contando las muestras desde el inicio: los
mismos cortes que Adts.cortar sobre el flujo entero. Comprueba aparte el búfer
CODEC_CONFIG (14 08 para AAC-LC a 16 kHz mono)." && git -C <banco> log --oneline -1
```

Esperado: ` 2 files changed, 250 insertions(+)` y el commit con su hash corto.

**Notas:**

- **Nota:** validado el 14-oct-2026 en `vigia-build` (imagen de H0a), en una copia del banco con el andamio de la tarea 4 y `F2H1` en una copia de `f2-h1`: el paso 2 con esa salida y el 4 con `2 clases, 13 pruebas, sin fallos`. La prueba sabe fallar: con la deriva puesta a propósito (la cuenta empezando en cada fragmento: `muestras - inicioFragmento >= muestrasObjetivo`), fallan `sin deriva, las muestras se cuentan desde el inicio de la grabacion` y la prueba de propiedad.
- **Nota:** el índice de frecuencia del AudioSpecificConfig se lee del byte 2 de `Adts.cabecera(0, frecuencia, canales)`, así no se copia la tabla de ISO/IEC 14496-3 (que en el núcleo es privada). `configuracionEsperada` sale 14 08 a 16 kHz mono, 13 08 a 24 kHz, 12 08 a 44,1 kHz, 11 88 a 48 kHz y 14 10 a 16 kHz estéreo: los dos primeros bytes del AudioSpecificConfig que escribe ffmpeg 6.1.1 en MP4 (comprobado el 14-oct), que añade `56 e5 00`. `c2.android.aac.encoder` (FDK, transporte crudo y sin SBR) debería dar solo los dos primeros: deducido del código de AOSP, sin comprobar en el teléfono.
- **Nota:** el cortador no es seguro entre hilos: en el teléfono lo usa solo el hilo sellador del grabador (tarea 6). No comprueba el tope de 65 536 bytes del sobre: eso lo hace el grabador sobre el cuerpo ya sellado, porque `Sobre.cuerpo()` del núcleo no lo comprueba (informe de código de H1).
- **Nota:** `jvm/puro` usa solo lo que tiene Android 7 (`ByteArrayOutputStream.write(ByteArray)`, sin `writeBytes`, que es de la API 33); el banco no pasa animal-sniffer, pero el código también entra al APK con minSdk 24. La tarea no añade dependencias: `jvm/gradle/verification-metadata.xml` no cambia.

---

### Tarea 6: P3 y P4 sin subida: grabador, servicio en primer plano y latidos

**Archivos (banco, `<banco>`):**
- Crear: `app/modules/banco/android/src/main/java/expo/modules/banco/Grabador.kt`.
- Sustituir (son los mínimos del andamio): `app/modules/banco/android/src/main/java/expo/modules/banco/BancoP3Module.kt`, `app/modules/banco/android/src/main/java/expo/modules/banco/ServicioGrabacion.kt` y `app/pruebas/P3.tsx`.
- Sin cambios: el manifiesto del módulo (ya declara `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `FOREGROUND_SERVICE_DATA_SYNC`, `POST_NOTIFICATIONS`, `WAKE_LOCK` y el servicio sin exportar con `microphone|dataSync`) y `app/modules/banco/index.ts` (ya trae las firmas de `ModuloP3`).
- Fuera del banco: `/work/h0b/limpio` y `/work/h0b/salida/apk/`, como en la tarea 4.

**Interfaces:**
- Consume:
  - Tarea 4: `Resultados.guardar(contexto: Context, prueba: String, json: String)`; `Llaves.firmanteKeystore(alias: String, strongBox: Boolean): FirmanteKeystore` (con `spki` y `nivel`); `Escucha.publica(): ByteArray`; el manifiesto del módulo; `useEjecucion()` y `estilos` de `app/pruebas/comun.ts`; `BancoP3` de `app/modules/banco/index.ts`; `compilar.sh`.
  - Tarea 5: `CortadorAdts(muestrasObjetivo)` con `configuracion`, `agregar` y `terminar`.
  - H1 (`nucleo.jar`): `FabricaSobres(firmante, incidente, k)` con `apertura(horaTelefono, countryCode, origen)`, `fragmento(horaTelefono, audio)`, `cierre(horaTelefono)` y `estado`; `Sobre.cuerpo()` y `Sobre.MAX_CUERPO` (65 536); `Envoltura.envolver(hpke, publica, incidente, "escucha", k)` (80 bytes); `HpkeBouncyCastle()`; `Codificacion`.
- Produce:
  - JS, `BancoP3` (firmas del contrato; cada función devuelve un JSON y lo guarda con `Resultados`):
    - `codificadores()`, prueba `p3-codificadores`: `{"codificadores":[{"nombre","canonico","fabricante","solo_software","hardware","alias","frecuencias","bits_por_segundo","canales_max","perfiles"}…],"para_16k_mono_lc":<nombre o null>}` (los cinco campos de `canonico` a `alias` solo en Android 10 o más).
    - `iniciar(fuente, segundosFragmento, latidos)`, prueba `p3-iniciar`: `fuente` es `MIC` o `VOICE_RECOGNITION`, `segundosFragmento` de 1 a 8. Inicia `ServicioGrabacion` desde la actividad visible y espera (10 s como mucho) a la primera unidad AAC: `{"incidente","fuente","segundos_fragmento","latidos","codec","arranque":{"servicio_ms","primer_plano_ms","listo_ms","grabando_ms","primera_lectura_ms","primera_unidad_ms"}}`, en ms desde el toque. Lanza si ya hay una grabación, sin permiso de micrófono o si no arranca.
    - `estado()`, prueba `p3-estado`: `{"grabando","incidente","fuente","segundos_fragmento","latidos","segundos","muestras","unidades","fragmentos","silenciado","error"}`, o `{"grabando":false}` si no hubo ninguna.
    - `detener()`, prueba `p3-detener`: para, espera (15 s como mucho) a que todo esté escrito y devuelve el `resumen.json` de la grabación.
    - `arranques(n)`, prueba `p3-arranques`: n de 1 a 50 arranques con la fuente `MIC`, uno por segundo, sin escribir audio: `{"n","fuente","arranques":[{"listo_ms","grabando_ms","primera_lectura_ms","primera_unidad_ms"}…],"primero_ms","mediana_ms","max_ms"}`, en ms desde el comienzo de cada arranque.
  - La carpeta de grabación del contrato, `getExternalFilesDir(null)/p3/<incidente>/`, con estos campos exactos (los lee la tarea 7, y el teléfono simulado los escribe igual):

| Archivo | Contenido |
|---|---|
| `incidente.txt` | El id (22 caracteres b64u) y un salto de línea |
| `spki.der` | 91 bytes: la pública de un par P-256 nuevo del Keystore (alias `banco-p3`, sin StrongBox) |
| `escucha.env` | 80 bytes: `K` envuelta con HPKE para la pública de escucha, rol `escucha` |
| `000000.sobre`, `NNNNNN.sobre`, `cierre.sobre` | `Sobre.cuerpo()` de la apertura (`origen` `grabar`, `country_code` `VE`), de cada fragmento (su `hora_telefono` es la de su primera muestra) y del cierre |
| `tiempos.jsonl` | `{"muestras","t_ns"}` y, si `getTimestamp` (BOOTTIME) responde, `"ts_marco","ts_ns"`: en la primera lectura, una por segundo y en la última |
| `eventos.jsonl` | `{"tipo","t_ns","hora",…}`: `codec` (`nombre`, `respaldo`), `formato` (`formato`), `csd` (`hex`), `arranque` (los seis `*_ms` de `iniciar`), `silenciado` (`silenciado`), `error` (`detalle`) y `parada` (`motivo`, `eos`) |
| `latidos.jsonl` | Solo con latidos: `{"t_ns","hora","muestras","fragmentos","doze","interactiva","ahorro","sin_optimizar","bateria","cargando"}` en la primera lectura y cada 60 s |
| `resumen.json` | `{"incidente","fuente","segundos_fragmento","latidos","codec","nivel_clave","inicio_hora","inicio_ns","fin_hora","fin_ns","muestras","unidades","fragmentos","bytes_adts","sobre_max","cierre","eos","motivo","error","zona_min"}`; `motivo` es `detener` o `error` |

`t_ns` es `elapsedRealtimeNanos` (incluye el sueño profundo: el "tiempo monotónico" de P3) y `hora`, `currentTimeMillis`.

Diseño (recomendaciones del informe android-windows):
- **Dos hilos.** El lector (prioridad de audio si el sistema la concede) hace `AudioRecord` a 16 kHz, mono y PCM de 16 bits, con la fuente pedida, `setPrivacySensitive(true)` en Android 11 o más y un búfer de al menos 1 s; lee 1 024 muestras (una unidad AAC) con `READ_BLOCKING` y alimenta `MediaCodec`. El sellador hace el corte (`CortadorAdts`), los sobres (`FabricaSobres` con la clave del Keystore: una firma puede tardar decenas o cientos de ms) y todo el disco. Se pasan el trabajo por una cola, así nada lento retrasa la lectura.
- **Códec.** `c2.android.aac.encoder` por nombre si está; si no, `findEncoderForFormat` (el evento `codec` lo dice con `respaldo`). AAC-LC, 16 kHz, mono y 32 kbps; los pts se cuentan por muestras. El búfer CODEC_CONFIG (y el `csd-0` del formato) pasan por `CortadorAdts.configuracion`: con otro AudioSpecificConfig la grabación para con error. Al detener se manda el EOS y se vacía el códec (3 s como mucho; `eos` dice si llegó).
- **Sobres.** `K` (32 bytes de `SecureRandom`) vive solo en RAM, se envuelve para la clave de escucha y se pone a cero al acabar. Cada sobre se escribe entero o no se escribe (temporal, `fsync` y renombrado) y se comprueba que el cuerpo no pase de 65 536 bytes (`Sobre.cuerpo()` no lo comprueba). La clave del Keystore es nueva en cada grabación (alias `banco-p3`, sin StrongBox: P5 mide StrongBox).
- **Errores.** `ERROR_DEAD_OBJECT` u otro error de lectura paran la grabación con `motivo` `error` (el evento `error` lo detalla); un fallo del sellador (Keystore, AudioSpecificConfig, sobre demasiado grande) deja de sellar y para el lector, que acaba con `motivo` `detener`: el fallo queda en el campo `error` del resumen (por eso el cierre de P4 exige `error` nulo). Desde Android 10 el silenciado del micrófono llega sin error: se anota cada cambio (`silenciado`). El fin llega siempre al sellador, que escribe el cierre con lo que haya sellado y `resumen.json`.
- **Servicio.** `ServicioGrabacion` se pone en primer plano con los tipos `microphone` y `dataSync` (Android 11+) y una notificación neutra ("Banco de pruebas", "Prueba en curso"), toma un `PARTIAL_WAKE_LOCK` (tope de 3 h) y arranca la grabación que `BancoP3.iniciar` deja en `Grabador.actual`. Se inicia siempre desde la actividad visible: desde segundo plano no tendría micrófono. Al acabar la grabación suelta el wake lock y se para; no se reinicia solo (`START_NOT_STICKY`): si el sistema lo mata, P4 lo ve en los latidos y en `exit-info`.
- **Pantalla.** `P3.tsx` pide `RECORD_AUDIO` y, en Android 13 o más, `POST_NOTIFICATIONS` antes de iniciar y antes de los arranques (sin notificaciones se graba igual). La grabación vive en Kotlin: volver al menú no la para, y Estado y Detener la encuentran al volver.

- [ ] **Paso 1: el grabador**

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/Grabador.kt`:

```kotlin
package expo.modules.banco

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRecordingConfiguration
import android.media.AudioTimestamp
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.media.MediaRecorder
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import vigia.banco.puro.CortadorAdts
import vigia.nucleo.Codificacion
import vigia.nucleo.Envoltura
import vigia.nucleo.FabricaSobres
import vigia.nucleo.HpkeBouncyCastle
import vigia.nucleo.Sobre
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.SecureRandom
import java.util.TimeZone
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

private const val HZ = 16_000
private const val BITS_POR_SEGUNDO = 32_000
private const val BYTES_POR_LECTURA = 2 * 1_024 // 1 024 muestras de 16 bits: una unidad AAC
private const val PREFERIDO = "c2.android.aac.encoder"
private const val ALIAS = "banco-p3"
private const val NS = 1_000_000_000L
private const val MINUTO_NS = 60 * NS

private fun ahoraNs() = SystemClock.elapsedRealtimeNanos()

/**
 * Una grabación de P3 y P4 sin subida (H0b, tarea 6), en la carpeta del contrato:
 * getExternalFilesDir(null)/p3/<incidente>/. Dos hilos:
 * - el lector: AudioRecord a 16 kHz, mono y PCM de 16 bits, lecturas de 1 024 muestras con READ_BLOCKING, y el
 *   códec AAC-LC a 32 kbps con los pts contados por muestras;
 * - el sellador: corte ADTS sin deriva (CortadorAdts), sobres firmados con una clave nueva del Keystore y cifrados
 *   con K (FabricaSobres), y todo el disco. Así las firmas y las escrituras nunca retrasan la lectura.
 * El audio en claro y K solo existen en RAM (DAT-01): al disco van los sobres, K envuelta para la clave de escucha
 * de pruebas, y tiempos, eventos, latidos y resumen. La arranca ServicioGrabacion; la para detener().
 */
class Grabador(
  private val contexto: Context,
  val fuente: String,
  val segundosFragmento: Int,
  val latidos: Boolean,
  private val toqueNs: Long,
) {
  val incidente: String = Codificacion.b64u(ByteArray(16).also { SecureRandom().nextBytes(it) })
  private val carpeta = File(contexto.getExternalFilesDir(null) ?: throw IllegalStateException("sin carpeta externa"), "p3/$incidente")
  private val cola = LinkedBlockingQueue<Trabajo>()
  private val arrancado = CountDownLatch(1)
  private val terminado = CountDownLatch(1)
  private val abiertos = HashMap<String, FileOutputStream>() // solo el sellador
  private val marca = AudioTimestamp() // solo el lector

  @Volatile private var parar = false
  @Volatile var iniciado = false
    private set
  @Volatile var activo = true
    private set
  @Volatile private var fallo: String? = null
  @Volatile private var resumen: String? = null
  @Volatile private var silenciado = false
  @Volatile private var codec: String? = null
  @Volatile private var muestras = 0L
  @Volatile private var unidades = 0L
  @Volatile private var fragmentos = 0
  private var bytesAdts = 0L
  private var sobreMax = 0
  private var nivelClave: String? = null
  private var inicioHora = 0L
  private var inicioNs = 0L

  // Arranque, en elapsedRealtimeNanos: lo apuntan el servicio y el lector.
  @Volatile private var servicioNs = 0L
  @Volatile private var primerPlanoNs = 0L
  @Volatile private var listoNs = 0L
  @Volatile private var grabandoNs = 0L
  @Volatile private var primeraLecturaNs = 0L
  @Volatile private var primeraUnidadNs = 0L

  /** Lo pone el servicio: se llama una vez, desde el sellador, cuando todo está escrito. */
  @Volatile var alTerminar: (() -> Unit)? = null

  init {
    require(fuente in FUENTES) { "fuente desconocida: $fuente" }
    require(segundosFragmento in 1..8) { "segundosFragmento va de 1 a 8" }
  }

  private sealed class Trabajo {
    class Csd(val bytes: ByteArray) : Trabajo()
    class Inicio(val horaMs: Long, val tNs: Long) : Trabajo()
    class Unidad(val bytes: ByteArray) : Trabajo()
    class Linea(val archivo: String, val json: JSONObject) : Trabajo()
    class Latido(val tNs: Long, val muestras: Long) : Trabajo()
    class Fin(val motivo: String, val eos: Boolean) : Trabajo()
  }

  /** Lo llama el servicio, ya en primer plano y con el wake lock. */
  fun iniciar(servicioNs: Long, primerPlanoNs: Long) {
    check(!iniciado) { "la grabación ya empezó" }
    iniciado = true
    this.servicioNs = servicioNs
    this.primerPlanoNs = primerPlanoNs
    Thread(::sellar, "banco-sellador").start()
    Thread(::leer, "banco-lector").start()
  }

  /** Espera a la primera unidad AAC (o a un fallo) y devuelve el arranque. */
  fun esperarArranque(ms: Long): String {
    if (!arrancado.await(ms, TimeUnit.MILLISECONDS)) {
      abortar("la grabación no arrancó en $ms ms")
    }
    fallo?.let { throw IllegalStateException(it) }
    return JSONObject().put("incidente", incidente).put("fuente", fuente).put("segundos_fragmento", segundosFragmento)
      .put("latidos", latidos).put("codec", codec ?: JSONObject.NULL).put("arranque", arranque()).toString()
  }

  /** Para y espera a que todo esté escrito; devuelve resumen.json. */
  fun detener(ms: Long): String {
    parar = true
    check(terminado.await(ms, TimeUnit.MILLISECONDS)) { "la grabación no se cerró en $ms ms" }
    return resumen ?: JSONObject().put("incidente", incidente).put("error", fallo ?: JSONObject.NULL).toString()
  }

  /** Pide la parada sin esperar (desde el hilo principal). */
  fun pedirParada() {
    parar = true
  }

  /** Para lo que no llegó a arrancar (el servicio no pudo ponerse en primer plano o no llegó). */
  fun abortar(motivo: String) {
    if (fallo == null) fallo = motivo
    parar = true
    if (!iniciado) activo = false
    arrancado.countDown()
    if (!iniciado) terminado.countDown()
  }

  fun estado(): JSONObject = JSONObject()
    .put("grabando", activo).put("incidente", incidente).put("fuente", fuente)
    .put("segundos_fragmento", segundosFragmento).put("latidos", latidos)
    .put("segundos", muestras / HZ.toDouble()).put("muestras", muestras).put("unidades", unidades)
    .put("fragmentos", fragmentos).put("silenciado", silenciado).put("error", fallo ?: JSONObject.NULL)

  private fun arranque(): JSONObject {
    fun ms(t: Long): Any = if (t == 0L) JSONObject.NULL else (t - toqueNs) / 1_000_000.0
    return JSONObject().put("servicio_ms", ms(servicioNs)).put("primer_plano_ms", ms(primerPlanoNs))
      .put("listo_ms", ms(listoNs)).put("grabando_ms", ms(grabandoNs))
      .put("primera_lectura_ms", ms(primeraLecturaNs)).put("primera_unidad_ms", ms(primeraUnidadNs))
  }

  private fun evento(tipo: String, campos: JSONObject = JSONObject()): JSONObject =
    campos.put("tipo", tipo).put("t_ns", ahoraNs()).put("hora", System.currentTimeMillis())

  private fun anotarError(detalle: String) {
    if (fallo == null) fallo = detalle
    cola.put(Trabajo.Linea("eventos.jsonl", evento("error", JSONObject().put("detalle", detalle))))
  }

  // Lo que sale del códec va al sellador; la primera unidad marca el arranque.
  private val salida = object : CodificadorAac.Salida {
    override fun formato(f: MediaFormat) {
      cola.put(Trabajo.Linea("eventos.jsonl", evento("formato", JSONObject().put("formato", f.toString()))))
      f.getByteBuffer("csd-0")?.let { cola.put(Trabajo.Csd(ByteArray(it.remaining()).also { b -> it.duplicate().get(b) })) }
    }

    override fun csd(bytes: ByteArray) {
      cola.put(Trabajo.Csd(bytes))
    }

    override fun unidad(bytes: ByteArray) {
      unidades++
      if (unidades == 1L) {
        primeraUnidadNs = ahoraNs()
        cola.put(Trabajo.Linea("eventos.jsonl", evento("arranque", arranque())))
        arrancado.countDown()
      }
      cola.put(Trabajo.Unidad(bytes))
    }
  }

  private fun leer() {
    // Prioridad de audio si el sistema la concede; si no, la normal.
    runCatching { Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO) }
    var motivo = "detener"
    var eos = false
    var grabadora: AudioRecord? = null
    var codificador: CodificadorAac? = null
    var vigia: AudioManager.AudioRecordingCallback? = null
    try {
      grabadora = microfono(contexto, fuente)
      codificador = CodificadorAac.abrir()
      codec = codificador.nombre
      cola.put(Trabajo.Linea("eventos.jsonl", evento("codec", JSONObject().put("nombre", codificador.nombre).put("respaldo", codificador.respaldo))))
      vigia = vigilarSilencio(grabadora)
      listoNs = ahoraNs()
      grabadora.startRecording()
      grabandoNs = ahoraNs()
      check(grabadora.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "startRecording no empezó a grabar" }
      val pcm = ByteArray(BYTES_POR_LECTURA)
      var ultimoTiempo = 0L
      var ultimoLatido = 0L
      var t = 0L
      while (!parar) {
        val n = grabadora.read(pcm, 0, pcm.size, AudioRecord.READ_BLOCKING)
        t = ahoraNs()
        if (n < 0) {
          motivo = "error"
          anotarError("read $n" + if (n == AudioRecord.ERROR_DEAD_OBJECT) " (ERROR_DEAD_OBJECT)" else "")
          break
        }
        if (n == 0) continue
        val primera = muestras == 0L
        muestras += n / 2
        if (primera) {
          primeraLecturaNs = t
          cola.put(Trabajo.Inicio(System.currentTimeMillis() - (n / 2) * 1_000L / HZ, t - (n / 2) * NS / HZ))
        }
        if (primera || t - ultimoTiempo >= NS) {
          cola.put(Trabajo.Linea("tiempos.jsonl", tiempo(grabadora, t)))
          ultimoTiempo = t
        }
        if (latidos && (primera || t - ultimoLatido >= MINUTO_NS)) {
          cola.put(Trabajo.Latido(t, muestras))
          ultimoLatido = t
        }
        codificador.alimentar(pcm, n, salida)
      }
      if (t != ultimoTiempo) cola.put(Trabajo.Linea("tiempos.jsonl", tiempo(grabadora, t)))
      grabadora.stop()
      eos = codificador.terminar(salida, 3_000)
    } catch (e: Exception) {
      motivo = "error"
      anotarError(e.toString())
    } finally {
      // Pase lo que pase, el sellador recibe el fin: sin él, detener() no volvería.
      runCatching { if (Build.VERSION.SDK_INT >= 29 && vigia != null) grabadora?.unregisterAudioRecordingCallback(vigia) }
      runCatching { codificador?.liberar() }.onFailure { anotarError("liberar el códec: $it") }
      runCatching { grabadora?.release() }
      cola.put(Trabajo.Fin(motivo, eos))
    }
  }

  // Una línea de tiempos.jsonl: muestras leídas, elapsedRealtimeNanos al volver la lectura y, si hay, AudioTimestamp
  // en base BOOTTIME (la misma de elapsedRealtimeNanos).
  private fun tiempo(grabadora: AudioRecord, t: Long): JSONObject {
    val j = JSONObject().put("muestras", muestras).put("t_ns", t)
    if (grabadora.getTimestamp(marca, AudioTimestamp.TIMEBASE_BOOTTIME) == AudioRecord.SUCCESS) {
      j.put("ts_marco", marca.framePosition).put("ts_ns", marca.nanoTime)
    }
    return j
  }

  // Android 10+ silencia sin error al cliente que pierde el micrófono; se apunta cada cambio (API 29+).
  private fun vigilarSilencio(grabadora: AudioRecord): AudioManager.AudioRecordingCallback? {
    if (Build.VERSION.SDK_INT < 29) return null
    val vigia = object : AudioManager.AudioRecordingCallback() {
      override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>) {
        val s = configs.any { it.isClientSilenced }
        if (s != silenciado) {
          silenciado = s
          cola.put(Trabajo.Linea("eventos.jsonl", evento("silenciado", JSONObject().put("silenciado", s))))
        }
      }
    }
    grabadora.registerAudioRecordingCallback(contexto.mainExecutor, vigia)
    return vigia
  }

  private fun sellar() {
    var k: ByteArray? = null
    var fabrica: FabricaSobres? = null
    var cortador: CortadorAdts? = null
    var roto = false
    var h0 = 0L
    var csd: String? = null
    var fin: Trabajo.Fin? = null
    try {
      check(carpeta.mkdirs() || carpeta.isDirectory) { "no se pudo crear la carpeta de la grabación" }
      File(carpeta, "incidente.txt").writeText("$incidente\n")
      val firmante = Llaves.firmanteKeystore(ALIAS, strongBox = false)
      nivelClave = firmante.nivel
      escribirAtomico("spki.der", firmante.spki)
      k = ByteArray(32).also { SecureRandom().nextBytes(it) }
      escribirAtomico("escucha.env", Envoltura.envolver(HpkeBouncyCastle(), Escucha.publica(), incidente, "escucha", k))
      fabrica = FabricaSobres(firmante, incidente, k)
      escribirAtomico("000000.sobre", fabrica.apertura(System.currentTimeMillis(), "VE", "grabar").cuerpo())
      cortador = CortadorAdts(segundosFragmento * HZ)
    } catch (e: Exception) {
      roto = true
      fallar("preparar: $e")
    }
    while (fin == null) {
      val tr = cola.take()
      try {
        when (tr) {
          is Trabajo.Fin -> fin = tr
          is Trabajo.Linea -> anotar(tr.archivo, tr.json)
          is Trabajo.Latido -> anotar("latidos.jsonl", latido(tr))
          is Trabajo.Inicio -> {
            h0 = tr.horaMs
            inicioHora = tr.horaMs
            inicioNs = tr.tNs
          }
          is Trabajo.Csd -> if (!roto) {
            cortador!!.configuracion(tr.bytes)
            if (csd == null) {
              csd = Codificacion.hex(tr.bytes)
              anotar("eventos.jsonl", evento("csd", JSONObject().put("hex", csd)))
            }
          }
          is Trabajo.Unidad -> if (!roto) cortador!!.agregar(tr.bytes)?.let { escribirFragmento(fabrica!!, it, h0) }
        }
      } catch (e: Exception) {
        roto = true
        fallar(e.toString())
      }
    }
    var cerrado = false
    try {
      if (!roto) cortador!!.terminar()?.let { escribirFragmento(fabrica!!, it, h0) }
      if (fabrica?.estado != null) {
        escribirAtomico("cierre.sobre", fabrica.cierre(System.currentTimeMillis()).cuerpo())
        cerrado = true
      }
    } catch (e: Exception) {
      fallar("cerrar: $e")
    }
    k?.fill(0)
    finalizar(fin!!, cerrado)
  }

  // El sellador no sigue sellando tras un fallo, pero sigue anotando y espera al fin del lector.
  private fun fallar(detalle: String) {
    if (fallo == null) fallo = detalle
    parar = true
    try {
      anotar("eventos.jsonl", evento("error", JSONObject().put("detalle", detalle)))
    } catch (_: Exception) {
      // sin carpeta no hay dónde anotarlo: queda en el resumen
    }
  }

  private fun escribirFragmento(fabrica: FabricaSobres, f: CortadorAdts.Fragmento, h0: Long) {
    // hora_telefono del fragmento: la de su primera muestra, contada desde la primera lectura.
    val cuerpo = fabrica.fragmento(h0 + f.muestraInicial * 1_000 / HZ, f.adts).cuerpo()
    check(cuerpo.size <= Sobre.MAX_CUERPO) { "sobre de ${cuerpo.size} bytes: pasa de ${Sobre.MAX_CUERPO}" }
    escribirAtomico("${fabrica.estado!!.ultimoSeq.toString().padStart(6, '0')}.sobre", cuerpo)
    fragmentos++
    bytesAdts += f.adts.size
    sobreMax = maxOf(sobreMax, cuerpo.size)
  }

  private fun latido(tr: Trabajo.Latido): JSONObject {
    val pm = contexto.getSystemService(Context.POWER_SERVICE) as PowerManager
    val bm = contexto.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    return JSONObject().put("t_ns", tr.tNs).put("hora", System.currentTimeMillis()).put("muestras", tr.muestras)
      .put("fragmentos", fragmentos).put("doze", pm.isDeviceIdleMode).put("interactiva", pm.isInteractive)
      .put("ahorro", pm.isPowerSaveMode).put("sin_optimizar", pm.isIgnoringBatteryOptimizations(contexto.packageName))
      .put("bateria", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)).put("cargando", bm.isCharging)
  }

  private fun finalizar(fin: Trabajo.Fin, cerrado: Boolean) {
    try {
      anotar("eventos.jsonl", evento("parada", JSONObject().put("motivo", fin.motivo).put("eos", fin.eos)))
    } catch (_: Exception) {
      // sin carpeta no hay dónde anotarlo: queda en el resumen
    }
    val r = JSONObject().put("incidente", incidente).put("fuente", fuente).put("segundos_fragmento", segundosFragmento)
      .put("latidos", latidos).put("codec", codec ?: JSONObject.NULL).put("nivel_clave", nivelClave ?: JSONObject.NULL)
      .put("inicio_hora", inicioHora).put("inicio_ns", inicioNs)
      .put("fin_hora", System.currentTimeMillis()).put("fin_ns", ahoraNs())
      .put("muestras", muestras).put("unidades", unidades).put("fragmentos", fragmentos)
      .put("bytes_adts", bytesAdts).put("sobre_max", sobreMax).put("cierre", cerrado).put("eos", fin.eos)
      .put("motivo", fin.motivo).put("error", fallo ?: JSONObject.NULL)
      .put("zona_min", TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60_000)
    try {
      escribirAtomico("resumen.json", (r.toString() + "\n").toByteArray())
    } catch (e: Exception) {
      if (fallo == null) r.put("error", "resumen.json: $e")
    }
    for (s in abiertos.values) runCatching { s.close() }
    resumen = r.toString()
    activo = false
    arrancado.countDown()
    terminado.countDown()
    alTerminar?.invoke()
  }

  private fun anotar(archivo: String, json: JSONObject) {
    abiertos.getOrPut(archivo) { FileOutputStream(File(carpeta, archivo), true) }.write((json.toString() + "\n").toByteArray())
  }

  // Cada sobre se escribe entero o no se escribe: archivo temporal, fsync y renombrado.
  private fun escribirAtomico(nombre: String, datos: ByteArray) {
    val tmp = File(carpeta, "$nombre.tmp")
    FileOutputStream(tmp).use {
      it.write(datos)
      it.fd.sync()
    }
    if (!tmp.renameTo(File(carpeta, nombre))) throw IOException("no se pudo renombrar $nombre")
  }

  companion object {
    val FUENTES = listOf("MIC", "VOICE_RECOGNITION")

    /** La grabación en curso o la última; la comparten el módulo y el servicio, en el mismo proceso. */
    @Volatile var actual: Grabador? = null

    @SuppressLint("MissingPermission") // se comprueba justo antes
    fun microfono(contexto: Context, fuente: String): AudioRecord {
      check(contexto.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { "falta el permiso RECORD_AUDIO" }
      val origen = when (fuente) {
        "MIC" -> MediaRecorder.AudioSource.MIC
        "VOICE_RECOGNITION" -> MediaRecorder.AudioSource.VOICE_RECOGNITION // sin AGC ni supresión de ruido (CDD 5.4.2)
        else -> throw IllegalArgumentException("fuente desconocida: $fuente")
      }
      val minimo = AudioRecord.getMinBufferSize(HZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      check(minimo > 0) { "getMinBufferSize: $minimo" }
      val formato = AudioFormat.Builder().setSampleRate(HZ).setChannelMask(AudioFormat.CHANNEL_IN_MONO)
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build()
      // Búfer de al menos 1 s: lo que puede retrasarse el lector antes de perder muestras.
      val constructor = AudioRecord.Builder().setAudioSource(origen).setAudioFormat(formato).setBufferSizeInBytes(maxOf(4 * minimo, 2 * HZ))
      if (Build.VERSION.SDK_INT >= 30) constructor.setPrivacySensitive(true)
      val grabadora = constructor.build()
      if (grabadora.state != AudioRecord.STATE_INITIALIZED) {
        grabadora.release()
        throw IllegalStateException("AudioRecord sin inicializar")
      }
      return grabadora
    }

    /** P3: los codificadores AAC del teléfono (MediaCodecList) y el que se elegiría para 16 kHz mono a 32 kbps. */
    fun codificadores(): JSONObject {
      val lista = MediaCodecList(MediaCodecList.REGULAR_CODECS)
      val todos = JSONArray()
      for (info in lista.codecInfos) {
        if (!info.isEncoder) continue
        val tipo = info.supportedTypes.firstOrNull { it.equals(MediaFormat.MIMETYPE_AUDIO_AAC, ignoreCase = true) } ?: continue
        val capacidades = info.getCapabilitiesForType(tipo)
        val audio = capacidades.audioCapabilities
        val c = JSONObject().put("nombre", info.name)
        if (Build.VERSION.SDK_INT >= 29) {
          c.put("canonico", info.canonicalName).put("fabricante", info.isVendor).put("solo_software", info.isSoftwareOnly)
            .put("hardware", info.isHardwareAccelerated).put("alias", info.isAlias)
        }
        val frecuencias = audio?.supportedSampleRates?.toList() ?: audio?.supportedSampleRateRanges?.map { "${it.lower}-${it.upper}" }
        c.put("frecuencias", JSONArray(frecuencias ?: emptyList<Any>()))
          .put("bits_por_segundo", audio?.bitrateRange?.let { "${it.lower}-${it.upper}" } ?: JSONObject.NULL)
          .put("canales_max", audio?.maxInputChannelCount ?: JSONObject.NULL)
          .put("perfiles", JSONArray(capacidades.profileLevels.map { it.profile }.distinct()))
        todos.put(c)
      }
      return JSONObject().put("codificadores", todos)
        .put("para_16k_mono_lc", lista.findEncoderForFormat(CodificadorAac.formato()) ?: JSONObject.NULL)
    }

    /** P3: un arranque cronometrado sin escribir audio: micrófono y códec, startRecording, primera lectura y primera unidad AAC. */
    fun arranque(contexto: Context, fuente: String): JSONObject {
      val t0 = ahoraNs()
      val grabadora = microfono(contexto, fuente)
      var codificador: CodificadorAac? = null
      try {
        codificador = CodificadorAac.abrir()
        val listo = ahoraNs()
        grabadora.startRecording()
        val grabando = ahoraNs()
        var primeraLectura = 0L
        var primeraUnidad = 0L
        val descarte = object : CodificadorAac.Salida {
          override fun formato(f: MediaFormat) {}
          override fun csd(bytes: ByteArray) {}
          override fun unidad(bytes: ByteArray) {
            if (primeraUnidad == 0L) primeraUnidad = ahoraNs()
          }
        }
        val pcm = ByteArray(BYTES_POR_LECTURA)
        while (primeraUnidad == 0L) {
          check(ahoraNs() - t0 < 5 * NS) { "sin unidad AAC en 5 s" }
          val n = grabadora.read(pcm, 0, pcm.size, AudioRecord.READ_BLOCKING)
          check(n > 0) { "read $n" }
          if (primeraLectura == 0L) primeraLectura = ahoraNs()
          codificador.alimentar(pcm, n, descarte)
        }
        grabadora.stop()
        fun ms(t: Long) = (t - t0) / 1_000_000.0
        return JSONObject().put("listo_ms", ms(listo)).put("grabando_ms", ms(grabando))
          .put("primera_lectura_ms", ms(primeraLectura)).put("primera_unidad_ms", ms(primeraUnidad))
      } finally {
        codificador?.liberar()
        grabadora.release()
      }
    }
  }
}

/** MediaCodec con AAC-LC a 16 kHz, mono y 32 kbps, y los pts contados por muestras. Lo usa un solo hilo. */
internal class CodificadorAac private constructor(val nombre: String, val respaldo: Boolean, private val codec: MediaCodec) {
  interface Salida {
    fun formato(f: MediaFormat)
    fun csd(bytes: ByteArray)
    fun unidad(bytes: ByteArray)
  }

  private val info = MediaCodec.BufferInfo()
  private var muestras = 0L

  /** Entrega n bytes de PCM y saca lo que el códec tenga listo. */
  fun alimentar(pcm: ByteArray, n: Int, salida: Salida) {
    var i = 0
    while (i < n) {
      val indice = codec.dequeueInputBuffer(10_000)
      if (indice < 0) {
        drenar(salida, 0)
        continue
      }
      val entrada = codec.getInputBuffer(indice)!!
      entrada.clear()
      val trozo = minOf(n - i, entrada.remaining())
      entrada.put(pcm, i, trozo)
      codec.queueInputBuffer(indice, 0, trozo, muestras * 1_000_000 / HZ, 0)
      muestras += trozo / 2
      i += trozo
    }
    drenar(salida, 0)
  }

  /** Fin de flujo: pide al códec que vacíe lo que retiene y lo saca. Devuelve si llegó el EOS antes del límite. */
  fun terminar(salida: Salida, limiteMs: Long): Boolean {
    val limite = SystemClock.elapsedRealtime() + limiteMs
    var indice = -1
    while (indice < 0 && SystemClock.elapsedRealtime() < limite) {
      indice = codec.dequeueInputBuffer(10_000)
      if (indice < 0) drenar(salida, 0)
    }
    if (indice < 0) return false
    codec.queueInputBuffer(indice, 0, 0, muestras * 1_000_000 / HZ, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
    while (SystemClock.elapsedRealtime() < limite) if (drenar(salida, 10_000)) return true
    return false
  }

  /** Saca lo que haya; devuelve true con el búfer de fin de flujo. CODEC_CONFIG va aparte y nunca como unidad. */
  private fun drenar(salida: Salida, esperaUs: Long): Boolean {
    while (true) {
      val indice = codec.dequeueOutputBuffer(info, esperaUs)
      if (indice == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
        salida.formato(codec.outputFormat)
        continue
      }
      if (indice < 0) return false // INFO_TRY_AGAIN_LATER
      val datos = ByteArray(info.size)
      codec.getOutputBuffer(indice)!!.apply {
        position(info.offset)
        limit(info.offset + info.size)
        get(datos)
      }
      val flags = info.flags
      codec.releaseOutputBuffer(indice, false)
      if (flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) salida.csd(datos) else if (datos.isNotEmpty()) salida.unidad(datos)
      if (flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return true
    }
  }

  fun liberar() {
    try {
      codec.stop()
    } finally {
      codec.release()
    }
  }

  companion object {
    fun formato(): MediaFormat = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, HZ, 1).apply {
      setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
      setInteger(MediaFormat.KEY_BIT_RATE, BITS_POR_SEGUNDO)
    }

    /** Por nombre, c2.android.aac.encoder; si el teléfono no lo tiene, el que dé findEncoderForFormat. */
    fun abrir(): CodificadorAac {
      val formato = formato()
      val lista = MediaCodecList(MediaCodecList.REGULAR_CODECS)
      val hayPreferido = lista.codecInfos.any { c ->
        c.isEncoder && c.name == PREFERIDO && c.supportedTypes.any { it.equals(MediaFormat.MIMETYPE_AUDIO_AAC, ignoreCase = true) }
      }
      val nombre = if (hayPreferido) PREFERIDO else lista.findEncoderForFormat(formato) ?: throw IllegalStateException("ningún codificador AAC admite 16 kHz mono a 32 kbps")
      val codec = MediaCodec.createByCodecName(nombre)
      try {
        codec.configure(formato, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        codec.start()
      } catch (e: Exception) {
        codec.release()
        throw e
      }
      return CodificadorAac(nombre, !hayPreferido, codec)
    }
  }
}
```

- [ ] **Paso 2: el servicio en primer plano**

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/ServicioGrabacion.kt` (sustituye al del andamio):

```kotlin
package expo.modules.banco

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock

/**
 * Servicio en primer plano de P3 y P4 sin subida (H0b, tarea 6), con los tipos microphone y dataSync del manifiesto
 * del módulo. Lo inicia BancoP3 desde la actividad visible (un servicio de micrófono iniciado desde segundo plano no
 * oye nada). Pone una notificación neutra, toma un PARTIAL_WAKE_LOCK mientras graba y arranca la grabación que el
 * módulo dejó en Grabador.actual; cuando la grabación termina, se para solo.
 */
class ServicioGrabacion : Service() {
  private var bloqueo: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val servicioNs = SystemClock.elapsedRealtimeNanos()
    val grabador = Grabador.actual
    if (intent?.action != INICIAR || grabador == null || grabador.iniciado) {
      // Nadie más inicia este servicio; si llega otra cosa, no se toca la grabación que haya en marcha.
      if (grabador?.activo != true) stopSelf(startId)
      return START_NOT_STICKY
    }
    try {
      primerPlano() // quien llama a startForegroundService exige startForeground enseguida
      val primerPlanoNs = SystemClock.elapsedRealtimeNanos()
      bloqueo = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "banco:p3").apply {
        setReferenceCounted(false)
        acquire(TRES_HORAS_MS) // tope por si algo falla: una prueba dura 30 min
      }
      // El grabador termina en su hilo sellador; el servicio se para en el principal.
      grabador.alTerminar = { Handler(Looper.getMainLooper()).post { terminar(startId) } }
      grabador.iniciar(servicioNs, primerPlanoNs)
    } catch (e: Exception) {
      grabador.abortar("servicio: $e")
      terminar(startId)
    }
    // Si el sistema mata el servicio, no lo resucita: P4 tiene que verlo en los latidos y en exit-info.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    Grabador.actual?.takeIf { it.activo }?.pedirParada()
    soltarBloqueo()
    super.onDestroy()
  }

  private fun terminar(startId: Int) {
    soltarBloqueo()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf(startId)
  }

  private fun soltarBloqueo() {
    bloqueo?.let { if (it.isHeld) it.release() }
    bloqueo = null
  }

  private fun primerPlano() {
    val constructor = if (Build.VERSION.SDK_INT >= 26) {
      val avisos = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      avisos.createNotificationChannel(NotificationChannel(CANAL, "Banco", NotificationManager.IMPORTANCE_LOW))
      Notification.Builder(this, CANAL)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    // Notificación neutra: no dice qué se hace.
    val aviso = constructor.setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("Banco de pruebas")
      .setContentText("Prueba en curso").setOngoing(true).build()
    when {
      Build.VERSION.SDK_INT >= 30 -> startForeground(
        NOTIFICACION, aviso, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
      )
      Build.VERSION.SDK_INT >= 29 -> startForeground(NOTIFICACION, aviso, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      else -> startForeground(NOTIFICACION, aviso)
    }
  }

  companion object {
    const val INICIAR = "expo.modules.banco.INICIAR"
    private const val CANAL = "banco"
    private const val NOTIFICACION = 1
    private const val TRES_HORAS_MS = 3 * 60 * 60 * 1_000L
  }
}
```

- [ ] **Paso 3: el módulo**

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/BancoP3Module.kt` (sustituye al del andamio):

```kotlin
package expo.modules.banco

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

/**
 * BancoP3 (P3 y P4 sin subida, H0b, tarea 6). Cada función devuelve un JSON y lo guarda con Resultados (pruebas
 * p3-codificadores, p3-iniciar, p3-estado, p3-detener y p3-arranques). La grabación vive en ServicioGrabacion y en
 * Grabador, no en la pantalla: volver al menú no la para.
 */
class BancoP3Module : Module() {
  private val contexto: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BancoP3")

    AsyncFunction("codificadores") { guardar("p3-codificadores", Grabador.codificadores()) }

    AsyncFunction("iniciar") { fuente: String, segundosFragmento: Int, latidos: Boolean ->
      guardar("p3-iniciar", iniciar(fuente, segundosFragmento, latidos))
    }

    AsyncFunction("estado") { guardar("p3-estado", Grabador.actual?.estado() ?: JSONObject().put("grabando", false)) }

    AsyncFunction("detener") {
      val grabador = Grabador.actual ?: throw IllegalStateException("no hay ninguna grabación")
      guardar("p3-detener", JSONObject(grabador.detener(15_000)))
    }

    AsyncFunction("arranques") { n: Int -> guardar("p3-arranques", arranques(n)) }
  }

  private fun guardar(prueba: String, json: JSONObject): String =
    json.toString().also { Resultados.guardar(contexto, prueba, it) }

  // El servicio se inicia desde aquí, con la actividad visible: así tiene el micrófono aunque luego se apague la pantalla.
  private fun iniciar(fuente: String, segundosFragmento: Int, latidos: Boolean): JSONObject {
    check(Grabador.actual?.activo != true) { "ya hay una grabación en marcha" }
    val grabador = Grabador(contexto, fuente, segundosFragmento, latidos, SystemClock.elapsedRealtimeNanos())
    Grabador.actual = grabador
    val intent = Intent(contexto, ServicioGrabacion::class.java).setAction(ServicioGrabacion.INICIAR)
    try {
      if (Build.VERSION.SDK_INT >= 26) contexto.startForegroundService(intent) else contexto.startService(intent)
    } catch (e: Exception) {
      grabador.abortar("startForegroundService: $e")
    }
    return JSONObject(grabador.esperarArranque(10_000))
  }

  // P3: n arranques seguidos con la fuente MIC, 1 s entre uno y otro, sin escribir audio.
  private fun arranques(n: Int): JSONObject {
    require(n in 1..50) { "n va de 1 a 50" }
    check(Grabador.actual?.activo != true) { "hay una grabación en marcha" }
    val lista = JSONArray()
    val tiempos = ArrayList<Double>()
    repeat(n) { i ->
      if (i > 0) Thread.sleep(1_000)
      val arranque = Grabador.arranque(contexto, "MIC")
      lista.put(arranque)
      tiempos.add(arranque.getDouble("primera_unidad_ms"))
    }
    val orden = tiempos.sorted()
    val mediana = if (n % 2 == 1) orden[n / 2] else (orden[n / 2 - 1] + orden[n / 2]) / 2
    return JSONObject().put("n", n).put("fuente", "MIC").put("arranques", lista)
      .put("primero_ms", tiempos.first()).put("mediana_ms", mediana).put("max_ms", orden.last())
  }
}
```

- [ ] **Paso 4: la pantalla**

`<banco>/app/pruebas/P3.tsx` (sustituye a la del andamio):

```tsx
import { useState } from 'react';
import { Button, PermissionsAndroid, Platform, ScrollView, Switch, Text, View, type Permission } from 'react-native';
import { BancoP3 } from '../modules/banco';
import { estilos, useEjecucion } from './comun';

/**
 * Pide RECORD_AUDIO y, desde Android 13, POST_NOTIFICATIONS. Sin micrófono no se graba; sin notificaciones sí
 * (el servicio sigue en primer plano y su aviso solo sale en el Administrador de tareas).
 */
async function pedirPermisos(): Promise<void> {
  const permisos: Permission[] = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (Number(Platform.Version) >= 33) permisos.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  const respuesta = await PermissionsAndroid.requestMultiple(permisos);
  if (respuesta[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Sin permiso de micrófono no se puede grabar.');
  }
}

/**
 * P3 y P4 sin subida (tarea 6). La grabación vive en el servicio de Kotlin: volver al menú no la para, y Estado y
 * Detener la encuentran al volver. Cada botón guarda su resultado en resultados.jsonl.
 */
export default function P3() {
  const { texto, ocupado, ejecutar } = useEjecucion();
  const [fuente, setFuente] = useState('MIC');
  const [segundos, setSegundos] = useState(4);
  const [latidos, setLatidos] = useState(false);
  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text style={estilos.titulo}>P3 y P4: grabación y servicio</Text>
      <View style={estilos.boton}>
        <Button
          title={`Fuente: ${fuente}`}
          disabled={ocupado}
          onPress={() => setFuente(fuente === 'MIC' ? 'VOICE_RECOGNITION' : 'MIC')}
        />
      </View>
      <View style={estilos.boton}>
        <Button
          title={`Fragmento: ${segundos} s`}
          disabled={ocupado}
          onPress={() => setSegundos(segundos === 2 ? 4 : segundos === 4 ? 8 : 2)}
        />
      </View>
      <View style={[estilos.boton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Text style={estilos.destacado}>Latido cada minuto (P4)</Text>
        <Switch value={latidos} disabled={ocupado} onValueChange={setLatidos} />
      </View>
      <View style={estilos.boton}>
        <Button
          title="Iniciar grabación"
          disabled={ocupado}
          onPress={() => ejecutar(async () => {
            await pedirPermisos();
            return BancoP3.iniciar(fuente, segundos, latidos);
          })}
        />
      </View>
      <View style={estilos.boton}>
        <Button title="Estado" disabled={ocupado} onPress={() => ejecutar(() => BancoP3.estado())} />
      </View>
      <View style={estilos.boton}>
        <Button title="Detener" disabled={ocupado} onPress={() => ejecutar(() => BancoP3.detener())} />
      </View>
      <View style={estilos.boton}>
        <Button
          title="20 arranques"
          disabled={ocupado}
          onPress={() => ejecutar(async () => {
            await pedirPermisos();
            return BancoP3.arranques(20);
          })}
        />
      </View>
      <View style={estilos.boton}>
        <Button title="Codificadores AAC" disabled={ocupado} onPress={() => ejecutar(() => BancoP3.codificadores())} />
      </View>
      <Text style={estilos.resultado}>{texto}</Text>
    </ScrollView>
  );
}
```

- [ ] **Paso 5: commit en el banco**

`compilar.sh` compila desde un clon del banco, así que el código entra antes en un commit. Si el paso 6 o el 7 fallan, se corrige y se hace otro commit.

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit:

```sh
git -C <banco> add app/modules/banco/android/src/main/java/expo/modules/banco/Grabador.kt app/modules/banco/android/src/main/java/expo/modules/banco/ServicioGrabacion.kt app/modules/banco/android/src/main/java/expo/modules/banco/BancoP3Module.kt app/pruebas/P3.tsx
git -C <banco> diff --cached --stat | tail -1
git -C <banco> commit -q -m "P3 y P4 sin subida en el teléfono (H0b, tarea 6)

Grabador: AudioRecord a 16 kHz mono (MIC o VOICE_RECOGNITION, privacy sensitive),
AAC-LC a 32 kbps con c2.android.aac.encoder (o findEncoderForFormat), corte ADTS
sin deriva y sobres sellados en RAM con una clave del Keystore y K envuelta para
la clave de escucha de pruebas; tiempos, eventos, latidos y resumen. Servicio en
primer plano (microphone y dataSync) con wake lock, módulo BancoP3 y pantalla." && git -C <banco> log --oneline -1
```

Esperado: ` 4 files changed, 828 insertions(+), 16 deletions(-)` y el commit con su hash corto.

- [ ] **Paso 6: compilar los dos APK desde un clon limpio**

Unos 5 min con las cachés llenas. Se espera a la línea `salida:`.

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'rm -rf /work/h0b/limpio && git clone -q /fuente/banco /work/h0b/limpio && sh /work/h0b/limpio/compilar.sh > /work/h0b/compilar.log 2>&1; echo "salida: $?" >> /work/h0b/compilar.log'
docker exec vigia-build sh -c 'grep -E "^nucleo|^bcprov|BUILD|^==|^[0-9]+ app-|^salida" /work/h0b/compilar.log'
```

Esperado (tamaños de la validación del 14-oct; pueden variar unos cientos de bytes con el commit y la clave de escucha):

```
nucleo.jar: OK
bcprov-jdk18on-1.86.jar: OK
BUILD SUCCESSFUL in …
BUILD SUCCESSFUL in …
== sin-r8
35256148 app-arm64-v8a-release.apk
28373864 app-armeabi-v7a-release.apk
36028924 app-x86_64-release.apk
== con-r8
28225419 app-arm64-v8a-release.apk
21343135 app-armeabi-v7a-release.apk
28998195 app-x86_64-release.apk
salida: 0
```

Sin R8 crecen unos 20 KB respecto al andamio (el código de P3); con R8, unos 200 KB, porque ahora sí se usan el núcleo y la parte de HPKE de BouncyCastle. Si falla, el error exacto está en `/work/h0b/compilar.log`.

- [ ] **Paso 7: comprobar el APK, los tipos y las pruebas de `jvm/`**

En el APK: la versión y que no es depurable (fichas de la tarea 4), el servicio en el manifiesto final con `foregroundServiceType` 0x81 (`microphone` 0x80 y `dataSync` 0x1) y sin exportar, y las clases nuevas en el dex sin R8 (con R8 salen renombradas, salvo el servicio, que el manifiesto nombra).

📍 Máquina de trabajo; los guiones corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec -i vigia-build sh -s <<'EOF'
salida=/work/h0b/salida/apk
BT=/opt/android-sdk/build-tools/36.0.0
commit=$(git -C /work/h0b/limpio rev-parse --short HEAD)
echo "cambios en el clon limpio tras compilar: $(git -C /work/h0b/limpio status --porcelain | wc -l)"
for v in sin-r8 con-r8; do
    f=$salida/$v/app-arm64-v8a-release.ficha.txt
    grep -q "versionName='$commit'" "$f" && ! grep -q application-debuggable "$f" && r="versión $commit, no depurable" || r="MAL: versión o depurable"
    echo "$v: $r; ServicioGrabacion: $("$BT/aapt2" dump xmltree --file AndroidManifest.xml "$salida/$v/app-arm64-v8a-release.apk" | grep -A3 'ServicioGrabacion' | grep -oE '(exported|foregroundServiceType)\([^)]*\)=[0-9a-zx]+' | sed 's/([^)]*)//' | paste -sd ' ' -)"
done
python3 -I - "$salida/sin-r8/app-arm64-v8a-release.apk" <<'PY'
import sys
import zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    dex = b''.join(z.read(n) for n in z.namelist() if n.startswith('classes') and n.endswith('.dex'))
for c in ('vigia/banco/puro/CortadorAdts', 'expo/modules/banco/Grabador', 'expo/modules/banco/CodificadorAac',
          'expo/modules/banco/ServicioGrabacion', 'vigia/nucleo/FabricaSobres', 'org/bouncycastle/crypto/hpke/HPKE'):
    print(f'{c}: {"en el dex" if f"L{c};".encode() in dex else "FALTA"}')
PY
EOF
docker exec vigia-build sh -c 'cd /work/h0b/limpio/app && npx tsc --noEmit -p . --allowImportingTsExtensions; cd /work/h0b/limpio/jvm && ./gradlew --no-daemon test -q; echo "jvm: $?"'
```

Esperado, con `<commit>` el del paso 5:

```
cambios en el clon limpio tras compilar: 0
sin-r8: versión <commit>, no depurable; ServicioGrabacion: exported=false foregroundServiceType=0x00000081
con-r8: versión <commit>, no depurable; ServicioGrabacion: exported=false foregroundServiceType=0x00000081
vigia/banco/puro/CortadorAdts: en el dex
expo/modules/banco/Grabador: en el dex
expo/modules/banco/CodificadorAac: en el dex
expo/modules/banco/ServicioGrabacion: en el dex
vigia/nucleo/FabricaSobres: en el dex
org/bouncycastle/crypto/hpke/HPKE: en el dex
vigia-shared/hpke-core.ts(3,75): error TS2307: Cannot find module '@hpke/core' or its corresponding type declarations.
jvm: 0
```

El único error de tipos es el de siempre (`hpke-core.ts`, que la app no importa): `P3.tsx` no da ninguno. Con `MAL` o `FALTA`, parar y revisar el paso que toca.

**Notas:**

- **Nota:** validado el 14-oct-2026 en `vigia-build` (imagen de H0a), en una copia del banco con las tareas 4 y 5: el módulo compiló sin avisos propios (`:banco:compileReleaseKotlin`), `tsc` solo dio el error de `hpke-core.ts`, y las dos builds desde un clon limpio salieron en verde con las comprobaciones del paso 7. Nada de esto se ejecutó en un teléfono: `AudioRecord`, `MediaCodec`, el Keystore, el servicio, el wake lock, los latidos y la carpeta externa se prueban por primera vez en la sesión 2 (tarea 14), con un ensayo de 1 min antes de los 30.
- **Nota:** el formato de la carpeta no se puede probar aquí contra el teléfono. Para que el teléfono y el simulado no se separen, `analisis.py` (tarea 7) rechaza cualquier campo que falte, sobre o tenga otro tipo, y el ensayo de la sesión 2 se analiza antes de la grabación de 30 min.
- **Nota:** el AudioSpecificConfig que debe dar `c2.android.aac.encoder` (FDK con transporte crudo y sin SBR) es `14 08`; si diera además la señal explícita de que no hay SBR (`56 e5 00`, como ffmpeg en MP4), también vale (tarea 5). Cualquier otro para la grabación con el error `AudioSpecificConfig …: se esperaba 1408`.
- **Nota:** la tasa está fija en 16 kHz (`HZ` en `Grabador.kt`, en `AudioRecord`, en el formato del códec, en `CortadorAdts(segundosFragmento * HZ)` y en los tiempos), y `analisis.py` (tarea 7) también mide a 16 kHz. Si el teléfono no da AAC-LC a 16 kHz (`formato=falla` en la sesión 2), el plan B de P3 (otra tasa u otro codificador) necesita antes de repetir la sesión 2 una tarea nueva con sus pruebas: la tasa como parámetro de `iniciar`, de `Grabador` y de la pantalla, `CortadorAdts(segundos × hz, hz)` (la tarea 5 ya admite la frecuencia), y `analisis.py` y el teléfono simulado con la tasa. Como la decisión de integración 6, no se escribe por adelantado.
- **Nota:** `arranques` mide desde el comienzo de cada arranque, sin el servicio (la app está en primer plano); el arranque completo con el servicio, desde el toque, queda en el evento `arranque` y en lo que devuelve `iniciar`. El criterio de P3 (menos de 2 s) se juzga con `primera_unidad_ms` de los 20 y con el del evento `arranque` de cada grabación (el ensayo, la de 30 min y las dos de P4), que la tarea 7 lee como `grabacion_ms`.
- **Nota:** sin la función que copiaría la grabación a `Download/`: el plan B del protocolo de resultados (logcat) no sirve para los sobres, que son binarios. Si en la sesión 1 `adb pull` de `Android/data` no funciona en el teléfono, hace falta esa función (y una build nueva) antes de la sesión 2.

---

### Tarea 7: Herramientas de la máquina para P3 y P4, probadas con el teléfono simulado

**Archivos (banco, `<banco>`):**
- Crear: `p3/maquina/pista.sh`, `p3/maquina/test_analisis.py`, `p3/maquina/analisis.py`, `p3/maquina/paquete.mts` y `p3/maquina/analizar.sh` (los dos `.sh` con modo 755, como `compilar.sh`).
- Sustituir: `jvm/simulado/src/main/kotlin/vigia/banco/simulado/Main.kt` (el mínimo del andamio; `jvm/simulado/build.gradle.kts` no cambia).
- Fuera del banco, en el volumen: `/work/h0b/p3/pista.wav` (la pista de las sesiones 2 y 3) y `/work/h0b/p3/simulado/` (la entrada sintética, la sesión simulada y su copia cambiada).

**Interfaces:**
- Consume:
  - Tarea 3: `/work/h0b/escucha/publica.b64u` y, solo por la entrada estándar de un contenedor efímero sin red, `<privada>/escucha/privada.b64u`.
  - Tarea 4: `/work/f2-h1` (shared de `f2-h1` con sus dependencias) y el proyecto `jvm/`, con `:simulado` (`application`, `mainClass` `vigia.banco.simulado.MainKt`).
  - Tarea 5: `CortadorAdts`. Tarea 6: la carpeta de grabación (la tabla de la tarea 6, con el evento `arranque` de `iniciar`), la tanda `p3-arranques` de `resultados.jsonl` y el criterio de que `motivo` sea `detener` y `error` nulo.
  - shared de `f2-h1` (`packages/shared/src/index.ts`): `criptoWebCrypto`, `esId`, `esSpkiP256`, `desempaquetarSobre`, `verificarRegistro`, `analizarRegistro`, `hashRegistro`, `firmarAcuse`, `bytesEntradaClave`, `crearPaquete`, `huella` y `unir`; el CLI `packages/shared/herramientas/verificar.ts` (`--zona`, `--claves`, `--huella`, `--clave-escucha` con la privada por la entrada estándar y `--audio`, que escribe con 0600 el audio de los fragmentos que cuentan, en orden de `seq`).
  - Núcleo de H1: `Adts.tramas`, `Adts.cabecera`, `FabricaSobres`, `FirmanteSoftware`, `Envoltura`, `HpkeBouncyCastle`, `Codificacion` y `Sobre.MAX_CUERPO`.
- Produce:
  - `p3/maquina/pista.sh <salida.wav>`: 45 min de silencio digital con un clic cada 10 s (10 ms de un tono de 1 kHz; el primero, a los 2 s), WAV PCM de 16 bits, mono y 16 kHz, 86 400 044 bytes, siempre los mismos (SHA-256 `c0400c42f8afe0f9014001934b32839b8ed94503461fcf0bf0c3062774c89468`). Dura 45 min para que ninguna grabación de 30 min acabe después que la pista (con 32 min, el último clic llegaba antes del final y `clics` fallaba sin que faltara audio). No pisa un archivo que exista. Es la única fuente de sonido de las sesiones 2 y 3 (DAT-01).
  - `jvm/simulado`, `simulado <entrada.aac> <files> <publica.b64u> <segundos por fragmento> <si|no>`: con un ADTS de ffmpeg (AAC-LC, 16 kHz, mono) escribe `<files>/p3/<incidente>/` exactamente como el grabador (`CortadorAdts`, `FabricaSobres` con `FirmanteSoftware`, `K` envuelta para la pública de escucha), con tiempos, eventos, latidos y resumen sintéticos sin deriva, y añade a `<files>/resultados.jsonl` una tanda `p3-arranques` de 20.
  - `p3/maquina/analizar.sh`, el único guion que corre en el contenedor efímero del contrato. `sh analizar.sh` lista las grabaciones de la sesión por hora de inicio (incidente, inicio en UTC, segundos, motivo, latidos y fragmentos; sin `resumen.json`, el inicio sale de eventos y latidos y el motivo es `sin_resumen`); `sh analizar.sh <incidente> p3|p4` analiza una e imprime un JSON (sale con 0 si todo pasa, 1 si no y 2 con la orden mal escrita). Entradas: `SESION` (`/sesion`, la carpeta subida del teléfono, con `files/` dentro), `F2H1` (`/work/f2-h1`), `DURACION_MIN` (1 800 s) y la privada de escucha por la entrada estándar, que solo lee el CLI `verificar`. Pasos: `paquete.mts` comprueba cada firma con `spki.der`, firma un acuse por registro con una clave de dev efímera no extraíble (`kid` `banco_p3`, la hora del acuse es la del teléfono) y arma el paquete (`crearPaquete`, con la envoltura `escucha`); `verificar` lo comprueba con `--claves` (la pública de dev), `--huella`, `--clave-escucha` y `--audio` al tmpfs; `ffprobe` y `ffmpeg` sacan el formato y el PCM, también en el tmpfs; y `analisis.py` da los veredictos. El audio en claro solo existe en el `/tmp` del contenedor.
  - El JSON: `{"incidente","modo","veredicto","criterios":{…},"eventos","ventana","resumen"}` (y `"bateria"` en P4). Cada criterio lleva `veredicto` (`pasa`, `falla`, `sin_datos` o, en los latidos, `sin_doze`) y sus cifras. P3: `carpeta`, `verificacion`, `muestras_frente_al_tiempo`, `formato`, `clics` (con `otros_sonidos`, `golpes` y `desplazados`) y `arranques` (con el de la propia grabación, `grabacion_ms`). P4 sin subida: `carpeta`, `verificacion`, `muestras_frente_al_tiempo`, `latidos` y `cierre`; la batería queda `sin_medir` (el cable USB carga el teléfono en el tramo A). `ventana` da el inicio y el fin de la grabación en UTC y en la hora del teléfono, para compararlos con `exit-info`.

Criterios y tolerancias (en `analisis.py`, con su justificación):

| Criterio | Pasa si | Por qué |
|---|---|---|
| `carpeta` | Están `incidente.txt`, `spki.der` (91 bytes), `escucha.env` (80), `000000.sobre` y `tiempos.jsonl`, y cada línea tiene sus campos con su tipo, sin claves de más | Así se ve en seguida si el teléfono y el simulado escriben cosas distintas |
| `verificacion` | Las firmas de todos los sobres valen con `spki.der` y `verificar` sale con 0 (`integro` o `incompleto`, sin fallos) | P3 se mide sobre lo que verifica, igual que hará la bóveda |
| `muestras_frente_al_tiempo` | Dura al menos `DURACION_MIN` y, contando desde la primera línea, el tiempo de `elapsedRealtimeNanos` y el de las muestras leídas nunca se separan 1 s o más | Criterio de P3: menos de 1 s en 30 min. Además cuenta los saltos de más de 100 ms entre líneas (audio perdido o lector parado) |
| `formato` | `aac`, `LC`, 16 000 Hz, mono y de 28,8 a 35,2 kb/s de datos AAC (sin las cabeceras ADTS) | "Unos 32 kb/s", con un 10 % de margen |
| `clics` | La rejilla de la pista se encuentra sin dar por bueno el primer evento: el periodo y la fase se estiman juntos (el periodo, con la mediana de las distancias de unos 10 s entre eventos; la fase, con el evento con cuya rejilla casan más eventos a 200 ms o menos). En ella, ningún clic falta, se repite ni queda desplazado entre el primero y el último; el primero calibra el retardo (arranque y códec) y el periodo se mide con el reloj del teléfono; cada clic y cada intervalo quedan a 20 ms o menos; el periodo no se aparta más de 1 000 ppm de 10 s; y los clics cubren la grabación: el primero llega en los primeros 11 s y el último a menos de 11 s del final. Un evento corto a más de 200 ms de la rejilla con clic a los dos lados (o antes del primero o después del último) es un golpe de la sala: cuenta en `golpes` y no hace fallar. Límite conocido: un golpe a 200 ms o menos de un clic cuenta como clic repetido y hace fallar | Una lectura o una unidad perdida son 64 ms (tres veces la tolerancia), y con 200 ms de margen siguen en la rejilla para medirlas; un clic más lejos de su sitio (audio perdido o de más) deja su posición vacía, así que cuenta en `desplazados` y no como golpe; el comienzo de un clic se mide con unos pocos ms de error; la diferencia entre el reloj del portátil y el del teléfono (hasta medio segundo en 30 min) la absorbe el periodo medido; más de 0,1 % sería una frecuencia de muestreo equivocada; la cobertura descubre una pista que se paró antes (el portátil se suspendió) o que empezó tarde; y como la fase no sale del primer evento, un golpe antes del primer clic no descoloca la rejilla |
| `arranques` | La última tanda tiene 20 o más, todas con la primera unidad AAC antes de 2 000 ms, y el arranque de la propia grabación (`grabacion_ms`: `primera_unidad_ms` de su evento `arranque`) también. Sin la tanda (el ensayo, que se analiza antes de los 20 arranques) o sin el evento, `sin_datos`, salvo que lo que haya ya pase de 2 000 ms | Criterio de P3. Los 20 van sin el servicio y con el proceso ya caliente; el de la grabación es el arranque real, desde el toque y con el servicio en primer plano |
| `latidos` (P4) | Ningún hueco de más de 65 s entre el inicio, cada latido y el fin; dura al menos `DURACION_MIN`; y al menos un latido con `doze` (si no, `sin_doze`: la prueba no pasó por Doze) | Uno por minuto, con 5 s de margen |
| `cierre` (P4) | `resumen.json` existe, `motivo` `detener`, `error` nulo, cierre y EOS, y `verificar` dice `integro` | La parte de "se vacía tras Detener" que se puede medir sin subida; `cola_ms` compara las unidades AAC con las muestras leídas (positivo: el retardo del códec; negativo: audio que se quedó en el códec al parar) |

Los clics se detectan en bloques de 1 ms: un evento son bloques por encima de 10 veces el ruido (la mediana de los picos), o de 1 000 si hay silencio digital; uno de más de 200 ms no es un clic y cuenta en `otros_sonidos` (en la sesión no debería haber ninguno: la sala va sin conversaciones). El comienzo es la primera muestra que llega a la mitad del pico. Los eventos cortos que no caen en la rejilla son `golpes` (un golpe o una puerta entre dos clics) o `desplazados` (clics fuera de su sitio). Las sesiones revisan `otros_sonidos` y `golpes` por DAT-01.

Las herramientas montan el volumen en solo lectura (`-v vigia-trabajo:/work:ro`): solo escriben en su `/tmp`, y así la privada, que pasa por un proceso que importa código del volumen, no puede quedarse en él. Los contenedores que reciben la privada o descifran audio llevan además `--log-driver none` (el daemon no guarda su salida) y `--memory 2g --memory-swap 2g` (sin memoria de intercambio, así ni la privada ni el audio acaban en el disco).

- [ ] **Paso 1: la pista de clics**

`<banco>/p3/maquina/pista.sh` (modo 755):

```sh
#!/bin/sh
# P3 (H0b, tarea 7): la pista de clics de las sesiones 2 y 3, la única fuente de sonido de la sala (DAT-01). 45 min
# de silencio digital con un clic cada 10 s (10 ms de un tono de 1 kHz; el primero, a los 2 s), en WAV PCM de 16 bits,
# mono, a 16 kHz: así ninguna grabación de 30 min acaba después que la pista. La persona responsable la reproduce en
# el portátil mientras graba el teléfono; analisis.py mide los clics en el audio descifrado.
# Uso: sh pista.sh <salida.wav> (no pisa un archivo que ya exista).
set -eu
if [ $# -ne 1 ]; then
    echo "Uso: sh pista.sh <salida.wav>" >&2
    exit 2
fi
# ffmpeg -n no pisa el archivo, pero sale con 0 igualmente (6.1.1): se comprueba antes.
if [ -e "$1" ]; then
    echo "Ya existe $1: no se pisa" >&2
    exit 1
fi
ffmpeg -v error -nostdin -n -f lavfi \
    -i "aevalsrc=exprs='0.8*sin(2*PI*1000*t)*gte(t,2)*lt(mod(t-2,10),0.01)':s=16000:d=2700" \
    -c:a pcm_s16le -fflags +bitexact -flags:a +bitexact "$1"
```

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
chmod 755 <banco>/p3/maquina/pista.sh
docker exec vigia-build sh -c 'sincronizar banco && mkdir -p /work/h0b/p3 && sh /work/banco/p3/maquina/pista.sh /work/h0b/p3/pista.wav && sha256sum /work/h0b/p3/pista.wav && stat -c "%s bytes" /work/h0b/p3/pista.wav && ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,duration -of default=noprint_wrappers=1 /work/h0b/p3/pista.wav; sh /work/banco/p3/maquina/pista.sh /work/h0b/p3/pista.wav; echo "salida: $?"'
```

Esperado:

```
c0400c42f8afe0f9014001934b32839b8ed94503461fcf0bf0c3062774c89468  /work/h0b/p3/pista.wav
86400044 bytes
codec_name=pcm_s16le
sample_rate=16000
channels=1
duration=2700.000000
Ya existe /work/h0b/p3/pista.wav: no se pisa
salida: 1
```

Si la pista ya existía (de una ejecución anterior), la primera orden da `Ya existe … no se pisa`: se comprueba su suma igual. ffmpeg 6.1.1 sale con 0 aunque `-n` le impida escribir; por eso el guion lo comprueba antes.

- [ ] **Paso 2: escribir las pruebas del análisis, que fallan**

`<banco>/p3/maquina/test_analisis.py`:

```python
"""Pruebas de analisis.py (H0b, tarea 7), solo con la biblioteca estándar.

Uso: python3 -I -B test_analisis.py (con -I la carpeta del guion no entra en sys.path: se añade abajo, porque
es la del código del banco, no la de los datos del teléfono).
"""
import json
import math
import os
import pathlib
import random
import sys
import tempfile
import unittest
from array import array

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analisis as a  # noqa: E402

HZ = 16_000
NS = 1_000_000_000


def pcm_con_clics(segundos, inicios, ruido=50, nivel=20_000, duracion=0.010, semilla=1):
    """PCM de 16 bits con ruido de fondo y un tono de 1 kHz de `duracion` s en cada inicio."""
    azar = random.Random(semilla)
    pcm = array('h', (azar.randint(-ruido, ruido) for _ in range(int(segundos * HZ))))
    for t in inicios:
        i0 = round(t * HZ)
        for i in range(int(duracion * HZ)):
            if i0 + i < len(pcm):
                pcm[i0 + i] = int(nivel * math.sin(2 * math.pi * 1000 * i / HZ))
    return pcm


def tiempos(segundos, perdida=None, ppm=0.0):
    """Una línea por segundo, como el lector; `perdida` = (segundo, muestras perdidas a partir de él)."""
    lineas = []
    t0 = 5 * NS
    for s in range(segundos + 1):
        muestras = 1_024 + s * HZ
        if perdida and s >= perdida[0]:
            muestras -= perdida[1]
        lineas.append({'muestras': muestras, 't_ns': t0 + round(s * NS * (1 + ppm / 1e6))})
    return lineas


def latidos(minutos, doze=True, faltan=()):
    lista = []
    for m in range(minutos + 1):
        if m in faltan:
            continue
        lista.append({'t_ns': 5 * NS + m * 60 * NS, 'hora': 1_700_000_000_000 + m * 60_000, 'muestras': m * 60 * HZ,
                      'fragmentos': m * 15, 'doze': doze and m > 0, 'interactiva': m == 0, 'ahorro': False,
                      'sin_optimizar': False, 'bateria': 80, 'cargando': True})
    return lista


class Clics(unittest.TestCase):
    def test_detecta_cada_clic_a_menos_de_1_ms(self):
        inicios = [2.5 + 10 * k for k in range(7)]
        r = a.detectar_clics(pcm_con_clics(65, inicios))
        self.assertEqual(len(r['clics']), 7)
        for medido, real in zip(r['clics'], inicios):
            self.assertLess(abs(medido - real), 0.001)
        self.assertEqual(r['otros'], 0)

    def test_un_sonido_largo_no_es_un_clic(self):
        pcm = pcm_con_clics(30, [2.0, 12.0, 22.0])
        largo = pcm_con_clics(0.5, [0.0], duracion=0.5, semilla=2)
        for i, v in enumerate(largo):
            pcm[round(16.0 * HZ) + i] = v
        r = a.detectar_clics(pcm)
        self.assertEqual(len(r['clics']), 3)
        self.assertEqual(r['otros'], 1)

    def test_en_su_sitio(self):
        r = a.analizar_clics([3.25 + 10 * k for k in range(180)])
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertEqual(r['detectados'], 180)
        self.assertAlmostEqual(r['retardo_s'], 3.25)
        self.assertLess(abs(r['deriva_ppm']), 1)
        self.assertEqual(r['faltan'], [])

    def test_un_bloque_perdido_desplaza_los_siguientes(self):
        # 1 024 muestras perdidas (64 ms) entre el clic 3 y el 4.
        clics = [3.0 + 10 * k - (0.064 if k >= 4 else 0) for k in range(180)]
        r = a.analizar_clics(clics)
        self.assertEqual(r['veredicto'], 'falla')
        self.assertGreater(r['max_error_intervalo_ms'], 20)

    def test_falta_un_clic(self):
        clics = [3.0 + 10 * k for k in range(20) if k != 7]
        r = a.analizar_clics(clics)
        self.assertEqual(r['veredicto'], 'falla')
        self.assertEqual(r['faltan'], [7])

    def test_un_clic_repetido(self):
        # Límite conocido: un evento a 200 ms o menos de un clic cuenta como un clic de más (aunque sea un golpe).
        r = a.analizar_clics(sorted([3.0 + 10 * k for k in range(20)] + [53.05]))
        self.assertEqual(r['veredicto'], 'falla')
        self.assertEqual(r['repetidos'], 1)

    def test_un_golpe_entre_dos_clics_no_es_un_clic(self):
        # Un golpe corto de la sala (una puerta, una cuchara) a más de 200 ms de cualquier clic.
        r = a.analizar_clics(sorted([3.0 + 10 * k for k in range(20)] + [47.3]))
        self.assertEqual(r['veredicto'], 'pasa', r)
        self.assertEqual((r['detectados'], r['esperados'], r['golpes'], r['repetidos']), (20, 20, 1, 0))

    def test_un_golpe_a_0_3_s_de_un_clic_tampoco(self):
        r = a.analizar_clics(sorted([3.0 + 10 * k for k in range(20)] + [53.3]))
        self.assertEqual(r['veredicto'], 'pasa', r)
        self.assertEqual((r['detectados'], r['golpes']), (20, 1))

    def test_un_golpe_antes_del_primer_clic_no_lo_sustituye(self):
        # Ni antes del primer clic ni después del último (dentro de la grabación): el retardo es el del primer clic.
        r = a.analizar_clics([1.0] + [3.0 + 10 * k for k in range(18)] + [176.0], duracion=180.0)
        self.assertEqual(r['veredicto'], 'pasa', r)
        self.assertEqual((r['retardo_s'], r['detectados'], r['golpes']), (3.0, 18, 2))

    def test_con_deriva_y_golpes_la_rejilla_sigue_a_los_clics(self):
        # Fase y periodo se estiman juntos: 300 ppm de deriva, un golpe antes del primer clic y otro a mitad.
        clics = [1.6 + 10.003 * k for k in range(180)]
        r = a.analizar_clics(sorted(clics + [0.9, 905.5]), duracion=1_800.0)
        self.assertEqual(r['veredicto'], 'pasa', r)
        self.assertEqual((r['detectados'], r['golpes'], r['retardo_s']), (180, 2, 1.6))
        self.assertAlmostEqual(r['deriva_ppm'], 300, delta=1)

    def test_4_s_perdidos_a_mitad_fallan_y_no_son_golpes(self):
        # 4 s de audio perdidos entre el clic 11 y el 12 (o entre el 3 y el 4): los clics de una parte quedan fuera
        # de la rejilla de la otra. Son clics desplazados, no golpes de la sala, y el criterio falla.
        for corte in (12, 4):
            r = a.analizar_clics([3.0 + 10 * k - (4.0 if k >= corte else 0.0) for k in range(20)], duracion=196.0)
            self.assertEqual(r['veredicto'], 'falla')
            self.assertEqual(r['golpes'], 0)
            self.assertEqual(r['desplazados'], min(corte, 20 - corte))

    def test_un_golpe_de_80_ms_en_el_audio_queda_en_golpes(self):
        # Del audio al veredicto: 80 ms de ruido fuerte entre dos clics son un evento corto que no cae en la rejilla.
        pcm = pcm_con_clics(120, [2.5 + 10 * k for k in range(12)])
        azar = random.Random(3)
        for i in range(round(0.080 * HZ)):
            pcm[round(47.3 * HZ) + i] = azar.randint(-5_000, 5_000)
        d = a.detectar_clics(pcm)
        r = a.analizar_clics(d['clics'], duracion=120.0)
        self.assertEqual((len(d['clics']), d['otros']), (13, 0))
        self.assertEqual(r['veredicto'], 'pasa', r)
        self.assertEqual((r['detectados'], r['golpes'], r['repetidos']), (12, 1, 0))

    def test_la_deriva_entre_los_dos_relojes_no_es_un_fallo(self):
        # El portátil y el teléfono tienen relojes distintos: 300 ppm son 0,54 s en 30 min.
        r = a.analizar_clics([1.0 + 10.003 * k for k in range(180)])
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertAlmostEqual(r['deriva_ppm'], 300, delta=1)
        self.assertGreater(r['max_error_acumulado_ms'], 500)

    def test_una_deriva_imposible_es_un_fallo(self):
        r = a.analizar_clics([1.0 + 10.02 * k for k in range(180)])
        self.assertEqual(r['veredicto'], 'falla')

    def test_sin_clics(self):
        self.assertEqual(a.analizar_clics([4.0])['veredicto'], 'sin_datos')

    def test_los_clics_cubren_toda_la_grabacion(self):
        # Si la pista se para antes (el portátil se suspende), faltan clics al final aunque los que hay estén bien.
        clics = [3.0 + 10 * k for k in range(18)]
        self.assertEqual(a.analizar_clics(clics, duracion=180.0)['veredicto'], 'pasa')
        corta = a.analizar_clics(clics[:10], duracion=180.0)
        self.assertEqual(corta['veredicto'], 'falla')
        self.assertAlmostEqual(corta['hueco_final_s'], 87.0)
        tarde = a.analizar_clics([25.0 + 10 * k for k in range(15)], duracion=180.0)
        self.assertEqual(tarde['veredicto'], 'falla')
        self.assertEqual(tarde['retardo_s'], 25.0)


class Tiempos(unittest.TestCase):
    def test_30_min_sin_desfase(self):
        r = a.analizar_tiempos(tiempos(1_800), 1_800)
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertEqual(r['duracion_s'], 1_800)
        self.assertEqual(r['max_desfase_s'], 0)
        self.assertEqual(r['saltos'], 0)

    def test_la_deriva_del_reloj_de_audio_cuenta_pero_pasa(self):
        r = a.analizar_tiempos(tiempos(1_800, ppm=100), 1_800)
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertAlmostEqual(r['deriva_ppm'], 100, delta=1)

    def test_mas_de_1_s_perdido_falla(self):
        r = a.analizar_tiempos(tiempos(1_800, perdida=(600, 20_000)), 1_800)
        self.assertEqual(r['veredicto'], 'falla')
        self.assertEqual(r['saltos'], 1)
        self.assertAlmostEqual(r['max_desfase_s'], 1.25)

    def test_corta_falla_salvo_que_se_pida_menos(self):
        self.assertEqual(a.analizar_tiempos(tiempos(120), 1_800)['veredicto'], 'falla')
        self.assertEqual(a.analizar_tiempos(tiempos(120), 120)['veredicto'], 'pasa')

    def test_horas_que_no_avanzan(self):
        lineas = tiempos(60)
        lineas[30]['t_ns'] = lineas[29]['t_ns']
        r = a.analizar_tiempos(lineas, 60)
        self.assertEqual(r['veredicto'], 'falla')

    def test_retraso_del_lector_con_audiotimestamp(self):
        lineas = tiempos(60)
        for x in lineas:
            x['ts_marco'] = x['muestras'] + 1_600
            x['ts_ns'] = x['t_ns']
        self.assertAlmostEqual(a.analizar_tiempos(lineas, 60)['max_retraso_lector_s'], 0.1)

    def test_sin_datos(self):
        self.assertEqual(a.analizar_tiempos([], 60)['veredicto'], 'sin_datos')


class Latidos(unittest.TestCase):
    def test_uno_por_minuto_en_doze(self):
        r = a.analizar_latidos(latidos(30), 5 * NS, 5 * NS + 1_800 * NS + 300_000_000, 1_800)
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertEqual(r['n'], 31)
        self.assertEqual(r['en_doze'], 30)
        self.assertLessEqual(r['max_hueco_s'], 60.3)

    def test_un_minuto_sin_latido(self):
        r = a.analizar_latidos(latidos(30, faltan=(12,)), 5 * NS, 5 * NS + 1_800 * NS, 1_800)
        self.assertEqual(r['veredicto'], 'falla')
        self.assertEqual(r['max_hueco_s'], 120)

    def test_sin_doze_no_prueba_nada(self):
        r = a.analizar_latidos(latidos(30, doze=False), 5 * NS, 5 * NS + 1_800 * NS, 1_800)
        self.assertEqual(r['veredicto'], 'sin_doze')

    def test_el_proceso_murio_a_los_10_min(self):
        r = a.analizar_latidos(latidos(10), 5 * NS, 5 * NS + 600 * NS, 1_800)
        self.assertEqual(r['veredicto'], 'falla')

    def test_sin_datos(self):
        self.assertEqual(a.analizar_latidos([], 0, NS, 60)['veredicto'], 'sin_datos')


class Formato(unittest.TestCase):
    def ffprobe(self, **cambios):
        s = {'codec_name': 'aac', 'profile': 'LC', 'sample_rate': '16000', 'channels': 1}
        s.update(cambios)
        return {'streams': [s]}

    def test_aac_lc_16k_mono_32k(self):
        # 30 min a 32 kbps: 7 200 000 bytes de datos AAC más 7 bytes de cabecera por trama.
        tramas = 1_800 * HZ // 1_024
        r = a.analizar_formato(self.ffprobe(), 7_200_000 + 7 * tramas, tramas * 1_024)
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertAlmostEqual(r['kbps'], 32.0, delta=0.05)

    def test_otra_frecuencia_falla(self):
        tramas = 600
        r = a.analizar_formato(self.ffprobe(sample_rate='44100'), 100_000, tramas * 1_024)
        self.assertEqual(r['veredicto'], 'falla')

    def test_un_bitrate_lejos_de_32_falla(self):
        tramas = 1_800 * HZ // 1_024
        self.assertEqual(a.analizar_formato(self.ffprobe(), 4_500_000, tramas * 1_024)['veredicto'], 'falla')

    def test_sin_audio(self):
        self.assertEqual(a.analizar_formato({}, 0, 0)['veredicto'], 'sin_datos')


class Arranques(unittest.TestCase):
    # El evento arranque de la grabación (iniciar: desde el toque, con el servicio en primer plano).
    GRABACION = {'servicio_ms': 35.0, 'primer_plano_ms': 60.0, 'primera_unidad_ms': 900.0}

    def linea(self, ms):
        return {'prueba': 'p3-arranques', 'hora': 1, 'datos': {'n': len(ms), 'arranques': [
            {'listo_ms': 50.0, 'grabando_ms': 120.0, 'primera_lectura_ms': 190.0, 'primera_unidad_ms': x} for x in ms]}}

    def test_20_por_debajo_de_2_s(self):
        r = a.analizar_arranques([{'prueba': 'info'}, self.linea([300.0] * 19 + [1_999.0])], self.GRABACION)
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertEqual(r['max_ms'], 1_999.0)

    def test_uno_de_mas_de_2_s(self):
        self.assertEqual(a.analizar_arranques([self.linea([300.0] * 19 + [2_100.0])], self.GRABACION)['veredicto'], 'falla')

    def test_menos_de_20(self):
        self.assertEqual(a.analizar_arranques([self.linea([300.0] * 19)], self.GRABACION)['veredicto'], 'falla')

    def test_cuenta_la_ultima_tanda(self):
        r = a.analizar_arranques([self.linea([3_000.0] * 20), self.linea([300.0] * 20)], self.GRABACION)
        self.assertEqual(r['veredicto'], 'pasa')

    def test_sin_datos(self):
        self.assertEqual(a.analizar_arranques([{'prueba': 'info'}], {})['veredicto'], 'sin_datos')

    def test_el_arranque_de_la_grabacion_tambien_cuenta(self):
        tanda = [self.linea([300.0] * 20)]
        lento = a.analizar_arranques(tanda, {'primera_unidad_ms': 2_100.0})
        self.assertEqual((lento['veredicto'], lento['grabacion_ms']), ('falla', 2_100.0))
        self.assertEqual(a.analizar_arranques(tanda, self.GRABACION)['grabacion_ms'], 900.0)

    def test_sin_tanda_se_ve_el_de_la_grabacion(self):
        # El ensayo se analiza antes de los 20 arranques: sin la tanda no hay veredicto, salvo que ya pase de 2 s.
        r = a.analizar_arranques([{'prueba': 'info'}], self.GRABACION)
        self.assertEqual((r['veredicto'], r['grabacion_ms']), ('sin_datos', 900.0))
        self.assertEqual(a.analizar_arranques([], {'primera_unidad_ms': 2_500.0})['veredicto'], 'falla')

    def test_sin_el_evento_de_la_grabacion(self):
        r = a.analizar_arranques([self.linea([300.0] * 20)], {'primera_unidad_ms': None})
        self.assertEqual((r['veredicto'], r['grabacion_ms']), ('sin_datos', None))


class Verificacion(unittest.TestCase):
    SOBRES = {'sobres': 47, 'fragmentos': 45, 'cierre': True, 'firmas_invalidas': [], 'ilegibles': []}
    BIEN = ('Claves del acuse: /tmp/x/claves.txt\n✓ 45 fragmentos, cadena íntegra, firmados por el dispositivo '
            '0123456789abcdef, recibidos entre 10:00 y 10:03 del 14-10-2026 (UTC+00:00)\n')

    def test_integro(self):
        r = a.analizar_verificacion(self.SOBRES, 0, self.BIEN)
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertEqual(r['estado'], 'integro')

    def test_incompleto_sin_cierre_verifica(self):
        texto = ('✓ 45 fragmentos firmados por el dispositivo 0123456789abcdef, recibidos entre 10:00 y 10:03 del '
                 '14-10-2026 (UTC+00:00); el paquete no está completo: mira los avisos\n- El teléfono dejó de enviar\n')
        r = a.analizar_verificacion(dict(self.SOBRES, cierre=False), 0, texto)
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertEqual(r['estado'], 'incompleto')
        self.assertEqual(r['hallazgos'], ['El teléfono dejó de enviar'])

    def test_un_fallo_del_verificador(self):
        texto = '✗ Hay fallos (1); lo que falla no cuenta. Fragmentos que verifican: 44\n- Fragmento 5: no coincide\n'
        r = a.analizar_verificacion(self.SOBRES, 1, texto)
        self.assertEqual(r['veredicto'], 'falla')
        self.assertEqual(r['estado'], 'fallido')

    def test_una_firma_invalida(self):
        r = a.analizar_verificacion(dict(self.SOBRES, firmas_invalidas=['000005.sobre']), 0, self.BIEN)
        self.assertEqual(r['veredicto'], 'falla')

    def test_sin_paquete(self):
        self.assertEqual(a.analizar_verificacion(None, None, '')['veredicto'], 'sin_datos')


def resumen(**cambios):
    r = {'incidente': 'AAAAAAAAAAAAAAAAAAAAAA', 'fuente': 'MIC', 'segundos_fragmento': 4, 'latidos': True,
         'codec': 'c2.android.aac.encoder', 'nivel_clave': 'tee', 'inicio_hora': 1_700_000_000_000,
         'inicio_ns': 5 * NS, 'fin_hora': 1_700_000_065_000, 'fin_ns': 70 * NS, 'muestras': 65 * HZ,
         'unidades': 1_017, 'fragmentos': 17, 'bytes_adts': 260_000, 'sobre_max': 16_900, 'cierre': True,
         'eos': True, 'motivo': 'detener', 'error': None, 'zona_min': -240}
    r.update(cambios)
    return r


class Cierre(unittest.TestCase):
    def test_tras_detener(self):
        r = a.analizar_cierre(resumen(), {'estado': 'integro'})
        self.assertEqual(r['veredicto'], 'pasa')
        self.assertAlmostEqual(r['cola_ms'], (1_017 * 1_024 - 65 * HZ) / 16)

    def test_sin_resumen_el_proceso_murio(self):
        self.assertEqual(a.analizar_cierre(None, {'estado': 'incompleto'})['veredicto'], 'falla')

    def test_parada_por_error(self):
        r = a.analizar_cierre(resumen(motivo='error', error='read -6 (ERROR_DEAD_OBJECT)'), {'estado': 'integro'})
        self.assertEqual(r['veredicto'], 'falla')

    def test_un_error_del_sellador_aunque_la_parada_fuera_normal(self):
        # Si falla el sellador (un CODEC_CONFIG inesperado, el Keystore), el lector para con motivo detener.
        r = a.analizar_cierre(resumen(error='vigia.nucleo.ErrorFormato: AudioSpecificConfig 1208'), {'estado': 'integro'})
        self.assertEqual(r['veredicto'], 'falla')


class Carpeta(unittest.TestCase):
    def escribir(self, d, **reemplazos):
        archivos = {
            'incidente.txt': b'AAAAAAAAAAAAAAAAAAAAAA\n',
            'spki.der': bytes(91),
            'escucha.env': bytes(80),
            '000000.sobre': b'x',
            'tiempos.jsonl': ''.join(json.dumps(x) + '\n' for x in tiempos(3)).encode(),
            'eventos.jsonl': b'{"tipo":"codec","t_ns":5000000000,"hora":1700000000000,"nombre":"c2.android.aac.encoder","respaldo":false}\n',
            'latidos.jsonl': ''.join(json.dumps(x) + '\n' for x in latidos(1)).encode(),
            'resumen.json': json.dumps(resumen()).encode() + b'\n',
        }
        archivos.update(reemplazos)
        for nombre, datos in archivos.items():
            if datos is not None:
                (pathlib.Path(d) / nombre).write_bytes(datos)

    def test_la_carpeta_del_contrato(self):
        with tempfile.TemporaryDirectory() as d:
            self.escribir(d)
            r = a.revisar_carpeta(pathlib.Path(d))
            self.assertEqual(r['veredicto'], 'pasa', r['problemas'])

    def test_un_campo_que_falta_o_de_otro_tipo(self):
        with tempfile.TemporaryDirectory() as d:
            self.escribir(d, **{'tiempos.jsonl': b'{"muestras":0,"t_ns":1}\n{"muestras":1024}\n{"muestras":true,"t_ns":5}\n'})
            r = a.revisar_carpeta(pathlib.Path(d))
            self.assertEqual(r['veredicto'], 'falla')
            self.assertEqual(len(r['problemas']), 2)

    def test_una_linea_que_no_es_json(self):
        with tempfile.TemporaryDirectory() as d:
            self.escribir(d, **{'eventos.jsonl': b'{"tipo":"codec","t_ns":1,"hora":2}\nno es json\n'})
            self.assertEqual(a.revisar_carpeta(pathlib.Path(d))['veredicto'], 'falla')

    def test_sin_resumen_ni_latidos_sigue_valiendo(self):
        # Si el proceso muere no hay resumen; sin latidos pedidos no hay latidos.jsonl.
        with tempfile.TemporaryDirectory() as d:
            self.escribir(d, **{'resumen.json': None, 'latidos.jsonl': None})
            self.assertEqual(a.revisar_carpeta(pathlib.Path(d))['veredicto'], 'pasa')

    def test_falta_la_apertura_o_la_clave(self):
        with tempfile.TemporaryDirectory() as d:
            self.escribir(d, **{'000000.sobre': None, 'spki.der': bytes(90)})
            self.assertEqual(len(a.revisar_carpeta(pathlib.Path(d))['problemas']), 2)


class Analisis(unittest.TestCase):
    """De punta a punta sobre una carpeta y un directorio de trabajo pequeños (65 s)."""

    def preparar(self, raiz, verificar_salida=0):
        carpeta = raiz / 'files' / 'p3' / 'AAAAAAAAAAAAAAAAAAAAAA'
        carpeta.mkdir(parents=True)
        Carpeta().escribir(carpeta, **{
            'tiempos.jsonl': ''.join(json.dumps(x) + '\n' for x in tiempos(65)).encode(),
            'latidos.jsonl': ''.join(json.dumps(x) + '\n' for x in latidos(1)).encode(),
            'eventos.jsonl': (b'{"tipo":"codec","t_ns":5000000000,"hora":1700000000000,"nombre":"c2.android.aac.encoder","respaldo":false}\n'
                              b'{"tipo":"arranque","t_ns":5300000000,"hora":1700000000300,"servicio_ms":35.0,"primer_plano_ms":60.0,'
                              b'"listo_ms":140.0,"grabando_ms":180.0,"primera_lectura_ms":250.0,"primera_unidad_ms":330.0}\n'),
        })
        trabajo = raiz / 'trabajo'
        trabajo.mkdir()
        pcm = pcm_con_clics(65, [2.5 + 10 * k for k in range(7)])
        (trabajo / 'audio.pcm').write_bytes(pcm.tobytes())
        tramas = len(pcm) // 1_024
        (trabajo / 'audio.aac').write_bytes(bytes(4_000 * 65 + 7 * tramas))
        (trabajo / 'ffprobe.json').write_text(json.dumps(Formato().ffprobe()))
        (trabajo / 'sobres.json').write_text(json.dumps(Verificacion.SOBRES))
        (trabajo / 'verificar.txt').write_text(Verificacion.BIEN)
        (trabajo / 'verificar.salida').write_text(f'{verificar_salida}\n')
        (trabajo / 'paquete.txt').write_text('paquete: 47 sobres (45 fragmentos, con cierre), 0 firmas inválidas, 0 ilegibles\n')
        resultados = raiz / 'files' / 'resultados.jsonl'
        resultados.write_text(json.dumps(Arranques().linea([400.0] * 20)) + '\n')
        return carpeta, trabajo, resultados

    def test_p3_y_p4_pasan(self):
        with tempfile.TemporaryDirectory() as d:
            carpeta, trabajo, resultados = self.preparar(pathlib.Path(d))
            p3 = a.analizar(carpeta, trabajo, resultados, 'p3', 60)
            self.assertEqual(p3['veredicto'], 'pasa', json.dumps(p3, ensure_ascii=False))
            self.assertEqual(sorted(p3['criterios']), ['arranques', 'carpeta', 'clics', 'formato', 'muestras_frente_al_tiempo', 'verificacion'])
            self.assertEqual(p3['criterios']['arranques']['grabacion_ms'], 330.0)
            self.assertEqual(p3['criterios']['verificacion']['paquete'], ['paquete: 47 sobres (45 fragmentos, con cierre), 0 firmas inválidas, 0 ilegibles'])
            p4 = a.analizar(carpeta, trabajo, resultados, 'p4', 60)
            self.assertEqual(p4['veredicto'], 'pasa', json.dumps(p4, ensure_ascii=False))
            self.assertEqual(sorted(p4['criterios']), ['carpeta', 'cierre', 'latidos', 'muestras_frente_al_tiempo', 'verificacion'])
            self.assertEqual(p4['bateria'], 'sin_medir: el cable USB carga el teléfono en el tramo A')

    def test_un_fallo_de_verificacion_hace_fallar_el_conjunto(self):
        with tempfile.TemporaryDirectory() as d:
            carpeta, trabajo, resultados = self.preparar(pathlib.Path(d), verificar_salida=1)
            (trabajo / 'verificar.txt').write_text('✗ Hay fallos (1); lo que falla no cuenta. Fragmentos que verifican: 16\n')
            self.assertEqual(a.analizar(carpeta, trabajo, resultados, 'p3', 60)['veredicto'], 'falla')

    def test_ventana_en_la_hora_del_telefono_para_comparar_con_exit_info(self):
        with tempfile.TemporaryDirectory() as d:
            carpeta, trabajo, resultados = self.preparar(pathlib.Path(d))
            v = a.analizar(carpeta, trabajo, resultados, 'p4', 60)['ventana']
            self.assertEqual(v, {'inicio_utc': '2023-11-14T22:13:20+00:00', 'fin_utc': '2023-11-14T22:14:25+00:00',
                                 'inicio_telefono': '2023-11-14T18:13:20-04:00', 'fin_telefono': '2023-11-14T18:14:25-04:00'})

    def test_sin_resumen_la_ventana_sale_de_eventos_y_latidos(self):
        # Si el sistema mata el proceso no hay resumen.json: la ventana va en UTC, sin la zona del teléfono.
        with tempfile.TemporaryDirectory() as d:
            carpeta, trabajo, resultados = self.preparar(pathlib.Path(d))
            (carpeta / 'resumen.json').unlink()
            p4 = a.analizar(carpeta, trabajo, resultados, 'p4', 60)
            self.assertEqual(p4['ventana'], {'inicio_utc': '2023-11-14T22:13:20+00:00', 'fin_utc': '2023-11-14T22:14:20+00:00'})
            self.assertEqual(p4['criterios']['cierre']['veredicto'], 'falla')

    def test_lista_las_grabaciones_por_hora_de_inicio(self):
        # La que no tiene resumen.json (el sistema mató el proceso) toma la hora de sus eventos y latidos.
        with tempfile.TemporaryDirectory() as d:
            carpeta, _, _ = self.preparar(pathlib.Path(d))
            muerta = carpeta.parent / 'BBBBBBBBBBBBBBBBBBBBBB'
            muerta.mkdir()
            Carpeta().escribir(muerta, **{'incidente.txt': b'BBBBBBBBBBBBBBBBBBBBBB\n', 'resumen.json': None,
                                          'eventos.jsonl': b'{"tipo":"codec","t_ns":1,"hora":1600000000000}\n',
                                          'latidos.jsonl': b''})
            self.assertEqual(a.listar(carpeta.parent), [
                {'incidente': 'BBBBBBBBBBBBBBBBBBBBBB', 'inicio_utc': '2020-09-13T12:26:40+00:00', 'segundos': 3.1,
                 'motivo': 'sin_resumen', 'latidos': False, 'fragmentos': 0},
                {'incidente': 'AAAAAAAAAAAAAAAAAAAAAA', 'inicio_utc': '2023-11-14T22:13:20+00:00', 'segundos': 65.0,
                 'motivo': 'detener', 'latidos': True, 'fragmentos': 17}])


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Paso 3: ejecutarlas y ver que fallan**

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /tmp && python3 -I -B /work/banco/p3/maquina/test_analisis.py'
```

Esperado: un `Traceback` que acaba en `ModuleNotFoundError: No module named 'analisis'`.

- [ ] **Paso 4: escribir el análisis**

`<banco>/p3/maquina/analisis.py`:

```python
"""Análisis de P3 y P4 sin subida (H0b, tarea 7), solo con la biblioteca estándar (python3 -I).

Lee la carpeta de grabación del contrato (tiempos, eventos, latidos y resumen), resultados.jsonl de la sesión y lo
que analizar.sh deja en su directorio de trabajo del tmpfs (sobres.json de paquete.mts, la salida del CLI verificar,
ffprobe.json, el ADTS descifrado y su PCM) e imprime un JSON con un veredicto por criterio del plan maestro.
Nunca imprime audio ni claves. Sale con 0 si todo pasa y con 1 si no.

Uso: python3 -I -B analisis.py --lista <carpeta p3>
     python3 -I -B analisis.py --carpeta <grabación> --trabajo <dir> --resultados <resultados.jsonl> --modo p3|p4
         [--duracion-min <s>]
"""
import argparse
import json
import math
import pathlib
import re
import sys
from array import array
from datetime import datetime, timedelta, timezone

HZ = 16_000
NS = 1_000_000_000
MUESTRAS_POR_TRAMA = 1_024

# Clics (P3), uno cada 10 s. Tolerancia de 20 ms: una lectura de AudioRecord o una unidad AAC perdida o repetida son
# 1 024 muestras (64 ms) y mueven todos los clics siguientes tres veces más que eso, mientras que el comienzo de un
# clic tras AAC a 32 kbps se mide con unos pocos ms de error. La diferencia entre el reloj del portátil y el del
# teléfono (decenas o cientos de ppm, hasta medio segundo en 30 min) la absorbe el periodo medido, que no puede
# apartarse más de 1 000 ppm (0,1 %) de 10 s: más sería una frecuencia de muestreo equivocada.
PERIODO_CLICS = 10.0
TOLERANCIA_CLICS = 0.020
MAX_PPM = 1_000.0
# Un evento corto a más de 200 ms de cualquier posición de la rejilla de los clics no es un clic. Si las dos posiciones
# que lo rodean tienen su clic (o caen fuera de la grabación), es un golpe de la sala y no hace fallar; si a alguna le
# falta, es un clic desplazado (audio perdido o de más) y sí. Con 200 ms, los clics movidos por unas pocas unidades
# AAC perdidas (64 ms cada una) siguen en la rejilla y fallan por su error. Límite conocido: un golpe a 200 ms o menos
# de un clic cuenta como un clic de más y hace fallar.
MARGEN_CLICS = 0.2
# Muestras frente al tiempo (P3): menos de 1 s en 30 min. Un salto de más de 100 ms entre dos líneas seguidas (una
# por segundo) es audio perdido o un lector parado.
MAX_DESFASE = 1.0
SALTO = 0.1
# Latidos (P4): uno por minuto, contado en el hilo lector; 5 s de margen sobre los 60.
PERIODO_LATIDO = 60.0
TOLERANCIA_LATIDO = 5.0
# Formato (P3): "unos 32 kb/s", con un 10 % de margen, sobre los datos AAC sin las cabeceras ADTS (7 bytes por trama).
KBPS = 32.0
TOLERANCIA_KBPS = 0.10
# Arranques (P3): los 20 en menos de 2 s.
ARRANQUES = 20
MAX_ARRANQUE_MS = 2_000.0
BATERIA_A = 'sin_medir: el cable USB carga el teléfono en el tramo A'


def _entero(x):
    return type(x) is int


def _numero(x):
    return type(x) in (int, float)


def _bool(x):
    return type(x) is bool


def _texto(x):
    return type(x) is str


def _texto_o_nulo(x):
    return x is None or type(x) is str


# Campos de la carpeta de grabación (contrato del banco): obligatorios y opcionales. En eventos.jsonl cada tipo
# añade los suyos; en los demás, una clave desconocida es un error (así se ve si el teléfono y el simulado divergen).
CAMPOS = {
    'tiempos.jsonl': ({'muestras': _entero, 't_ns': _entero}, {'ts_marco': _entero, 'ts_ns': _entero}, True),
    'eventos.jsonl': ({'tipo': _texto, 't_ns': _entero, 'hora': _entero}, {}, False),
    'latidos.jsonl': ({'t_ns': _entero, 'hora': _entero, 'muestras': _entero, 'fragmentos': _entero, 'doze': _bool,
                       'interactiva': _bool, 'ahorro': _bool, 'sin_optimizar': _bool, 'bateria': _entero,
                       'cargando': _bool}, {}, True),
    'resumen.json': ({'incidente': _texto, 'fuente': _texto, 'segundos_fragmento': _entero, 'latidos': _bool,
                      'codec': _texto_o_nulo, 'nivel_clave': _texto_o_nulo, 'inicio_hora': _entero,
                      'inicio_ns': _entero, 'fin_hora': _entero, 'fin_ns': _entero, 'muestras': _entero,
                      'unidades': _entero, 'fragmentos': _entero, 'bytes_adts': _entero, 'sobre_max': _entero,
                      'cierre': _bool, 'eos': _bool, 'motivo': _texto, 'error': _texto_o_nulo, 'zona_min': _entero},
                     {}, True),
}
PATRON_ID = re.compile(r'[A-Za-z0-9_-]{22}')
PATRON_SOBRE = re.compile(r'[0-9]{6}\.sobre')


def _problemas(obj, nombre):
    obligatorios, opcionales, estricto = CAMPOS[nombre]
    if not isinstance(obj, dict):
        return ['no es un objeto JSON']
    p = [f'falta {k}' for k in obligatorios if k not in obj]
    p += [f'{k} de otro tipo' for k, ok in {**obligatorios, **opcionales}.items() if k in obj and not ok(obj[k])]
    if estricto:
        p += [f'{k} desconocido' for k in obj if k not in obligatorios and k not in opcionales]
    return p


def _leer_lineas(ruta):
    """Las líneas JSON de un .jsonl y los números de las que no son JSON."""
    lineas, malas = [], []
    if not ruta.is_file():
        return lineas, malas
    partes = ruta.read_bytes().split(b'\n')
    if partes and partes[-1] == b'':
        partes.pop()
    for n, linea in enumerate(partes, 1):
        try:
            lineas.append((n, json.loads(linea)))
        except ValueError:
            malas.append(n)
    return lineas, malas


def leer_carpeta(carpeta):
    """Lo válido de la carpeta de grabación y la lista de problemas de formato."""
    problemas = []
    datos = {'tiempos': [], 'eventos': [], 'latidos': [], 'resumen': None, 'incidente': None, 'sobres': 0,
             'cierre': (carpeta / 'cierre.sobre').is_file()}
    incidente = carpeta / 'incidente.txt'
    texto = incidente.read_bytes().decode('ascii', 'replace').strip() if incidente.is_file() else ''
    if PATRON_ID.fullmatch(texto):
        datos['incidente'] = texto
    else:
        problemas.append('incidente.txt: falta o no es un id de 22 caracteres')
    for nombre, largo in (('spki.der', 91), ('escucha.env', 80)):
        ruta = carpeta / nombre
        if not ruta.is_file() or ruta.stat().st_size != largo:
            problemas.append(f'{nombre}: falta o no mide {largo} bytes')
    if not (carpeta / '000000.sobre').is_file():
        problemas.append('000000.sobre: falta la apertura')
    datos['sobres'] = sum(1 for p in carpeta.iterdir() if PATRON_SOBRE.fullmatch(p.name) and p.name != '000000.sobre')
    for nombre in ('tiempos.jsonl', 'eventos.jsonl', 'latidos.jsonl'):
        lineas, malas = _leer_lineas(carpeta / nombre)
        problemas += [f'{nombre} línea {n}: no es JSON' for n in malas]
        for n, obj in lineas:
            p = _problemas(obj, nombre)
            if p:
                problemas.append(f'{nombre} línea {n}: ' + ', '.join(p))
            else:
                datos[nombre.split('.')[0]].append(obj)
    if not datos['tiempos']:
        problemas.append('tiempos.jsonl: falta o no tiene líneas válidas')
    ruta = carpeta / 'resumen.json'
    if ruta.is_file():
        try:
            resumen = json.loads(ruta.read_bytes())
        except ValueError:
            resumen = None
        p = _problemas(resumen, 'resumen.json')
        if not p and datos['incidente'] is not None and resumen['incidente'] != datos['incidente']:
            p = ['incidente distinto del de incidente.txt']
        if p:
            problemas.append('resumen.json: ' + ', '.join(p))
        else:
            datos['resumen'] = resumen
    return datos, problemas


def revisar_carpeta(carpeta):
    datos, problemas = leer_carpeta(carpeta)
    return {'veredicto': 'falla' if problemas else 'pasa', 'problemas': problemas[:10], 'fragmentos': datos['sobres'],
            'cierre': datos['cierre'], 'resumen': datos['resumen'] is not None,
            'lineas': {k: len(datos[k]) for k in ('tiempos', 'eventos', 'latidos')}}


def leer_pcm(ruta):
    """PCM s16le de ffmpeg como array de enteros de 16 bits."""
    pcm = array('h')
    if ruta.is_file():
        datos = ruta.read_bytes()
        pcm.frombytes(datos[:len(datos) - len(datos) % 2])
        if sys.byteorder == 'big':
            pcm.byteswap()
    return pcm


def detectar_clics(pcm, hz=HZ):
    """Comienzos de los clics, en s. Picos por bloques de 1 ms; un evento son bloques por encima de 10 veces el ruido
    (la mediana de los picos) o de 1 000 con silencio digital, con huecos de menos de 50 ms. Un evento de más de
    200 ms no es un clic (cuenta en `otros`). El comienzo es la primera muestra que llega a la mitad del pico."""
    bloque = hz // 1_000
    n = len(pcm) // bloque
    if n == 0:
        return {'clics': [], 'otros': 0, 'ruido': 0, 'umbral': None}
    picos = array('i', (max(max(t), -min(t)) for t in (pcm[i * bloque:(i + 1) * bloque] for i in range(n))))
    ruido = sorted(picos)[n // 2]
    umbral = max(10 * ruido, 1_000)
    clics, otros, i = [], 0, 0
    while i < n:
        if picos[i] < umbral:
            i += 1
            continue
        inicio = fin = i
        j = i + 1
        while j < n and j - fin <= 50:
            if picos[j] >= umbral:
                fin = j
            j += 1
        if fin - inicio + 1 > 200:
            otros += 1
        else:
            pico = max(picos[inicio:fin + 1])
            k = max(0, inicio - 5) * bloque
            while abs(pcm[k]) * 2 < pico:
                k += 1
            clics.append(k / hz)
        i = j
    return {'clics': clics, 'otros': otros, 'ruido': ruido, 'umbral': umbral}


def analizar_clics(clics, duracion=None, periodo=PERIODO_CLICS, tolerancia=TOLERANCIA_CLICS, max_ppm=MAX_PPM,
                   margen=MARGEN_CLICS):
    """Los eventos cortos de detectar_clics frente a la rejilla de la pista. El periodo y la fase se estiman juntos,
    sin dar por bueno el primer evento: el periodo es la mediana de las distancias de un `periodo` (± `margen`) entre
    eventos, y la fase, la del evento con cuya rejilla casan más eventos a `margen` o menos. Cada posición de la
    rejilla se queda con su evento más cercano (su clic); otro a `margen` o menos de la misma posición es un clic
    repetido, y uno más lejos de todas, un golpe o un clic desplazado (ver MARGEN_CLICS). Con los clics, el primero
    calibra el retardo (arranque y códec) y los demás deben caer cada `periodo` s según el reloj del teléfono
    (pendiente de mínimos cuadrados), cada uno y cada intervalo a menos de `tolerancia` s. Los clics cubren la
    grabación: el primero llega en el primer periodo (la pista suena antes de iniciar) y, con la `duracion` del audio,
    el último a menos de un periodo del final (si no, la pista se paró antes); 1 s de margen en los dos."""
    eventos = sorted(clics)
    if len(eventos) < 2:
        return {'veredicto': 'sin_datos', 'detectados': len(eventos)}
    distancias = []
    for i, x in enumerate(eventos):
        for y in eventos[i + 1:]:
            if y - x > periodo + margen:
                break
            if y - x >= periodo - margen:
                distancias.append(y - x)
    paso = sorted(distancias)[len(distancias) // 2] if distancias else periodo

    def lejos(x, ancla):
        n = (x - ancla) / paso
        return abs(n - round(n)) * paso

    ancla = min(eventos, key=lambda b: (-sum(lejos(x, b) <= margen for x in eventos),
                                        sum(min(lejos(x, b), margen) for x in eventos)))
    en_rejilla, fuera = {}, []
    for x in eventos:
        k = round((x - ancla) / paso)
        if abs(x - ancla - k * paso) <= margen:
            en_rejilla.setdefault(k, []).append(x)
        else:
            fuera.append(x)
    clic = {k: min(v, key=lambda x: abs(x - ancla - k * paso)) for k, v in en_rejilla.items()}
    repetidos = sum(len(v) - 1 for v in en_rejilla.values())

    def cubierta(k):
        t = ancla + k * paso
        return k in clic or t < 0 or (duracion is not None and t > duracion)

    golpes = 0
    for x in fuera:
        k = math.floor((x - ancla) / paso)
        golpes += cubierta(k) and cubierta(k + 1)
    desplazados = len(fuera) - golpes
    if len(clic) < 2:
        return {'veredicto': 'sin_datos', 'detectados': len(clic), 'golpes': golpes, 'desplazados': desplazados}
    k0 = min(clic)
    ks = [k - k0 for k in sorted(clic)]
    clics = [clic[k] for k in sorted(clic)]
    c0 = clics[0]
    faltan = sorted(set(range(ks[-1] + 1)) - set(ks))
    mk, mc = sum(ks) / len(ks), sum(clics) / len(clics)
    varianza = sum((k - mk) ** 2 for k in ks)
    medido = sum((k - mk) * (c - mc) for k, c in zip(ks, clics)) / varianza
    ppm = (medido / periodo - 1) * 1e6
    residuos = [c - (c0 + k * medido) for k, c in zip(ks, clics)]
    intervalos = [(c2 - c1) - medido for (k1, c1), (k2, c2) in zip(zip(ks, clics), zip(ks[1:], clics[1:])) if k2 - k1 == 1]
    acumulado = [c - (c0 + k * periodo) for k, c in zip(ks, clics)]
    max_residuo = max(abs(r) for r in residuos)
    max_intervalo = max((abs(x) for x in intervalos), default=0.0)
    hueco_final = duracion - clics[-1] if duracion is not None else None
    cubre = c0 <= periodo + 1 and (hueco_final is None or hueco_final <= periodo + 1)
    pasa = (repetidos == 0 and desplazados == 0 and not faltan and max_residuo <= tolerancia
            and max_intervalo <= tolerancia and abs(ppm) <= max_ppm and cubre)
    return {'veredicto': 'pasa' if pasa else 'falla', 'detectados': len(clics), 'esperados': ks[-1] + 1,
            'faltan': faltan[:20], 'repetidos': repetidos, 'desplazados': desplazados, 'golpes': golpes,
            'hueco_final_s': round(hueco_final, 3) if hueco_final is not None else None,
            'retardo_s': round(c0, 4), 'periodo_s': round(medido, 6),
            'deriva_ppm': round(ppm, 1) + 0.0, 'max_error_ms': round(max_residuo * 1_000, 1),
            'max_error_intervalo_ms': round(max_intervalo * 1_000, 1),
            'max_error_acumulado_ms': round(max(abs(x) for x in acumulado) * 1_000, 1),
            'tolerancia_ms': round(tolerancia * 1_000, 1), 'max_ppm': max_ppm}


def analizar_tiempos(tiempos, duracion_min, hz=HZ):
    """Desfase entre el tiempo de elapsedRealtimeNanos y el de las muestras leídas, desde la primera línea."""
    if len(tiempos) < 2:
        return {'veredicto': 'sin_datos', 'lineas': len(tiempos)}
    t0, f0 = tiempos[0]['t_ns'], tiempos[0]['muestras']
    avanza = all(b['t_ns'] > a['t_ns'] and b['muestras'] >= a['muestras'] for a, b in zip(tiempos, tiempos[1:]))
    desfases = [(x['t_ns'] - t0) / NS - (x['muestras'] - f0) / hz for x in tiempos]
    duracion = (tiempos[-1]['t_ns'] - t0) / NS
    max_desfase = max(abs(d) for d in desfases)
    retrasos = [(x['ts_marco'] - x['muestras']) / hz for x in tiempos if 'ts_marco' in x]
    pasa = avanza and duracion >= duracion_min and max_desfase < MAX_DESFASE
    return {'veredicto': 'pasa' if pasa else 'falla', 'duracion_s': round(duracion, 3), 'duracion_min_s': duracion_min,
            'max_desfase_s': round(max_desfase, 4), 'desfase_final_s': round(desfases[-1], 4),
            'deriva_ppm': round(desfases[-1] / duracion * 1e6, 1) + 0.0 if duracion > 0 else None,
            'saltos': sum(1 for x, y in zip(desfases, desfases[1:]) if abs(y - x) > SALTO),
            'max_hueco_s': round(max((b['t_ns'] - a['t_ns']) / NS for a, b in zip(tiempos, tiempos[1:])), 3),
            'avanza': avanza, 'max_retraso_lector_s': round(max(retrasos), 4) if retrasos else None,
            'lineas': len(tiempos)}


def analizar_latidos(latidos, inicio_ns, fin_ns, duracion_min):
    """Ningún minuto sin latido entre el inicio y el fin de la grabación, y al menos uno en Doze."""
    if not latidos:
        return {'veredicto': 'sin_datos', 'n': 0}
    puntos = [inicio_ns] + [x['t_ns'] for x in latidos] + [fin_ns]
    max_hueco = max((b - a) / NS for a, b in zip(puntos, puntos[1:]))
    duracion = (fin_ns - inicio_ns) / NS
    en_doze = sum(1 for x in latidos if x['doze'])
    if max_hueco > PERIODO_LATIDO + TOLERANCIA_LATIDO or duracion < duracion_min:
        veredicto = 'falla'
    else:
        veredicto = 'pasa' if en_doze else 'sin_doze'
    return {'veredicto': veredicto, 'n': len(latidos), 'max_hueco_s': round(max_hueco, 3),
            'tolerancia_s': PERIODO_LATIDO + TOLERANCIA_LATIDO, 'duracion_s': round(duracion, 3),
            'duracion_min_s': duracion_min, 'en_doze': en_doze,
            'pantalla_encendida': sum(1 for x in latidos if x['interactiva']),
            'ahorro': any(x['ahorro'] for x in latidos), 'sin_optimizar': latidos[0]['sin_optimizar'],
            'cargando': all(x['cargando'] for x in latidos),
            'bateria': [latidos[0]['bateria'], latidos[-1]['bateria']]}


def analizar_formato(ffprobe, bytes_audio, muestras_audio, hz=HZ):
    streams = (ffprobe or {}).get('streams') or []
    if not streams or not muestras_audio:
        return {'veredicto': 'sin_datos'}
    s = streams[0]
    duracion = muestras_audio / hz
    tramas = muestras_audio // MUESTRAS_POR_TRAMA
    kbps = (bytes_audio - 7 * tramas) * 8 / duracion / 1_000
    try:
        frecuencia = int(s.get('sample_rate') or 0)
    except ValueError:
        frecuencia = 0
    pasa = (s.get('codec_name') == 'aac' and s.get('profile') == 'LC' and frecuencia == hz and s.get('channels') == 1
            and abs(kbps - KBPS) <= KBPS * TOLERANCIA_KBPS)
    return {'veredicto': 'pasa' if pasa else 'falla', 'codec': s.get('codec_name'), 'perfil': s.get('profile'),
            'hz': frecuencia, 'canales': s.get('channels'), 'kbps': round(kbps, 2),
            'kbps_con_cabeceras': round(bytes_audio * 8 / duracion / 1_000, 2), 'duracion_s': round(duracion, 3),
            'tramas': tramas}


def _tanda(resultados):
    """La última tanda de arranques guardada (prueba p3-arranques): 20 o más, todos por debajo del límite."""
    tandas = [r for r in resultados if isinstance(r, dict) and r.get('prueba') == 'p3-arranques']
    if not tandas:
        return {'veredicto': 'sin_datos'}
    datos = tandas[-1].get('datos')
    lista = datos.get('arranques') if isinstance(datos, dict) else None
    campos = ('grabando_ms', 'primera_lectura_ms', 'primera_unidad_ms')
    if not isinstance(lista, list) or not lista or not all(isinstance(x, dict) and all(_numero(x.get(c)) for c in campos) for x in lista):
        return {'veredicto': 'falla', 'motivo': 'tanda sin los tiempos de cada arranque'}
    unidad = [x['primera_unidad_ms'] for x in lista]
    orden = sorted(unidad)
    return {'veredicto': 'pasa' if len(unidad) >= ARRANQUES and orden[-1] < MAX_ARRANQUE_MS else 'falla',
            'n': len(unidad), 'primero_ms': unidad[0], 'mediana_ms': orden[len(orden) // 2], 'max_ms': orden[-1],
            'max_grabando_ms': max(x['grabando_ms'] for x in lista),
            'max_primera_lectura_ms': max(x['primera_lectura_ms'] for x in lista)}


def analizar_arranques(resultados, arranque):
    """La última tanda de arranques (sin el servicio y con el proceso ya caliente) y el arranque de la propia
    grabación (`primera_unidad_ms` del evento arranque de iniciar: desde el toque, con el servicio en primer plano).
    Pasa si los dos llegan a la primera unidad AAC antes de 2 s. Sin la tanda (el ensayo se analiza antes de los
    arranques) o sin el evento, sin_datos, salvo que lo que hay ya pase de 2 s."""
    tanda = _tanda(resultados)
    grabacion = arranque.get('primera_unidad_ms')
    grabacion = grabacion if _numero(grabacion) else None
    veredictos = {tanda['veredicto'], 'sin_datos' if grabacion is None else 'pasa' if grabacion < MAX_ARRANQUE_MS else 'falla'}
    veredicto = 'falla' if 'falla' in veredictos else 'sin_datos' if 'sin_datos' in veredictos else 'pasa'
    return dict(tanda, veredicto=veredicto, grabacion_ms=grabacion, limite_ms=MAX_ARRANQUE_MS)


def analizar_verificacion(sobres, salida, texto):
    """Firmas de los sobres (paquete.mts) y el CLI verificar de shared, con la clave de escucha."""
    if sobres is None or salida is None:
        return {'veredicto': 'sin_datos'}
    lineas = texto.splitlines()
    resumen = next((x for x in lineas if x.startswith(('✓', '✗'))), None)
    if resumen is None:
        estado = 'sin_resumen'
    elif resumen.startswith('✗'):
        estado = 'fallido'
    else:
        estado = 'integro' if 'cadena íntegra' in resumen else 'incompleto'
    pasa = (salida == 0 and estado in ('integro', 'incompleto') and not sobres.get('firmas_invalidas')
            and not sobres.get('ilegibles'))
    return {'veredicto': 'pasa' if pasa else 'falla', 'estado': estado, 'salida': salida, 'resumen': resumen,
            'hallazgos': [x[2:] for x in lineas if x.startswith('- ')][:20], 'sobres': sobres.get('sobres'),
            'fragmentos': sobres.get('fragmentos'), 'firmas_invalidas': sobres.get('firmas_invalidas'),
            'ilegibles': sobres.get('ilegibles')}


def analizar_cierre(resumen, verificacion):
    """P4 sin subida: tras Detener la grabación se cierra entera y sin errores (EOS del códec, cierre firmado y cadena
    íntegra)."""
    if not resumen:
        return {'veredicto': 'falla', 'motivo': 'sin resumen.json: el proceso murió o no llegó a cerrar'}
    pasa = (resumen['motivo'] == 'detener' and resumen['error'] is None and resumen['cierre'] and resumen['eos']
            and verificacion.get('estado') == 'integro')
    return {'veredicto': 'pasa' if pasa else 'falla', 'motivo': resumen['motivo'], 'error': resumen['error'],
            'cierre': resumen['cierre'], 'eos': resumen['eos'], 'verificacion': verificacion.get('estado'),
            # Unidades AAC frente a muestras leídas: positivo, el retardo del códec; negativo, la cola perdida al parar.
            'cola_ms': round((resumen['unidades'] * MUESTRAS_POR_TRAMA - resumen['muestras']) / (HZ / 1_000), 1)}


def _ventana(resumen, horas):
    """Inicio y fin de la grabación en UTC y en la hora del teléfono, para compararlos con exit-info. Sin
    resumen.json (el proceso murió), salen de las horas de eventos y latidos, solo en UTC."""
    if resumen:
        extremos, zonas = (resumen['inicio_hora'], resumen['fin_hora']), {'utc': timezone.utc, 'telefono': timezone(timedelta(minutes=resumen['zona_min']))}
    elif horas:
        extremos, zonas = (min(horas), max(horas)), {'utc': timezone.utc}
    else:
        return None
    return {f'{parte}_{nombre}': datetime.fromtimestamp(ms / 1_000, z).isoformat(timespec='seconds')
            for nombre, z in zonas.items() for parte, ms in zip(('inicio', 'fin'), extremos)}


def _eventos(eventos):
    tipos = {}
    for e in eventos:
        tipos[e['tipo']] = tipos.get(e['tipo'], 0) + 1
    primero = {e['tipo']: e for e in reversed(eventos)}
    return {'tipos': tipos, 'errores': [str(e.get('detalle')) for e in eventos if e['tipo'] == 'error'][:10],
            'silenciado': [e.get('silenciado') for e in eventos if e['tipo'] == 'silenciado'][:10],
            'codec': primero.get('codec', {}).get('nombre'), 'respaldo': primero.get('codec', {}).get('respaldo'),
            'csd': primero.get('csd', {}).get('hex'),
            'arranque': {k: v for k, v in primero.get('arranque', {}).items() if k.endswith('_ms')}}


def _json(ruta):
    try:
        return json.loads(ruta.read_bytes()) if ruta.is_file() else None
    except ValueError:
        return None


def analizar(carpeta, trabajo, resultados, modo, duracion_min):
    datos, problemas = leer_carpeta(carpeta)
    resumen = datos['resumen']
    eventos = _eventos(datos['eventos'])
    salida = (trabajo / 'verificar.salida').read_text().strip() if (trabajo / 'verificar.salida').is_file() else ''
    texto = (trabajo / 'verificar.txt').read_text('utf-8', 'replace') if (trabajo / 'verificar.txt').is_file() else ''
    verificacion = analizar_verificacion(_json(trabajo / 'sobres.json'), int(salida) if salida.isdigit() else None, texto)
    # Lo que dijo paquete.mts (sus cifras o por qué no armó el paquete).
    paquete = trabajo / 'paquete.txt'
    verificacion['paquete'] = paquete.read_text('utf-8', 'replace').splitlines()[-5:] if paquete.is_file() else []
    criterios ={'carpeta': revisar_carpeta(carpeta), 'verificacion': verificacion,
                 'muestras_frente_al_tiempo': analizar_tiempos(datos['tiempos'], duracion_min)}
    if modo == 'p3':
        pcm = leer_pcm(trabajo / 'audio.pcm')
        audio = trabajo / 'audio.aac'
        criterios['formato'] = analizar_formato(_json(trabajo / 'ffprobe.json'), audio.stat().st_size if audio.is_file() else 0, len(pcm))
        deteccion = detectar_clics(pcm)
        criterios['clics'] = dict(analizar_clics(deteccion['clics'], duracion=len(pcm) / HZ), otros_sonidos=deteccion['otros'])
        lineas = _leer_lineas(resultados)[0] if resultados is not None else []
        criterios['arranques'] = analizar_arranques([obj for _, obj in lineas], eventos['arranque'])
    else:
        tiempos = datos['tiempos']
        inicio = resumen['inicio_ns'] if resumen else (tiempos[0]['t_ns'] if tiempos else 0)
        fin = resumen['fin_ns'] if resumen else (tiempos[-1]['t_ns'] if tiempos else 0)
        criterios['latidos'] = analizar_latidos(datos['latidos'], inicio, fin, duracion_min)
        criterios['cierre'] = analizar_cierre(resumen, verificacion)
    informe = {'incidente': datos['incidente'], 'modo': modo,
               'veredicto': 'pasa' if all(c['veredicto'] == 'pasa' for c in criterios.values()) else 'falla',
               'criterios': criterios, 'eventos': eventos,
               'ventana': _ventana(resumen, [x['hora'] for x in datos['eventos'] + datos['latidos']]),
               'resumen': {k: resumen[k] for k in ('fuente', 'segundos_fragmento', 'latidos', 'codec', 'nivel_clave',
                                                   'fragmentos', 'sobre_max', 'motivo', 'error')} if resumen else None}
    if modo == 'p4':
        informe['bateria'] = BATERIA_A
    return informe


def listar(carpeta_p3):
    """Las grabaciones de la sesión, por hora de inicio (la del resumen o, si el proceso murió, la primera de sus
    eventos y latidos): incidente, inicio en UTC, segundos grabados, motivo de parada, latidos y fragmentos."""
    lista = []
    for d in sorted(p for p in carpeta_p3.iterdir() if p.is_dir()):
        datos, _ = leer_carpeta(d)
        r = datos['resumen']
        horas = [x['hora'] for x in datos['eventos'] + datos['latidos']]
        inicio = r['inicio_hora'] if r else min(horas, default=0)
        muestras = r['muestras'] if r else (datos['tiempos'][-1]['muestras'] if datos['tiempos'] else 0)
        lista.append({'incidente': d.name,
                      'inicio_utc': datetime.fromtimestamp(inicio / 1_000, timezone.utc).isoformat(timespec='seconds'),
                      'segundos': round(muestras / HZ, 1), 'motivo': r['motivo'] if r else 'sin_resumen',
                      'latidos': r['latidos'] if r else bool(datos['latidos']),
                      'fragmentos': r['fragmentos'] if r else datos['sobres']})
    return sorted(lista, key=lambda x: x['inicio_utc'])


def main(argv=None):
    p = argparse.ArgumentParser(description='Análisis de P3 y P4 sin subida (H0b)')
    p.add_argument('--lista', type=pathlib.Path)
    p.add_argument('--carpeta', type=pathlib.Path)
    p.add_argument('--trabajo', type=pathlib.Path)
    p.add_argument('--resultados', type=pathlib.Path)
    p.add_argument('--modo', choices=('p3', 'p4'))
    p.add_argument('--duracion-min', type=float, default=1_800.0)
    o = p.parse_args(argv)
    if o.lista is not None:
        salida, codigo = listar(o.lista), 0
    elif o.carpeta is None or o.trabajo is None or o.modo is None:
        p.error('faltan --carpeta, --trabajo o --modo')
    else:
        salida = analizar(o.carpeta, o.trabajo, o.resultados, o.modo, o.duracion_min)
        codigo = 0 if salida['veredicto'] == 'pasa' else 1
    sys.stdout.buffer.write(json.dumps(salida, ensure_ascii=False, indent=2).encode('utf-8') + b'\n')
    return codigo


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Paso 5: ver que pasan**

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /tmp && python3 -I -B /work/banco/p3/maquina/test_analisis.py 2>&1 | tail -3'
```

Esperado: `Ran 59 tests in …s` y `OK` (unos 3 s).

- [ ] **Paso 6: el detector con la pista de verdad**

La pista pasa por el mismo detector que el audio del teléfono: debe dar sus 270 clics exactos. En el PCM sin códec, el comienzo cae 2 muestras después del clic (la mitad del pico).

📍 Máquina de trabajo; el guion corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec -i vigia-build sh -s <<'EOF'
ffmpeg -v error -nostdin -i /work/h0b/p3/pista.wav -f s16le /tmp/pista.pcm
python3 -I -B - <<'PY'
import pathlib
import sys
sys.path.insert(0, '/work/banco/p3/maquina')
import analisis as a
d = a.detectar_clics(a.leer_pcm(pathlib.Path('/tmp/pista.pcm')))
r = a.analizar_clics(d['clics'])
print(f"{len(d['clics'])} clics, del {d['clics'][0]} al {d['clics'][-1]} s: {r['veredicto']}, error máximo {r['max_error_intervalo_ms']} ms, otros sonidos {d['otros']}")
PY
rm -f /tmp/pista.pcm
EOF
```

Esperado: `270 clics, del 2.000125 al 2692.000125 s: pasa, error máximo 0.0 ms, otros sonidos 0`.

- [ ] **Paso 7: el paquete y el guion de análisis**

`<banco>/p3/maquina/paquete.mts`:

```ts
// P3 y P4 sin subida (H0b, tarea 7): arma el paquete de una grabación del banco para el CLI verificar de shared.
// Uso: node paquete.mts <carpeta de la grabación> <salida>
// Comprueba la firma de cada sobre con spki.der; firma un acuse por registro con una clave de dev efímera (no
// extraíble: muere con el proceso), como si un servidor los hubiera recibido todos a la hora del teléfono; y arma el
// paquete (crearPaquete) con K envuelta para la clave de escucha. Escribe en <salida> paquete.zip, claves.txt (la
// lista con la pública de dev), huella.txt y sobres.json (lo comprobado, para analisis.py). No lee ninguna clave
// privada ni descifra nada: eso lo hace verificar. shared llega de $F2H1 (por defecto /work/f2-h1).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [carpeta, salida] = process.argv.slice(2);
if (!carpeta || !salida) {
  console.error('Uso: node paquete.mts <carpeta de la grabación> <salida>');
  process.exit(2);
}
// Un fallo deja una sola línea con su motivo (analisis.py la recoge) y la salida 1, sin paquete.
try {
  const s = await import(`${process.env.F2H1 ?? '/work/f2-h1'}/packages/shared/src/index.ts`);
  const cripto = s.criptoWebCrypto();
  const KID = 'banco_p3';
  const leer = (nombre: string) => new Uint8Array(readFileSync(join(carpeta, nombre)));

  const incidente = new TextDecoder().decode(leer('incidente.txt')).trim();
  if (!s.esId(incidente)) throw new Error('incidente.txt no es un id de 22 caracteres');
  const spki = leer('spki.der');
  if (!s.esSpkiP256(spki)) throw new Error('spki.der no es una pública P-256 de 91 bytes');
  const escucha = leer('escucha.env');
  if (escucha.length !== 80) throw new Error('escucha.env no mide 80 bytes');

  const dev = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])) as CryptoKeyPair;
  const devSpki = new Uint8Array(await crypto.subtle.exportKey('spki', dev.publicKey));

  // 000000.sobre, los fragmentos en orden y cierre.sobre al final ('c' va después de las cifras).
  const nombres = readdirSync(carpeta).filter((n) => /^(?:[0-9]{6}|cierre)\.sobre$/.test(n)).sort();
  const registros = [];
  const firmasInvalidas: string[] = [];
  const ilegibles: string[] = [];
  let hora = 0;
  let fragmentos = 0;
  let bytesMax = 0;
  for (const nombre of nombres) {
    const cuerpo = leer(nombre);
    bytesMax = Math.max(bytesMax, cuerpo.length);
    let sobre;
    try {
      sobre = s.desempaquetarSobre(cuerpo);
    } catch {
      ilegibles.push(nombre);
      continue;
    }
    if (!(await s.verificarRegistro(cripto, spki, sobre.r, sobre.s))) firmasInvalidas.push(nombre);
    try {
      hora = s.analizarRegistro(sobre.r).hora_telefono;
    } catch {
      // r que no se analiza: el acuse lleva la hora del anterior y el verificador lo marca
    }
    const seq = nombre === 'cierre.sobre' ? 'cierre' : Number(nombre.slice(0, 6));
    const acuse = await s.firmarAcuse(cripto, dev.privateKey, KID, await s.hashRegistro(cripto, sobre.r), hora);
    registros.push({ seq, r: sobre.r, s: sobre.s, cifrado: sobre.cifrado, acuse });
    if (seq !== 'cierre' && seq > 0) fragmentos++;
  }
  const cierre = registros.some((x) => x.seq === 'cierre');

  writeFileSync(join(salida, 'paquete.zip'), s.crearPaquete({ incidente, spki, registros, envolturas: [{ rol: 'escucha', k: escucha }] }));
  writeFileSync(join(salida, 'claves.txt'), s.unir(s.bytesEntradaClave({ kid: KID, spki: devSpki, estado: 'activa', desde: 0 }), Uint8Array.of(0x0a)));
  writeFileSync(join(salida, 'huella.txt'), `${await s.huella(cripto, spki)}\n`);
  writeFileSync(join(salida, 'sobres.json'), JSON.stringify({ sobres: nombres.length, fragmentos, cierre, bytes_max: bytesMax, firmas_invalidas: firmasInvalidas, ilegibles }));
  console.log(`paquete: ${nombres.length} sobres (${fragmentos} fragmentos, ${cierre ? 'con' : 'sin'} cierre), ${firmasInvalidas.length} firmas inválidas, ${ilegibles.length} ilegibles`);
} catch (e) {
  console.log(`paquete: no se pudo armar: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
}
```

`<banco>/p3/maquina/analizar.sh` (modo 755: `chmod 755 <banco>/p3/maquina/analizar.sh`):

```sh
#!/bin/sh
# P3 y P4 sin subida (H0b, tarea 7): analiza una grabación del banco. Corre en el contenedor efímero sin red del
# contrato, con la sesión del teléfono montada en /sesion (solo lectura) y la privada de escucha por la entrada
# estándar, que solo lee el CLI verificar de shared. El audio descifrado vive en /tmp (tmpfs) y desaparece con el
# contenedor. Imprime un JSON con un veredicto por criterio; nunca audio, claves ni K.
# Uso: sh analizar.sh                     lista las grabaciones de la sesión (no lee la entrada estándar)
#      sh analizar.sh <incidente> p3|p4   analiza una; sale con 0 si todo pasa, con 1 si no y con 2 si la orden
#                                          está mal escrita
# Entradas, con su valor por defecto: SESION (/sesion, la carpeta que se sube del teléfono, con files/ dentro),
# F2H1 (/work/f2-h1) y DURACION_MIN (1800 s, los 30 min del plan).
set -eu
aqui=$(cd "$(dirname "$0")" && pwd)
SESION=${SESION:-/sesion}
F2H1=${F2H1:-/work/f2-h1}
DURACION_MIN=${DURACION_MIN:-1800}
export F2H1
p3=$SESION/files/p3
if [ $# -eq 0 ]; then
    exec python3 -I -B "$aqui/analisis.py" --lista "$p3" < /dev/null
fi
if [ $# -ne 2 ] || { [ "$2" != p3 ] && [ "$2" != p4 ]; }; then
    echo "Uso: sh analizar.sh [<incidente> p3|p4]" >&2
    exit 2
fi
if ! printf '%s\n' "$1" | grep -Eqx '[A-Za-z0-9_-]{22}' || [ ! -d "$p3/$1" ]; then
    echo "No hay ninguna grabación $1 en $p3" >&2
    exit 2
fi
carpeta=$p3/$1
umask 077
t=$(mktemp -d /tmp/analisis.XXXXXX)

# 1. Firmas de los sobres con spki.der y paquete con acuses de dev.
node "$aqui/paquete.mts" "$carpeta" "$t" < /dev/null > "$t/paquete.txt" 2>&1 || true

# 2. El verificador de shared con la privada de escucha (la entrada estándar); el audio de los fragmentos que
#    cuentan, en orden de seq, va a $t/audio.aac con 0600.
if [ -f "$t/paquete.zip" ]; then
    salida=0
    node "$F2H1/packages/shared/herramientas/verificar.ts" "$t/paquete.zip" --zona UTC --claves "$t/claves.txt" \
        --huella "$(cat "$t/huella.txt")" --clave-escucha --audio "$t/audio.aac" > "$t/verificar.txt" 2>&1 || salida=$?
    echo "$salida" > "$t/verificar.salida"
fi

# 3. Formato del audio descifrado y su PCM, también en el tmpfs.
if [ -s "$t/audio.aac" ]; then
    ffprobe -v error -show_streams -show_format -of json "$t/audio.aac" < /dev/null > "$t/ffprobe.json" || true
    ffmpeg -v error -nostdin -i "$t/audio.aac" -f s16le "$t/audio.pcm" || true
fi

# 4. Veredictos.
salida=0
python3 -I -B "$aqui/analisis.py" --carpeta "$carpeta" --trabajo "$t" --resultados "$SESION/files/resultados.jsonl" \
    --modo "$2" --duracion-min "$DURACION_MIN" < /dev/null || salida=$?
rm -rf "$t"
exit "$salida"
```

- [ ] **Paso 8: el teléfono simulado**

`<banco>/jvm/simulado/src/main/kotlin/vigia/banco/simulado/Main.kt` (sustituye al del andamio):

```kotlin
package vigia.banco.simulado

import vigia.banco.puro.CortadorAdts
import vigia.nucleo.Adts
import vigia.nucleo.Codificacion
import vigia.nucleo.Envoltura
import vigia.nucleo.FabricaSobres
import vigia.nucleo.FirmanteSoftware
import vigia.nucleo.HpkeBouncyCastle
import vigia.nucleo.Sobre
import java.io.File
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.spec.ECGenParameterSpec
import kotlin.system.exitProcess

/**
 * Teléfono simulado de P3 y P4 (H0b, tarea 7). Con un ADTS de ffmpeg (AAC-LC a 16 kHz mono) hace lo que el
 * grabador del teléfono: pasa cada unidad AAC cruda por CortadorAdts, sella los fragmentos con FabricaSobres
 * (FirmanteSoftware y K nueva) y envuelve K para la clave de escucha. Escribe la carpeta de grabación del contrato
 * (<files>/p3/<incidente>/) con tiempos, eventos, latidos y resumen sintéticos y sin deriva, como si el reloj del
 * audio y el del teléfono fueran el mismo, y añade a <files>/resultados.jsonl una tanda de 20 arranques sintéticos.
 * Uso: simulado <entrada.aac> <files> <publica.b64u> <segundos por fragmento> <latidos: si|no>
 */
fun main(args: Array<String>) {
    if (args.size != 5 || args[4] !in setOf("si", "no")) {
        System.err.println("Uso: simulado <entrada.aac> <files> <publica.b64u> <segundos por fragmento> <latidos: si|no>")
        exitProcess(2)
    }
    val flujo = File(args[0]).readBytes()
    val files = File(args[1])
    val publica = Codificacion.deB64u(File(args[2]).readText().trim())
    val segundos = args[3].toInt()
    val latidos = args[4] == "si"
    val incidente = simular(flujo, files, publica, segundos, latidos)
    println("simulado: incidente $incidente en ${File(files, "p3/$incidente")}")
}

private const val HZ = 16_000
private const val NS = 1_000_000_000L
private const val LECTURA_NS = 64_000_000L // 1 024 muestras a 16 kHz: una lectura de AudioRecord por unidad AAC

fun simular(flujo: ByteArray, files: File, publica: ByteArray, segundos: Int, latidos: Boolean): String {
    val unidades = Adts.tramas(flujo).map { t ->
        val unidad = flujo.copyOfRange(t.first + 7, t.last + 1)
        require(Adts.cabecera(unidad.size).contentEquals(flujo.copyOfRange(t.first, t.first + 7))) { "la entrada no es AAC-LC a 16 kHz mono" }
        unidad
    }
    require(unidades.isNotEmpty()) { "la entrada no tiene tramas" }
    val azar = SecureRandom()
    val incidente = Codificacion.b64u(ByteArray(16).also { azar.nextBytes(it) })
    val carpeta = File(files, "p3/$incidente")
    check(carpeta.mkdirs()) { "no se pudo crear $carpeta" }
    val par = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    val firmante = FirmanteSoftware(par)
    val k = ByteArray(32).also { azar.nextBytes(it) }
    val h0 = System.currentTimeMillis()
    val t0 = 1_000 * NS // elapsedRealtimeNanos sintético de la muestra 0

    File(carpeta, "incidente.txt").writeText("$incidente\n")
    File(carpeta, "spki.der").writeBytes(firmante.spki)
    File(carpeta, "escucha.env").writeBytes(Envoltura.envolver(HpkeBouncyCastle(), publica, incidente, "escucha", k))
    val fabrica = FabricaSobres(firmante, incidente, k)
    File(carpeta, "000000.sobre").writeBytes(fabrica.apertura(h0, "VE", "grabar").cuerpo())

    val tiempos = StringBuilder()
    val eventos = StringBuilder()
    val lineasLatidos = StringBuilder()
    fun evento(tipo: String, tNs: Long, vararg campos: Pair<String, Any?>) {
        eventos.append(json(mapOf("tipo" to tipo, "t_ns" to tNs, "hora" to h0 + (tNs - t0) / 1_000_000) + campos) + "\n")
    }
    evento("codec", t0, "nombre" to "simulado", "respaldo" to false)
    evento("formato", t0 + LECTURA_NS, "formato" to "{mime=audio/mp4a-latm, sample-rate=16000, channel-count=1}")
    evento("csd", t0 + LECTURA_NS, "hex" to "1408")
    evento("arranque", t0 + 2 * LECTURA_NS, "servicio_ms" to 35.0, "primer_plano_ms" to 60.0, "listo_ms" to 140.0,
        "grabando_ms" to 180.0, "primera_lectura_ms" to 250.0, "primera_unidad_ms" to 330.0)

    val cortador = CortadorAdts(segundos * HZ).also { it.configuracion(Codificacion.deHex("1408")) }
    var fragmentos = 0
    var bytesAdts = 0L
    var sobreMax = 0
    fun sellar(f: CortadorAdts.Fragmento) {
        val cuerpo = fabrica.fragmento(h0 + f.muestraInicial * 1_000 / HZ, f.adts).cuerpo()
        check(cuerpo.size <= Sobre.MAX_CUERPO) { "sobre de ${cuerpo.size} bytes" }
        fragmentos++
        File(carpeta, "${fragmentos.toString().padStart(6, '0')}.sobre").writeBytes(cuerpo)
        bytesAdts += f.adts.size
        sobreMax = maxOf(sobreMax, cuerpo.size)
    }
    // Una lectura de 1 024 muestras por unidad, cada 64 ms; tiempos y latidos con las reglas del grabador.
    var ultimoTiempo = 0L
    var ultimoLatido = 0L
    for ((i, unidad) in unidades.withIndex()) {
        val muestras = 1_024L * (i + 1)
        val t = t0 + LECTURA_NS * (i + 1)
        val primera = i == 0
        if (primera || t - ultimoTiempo >= NS || i == unidades.size - 1) {
            tiempos.append(json(mapOf("muestras" to muestras, "t_ns" to t, "ts_marco" to muestras + 1_024, "ts_ns" to t)) + "\n")
            ultimoTiempo = t
        }
        if (latidos && (primera || t - ultimoLatido >= 60 * NS)) {
            lineasLatidos.append(json(mapOf("t_ns" to t, "hora" to h0 + (t - t0) / 1_000_000, "muestras" to muestras,
                "fragmentos" to fragmentos, "doze" to !primera, "interactiva" to primera, "ahorro" to false,
                "sin_optimizar" to false, "bateria" to 80, "cargando" to true)) + "\n")
            ultimoLatido = t
        }
        cortador.agregar(unidad)?.let(::sellar)
    }
    cortador.terminar()?.let(::sellar)
    val muestras = 1_024L * unidades.size
    val finNs = t0 + LECTURA_NS * unidades.size + 100_000_000
    val finHora = h0 + (finNs - t0) / 1_000_000
    File(carpeta, "cierre.sobre").writeBytes(fabrica.cierre(finHora).cuerpo())
    evento("parada", finNs, "motivo" to "detener", "eos" to true)
    File(carpeta, "tiempos.jsonl").writeText(tiempos.toString())
    File(carpeta, "eventos.jsonl").writeText(eventos.toString())
    if (latidos) File(carpeta, "latidos.jsonl").writeText(lineasLatidos.toString())
    File(carpeta, "resumen.json").writeText(json(mapOf("incidente" to incidente, "fuente" to "MIC",
        "segundos_fragmento" to segundos, "latidos" to latidos, "codec" to "simulado", "nivel_clave" to "software",
        "inicio_hora" to h0, "inicio_ns" to t0, "fin_hora" to finHora, "fin_ns" to finNs, "muestras" to muestras,
        "unidades" to unidades.size, "fragmentos" to fragmentos, "bytes_adts" to bytesAdts, "sobre_max" to sobreMax,
        "cierre" to true, "eos" to true, "motivo" to "detener", "error" to null, "zona_min" to 0)) + "\n")
    k.fill(0)

    // La tanda de arranques que guarda BancoP3.arranques(20) en resultados.jsonl.
    val arranques = List(20) { i -> mapOf("listo_ms" to 40.0 + i, "grabando_ms" to 90.0 + i, "primera_lectura_ms" to 160.0 + i, "primera_unidad_ms" to 300.0 + 10 * i) }
    val datos = mapOf("n" to 20, "fuente" to "MIC", "arranques" to arranques, "primero_ms" to 300.0, "mediana_ms" to 400.0, "max_ms" to 490.0)
    File(files, "resultados.jsonl").appendText(json(mapOf("prueba" to "p3-arranques", "hora" to finHora, "datos" to datos)) + "\n")
    return incidente
}

/** JSON mínimo para lo que escribe el simulado: textos sin caracteres de control, números, booleanos, null, listas y mapas. */
private fun json(valor: Any?): String = when (valor) {
    null -> "null"
    is String -> "\"" + valor.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
    is Boolean, is Int, is Long, is Double -> valor.toString()
    is Map<*, *> -> valor.entries.joinToString(",", "{", "}") { (k, v) -> json(k.toString()) + ":" + json(v) }
    is List<*> -> valor.joinToString(",", "[", "]") { json(it) }
    else -> throw IllegalArgumentException("tipo sin JSON: ${valor::class}")
}
```

- [ ] **Paso 9: una sesión simulada de 3 min**

La entrada sale de ffmpeg con su codificador AAC a 32 kbps: un tono de 440 Hz con ruido suave, 10 s de silencio (de 150 a 160 s) y los clics de la pista, 180 s en total. Siempre da los mismos bytes. El teléfono simulado la corta en fragmentos de 4 s, con latidos, y firma con un par de software nuevo.

⚠️ La primera orden del guion borra la sesión simulada anterior, si la hay (solo datos sintéticos).

📍 Máquina de trabajo; las órdenes corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon test -q; echo "jvm: $?"'
docker exec -i vigia-build sh -s <<'EOF'
mkdir -p /work/h0b/p3/simulado && cd /work/h0b/p3/simulado && rm -rf entrada.aac sesion sesion-mala
ffmpeg -v error -nostdin -f lavfi -i "aevalsrc=exprs='(0.05*sin(2*PI*440*t)+0.02*(random(0)-0.5))*not(between(t,150,160))+0.8*sin(2*PI*1000*t)*gte(t,2)*lt(mod(t-2,10),0.01)':s=16000:d=180" -c:a aac -b:a 32k -fflags +bitexact -flags:a +bitexact -f adts entrada.aac
sha256sum entrada.aac
cd /work/banco/jvm && ./gradlew --no-daemon -q :simulado:run --args="/work/h0b/p3/simulado/entrada.aac /work/h0b/p3/simulado/sesion/files /work/h0b/escucha/publica.b64u 4 si"
ls /work/h0b/p3/simulado/sesion/files/p3/*/ | wc -l
EOF
```

Esperado:

```
jvm: 0
8ce366817ba634025dcc327521ac67498b230e8c2c4b85a29862ee12f8ab422a  entrada.aac
simulado: incidente <incidente> en /work/h0b/p3/simulado/sesion/files/p3/<incidente>
55
```

`jvm: 0` son las 13 pruebas de la tarea 5 (el simulado no tiene pruebas propias: lo prueba el paso siguiente). Los 55 archivos son 48 sobres (apertura, 46 fragmentos y cierre) y los 7 de la tabla de la tarea 6.

- [ ] **Paso 10: analizar la sesión simulada, con la clave de escucha de verdad**

Igual que con el teléfono, pero con la sesión en el volumen (`SESION`) y `DURACION_MIN=120`, porque dura 3 min. La privada entra solo por la entrada estándar, a contenedores con `--log-driver none --memory 2g --memory-swap 2g`; el que solo lista no la recibe.

📍 Máquina de trabajo; cada `docker run` es un contenedor efímero sin red.

Ejecutar:

```sh
docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -e SESION=/work/h0b/p3/simulado/sesion vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh < /dev/null
incidente=$(docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -e SESION=/work/h0b/p3/simulado/sesion vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh < /dev/null | python3 -I -c 'import json, sys; print(json.load(sys.stdin)[0]["incidente"])')
docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -e SESION=/work/h0b/p3/simulado/sesion -e DURACION_MIN=120 vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh "$incidente" p3 < <privada>/escucha/privada.b64u > /tmp/simulado-p3.json; echo "salida: $?"
docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -e SESION=/work/h0b/p3/simulado/sesion -e DURACION_MIN=120 vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh "$incidente" p4 < <privada>/escucha/privada.b64u > /tmp/simulado-p4.json; echo "salida: $?"
for f in /tmp/simulado-p3.json /tmp/simulado-p4.json; do python3 -I -c 'import json, sys; r = json.load(sys.stdin); print(r["modo"], r["veredicto"], " ".join(f"{k}={v["veredicto"]}" for k, v in r["criterios"].items()))' < "$f"; done
python3 -I -c 'import json, sys; c = json.load(sys.stdin)["criterios"]; print(c["verificacion"]["resumen"].split(",")[0], c["verificacion"]["estado"], "|", c["formato"]["kbps"], "kb/s |", c["clics"]["detectados"], "clics, retardo", c["clics"]["retardo_s"], "s, error", c["clics"]["max_error_intervalo_ms"], "ms, golpes", c["clics"]["golpes"], "| arranque de la grabación", c["arranques"]["grabacion_ms"], "ms")' < /tmp/simulado-p3.json
```

Esperado (el incidente es otro en cada ejecución):

```
[
  {
    "incidente": "<incidente>",
    "inicio_utc": "<hora de inicio>",
    "segundos": 180.1,
    "motivo": "detener",
    "latidos": true,
    "fragmentos": 46
  }
]
salida: 0
salida: 0
p3 pasa carpeta=pasa verificacion=pasa muestras_frente_al_tiempo=pasa formato=pasa clics=pasa arranques=pasa
p4 pasa carpeta=pasa verificacion=pasa muestras_frente_al_tiempo=pasa latidos=pasa cierre=pasa
✓ 46 fragmentos integro | 30.5 kb/s | 18 clics, retardo 2.0641 s, error 0.1 ms, golpes 0 | arranque de la grabación 330.0 ms
```

El retardo de 2,064 s es el primer clic (a los 2 s) más una unidad AAC (64 ms) de retardo del codificador de ffmpeg: es lo que calibra el primer clic. Los 30,5 kb/s son de ese codificador con esta entrada; el del teléfono se mide en la sesión 2. Los 330 ms de arranque son los que escribe el simulado en su evento `arranque`; los del teléfono se miden en las sesiones 2 y 3. `/tmp/simulado-p3.json` y `/tmp/simulado-p4.json` solo tienen cifras de datos sintéticos: se borran en el paso 11.

- [ ] **Paso 11: prueba negativa, un sobre cambiado hace fallar la verificación**

En una copia de la sesión simulada se cambia el último byte de `000005.sobre` (dentro del cifrado) y el byte 20 de `000007.sobre` (dentro del registro firmado). Cada bloque corre en una shell nueva, así que la primera orden vuelve a sacar el incidente de la lista.

📍 Máquina de trabajo; la copia se hace dentro de `vigia-build` y el análisis, en un contenedor efímero sin red.

Ejecutar:

```sh
incidente=$(docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -e SESION=/work/h0b/p3/simulado/sesion vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh < /dev/null | python3 -I -c 'import json, sys; print(json.load(sys.stdin)[0]["incidente"])') && [ -n "$incidente" ] && echo "incidente: $incidente"
docker exec -i -e INCIDENTE="$incidente" vigia-build sh -s <<'EOF'
cd /work/h0b/p3/simulado && cp -a sesion sesion-mala && cd "sesion-mala/files/p3/$INCIDENTE"
python3 -I -c '
import pathlib
for nombre, i in (("000005.sobre", -1), ("000007.sobre", 20)):
    p = pathlib.Path(nombre)
    b = bytearray(p.read_bytes())
    b[i] ^= 1
    p.write_bytes(bytes(b))
print("cambiados 000005.sobre y 000007.sobre")'
EOF
docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -e SESION=/work/h0b/p3/simulado/sesion-mala -e DURACION_MIN=120 vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh "$incidente" p3 < <privada>/escucha/privada.b64u > /tmp/simulado-mala.json; echo "salida: $?"
python3 -I -c 'import json, sys; r = json.load(sys.stdin); v = r["criterios"]["verificacion"]; print(r["veredicto"], "verificacion=" + v["veredicto"], "clics=" + r["criterios"]["clics"]["veredicto"]); print(v["resumen"]); print("\n".join(v["hallazgos"])); print(v["paquete"][0])' < /tmp/simulado-mala.json
rm /tmp/simulado-p3.json /tmp/simulado-p4.json /tmp/simulado-mala.json
```

Esperado:

```
incidente: <incidente>
cambiados 000005.sobre y 000007.sobre
salida: 1
falla verificacion=falla clics=falla
✗ Hay fallos (2); lo que falla no cuenta. Fragmentos que verifican: 44
Fragmento 5: no coincide con lo que firmó el teléfono
Registro 7: no lo firmó el teléfono
Registro 8: falta el anterior y su enlace no se puede comprobar
paquete: 48 sobres (46 fragmentos, con cierre), 1 firmas inválidas, 0 ilegibles
```

Los clics también fallan: al audio que verifica le faltan los fragmentos 5 y 7 (8 s), así que los tres primeros clics quedan fuera de la rejilla de los demás. Cuentan en `desplazados` y no en `golpes`: son clics fuera de su sitio, no sonidos de la sala. El `incidente` es el del paso 10.

- [ ] **Paso 12: commit en el banco**

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit:

```sh
git -C <banco> add p3/maquina/pista.sh p3/maquina/test_analisis.py p3/maquina/analisis.py p3/maquina/paquete.mts p3/maquina/analizar.sh jvm/simulado/src/main/kotlin/vigia/banco/simulado/Main.kt
git -C <banco> diff --cached --stat | tail -1
git -C <banco> commit -q -m "Herramientas de la máquina para P3 y P4 (H0b, tarea 7)

Pista de clics, teléfono simulado (jvm/simulado) que escribe la carpeta de
grabación del contrato, y p3/maquina/analizar.sh: firmas de los sobres, paquete
con acuses de dev, CLI verificar de shared con la clave de escucha, ffprobe, PCM
y analisis.py, que da un veredicto por criterio de P3 y de P4 sin subida." && git -C <banco> log --oneline -1
git -C <banco> status --short | wc -l
```

Esperado: ` 6 files changed, 1310 insertions(+), 3 deletions(-)`, el commit con su hash corto y `0`.

**Notas:**

- **Nota:** validado el 14-oct-2026 en `vigia-build` y en contenedores efímeros de la imagen de H0a (la de H0b solo añade iproute2), con una copia del banco con las tareas 4 a 6, `F2H1` en una copia de `f2-h1` y un par de escucha desechable generado con el guion de la tarea 3 (la privada en un archivo 600 fuera del volumen, borrada al acabar): las salidas de los pasos 1, 3, 5, 6, 9, 10 y 11 son las de esa validación. También: la orden sin argumentos válidos (`analizar.sh ../../etc p3` o `… p5`) sale con 2 sin tocar nada; una sesión sin `spki.der` da `carpeta=falla`, `verificacion=sin_datos` y en `paquete` el motivo (`no se pudo armar: ENOENT…`); y el análisis de clics de la pista de 45 min tarda unos 2,4 s. Los arreglos de la revisión (pista de 45 min, golpes y clics desplazados, arranque de la grabación, `--log-driver none --memory 2g --memory-swap 2g` y el incidente del paso 11) se validaron igual, de punta a punta y con la prueba negativa.
- **Nota:** `analisis.py` lleva TDD (pasos 2 a 5): cada criterio tiene su prueba con datos sintéticos, también los que deben fallar (un bloque de 64 ms perdido, 4 s perdidos a mitad, un clic que falta o se repite, una deriva de 2 000 ppm, una pista que se para antes que la grabación, más de 1 s perdido, un minuto sin latido, un proceso que muere a los 10 min, un error del sellador con parada normal, una línea con un campo de otro tipo, un arranque de la grabación de más de 2 s) y los que no (golpes de la sala entre dos clics, a 0,3 s de un clic, antes del primero y con 300 ppm de deriva; uno de 80 ms metido en el audio). Las pruebas nuevas de la revisión se vieron fallar con el `analisis.py` anterior (5 fallos y 10 errores) antes de pasar.
- **Nota:** `paquete.mts` no ve ninguna privada: los acuses los firma una clave P-256 efímera no extraíble que muere con el proceso, y su pública va a `claves.txt` en el tmpfs. El verificador comprueba así las firmas del Keystore (ECDSA P-256 en P1363), la cadena, `kc`, `p` y el descifrado con la clave de escucha: lo mismo que haría con un paquete del servidor.
- **Nota:** riesgo que queda: la privada de escucha pasa por la memoria del CLI `verificar`, que importa `@hpke/core` y shared del volumen. Sin red no puede sacarla, con el volumen en solo lectura tampoco puede dejarla en él, y sin memoria de intercambio ni registro del daemon no llega al disco por esa vía.
- **Nota:** `verificar` escribe en `audio.aac` solo los fragmentos que cuentan, unidos en orden: con un fragmento que no verifica, el audio tiene un hueco y los clics fallan (paso 11). Es lo correcto: P3 se juzga sobre audio verificado.

---

### Tarea 8: P2: FTS5, `vault.db` con SQLCipher y dónde guarda la cola los sobres

**Archivos (banco, `<banco>`):**
- Crear: `app/pruebas/p2.ts` (corpus, FTS5, reconstrucción de `legal.db`, `vault.db` y blobs de la cola; sin React Native), `jvm/puro/src/main/kotlin/vigia/banco/Estadistica.kt`, `jvm/puro/src/main/kotlin/vigia/banco/p2/ColaArchivos.kt` y `p2/maquina/resumen.ts`.
- Sustituir (eran los mínimos de la tarea 4): `app/pruebas/P2.tsx` y `app/modules/banco/android/src/main/java/expo/modules/banco/BancoP2Module.kt`.
- Pruebas: `jvm/puro/src/test/kotlin/vigia/banco/p2/ColaArchivosTest.kt` (JUnit en la JVM) y `p2/maquina/p2.test.ts` (`node:test` con `node:sqlite`).
- Fuera del banco: `/work/h0b/limpio` y `/work/h0b/salida/apk/`, que rehace `compilar.sh`.

**Interfaces:**
- Consume:
  - Tarea 4: `Resultados.guardar(contexto: Context, prueba: String, json: String)`; `Llaves.envolver(alias: String, datos: ByteArray): ByteArray` y `Llaves.desenvolver(alias: String, envuelto: ByteArray): ByteArray`; de `comun.ts`, `guardar(prueba, datos): string`, `legible(texto): string`, `mensaje(e): string` y `estilos`; el tipo `ModuloP2` de `app/modules/banco/index.ts`, sin cambios; `compilar.sh`; el proyecto `jvm/`, cuyo `puro/src/main/kotlin` entra también al APK.
  - H1, en `nucleo.jar` de `f2-h1`: `Cifrado.cifrar(k: ByteArray, aad: ByteArray, claro: ByteArray): ByteArray` y `Cifrado.descifrar(k, aad, cifrado)` (AES-256-GCM, con el nonce de 12 bytes de SecureRandom delante) y `Codificacion.hex(b: ByteArray): String`.
  - op-sqlite 18.2.5 con `sqlcipher` y `fts5`: `open({ name, encryptionKey? }): DB`, `db.execute(sql, params)`, `db.executeBatch([[sql, filas]])`, `db.getDbPath()`, `db.close()` y `db.delete()`. En la máquina, `node:sqlite` de Node 24.21.0 (SQLite 3.53.4, con FTS5 y sin SQLCipher).
- Produce:
  - Kotlin, paquete `vigia.banco` (`jvm/puro`, también en el APK): `data class Resumen(val p50: Double, val p95: Double, val max: Double, val total: Double, val n: Int)` y `object Estadistica { fun de(ms: DoubleArray): Resumen }`, con los percentiles por rango más cercano, como `estadistica()` de `p2.ts`. La usa también la tarea 9.
  - `vigia.banco.p2.ColaArchivos(carpeta: File, cifrar: (nombre: String, claro: ByteArray) -> ByteArray, descifrar: (nombre: String, cifrado: ByteArray) -> ByteArray, sincronizarCarpeta: (File) -> Boolean)`, con `fun medir(sobres: List<ByteArray>): Medida` (`escribir`, `cifrar`, `leer` y `descifrar` como `Resumen` por sobre, `correctos`, `bytesArchivo` y `carpetaSincronizada`) y `ColaArchivos.nombre(seq: Int): String` (`000001.sobre`).
  - `BancoP2`, con las firmas del contrato:
    - `claveVault()` → `"x'<64 hex>'"`. La primera vez, 32 bytes de SecureRandom envueltos con `Llaves.envolver("banco-vault", …)` en `noBackupFilesDir/vault.clave` (temporal, fsync y renombrado); después, `Llaves.desenvolver`. Guarda solo `p2-clave` con `{"origen":"nueva"|"archivo","ms"}`: la clave no se guarda ni se imprime.
    - `cabecera(ruta)` → hex de los 16 primeros bytes, solo de archivos dentro de la carpeta de datos de la app.
    - `colaArchivos()` → y guarda `p2-cola`: `{"n":450,"bytes_sobre":16384,"keystore":{…},"clave_datos":{…,"envolver_ms","desenvolver_ms"}}`. Cada modo trae `escribir`, `cifrar`, `leer` y `descifrar` (`{"p50","p95","max","total","n"}`, en ms), `correctos`, `bytes_archivo` y `fsync_carpeta`. Alias del Keystore: `banco-p2-cola` y `banco-p2-datos`. Borra sus archivos al acabar.
  - JS, `app/pruebas/p2.ts`: los tipos `Valor`, `Fila`, `Bd`, `Abrir`, `Resumen`, `Documento` y `Corpus`; las constantes `LEGAL`, `VAULT`, `TOKENIZADOR` (`unicode61 remove_diacritics 2`), `CABECERA_SQLITE`, `N_SOBRES` (450) y `BYTES_SOBRE` (16 384); y `estadistica(ms)`, `corpus(articulos?, tarjetas?)`, `reconstruir(abrir, c)`, `buscar(bd, termino)`, `probarFts(abrir, c)`, `versiones(abrir)`, `probarVault(abrir, clave, cabecera)` y `medirBlobs(bd, n?, bytes?)`.
  - Líneas de `resultados.jsonl`: `p2-clave`; `p2-autoprueba` (`sqlite`, `corpus`, `fts`, `reconstruccion` y `vault`); `p2-cola`; y `p2-blobs` (`n`, `bytes`, `insertar`, `leer`, `correctos`, `journal_mode` y `synchronous`).
  - `p2/maquina/resumen.ts <resultados.jsonl>`: los tres puntos de la autoprueba y las tres colas, recalculados desde las cifras; sale con 0 solo si todo pasa. Lo usa el análisis de P2 de la sesión 1 (tarea 13).

**Por qué la cola no puede depender de op-sqlite.** La grabación vive en el servicio en primer plano (tarea 6): sigue con la pantalla bloqueada y aunque Android destruya la actividad de React Native, y la cola guarda un sobre por fragmento, cada 4 s, sin esperar a nadie. op-sqlite es un módulo JSI: su base vive dentro del runtime de JS de la actividad y no tiene API para Kotlin, así que sin JS no hay op-sqlite. Que Kotlin abriera la misma `vault.db` exigiría otra copia de SQLCipher en el proceso (otra biblioteca nativa de varios MB), y dos copias de SQLite en el mismo proceso sobre el mismo archivo pueden corromperlo: cada copia lleva su propia lista de archivos abiertos y un `close()` de una puede soltar los bloqueos POSIX de la otra (sqlite.org, "How To Corrupt An SQLite Database File", sección 2.3, comprobado el 14-oct-2026). Por eso la cola es de Kotlin y P2 mide dos formas de guardarla en archivos, más `vault.db` desde JS como comparación.

**Qué mide cada opción** (450 sobres de 16 KiB, 30 min a 4 s; el informe lo decide en la tarea 16):

| Opción | Qué pasa con cada sobre | Qué mide | En contra |
|---|---|---|---|
| Archivo, Keystore por sobre | AES-256-GCM dentro del Keystore (la clave no sale nunca); temporal, fsync, renombrado y fsync de la carpeta | `p2-cola.keystore`: escribir (con cifrar) y leer (con descifrar), p50, p95, máximo y total | Cada sobre cruza dos veces al Keystore (y al TEE) |
| Archivo, clave de datos | AES-256-GCM en software con 32 bytes que el Keystore envuelve una vez | `p2-cola.clave_datos`, lo mismo, más envolver y desenvolver la clave | La clave de datos vive en la memoria del proceso mientras graba |
| `vault.db` (SQLCipher en op-sqlite) | un INSERT del blob en su propia transacción, desde JS | `p2-blobs`: insertar y leer por sobre, con `journal_mode` y `synchronous` | Solo desde JS: no sirve al servicio (arriba) |

Regla que propone esta tarea para el informe: la cola usa el Keystore por sobre si su p95 de escribir un sobre no pasa del 10 % de un fragmento (400 ms a 4 s); si pasa, la clave de datos. Leer importa menos: vaciar 450 sobres de 16 KiB a 96 kbit/s (el perfil de P7) son unos 10 min de red, frente a milisegundos por sobre.

**Tamaño del corpus.** El pack VE llega en H2; su semilla FTS5 son las leyes (`laws` de CountryPack) y las tarjetas. El corpus tiene el tamaño de un pack que lleve el texto entero de las dos leyes que más citará, para que M4 ("Buscar en la ley") busque en toda la ley y no solo en lo citado: la Constitución de 1999 (350 artículos) y el Código Orgánico Procesal Penal (unos 500; cifra sin comprobar contra la Gaceta, que llega con el pack), unos 1 000 artículos. `corpus()` genera 1 000 artículos de 610 a 1 121 caracteres (857 de media) y 60 tarjetas de 369 a 493 (440 de media), en español y con tildes: 908 776 bytes en UTF-8. Un pack que solo lleve los artículos que citan las tarjetas (7 situaciones, unas 4 tarjetas por situación y unos 4 artículos por tarjeta: unos 100 artículos, unos 130 KB, estimación sin medir) sería unas 7 veces menor, así que el criterio de menos de 2 s se mide en el caso pesado y el resultado sirve para los dos; la autoprueba anota los bytes para extrapolar. Es determinista (mulberry32 con semilla fija), y "detención" aparece en 819 de los 1 060 documentos y nunca sin tilde, así que "detencion" solo puede encontrarlos si el tokenizador pliega la tilde.

**Clave de `vault.db`.** `claveVault` da la clave como `x'<64 hex>'`: op-sqlite la pasa a `sqlite3_key_v2` y SQLCipher la toma como clave cruda, sin PBKDF2. `probarVault` anota `abrir_ms`: con otra forma de clave, SQLCipher 4 haría PBKDF2 con 256 000 iteraciones al abrir, del orden de un segundo en un gama baja (sin medir). La cadena con la clave pasa por la memoria de JS, porque op-sqlite la recibe así: H3a lo tiene en cuenta.

- [ ] **Paso 1: escribir la prueba de la cola en la JVM, que falla**

Con un cifrado en software (el AES-256-GCM del núcleo), porque el Keystore solo existe en el teléfono. Comprueba los nombres, que no quedan temporales, que lo escrito está cifrado, que un sobre que no descifra no cuenta, que se anota si la carpeta no se pudo sincronizar y los percentiles.

`<banco>/jvm/puro/src/test/kotlin/vigia/banco/p2/ColaArchivosTest.kt`:

```kotlin
package vigia.banco.p2

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import vigia.banco.Estadistica
import vigia.nucleo.Cifrado
import java.io.File
import java.security.SecureRandom
import javax.crypto.AEADBadTagException

class ColaArchivosTest {
    private val azar = SecureRandom()
    private val k = ByteArray(32).also { azar.nextBytes(it) }

    private fun aad(nombre: String) = "banco/p2/cola\u0000$nombre".toByteArray(Charsets.US_ASCII)

    private fun sobres(n: Int) = List(n) { ByteArray(16_384).also { azar.nextBytes(it) } }

    private fun cola(
        carpeta: File,
        descifrar: (String, ByteArray) -> ByteArray = { n, c -> Cifrado.descifrar(k, aad(n), c) },
        sincronizar: (File) -> Boolean = { true },
    ) = ColaArchivos(carpeta, { n, c -> Cifrado.cifrar(k, aad(n), c) }, descifrar, sincronizar)

    @Test
    fun `escribe cada sobre cifrado con su nombre, sin temporales, y lo lee igual`(@TempDir carpeta: File) {
        val s = sobres(20)
        val m = cola(carpeta).medir(s)
        assertEquals(20, m.correctos)
        assertEquals((1..20).map { ColaArchivos.nombre(it) }, carpeta.list()!!.sorted())
        assertEquals(16_384 + 28, m.bytesArchivo)
        assertTrue(carpeta.listFiles()!!.all { it.length() == 16_412L })
        assertFalse(File(carpeta, "000001.sobre").readBytes().copyOfRange(12, 16_396).contentEquals(s[0]))
        assertEquals(listOf(20, 20, 20, 20), listOf(m.escribir.n, m.cifrar.n, m.leer.n, m.descifrar.n))
        assertTrue(m.carpetaSincronizada)
    }

    @Test
    fun `un sobre que no descifra no cuenta como correcto`(@TempDir carpeta: File) {
        val m = cola(carpeta, descifrar = { n, c ->
            if (n == "000003.sobre") throw AEADBadTagException("cambiado") else Cifrado.descifrar(k, aad(n), c)
        }).medir(sobres(5))
        assertEquals(4, m.correctos)
    }

    @Test
    fun `anota si la carpeta no se pudo sincronizar`(@TempDir carpeta: File) {
        assertFalse(cola(carpeta, sincronizar = { false }).medir(sobres(2)).carpetaSincronizada)
    }

    @Test
    fun `exige una carpeta vacia`(@TempDir carpeta: File) {
        File(carpeta, "otro").writeText("x")
        assertThrows(IllegalStateException::class.java) { cola(carpeta).medir(sobres(1)) }
    }

    @Test
    fun `percentiles por rango mas cercano`() {
        val r = Estadistica.de(doubleArrayOf(5.0, 1.0, 3.0, 2.0, 4.0))
        assertEquals(listOf(3.0, 5.0, 5.0, 15.0), listOf(r.p50, r.p95, r.max, r.total))
        val cien = Estadistica.de(DoubleArray(100) { (it + 1).toDouble() })
        assertEquals(listOf(50.0, 95.0, 100.0), listOf(cien.p50, cien.p95, cien.max))
    }
}
```

- [ ] **Paso 2: ver que falla**

`sincronizar banco` copia el árbol de trabajo del banco (sin lo que ignora git) a `/work/banco`.

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon test 2>&1 | grep -E "Unresolved reference|^BUILD"'
```

Esperado:

```
e: file:///work/banco/jvm/puro/src/test/kotlin/vigia/banco/p2/ColaArchivosTest.kt:9:20 Unresolved reference 'Estadistica'.
e: file:///work/banco/jvm/puro/src/test/kotlin/vigia/banco/p2/ColaArchivosTest.kt:27:9 Unresolved reference 'ColaArchivos'.
e: file:///work/banco/jvm/puro/src/test/kotlin/vigia/banco/p2/ColaArchivosTest.kt:34:36 Unresolved reference 'ColaArchivos'.
e: file:///work/banco/jvm/puro/src/test/kotlin/vigia/banco/p2/ColaArchivosTest.kt:63:17 Unresolved reference 'Estadistica'.
e: file:///work/banco/jvm/puro/src/test/kotlin/vigia/banco/p2/ColaArchivosTest.kt:65:20 Unresolved reference 'Estadistica'.
BUILD FAILED in …
```

- [ ] **Paso 3: `Estadistica` y `ColaArchivos`**

`<banco>/jvm/puro/src/main/kotlin/vigia/banco/Estadistica.kt`:

```kotlin
package vigia.banco

/** Resumen de una serie de tiempos en ms: p50, p95 y máximo por rango más cercano (el mismo cálculo que p2.ts), total y n. */
data class Resumen(val p50: Double, val p95: Double, val max: Double, val total: Double, val n: Int)

object Estadistica {
    fun de(ms: DoubleArray): Resumen {
        require(ms.isNotEmpty()) { "serie vacía" }
        val v = ms.sortedArray()
        return Resumen(rango(v, 50), rango(v, 95), v.last(), ms.sum(), ms.size)
    }

    // Rango más cercano: la posición ceil(p · n / 100), contando desde 1.
    private fun rango(ordenados: DoubleArray, p: Int): Double = ordenados[(p * ordenados.size + 99) / 100 - 1]
}
```

`<banco>/jvm/puro/src/main/kotlin/vigia/banco/p2/ColaArchivos.kt`:

```kotlin
package vigia.banco.p2

import vigia.banco.Estadistica
import vigia.banco.Resumen
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.GeneralSecurityException

/**
 * P2: la cola de sobres como archivos cifrados, uno por sobre. Escribir es cifrar, escribir en un temporal con fsync,
 * renombrarlo (atómico dentro de la carpeta) y sincronizar la carpeta; leer es leer el archivo y descifrarlo. El
 * cifrado lo pone quien llama (BancoP2Module): el Keystore por sobre o una clave de datos en software. Cada sobre se
 * mide por separado. Se compila en la JVM, con sus pruebas, y en el APK.
 */
class ColaArchivos(
    private val carpeta: File,
    private val cifrar: (nombre: String, claro: ByteArray) -> ByteArray,
    private val descifrar: (nombre: String, cifrado: ByteArray) -> ByteArray,
    /** fsync de la carpeta tras renombrar; false si el sistema no lo permite. */
    private val sincronizarCarpeta: (File) -> Boolean,
) {
    /** Tiempos por sobre en ms: escribir incluye cifrar, y leer incluye descifrar. */
    data class Medida(
        val escribir: Resumen,
        val cifrar: Resumen,
        val leer: Resumen,
        val descifrar: Resumen,
        val correctos: Int,
        val bytesArchivo: Int,
        val carpetaSincronizada: Boolean,
    )

    fun medir(sobres: List<ByteArray>): Medida {
        check(carpeta.isDirectory && carpeta.list().isNullOrEmpty()) { "la cola necesita una carpeta vacía: $carpeta" }
        val n = sobres.size
        val tEscribir = DoubleArray(n)
        val tCifrar = DoubleArray(n)
        var sincronizada = true
        var bytesArchivo = 0
        for ((i, claro) in sobres.withIndex()) {
            val nombre = nombre(i + 1)
            val t0 = System.nanoTime()
            val cifrado = cifrar(nombre, claro)
            val t1 = System.nanoTime()
            val tmp = File(carpeta, "$nombre.tmp")
            FileOutputStream(tmp).use {
                it.write(cifrado)
                it.fd.sync()
            }
            if (!tmp.renameTo(File(carpeta, nombre))) throw IOException("no se pudo renombrar $tmp")
            if (!sincronizarCarpeta(carpeta)) sincronizada = false
            val t2 = System.nanoTime()
            tCifrar[i] = ms(t1 - t0)
            tEscribir[i] = ms(t2 - t0)
            bytesArchivo = cifrado.size
        }
        val tLeer = DoubleArray(n)
        val tDescifrar = DoubleArray(n)
        var correctos = 0
        for (i in 0 until n) {
            val nombre = nombre(i + 1)
            val t0 = System.nanoTime()
            val cifrado = File(carpeta, nombre).readBytes()
            val t1 = System.nanoTime()
            val claro = try {
                descifrar(nombre, cifrado)
            } catch (e: GeneralSecurityException) {
                null // etiqueta mala: no cuenta como correcto
            }
            val t2 = System.nanoTime()
            tDescifrar[i] = ms(t2 - t1)
            tLeer[i] = ms(t2 - t0)
            if (claro != null && claro.contentEquals(sobres[i])) correctos++
        }
        return Medida(
            Estadistica.de(tEscribir), Estadistica.de(tCifrar), Estadistica.de(tLeer), Estadistica.de(tDescifrar),
            correctos, bytesArchivo, sincronizada,
        )
    }

    companion object {
        /** 000001.sobre, 000002.sobre…: el orden de los nombres es el de la cola. */
        fun nombre(seq: Int): String = seq.toString().padStart(6, '0') + ".sobre"

        private fun ms(nanos: Long): Double = nanos / 1e6
    }
}
```

- [ ] **Paso 4: ver que pasa**

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon test 2>&1 | grep "^BUILD"; grep -ho "testsuite name=\"vigia.banco.p2[^\"]*\" tests=\"[0-9]*\" skipped=\"[0-9]*\" failures=\"[0-9]*\" errors=\"[0-9]*\"" puro/build/test-results/test/*.xml'
```

Esperado:

```
BUILD SUCCESSFUL in …
testsuite name="vigia.banco.p2.ColaArchivosTest" tests="5" skipped="0" failures="0" errors="0"
```

- [ ] **Paso 5: escribir la prueba de JS en la máquina, que falla**

`node:sqlite` trae FTS5 con el mismo tokenizador que op-sqlite (lo que planea H2 para LegalEngine), pero no SQLCipher: aquí se prueban el corpus, la búsqueda, la reconstrucción, los blobs y el resumen de la máquina, y que `probarVault` da mal una base que se lee sin clave. Lo cifrado se prueba en el teléfono.

`<banco>/p2/maquina/p2.test.ts`:

```ts
// Pruebas de P2 en la máquina (tarea 8 de H0b), con node:sqlite, que trae FTS5 con el mismo tokenizador que op-sqlite
// pero no SQLCipher. Uso, desde la raíz del banco: node --test p2/maquina/p2.test.ts
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import {
  BYTES_SOBRE, CABECERA_SQLITE, LEGAL, N_SOBRES, VAULT, buscar, corpus, estadistica, medirBlobs, probarFts, probarVault,
  reconstruir, versiones, type Abrir, type Fila, type Valor,
} from '../../app/pruebas/p2.ts';
import { resumir } from './resumen.ts';

const carpeta = mkdtempSync(join(tmpdir(), 'p2-'));
after(() => rmSync(carpeta, { recursive: true, force: true }));

// node:sqlite con la forma de Bd. La clave se ignora: node:sqlite no cifra.
const aNode = (v: Valor) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v);
const abrir: Abrir = (nombre) => {
  const ruta = join(carpeta, nombre);
  const db = new DatabaseSync(ruta);
  return {
    ejecutar: async (sql, params = []) => db.prepare(sql).all(...params.map(aNode)) as Fila[],
    lote: async (sql, filas) => {
      db.exec('BEGIN');
      try {
        const st = db.prepare(sql);
        for (const f of filas) st.run(...f.map(aNode));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    ruta: () => ruta,
    cerrar: () => db.close(),
    borrar: () => {
      db.close();
      rmSync(ruta, { force: true });
    },
  };
};

const c = corpus();

test('el corpus es determinista, mide unos 0,9 MB y dice "detención" con tilde y nunca sin ella', () => {
  assert.deepEqual(corpus(), c);
  assert.equal(c.documentos.length, 1060);
  assert.equal(new Set(c.documentos.map((d) => d.id)).size, 1060);
  assert.ok(c.bytes > 850_000 && c.bytes < 950_000, `bytes: ${c.bytes}`);
  assert.ok(c.conDetencion.length > 100 && c.conDetencion.length < 1060, `con "detención": ${c.conDetencion.length}`);
  assert.ok(c.documentos.every((d) => !d.texto.toLowerCase().includes('detencion')));
  // Lo mismo que pliega unicode61 con remove_diacritics: quitar las marcas de NFD y pasar a minúsculas.
  const plegado = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  assert.deepEqual(c.documentos.filter((d) => /\bdetencion\b/.test(plegado(d.texto))).map((d) => d.id), c.conDetencion);
});

test('reconstruir crea legal.db y "detencion" y "DETENCIÓN" encuentran justo los documentos con "detención"', async () => {
  const r = await reconstruir(abrir, c);
  assert.equal(r.filas, 1060);
  assert.ok(r.ms > 0);
  const f = await probarFts(abrir, c);
  assert.deepEqual(f, { consulta: 'detencion', esperados: c.conDetencion.length, encontrados: c.conDetencion.length, con_mayusculas: c.conDetencion.length, ok: true });
  const bd = abrir(LEGAL);
  assert.deepEqual(await buscar(bd, 'detencion'), [...c.conDetencion].sort());
  assert.deepEqual(await buscar(bd, 'esto no aparece'), []);
  bd.cerrar();
});

test('sin remove_diacritics, "detencion" no encuentra nada: lo que encuentra lo pliega el tokenizador', async () => {
  const bd = abrir('control.db');
  await bd.ejecutar("CREATE VIRTUAL TABLE legal USING fts5(id UNINDEXED, tipo UNINDEXED, texto, tokenize = 'unicode61 remove_diacritics 0')");
  await bd.lote('INSERT INTO legal(id, tipo, texto) VALUES (?, ?, ?)', c.documentos.map((d) => [d.id, d.tipo, d.texto]));
  assert.deepEqual(await buscar(bd, 'detencion'), []);
  assert.equal((await buscar(bd, 'detención')).length, c.conDetencion.length);
  bd.borrar();
});

test('reconstruir otra vez parte de cero y deja las mismas filas', async () => {
  await reconstruir(abrir, c);
  assert.equal((await reconstruir(abrir, c)).filas, 1060);
  const v = await versiones(abrir);
  assert.match(v.sqlite, /^3\.\d+\.\d+$/);
  assert.equal(v.sqlcipher, null);
});

test('probarVault da mal una base que se lee sin clave y con la cabecera en claro (node:sqlite no cifra)', async () => {
  const v = await probarVault(abrir, `x'${'ab'.repeat(32)}'`, async () => CABECERA_SQLITE);
  assert.equal(v.sin_clave, 'se pudo leer');
  assert.equal(v.otra_clave, 'se pudo leer');
  assert.equal(v.reabre_con_clave, true);
  assert.equal(v.ok, false);
  abrir(VAULT).borrar();
});

test('medirBlobs guarda y lee igual cada blob, uno por transacción, y borra la tabla', async () => {
  const bd = abrir('blobs.db');
  const b = await medirBlobs(bd, 20, 1024);
  assert.equal(b.correctos, 20);
  assert.equal(b.insertar.n, 20);
  assert.equal(b.leer.n, 20);
  assert.match(b.journal_mode, /^[a-z]+$/);
  assert.deepEqual(await bd.ejecutar("SELECT name FROM sqlite_master WHERE name = 'cola'"), []);
  bd.borrar();
  assert.equal(N_SOBRES, 450);
  assert.equal(BYTES_SOBRE, 16_384);
});

test('estadistica: rango más cercano, como Estadistica.kt', () => {
  assert.deepEqual(estadistica([5, 1, 3, 2, 4]), { p50: 3, p95: 5, max: 5, total: 15, n: 5 });
  const cien = estadistica(Array.from({ length: 100 }, (_, i) => i + 1));
  assert.deepEqual([cien.p50, cien.p95, cien.max], [50, 95, 100]);
  assert.throws(() => estadistica([]));
});

// Un resultados.jsonl como el del teléfono, con lo que cambia cada caso.
const r = (p50: number) => ({ p50, p95: p50 * 2, max: p50 * 3, total: p50 * 450, n: 450 });
const cola = (correctos = 450) => ({ escribir: r(10), cifrar: r(5), leer: r(8), descifrar: r(4), correctos, bytes_archivo: 16412, fsync_carpeta: true });
function jsonl(cambiar: (d: any) => void = () => {}) {
  const d = {
    'p2-autoprueba': {
      sqlite: { sqlite: '3.50.4', sqlcipher: '4.10.0 community' },
      corpus: { documentos: 1060, bytes: 820000 },
      fts: { consulta: 'detencion', esperados: 400, encontrados: 400, con_mayusculas: 400, ok: true },
      reconstruccion: { ms: 900, filas: 1060, ok: true },
      vault: { crear_ms: 30, abrir_ms: 5, sin_clave: 'file is not a database', otra_clave: 'file is not a database', cabecera: '9f1c00aa'.repeat(4), reabre_con_clave: true, ok: true },
    },
    'p2-cola': { n: 450, bytes_sobre: 16384, keystore: cola(), clave_datos: { ...cola(), envolver_ms: 12, desenvolver_ms: 9 } },
    'p2-blobs': { n: 450, bytes: 16384, insertar: r(6), leer: r(1), correctos: 450, journal_mode: 'delete', synchronous: '2' },
  };
  cambiar(d);
  return Object.entries(d).map(([prueba, datos], i) => JSON.stringify({ prueba, hora: 1000 + i, datos })).join('\n') + '\n';
}

test('resumen: con todo en orden da ✓ y recalcula los veredictos desde las cifras', () => {
  const s = resumir(jsonl());
  assert.equal(s.ok, true);
  assert.match(s.lineas.join('\n'), /✓ FTS5: "detencion" encuentra 400 de los 400/);
  assert.match(s.lineas.at(-1)!, /^Veredicto: ✓ autoprueba de P2 con 3 de 3 puntos; colas completas: 3 de 3$/);
  // El "ok" del teléfono no cuenta: con 1 de menos, la máquina da ✗ aunque el teléfono diga ok.
  assert.equal(resumir(jsonl((d) => { d['p2-autoprueba'].fts.encontrados = 399; })).ok, false);
});

test('resumen: cada fallo de un punto o de una cola da ✗', () => {
  const casos: ((d: any) => void)[] = [
    (d) => { d['p2-autoprueba'].vault.sin_clave = 'se pudo leer'; },
    (d) => { d['p2-autoprueba'].vault.cabecera = CABECERA_SQLITE; },
    (d) => { d['p2-autoprueba'].vault.reabre_con_clave = false; },
    (d) => { d['p2-autoprueba'].reconstruccion.ms = 2000; },
    (d) => { d['p2-autoprueba'].reconstruccion.filas = 1059; },
    (d) => { d['p2-autoprueba'].fts.esperados = 0; d['p2-autoprueba'].fts.encontrados = 0; d['p2-autoprueba'].fts.con_mayusculas = 0; },
    (d) => { d['p2-cola'].keystore.correctos = 449; },
    (d) => { d['p2-cola'].clave_datos.correctos = 0; },
    (d) => { d['p2-blobs'].correctos = 449; },
  ];
  for (const [i, cambiar] of casos.entries()) assert.equal(resumir(jsonl(cambiar)).ok, false, `caso ${i}`);
});

test('resumen: sin alguna de las tres líneas lo dice y da ✗', () => {
  const s = resumir(jsonl().split('\n').filter((l) => !l.includes('"p2-blobs"')).join('\n'));
  assert.deepEqual(s, { lineas: ['✗ faltan resultados de P2: p2-blobs'], ok: false });
});
```

- [ ] **Paso 6: ver que falla**

`--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` calla el aviso de Node por cargar como ESM un `.ts` de `app/`, cuyo `package.json` no declara `type`.

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test p2/maquina/p2.test.ts 2>&1 | grep -E "ERR_MODULE_NOT_FOUND\]|^ℹ (pass|fail)"'
```

Esperado:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/work/banco/app/pruebas/p2.ts' imported from /work/banco/p2/maquina/p2.test.ts
ℹ pass 0
ℹ fail 1
```

- [ ] **Paso 7: `p2.ts` y el resumen de la máquina**

`<banco>/app/pruebas/p2.ts`:

```ts
// P2 (tarea 8 de H0b): corpus sintético, FTS5 de legal.db, vault.db con SQLCipher y los blobs de la cola en vault.db.
// Sin dependencias de React Native: P2.tsx lo usa con op-sqlite y las pruebas de la máquina (p2/maquina/p2.test.ts),
// con node:sqlite, que tiene FTS5 con el mismo tokenizador.

export type Valor = string | number | null | ArrayBuffer | Uint8Array;
export type Fila = Record<string, unknown>;

/** Lo que P2 pide a una base abierta: op-sqlite en el teléfono y node:sqlite en la máquina. */
export type Bd = {
  ejecutar(sql: string, params?: Valor[]): Promise<Fila[]>;
  /** La misma sentencia con cada fila de parámetros, en una sola transacción. */
  lote(sql: string, filas: Valor[][]): Promise<void>;
  /** Ruta del archivo de la base. */
  ruta(): string;
  cerrar(): void;
  /** Cierra la base y borra su archivo. */
  borrar(): void;
};

/** Abre la base `nombre` (la crea si falta), con la clave de SQLCipher si se da. */
export type Abrir = (nombre: string, clave?: string) => Bd;

export const LEGAL = 'legal.db';
export const VAULT = 'vault.db';
/** El tokenizador de legal.db (DESIGN.md, "Carga" de la interfaz CountryPack). */
export const TOKENIZADOR = 'unicode61 remove_diacritics 2';
/** Los 16 primeros bytes de una base SQLite en claro: "SQLite format 3" y un 0. */
export const CABECERA_SQLITE = '53514c69746520666f726d6174203300';
/** La cola: 450 sobres (30 min a 4 s) de 16 KiB. */
export const N_SOBRES = 450;
export const BYTES_SOBRE = 16_384;

export type Resumen = { p50: number; p95: number; max: number; total: number; n: number };

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** p50, p95 y máximo por rango más cercano (el mismo cálculo que Estadistica.kt), total y n, en ms con 3 decimales. */
export function estadistica(ms: number[]): Resumen {
  if (ms.length === 0) throw new Error('serie vacía');
  const v = [...ms].sort((a, b) => a - b);
  const rango = (p: number) => v[Math.ceil((p * v.length) / 100) - 1];
  return { p50: r3(rango(50)), p95: r3(rango(95)), max: r3(v[v.length - 1]), total: r3(ms.reduce((a, b) => a + b, 0)), n: ms.length };
}

// Generador de 32 bits (mulberry32): el corpus y los blobs salen iguales en cada ejecución y en cada motor.
function generador(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

// Frases de estilo legal con tildes. "detención" sale solo en algunos objetos y nunca se escribe sin tilde: así la
// búsqueda de "detencion" solo encuentra lo que pliega remove_diacritics.
const SUJETOS = [
  'Toda persona', 'La persona detenida', 'El funcionario o funcionaria policial', 'La autoridad judicial',
  'El Ministerio Público', 'Ningún órgano de seguridad ciudadana', 'Quien sea aprehendido o aprehendida',
  'La defensa pública', 'El juez o jueza de control', 'La víctima',
];
const VERBOS = [
  'tiene derecho a conocer', 'deberá garantizar', 'no podrá impedir', 'está obligado u obligada a respetar',
  'podrá solicitar', 'deberá informar sobre', 'tiene la obligación de asegurar', 'no podrá negar',
];
const OBJETOS = [
  'los motivos de su detención', 'el lugar donde se cumple la detención', 'la comunicación inmediata con sus familiares',
  'la asistencia de un abogado o abogada de su confianza', 'la protección de su integridad física, psíquica y moral',
  'la presunción de inocencia', 'la inviolabilidad del hogar doméstico', 'el debido proceso',
  'la identificación del funcionario o funcionaria que actúa', 'la revisión de su teléfono celular',
  'la orden judicial que autoriza la detención', 'la información en un idioma que comprenda',
  'el acceso a la copia del acta', 'la práctica de un examen médico', 'la devolución de sus pertenencias',
];
const COMPLEMENTOS = [
  'en todo estado y grado del proceso', 'sin dilación alguna', 'conforme a la Constitución y a la ley',
  'salvo orden judicial expresa', 'dentro de las cuarenta y ocho horas siguientes', 'en el momento de la aprehensión',
  'sin coacción ni amenaza', 'con las garantías establecidas en el Código', 'aun en estado de excepción',
];
const SITUACIONES = ['alcabala', 'requisa', 'teléfono', 'documentos', 'soborno', 'detención', 'frontera'];

export type Documento = { id: string; tipo: 'articulo' | 'tarjeta'; texto: string };
export type Corpus = { documentos: Documento[]; conDetencion: string[]; bytes: number };

/**
 * Corpus sintético y determinista en español con la forma de la semilla FTS5 de un pack (leyes y tarjetas). Por
 * defecto, 1 000 artículos de unos 600 a 1 000 caracteres y 60 tarjetas: unos 0,9 MB, varias veces lo que cabe
 * esperar del pack VE (tarea 8, "Tamaño del corpus").
 */
export function corpus(articulos = 1000, tarjetas = 60): Corpus {
  const azar = generador(20261014);
  const de = <T>(lista: readonly T[]) => lista[azar() % lista.length];
  const frase = () => `${de(SUJETOS)} ${de(VERBOS)} ${de(OBJETOS)} ${de(COMPLEMENTOS)}.`;
  const documentos: Documento[] = [];
  for (let i = 1; i <= articulos; i++) {
    const largo = 600 + (azar() % 401);
    let texto = `Artículo ${i}.`;
    while (texto.length < largo) texto += ` ${frase()}`;
    documentos.push({ id: `art-${String(i).padStart(4, '0')}`, tipo: 'articulo', texto });
  }
  for (let i = 1; i <= tarjetas; i++) {
    const texto = `Situación: ${de(SITUACIONES)}. Puedes pedir ${de(OBJETOS)}. No están autorizados a negarte ${de(OBJETOS)}.`
      + ` Cuidado: mantén la calma ${de(COMPLEMENTOS)}. ${frase()} ${frase()}`;
    documentos.push({ id: `tar-${String(i).padStart(3, '0')}`, tipo: 'tarjeta', texto });
  }
  const bytes = documentos.reduce((n, d) => n + new TextEncoder().encode(d.texto).length, 0);
  return { documentos, conDetencion: documentos.filter((d) => d.texto.includes('detención')).map((d) => d.id), bytes };
}

/** Lo que hace PackLoader cuando cambia el pack: borrar legal.db y volver a crearla. Mide de borrar a cerrar. */
export async function reconstruir(abrir: Abrir, c: Corpus): Promise<{ ms: number; filas: number }> {
  const t0 = performance.now();
  abrir(LEGAL).borrar();
  const bd = abrir(LEGAL);
  let filas: number;
  try {
    await bd.ejecutar(`CREATE VIRTUAL TABLE legal USING fts5(id UNINDEXED, tipo UNINDEXED, texto, tokenize = '${TOKENIZADOR}')`);
    await bd.lote('INSERT INTO legal(id, tipo, texto) VALUES (?, ?, ?)', c.documentos.map((d) => [d.id, d.tipo, d.texto]));
    await bd.ejecutar("INSERT INTO legal(legal) VALUES ('optimize')");
    filas = Number((await bd.ejecutar('SELECT count(*) AS n FROM legal'))[0].n);
  } finally {
    bd.cerrar();
  }
  return { ms: r3(performance.now() - t0), filas };
}

/** Ids que encuentra FTS5 para el término, como una frase entre comillas, en orden de id. */
export async function buscar(bd: Bd, termino: string): Promise<string[]> {
  const frase = `"${termino.replace(/"/g, '""')}"`;
  return (await bd.ejecutar('SELECT id FROM legal WHERE legal MATCH ? ORDER BY id', [frase])).map((f) => String(f.id));
}

const mismos = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** "detencion" (y "DETENCIÓN") deben encontrar exactamente los documentos que dicen "detención". */
export async function probarFts(abrir: Abrir, c: Corpus) {
  const bd = abrir(LEGAL);
  try {
    const sinTilde = await buscar(bd, 'detencion');
    const mayusculas = await buscar(bd, 'DETENCIÓN');
    const esperados = [...c.conDetencion].sort();
    const ok = esperados.length > 0 && mismos(sinTilde, esperados) && mismos(mayusculas, esperados);
    return { consulta: 'detencion', esperados: esperados.length, encontrados: sinTilde.length, con_mayusculas: mayusculas.length, ok };
  } finally {
    bd.cerrar();
  }
}

/** Versión de SQLite y, si la hay, de SQLCipher. */
export async function versiones(abrir: Abrir) {
  const bd = abrir(LEGAL);
  try {
    const sqlite = String((await bd.ejecutar('SELECT sqlite_version() AS v'))[0].v);
    const cifrado = await bd.ejecutar('PRAGMA cipher_version');
    return { sqlite, sqlcipher: cifrado.length > 0 ? String(Object.values(cifrado[0])[0]) : null };
  } finally {
    bd.cerrar();
  }
}

const ID_PRUEBA = 'incidente-de-prueba-p2';
const NOTA_PRUEBA = 'detención de prueba';
const OTRA_CLAVE = `x'${'00'.repeat(32)}'`;

/** El error al leer vault.db con esa clave (o sin clave); undefined si se pudo leer, que es lo que no debe pasar. */
async function errorAlLeer(abrir: Abrir, clave?: string): Promise<string | undefined> {
  let bd: Bd | undefined;
  try {
    bd = abrir(VAULT, clave);
    await bd.ejecutar('SELECT count(*) AS n FROM sqlite_master');
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    bd?.cerrar();
  }
}

/**
 * vault.db con la clave cruda de BancoP2.claveVault: se crea de cero, no se lee sin clave ni con otra clave, su
 * cabecera no es la de SQLite en claro y se vuelve a abrir con la clave.
 */
export async function probarVault(abrir: Abrir, clave: string, cabecera: (ruta: string) => Promise<string>) {
  abrir(VAULT, clave).borrar();
  const t0 = performance.now();
  const bd = abrir(VAULT, clave);
  let ruta: string;
  try {
    await bd.ejecutar('CREATE TABLE incidentes(id TEXT PRIMARY KEY, nota TEXT NOT NULL)');
    await bd.ejecutar('INSERT INTO incidentes(id, nota) VALUES (?, ?)', [ID_PRUEBA, NOTA_PRUEBA]);
    ruta = bd.ruta();
  } finally {
    bd.cerrar();
  }
  const crearMs = r3(performance.now() - t0);
  const sinClave = await errorAlLeer(abrir);
  const otraClave = await errorAlLeer(abrir, OTRA_CLAVE);
  const cab = await cabecera(ruta);
  const t1 = performance.now();
  const otra = abrir(VAULT, clave);
  let nota: unknown;
  try {
    nota = (await otra.ejecutar('SELECT nota FROM incidentes WHERE id = ?', [ID_PRUEBA]))[0]?.nota;
  } finally {
    otra.cerrar();
  }
  const abrirMs = r3(performance.now() - t1);
  const ok = sinClave !== undefined && otraClave !== undefined && cab !== CABECERA_SQLITE && nota === NOTA_PRUEBA;
  return {
    crear_ms: crearMs, abrir_ms: abrirMs, sin_clave: sinClave ?? 'se pudo leer', otra_clave: otraClave ?? 'se pudo leer',
    cabecera: cab, reabre_con_clave: nota === NOTA_PRUEBA, ok,
  };
}

const aBytes = (v: unknown) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v instanceof Uint8Array ? v : new Uint8Array(0));
const igualesBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * La cola en vault.db desde JS, para comparar con los archivos de Kotlin: `n` blobs de `bytes`, cada uno en su
 * transacción (como llegarían, uno por fragmento), y después cada uno leído por su seq. La tabla se borra al final.
 */
export async function medirBlobs(bd: Bd, n = N_SOBRES, bytes = BYTES_SOBRE) {
  await bd.ejecutar('DROP TABLE IF EXISTS cola');
  await bd.ejecutar('CREATE TABLE cola(seq INTEGER PRIMARY KEY, sobre BLOB NOT NULL)');
  const azar = generador(450);
  const blobs: Uint8Array[] = [];
  const insertar: number[] = [];
  for (let seq = 1; seq <= n; seq++) {
    const blob = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i += 4) {
      const x = azar();
      blob[i] = x;
      blob[i + 1] = x >>> 8;
      blob[i + 2] = x >>> 16;
      blob[i + 3] = x >>> 24;
    }
    blobs.push(blob);
    const t0 = performance.now();
    await bd.ejecutar('INSERT INTO cola(seq, sobre) VALUES (?, ?)', [seq, blob]);
    insertar.push(performance.now() - t0);
  }
  const leer: number[] = [];
  let correctos = 0;
  for (let seq = 1; seq <= n; seq++) {
    const t0 = performance.now();
    const filas = await bd.ejecutar('SELECT sobre FROM cola WHERE seq = ?', [seq]);
    leer.push(performance.now() - t0);
    if (filas.length === 1 && igualesBytes(aBytes(filas[0].sobre), blobs[seq - 1])) correctos++;
  }
  const diario = String(Object.values((await bd.ejecutar('PRAGMA journal_mode'))[0] ?? {})[0]);
  const sincronia = String(Object.values((await bd.ejecutar('PRAGMA synchronous'))[0] ?? {})[0]);
  await bd.ejecutar('DROP TABLE cola');
  return { n, bytes, insertar: estadistica(insertar), leer: estadistica(leer), correctos, journal_mode: diario, synchronous: sincronia };
}
```

`<banco>/p2/maquina/resumen.ts`:

```ts
// Resumen de P2 en la máquina (tarea 8 de H0b): lee el resultados.jsonl que sacó adb pull y da los tres puntos de la
// autoprueba y los tiempos de la cola. Los veredictos se recalculan desde las cifras; no se fía de los "ok" del
// teléfono. Solo imprime cifras. Uso: node p2/maquina/resumen.ts <resultados.jsonl>
import { readFileSync } from 'node:fs';

const CABECERA_SQLITE = '53514c69746520666f726d6174203300';
const NO_LEE = 'se pudo leer';

type Resumen = { p50: number; p95: number; max: number; total: number; n: number };
type Linea = { prueba: string; hora: number; datos: any };

/** La última línea de cada prueba (si se repitió, cuenta la más reciente). */
function ultimas(texto: string): Map<string, Linea> {
  const m = new Map<string, Linea>();
  for (const l of texto.split('\n')) {
    if (l.trim() === '') continue;
    const x = JSON.parse(l) as Linea;
    if (!m.has(x.prueba) || m.get(x.prueba)!.hora <= x.hora) m.set(x.prueba, x);
  }
  return m;
}

const marca = (ok: boolean) => (ok ? '✓' : '✗');
const tiempos = (r: Resumen) => `${r.p50} / ${r.p95} / ${r.max}; ${r.total}`;

/** Las líneas del resumen y si P2 pasa: los tres puntos de la autoprueba y las tres colas completas. */
export function resumir(texto: string): { lineas: string[]; ok: boolean } {
  const m = ultimas(texto);
  const lineas: string[] = [];
  const auto = m.get('p2-autoprueba')?.datos;
  const cola = m.get('p2-cola')?.datos;
  const blobs = m.get('p2-blobs')?.datos;
  if (!auto || !cola || !blobs) {
    const faltan = ['p2-autoprueba', 'p2-cola', 'p2-blobs'].filter((p) => !m.has(p));
    return { lineas: [`✗ faltan resultados de P2: ${faltan.join(', ')}`], ok: false };
  }
  const { fts, vault, reconstruccion: rec, corpus } = auto;
  const okFts = fts.esperados > 0 && fts.encontrados === fts.esperados && fts.con_mayusculas === fts.esperados;
  const okVault = vault.sin_clave !== NO_LEE && vault.otra_clave !== NO_LEE && /^[0-9a-f]{32}$/.test(vault.cabecera)
    && vault.cabecera !== CABECERA_SQLITE && vault.reabre_con_clave === true;
  const okRec = rec.ms < 2000 && rec.filas === corpus.documentos;
  lineas.push(`P2 (SQLite ${auto.sqlite.sqlite}, SQLCipher ${auto.sqlite.sqlcipher ?? 'no'})`);
  lineas.push(`${marca(okFts)} FTS5: "detencion" encuentra ${fts.encontrados} de los ${fts.esperados} documentos con "detención" (con "DETENCIÓN", ${fts.con_mayusculas})`);
  lineas.push(`${marca(okVault)} vault.db: sin clave, "${vault.sin_clave}"; con otra clave, "${vault.otra_clave}"; cabecera ${vault.cabecera}; se reabre con la clave: ${vault.reabre_con_clave ? 'sí' : 'no'} (abrir: ${vault.abrir_ms} ms)`);
  lineas.push(`${marca(okRec)} legal.db: reconstruida en ${rec.ms} ms (criterio: menos de 2000 ms) con ${rec.filas} de ${corpus.documentos} documentos y ${corpus.bytes} bytes`);
  lineas.push(`Cola de ${cola.n} sobres de ${cola.bytes_sobre} bytes (ms por sobre: p50 / p95 / máx; total):`);
  const okColas: boolean[] = [];
  for (const [nombre, x] of [['Keystore por sobre', cola.keystore], ['Clave de datos', cola.clave_datos]] as const) {
    const ok = x.correctos === cola.n;
    okColas.push(ok);
    const extra = x.envolver_ms === undefined ? '' : ` · envolver ${x.envolver_ms} ms, desenvolver ${x.desenvolver_ms} ms`;
    lineas.push(`  ${marca(ok)} ${nombre}: escribir ${tiempos(x.escribir)} · leer ${tiempos(x.leer)} · ${x.correctos} de ${cola.n} · fsync de la carpeta: ${x.fsync_carpeta ? 'sí' : 'no'}${extra}`);
  }
  const okBlobs = blobs.correctos === blobs.n;
  okColas.push(okBlobs);
  lineas.push(`  ${marca(okBlobs)} vault.db desde JS: insertar ${tiempos(blobs.insertar)} · leer ${tiempos(blobs.leer)} · ${blobs.correctos} de ${blobs.n} · journal_mode ${blobs.journal_mode}, synchronous ${blobs.synchronous}`);
  const puntos = [okFts, okVault, okRec].filter(Boolean).length;
  const ok = puntos === 3 && okColas.every(Boolean);
  lineas.push(`Veredicto: ${marca(ok)} autoprueba de P2 con ${puntos} de 3 puntos; colas completas: ${okColas.filter(Boolean).length} de 3`);
  return { lineas, ok };
}

if (import.meta.main) {
  const ruta = process.argv[2];
  if (!ruta) throw new Error('uso: node p2/maquina/resumen.ts <resultados.jsonl>');
  const { lineas, ok } = resumir(readFileSync(ruta, 'utf8'));
  console.log(lineas.join('\n'));
  process.exitCode = ok ? 0 : 1;
}
```

- [ ] **Paso 8: ver que pasa**

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test p2/maquina/p2.test.ts 2>&1 | grep -E "^(✔|✖|ℹ (tests|pass|fail))"'
```

Esperado (los tiempos entre paréntesis cambian):

```
✔ el corpus es determinista, mide unos 0,9 MB y dice "detención" con tilde y nunca sin ella (…ms)
✔ reconstruir crea legal.db y "detencion" y "DETENCIÓN" encuentran justo los documentos con "detención" (…ms)
✔ sin remove_diacritics, "detencion" no encuentra nada: lo que encuentra lo pliega el tokenizador (…ms)
✔ reconstruir otra vez parte de cero y deja las mismas filas (…ms)
✔ probarVault da mal una base que se lee sin clave y con la cabecera en claro (node:sqlite no cifra) (…ms)
✔ medirBlobs guarda y lee igual cada blob, uno por transacción, y borra la tabla (…ms)
✔ estadistica: rango más cercano, como Estadistica.kt (…ms)
✔ resumen: con todo en orden da ✓ y recalcula los veredictos desde las cifras (…ms)
✔ resumen: cada fallo de un punto o de una cola da ✗ (…ms)
✔ resumen: sin alguna de las tres líneas lo dice y da ✗ (…ms)
ℹ tests 10
ℹ pass 10
ℹ fail 0
```

- [ ] **Paso 9: `BancoP2Module`**

Sustituye entero el mínimo de la tarea 4. La cola mide los dos modos con los mismos 450 sobres aleatorios, en `noBackupFilesDir/p2-cola`, que borra al acabar; el fsync de la carpeta usa `android.system.Os` y, si el sistema no lo deja, se anota en `fsync_carpeta` en vez de fallar.

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/BancoP2Module.kt`:

```kotlin
package expo.modules.banco

import android.content.Context
import android.os.SystemClock
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import vigia.banco.Resumen
import vigia.banco.p2.ColaArchivos
import vigia.nucleo.Cifrado
import vigia.nucleo.Codificacion
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.security.SecureRandom

private const val ALIAS_VAULT = "banco-vault"
private const val ALIAS_COLA = "banco-p2-cola"
private const val ALIAS_DATOS = "banco-p2-datos"
private const val ARCHIVO_CLAVE = "vault.clave"
private const val N_SOBRES = 450
private const val BYTES_SOBRE = 16_384

/**
 * BancoP2 (P2): la clave cruda de vault.db, la cabecera de un archivo de la app y la cola como archivos cifrados.
 * La clave de vault.db son 32 bytes aleatorios envueltos con AES-GCM del Keystore (alias banco-vault) en un archivo
 * privado sin copia de seguridad; nunca se guarda en claro ni sale en Resultados.
 */
class BancoP2Module : Module() {
  private val contexto: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BancoP2")

    AsyncFunction("claveVault") { claveVault(contexto) }

    AsyncFunction("cabecera") { ruta: String -> cabecera(contexto, ruta) }

    AsyncFunction("colaArchivos") {
      val json = colaArchivos(contexto).toString()
      Resultados.guardar(contexto, "p2-cola", json)
      json
    }
  }

  /** "x'<64 hex>'": SQLCipher la toma como clave cruda, sin PBKDF2. Guarda solo de dónde salió y cuánto tardó. */
  private fun claveVault(c: Context): String {
    val t0 = SystemClock.elapsedRealtimeNanos()
    val archivo = File(c.noBackupFilesDir, ARCHIVO_CLAVE)
    val nueva = !archivo.exists()
    val clave = if (nueva) {
      ByteArray(32).also { k ->
        SecureRandom().nextBytes(k)
        val tmp = File(c.noBackupFilesDir, "$ARCHIVO_CLAVE.tmp")
        FileOutputStream(tmp).use {
          it.write(Llaves.envolver(ALIAS_VAULT, k))
          it.fd.sync()
        }
        check(tmp.renameTo(archivo)) { "no se pudo guardar la clave envuelta" }
      }
    } else {
      Llaves.desenvolver(ALIAS_VAULT, archivo.readBytes())
    }
    check(clave.size == 32) { "clave de ${clave.size} bytes" }
    val texto = "x'${Codificacion.hex(clave)}'"
    clave.fill(0)
    val ms = (SystemClock.elapsedRealtimeNanos() - t0) / 1e6
    Resultados.guardar(c, "p2-clave", JSONObject().put("origen", if (nueva) "nueva" else "archivo").put("ms", r3(ms)).toString())
    return texto
  }

  /** Hex de los 16 primeros bytes de un archivo de la app (solo dentro de su carpeta de datos). */
  private fun cabecera(c: Context, ruta: String): String {
    val archivo = File(ruta).canonicalFile
    require(archivo.path.startsWith(c.dataDir.canonicalPath + "/")) { "solo archivos de la app" }
    val b = ByteArray(16)
    val n = RandomAccessFile(archivo, "r").use { it.read(b) }
    return Codificacion.hex(b.copyOf(maxOf(n, 0)))
  }

  /**
   * 450 sobres de 16 KiB como archivos cifrados, de dos formas: cada sobre cifrado por el Keystore (la clave nunca
   * sale de él) o con una clave de datos de 32 bytes que el Keystore envuelve una vez y AES-256-GCM en software.
   */
  private fun colaArchivos(c: Context): JSONObject {
    val azar = SecureRandom()
    val sobres = List(N_SOBRES) { ByteArray(BYTES_SOBRE).also { azar.nextBytes(it) } }
    val base = File(c.noBackupFilesDir, "p2-cola")
    base.deleteRecursively()
    try {
      val keystore = medir(File(base, "keystore"), sobres, { _, claro -> Llaves.envolver(ALIAS_COLA, claro) }) { _, cifrado ->
        Llaves.desenvolver(ALIAS_COLA, cifrado)
      }
      val kDatos = ByteArray(32).also { azar.nextBytes(it) }
      val t0 = SystemClock.elapsedRealtimeNanos()
      val envuelta = Llaves.envolver(ALIAS_DATOS, kDatos)
      val t1 = SystemClock.elapsedRealtimeNanos()
      val k = Llaves.desenvolver(ALIAS_DATOS, envuelta)
      val t2 = SystemClock.elapsedRealtimeNanos()
      val datos = try {
        medir(File(base, "clave-datos"), sobres, { nombre, claro -> Cifrado.cifrar(k, aad(nombre), claro) }) { nombre, cifrado ->
          Cifrado.descifrar(k, aad(nombre), cifrado)
        }
      } finally {
        kDatos.fill(0)
        k.fill(0)
      }
      return JSONObject()
        .put("n", N_SOBRES)
        .put("bytes_sobre", BYTES_SOBRE)
        .put("keystore", json(keystore))
        .put("clave_datos", json(datos).put("envolver_ms", r3((t1 - t0) / 1e6)).put("desenvolver_ms", r3((t2 - t1) / 1e6)))
    } finally {
      base.deleteRecursively()
    }
  }

  private fun medir(
    carpeta: File,
    sobres: List<ByteArray>,
    cifrar: (String, ByteArray) -> ByteArray,
    descifrar: (String, ByteArray) -> ByteArray,
  ): ColaArchivos.Medida {
    check(carpeta.mkdirs()) { "no se pudo crear $carpeta" }
    return ColaArchivos(carpeta, cifrar, descifrar, ::sincronizarCarpeta).medir(sobres)
  }

  // fsync de la carpeta, para que el renombrado sobreviva a un corte de corriente.
  private fun sincronizarCarpeta(carpeta: File): Boolean =
    try {
      val fd = Os.open(carpeta.path, OsConstants.O_RDONLY, 0)
      try {
        Os.fsync(fd)
      } finally {
        Os.close(fd)
      }
      true
    } catch (e: ErrnoException) {
      false
    }

  // AAD del archivo: liga cada cifrado a su nombre en la cola.
  private fun aad(nombre: String): ByteArray = "banco/p2/cola\u0000$nombre".toByteArray(Charsets.US_ASCII)

  private fun json(m: ColaArchivos.Medida): JSONObject =
    JSONObject()
      .put("escribir", json(m.escribir))
      .put("cifrar", json(m.cifrar))
      .put("leer", json(m.leer))
      .put("descifrar", json(m.descifrar))
      .put("correctos", m.correctos)
      .put("bytes_archivo", m.bytesArchivo)
      .put("fsync_carpeta", m.carpetaSincronizada)

  private fun json(r: Resumen): JSONObject =
    JSONObject().put("p50", r3(r.p50)).put("p95", r3(r.p95)).put("max", r3(r.max)).put("total", r3(r.total)).put("n", r.n)

  private fun r3(x: Double): Double = Math.round(x * 1000) / 1000.0
}
```

- [ ] **Paso 10: la pantalla de P2**

Sustituye entera la mínima de la tarea 4. Dos botones: la autoprueba (los tres puntos de P2, en grande para la captura) y la cola. Antes de cada prueba deja pintar "En marcha" (el hilo de JS se ocupa).

`<banco>/app/pruebas/P2.tsx`:

```tsx
import { open } from '@op-engineering/op-sqlite';
import { useState } from 'react';
import { Button, ScrollView, Text, View } from 'react-native';
import { BancoP2 } from '../modules/banco';
import { estilos, guardar, legible, mensaje } from './comun';
import { corpus, medirBlobs, N_SOBRES, probarFts, probarVault, reconstruir, versiones, VAULT, type Abrir } from './p2';

// op-sqlite (con sqlcipher y fts5) con la forma que pide p2.ts.
const abrir: Abrir = (nombre, clave) => {
  const bd = open(clave === undefined ? { name: nombre } : { name: nombre, encryptionKey: clave });
  return {
    ejecutar: async (sql, params) => (await bd.execute(sql, params)).rows,
    lote: async (sql, filas) => {
      await bd.executeBatch([[sql, filas]]);
    },
    ruta: () => bd.getDbPath(),
    cerrar: () => bd.close(),
    borrar: () => bd.delete(),
  };
};

type Linea = { ok: boolean; texto: string };

/** P2: FTS5 y legal.db, vault.db con SQLCipher y dónde guarda la cola los sobres. */
export default function P2() {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const ejecutar = async (prueba: () => Promise<{ lineas: Linea[]; json: string }>) => {
    setOcupado(true);
    setLineas([]);
    setTexto('En marcha...');
    // Deja que la pantalla pinte "En marcha" antes de ocupar el hilo de JS.
    await new Promise((listo) => setTimeout(listo, 50));
    try {
      const r = await prueba();
      setLineas(r.lineas);
      setTexto(legible(r.json));
    } catch (e) {
      setTexto(`Error: ${mensaje(e)}`);
    } finally {
      setOcupado(false);
    }
  };

  // Los tres puntos de la autoprueba de P2. Lo guarda como p2-autoprueba.
  const autoprueba = async () => {
    const c = corpus();
    const reconstruccion = await reconstruir(abrir, c);
    const fts = await probarFts(abrir, c);
    const sqlite = await versiones(abrir);
    const vault = await probarVault(abrir, await BancoP2.claveVault(), (ruta) => BancoP2.cabecera(ruta));
    const rapida = reconstruccion.ms < 2000 && reconstruccion.filas === c.documentos.length;
    const json = guardar('p2-autoprueba', {
      sqlite,
      corpus: { documentos: c.documentos.length, bytes: c.bytes },
      fts,
      reconstruccion: { ...reconstruccion, ok: rapida },
      vault,
    });
    return {
      json,
      lineas: [
        { ok: fts.ok, texto: `"detencion" encuentra "detención": ${fts.encontrados} de ${fts.esperados}` },
        { ok: vault.ok, texto: 'vault.db no se lee sin clave y su cabecera no es "SQLite format 3"' },
        { ok: rapida, texto: `legal.db se reconstruye en ${Math.round(reconstruccion.ms)} ms (menos de 2000)` },
      ],
    };
  };

  // La cola de 450 sobres: archivos cifrados en Kotlin (p2-cola) y blobs en vault.db desde JS (p2-blobs).
  const cola = async () => {
    const archivos = JSON.parse(await BancoP2.colaArchivos());
    const bd = abrir(VAULT, await BancoP2.claveVault());
    let blobs: Awaited<ReturnType<typeof medirBlobs>>;
    try {
      blobs = await medirBlobs(bd);
    } finally {
      bd.cerrar();
    }
    guardar('p2-blobs', blobs);
    const ks = archivos.keystore;
    const kd = archivos.clave_datos;
    return {
      json: JSON.stringify({ archivos, blobs }),
      lineas: [
        { ok: ks.correctos === N_SOBRES, texto: `Keystore por sobre: escribir p95 ${ks.escribir.p95} ms, leer p95 ${ks.leer.p95} ms` },
        { ok: kd.correctos === N_SOBRES, texto: `Clave de datos: escribir p95 ${kd.escribir.p95} ms, leer p95 ${kd.leer.p95} ms` },
        { ok: blobs.correctos === N_SOBRES, texto: `vault.db desde JS: insertar p95 ${blobs.insertar.p95} ms, leer p95 ${blobs.leer.p95} ms` },
      ],
    };
  };

  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text style={estilos.titulo}>P2: FTS5, vault.db y cola</Text>
      <View style={estilos.boton}>
        <Button title="1. Autoprueba: FTS5, legal.db y vault.db" disabled={ocupado} onPress={() => ejecutar(autoprueba)} />
      </View>
      <View style={estilos.boton}>
        <Button title="2. Cola: 450 sobres en archivos y en vault.db" disabled={ocupado} onPress={() => ejecutar(cola)} />
      </View>
      {lineas.map((l) => (
        <Text key={l.texto} style={estilos.destacado}>
          {l.ok ? '✓' : '✗'} {l.texto}
        </Text>
      ))}
      <Text style={estilos.resultado}>{texto}</Text>
    </ScrollView>
  );
}
```

- [ ] **Paso 11: commit en el banco**

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit:

```sh
git -C <banco> add app/pruebas/p2.ts app/pruebas/P2.tsx app/modules/banco/android/src/main/java/expo/modules/banco/BancoP2Module.kt jvm/puro/src/main/kotlin/vigia/banco/Estadistica.kt jvm/puro/src/main/kotlin/vigia/banco/p2/ColaArchivos.kt jvm/puro/src/test/kotlin/vigia/banco/p2/ColaArchivosTest.kt p2/maquina/p2.test.ts p2/maquina/resumen.ts
git -C <banco> status --short | grep -c '^??'; git -C <banco> diff --cached --stat | tail -1
git -C <banco> commit -q -m "P2: FTS5 y legal.db, vault.db con SQLCipher y la cola en archivos cifrados o en vault.db" && git -C <banco> log --oneline -1
```

Esperado: `0` (nada sin seguimiento), ` 8 files changed, 911 insertions(+), 12 deletions(-)` y el commit con su hash corto, que es el versionName del paso 12.

- [ ] **Paso 12: compilar los dos APK desde un clon limpio**

Como el paso 9 de la tarea 4. Con la caché llena, unos 5 min; se lanza en segundo plano y se espera a la línea `salida:`. Todavía no hay `/work/h0b/p5/paquete450` (lo crea la tarea 9), así que el APK va sin él.

⚠️ Como en la tarea 4, la primera orden borra y rehace `/work/h0b/limpio`, y `compilar.sh` sustituye los APK de `/work/h0b/salida/apk`: los anteriores se pierden (se pueden rehacer desde su commit).

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'rm -rf /work/h0b/limpio && git clone -q /fuente/banco /work/h0b/limpio && sh /work/h0b/limpio/compilar.sh > /work/h0b/compilar.log 2>&1; echo "salida: $?" >> /work/h0b/compilar.log'
docker exec vigia-build sh -c 'grep -E "^nucleo|^bcprov|BUILD|^==|^[0-9]+ app-|^salida" /work/h0b/compilar.log; grep "^paquete450" /work/h0b/salida/apk/compilacion.txt'
```

Esperado (tamaños de la validación del 14-oct, sobre el andamio de la tarea 4; con el código de las tareas 5 a 7 serán otros):

```
nucleo.jar: OK
bcprov-jdk18on-1.86.jar: OK
BUILD SUCCESSFUL in …
BUILD SUCCESSFUL in …
== sin-r8
35279372 app-arm64-v8a-release.apk
28397088 app-armeabi-v7a-release.apk
36052148 app-x86_64-release.apk
== con-r8
28068419 app-arm64-v8a-release.apk
21186135 app-armeabi-v7a-release.apk
28841195 app-x86_64-release.apk
salida: 0
paquete450: no
```

Frente al andamio, P2 suma unos 43 KB a cada APK, con R8 y sin R8.

- [ ] **Paso 13: comprobar el clon limpio, las fichas, las pruebas y los tipos**

📍 Máquina de trabajo; las órdenes corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec -i vigia-build sh -s <<'EOF'
commit=$(git -C /work/h0b/limpio rev-parse --short HEAD)
echo "cambios en el clon limpio tras compilar: $(git -C /work/h0b/limpio status --porcelain | wc -l)"
for f in /work/h0b/salida/apk/sin-r8/*.ficha.txt /work/h0b/salida/apk/con-r8/*.ficha.txt; do
    printf '%s/%s: ' "$(basename "$(dirname "$f")")" "$(basename "$f" .ficha.txt)"
    grep -q "versionName='$commit'" "$f" && printf 'versión del commit' || printf 'MAL: otra versión'
    grep -q application-debuggable "$f" && printf ', MAL: depurable' || printf ', no depurable'
    grep -q 'Verified using v2 scheme (APK Signature Scheme v2): true' "$f" && printf ', firma v2\n' || printf ', MAL: firma\n'
done
cd /work/h0b/limpio/jvm && ./gradlew --no-daemon test -q; echo "jvm: $?"
cd /work/h0b/limpio && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test p2/maquina/p2.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"
cd /work/h0b/limpio/app && npx tsc --noEmit -p . --allowImportingTsExtensions
EOF
```

Esperado:

```
cambios en el clon limpio tras compilar: 0
sin-r8/app-arm64-v8a-release: versión del commit, no depurable, firma v2
sin-r8/app-armeabi-v7a-release: versión del commit, no depurable, firma v2
sin-r8/app-x86_64-release: versión del commit, no depurable, firma v2
con-r8/app-arm64-v8a-release: versión del commit, no depurable, firma v2
con-r8/app-armeabi-v7a-release: versión del commit, no depurable, firma v2
con-r8/app-x86_64-release: versión del commit, no depurable, firma v2
jvm: 0
ℹ pass 10
ℹ fail 0
vigia-shared/hpke-core.ts(3,75): error TS2307: Cannot find module '@hpke/core' or its corresponding type declarations.
```

El único error de tipos es el de la tarea 4 (`hpke-core.ts` no está en la app).

Lo que pasa en el teléfono (sesión 1) y su análisis en la máquina están en la tarea 13: la parte de P2, con la pantalla encendida desde antes de empezarla, y el análisis de P2.

**Notas:**

- **Nota:** validado el 14-oct-2026 en `vigia-build` (todavía con la imagen de H0a) sobre una copia del andamio de la tarea 4: los pasos 2 y 6 fallan como se indica y los 4 y 8 pasan, con estas salidas; el commit, las dos builds desde un clon limpio (3 min 11 s sin R8 y 1 min 11 s con R8, con la caché llena), las fichas, el clon sin cambios, `jvm/`, las pruebas de la máquina en el clon y los tipos, como en los pasos 11 a 13. Los pasos 4, 8 y 11 se repitieron sobre una copia nueva del andamio con las mismas salidas. Lo que necesita Android (Keystore, `noBackupFilesDir`, `android.system.Os`, op-sqlite con SQLCipher) solo se compila aquí: se ejecuta por primera vez en la sesión 1.
- **Nota:** `jvm/puro` gana con esta tarea una clase de prueba con 5 pruebas (`vigia.banco.p2.ColaArchivosTest`); quien cuente las pruebas de `jvm/` después de la tarea 8 debe sumarlas.
- **Nota:** el corpus de P2 no es el pack VE ni texto legal real: es texto sintético con forma de ley, sin valor, para medir FTS5 y el tiempo de reconstrucción. Las cifras de `node:sqlite` en la máquina (unos 40 ms para reconstruir `legal.db`) no dicen nada del teléfono.

---

### Tarea 9: P5: Keystore, sellado HPKE, verificador en el teléfono (tres variantes), pesos con R8 (BouncyCastle y Tink) y sus herramientas de la máquina

**Archivos (banco, `<banco>`):**
- Modificar: `app/package.json` y `app/package-lock.json` (tres dependencias nuevas, con versión exacta: `@noble/hashes`, `@noble/curves` y `@noble/ciphers` 2.4.0; la tarea 4 sigue siendo dueña de los scripts).
- Crear:
  - `app/pruebas/p5-verificador.ts`, `cripto-noble.ts` y `cripto-kotlin.ts`;
  - `jvm/puro/src/main/kotlin/vigia/banco/p5/Primitivas.kt` y `CosteVerificador.kt`;
  - en `p5/maquina/`: `paquete450.ts`, `firmas.ts`, `sellado.ts`, `tiempos.ts`, `pesos.sh` y `pesos/Vacio.java`, `SellarBc.java`, `SellarTink.java`, `SellarTinkApi.java` y `Comprobar.java`.
- Sustituir (eran los mínimos de la tarea 4): `app/pruebas/P5.tsx` y `app/modules/banco/android/src/main/java/expo/modules/banco/BancoP5Module.kt`.
- Pruebas: `jvm/puro/src/test/kotlin/vigia/banco/p5/PrimitivasTest.kt` y `CosteVerificadorTest.kt` (JUnit) y `p5/maquina/p5.test.ts` (`node:test`).
- Fuera del banco: `/work/h0b/p5/paquete450/` (el paquete sintético; `compilar.sh` lo mete en los assets) y `/work/h0b/p5/pesos/` (Tink y sus dependencias, y lo que deja R8).

**Interfaces:**
- Consume:
  - Tarea 3: `/work/h0b/escucha/publica.b64u`, que llega al APK como `Escucha.kt`, y `<privada>/escucha/privada.b64u`, que solo llega a `sellado.ts` por la entrada estándar.
  - Tarea 4: `Llaves.firmanteKeystore(alias: String, strongBox: Boolean): FirmanteKeystore` (`spki`, `nivel`, `firmar`); `Resultados.guardar`; `Escucha.publica(): ByteArray` y `Escucha.PUBLICA_B64U`; `compilar.sh` (`PAQUETE450`, que copia a los assets como `paquete450/…`); de `comun.ts`, `guardar`, `useEjecucion` y `estilos`; el tipo `ModuloP5` de `app/modules/banco/index.ts`, sin cambios; y `/work/f2-h1`, con shared y `@hpke/core`.
  - Tarea 8: `vigia.banco.Estadistica.de(ms: DoubleArray): Resumen`.
  - H1, núcleo (`nucleo.jar`): `Ecdsa.verificar`, `Der.aP1363`, `Envoltura.envolver`, `HpkeBouncyCastle`, `Registros` (`bytes`, `hash`, `compromisoK`, `huellaAudio`), `Cifrado.descifrar`, `Aad.de`, `Acuses` (`analizar`, `verificar`), `EntradaClave`, `Jcv`, `Prefijos`, `Codificacion` y `Fragmento`; en las pruebas, `FabricaSobres` y `FirmanteSoftware`.
  - H1, shared (`/work/f2-h1/packages/shared/src`, que `compilar.sh` copia a `app/vigia-shared`): la interfaz `Cripto`, `verificarPaquete`, `criptoWebCrypto`, `derAP1363`, `esSpkiP256`, `hpkeCore`, `importarReceptora`, `envolverK`, `desenvolverK`, `compromisoK`, `crearPaquete`, `firmarRegistro`, `firmarAcuse`, `bytesEntradaClave`, `analizarListaClaves`, `formatearHora` y los vectores `firmas-ts.json`, `firmas-kotlin.json`, `registros.json` y `cifrado.json`.
- Produce:
  - Kotlin, paquete `vigia.banco.p5` (`jvm/puro`, también en el APK): `object Primitivas { fun sha256(datos: ByteArray): ByteArray; fun hmacSha256(clave: ByteArray, datos: ByteArray): ByteArray; fun hkdfSha256(ikm: ByteArray, sal: ByteArray, info: ByteArray, n: Int): ByteArray; fun descifrarAesGcm(k: ByteArray, nonce: ByteArray, aad: ByteArray, cifrado: ByteArray): ByteArray }` y `object CosteVerificador { data class Medida(registros, fragmentos, fallos: Int; totalMs, zipMs, jcvMs, ecdsaMs, sha256Ms, aesMs, hmacMs: Double); fun clavesDev(texto: String): List<EntradaClave>; fun medir(zip: ByteArray, clavesDev: String, k: ByteArray?): Medida }`.
  - `BancoP5`, con las firmas del contrato:
    - `llaves()` → y guarda `p5-llaves`: `{"tee":{…},"strongbox":{…}}`. Cada llave: `alias` (`banco-p5-tee` o `banco-p5-strongbox`), `nivel`, `generar_ms`, `n` (100), `primera_ms` (`init` y `firma`), `init_ms` y `firma_ms` (de las firmas 2 a 100), `total_ms` (las 100), `verifica_en_kotlin`, `spki` (b64u) y `pares`, tres `{"mensaje","der","p1363"}` en b64u (las firmas 1, 50 y 100). Sin `FEATURE_STRONGBOX_KEYSTORE`, o si StrongBox falla: `{"disponible":false,"motivo":…}`. Cada mensaje es lo que firma el teléfono por fragmento: `vigia/v1/registro` ‖ 0x00 ‖ el JCV de un registro.
    - `sellado()` → y guarda `p5-sellado`: `{"incidente","rol":"escucha","publica","envoltura","kc","primera_ms","ms"}` (`envoltura` en b64u, 80 bytes; `ms`, de 20 sellados más). `K` no sale nunca: solo `kc`.
    - `costeKotlin(conK)` → y guarda `p5-coste`: `{"con_k","leer_ms","pasadas":[…]}`, dos pasadas seguidas sobre los assets (la primera, en frío), cada una con `registros`, `fragmentos`, `fallos`, `total_ms`, `zip_ms`, `jcv_ms`, `ecdsa_ms`, `sha256_ms`, `aes_ms` y `hmac_ms`.
    - `leerAsset(nombre)` → `Uint8Array`, solo de `paquete450/…`; y, síncronas, `sha256`, `hmacSha256`, `hkdfSha256`, `verificarP256` (`Ecdsa.verificar`) y `descifrarAesGcm`.
  - JS: `criptoNoble(): Cripto` y `criptoKotlin(): Cripto` (solo lo que usa `verificarPaquete`; lo demás lanza); de `p5-verificador.ts`, `FRAGMENTOS_450`, `ZONA` (`America/Caracas`), `type Paquete450`, `leerPaquete450(a)`, `medirVerificador(variante, cripto, p, conK, fragmentos?)`, `type Vectores`, `comprobarVectores(cripto, v): Promise<{ total; bien; fallos }>` (72 casos) y `comprobarHermes()`.
  - Líneas de `resultados.jsonl`: `p5-llaves`, `p5-sellado`, `p5-hermes`, `p5-vectores` (`{"hermes","noble","kotlin"}`), `p5-verificador` (una por variante y K: `variante`, `con_k`, `ms`, `estado`, `fragmentos`, `hallazgos`, `audio`, `ok` y `leer_ms`) y `p5-coste`.
  - Herramientas de la máquina, con `SHARED` (por defecto `/work/f2-h1/packages/shared/src`): `paquete450.ts [<carpeta nueva>]`, `firmas.ts <resultados.jsonl>`, `sellado.ts <resultados.jsonl> < privada.b64u` y `tiempos.ts <resultados.jsonl>`; y `pesos.sh [<carpeta nueva>]`, dentro de `vigia-build`.

**Las tres variantes del verificador.** El criterio de P5 es verificar 30 min de evidencia (450 fragmentos de 4 s) en menos de 5 s en el gama baja, y elegir dónde verifica la app. Hermes no trae WebCrypto, así que el `verificarPaquete` de shared necesita otro `Cripto`:
1. `cripto-noble`: JS puro, con @noble 2.4.0 (la candidata para Hermes que propuso la revisión del código de H1 para este plan). Repite las comprobaciones previas de `criptoWebCrypto` (SPKI P-256 de 91 bytes, firma de 64 y 0 < r, s < n, sin BigInt) y acepta `s` alto: @noble/curves 2.4.0 lo rechaza por defecto, por eso pasa `lowS: false`.
2. `cripto-kotlin`: el mismo `verificarPaquete` en Hermes, con las primitivas del núcleo por el módulo Expo (funciones síncronas): la respuesta mixta a "dónde verifica la app".
3. `costeKotlin`: un bucle en Kotlin con las primitivas del núcleo, sin la lógica de cadena, cierre y marcas (solo existe en TS): da una cota inferior de lo que costaría un verificador en Kotlin, y por eso no cuenta como verificador.

Las tres miden el mismo paquete, `paquete450.ts`: 450 fragmentos de 16 000 bytes (32 kb/s a 4 s), una clave de dispositivo y una de acuse de dev efímeras, y `K` aleatoria; datos sintéticos sin valor, que `verificarPaquete` da por íntegros antes de escribirlos. Las variantes de JS se miden con K y sin K, y cada una pasa antes los 72 casos de los vectores de shared en el teléfono.

**Riesgos de Hermes y cómo se comprueban.** El verificador usa:
- `TextEncoder` (`utf8()` de shared, en casi todo): la VM de Hermes lo trae (la revisión del código de H1 lo encontró en `libhermesvm.so`), aunque `hermesc` no lo declara;
- `TextDecoder` (`analizarJcv`, `leerZip`): Hermes no lo trae, pero Expo 57 instala uno de UTF-8 en JS (`expo/src/winter/TextDecoder.ts`) que respeta `byteOffset` de las vistas (leído el 14-oct);
- `Intl.DateTimeFormat` con `timeZone` y `formatToParts` (`formatearHora`): en Android lo da el Intl de hermes-android;
- `BigInt` (en `cripto.ts` de shared, al cargar, y en @noble/curves): Hermes lo tiene desde React Native 0.70, y `hermesc` lo declara;
- `Object.hasOwn` (`analizarJcv`).

`crypto.getRandomValues` y `crypto.subtle` no hacen falta. En la máquina no hay un Hermes que ejecute JS (solo `hermesc`): `comprobarHermes()` lo prueba en el teléfono (botón 3) y el paso 16 comprueba que el bundle compila con hermesc. Si en el teléfono falta algo, `tiempos.ts` lo dice y el verificador de JS no cuenta.

**Versiones nuevas**, todas publicadas hace 7 días o más el 14-oct-2026: @noble/hashes, @noble/curves (que pide exactamente @noble/hashes 2.4.0) y @noble/ciphers 2.4.0, del 27-ago-2026 y sin scripts de instalación; Tink `com.google.crypto.tink:tink-android` 1.23.0, del 9-jul-2026, que lleva protobuf dentro (`com.google.crypto.tink.shaded.protobuf`, 539 clases) y cuyo POM pide gson 2.13.2, error_prone_annotations 2.41.0, jsr305 3.0.2 y androidx `annotation-jvm` 1.8.2. Tink solo se baja para medir su peso: no entra al banco ni al APK. La tarea 16 añade estas filas a "Versiones fijadas (H0b)" del informe.

- [ ] **Paso 1: las dependencias de @noble, con versión exacta**

El lockfile se genera en el contenedor con `--before 2026-10-07` (versiones publicadas hace 7 días o más) y `--ignore-scripts`, y se trae con `docker cp -L`. No cambia nada más del lockfile.

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/app && npm install --save-exact --before 2026-10-07 --ignore-scripts --no-audit --no-fund @noble/hashes@2.4.0 @noble/curves@2.4.0 @noble/ciphers@2.4.0 2>&1 | tail -n 1'
for f in package.json package-lock.json; do docker cp -L vigia-build:/work/banco/app/$f <banco>/app/$f && test -f <banco>/app/$f && ! test -L <banco>/app/$f; done
git -C <banco> diff --stat
git -C <banco> diff app/package-lock.json | grep -E '^\+ +"(version|integrity)"'
```

Esperado: `added … packages in …s`; después,

```
 app/package-lock.json | 42 ++++++++++++++++++++++++++++++++++++++++++
 app/package.json      |  3 +++
 2 files changed, 45 insertions(+)
+      "version": "2.4.0",
+      "integrity": "sha512-AnjFn0Jv92laAkvMrghlFZq4qQCIN/4DxFV/eooqtC2YTjB7kBeLMS2T9KJX4Dn+ZVXLOwK0lSgqDtx9gvxtiw==",
+      "version": "2.4.0",
+      "integrity": "sha512-P4/62zrgfH33CneE3Dn4WhJVA22YUU0eR51wKIan4NVRvwsA0YnPTwWGpNbpuacSujmSFLvyzpyuR30+fbq2Ew==",
+      "version": "2.4.0",
+      "integrity": "sha512-X5XaVWZIBCT7HHZGm5I7ZQXDwLG+bGXuSrMQAW+7Zvl87h1kmc1ZB1VSRJcpUfoUrGQp4Fkoxm5kZ+Ms+aW+eA==",
```

(ciphers, curves y hashes, en ese orden; son las sumas que publica npm). Si la diferencia trae más paquetes que esos tres, parar: el lockfile se ha resuelto de otra forma.

- [ ] **Paso 2: escribir las pruebas de Kotlin, que fallan**

Las primitivas, con vectores publicados (y `p` como la calcula el núcleo); la cota, con un paquete del contrato hecho con el núcleo (apertura, 5 fragmentos y cierre, acuses de una clave de dev) y sus fallos: un cifrado cambiado, otra K, una firma y un acuse malos. La última prueba solo corre con `PAQUETE450` y comprueba en la JVM el paquete de 450 sobres que hace Node (paso 11).

`<banco>/jvm/puro/src/test/kotlin/vigia/banco/p5/PrimitivasTest.kt`:

```kotlin
package vigia.banco.p5

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import vigia.nucleo.Codificacion
import vigia.nucleo.ErrorFormato
import vigia.nucleo.Registros
import java.security.SecureRandom
import javax.crypto.AEADBadTagException

class PrimitivasTest {
    private fun hex(t: String) = Codificacion.deHex(t)

    @Test
    fun `SHA-256 de abc, FIPS 180-2`() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Codificacion.hex(Primitivas.sha256("abc".toByteArray())))
    }

    @Test
    fun `HMAC-SHA-256, RFC 4231 caso 2`() {
        val mac = Primitivas.hmacSha256("Jefe".toByteArray(), "what do ya want for nothing?".toByteArray())
        assertEquals("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843", Codificacion.hex(mac))
    }

    @Test
    fun `HKDF-SHA256, RFC 5869 casos 1 y 3 (sal e info vacias)`() {
        val ikm = ByteArray(22) { 0x0b }
        val okm1 = Primitivas.hkdfSha256(ikm, hex("000102030405060708090a0b0c"), hex("f0f1f2f3f4f5f6f7f8f9"), 42)
        assertEquals("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865", Codificacion.hex(okm1))
        val okm3 = Primitivas.hkdfSha256(ikm, ByteArray(0), ByteArray(0), 42)
        assertEquals("8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8", Codificacion.hex(okm3))
        assertThrows(ErrorFormato::class.java) { Primitivas.hkdfSha256(ikm, ByteArray(0), ByteArray(0), 255 * 32 + 1) }
    }

    @Test
    fun `p como la calcula el nucleo, con HKDF de 32 ceros de sal y HMAC`() {
        val azar = SecureRandom()
        val k = ByteArray(32).also { azar.nextBytes(it) }
        val audio = ByteArray(16_000).also { azar.nextBytes(it) }
        val kp = Primitivas.hkdfSha256(k, ByteArray(32), "vigia/v1/p".toByteArray(Charsets.US_ASCII), 32)
        assertEquals(Registros.huellaAudio(k, audio), Codificacion.hex(Primitivas.hmacSha256(kp, audio)))
    }

    @Test
    fun `AES-256-GCM, caso 16 de GCM, y una etiqueta cambiada lanza`() {
        val k = hex("feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308")
        val nonce = hex("cafebabefacedbaddecaf888")
        val aad = hex("feedfacedeadbeeffeedfacedeadbeefabaddad2")
        val claro = hex("d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39")
        val cifrado = hex(
            "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662" +
                "76fc6ece0f4e1768cddf8853bb2d551b",
        )
        assertArrayEquals(claro, Primitivas.descifrarAesGcm(k, nonce, aad, cifrado))
        val tocado = cifrado.copyOf().also { it[it.size - 1] = (it[it.size - 1].toInt() xor 1).toByte() }
        assertThrows(AEADBadTagException::class.java) { Primitivas.descifrarAesGcm(k, nonce, aad, tocado) }
    }

    @Test
    fun `AES-GCM solo con clave de 32 bytes y nonce de 12`() {
        assertThrows(ErrorFormato::class.java) { Primitivas.descifrarAesGcm(ByteArray(16), ByteArray(12), ByteArray(0), ByteArray(16)) }
        assertThrows(ErrorFormato::class.java) { Primitivas.descifrarAesGcm(ByteArray(32), ByteArray(16), ByteArray(0), ByteArray(16)) }
    }
}
```

`<banco>/jvm/puro/src/test/kotlin/vigia/banco/p5/CosteVerificadorTest.kt`:

```kotlin
package vigia.banco.p5

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import vigia.nucleo.Codificacion
import vigia.nucleo.FabricaSobres
import vigia.nucleo.FirmanteSoftware
import vigia.nucleo.Jcv
import vigia.nucleo.Prefijos
import vigia.nucleo.Registros
import vigia.nucleo.Sobre
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.spec.ECGenParameterSpec
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class CosteVerificadorTest {
    private val azar = SecureRandom()
    private val servidor = par()
    private val claves = String(
        Jcv.codificar(mapOf("desde" to 0L, "estado" to "activa", "kid" to "dev", "spki" to Codificacion.b64u(servidor.public.encoded), "v" to 1L)),
        Charsets.US_ASCII,
    ) + "\n"

    private fun par(): KeyPair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()

    private fun acuse(rHash: String, hora: Long): ByteArray {
        val contenido = mapOf("hora_servidor" to hora, "kid" to "dev", "r" to rHash, "v" to 1L)
        val firma = FirmanteSoftware(servidor).firmar(Prefijos.ACUSE + Jcv.codificar(contenido))
        return Jcv.codificar(contenido + ("firma" to Codificacion.b64u(firma)))
    }

    /** Un paquete del contrato hecho con el núcleo: apertura, 5 fragmentos y cierre, con acuses de una clave de dev. */
    private fun paquete(k: ByteArray, cambiar: (MutableMap<String, ByteArray>) -> Unit = {}): ByteArray {
        val dispositivo = par()
        val incidente = Codificacion.b64u(ByteArray(16).also { azar.nextBytes(it) })
        val fabrica = FabricaSobres(FirmanteSoftware(dispositivo), incidente, k)
        val t0 = 1_791_986_400_000L
        val archivos = linkedMapOf(
            "incidente.json" to Jcv.codificar(mapOf("incidente" to incidente, "spki" to Codificacion.b64u(dispositivo.public.encoded), "v" to 1L)),
        )
        fun poner(base: String, s: Sobre, hora: Long) {
            archivos["registros/$base.r"] = s.r
            archivos["registros/$base.s"] = s.s
            archivos["acuses/$base.json"] = acuse(Registros.hash(s.r), hora)
            if (s.cifrado.isNotEmpty()) archivos["cifrados/$base.bin"] = s.cifrado
        }
        poner("000000", fabrica.apertura(t0, "VE", "grabar"), t0 + 1_000)
        for (i in 1..5) poner(i.toString().padStart(6, '0'), fabrica.fragmento(t0 + i * 4_000L, ByteArray(1_000).also { azar.nextBytes(it) }), t0 + i * 4_000L + 1_000)
        poner("cierre", fabrica.cierre(t0 + 30_000), t0 + 31_000)
        cambiar(archivos)
        val salida = ByteArrayOutputStream()
        ZipOutputStream(salida).use { z ->
            for ((nombre, bytes) in archivos) {
                z.putNextEntry(ZipEntry(nombre))
                z.write(bytes)
                z.closeEntry()
            }
        }
        return salida.toByteArray()
    }

    private fun cuenta(m: CosteVerificador.Medida) = listOf(m.registros, m.fragmentos, m.fallos)

    @Test
    fun `verifica firma, acuse y c de cada registro y, con K, kc, el descifrado y p`() {
        val k = ByteArray(32).also { azar.nextBytes(it) }
        val zip = paquete(k)
        val conK = CosteVerificador.medir(zip, claves, k)
        assertEquals(listOf(7, 5, 0), cuenta(conK))
        assertEquals(listOf(7, 5, 0), cuenta(CosteVerificador.medir(zip, claves, null)))
        assertEquals(true, conK.aesMs > 0 && conK.hmacMs > 0 && conK.ecdsaMs > 0 && conK.totalMs >= conK.ecdsaMs)
    }

    @Test
    fun `un cifrado cambiado falla tambien sin K`() {
        val k = ByteArray(32).also { azar.nextBytes(it) }
        val zip = paquete(k) { a -> a.getValue("cifrados/000002.bin").let { it[40] = (it[40].toInt() xor 1).toByte() } }
        assertEquals(listOf(7, 5, 1), cuenta(CosteVerificador.medir(zip, claves, null)))
    }

    @Test
    fun `con otra K fallan la apertura y los cinco fragmentos`() {
        val zip = paquete(ByteArray(32).also { azar.nextBytes(it) })
        assertEquals(listOf(7, 5, 6), cuenta(CosteVerificador.medir(zip, claves, ByteArray(32).also { azar.nextBytes(it) })))
    }

    @Test
    fun `una firma o un acuse que no verifican cuentan como fallo`() {
        val k = ByteArray(32).also { azar.nextBytes(it) }
        val zip = paquete(k) { a ->
            a.getValue("registros/000004.s").let { it[10] = (it[10].toInt() xor 1).toByte() }
            a["acuses/cierre.json"] = acuse("0".repeat(64), 1)
        }
        assertEquals(listOf(7, 5, 2), cuenta(CosteVerificador.medir(zip, claves, k)))
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "PAQUETE450", matches = ".+")
    fun `el paquete de 450 sobres de paquete450_ts verifica entero en la JVM`() {
        val dir = File(System.getenv("PAQUETE450"))
        val zip = File(dir, "paquete.zip").readBytes()
        val claves450 = File(dir, "claves-dev.txt").readText()
        val k = Codificacion.deB64u(File(dir, "k.b64u").readText().trim())
        val conK = CosteVerificador.medir(zip, claves450, k)
        assertEquals(listOf(452, 450, 0), cuenta(conK))
        assertEquals(listOf(452, 450, 0), cuenta(CosteVerificador.medir(zip, claves450, null)))
        println("paquete450 en la JVM, con K: ${conK.totalMs.toLong()} ms")
    }
}
```

- [ ] **Paso 3: ver que fallan**

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon test > /tmp/p5-jvm.log 2>&1; grep -cE "Unresolved reference .(Primitivas|CosteVerificador)." /tmp/p5-jvm.log; grep "^BUILD" /tmp/p5-jvm.log'
```

Esperado: `19` (8 de `CosteVerificador` y 11 de `Primitivas`) y `BUILD FAILED in …`.

- [ ] **Paso 4: las primitivas y la cota en Kotlin**

`<banco>/jvm/puro/src/main/kotlin/vigia/banco/p5/Primitivas.kt`:

```kotlin
package vigia.banco.p5

import vigia.nucleo.ErrorFormato
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Las primitivas del Cripto de shared que usa verificarPaquete, en Kotlin y con la JCA del sistema (P5): el
 * verificador de JS las llama por BancoP5 (cripto-kotlin.ts). verificarP256 es Ecdsa.verificar del núcleo.
 */
object Primitivas {
    fun sha256(datos: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(datos)

    /** HMAC-SHA-256. Una clave vacía vale lo mismo que 32 ceros (HMAC rellena con ceros); SecretKeySpec no la admite. */
    fun hmacSha256(clave: ByteArray, datos: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(if (clave.isEmpty()) ByteArray(32) else clave, "HmacSHA256"))
            doFinal(datos)
        }

    /** HKDF-SHA256 de RFC 5869: extraer con la sal (vacía, 32 ceros) y expandir `n` bytes, hasta 255 · 32. */
    fun hkdfSha256(ikm: ByteArray, sal: ByteArray, info: ByteArray, n: Int): ByteArray {
        if (n !in 0..255 * 32) throw ErrorFormato("HKDF: longitud imposible")
        val prk = hmacSha256(sal, ikm)
        val salida = ByteArray(n)
        var t = ByteArray(0)
        var hecho = 0
        var i = 1
        while (hecho < n) {
            t = hmacSha256(prk, t + info + byteArrayOf(i.toByte()))
            val m = minOf(32, n - hecho)
            t.copyInto(salida, hecho, 0, m)
            hecho += m
            i++
        }
        return salida
    }

    /** AES-256-GCM con etiqueta de 16 bytes. Como criptoWebCrypto: solo clave de 32 bytes y nonce de 12. */
    fun descifrarAesGcm(k: ByteArray, nonce: ByteArray, aad: ByteArray, cifrado: ByteArray): ByteArray {
        if (k.size != 32 || nonce.size != 12) throw ErrorFormato("aes")
        return Cipher.getInstance("AES/GCM/NoPadding").run {
            init(Cipher.DECRYPT_MODE, SecretKeySpec(k, "AES"), GCMParameterSpec(128, nonce))
            updateAAD(aad)
            doFinal(cifrado)
        }
    }
}
```

`<banco>/jvm/puro/src/main/kotlin/vigia/banco/p5/CosteVerificador.kt`:

```kotlin
package vigia.banco.p5

import vigia.nucleo.Aad
import vigia.nucleo.Acuses
import vigia.nucleo.Cifrado
import vigia.nucleo.Codificacion
import vigia.nucleo.Ecdsa
import vigia.nucleo.EntradaClave
import vigia.nucleo.ErrorFormato
import vigia.nucleo.Jcv
import vigia.nucleo.Prefijos
import vigia.nucleo.Registros
import java.io.ByteArrayInputStream
import java.security.GeneralSecurityException
import java.util.zip.ZipInputStream

/**
 * Cota de coste de un verificador en Kotlin (P5): las primitivas del núcleo sobre un paquete del contrato (sección
 * 14), registro a registro: el JCV, la firma `s`, el acuse, `c` de cada fragmento y, con K, `kc`, el descifrado y
 * `p`. No hace la lógica de cadena, cierre y marcas de verificarPaquete, que solo existe en TS: por eso es una cota.
 */
object CosteVerificador {
    /** Tiempos en ms. El desglose suma cada primitiva; el resto del total es el bucle y los mapas. */
    data class Medida(
        val registros: Int,
        val fragmentos: Int,
        val fallos: Int,
        val totalMs: Double,
        val zipMs: Double,
        val jcvMs: Double,
        val ecdsaMs: Double,
        val sha256Ms: Double,
        val aesMs: Double,
        val hmacMs: Double,
    )

    private const val ZIP = 0
    private const val JCV = 1
    private const val ECDSA = 2
    private const val SHA = 3
    private const val AES = 4
    private const val HMAC = 5

    private const val MAX = 9_007_199_254_740_991L // 2^53 - 1
    private val HEX64 = Jcv.Cadena(Regex("[0-9a-f]{64}"))
    private val ID = Jcv.Cadena(Regex("[A-Za-z0-9_-]{22}"))
    private val TIPO = Regex("\"tipo\":\"([a-z]+)\"")
    private val INCIDENTE = mapOf("incidente" to ID, "spki" to Jcv.Cadena(Regex("[A-Za-z0-9_-]{122}")), "v" to Jcv.Entero(1, 1))
    private val CLAVE = mapOf(
        "desde" to Jcv.Entero(0, MAX), "estado" to Jcv.Cadena(Regex("activa|retirada|comprometida")),
        "hasta" to Jcv.Entero(0, MAX, opcional = true), "kid" to Jcv.Cadena(Regex("[a-z][a-z0-9_]{0,31}")),
        "spki" to Jcv.Cadena(Regex("[A-Za-z0-9_-]{122}")), "v" to Jcv.Entero(1, 1),
    )

    // Los esquemas de la sección 4 que trae un paquete de prueba (apertura, fragmentos y cierre).
    private fun comunes(tipo: String) =
        mapOf("v" to Jcv.Entero(1, 1), "tipo" to Jcv.Cadena(Regex(tipo)), "incidente" to ID, "hora_telefono" to Jcv.Entero(0, MAX))
    private val ESQUEMAS = mapOf(
        "apertura" to comunes("apertura") + mapOf(
            "seq" to Jcv.Entero(0, 0), "country_code" to Jcv.Cadena(Regex("[A-Z]{2}")), "dispositivo" to HEX64,
            "origen" to Jcv.Cadena(Regex("grabar|sos")), "kc" to HEX64,
        ),
        "fragmento" to comunes("fragmento") + mapOf(
            "seq" to Jcv.Entero(1, 999_999), "p" to HEX64, "c" to HEX64, "prev" to HEX64,
            "loc" to Jcv.Cadena(Regex("[A-Za-z0-9_-]{208}"), opcional = true),
        ),
        "cierre" to comunes("cierre") + mapOf("ultimo_seq" to Jcv.Entero(0, 999_999), "hash_final" to HEX64),
    )

    /** La lista fijada de claves de acuse: una entrada JCV por línea (contrato, sección 7). */
    fun clavesDev(texto: String): List<EntradaClave> =
        texto.split('\n').filter { it.isNotEmpty() }.map { linea ->
            val c = Jcv.analizar(linea.toByteArray(Charsets.US_ASCII), CLAVE)
            EntradaClave(
                c.getValue("kid") as String, Codificacion.deB64u(c.getValue("spki") as String), c.getValue("estado") as String,
                c.getValue("desde") as Long, c["hasta"] as Long?,
            )
        }

    fun medir(zip: ByteArray, clavesDev: String, k: ByteArray?): Medida {
        val t = LongArray(6)
        val inicio = System.nanoTime()
        val archivos = cron(t, ZIP) { leerZip(zip) }
        val inc = cron(t, JCV) { Jcv.analizar(archivos.getValue("incidente.json"), INCIDENTE) }
        val incidente = inc.getValue("incidente") as String
        val spki = Codificacion.deB64u(inc.getValue("spki") as String)
        val claves = clavesDev(clavesDev)
        var registros = 0
        var fragmentos = 0
        var fallos = 0
        for (nombre in archivos.keys.filter { it.startsWith("registros/") && it.endsWith(".r") }.sorted()) {
            val base = nombre.substring("registros/".length, nombre.length - 2)
            val r = archivos.getValue(nombre)
            registros++
            val bien = try {
                val tipo = TIPO.find(String(r, Charsets.ISO_8859_1))?.groupValues?.get(1)
                val campos = cron(t, JCV) { Jcv.analizar(r, ESQUEMAS[tipo] ?: throw ErrorFormato("tipo $tipo")) }
                val hash = cron(t, SHA) { Registros.hash(r) }
                val prefijo = if (tipo == "cierre") Prefijos.CIERRE else Prefijos.REGISTRO
                val s = archivos["registros/$base.s"]
                val acuse = archivos["acuses/$base.json"]
                var ok = s != null && cron(t, ECDSA) { Ecdsa.verificar(spki, prefijo + r, s) }
                ok = ok && acuse != null && cron(t, ECDSA) { Acuses.verificar(claves, Acuses.analizar(acuse), hash) }
                if (tipo == "apertura" && k != null) {
                    ok = ok && cron(t, SHA) { Registros.compromisoK(incidente, k) } == campos["kc"]
                }
                if (tipo == "fragmento") {
                    fragmentos++
                    val bin = archivos["cifrados/$base.bin"]
                    ok = ok && bin != null && cron(t, SHA) { Registros.hash(bin) } == campos["c"]
                    if (ok && k != null) {
                        val seq = campos.getValue("seq") as Long
                        val audio = cron(t, AES) { Cifrado.descifrar(k, Aad.de("ct", incidente, seq), bin!!) }
                        ok = cron(t, HMAC) { Registros.huellaAudio(k, audio) } == campos["p"]
                    }
                }
                ok
            } catch (e: ErrorFormato) {
                false
            } catch (e: GeneralSecurityException) {
                false // etiqueta de AES-GCM mala: otra K o un cifrado cambiado
            }
            if (!bien) fallos++
        }
        val ms = { nanos: Long -> nanos / 1e6 }
        return Medida(
            registros, fragmentos, fallos, ms(System.nanoTime() - inicio),
            ms(t[ZIP]), ms(t[JCV]), ms(t[ECDSA]), ms(t[SHA]), ms(t[AES]), ms(t[HMAC]),
        )
    }

    private fun leerZip(zip: ByteArray): Map<String, ByteArray> {
        val archivos = LinkedHashMap<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(zip)).use { z ->
            while (true) {
                val e = z.nextEntry ?: break
                archivos[e.name] = z.readBytes()
            }
        }
        return archivos
    }

    private inline fun <T> cron(t: LongArray, i: Int, f: () -> T): T {
        val a = System.nanoTime()
        try {
            return f()
        } finally {
            t[i] += System.nanoTime() - a
        }
    }
}
```

- [ ] **Paso 5: ver que pasan**

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon test 2>&1 | grep "^BUILD"; grep -ho "testsuite name=\"vigia.banco.p5[^\"]*\" tests=\"[0-9]*\" skipped=\"[0-9]*\" failures=\"[0-9]*\" errors=\"[0-9]*\"" puro/build/test-results/test/*.xml'
```

Esperado:

```
BUILD SUCCESSFUL in …
testsuite name="vigia.banco.p5.CosteVerificadorTest" tests="5" skipped="1" failures="0" errors="0"
testsuite name="vigia.banco.p5.PrimitivasTest" tests="6" skipped="0" failures="0" errors="0"
```

La que se salta es la del paquete de 450 sobres, que espera a `PAQUETE450` (paso 11).

- [ ] **Paso 6: escribir la prueba de la máquina, que falla**

Comprueba `cripto-noble` contra los vectores de shared con WebCrypto de Node como control (los mismos 72 casos y el mismo resultado), sus comprobaciones previas, el verificador del teléfono sobre un paquete pequeño de `paquete450.ts`, y `firmas.ts`, `sellado.ts` y `tiempos.ts` con resultados sintéticos (también los casos que deben dar ✗). Necesita `app/node_modules`, que deja el paso 1, y `app/vigia-shared`, que se copia como hace `compilar.sh`.

`<banco>/p5/maquina/p5.test.ts`:

```ts
// Pruebas de P5 en la máquina (tarea 9 de H0b): cripto-noble contra los vectores de shared (con WebCrypto de control),
// el verificador del teléfono sobre un paquete pequeño y las herramientas de análisis con resultados sintéticos.
// Uso, desde la raíz del banco, con app/node_modules y app/vigia-shared: node --test p5/maquina/p5.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { criptoNoble } from '../../app/pruebas/cripto-noble.ts';
import { comprobarHermes, comprobarVectores, medirVerificador, type Vectores } from '../../app/pruebas/p5-verificador.ts';
import { ErrorFormato } from '../../app/vigia-shared/index.ts';
import { analizarFirmas } from './firmas.ts';
import { comprobar, generar } from './paquete450.ts';
import { analizarSellado } from './sellado.ts';
import { resumirTiempos } from './tiempos.ts';

const SHARED = process.env.SHARED ?? '/work/f2-h1/packages/shared/src';
const s = await import(`${SHARED}/index.ts`);
const { hpkeCore } = await import(`${SHARED}/hpke-core.ts`);
const web = s.criptoWebCrypto();
const leer = (n: string) => JSON.parse(readFileSync(join(SHARED, '..', 'vectores', n), 'utf8'));
const v: Vectores = { firmasTs: leer('firmas-ts.json'), firmasKotlin: leer('firmas-kotlin.json'), registros: leer('registros.json'), cifrado: leer('cifrado.json') };
const N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const entero32 = (x: bigint) => s.deHex(x.toString(16).padStart(64, '0'));
const jsonl = (...l: [string, unknown][]) => l.map(([prueba, datos], i) => JSON.stringify({ prueba, hora: 1000 + i, datos })).join('\n') + '\n';

test('cripto-noble pasa todos los vectores de shared que tocan el Cripto, igual que WebCrypto', async () => {
  const control = await comprobarVectores(web, v);
  const noble = await comprobarVectores(criptoNoble(), v);
  assert.deepEqual(control.fallos, []);
  assert.equal(control.total, 72);
  assert.deepEqual(noble, control);
});

test('comprobarVectores detecta un Cripto que miente', async () => {
  const mentiroso = { ...criptoNoble(), verificarP256: async () => true };
  const r = await comprobarVectores(mentiroso, v);
  assert.ok(r.bien < r.total);
  assert.ok(r.fallos.includes('firmas-ts, ecdsa r_cero'));
});

test('cripto-noble acepta s alto y rechaza antes de noble r o s fuera de rango, la SPKI comprimida y AES que no es de 256 bits', async () => {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey));
  const m = s.utf8('mensaje de prueba');
  const f = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, par.privateKey, m));
  const [r, sv] = [f.subarray(0, 32), f.subarray(32)];
  const noble = criptoNoble();
  assert.equal(await noble.verificarP256(spki, m, f), true);
  assert.equal(await noble.verificarP256(spki, m, s.unir(r, entero32(N - BigInt(`0x${s.hex(sv)}`)))), true);
  for (const mala of [s.unir(new Uint8Array(32), sv), s.unir(r, entero32(N)), s.unir(r, new Uint8Array(32).fill(0xff)), f.subarray(0, 63)]) {
    assert.equal(await noble.verificarP256(spki, m, mala), false);
  }
  const comprimida = s.unir(s.deHex('3039301306072a8648ce3d020106082a8648ce3d030107032200'), Uint8Array.of(2 + (spki[90] & 1)), spki.subarray(27, 59));
  assert.equal(await noble.verificarP256(comprimida, m, f), false);
  const fuera = spki.slice();
  fuera[90] ^= 1;
  assert.equal(await noble.verificarP256(fuera, m, f), false);
  await assert.rejects(noble.descifrarAesGcm(new Uint8Array(16), new Uint8Array(12), new Uint8Array(0), new Uint8Array(16)), ErrorFormato);
  assert.throws(() => noble.aleatorio(32), /el verificador no lo usa/);
});

test('el verificador del teléfono da íntegro un paquete de paquete450.ts, con noble y con WebCrypto, con K y sin K', async () => {
  const p = await generar(5, 1000);
  await comprobar(p, 5);
  const datos = { zip: p.zip, claves: p.claves, k: p.k, huella: p.huella };
  for (const [nombre, cripto] of [['noble', criptoNoble()], ['webcrypto', web]] as const) {
    for (const conK of [true, false]) {
      const m = await medirVerificador(nombre, cripto, datos, conK, 5);
      assert.equal(m.ok, true, `${nombre} ${conK}`);
      assert.deepEqual([m.estado, m.fragmentos, m.audio, m.hallazgos], ['integro', 5, conK ? 5 : 0, conK ? [] : ['audio_sin_comprobar']]);
    }
  }
  const otro = await generar(5, 1000);
  const m = await medirVerificador('noble', criptoNoble(), { ...datos, claves: otro.claves }, true, 5);
  assert.equal(m.ok, false);
});

test('comprobarHermes en Node: todo lo que usa el verificador está', () => {
  const h = comprobarHermes();
  assert.equal(h.motor, 'otro');
  assert.deepEqual([h.text_encoder, h.text_decoder, h.intl_zona, h.bigint, h.object_has_own], [true, true, true, true, true]);
});

// Lo que guarda llaves() en el teléfono, firmado aquí con WebCrypto y pasado a DER.
async function llaves(cambiar: (pares: any[]) => void = () => {}, strongbox: any = { disponible: false, motivo: 'sin FEATURE_STRONGBOX_KEYSTORE' }) {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey));
  const pares = [];
  for (let i = 0; i < 3; i++) {
    const mensaje = s.utf8(`vigia/v1/registro\u0000{"seq":${i}}`);
    const p1363 = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, par.privateKey, mensaje));
    pares.push({ mensaje: s.b64u(mensaje), der: s.b64u(s.p1363ADer(p1363)), p1363: s.b64u(p1363) });
  }
  cambiar(pares);
  const tee = { nivel: 'tee', spki: s.b64u(spki), pares };
  return jsonl(['p5-llaves', { tee, strongbox }]);
}

test('firmas: las DER del Keystore verifican con derAP1363 y WebCrypto; StrongBox ausente no cuenta como fallo', async () => {
  const r = await analizarFirmas(await llaves());
  assert.equal(r.ok, true);
  assert.match(r.lineas[0], /^✓ tee \(nivel tee\): 3 de 3 firmas DER/);
  assert.equal(r.lineas[1], '- strongbox: no disponible (sin FEATURE_STRONGBOX_KEYSTORE)');
});

test('firmas: un DER no estricto, otra P1363, una firma cambiada o una SPKI mala dan ✗', async () => {
  const conCero = (der: Uint8Array) => {
    // r con un 0x00 de más delante: DER no mínimo, que Der.aP1363 de Kotlin aceptaría.
    const n = der[3];
    return s.unir(Uint8Array.of(0x30, der[1] + 1, 0x02, n + 1, 0), der.subarray(4));
  };
  const casos: ((p: any[]) => void)[] = [
    (p) => { p[0].der = s.b64u(conCero(s.deB64u(p[0].der))); },
    (p) => { p[1].p1363 = p[2].p1363; },
    (p) => { const m = s.deB64u(p[2].mensaje); m[0] ^= 1; p[2].mensaje = s.b64u(m); },
    (p) => { p.pop(); },
  ];
  for (const [i, cambiar] of casos.entries()) assert.equal((await analizarFirmas(await llaves(cambiar))).ok, false, `caso ${i}`);
  const sinSpki = (await llaves()).replace(/"spki":"[^"]+"/, '"spki":"AAAA"');
  assert.equal((await analizarFirmas(sinSpki)).ok, false);
  assert.deepEqual(await analizarFirmas(jsonl(['p5-sellado', {}])), { lineas: ['✗ falta p5-llaves'], ok: false });
});

// Lo que guarda sellado() en el teléfono, sellado aquí para una clave de escucha desechable.
async function sellado() {
  const par = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  const k = web.aleatorio(32);
  const incidente = s.nuevoId(web);
  const envoltura = await s.envolverK(hpkeCore(), s.deB64u(jwk.x), incidente, 'escucha', k);
  const datos = { incidente, rol: 'escucha', publica: jwk.x, envoltura: s.b64u(envoltura), kc: await s.compromisoK(web, incidente, k), primera_ms: 40, ms: { p50: 3, p95: 5 } };
  return { privada: s.deB64u(jwk.d), datos };
}

test('sellado: la privada de escucha abre la envoltura del teléfono y kc coincide', async () => {
  const { privada, datos } = await sellado();
  const r = await analizarSellado(jsonl(['p5-sellado', datos]), privada);
  assert.deepEqual(r, { lineas: ['✓ la privada de escucha abre la envoltura del teléfono y kc coincide (sellar: primera 40 ms; luego p50 3 ms, p95 5 ms)'], ok: true });
});

test('sellado: otra privada, una envoltura cambiada o un kc que no es el de K dan ✗', async () => {
  const { privada, datos } = await sellado();
  assert.match((await analizarSellado(jsonl(['p5-sellado', datos]), web.aleatorio(32))).lineas[0], /^✗ el teléfono selló para otra pública/);
  const env = s.deB64u(datos.envoltura);
  env[50] ^= 1;
  assert.match((await analizarSellado(jsonl(['p5-sellado', { ...datos, envoltura: s.b64u(env) }]), privada)).lineas[0], /^✗ la privada de escucha no abre/);
  assert.match((await analizarSellado(jsonl(['p5-sellado', { ...datos, kc: '0'.repeat(64) }]), privada)).lineas[0], /^✗ la envoltura abre, pero kc no coincide/);
  assert.deepEqual(await analizarSellado(jsonl(['p5-llaves', {}]), privada), { lineas: ['✗ falta p5-sellado'], ok: false });
});

// Una sesión de P5 completa, con lo que cambia cada caso.
function sesion(cambiar: (d: Record<string, any>) => void = () => {}) {
  const r = (p50: number) => ({ p50, p95: p50 * 2, max: p50 * 3, total: p50 * 99, n: 99 });
  const tee = { nivel: 'tee', generar_ms: 90, primera_ms: { init: 20, firma: 30 }, init_ms: r(2), firma_ms: r(25), total_ms: r(27) };
  const verif = (variante: string, con_k: boolean, ms: number) => ({ variante, con_k, ms, estado: 'integro', fragmentos: 450, ok: true, leer_ms: 80 });
  const pasada = (total_ms: number) => ({ registros: 452, fragmentos: 450, fallos: 0, total_ms, ecdsa_ms: total_ms / 2, sha256_ms: 20, aes_ms: 30, hmac_ms: 25 });
  const d: Record<string, any> = {
    'p5-llaves': { tee, strongbox: { disponible: false, motivo: 'sin FEATURE_STRONGBOX_KEYSTORE' } },
    'p5-sellado': { primera_ms: 120, ms: r(4) },
    'p5-hermes': { motor: 'hermes', version: '0.0.0', text_encoder: true, text_decoder: true, intl_zona: true, bigint: true, object_has_own: true, get_random_values: false, subtle: false },
    'p5-vectores': { noble: { total: 72, bien: 72, fallos: [] }, kotlin: { total: 72, bien: 72, fallos: [] } },
    'noble con': verif('noble', true, 21000), 'noble sin': verif('noble', false, 15000),
    'kotlin con': verif('kotlin', true, 2500), 'kotlin sin': verif('kotlin', false, 1500),
    'coste con': { con_k: true, leer_ms: 70, pasadas: [pasada(900), pasada(700)] },
    'coste sin': { con_k: false, leer_ms: 70, pasadas: [pasada(600), pasada(500)] },
  };
  cambiar(d);
  const prueba = (clave: string) => (clave.startsWith('noble') || clave.startsWith('kotlin') ? 'p5-verificador' : clave.startsWith('coste') ? 'p5-coste' : clave);
  return jsonl(...Object.entries(d).filter(([, x]) => x !== undefined).map(([clave, x]) => [prueba(clave), x] as [string, unknown]));
}

test('tiempos: veredicto de los 5 s con K y cifras de firmas, sellado, Hermes y vectores', () => {
  const t = resumirTiempos(sesion());
  assert.equal(t.ok, true);
  const texto = t.lineas.join('\n');
  assert.match(texto, /Firmas tee \(nivel tee\): .*por firma, p95 54 ms \(rápida: 2 × p95 frente a 400 ms\)/);
  assert.match(texto, /✗ noble con K: 21000 ms/);
  assert.match(texto, /✓ kotlin con K: 2500 ms/);
  assert.match(texto, /^  - cota inferior en Kotlin puro con K \(sin cadena, cierre ni marcas\): 900 ms en frío y 700 ms en caliente/m);
  assert.doesNotMatch(texto, /[✓✗] cota/);
  assert.equal(t.lineas.at(-1), 'Veredicto: ✓ verifican 30 min con K en menos de 5 s en Hermes: kotlin');
});

test('tiempos: sin ninguna variante de Hermes bajo 5 s (aunque baje la cota), con un vector fallido, sin algo de Hermes o sin una medida da ✗', () => {
  const casos: ((d: Record<string, any>) => void)[] = [
    (d) => { d['kotlin con'].ms = 5000; },
    (d) => { d['p5-vectores'].kotlin = { total: 72, bien: 71, fallos: ['firmas-ts, ecdsa n_menos_s'] }; },
    (d) => { d['p5-hermes'].intl_zona = false; },
    (d) => { d['kotlin con'].estado = 'fallido'; },
    (d) => { d['coste con'].pasadas[0].fallos = 1; },
    (d) => { d['p5-sellado'] = undefined; },
  ];
  for (const [i, cambiar] of casos.entries()) assert.equal(resumirTiempos(sesion(cambiar)).ok, false, `caso ${i}`);
  assert.match(resumirTiempos(sesion((d) => { d['p5-llaves'].tee.total_ms.p95 = 201; })).lineas[0], /\(lenta: 2 × p95 frente a 400 ms\)/);
  // La cota no hace la cadena, el cierre ni las marcas: aunque baje de 5 s, no cuenta como verificador.
  assert.equal(resumirTiempos(sesion(casos[0])).lineas.at(-1), 'Veredicto: ✗ ninguna variante de Hermes verifica 30 min con K en menos de 5 s;'
    + ' solo baja la cota en Kotlin puro (900 ms en frío), que es una cota inferior: se declara así y se decide con la persona responsable');
  const niLaCota = (d: Record<string, any>) => { casos[0](d); d['coste con'].pasadas[0].total_ms = 5000; };
  assert.equal(resumirTiempos(sesion(niLaCota)).lineas.at(-1), 'Veredicto: ✗ ninguna variante de Hermes verifica 30 min con K en menos de 5 s;'
    + ' tampoco la cota en Kotlin puro (5000 ms en frío): se declara la cifra y se decide con la persona responsable');
  assert.match(resumirTiempos(sesion(casos[4])).lineas.join('\n'), /^  ✗ cota inferior en Kotlin puro con K /m);
});
```

- [ ] **Paso 7: ver que falla**

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco && rm -rf app/vigia-shared && cp -R /work/f2-h1/packages/shared/src app/vigia-shared && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test p5/maquina/p5.test.ts 2>&1 | grep -E "ERR_MODULE_NOT_FOUND\]|^ℹ (pass|fail)"'
```

Esperado:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/work/banco/app/pruebas/cripto-noble.ts' imported from /work/banco/p5/maquina/p5.test.ts
ℹ pass 0
ℹ fail 1
```

- [ ] **Paso 8: `cripto-noble`, el verificador del teléfono y las herramientas de la máquina**

`<banco>/app/pruebas/cripto-noble.ts`:

```ts
// P5 (tarea 9 de H0b): el Cripto de shared con @noble, en JS puro, para verificar en Hermes (que no trae WebCrypto).
// Solo lo que usa verificarPaquete; lo demás lanza. Versiones exactas en app/package.json: @noble/hashes,
// @noble/curves y @noble/ciphers 2.4.0.
import { gcm } from '@noble/ciphers/aes.js';
import { p256 } from '@noble/curves/nist.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ErrorFormato, esSpkiP256, type Cripto } from '../vigia-shared/index.ts';

// Orden de P-256 en big-endian (contrato, sección 4).
const ORDEN = Uint8Array.from([
  0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xbc, 0xe6, 0xfa, 0xad, 0xa7, 0x17, 0x9e, 0x84, 0xf3, 0xb9, 0xca, 0xc2, 0xfc, 0x63, 0x25, 0x51,
]);

/** r o s de una firma P1363 (32 bytes big-endian): 0 < x < n, sin BigInt. */
function enRango(x: Uint8Array): boolean {
  if (x.every((b) => b === 0)) return false;
  for (let i = 0; i < 32; i++) if (x[i] !== ORDEN[i]) return x[i] < ORDEN[i];
  return false; // igual a n
}

const noSeUsa = (que: string) => () => {
  throw new Error(`${que}: el verificador no lo usa`);
};

/**
 * verificarP256 repite las comprobaciones previas de criptoWebCrypto (SPKI P-256 de 91 bytes, firma de 64 bytes y
 * 0 < r, s < n) antes de llamar a la librería, y acepta s alto (lowS: false; noble lo rechaza por defecto).
 */
export function criptoNoble(): Cripto {
  return {
    aleatorio: noSeUsa('aleatorio'),
    sha256: async (datos) => sha256(datos),
    hmacSha256: async (clave, datos) => hmac(sha256, clave, datos),
    hkdfSha256: async (ikm, sal, info, n) => hkdf(sha256, ikm, sal, info, n),
    firmarP256: noSeUsa('firmarP256'),
    verificarP256: async (spki, mensaje, firma) => {
      if (!esSpkiP256(spki) || firma.length !== 64) return false;
      if (!enRango(firma.subarray(0, 32)) || !enRango(firma.subarray(32))) return false;
      try {
        // Los 65 últimos bytes de la SPKI son el punto sin comprimir (0x04 ‖ X ‖ Y).
        return p256.verify(firma, mensaje, spki.subarray(26), { prehash: true, lowS: false, format: 'compact' });
      } catch {
        return false; // punto fuera de la curva
      }
    },
    cifrarAesGcm: noSeUsa('cifrarAesGcm'),
    descifrarAesGcm: async (k, nonce, aad, cifrado) => {
      // Como criptoWebCrypto: solo AES-256 con nonce de 96 bits.
      if (k.length !== 32 || nonce.length !== 12) throw new ErrorFormato('aes');
      return gcm(k, nonce, aad).decrypt(cifrado);
    },
  };
}
```

`<banco>/app/pruebas/p5-verificador.ts`:

```ts
// P5 (tarea 9 de H0b): el verificador de shared sobre el paquete de 450 sobres con un Cripto u otro, los vectores de
// shared contra cualquier Cripto y las comprobaciones de Hermes. Sin React Native: las pruebas de la máquina
// (p5/maquina/p5.test.ts) lo cargan en Node.
import {
  aad, analizarAcuse, analizarEvento, analizarListaClaves, codificarPosicion, compromisoK, deB64u, deHex, descifrar,
  formatearHora, hashRegistro, hex, huellaAudio, utf8, verificarAcuse, verificarEvento, verificarPaquete, verificarPeticion,
  verificarRegistro, type ClavesAcuse, type Cripto,
} from '../vigia-shared/index.ts';

/** 30 min de evidencia a 4 s por fragmento. */
export const FRAGMENTOS_450 = 450;
export const ZONA = 'America/Caracas';

export type Paquete450 = { zip: Uint8Array; claves: ClavesAcuse; k: Uint8Array; huella: string };

/** Los archivos que deja p5/maquina/paquete450.ts (assets del APK o la carpeta de la máquina). */
export function leerPaquete450(a: { zip: Uint8Array; claves: Uint8Array; k: Uint8Array; huella: Uint8Array }): Paquete450 {
  const texto = (b: Uint8Array) => new TextDecoder().decode(b).trim();
  return { zip: a.zip, claves: analizarListaClaves(a.claves), k: deB64u(texto(a.k)), huella: texto(a.huella) };
}

/**
 * verificarPaquete cronometrado. Sin K, el único hallazgo esperado es audio_sin_comprobar; con K, ninguno y todo el
 * audio. `ok` exige además el estado integro y los fragmentos esperados.
 */
export async function medirVerificador(variante: string, cripto: Cripto, p: Paquete450, conK: boolean, fragmentos = FRAGMENTOS_450) {
  const t0 = performance.now();
  const inf = await verificarPaquete(cripto, p.zip, { claves: p.claves, k: conK ? p.k : undefined, zona: ZONA, huella: p.huella });
  const ms = Math.round(performance.now() - t0);
  const hallazgos = inf.hallazgos.map((h) => h.clave);
  const esperados = conK ? '' : 'audio_sin_comprobar';
  const ok = inf.estado === 'integro' && inf.fragmentos === fragmentos && hallazgos.join() === esperados
    && inf.audio.size === (conK ? fragmentos : 0);
  return { variante, con_k: conK, ms, estado: inf.estado, fragmentos: inf.fragmentos, hallazgos, audio: inf.audio.size, ok };
}

// Vectores publicados: los mismos de packages/shared/test/cripto.test.ts, más el caso 3 de HKDF (sal e info vacías).
const IKM = '0b'.repeat(22);
const GCM = {
  k: 'feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308',
  nonce: 'cafebabefacedbaddecaf888',
  aad: 'feedfacedeadbeeffeedfacedeadbeefabaddad2',
  claro: 'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39',
  cifrado: '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662'
    + '76fc6ece0f4e1768cddf8853bb2d551b',
};

/** Los JSON de packages/shared/vectores/ que se aplican a un Cripto. */
export type Vectores = { firmasTs: any; firmasKotlin: any; registros: any; cifrado: any };

/** Cada vector que toca sha256, hmacSha256, hkdfSha256, verificarP256 o descifrarAesGcm, con el resultado anotado. */
export async function comprobarVectores(cripto: Cripto, v: Vectores): Promise<{ total: number; bien: number; fallos: string[] }> {
  const fallos: string[] = [];
  let total = 0;
  const caso = async (nombre: string, f: () => Promise<boolean>) => {
    total++;
    let bien = false;
    try {
      bien = await f();
    } catch {
      bien = false;
    }
    if (!bien) fallos.push(nombre);
  };
  const lanza = async (f: () => Promise<unknown>) => {
    try {
      await f();
      return false;
    } catch {
      return true;
    }
  };

  await caso('sha256 de abc', async () => hex(await cripto.sha256(utf8('abc'))) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await caso('hmac de RFC 4231, caso 2', async () => hex(await cripto.hmacSha256(utf8('Jefe'), utf8('what do ya want for nothing?')))
    === '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  await caso('hkdf de RFC 5869, caso 1', async () => hex(await cripto.hkdfSha256(deHex(IKM), deHex('000102030405060708090a0b0c'), deHex('f0f1f2f3f4f5f6f7f8f9'), 42))
    === '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865');
  await caso('hkdf de RFC 5869, caso 3', async () => hex(await cripto.hkdfSha256(deHex(IKM), new Uint8Array(0), new Uint8Array(0), 42))
    === '8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8');
  await caso('aes-gcm, caso 16 de GCM', async () => hex(await cripto.descifrarAesGcm(deHex(GCM.k), deHex(GCM.nonce), deHex(GCM.aad), deHex(GCM.cifrado))) === GCM.claro);
  const tocado = deHex(GCM.cifrado);
  tocado[tocado.length - 1] ^= 1;
  await caso('aes-gcm con la etiqueta cambiada lanza', () => lanza(() => cripto.descifrarAesGcm(deHex(GCM.k), deHex(GCM.nonce), deHex(GCM.aad), tocado)));
  await caso('aes-gcm con clave de 16 bytes lanza', () => lanza(() => cripto.descifrarAesGcm(new Uint8Array(16), new Uint8Array(12), new Uint8Array(0), new Uint8Array(16))));

  // firmas-ts.json: firmas de WebCrypto (registros, casos de ECDSA, peticiones, acuses y eventos).
  const f = v.firmasTs;
  const spki = { dispositivo: deB64u(f.dispositivo), lectura: deB64u(f.lectura) } as Record<string, Uint8Array>;
  const peticion = (p: any) => ({ metodo: p.metodo, ruta: p.ruta, hora: p.hora, idPeticion: p.id_peticion, idDispositivo: p.id_dispositivo, cuerpo: deHex(p.cuerpo) });
  for (const r of f.registros) await caso(`firmas-ts, registro ${r.nombre}`, () => verificarRegistro(cripto, spki.dispositivo, utf8(r.r), deHex(r.s)));
  for (const e of f.ecdsa.casos) {
    await caso(`firmas-ts, ecdsa ${e.nombre}`, async () => (await cripto.verificarP256(deB64u(f.ecdsa.spki), deHex(f.ecdsa.mensaje), deHex(e.firma))) === e.valida);
  }
  for (const p of f.peticiones) await caso(`firmas-ts, petición ${p.nombre}`, () => verificarPeticion(cripto, spki[p.firmante], peticion(p), p.firma));
  const claves = analizarListaClaves(utf8(f.claves_acuse.map((l: string) => `${l}\n`).join('')));
  for (const a of f.acuses) {
    await caso(`firmas-ts, acuse ${a.nombre}`, async () => (await verificarAcuse(cripto, claves, analizarAcuse(utf8(a.acuse)), a.r)) === a.resultado);
  }
  for (const e of f.eventos) {
    await caso(`firmas-ts, evento ${e.nombre}`, async () => (await verificarEvento(cripto, claves, analizarEvento(utf8(e.evento)))) === e.resultado);
  }

  // firmas-kotlin.json: lo que firmó el núcleo Kotlin en la JVM.
  const fk = v.firmasKotlin;
  const spkiKotlin = deB64u(fk.dispositivo);
  for (const r of fk.registros) await caso(`firmas-kotlin, registro ${r.nombre}`, () => verificarRegistro(cripto, spkiKotlin, utf8(r.r), deHex(r.s)));
  for (const p of fk.peticiones) await caso(`firmas-kotlin, petición ${p.nombre}`, () => verificarPeticion(cripto, spkiKotlin, peticion(p), p.firma));

  // registros.json: el hash de cada registro, kc de la apertura y c, el descifrado, p y loc de los fragmentos.
  const rg = v.registros;
  const k = deHex(rg.k);
  for (const r of rg.registros) {
    const campos = JSON.parse(r.jcv);
    await caso(`registros, hash de ${r.nombre}`, async () => (await hashRegistro(cripto, utf8(r.jcv))) === r.hash);
    if (campos.tipo === 'apertura') await caso('registros, kc', async () => (await compromisoK(cripto, rg.incidente, k)) === campos.kc);
    if (r.cifrado === undefined) continue;
    const cifrado = deHex(r.cifrado);
    await caso(`registros, c de ${r.nombre}`, async () => hex(await cripto.sha256(cifrado)) === campos.c);
    await caso(`registros, descifrar ${r.nombre}`, async () => hex(await descifrar(cripto, k, aad('ct', rg.incidente, campos.seq), cifrado)) === r.audio);
    await caso(`registros, p de ${r.nombre}`, async () => (await huellaAudio(cripto, k, deHex(r.audio))) === campos.p);
    if (campos.loc !== undefined) {
      await caso(`registros, loc de ${r.nombre}`, async () =>
        hex(await descifrar(cripto, k, aad('loc', rg.incidente, campos.seq), deB64u(campos.loc))) === hex(codificarPosicion(r.posicion)));
    }
  }

  // cifrado.json: AES-256-GCM con el nonce del vector.
  const cf = v.cifrado;
  for (const x of cf.aes_gcm) {
    await caso(`cifrado, ${x.nombre}`, async () => hex(await descifrar(cripto, deHex(cf.k), deHex(x.aad), deHex(x.cifrado))) === x.claro);
  }
  return { total, bien: total - fallos.length, fallos: fallos.slice(0, 20) };
}

/** Lo que el verificador de shared necesita y Hermes podría no tener (tarea 9, "Riesgos de Hermes"). */
export function comprobarHermes() {
  const g = globalThis as Record<string, any>;
  const prueba = (f: () => boolean) => {
    try {
      return f();
    } catch {
      return false;
    }
  };
  return {
    motor: typeof g.HermesInternal === 'object' && g.HermesInternal !== null ? 'hermes' : 'otro',
    version: String(g.HermesInternal?.getRuntimeProperties?.()?.['OSS Release Version'] ?? 'desconocida'),
    text_encoder: prueba(() => new TextEncoder().encode('ñ').length === 2),
    text_decoder: prueba(() => new TextDecoder().decode(Uint8Array.of(0x61, 0xc3, 0xb1, 0x62).subarray(1, 3)) === 'ñ'),
    intl_zona: prueba(() => formatearHora(Date.UTC(2026, 9, 12, 14, 0), ZONA) === '10:00 del 12-10-2026 (UTC-04:00)'),
    bigint: prueba(() => BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551') % BigInt(1000) === BigInt(369)),
    object_has_own: prueba(() => Object.hasOwn({ a: 1 }, 'a')),
    get_random_values: typeof g.crypto?.getRandomValues === 'function',
    subtle: typeof g.crypto?.subtle === 'object' && g.crypto?.subtle !== null,
  };
}
```

`<banco>/p5/maquina/paquete450.ts`:

```ts
// Paquete sintético de P5 (tarea 9 de H0b): 450 fragmentos de 16 000 bytes (30 min a 4 s y 32 kb/s) en la forma del
// contrato (sección 14), firmados con una clave efímera y con acuses de una clave de dev efímera. Datos sin valor: el
// audio es azar y K solo abre este paquete. Antes de escribir nada, verificarPaquete lo da por íntegro con K y sin K.
// Deja en la carpeta (nueva) paquete.zip, claves-dev.txt, k.b64u, huella.txt y vectores/ (los JSON de shared que
// el teléfono comprueba con sus dos Cripto). compilar.sh lo mete en los assets del APK.
// Uso: node p5/maquina/paquete450.ts [<carpeta nueva>]   (por defecto /work/h0b/p5/paquete450)
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED = process.env.SHARED ?? '/work/f2-h1/packages/shared/src';
const s = await import(`${SHARED}/index.ts`);
const cripto = s.criptoWebCrypto();
/** 12-10-2026 a las 14:00 UTC: hora sintética del teléfono. */
const T0 = Date.UTC(2026, 9, 12, 14, 0);
const VECTORES = ['firmas-ts.json', 'firmas-kotlin.json', 'registros.json', 'cifrado.json'];

async function claveP256() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  return { privada: par.privateKey, spki: new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey)) };
}

/** Apertura, `n` fragmentos de `bytesAudio` encadenados y cierre, con sus acuses; el acuse llega 1,5 s después. */
export async function generar(n = 450, bytesAudio = 16_000) {
  const dispositivo = await claveP256();
  const servidor = await claveP256();
  const entrada = { kid: 'dev', spki: servidor.spki, estado: 'activa', desde: 0 };
  const incidente: string = s.nuevoId(cripto);
  const k: Uint8Array = cripto.aleatorio(32);
  const huella: string = await s.huella(cripto, dispositivo.spki);
  const registros: unknown[] = [];
  const anotar = async (r: Record<string, unknown>, hora: number, cifrado?: Uint8Array) => {
    const { bytes, s: firma } = await s.firmarRegistro(cripto, dispositivo.privada, r);
    const hash: string = await s.hashRegistro(cripto, bytes);
    const acuse = await s.firmarAcuse(cripto, servidor.privada, 'dev', hash, hora + 1_500);
    registros.push({ seq: r.tipo === 'cierre' ? 'cierre' : r.seq, r: bytes, s: firma, cifrado, acuse });
    return hash;
  };
  const kc = await s.compromisoK(cripto, incidente, k);
  let prev = await anotar({ v: 1, tipo: 'apertura', incidente, seq: 0, hora_telefono: T0, country_code: 'VE', dispositivo: huella, origen: 'grabar', kc }, T0);
  for (let seq = 1; seq <= n; seq++) {
    const audio: Uint8Array = cripto.aleatorio(bytesAudio);
    const cifrado: Uint8Array = await s.cifrar(cripto, k, s.aad('ct', incidente, seq), audio);
    const hora = T0 + 1_000 + (seq - 1) * 4_000;
    const r = { v: 1, tipo: 'fragmento', incidente, seq, hora_telefono: hora, p: await s.huellaAudio(cripto, k, audio), c: s.hex(await cripto.sha256(cifrado)), prev };
    prev = await anotar(r, hora + 4_000, cifrado);
  }
  const fin = T0 + 1_000 + n * 4_000;
  await anotar({ v: 1, tipo: 'cierre', incidente, hora_telefono: fin, ultimo_seq: n, hash_final: prev }, fin + 1_000);
  const zip: Uint8Array = s.crearPaquete({ incidente, spki: dispositivo.spki, registros });
  return { zip, entrada, claves: [entrada], k, huella, incidente };
}

/** verificarPaquete con WebCrypto de Node: íntegro, con todos los fragmentos y sin más avisos que audio_sin_comprobar sin K. */
export async function comprobar(p: Awaited<ReturnType<typeof generar>>, n: number) {
  const ms: number[] = [];
  for (const conK of [true, false]) {
    const t0 = performance.now();
    const inf = await s.verificarPaquete(cripto, p.zip, { claves: p.claves, k: conK ? p.k : undefined, zona: 'America/Caracas', huella: p.huella });
    ms.push(Math.round(performance.now() - t0));
    const hallazgos = inf.hallazgos.map((h: { clave: string }) => h.clave).join();
    if (inf.estado !== 'integro' || inf.fragmentos !== n || hallazgos !== (conK ? '' : 'audio_sin_comprobar')) {
      throw new Error(`el paquete no verifica (${conK ? 'con' : 'sin'} K): ${inf.estado}, ${inf.fragmentos} fragmentos, [${hallazgos}]`);
    }
  }
  return { conK: ms[0], sinK: ms[1] };
}

if (import.meta.main) {
  const salida = process.argv[2] ?? '/work/h0b/p5/paquete450';
  if (existsSync(salida)) throw new Error(`ya existe ${salida}: este paquete no se pisa (bórrala antes si hay que rehacerlo)`);
  const p = await generar();
  const ms = await comprobar(p, 450);
  mkdirSync(join(salida, 'vectores'), { recursive: true });
  writeFileSync(join(salida, 'paquete.zip'), p.zip);
  writeFileSync(join(salida, 'claves-dev.txt'), `${new TextDecoder().decode(s.bytesEntradaClave(p.entrada))}\n`);
  writeFileSync(join(salida, 'k.b64u'), `${s.b64u(p.k)}\n`);
  writeFileSync(join(salida, 'huella.txt'), `${p.huella}\n`);
  for (const v of VECTORES) copyFileSync(join(SHARED, '..', 'vectores', v), join(salida, 'vectores', v));
  console.log(`bien: 450 fragmentos de 16000 bytes, paquete de ${p.zip.length} bytes, íntegro con K y sin K`);
  console.log(`WebCrypto de Node en la máquina: ${ms.conK} ms con K y ${ms.sinK} ms sin K`);
}
```

`<banco>/p5/maquina/firmas.ts`:

```ts
// Firmas del Keystore en la máquina (tarea 9 de H0b): cada firma DER que guardó llaves() en el teléfono se pasa a
// P1363 con derAP1363 de shared (DER estricto), se compara con la P1363 que dio Der.aP1363 en Kotlin y se verifica
// con WebCrypto de Node; con un bit cambiado en el mensaje no debe verificar. Solo imprime veredictos.
// Uso: node p5/maquina/firmas.ts <resultados.jsonl>
import { readFileSync } from 'node:fs';

const SHARED = process.env.SHARED ?? '/work/f2-h1/packages/shared/src';
const s = await import(`${SHARED}/index.ts`);
const cripto = s.criptoWebCrypto();

type Linea = { prueba: string; hora: number; datos: any };
const lineas = (texto: string): Linea[] => texto.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));

/** Una línea por llave (TEE y StrongBox) de cada p5-llaves; ok si la de TEE y la de StrongBox, si la hay, verifican. */
export async function analizarFirmas(texto: string): Promise<{ lineas: string[]; ok: boolean }> {
  const salida: string[] = [];
  let ok = true;
  const llaves = lineas(texto).filter((l) => l.prueba === 'p5-llaves');
  if (llaves.length === 0) return { lineas: ['✗ falta p5-llaves'], ok: false };
  for (const l of llaves) {
    for (const tipo of ['tee', 'strongbox']) {
      const x = l.datos[tipo];
      if (tipo === 'strongbox' && x?.disponible === false) {
        salida.push(`- strongbox: no disponible (${x.motivo})`);
        continue;
      }
      const malas: string[] = [];
      const spki = s.deB64u(x?.spki ?? '');
      if (!s.esSpkiP256(spki)) malas.push('la SPKI no es P-256 de 91 bytes');
      const pares: any[] = x?.pares ?? [];
      let bien = 0;
      for (const [i, p] of pares.entries()) {
        const mensaje: Uint8Array = s.deB64u(p.mensaje);
        let p1363: Uint8Array;
        try {
          p1363 = s.derAP1363(s.deB64u(p.der));
        } catch {
          malas.push(`firma ${i + 1}: el DER no es estricto`);
          continue;
        }
        if (s.b64u(p1363) !== p.p1363) malas.push(`firma ${i + 1}: la P1363 de Kotlin no es la del DER`);
        else if (!(await cripto.verificarP256(spki, mensaje, p1363))) malas.push(`firma ${i + 1}: no verifica en WebCrypto`);
        else {
          const otro = mensaje.slice();
          otro[otro.length - 1] ^= 1;
          if (await cripto.verificarP256(spki, otro, p1363)) malas.push(`firma ${i + 1}: verifica con otro mensaje`);
          else bien++;
        }
      }
      const esta = malas.length === 0 && pares.length === 3 && bien === 3;
      ok &&= esta;
      salida.push(`${esta ? '✓' : '✗'} ${tipo} (nivel ${x?.nivel}): ${bien} de ${pares.length} firmas DER del Keystore verifican en WebCrypto,`
        + ' con DER estricto y la misma P1363 que en Kotlin; con un bit cambiado, ninguna');
      for (const m of malas) salida.push(`  ✗ ${m}`);
    }
  }
  return { lineas: salida, ok };
}

if (import.meta.main) {
  const ruta = process.argv[2];
  if (!ruta) throw new Error('uso: node p5/maquina/firmas.ts <resultados.jsonl>');
  const r = await analizarFirmas(readFileSync(ruta, 'utf8'));
  console.log(r.lineas.join('\n'));
  process.exitCode = r.ok ? 0 : 1;
}
```

`<banco>/p5/maquina/sellado.ts`:

```ts
// Sellado del teléfono en la máquina (tarea 9 de H0b): la privada de escucha de pruebas entra por la entrada estándar
// y abre la envoltura de K que selló el teléfono (HPKE, rol escucha); se compara kc. Nunca imprime K ni la privada.
// Corre en un contenedor efímero sin red (contrato del banco, "Herramientas de la máquina").
// Uso: node p5/maquina/sellado.ts <resultados.jsonl> < privada.b64u
import { readFileSync } from 'node:fs';

const SHARED = process.env.SHARED ?? '/work/f2-h1/packages/shared/src';
const s = await import(`${SHARED}/index.ts`);
const { hpkeCore, importarReceptora } = await import(`${SHARED}/hpke-core.ts`);
const cripto = s.criptoWebCrypto();

/** Una línea por p5-sellado; ok si en todas la privada abre la envoltura, la pública es la suya y kc coincide. */
export async function analizarSellado(texto: string, privada: Uint8Array): Promise<{ lineas: string[]; ok: boolean }> {
  const receptora = await importarReceptora(privada);
  const publica = s.b64u(new Uint8Array(await crypto.subtle.exportKey('raw', receptora.publicKey)));
  const sellados = texto.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)).filter((l) => l.prueba === 'p5-sellado');
  if (sellados.length === 0) return { lineas: ['✗ falta p5-sellado'], ok: false };
  const salida: string[] = [];
  let ok = true;
  for (const { datos: d } of sellados) {
    let veredicto: string;
    if (d.publica !== publica) veredicto = '✗ el teléfono selló para otra pública, no la de esta privada';
    else {
      let k: Uint8Array | undefined;
      try {
        k = await s.desenvolverK(hpkeCore(), receptora, d.incidente, 'escucha', s.deB64u(d.envoltura));
      } catch {
        k = undefined;
      }
      if (k === undefined) veredicto = '✗ la privada de escucha no abre la envoltura';
      else {
        const kc = await s.compromisoK(cripto, d.incidente, k);
        k.fill(0);
        veredicto = kc === d.kc ? '✓ la privada de escucha abre la envoltura del teléfono y kc coincide' : '✗ la envoltura abre, pero kc no coincide';
      }
    }
    ok &&= veredicto.startsWith('✓');
    salida.push(`${veredicto} (sellar: primera ${d.primera_ms} ms; luego p50 ${d.ms?.p50} ms, p95 ${d.ms?.p95} ms)`);
  }
  return { lineas: salida, ok };
}

if (import.meta.main) {
  const ruta = process.argv[2];
  if (!ruta) throw new Error('uso: node p5/maquina/sellado.ts <resultados.jsonl> < privada.b64u');
  const privada: Uint8Array = s.deB64u(readFileSync(0, 'utf8').trim());
  if (privada.length !== 32) throw new Error('la privada de escucha no mide 32 bytes');
  const r = await analizarSellado(readFileSync(ruta, 'utf8'), privada);
  privada.fill(0);
  console.log(r.lineas.join('\n'));
  process.exitCode = r.ok ? 0 : 1;
}
```

`<banco>/p5/maquina/tiempos.ts`:

```ts
// Tiempos de P5 en la máquina (tarea 9 de H0b): firmas del Keystore, sellado, Hermes, vectores y el verificador frente
// al criterio de P5: 30 min de evidencia (450 fragmentos) verificados en menos de 5 s en el teléfono. Recalcula los
// veredictos desde las cifras; solo cuentan las variantes que corren verificarPaquete en Hermes (noble y Kotlin), no la
// cota. Solo imprime cifras y veredictos. Uso: node p5/maquina/tiempos.ts <resultados.jsonl>
import { readFileSync } from 'node:fs';

const CRITERIO_MS = 5_000;
/** Referencia que propone la tarea 9: firmar es lento si dos firmas (registro y petición) pasan del 10 % de 4 s. */
const FIRMA_LENTA_MS = 400;
/** Lo que necesita verificarPaquete en Hermes (getRandomValues y subtle no: el verificador no los usa). */
const HERMES = ['text_encoder', 'text_decoder', 'intl_zona', 'bigint', 'object_has_own'];

type Linea = { prueba: string; hora: number; datos: any };

const marca = (ok: boolean) => (ok ? '✓' : '✗');
const t3 = (r: any) => `p50 ${r.p50} / p95 ${r.p95} / máx ${r.max} ms`;

export function resumirTiempos(texto: string): { lineas: string[]; ok: boolean } {
  const todas: Linea[] = texto.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
  const ultima = (prueba: string, filtro: (d: any) => boolean = () => true) =>
    todas.filter((l) => l.prueba === prueba && filtro(l.datos)).sort((a, b) => a.hora - b.hora).at(-1)?.datos;
  const salida: string[] = [];
  let ok = true;
  const falta = (prueba: string) => {
    salida.push(`✗ falta ${prueba}`);
    ok = false;
  };

  const llaves = ultima('p5-llaves');
  if (!llaves) falta('p5-llaves');
  else {
    for (const tipo of ['tee', 'strongbox']) {
      const x = llaves[tipo];
      if (x.disponible === false) {
        salida.push(`- Firmas ${tipo}: no disponible (${x.motivo})`);
        continue;
      }
      const lenta = 2 * x.total_ms.p95 > FIRMA_LENTA_MS;
      salida.push(`Firmas ${tipo} (nivel ${x.nivel}): generar ${x.generar_ms} ms; primera ${x.primera_ms.init} + ${x.primera_ms.firma} ms;`
        + ` initSign ${t3(x.init_ms)}; sign ${t3(x.firma_ms)}; por firma, p95 ${x.total_ms.p95} ms`
        + ` (${lenta ? 'lenta' : 'rápida'}: 2 × p95 frente a ${FIRMA_LENTA_MS} ms)`);
    }
  }

  const sellado = ultima('p5-sellado');
  if (!sellado) falta('p5-sellado');
  else salida.push(`Sellado HPKE en el teléfono: primera ${sellado.primera_ms} ms; luego ${t3(sellado.ms)}`);

  const hermes = ultima('p5-hermes');
  if (!hermes) falta('p5-hermes');
  else {
    const faltan = HERMES.filter((c) => hermes[c] !== true);
    ok &&= faltan.length === 0;
    salida.push(`${marca(faltan.length === 0)} Hermes ${hermes.version}: ${faltan.length === 0 ? 'tiene' : `le falta ${faltan.join(', ')} de`} lo que usa el verificador`
      + ` (getRandomValues: ${hermes.get_random_values ? 'sí' : 'no'}; subtle: ${hermes.subtle ? 'sí' : 'no'})`);
  }

  const vectores = ultima('p5-vectores');
  if (!vectores) falta('p5-vectores');
  else {
    for (const nombre of ['noble', 'kotlin']) {
      const v = vectores[nombre];
      const todos = v.total > 0 && v.bien === v.total;
      ok &&= todos;
      salida.push(`${marca(todos)} Vectores con cripto-${nombre}: ${v.bien} de ${v.total}${todos ? '' : `; fallan: ${v.fallos.join(', ')}`}`);
    }
  }

  salida.push(`Verificador sobre 450 fragmentos (criterio: menos de ${CRITERIO_MS} ms con K):`);
  const pasan: string[] = [];
  for (const variante of ['noble', 'kotlin']) {
    for (const conK of [true, false]) {
      const m = ultima('p5-verificador', (d) => d.variante === variante && d.con_k === conK);
      if (!m) {
        falta(`p5-verificador de ${variante} ${conK ? 'con' : 'sin'} K`);
        continue;
      }
      const pasa = m.ok === true && m.estado === 'integro' && m.fragmentos === 450 && m.ms < CRITERIO_MS;
      if (pasa && conK) pasan.push(variante);
      ok &&= m.estado === 'integro' && m.fragmentos === 450;
      salida.push(`  ${marca(pasa)} ${variante} ${conK ? 'con' : 'sin'} K: ${m.ms} ms, ${m.estado}, ${m.fragmentos} fragmentos (leer el paquete: ${m.leer_ms} ms)`);
    }
  }
  // La cota no hace la cadena, el cierre ni las marcas de verificarPaquete: su tiempo es una cota inferior y no cuenta
  // como verificador. Su línea solo lleva ✗ si no verificó los 450 fragmentos sin fallos.
  let cotaConK: number | undefined;
  for (const conK of [true, false]) {
    const c = ultima('p5-coste', (d) => d.con_k === conK);
    if (!c) {
      falta(`p5-coste ${conK ? 'con' : 'sin'} K`);
      continue;
    }
    const [frio, caliente] = c.pasadas;
    const limpio = c.pasadas.every((p: any) => p.fallos === 0 && p.fragmentos === 450);
    ok &&= limpio;
    if (conK && limpio) cotaConK = frio.total_ms;
    salida.push(`  ${limpio ? '-' : '✗'} cota inferior en Kotlin puro ${conK ? 'con' : 'sin'} K (sin cadena, cierre ni marcas): ${frio.total_ms} ms en frío y ${caliente.total_ms} ms`
      + ` en caliente (ECDSA ${frio.ecdsa_ms}, SHA-256 ${frio.sha256_ms}, AES ${frio.aes_ms}, HMAC ${frio.hmac_ms} ms), ${frio.fallos} fallos`);
  }
  const alguna = pasan.length > 0;
  ok &&= alguna;
  let veredicto = alguna ? `verifican 30 min con K en menos de 5 s en Hermes: ${pasan.join(' y ')}` : 'ninguna variante de Hermes verifica 30 min con K en menos de 5 s';
  if (!alguna && cotaConK !== undefined) {
    veredicto += cotaConK < CRITERIO_MS
      ? `; solo baja la cota en Kotlin puro (${cotaConK} ms en frío), que es una cota inferior: se declara así y se decide con la persona responsable`
      : `; tampoco la cota en Kotlin puro (${cotaConK} ms en frío): se declara la cifra y se decide con la persona responsable`;
  }
  salida.push(`Veredicto: ${marca(alguna)} ${veredicto}`);
  return { lineas: salida, ok };
}

if (import.meta.main) {
  const ruta = process.argv[2];
  if (!ruta) throw new Error('uso: node p5/maquina/tiempos.ts <resultados.jsonl>');
  const r = resumirTiempos(readFileSync(ruta, 'utf8'));
  console.log(r.lineas.join('\n'));
  process.exitCode = r.ok ? 0 : 1;
}
```

`tiempos.ts` lleva la referencia que propone esta tarea para "si firmar es lento" (plan maestro, P5, plan B): el PUT de un fragmento llevaría dos firmas (la del registro y la de la petición), y firmar es lento si dos veces el p95 de una firma pasa del 10 % de un fragmento de 4 s (400 ms). Es la marca «rápida» o «lenta» de cada llave, la que usan las reglas de la cabecera para elegir entre TEE y StrongBox y para la firma de petición del PUT. La cota en Kotlin puro sale sin ✓ (o con ✗ si no verificó los 450 fragmentos sin fallos): no hace la cadena, el cierre ni las marcas, así que su tiempo es una cota inferior y no cuenta en el veredicto; si solo ella baja de 5 s, el veredicto es ✗, lo dice, y se decide con la persona responsable.

- [ ] **Paso 9: ver que pasa**

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test p5/maquina/p5.test.ts 2>&1 | grep -E "^(✔|✖|ℹ (tests|pass|fail))"'
```

Esperado (los tiempos entre paréntesis cambian):

```
✔ cripto-noble pasa todos los vectores de shared que tocan el Cripto, igual que WebCrypto (…ms)
✔ comprobarVectores detecta un Cripto que miente (…ms)
✔ cripto-noble acepta s alto y rechaza antes de noble r o s fuera de rango, la SPKI comprimida y AES que no es de 256 bits (…ms)
✔ el verificador del teléfono da íntegro un paquete de paquete450.ts, con noble y con WebCrypto, con K y sin K (…ms)
✔ comprobarHermes en Node: todo lo que usa el verificador está (…ms)
✔ firmas: las DER del Keystore verifican con derAP1363 y WebCrypto; StrongBox ausente no cuenta como fallo (…ms)
✔ firmas: un DER no estricto, otra P1363, una firma cambiada o una SPKI mala dan ✗ (…ms)
✔ sellado: la privada de escucha abre la envoltura del teléfono y kc coincide (…ms)
✔ sellado: otra privada, una envoltura cambiada o un kc que no es el de K dan ✗ (…ms)
✔ tiempos: veredicto de los 5 s con K y cifras de firmas, sellado, Hermes y vectores (…ms)
✔ tiempos: sin ninguna variante de Hermes bajo 5 s (aunque baje la cota), con un vector fallido, sin algo de Hermes o sin una medida da ✗ (…ms)
ℹ tests 11
ℹ pass 11
ℹ fail 0
```

- [ ] **Paso 10: el paquete de 450 sobres, en un contenedor efímero sin red**

Es una herramienta de la máquina y corre como dice el contrato del banco, desde la copia sincronizada, salvo el volumen, que va en escritura porque genera `/work/h0b/p5/paquete450` (no recibe la privada ni descifra audio). No pisa una carpeta que ya exista; para rehacerlo, se borra antes.

📍 Máquina de trabajo.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && mkdir -p /work/h0b/p5'
docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work --tmpfs /tmp:size=1g -w /work/banco vigia-build:h0b node p5/maquina/paquete450.ts /work/h0b/p5/paquete450
docker exec vigia-build sh -c 'cd /work/h0b/p5/paquete450 && find . -type f | sort && wc -c < paquete.zip'
```

Esperado (los milisegundos cambian; el zip mide siempre lo mismo, porque cada registro tiene un tamaño fijo):

```
bien: 450 fragmentos de 16000 bytes, paquete de 7688069 bytes, íntegro con K y sin K
WebCrypto de Node en la máquina: 570 ms con K y 355 ms sin K
./claves-dev.txt
./huella.txt
./k.b64u
./paquete.zip
./vectores/cifrado.json
./vectores/firmas-kotlin.json
./vectores/firmas-ts.json
./vectores/registros.json
7688069
```

- [ ] **Paso 11: el mismo paquete, verificado por la cota de Kotlin en la JVM**

El cruce entre implementaciones antes del teléfono: lo que firmó y cifró shared en Node lo verifica el núcleo Kotlin, registro a registro.

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec -e PAQUETE450=/work/h0b/p5/paquete450 vigia-build sh -c 'cd /work/banco/jvm && ./gradlew --no-daemon cleanTest test 2>&1 | grep "^BUILD"; grep -ho "testsuite name=\"vigia.banco.p5.Coste[^\"]*\" tests=\"[0-9]*\" skipped=\"[0-9]*\" failures=\"[0-9]*\" errors=\"[0-9]*\"" puro/build/test-results/test/*.xml; grep -ho "paquete450 en la JVM[^<]*" puro/build/test-results/test/*.xml'
```

Esperado:

```
BUILD SUCCESSFUL in …
testsuite name="vigia.banco.p5.CosteVerificadorTest" tests="5" skipped="0" failures="0" errors="0"
paquete450 en la JVM, con K: … ms
```

(452 registros, 450 fragmentos y 0 fallos, con K y sin K; en la validación, de 1 200 a 1 350 ms con K).

- [ ] **Paso 12: `cripto-kotlin`, `BancoP5Module` y la pantalla de P5**

`<banco>/app/pruebas/cripto-kotlin.ts`:

```ts
// P5 (tarea 9 de H0b): el Cripto de shared con las primitivas del núcleo Kotlin, que BancoP5 expone síncronas (corren
// en el hilo de JS). Solo lo que usa verificarPaquete; lo demás lanza.
import { BancoP5 } from '../modules/banco';
import type { Cripto } from '../vigia-shared/index.ts';

const noSeUsa = (que: string) => () => {
  throw new Error(`${que}: el verificador no lo usa`);
};

/** verificarP256 es Ecdsa.verificar del núcleo, que hace las mismas comprobaciones previas y acepta s alto. */
export function criptoKotlin(): Cripto {
  return {
    aleatorio: noSeUsa('aleatorio'),
    sha256: async (datos) => BancoP5.sha256(datos),
    hmacSha256: async (clave, datos) => BancoP5.hmacSha256(clave, datos),
    hkdfSha256: async (ikm, sal, info, n) => BancoP5.hkdfSha256(ikm, sal, info, n),
    firmarP256: noSeUsa('firmarP256'),
    verificarP256: async (spki, mensaje, firma) => BancoP5.verificarP256(spki, mensaje, firma),
    cifrarAesGcm: noSeUsa('cifrarAesGcm'),
    descifrarAesGcm: async (k, nonce, aad, cifrado) => BancoP5.descifrarAesGcm(k, nonce, aad, cifrado),
  };
}
```

`BancoP5Module` sustituye entero el mínimo de la tarea 4. La privada de las firmas se toma del Keystore por su alias para medir aparte `initSign` y `sign`; `FirmanteKeystore`, el `Firmante` del contrato de H1, firma además una vez y se verifica en Kotlin.

`<banco>/app/modules/banco/android/src/main/java/expo/modules/banco/BancoP5Module.kt`:

```kotlin
package expo.modules.banco

import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import vigia.banco.Estadistica
import vigia.banco.Resumen
import vigia.banco.p5.CosteVerificador
import vigia.banco.p5.Primitivas
import vigia.nucleo.Codificacion
import vigia.nucleo.Der
import vigia.nucleo.Ecdsa
import vigia.nucleo.Envoltura
import vigia.nucleo.Fragmento
import vigia.nucleo.HpkeBouncyCastle
import vigia.nucleo.Prefijos
import vigia.nucleo.Registros
import java.security.KeyStore
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.Signature

private const val ALIAS_TEE = "banco-p5-tee"
private const val ALIAS_STRONGBOX = "banco-p5-strongbox"
private const val FIRMAS = 100
private const val SELLADOS = 20
private val MUESTRAS = setOf(0, 49, 99) // las firmas que salen con su mensaje, para verificarlas en la máquina
private const val INCIDENTE_FIRMAS = "bancoP5firmasKeystore1"

/**
 * BancoP5 (P5): latencia de las firmas del Keystore con TEE y con StrongBox, un sellado HPKE para la clave de
 * escucha de pruebas, la cota de coste de un verificador en Kotlin sobre el paquete de 450 sobres y las primitivas
 * del Cripto de shared, síncronas, para el verificador de JS (cripto-kotlin.ts). K nunca sale: solo su compromiso.
 */
class BancoP5Module : Module() {
  private val contexto: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BancoP5")

    AsyncFunction("llaves") { guardar("p5-llaves", llaves()) }

    AsyncFunction("sellado") { guardar("p5-sellado", sellado()) }

    AsyncFunction("costeKotlin") { conK: Boolean -> guardar("p5-coste", coste(conK)) }

    AsyncFunction("leerAsset") { nombre: String -> asset(nombre) }

    // Las primitivas del Cripto de shared en Kotlin, síncronas (corren en el hilo de JS).
    Function("sha256") { datos: ByteArray -> Primitivas.sha256(datos) }

    Function("hmacSha256") { clave: ByteArray, datos: ByteArray -> Primitivas.hmacSha256(clave, datos) }

    Function("hkdfSha256") { ikm: ByteArray, sal: ByteArray, info: ByteArray, n: Int -> Primitivas.hkdfSha256(ikm, sal, info, n) }

    Function("verificarP256") { spki: ByteArray, mensaje: ByteArray, firma: ByteArray -> Ecdsa.verificar(spki, mensaje, firma) }

    Function("descifrarAesGcm") { k: ByteArray, nonce: ByteArray, aad: ByteArray, cifrado: ByteArray ->
      Primitivas.descifrarAesGcm(k, nonce, aad, cifrado)
    }
  }

  private fun guardar(prueba: String, json: JSONObject): String = json.toString().also { Resultados.guardar(contexto, prueba, it) }

  /** TEE siempre; StrongBox si el teléfono declara FEATURE_STRONGBOX_KEYSTORE (si no, o si falla, dice por qué). */
  private fun llaves(): JSONObject {
    val r = JSONObject().put("tee", firmas(ALIAS_TEE, strongBox = false))
    val strongBox = if (!contexto.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)) {
      JSONObject().put("disponible", false).put("motivo", "sin FEATURE_STRONGBOX_KEYSTORE")
    } else {
      try {
        firmas(ALIAS_STRONGBOX, strongBox = true).put("disponible", true)
      } catch (e: Exception) {
        JSONObject().put("disponible", false).put("motivo", "${e.javaClass.simpleName}: ${e.message}")
      }
    }
    return r.put("strongbox", strongBox)
  }

  // Lo que firma el teléfono por fragmento: el prefijo y el JCV de un registro (contrato, sección 4).
  private fun mensaje(i: Int): ByteArray {
    val h = { x: String -> Registros.hash(x.toByteArray(Charsets.US_ASCII)) }
    val f = Fragmento(INCIDENTE_FIRMAS, i + 1, 1_791_986_400_000L + i * 4_000L, h("p$i"), h("c$i"), h("prev$i"))
    return Prefijos.REGISTRO + Registros.bytes(f)
  }

  /** Un par nuevo en el Keystore y 100 firmas, con initSign y sign medidos aparte; la primera también aparte. */
  private fun firmas(alias: String, strongBox: Boolean): JSONObject {
    val t0 = SystemClock.elapsedRealtimeNanos()
    val firmante = Llaves.firmanteKeystore(alias, strongBox)
    val generar = ms(t0)
    val privada = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.getKey(alias, null) as PrivateKey
    val init = DoubleArray(FIRMAS)
    val firma = DoubleArray(FIRMAS)
    val pares = JSONArray()
    var verifica = true
    for (i in 0 until FIRMAS) {
      val m = mensaje(i)
      val a = SystemClock.elapsedRealtimeNanos()
      val s = Signature.getInstance("SHA256withECDSA").apply { initSign(privada) }
      val b = SystemClock.elapsedRealtimeNanos()
      s.update(m)
      val der = s.sign()
      val c = SystemClock.elapsedRealtimeNanos()
      init[i] = (b - a) / 1e6
      firma[i] = (c - b) / 1e6
      if (i in MUESTRAS) {
        val p1363 = Der.aP1363(der)
        verifica = verifica && Ecdsa.verificar(firmante.spki, m, p1363)
        pares.put(JSONObject().put("mensaje", Codificacion.b64u(m)).put("der", Codificacion.b64u(der)).put("p1363", Codificacion.b64u(p1363)))
      }
    }
    // El Firmante del contrato de H1 (FirmanteKeystore) también firma y da 64 bytes que verifican.
    val m = mensaje(FIRMAS)
    val p1363 = firmante.firmar(m)
    verifica = verifica && p1363.size == 64 && Ecdsa.verificar(firmante.spki, m, p1363)
    val resto = { x: DoubleArray -> json(Estadistica.de(x.copyOfRange(1, FIRMAS))) }
    return JSONObject()
      .put("alias", alias)
      .put("nivel", firmante.nivel)
      .put("generar_ms", r3(generar))
      .put("n", FIRMAS)
      .put("primera_ms", JSONObject().put("init", r3(init[0])).put("firma", r3(firma[0])))
      .put("init_ms", resto(init))
      .put("firma_ms", resto(firma))
      .put("total_ms", json(Estadistica.de(DoubleArray(FIRMAS) { init[it] + firma[it] })))
      .put("verifica_en_kotlin", verifica)
      .put("spki", Codificacion.b64u(firmante.spki))
      .put("pares", pares)
  }

  /** K aleatoria y un incidente: la envoltura de K para la clave de escucha (rol escucha) y kc. K no sale. */
  private fun sellado(): JSONObject {
    val azar = SecureRandom()
    val hpke = HpkeBouncyCastle()
    val publica = Escucha.publica()
    val incidente = Codificacion.b64u(ByteArray(16).also { azar.nextBytes(it) })
    val k = ByteArray(32).also { azar.nextBytes(it) }
    val t0 = SystemClock.elapsedRealtimeNanos()
    val envoltura = Envoltura.envolver(hpke, publica, incidente, "escucha", k)
    val primera = ms(t0)
    val kc = Registros.compromisoK(incidente, k)
    k.fill(0)
    // Más sellados, con K desechables, para el tiempo una vez cargado BouncyCastle.
    val tiempos = DoubleArray(SELLADOS) {
      val otra = ByteArray(32).also { azar.nextBytes(it) }
      val a = SystemClock.elapsedRealtimeNanos()
      Envoltura.envolver(hpke, publica, incidente, "escucha", otra)
      otra.fill(0)
      ms(a)
    }
    return JSONObject()
      .put("incidente", incidente)
      .put("rol", "escucha")
      .put("publica", Escucha.PUBLICA_B64U)
      .put("envoltura", Codificacion.b64u(envoltura))
      .put("kc", kc)
      .put("primera_ms", r3(primera))
      .put("ms", json(Estadistica.de(tiempos)))
  }

  /** La cota de Kotlin sobre el paquete de 450 sobres, dos pasadas seguidas: la primera, en frío. */
  private fun coste(conK: Boolean): JSONObject {
    val t0 = SystemClock.elapsedRealtimeNanos()
    val zip = asset("paquete450/paquete.zip")
    val claves = String(asset("paquete450/claves-dev.txt"), Charsets.US_ASCII)
    val k = if (conK) Codificacion.deB64u(String(asset("paquete450/k.b64u"), Charsets.US_ASCII).trim()) else null
    val leer = ms(t0)
    val pasadas = JSONArray()
    repeat(2) {
      val m = CosteVerificador.medir(zip, claves, k)
      pasadas.put(
        JSONObject()
          .put("registros", m.registros).put("fragmentos", m.fragmentos).put("fallos", m.fallos)
          .put("total_ms", r3(m.totalMs)).put("zip_ms", r3(m.zipMs)).put("jcv_ms", r3(m.jcvMs)).put("ecdsa_ms", r3(m.ecdsaMs))
          .put("sha256_ms", r3(m.sha256Ms)).put("aes_ms", r3(m.aesMs)).put("hmac_ms", r3(m.hmacMs)),
      )
    }
    return JSONObject().put("con_k", conK).put("leer_ms", r3(leer)).put("pasadas", pasadas)
  }

  /** Solo los recursos de P5 que compilar.sh mete en los assets del módulo. */
  private fun asset(nombre: String): ByteArray {
    require(nombre.startsWith("paquete450/") && !nombre.contains("..")) { "solo paquete450/" }
    return contexto.assets.open(nombre).use { it.readBytes() }
  }

  private fun json(r: Resumen): JSONObject =
    JSONObject().put("p50", r3(r.p50)).put("p95", r3(r.p95)).put("max", r3(r.max)).put("total", r3(r.total)).put("n", r.n)

  private fun ms(desde: Long): Double = (SystemClock.elapsedRealtimeNanos() - desde) / 1e6

  private fun r3(x: Double): Double = Math.round(x * 1000) / 1000.0
}
```

La pantalla sustituye la mínima de la tarea 4: seis botones en el orden de la sesión 1, y el paquete se lee de los assets una vez por arranque.

`<banco>/app/pruebas/P5.tsx`:

```tsx
import { Button, ScrollView, Text, View } from 'react-native';
import { BancoP5 } from '../modules/banco';
import { estilos, guardar, useEjecucion } from './comun';
import { criptoKotlin } from './cripto-kotlin';
import { criptoNoble } from './cripto-noble';
import { comprobarHermes, comprobarVectores, leerPaquete450, medirVerificador, type Paquete450, type Vectores } from './p5-verificador';

// Deja que la pantalla pinte "En marcha" antes de ocupar el hilo de JS con el verificador.
const pintar = () => new Promise((listo) => setTimeout(listo, 50));

const texto = (b: Uint8Array) => new TextDecoder().decode(b);
const asset = (nombre: string) => BancoP5.leerAsset(`paquete450/${nombre}`);

// El paquete de 450 sobres se lee una vez por arranque de la app.
let paquete: Promise<{ datos: Paquete450; leerMs: number }> | undefined;
function cargarPaquete() {
  paquete ??= (async () => {
    const t0 = performance.now();
    const [zip, claves, k, huella] = await Promise.all(['paquete.zip', 'claves-dev.txt', 'k.b64u', 'huella.txt'].map(asset));
    return { datos: leerPaquete450({ zip, claves, k, huella }), leerMs: Math.round(performance.now() - t0) };
  })();
  return paquete;
}

const resumenFirmas = (x: any) =>
  x.disponible === false ? x : { nivel: x.nivel, generar_ms: x.generar_ms, primera_ms: x.primera_ms, firma_ms: x.firma_ms, init_ms: x.init_ms, verifica_en_kotlin: x.verifica_en_kotlin };

async function llaves(): Promise<string> {
  const d = JSON.parse(await BancoP5.llaves());
  return JSON.stringify({ tee: resumenFirmas(d.tee), strongbox: resumenFirmas(d.strongbox) });
}

async function sellado(): Promise<string> {
  const d = JSON.parse(await BancoP5.sellado());
  return JSON.stringify({ envoltura_bytes: (d.envoltura.length * 3) >> 2, kc: d.kc, primera_ms: d.primera_ms, ms: d.ms });
}

// Las comprobaciones de Hermes y los vectores de shared con los dos Cripto del teléfono.
async function vectores(): Promise<string> {
  await pintar();
  const hermes = comprobarHermes();
  guardar('p5-hermes', hermes);
  const leer = async (n: string) => JSON.parse(texto(await asset(`vectores/${n}`)));
  const v: Vectores = {
    firmasTs: await leer('firmas-ts.json'),
    firmasKotlin: await leer('firmas-kotlin.json'),
    registros: await leer('registros.json'),
    cifrado: await leer('cifrado.json'),
  };
  const noble = await comprobarVectores(criptoNoble(), v);
  const kotlin = await comprobarVectores(criptoKotlin(), v);
  return guardar('p5-vectores', { hermes, noble, kotlin });
}

// verificarPaquete con un Cripto, con K y sin K; cada medida en su línea de p5-verificador.
async function verificador(variante: 'noble' | 'kotlin'): Promise<string> {
  await pintar();
  const { datos, leerMs } = await cargarPaquete();
  const cripto = variante === 'noble' ? criptoNoble() : criptoKotlin();
  const medidas = [];
  for (const conK of [true, false]) {
    const m = { ...(await medirVerificador(variante, cripto, datos, conK)), leer_ms: leerMs };
    guardar('p5-verificador', m);
    medidas.push(m);
  }
  return JSON.stringify(medidas);
}

async function coste(): Promise<string> {
  const medidas = [];
  for (const conK of [true, false]) medidas.push(JSON.parse(await BancoP5.costeKotlin(conK)));
  return JSON.stringify(medidas);
}

/** P5: Keystore, sellado HPKE y verificador (noble y Kotlin en Hermes, y la cota en Kotlin puro). */
export default function P5() {
  const { texto: resultado, ocupado, ejecutar } = useEjecucion();
  const boton = (titulo: string, prueba: () => Promise<string>) => (
    <View style={estilos.boton}>
      <Button title={titulo} disabled={ocupado} onPress={() => ejecutar(prueba)} />
    </View>
  );
  return (
    <ScrollView contentContainerStyle={estilos.pantalla}>
      <Text style={estilos.titulo}>P5: Keystore, sellado y verificador</Text>
      <Text>En orden, y sin salir de la pantalla hasta que acabe cada uno.</Text>
      {boton('1. Firmas del Keystore (TEE y StrongBox)', llaves)}
      {boton('2. Sellado para la clave de escucha', sellado)}
      {boton('3. Hermes y vectores (noble y Kotlin)', vectores)}
      {boton('4. Verificador con noble (con K y sin K)', () => verificador('noble'))}
      {boton('5. Verificador con Kotlin (con K y sin K)', () => verificador('kotlin'))}
      {boton('6. Cota en Kotlin puro (con K y sin K)', coste)}
      <Text style={estilos.resultado}>{resultado}</Text>
    </ScrollView>
  );
}
```

- [ ] **Paso 13: pesos con R8: BouncyCastle 1.86 frente a Tink 1.23.0 para sellar con HPKE**

Una clase de entrada por librería, que hace lo mismo que `Envoltura.envolver` (sellar K para una pública X25519 con `info` y AAD vacía; enc ‖ cifrado), y `Comprobar`, que demuestra en la JVM que las tres sellan algo que abre BouncyCastle. Después, R8 de build-tools 36.0.0 con `--min-api 24` y solo esa clase guardada: lo que queda en el dex es lo que añade la librería. De Tink se miden dos caminos: la clase interna `HpkeEncrypt` (la cota baja) y la API pública (`HybridConfig`, `KeysetHandle` y `HybridEncrypt`), la que usaría la app. R8 aplica las reglas que traen los jar (`protobuf.pro` de Tink y `gson.pro`), como haría AGP. Y cada medida va en dos modos: `optimizado` (lo que hace R8 por defecto) y `plantilla`, con `-dontoptimize`, que es lo que pone `proguard-android.txt`, el archivo que usa el `build.gradle` que genera `expo prebuild` (comprobado en `/work/h0b/limpio/app/android/app/build/outputs/mapping/release/configuration.txt`).

`<banco>/p5/maquina/pesos/Vacio.java`:

```java
package medida;

/** Referencia: lo que pesa en el dex una clase de entrada que no sella nada. */
public final class Vacio {
    private Vacio() {}

    public static byte[] sellar(byte[] publica, byte[] info, byte[] claro) {
        return claro;
    }
}
```

`<banco>/p5/maquina/pesos/SellarBc.java`:

```java
package medida;

import org.bouncycastle.crypto.InvalidCipherTextException;
import org.bouncycastle.crypto.hpke.HPKE;
import org.bouncycastle.crypto.hpke.HPKEContextWithEncapsulation;

/** Lo que hace HpkeBouncyCastle.sellar del núcleo: HPKE base con X25519, HKDF-SHA256 y AES-256-GCM; enc ‖ cifrado. */
public final class SellarBc {
    private SellarBc() {}

    public static byte[] sellar(byte[] publica, byte[] info, byte[] claro) throws InvalidCipherTextException {
        HPKE hpke = new HPKE(HPKE.mode_base, HPKE.kem_X25519_SHA256, HPKE.kdf_HKDF_SHA256, HPKE.aead_AES_GCM256);
        HPKEContextWithEncapsulation c = hpke.setupBaseS(hpke.deserializePublicKey(publica), info);
        byte[] cifrado = c.seal(new byte[0], claro);
        byte[] enc = c.getEncapsulation();
        byte[] salida = new byte[enc.length + cifrado.length];
        System.arraycopy(enc, 0, salida, 0, enc.length);
        System.arraycopy(cifrado, 0, salida, enc.length, cifrado.length);
        return salida;
    }
}
```

`<banco>/p5/maquina/pesos/SellarTink.java`:

```java
package medida;

import com.google.crypto.tink.hybrid.HpkeParameters;
import com.google.crypto.tink.hybrid.HpkePublicKey;
import com.google.crypto.tink.hybrid.internal.HpkeEncrypt;
import com.google.crypto.tink.util.Bytes;
import java.security.GeneralSecurityException;

/** Lo mismo con Tink, por su clase interna HpkeEncrypt: la cota baja de lo que añade Tink. Sin prefijo: enc ‖ cifrado. */
public final class SellarTink {
    private SellarTink() {}

    static HpkePublicKey clave(byte[] publica) throws GeneralSecurityException {
        HpkeParameters parametros = HpkeParameters.builder()
            .setKemId(HpkeParameters.KemId.DHKEM_X25519_HKDF_SHA256)
            .setKdfId(HpkeParameters.KdfId.HKDF_SHA256)
            .setAeadId(HpkeParameters.AeadId.AES_256_GCM)
            .setVariant(HpkeParameters.Variant.NO_PREFIX)
            .build();
        return HpkePublicKey.create(parametros, Bytes.copyFrom(publica), null);
    }

    public static byte[] sellar(byte[] publica, byte[] info, byte[] claro) throws GeneralSecurityException {
        return HpkeEncrypt.create(clave(publica)).encrypt(claro, info);
    }
}
```

`<banco>/p5/maquina/pesos/SellarTinkApi.java`:

```java
package medida;

import com.google.crypto.tink.HybridEncrypt;
import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.RegistryConfiguration;
import com.google.crypto.tink.hybrid.HybridConfig;
import java.security.GeneralSecurityException;

/** Lo mismo con la API pública de Tink (HybridConfig, KeysetHandle y HybridEncrypt), la que usaría la app. */
public final class SellarTinkApi {
    private SellarTinkApi() {}

    public static byte[] sellar(byte[] publica, byte[] info, byte[] claro) throws GeneralSecurityException {
        HybridConfig.register();
        KeysetHandle claves = KeysetHandle.newBuilder()
            .addEntry(KeysetHandle.importKey(SellarTink.clave(publica)).withRandomId().makePrimary())
            .build();
        return claves.getPrimitive(RegistryConfiguration.get(), HybridEncrypt.class).encrypt(claro, info);
    }
}
```

`<banco>/p5/maquina/pesos/Comprobar.java`:

```java
package medida;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import org.bouncycastle.crypto.AsymmetricCipherKeyPair;
import org.bouncycastle.crypto.hpke.HPKE;

/** Las tres clases de entrada sellan K en 80 bytes que abre BouncyCastle: las tres miden lo mismo. */
public final class Comprobar {
    private Comprobar() {}

    public static void main(String[] args) throws Exception {
        HPKE hpke = new HPKE(HPKE.mode_base, HPKE.kem_X25519_SHA256, HPKE.kdf_HKDF_SHA256, HPKE.aead_AES_GCM256);
        AsymmetricCipherKeyPair receptor = hpke.generatePrivateKey();
        byte[] publica = hpke.serializePublicKey(receptor.getPublic());
        byte[] info = "vigia/v1/envoltura\u0000incidente-de-prueba-01\u0000escucha".getBytes(StandardCharsets.US_ASCII);
        byte[] k = new byte[32];
        new SecureRandom().nextBytes(k);
        String[] nombres = {"BouncyCastle 1.86", "Tink 1.23.0 (HpkeEncrypt)", "Tink 1.23.0 (API pública)"};
        byte[][] sellados = {SellarBc.sellar(publica, info, k), SellarTink.sellar(publica, info, k), SellarTinkApi.sellar(publica, info, k)};
        for (int i = 0; i < sellados.length; i++) {
            byte[] s = sellados[i];
            byte[] abierto = hpke.setupBaseR(Arrays.copyOfRange(s, 0, 32), receptor, info).open(new byte[0], Arrays.copyOfRange(s, 32, s.length));
            if (s.length != 80 || !Arrays.equals(abierto, k)) throw new IllegalStateException(nombres[i] + ": BouncyCastle no lo abre");
            System.out.println("bien: " + nombres[i] + " sella K en 80 bytes que abre BouncyCastle");
        }
    }
}
```

`<banco>/p5/maquina/pesos.sh` (modo 755):

```sh
#!/bin/sh
# P5, pesos con R8 (tarea 9 de H0b): lo que añade a un dex de Android, con el R8 de build-tools 36.0.0 y minSdk 24,
# sellar K con HPKE (modo base, X25519, HKDF-SHA256 y AES-256-GCM) con BouncyCastle 1.86 y con Tink 1.23.0, cada una
# con lo que trae. Las clases de entrada (pesos/*.java) hacen lo mismo que Envoltura.envolver del núcleo, y
# Comprobar.java lo demuestra en la JVM antes de medir. Corre dentro de vigia-build: baja Tink de Maven.
# Uso: sh p5/maquina/pesos.sh [<carpeta nueva>]   (por defecto /work/h0b/p5/pesos)
set -eu
TRABAJO=${1:-/work/h0b/p5/pesos}
BT=/opt/android-sdk/build-tools/36.0.0
ANDROID=/opt/android-sdk/platforms/android-36/android.jar
BCPROV_SHA256=2af190b300cbb0b35e248ccf5f4a06b6072030aeb3da7a98ec73abe5b4cb371f
fuentes=$(cd "$(dirname "$0")/pesos" && pwd)

[ ! -e "$TRABAJO" ] || { echo "Ya existe $TRABAJO: bórrala antes" >&2; exit 1; }
mkdir -p "$TRABAJO/jar" "$TRABAJO/clases" "$TRABAJO/r8"
cd "$TRABAJO"

# 1. Tink 1.23.0 (publicada el 9-jul-2026; lleva protobuf dentro, en com.google.crypto.tink.shaded.protobuf) y las
#    dependencias de su POM. Cada una con el SHA-256 que publica su repositorio; el de jsr305, que solo publica SHA-1,
#    calculado el 14-oct-2026 tras comprobar ese SHA-1.
while read -r url suma; do
    f=jar/$(basename "$url")
    curl -fsSL -o "$f" "$url"
    echo "$suma  $f" | sha256sum -c -
done <<EOF
https://repo1.maven.org/maven2/com/google/crypto/tink/tink-android/1.23.0/tink-android-1.23.0.jar c656918451b01c45ce5b20c7b6d4c388f956f61b3a3528e769048c8944c42f9e
https://repo1.maven.org/maven2/com/google/code/gson/gson/2.13.2/gson-2.13.2.jar dd0ce1b55a3ed2080cb70f9c655850cda86c206862310009dcb5e5c95265a5e0
https://repo1.maven.org/maven2/com/google/errorprone/error_prone_annotations/2.41.0/error_prone_annotations-2.41.0.jar a56e782b5b50811ac204073a355a21d915a2107fce13ec711331ad036f660fcc
https://repo1.maven.org/maven2/com/google/code/findbugs/jsr305/3.0.2/jsr305-3.0.2.jar 766ad2a0783f2687962c8ad74ceecc38a28b9f72a2d085ee438b7813e928d0c7
https://dl.google.com/dl/android/maven2/androidx/annotation/annotation-jvm/1.8.2/annotation-jvm-1.8.2.jar 9aab326d9492800991854360ac248f493ce7f7c3183519309b78ace9e240f6f6
EOF

# 2. BouncyCastle 1.86, el del núcleo, de la caché de Gradle y con su suma (como compilar.sh).
bcprov=$(find "${GRADLE_USER_HOME:-$HOME/.gradle}/caches/modules-2/files-2.1/org.bouncycastle/bcprov-jdk18on/1.86" -name bcprov-jdk18on-1.86.jar | head -n 1)
cp "$bcprov" jar/bcprov-jdk18on-1.86.jar
echo "$BCPROV_SHA256  jar/bcprov-jdk18on-1.86.jar" | sha256sum -c -

# 3. Las clases de entrada y, en la JVM, que las tres sellan K en 80 bytes que abre BouncyCastle.
cp="jar/bcprov-jdk18on-1.86.jar:jar/tink-android-1.23.0.jar:jar/gson-2.13.2.jar:jar/error_prone_annotations-2.41.0.jar:jar/jsr305-3.0.2.jar:jar/annotation-jvm-1.8.2.jar"
javac --release 11 -encoding UTF-8 -nowarn -cp "$cp" -d clases "$fuentes"/*.java
java -Dfile.encoding=UTF-8 -Dsun.stdout.encoding=UTF-8 -cp "clases:$cp" medida.Comprobar

# 4. R8 con solo la clase de entrada guardada; las anotaciones van como classpath (no llegan al dex). Dos modos:
#    "optimizado" (lo que hace R8 por defecto) y "plantilla" (-dontoptimize, como proguard-android.txt, que es lo que
#    usa el build.gradle que genera expo prebuild para el APK con R8).
medir() {
    nombre=$1
    modo=$2
    clase=$3
    shift 3
    d=r8/$nombre-$modo
    mkdir -p "$d"
    echo "-keep class medida.$clase { public static byte[] sellar(byte[], byte[], byte[]); }" > "$d/reglas.pro"
    [ "$modo" = optimizado ] || echo "-dontoptimize" >> "$d/reglas.pro"
    java -cp "$BT/lib/d8.jar" com.android.tools.r8.R8 --release --min-api 24 --lib "$ANDROID" \
        --classpath jar/error_prone_annotations-2.41.0.jar --classpath jar/jsr305-3.0.2.jar --classpath jar/annotation-jvm-1.8.2.jar \
        --pg-conf "$d/reglas.pro" --pg-conf-output "$d/configuracion.txt" --output "$d/salida.zip" "$@" > "$d/r8.log" 2>&1 \
        || { cat "$d/r8.log" >&2; exit 1; }
    unzip -q "$d/salida.zip" -d "$d/dex"
    dex=$(cat "$d"/dex/classes*.dex | wc -c)
    clases=$("$BT/dexdump" -f "$d"/dex/classes*.dex | sed -n 's/^class_defs_size *: *//p' | awk '{n += $1} END {print n}')
    comprimido=$(cat "$d"/dex/classes*.dex | gzip -9 | wc -c)
    echo "$nombre $modo $dex $clases $comprimido"
}
for modo in optimizado plantilla; do
    medir vacio "$modo" Vacio clases/medida/Vacio.class
    medir bouncycastle "$modo" SellarBc clases/medida/SellarBc.class jar/bcprov-jdk18on-1.86.jar
    medir tink-interna "$modo" SellarTink clases/medida/SellarTink.class jar/tink-android-1.23.0.jar jar/gson-2.13.2.jar
    medir tink-publica "$modo" SellarTinkApi clases/medida/SellarTinkApi.class clases/medida/SellarTink.class jar/tink-android-1.23.0.jar jar/gson-2.13.2.jar
done > pesos.txt
echo "R8: $(java -cp "$BT/lib/d8.jar" com.android.tools.r8.R8 --version | head -n 1)"
awk '$1 == "vacio" {d0[$2] = $3; z0[$2] = $5}
     {printf "%-13s %-10s dex %7d bytes, %4d clases, %7d comprimido; añade %7d bytes de dex y %7d comprimido\n", $1, $2, $3, $4, $5, $3 - d0[$2], $5 - z0[$2]}' pesos.txt
```

⚠️ La segunda orden borra `/work/h0b/p5/pesos` si existe: son descargas y salidas de R8 que el guion vuelve a hacer.

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`, que baja Tink y sus dependencias de Maven Central y de Google Maven.

Ejecutar:

```sh
chmod 755 <banco>/p5/maquina/pesos.sh
docker exec vigia-build sh -c 'sincronizar banco && rm -rf /work/h0b/p5/pesos && sh /work/banco/p5/maquina/pesos.sh'
```

Esperado (alrededor de 1 min):

```
jar/tink-android-1.23.0.jar: OK
jar/gson-2.13.2.jar: OK
jar/error_prone_annotations-2.41.0.jar: OK
jar/jsr305-3.0.2.jar: OK
jar/annotation-jvm-1.8.2.jar: OK
jar/bcprov-jdk18on-1.86.jar: OK
bien: BouncyCastle 1.86 sella K en 80 bytes que abre BouncyCastle
bien: Tink 1.23.0 (HpkeEncrypt) sella K en 80 bytes que abre BouncyCastle
bien: Tink 1.23.0 (API pública) sella K en 80 bytes que abre BouncyCastle
R8: R8 8.10.9-dev (build a7ad18a70460b799d0482e497c109a75bf7f91de from go/r8bot (luci-r8-custom-ci-archive-0-mt8s))
vacio         optimizado dex     624 bytes,    1 clases,     426 comprimido; añade       0 bytes de dex y       0 comprimido
bouncycastle  optimizado dex   55092 bytes,   40 clases,   33989 comprimido; añade   54468 bytes de dex y   33563 comprimido
tink-interna  optimizado dex   29220 bytes,   26 clases,   16443 comprimido; añade   28596 bytes de dex y   16017 comprimido
tink-publica  optimizado dex  335792 bytes,  360 clases,  149264 comprimido; añade  335168 bytes de dex y  148838 comprimido
vacio         plantilla  dex     624 bytes,    1 clases,     426 comprimido; añade       0 bytes de dex y       0 comprimido
bouncycastle  plantilla  dex  411788 bytes,  416 clases,  167415 comprimido; añade  411164 bytes de dex y  166989 comprimido
tink-interna  plantilla  dex   56384 bytes,   86 clases,   28797 comprimido; añade   55760 bytes de dex y   28371 comprimido
tink-publica  plantilla  dex  520948 bytes,  854 clases,  205666 comprimido; añade  520324 bytes de dex y  205240 comprimido
```

Con una suma que no cuadra, `sha256sum` dice `FAILED` y el guion para sin medir: no se sigue con un jar que no es el publicado. "comprimido" es el dex con `gzip -9`, una aproximación de lo que ocupa en el APK. Lectura para el informe:
- Optimizado, BouncyCastle añade unos 54 KB de dex (lo mismo que dio la revisión del código de H1 hecha para este plan, con el núcleo entero); Tink con su API pública, unos 335 KB (su registro y protobuf); con la clase interna, 29 KB, pero es una API interna que puede cambiar sin aviso.
- Con `-dontoptimize`, como compila hoy el banco, R8 no puede quitar las ramas de HPKE que no se usan y BouncyCastle pasa a 411 KB (416 clases: las curvas P-256 a P-521, X448, ML-KEM…); el APK con R8 del paso 15 guarda justo esas 415 clases de BouncyCastle (`mapping.txt`). Si la app (H2) compila con `proguard-android-optimize.txt`, BouncyCastle se queda en unos 54 KB; hay que probar antes que R8 optimizado no rompe nada.
- Que Tink selle algo que abre BouncyCastle confirma que el formato de la envoltura no ata a ninguna de las dos librerías.

- [ ] **Paso 14: commit en el banco**

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit:

```sh
git -C <banco> add app/package.json app/package-lock.json app/pruebas/P5.tsx app/pruebas/p5-verificador.ts app/pruebas/cripto-noble.ts app/pruebas/cripto-kotlin.ts app/modules/banco/android/src/main/java/expo/modules/banco/BancoP5Module.kt jvm/puro/src/main/kotlin/vigia/banco/p5/Primitivas.kt jvm/puro/src/main/kotlin/vigia/banco/p5/CosteVerificador.kt jvm/puro/src/test/kotlin/vigia/banco/p5/PrimitivasTest.kt jvm/puro/src/test/kotlin/vigia/banco/p5/CosteVerificadorTest.kt p5/maquina/paquete450.ts p5/maquina/firmas.ts p5/maquina/sellado.ts p5/maquina/tiempos.ts p5/maquina/p5.test.ts p5/maquina/pesos.sh p5/maquina/pesos/Vacio.java p5/maquina/pesos/SellarBc.java p5/maquina/pesos/SellarTink.java p5/maquina/pesos/SellarTinkApi.java p5/maquina/pesos/Comprobar.java
git -C <banco> status --short | grep -c '^??'; git -C <banco> diff --cached --stat | tail -1
git -C <banco> commit -q -m "P5: Keystore, sellado HPKE, verificador en Hermes (noble y Kotlin), cota en Kotlin, pesos con R8 y herramientas de la máquina" && git -C <banco> log --oneline -1
```

Esperado: `0`, ` 22 files changed, 1627 insertions(+), 21 deletions(-)` y el commit con su hash corto.

- [ ] **Paso 15: compilar los dos APK desde un clon limpio, con el paquete de 450 sobres**

`compilar.sh` copia `/work/h0b/p5/paquete450` (paso 10) a los assets del módulo: unos 7,4 MB más en cada APK, con R8 y sin R8. Se lanza en segundo plano y se espera a la línea `salida:`.

⚠️ Como en la tarea 4, la primera orden borra y rehace `/work/h0b/limpio`, y `compilar.sh` sustituye los APK de `/work/h0b/salida/apk`: los anteriores se pierden (se pueden rehacer desde su commit).

📍 Máquina de trabajo; las órdenes `docker exec` corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'rm -rf /work/h0b/limpio && git clone -q /fuente/banco /work/h0b/limpio && sh /work/h0b/limpio/compilar.sh > /work/h0b/compilar.log 2>&1; echo "salida: $?" >> /work/h0b/compilar.log'
docker exec vigia-build sh -c 'grep -E "^nucleo|^bcprov|BUILD|^==|^[0-9]+ app-|^salida" /work/h0b/compilar.log; grep "^paquete450" /work/h0b/salida/apk/compilacion.txt'
```

Esperado (tamaños de la validación del 14-oct, sobre el andamio de la tarea 4 y la tarea 8; con el código de las tareas 5 a 7 serán otros):

```
nucleo.jar: OK
bcprov-jdk18on-1.86.jar: OK
BUILD SUCCESSFUL in …
BUILD SUCCESSFUL in …
== sin-r8
43046219 app-arm64-v8a-release.apk
36163935 app-armeabi-v7a-release.apk
43818995 app-x86_64-release.apk
== con-r8
36015490 app-arm64-v8a-release.apk
29133206 app-armeabi-v7a-release.apk
36788266 app-x86_64-release.apk
salida: 0
paquete450: 8 archivos
```

Con las tareas en orden, la tarea 9 añade a cada APK arm64 unos 7,77 MB, lo mismo sin R8 que con R8: 7,44 MB son los 8 archivos de `paquete450` (el zip es azar cifrado: casi no se comprime), que la app real no lleva; unos 313 KB, el bundle de JS (shared entero y @noble, que Metro no recorta); y unos 10 KB, el dex. El coste de BouncyCastle con R8 ya entró en la tarea 6, cuando el grabador empezó a sellar con él (unos 200 KB). El peso con R8 que pide P5 es la medida aislada del paso 13, junto con las 415 clases de BouncyCastle que R8 deja en `mapping.txt`. (Las cifras de arriba son de la validación sobre el andamio con la tarea 8, sin las tareas 5 a 7.)

- [ ] **Paso 16: comprobar el clon limpio, las fichas, los assets, las pruebas, los tipos y el bundle de Hermes**

Además de lo de la tarea 8, que cada APK lleve los 8 archivos de `paquete450`, las pruebas de P2 y P5 en el clon y el bundle: Metro vuelve a hacer el bundle de JS y `hermesc` lo compila como en el build, avisando de cada variable global que el código usa sin declarar. De las que importan al verificador deben salir `Intl`, `TextDecoder` y `TextEncoder` (las pone el entorno: el Intl de hermes-android, el `TextDecoder` de Expo y el `TextEncoder` de la VM de Hermes) y `crypto` (solo la usa `criptoWebCrypto`, que el teléfono no llama), y no `BigInt`, que Hermes trae de serie. Es lo que se puede comprobar en la máquina; el resto lo prueba `comprobarHermes()` en el teléfono.

📍 Máquina de trabajo; las órdenes corren dentro de `vigia-build`.

Ejecutar:

```sh
docker exec -i vigia-build sh -s <<'EOF'
commit=$(git -C /work/h0b/limpio rev-parse --short HEAD)
echo "cambios en el clon limpio tras compilar: $(git -C /work/h0b/limpio status --porcelain | wc -l)"
for f in /work/h0b/salida/apk/sin-r8/*.apk /work/h0b/salida/apk/con-r8/*.apk; do
    ficha=${f%.apk}.ficha.txt
    printf '%s/%s: ' "$(basename "$(dirname "$f")")" "$(basename "$f" .apk)"
    grep -q "versionName='$commit'" "$ficha" && printf 'versión del commit' || printf 'MAL: otra versión'
    grep -q application-debuggable "$ficha" && printf ', MAL: depurable' || printf ', no depurable'
    printf ', %s archivos de paquete450\n' "$(unzip -l "$f" | grep -c ' assets/paquete450/')"
done
cd /work/h0b/limpio/jvm && ./gradlew --no-daemon test -q; echo "jvm: $?"
cd /work/h0b/limpio && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test p2/maquina/p2.test.ts p5/maquina/p5.test.ts 2>&1 | grep -E "^ℹ (pass|fail)"
cd /work/h0b/limpio/app && npx tsc --noEmit -p . --allowImportingTsExtensions
rm -rf /tmp/p5-hermes && mkdir /tmp/p5-hermes
npx expo export:embed --platform android --dev false --entry-file index.ts --bundle-output /tmp/p5-hermes/bundle.js --assets-dest /tmp/p5-hermes/assets > /dev/null 2>&1 && echo "bundle de Metro: bien"
node_modules/hermes-compiler/hermesc/linux64-bin/hermesc -O -emit-binary -out /tmp/p5-hermes/bundle.hbc /tmp/p5-hermes/bundle.js 2>&1 | grep -oE 'the variable "(BigInt|TextDecoder|TextEncoder|Intl|crypto)" was not declared' | sort
rm -rf /tmp/p5-hermes
EOF
```

Esperado:

```
cambios en el clon limpio tras compilar: 0
sin-r8/app-arm64-v8a-release: versión del commit, no depurable, 8 archivos de paquete450
sin-r8/app-armeabi-v7a-release: versión del commit, no depurable, 8 archivos de paquete450
sin-r8/app-x86_64-release: versión del commit, no depurable, 8 archivos de paquete450
con-r8/app-arm64-v8a-release: versión del commit, no depurable, 8 archivos de paquete450
con-r8/app-armeabi-v7a-release: versión del commit, no depurable, 8 archivos de paquete450
con-r8/app-x86_64-release: versión del commit, no depurable, 8 archivos de paquete450
jvm: 0
ℹ pass 21
ℹ fail 0
vigia-shared/hpke-core.ts(3,75): error TS2307: Cannot find module '@hpke/core' or its corresponding type declarations.
bundle de Metro: bien
the variable "Intl" was not declared
the variable "TextDecoder" was not declared
the variable "TextEncoder" was not declared
the variable "crypto" was not declared
```

Lo que pasa en el teléfono (sesión 1) y su análisis en la máquina están en la tarea 13: la parte de P5, con la pantalla encendida desde antes de P2, y el análisis de P5.

**Notas:**

- **Nota:** validado el 14-oct-2026 en `vigia-build` (todavía con la imagen de H0a; los contenedores efímeros, con `vigia-build:h0a` en lugar de `vigia-build:h0b`, que es la misma imagen más iproute2) sobre una copia del andamio con la tarea 8 ya hecha: el paso 1 dio esa diferencia del lockfile; los pasos 3 y 7 fallan como se indica y los 5, 9 y 11 pasan, con estas salidas; el paquete del paso 10 tardó 2 s; el paso 13, con estas cifras; el commit, las dos builds desde un clon limpio con el paquete (de 3 min 17 s a 3 min 57 s sin R8 y de 1 min 11 s a 2 min 11 s con R8, con la caché llena y la máquina cargada) y las comprobaciones del paso 16. Después se repitió todo, tareas 8 y 9, sobre una copia nueva del andamio: el mismo lockfile (`package.json` con SHA-256 `53fcea3f536e38e6c55f5bace189749c1fc571175f5256f37c7f7747e5dcd211` y `package-lock.json` con `67961227491c5e15b8fb2a7ac9f6fa652f6838ac0a68f3bc9333e29995192522`), las mismas estadísticas de los dos commits y las mismas salidas, con los tamaños del paso 15. Tras la revisión del plan cambiaron `tiempos.ts` y `p5.test.ts` (la cota no cuenta como verificador): sobre otra copia del andamio con la tarea 8 (con las mismas estadísticas de su commit), las dos pruebas de `tiempos` se vieron en rojo con el `tiempos.ts` anterior y las 11 en verde con el nuevo, las de P2 y P5 juntas dieron 21 de 21 y el commit, las estadísticas del paso 14. Los APK no cambian: `p5/maquina` no entra en ellos. Lo que necesita Android (Keystore con TEE y StrongBox, assets, las funciones síncronas de Expo con `Uint8Array`, Hermes) solo se compila aquí: se ejecuta por primera vez en la sesión 1.
- **Nota:** además, `resumen.ts`, `firmas.ts`, `tiempos.ts` y `sellado.ts` corrieron con las órdenes del análisis de P2 y P5 de la tarea 13 tal como están escritas, con las rutas de la copia: contenedores efímeros sin red, `vigia-trabajo` en solo lectura, `--memory 2g --memory-swap 2g` y, en el sellado, `--log-driver none`, sobre una sesión sintética (`sesion-1` y `sesion-1-r8`) montada en solo lectura y con una privada de escucha desechable por la entrada estándar. Los cuatro dieron ✓ y `salida: 0` (el sellado, una línea en `sesion-1` y dos en `sesion-1-r8`); `sellado.ts` con otra privada, `✗ el teléfono selló para otra pública…` y `salida: 1`; y `tiempos.ts` con la variante de Kotlin a 5 s, el veredicto de la cota inferior y `salida: 1`. En esos contenedores `memory.swap.max` es 0 y `/work` no se puede escribir, y con `--log-driver none` el daemon no guarda la salida (`LogPath` vacío).
- **Nota:** la comparación de sumas con la que acaba P5 en la sesión 1 (el último paso de P5 en la tarea 13) se probó con PowerShell 7.5 en modo `Legacy` (el de Windows PowerShell 5.1) y `Standard`, con un adb y un pm falsos: la orden remota llega entera a adb como un solo argumento, `sh` (dash y busybox) la ejecuta, y la comparación da `True` con el mismo APK y `False` con otro. En el teléfono no está probada.
- **Nota:** `jvm/puro` gana con esta tarea dos clases de prueba con 11 pruebas (una se salta sin `PAQUETE450`); quien cuente las pruebas de `jvm/` después de la tarea 9 debe sumarlas.
- **Nota:** las funciones síncronas de Expo convierten un `Uint8Array` de JS en `ByteArray` copiando sus bytes (`ByteArrayFrontendConverter`, que respeta `byteOffset`) y devuelven un `Uint8Array` nuevo (leído en expo-modules-core 57.0.21): `cripto-kotlin` paga esas copias en cada llamada, y eso es parte de lo que mide.
- **Nota:** la línea `p5-llaves` mide unos 2 650 caracteres sin StrongBox, que caben en logcat, y unos 5 100 con StrongBox (calculado con la forma de su JSON). Con StrongBox, por logcat (el plan B del protocolo de resultados) llega recortada a 2 900 caracteres y `firmas.ts` no puede comprobarla: en ese caso hace falta el `resultados.jsonl` de `adb pull`.
- **Nota:** `paquete450` lleva `k.b64u`, la K del paquete sintético, dentro del APK: no protege nada (el audio es azar) y sirve para medir el verificador con K en el teléfono.

---

### Tarea 10: P6, página de primitivas ampliada y servidor local en PowerShell

**Archivos (banco, `<banco>`):**
- Modificar: `p6/primitivas.html`, `p6/primitivas.js` y `p6/primitivas.spec.mjs`.
- Crear: `p6/servidor.ps1`, `p6/prueba-servidor.sh`, `p6/prueba-sintaxis.ps1`, `p6/analizar.py` y `p6/prueba_analizar.py`.
- Sin cambios, de H0a: `p6/package.json`, `p6/package-lock.json` y `p6/playwright.config.mjs`.
- Fuera del banco: `/work/h0b/p6/muestra.aac` (la muestra ADTS, que se entrega en la sesión 3) y `/work/h0b/p6/servidor/` (la carpeta donde se prueba el servidor, con su registro `servidor.log`; se borra al final); la imagen oficial de PowerShell fijada por digest.

**Interfaces:**
- Consume:
  - Tarea 2: la imagen `vigia-build:h0b` (curl, bash, ffmpeg 6.1.1, python3 y npm con la caché en `/work/.npm`).
  - Tarea 4: el banco con el andamio; `p6/` de H0a (página, spec, `package.json`, lockfile y `playwright.config.mjs`); en `.gitignore`, `/p6/muestra.aac`, `/p6/resultado-*.json` y `test-results/`.
  - Informe del pico: Playwright 1.63.0, `mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`.
  - La imagen oficial de PowerShell 7.5.0, `mcr.microsoft.com/powershell@sha256:042240d57ec9e47e511033b92625a8d95875ee5860af3015992c248b58a8be81` (paso 1).
- Produce:
  - `p6/servidor.ps1`, para Windows PowerShell 5.1 y PowerShell 7: `powershell -NoProfile -ExecutionPolicy Bypass -File .\servidor.ps1` escucha solo en `127.0.0.1:8080` con `System.Net.Sockets.TcpListener` (sin http.sys ni permisos de administración) y atiende varias conexiones sin hilos. Rutas exactas: `GET /primitivas.html` (`text/html; charset=utf-8`), `GET /primitivas.js` (`text/javascript; charset=utf-8`) y `GET /muestra.aac` (`audio/aac`), de su carpeta, con `Cache-Control: no-store` y `Connection: close`; `POST /resultado` con un objeto JSON de 64 KiB como mucho, `Content-Type: application/json` y sin `Origin` o con `Origin: http://127.0.0.1:8080`, que guarda tal cual como `resultado-<n>.json` (el siguiente número que no existe, contando desde el último que usó en esa ejecución: nunca pisa un archivo) en su carpeta y responde `201 {"archivo":"resultado-<n>.json"}`. Lo demás: 404 (otra ruta u otro método), 403 (otro `Host` u otro `Origin`), 415, 400, 413 o 431. Una línea por petición en la consola (`GET /primitivas.html -> 200`). Ctrl+C lo para y libera el puerto.
  - La página: `http://127.0.0.1:8080/primitivas.html#<etiqueta>`, con la etiqueta del navegador en el fragmento (`chrome`, `samsung`, `mi` o `telegram`, y `<etiqueta>-act` tras actualizarlo; solo `[a-z0-9-]`, hasta 24 caracteres). Muestra el resumen grande (`5 de 5 ✓` en verde, o `4 de 5 ✓, falla x25519` en rojo), una línea por primitiva con su error, si se guardó, la etiqueta, `isSecureContext`, si está dentro del navegador de Telegram, `navigator.userAgent` y `navigator.userAgentData`. El ✓ de X25519 exige dos pruebas: dos claves generadas acuerdan el mismo secreto (la de H0a) y el caso de RFC 7748, sección 6.1 (la privada importada en PKCS #8, no extraíble, y la pública en crudo dan el secreto publicado), que es lo que hará la bóveda. Envía por POST a `/resultado` el JSON `{"pagina":"p6-h0b","etiqueta","seguro","webviewTelegram","userAgent","marcas","primitivas":{"x25519"|"aesgcm"|"hkdf"|"ecdsa"|"adts":{"ok","detalle"}}}`. Deja `window.resultadosPrimitivas` (como en H0a), `window.informeP6` y `window.envioPrimitivas` (`{estado, archivo}`, y `error` si no llegó).
  - `python3 -I -B <banco>/p6/analizar.py <carpeta>`: lee los `resultado-*.json`, `p6-versiones.txt`, `p6-versiones-act.txt` y las capturas `p6-*.png` de la carpeta e imprime en markdown una fila por medida, las versiones, las capturas y el veredicto, con qué navegadores medidos tienen X25519 en WebCrypto en su última medida (y su motor) y el navegador interno de Telegram «sin medir», que se acepta si Telegram abrió el enlace fuera de su navegador; nunca el userAgent. Sale con 2 si no hay resultados. Lo usa la sesión 3 (tarea 15, P6).
  - `/work/h0b/p6/muestra.aac`: 16 998 bytes, SHA-256 `7cf6e56750c93d7b905ef82704c5b1bd8cf5272985ce013c5629048b08afcb15`.
  - Para la tarea 16: la tabla de P6 en los tres motores, ahora servida por `servidor.ps1`.

En H0a la página se sirvió con `python3 -m http.server`, que no guarda resultados y lista la carpeta. En el portátil de la persona responsable no se instala nada: el servidor es PowerShell, que ya trae Windows, y se prueba aquí con la imagen oficial de PowerShell para Linux. Esa imagen no trae curl, así que las peticiones salen de un contenedor de `vigia-build:h0b` que comparte su red (`--network container:p6-servidor`), igual que Playwright. El servidor corre sin red (`--network none`) y los otros dos comparten la suya; los tres, con el usuario 1001, sin capacidades y con el volumen de trabajo en solo lectura. `p6-servidor` solo puede escribir en su carpeta, `/work/h0b/p6/servidor`, que monta aparte con `volume-subpath` (Docker 26 o posterior): ahí guarda los resultados y su registro. Playwright escribe en su `/tmp`. Si la tarea se corta antes del paso 16, `docker rm -f p6-servidor` quita el contenedor del servidor.

- [ ] **Paso 1: fijar la imagen de PowerShell**

En `mcr.microsoft.com/powershell`, la imagen más nueva para Linux es la de la etiqueta `7.5-ubuntu-24.04`: PowerShell 7.5.0, del 30-ene-2025 (no hay etiquetas de versiones posteriores; consultado el 14-oct-2026). Se usa por digest.

📍 Máquina de trabajo.

Ejecutar:

```sh
docker pull mcr.microsoft.com/powershell@sha256:042240d57ec9e47e511033b92625a8d95875ee5860af3015992c248b58a8be81 > /dev/null && docker image inspect --format '{{.Created}}' mcr.microsoft.com/powershell@sha256:042240d57ec9e47e511033b92625a8d95875ee5860af3015992c248b58a8be81
docker run --rm --network none --user 1001:1001 --cap-drop ALL --security-opt no-new-privileges mcr.microsoft.com/powershell@sha256:042240d57ec9e47e511033b92625a8d95875ee5860af3015992c248b58a8be81 pwsh -NoLogo -NoProfile -Command '$PSVersionTable.PSVersion.ToString(); [System.Runtime.InteropServices.RuntimeInformation]::FrameworkDescription'
```

Esperado:

```
2025-01-30T23:42:10.578688363Z
7.5.0
.NET 9.0.1
```

- [ ] **Paso 2: generar la muestra ADTS**

La misma orden de ffmpeg que en H0a, ahora fuera del banco: ffmpeg 6.1.1 da los mismos bytes que entonces.

📍 Máquina de trabajo; la orden corre en un contenedor efímero sin red.

Ejecutar:

```sh
docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work --tmpfs /tmp:size=64m vigia-build:h0b sh -c 'mkdir -p /work/h0b/p6 && cd /work/h0b/p6 && ffmpeg -loglevel error -y -f lavfi -i sine=frequency=440:duration=4 -ac 1 -ar 16000 -c:a aac -b:a 32k -f adts muestra.aac && sha256sum muestra.aac && stat -c %s muestra.aac'
```

Esperado:

```
7cf6e56750c93d7b905ef82704c5b1bd8cf5272985ce013c5629048b08afcb15  muestra.aac
16998
```

- [ ] **Paso 3: escribir la prueba del servidor**

Prueba de caja negra con curl: los tres archivos con su tipo y sus bytes, las rutas que no existen, el `Host` ajeno (lo que llegaría por DNS rebinding desde una página cualquiera del portátil), una cabecera enorme, una conexión abierta que no envía nada (Chrome abre conexiones de reserva así: un servidor de un solo hilo se quedaría colgado esperándola), el POST con su JSON guardado tal cual, los POST que no se deben guardar, un POST con el cuerpo en otro envío (Chrome manda cabeceras y cuerpo por separado) y que solo escucha en `127.0.0.1:8080`.

`<banco>/p6/prueba-servidor.sh`:

```bash
#!/bin/bash
# P6 (H0b): prueba de servidor.ps1 con curl. Corre en un contenedor que comparte la red del servidor
# (--network container:<el del servidor>): 127.0.0.1:8080 es el del servidor.
# Uso: bash prueba-servidor.sh <carpeta del servidor>
# La carpeta tiene primitivas.html, primitivas.js, muestra.aac y servidor.ps1, y ningún resultado-*.json.
set -u
carpeta=${1:?falta la carpeta del servidor}
base=http://127.0.0.1:8080
mal=0
bien() { echo "bien: $1"; }
falla() { echo "MAL: $1"; mal=1; }
comprobar() { if [ "$2" = "$3" ]; then bien "$1"; else falla "$1 (esperado '$2', sale '$3')"; fi; }

# pwsh tarda unos segundos en arrancar: hasta 20 s.
for _ in $(seq 1 40); do curl -s -o /dev/null "$base/primitivas.html" && break; sleep 0.5; done

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# Estado y tipo de contenido; el cuerpo queda en $tmp/cuerpo y las cabeceras en $tmp/cabeceras.
pedir() { curl -s -D "$tmp/cabeceras" -o "$tmp/cuerpo" -w '%{http_code} %{content_type}' "$@"; }
# Lo mismo para un POST a /resultado con el cuerpo de $tmp/enviar.
enviar() { pedir -X POST --data-binary "@$tmp/enviar" "$@" "$base/resultado"; }
resultados() { (cd "$carpeta" && ls resultado-*.json 2>/dev/null | tr '\n' ' '); }

# 1. Los tres archivos, con su tipo y sus mismos bytes.
for par in 'primitivas.html text/html; charset=utf-8' 'primitivas.js text/javascript; charset=utf-8' 'muestra.aac audio/aac'; do
    archivo=${par%% *}
    comprobar "GET /$archivo" "200 ${par#* }" "$(pedir "$base/$archivo")"
    cmp -s "$tmp/cuerpo" "$carpeta/$archivo" && bien "$archivo: los mismos bytes" || falla "$archivo: otros bytes"
done
grep -qi '^cache-control: no-store' "$tmp/cabeceras" && grep -qi '^connection: close' "$tmp/cabeceras" \
    && bien 'cabeceras no-store y close' || falla 'faltan Cache-Control: no-store o Connection: close'
comprobar 'GET con consulta (?v=2)' '200' "$(pedir "$base/primitivas.html?v=2" | cut -d' ' -f1)"

# 2. Cualquier otra ruta, o el método que no toca, da 404 (servidor.ps1 no se sirve a sí mismo).
for ruta in / /servidor.ps1 /PRIMITIVAS.HTML /../servidor.ps1 /resultado /resultado-1.json; do
    comprobar "GET $ruta" '404' "$(pedir --path-as-is "$base$ruta" | cut -d' ' -f1)"
done
comprobar 'POST /primitivas.html' '404' "$(pedir -X POST -d x "$base/primitivas.html" | cut -d' ' -f1)"

# 3. Otro Host (lo que haría una página con DNS rebinding) da 403.
comprobar 'Host ajeno' '403' "$(pedir -H 'Host: otro.example:8080' "$base/primitivas.html" | cut -d' ' -f1)"
comprobar 'cabecera de más de 16 KiB' '431' "$(pedir -H "X-Relleno: $(head -c 17000 /dev/zero | tr '\0' 'a')" "$base/primitivas.html" | cut -d' ' -f1)"

# 4. Una conexión abierta que no envía nada (como las que abre Chrome por adelantado) no bloquea a las demás.
if { exec 3<>/dev/tcp/127.0.0.1/8080; } 2>/dev/null; then
    comprobar 'GET con otra conexión abierta y callada' '200' "$(pedir --max-time 3 "$base/primitivas.js" | cut -d' ' -f1)"
    exec 3>&-
else
    falla 'no se pudo abrir la conexión callada'
fi

# 5. POST /resultado guarda el JSON tal cual, numerado, y responde con el nombre del archivo.
printf '{"pagina":"p6-h0b","etiqueta":"curl","primitivas":{"x25519":{"ok":true,"detalle":""}},"nota":"ñ ✓"}' > "$tmp/enviar"
comprobar 'POST JSON' '201 application/json; charset=utf-8' "$(enviar -H 'Content-Type: application/json')"
comprobar 'respuesta del POST' '{"archivo":"resultado-1.json"}' "$(cat "$tmp/cuerpo" 2>/dev/null)"
cmp -s "$tmp/enviar" "$carpeta/resultado-1.json" && bien 'resultado-1.json: los mismos bytes' || falla 'resultado-1.json: otros bytes'
comprobar 'POST JSON con Origin del propio servidor' '201' "$(enviar -H 'Content-Type: application/json; charset=utf-8' -H "Origin: $base" | cut -d' ' -f1)"
comprobar 'respuesta del segundo POST' '{"archivo":"resultado-2.json"}' "$(cat "$tmp/cuerpo" 2>/dev/null)"

# 6. Lo que no es un objeto JSON de un origen admitido no se guarda.
comprobar 'POST como text/plain' '415' "$(enviar -H 'Content-Type: text/plain' | cut -d' ' -f1)"
comprobar 'POST desde otro origen' '403' "$(enviar -H 'Content-Type: application/json' -H 'Origin: http://otro.example' | cut -d' ' -f1)"
printf '{"roto":' > "$tmp/enviar"
comprobar 'POST con JSON roto' '400' "$(enviar -H 'Content-Type: application/json' | cut -d' ' -f1)"
printf '[1,2]' > "$tmp/enviar"
comprobar 'POST con un JSON que no es objeto' '400' "$(enviar -H 'Content-Type: application/json' | cut -d' ' -f1)"
head -c 70000 /dev/zero | tr '\0' 'a' > "$tmp/enviar"
comprobar 'POST de más de 64 KiB' '413' "$(enviar -H 'Content-Type: application/json' -H 'Expect: 100-continue' | cut -d' ' -f1)"
# Chrome envía las cabeceras y el cuerpo de un POST por separado: el servidor espera al cuerpo entero.
if { exec 4<>/dev/tcp/127.0.0.1/8080; } 2>/dev/null; then
    cuerpo='{"etiqueta":"lento"}'
    printf 'POST /resultado HTTP/1.1\r\nHost: 127.0.0.1:8080\r\nContent-Type: application/json\r\nContent-Length: %s\r\n\r\n' "${#cuerpo}" >&4
    sleep 0.5
    printf '%s' "$cuerpo" >&4
    IFS= read -r -t 5 linea <&4
    exec 4>&-
    comprobar 'POST con el cuerpo en otro envío' 'HTTP/1.1 201 Created' "${linea%$'\r'}"
else
    falla 'no se pudo abrir la conexión del POST lento'
fi
comprobar 'archivos guardados' 'resultado-1.json resultado-2.json resultado-3.json ' "$(resultados)"

# 7. Solo escucha en 127.0.0.1:8080 (0100007F:1F90 en /proc/net/tcp; nada en IPv6).
comprobar 'escuchas en el puerto 8080' '0100007F:1F90' "$(awk '$4 == "0A" && $2 ~ /:1F90$/ {print $2}' /proc/net/tcp | tr '\n' ' ' | sed 's/ $//')"
comprobar 'escuchas IPv6 en el puerto 8080' '0' "$(awk '$4 == "0A" && $2 ~ /:1F90$/' /proc/net/tcp6 | wc -l)"

[ "$mal" -eq 0 ] && echo 'servidor.ps1: todo bien' || echo 'servidor.ps1: hay fallos'
exit "$mal"
```

- [ ] **Paso 4: ver que la prueba falla sin servidor**

La carpeta de prueba lleva la página de H0a y la muestra, y todavía no `servidor.ps1`. El contenedor del servidor arranca con `sleep infinity` para que su red exista aunque `pwsh` no arranque; el servidor se lanza dentro con `docker exec -d` y su consola va a `/work/h0b/p6/servidor/servidor.log`, en la única carpeta donde puede escribir.

📍 Máquina de trabajo; `sincronizar banco` corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && rm -rf /work/h0b/p6/servidor && mkdir -p /work/h0b/p6/servidor && cp /work/banco/p6/primitivas.html /work/banco/p6/primitivas.js /work/h0b/p6/muestra.aac /work/h0b/p6/servidor/'
docker run -d --init --name p6-servidor --network none --user 1001:1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --mount type=volume,source=vigia-trabajo,target=/work/h0b/p6/servidor,volume-subpath=h0b/p6/servidor mcr.microsoft.com/powershell@sha256:042240d57ec9e47e511033b92625a8d95875ee5860af3015992c248b58a8be81 sleep infinity > /dev/null
docker exec -d p6-servidor sh -c 'exec pwsh -NoLogo -NoProfile -File /work/h0b/p6/servidor/servidor.ps1 > /work/h0b/p6/servidor/servidor.log 2>&1'
docker run --rm --network container:p6-servidor --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro vigia-build:h0b bash /work/banco/p6/prueba-servidor.sh /work/h0b/p6/servidor; echo "salida: $?"
```

Esperado, tras unos 20 s (lo que espera la prueba a que arranque el servidor), solo líneas `MAL` salvo la de IPv6 (sin servidor no hay escuchas), y al final:

```
MAL: escuchas en el puerto 8080 (esperado '0100007F:1F90', sale '')
bien: escuchas IPv6 en el puerto 8080
servidor.ps1: hay fallos
salida: 1
```

Las primeras son `MAL: GET /primitivas.html (esperado '200 text/html; charset=utf-8', sale '000 ')` y `MAL: primitivas.html: otros bytes`.

- [ ] **Paso 5: escribir el servidor**

Solo ASCII y sin BOM: Windows PowerShell 5.1 lee un `.ps1` sin BOM con la página de códigos de Windows, y una tilde lo rompería. Nada de lo que solo existe desde PowerShell 6 o 7 (`??`, `?.`, `&&`, el ternario, `-AsByteStream`); .NET solo con lo que ya trae .NET Framework 4.5 (`TcpListener`, `NetworkStream.DataAvailable`, `Encoding.GetEncoding(28591)`, `UTF8Encoding($false, $true)`). Las comparaciones de texto son ordinales (`StringComparison.Ordinal`): con ICU, en PowerShell 7, `IndexOf` de `"\r\n"` con la cultura actual puede no encontrar lo que hay.

`<banco>/p6/servidor.ps1`:

```powershell
# P6 (H0b): servidor estatico minimo de la pagina de primitivas, solo en 127.0.0.1:8080.
# Sirve primitivas.html, primitivas.js y muestra.aac de su carpeta y guarda cada POST /resultado (un objeto
# JSON) como resultado-<n>.json en esa misma carpeta. Cualquier otra ruta da 404. Con adb reverse, el
# telefono abre la pagina en http://127.0.0.1:8080/primitivas.html, que es un contexto seguro.
# Usa System.Net.Sockets.TcpListener y no http.sys: no necesita permisos de administrador.
# Atiende varias conexiones a la vez sin hilos: Chrome abre conexiones de reserva que no envian nada.
# Compatible con Windows PowerShell 5.1 y PowerShell 7. Solo ASCII: PowerShell 5.1 lee un .ps1 sin BOM
# con la pagina de codigos de Windows.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File .\servidor.ps1   (Ctrl+C para pararlo)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$puerto = 8080
$hostAdmitido = "127.0.0.1:$puerto"
$origenAdmitido = "http://$hostAdmitido"
$carpeta = $PSScriptRoot
$maxCabecera = 16384
$maxCuerpo = 65536
$maxEspera = [TimeSpan]::FromSeconds(10)

# Ruta exacta (distingue mayusculas) -> archivo de la carpeta y tipo de contenido.
$archivos = New-Object 'System.Collections.Generic.Dictionary[string,string[]]'
$archivos.Add('/primitivas.html', @('primitivas.html', 'text/html; charset=utf-8'))
$archivos.Add('/primitivas.js', @('primitivas.js', 'text/javascript; charset=utf-8'))
$archivos.Add('/muestra.aac', @('muestra.aac', 'audio/aac'))
$razones = @{ 200 = 'OK'; 201 = 'Created'; 400 = 'Bad Request'; 403 = 'Forbidden'; 404 = 'Not Found'
    413 = 'Payload Too Large'; 415 = 'Unsupported Media Type'; 431 = 'Request Header Fields Too Large' }
$latin1 = [System.Text.Encoding]::GetEncoding(28591)
$utf8Estricto = New-Object System.Text.UTF8Encoding($false, $true)
$script:siguiente = 1

function Responder($flujo, [int]$codigo, [string]$tipo, [byte[]]$cuerpo) {
    $cabecera = "HTTP/1.1 $codigo $($razones[$codigo])`r`nContent-Type: $tipo`r`n" +
        "Content-Length: $($cuerpo.Length)`r`nCache-Control: no-store`r`n" +
        "X-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($cabecera)
    $flujo.Write($bytes, 0, $bytes.Length)
    $flujo.Write($cuerpo, 0, $cuerpo.Length)
}

function ResponderTexto($flujo, [int]$codigo, [string]$texto) {
    Responder $flujo $codigo 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes("$texto`n"))
}

function Anotar([string]$metodo, [string]$ruta, [int]$codigo, [string]$nota) {
    $linea = ('{0} {1}' -f $metodo, $ruta) -replace '[^\x20-\x7E]', '?'
    if ($linea.Length -gt 90) { $linea = $linea.Substring(0, 90) + '...' }
    $texto = '{0} -> {1} {2}' -f $linea, $codigo, $nota
    Write-Host $texto.TrimEnd()
}

# Responde si la peticion esta completa y devuelve $true (hay que cerrar la conexion);
# devuelve $false si aun faltan bytes.
function Atender([byte[]]$datos, $flujo) {
    $texto = $latin1.GetString($datos)
    $fin = $texto.IndexOf("`r`n`r`n", [System.StringComparison]::Ordinal)
    if ($fin -lt 0 -and $datos.Length -le $maxCabecera) { return $false }
    if ($fin -lt 0 -or $fin -gt $maxCabecera) {
        ResponderTexto $flujo 431 'cabecera de mas de 16 KiB'
        Anotar '?' '?' 431 'cabecera de mas de 16 KiB'
        return $true
    }
    $lineas = $texto.Substring(0, $fin) -split "`r`n"
    $partes = $lineas[0] -split ' '
    if ($partes.Count -ne 3 -or -not $partes[2].StartsWith('HTTP/1.', [System.StringComparison]::Ordinal)) {
        ResponderTexto $flujo 400 'peticion mal formada'
        Anotar '?' '?' 400 'peticion mal formada'
        return $true
    }
    $metodo = $partes[0]
    $ruta = ($partes[1] -split '\?', 2)[0]
    $cab = @{}
    for ($i = 1; $i -lt $lineas.Count; $i++) {
        $dp = $lineas[$i].IndexOf(':')
        if ($dp -gt 0) { $cab[$lineas[$i].Substring(0, $dp).Trim().ToLowerInvariant()] = $lineas[$i].Substring($dp + 1).Trim() }
    }
    # Otro Host es una pagina ajena que llega por DNS rebinding: fuera.
    if ($cab['host'] -ne $hostAdmitido) {
        ResponderTexto $flujo 403 'host no admitido'
        Anotar $metodo $ruta 403 'host no admitido'
        return $true
    }
    if ($metodo -ceq 'GET' -and $archivos.ContainsKey($ruta)) {
        $archivo = Join-Path $carpeta $archivos[$ruta][0]
        if (-not (Test-Path -LiteralPath $archivo -PathType Leaf)) {
            ResponderTexto $flujo 404 'falta el archivo'
            Anotar $metodo $ruta 404 ('falta {0} en la carpeta' -f $archivos[$ruta][0])
            return $true
        }
        Responder $flujo 200 $archivos[$ruta][1] ([System.IO.File]::ReadAllBytes($archivo))
        Anotar $metodo $ruta 200 ''
        return $true
    }
    if (-not ($metodo -ceq 'POST' -and $ruta -ceq '/resultado')) {
        ResponderTexto $flujo 404 'ruta no admitida'
        Anotar $metodo $ruta 404 ''
        return $true
    }
    # POST /resultado: primero el cuerpo entero (asi no queda nada sin leer al cerrar) y luego las comprobaciones.
    if ($cab['content-length'] -notmatch '^[0-9]{1,9}$') {
        ResponderTexto $flujo 400 'falta Content-Length'
        Anotar $metodo $ruta 400 'falta Content-Length'
        return $true
    }
    $largo = [int]$cab['content-length']
    if ($largo -gt $maxCuerpo) {
        ResponderTexto $flujo 413 'cuerpo de mas de 64 KiB'
        Anotar $metodo $ruta 413 'cuerpo de mas de 64 KiB'
        return $true
    }
    if ($datos.Length -lt $fin + 4 + $largo) { return $false }
    if ($cab.ContainsKey('origin') -and $cab['origin'] -ne $origenAdmitido) {
        ResponderTexto $flujo 403 'origen no admitido'
        Anotar $metodo $ruta 403 'origen no admitido'
        return $true
    }
    if ($cab['content-type'] -notmatch '^application/json\s*(;.*)?$') {
        ResponderTexto $flujo 415 'se espera application/json'
        Anotar $metodo $ruta 415 'se espera application/json'
        return $true
    }
    $cuerpo = New-Object byte[] $largo
    [System.Array]::Copy($datos, $fin + 4, $cuerpo, 0, $largo)
    $valido = $false
    try {
        $json = $utf8Estricto.GetString($cuerpo)
        if ($json.TrimStart().StartsWith('{', [System.StringComparison]::Ordinal)) {
            $null = ConvertFrom-Json -InputObject $json
            $valido = $true
        }
    } catch {
        $valido = $false
    }
    if (-not $valido) {
        ResponderTexto $flujo 400 'se espera un objeto JSON'
        Anotar $metodo $ruta 400 'no es un objeto JSON'
        return $true
    }
    while (Test-Path -LiteralPath (Join-Path $carpeta ('resultado-{0}.json' -f $script:siguiente))) { $script:siguiente++ }
    $nombre = 'resultado-{0}.json' -f $script:siguiente
    [System.IO.File]::WriteAllBytes((Join-Path $carpeta $nombre), $cuerpo)
    Responder $flujo 201 'application/json; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes('{"archivo":"' + $nombre + '"}'))
    Anotar $metodo $ruta 201 $nombre
    return $true
}

foreach ($v in $archivos.Values) {
    if (-not (Test-Path -LiteralPath (Join-Path $carpeta $v[0]) -PathType Leaf)) { Write-Host ('Aviso: falta {0} en {1}' -f $v[0], $carpeta) }
}
$escucha = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $puerto)
try {
    $escucha.Start()
} catch {
    Write-Host ('No se pudo abrir {0}: {1}' -f $hostAdmitido, $_.Exception.Message)
    exit 1
}
Write-Host ('Servidor de P6 en {0}/primitivas.html (solo 127.0.0.1). Carpeta: {1}' -f $origenAdmitido, $carpeta)
Write-Host 'Ctrl+C para pararlo.'
$clientes = New-Object System.Collections.ArrayList
$bufer = New-Object byte[] 8192
try {
    while ($true) {
        while ($escucha.Pending()) {
            $tcp = $escucha.AcceptTcpClient()
            $tcp.SendTimeout = 5000
            [void]$clientes.Add(@{ Tcp = $tcp; Datos = New-Object System.IO.MemoryStream; Desde = [DateTime]::UtcNow })
        }
        foreach ($c in @($clientes)) {
            $cerrar = $false
            try {
                $flujo = $c.Tcp.GetStream()
                $leidos = 0
                while ($flujo.DataAvailable -and $c.Datos.Length -le $maxCabecera + $maxCuerpo) {
                    $n = $flujo.Read($bufer, 0, $bufer.Length)
                    if ($n -le 0) { break }
                    $c.Datos.Write($bufer, 0, $n)
                    $leidos += $n
                }
                if ($leidos -gt 0) { $cerrar = Atender ($c.Datos.ToArray()) $flujo }
                if (-not $cerrar -and ([DateTime]::UtcNow - $c.Desde) -gt $maxEspera) { $cerrar = $true }
            } catch {
                Write-Host ('Conexion descartada: {0}' -f $_.Exception.Message)
                $cerrar = $true
            }
            if ($cerrar) {
                $c.Tcp.Close()
                $clientes.Remove($c)
            }
        }
        Start-Sleep -Milliseconds 20
    }
} finally {
    foreach ($c in @($clientes)) { $c.Tcp.Close() }
    $escucha.Stop()
    Write-Host 'Servidor parado.'
}
```

📍 Máquina de trabajo.

Ejecutar:

```sh
python3 -I -c 'import sys; b = open(sys.argv[1], "rb").read(); print("solo ASCII:", all(x < 128 for x in b), "| retornos de carro:", b.count(13), "| BOM:", b[:3] == b"\xef\xbb\xbf")' <banco>/p6/servidor.ps1
```

Esperado: `solo ASCII: True | retornos de carro: 0 | BOM: False`.

- [ ] **Paso 6: pasar el analizador de PowerShell**

El analizador de PowerShell 7.5 entiende también lo que no entiende la 5.1; por eso, además de los errores de sintaxis, la comprobación busca en el árbol lo que la 5.1 no tiene. Se prueba también con un control que sí lo lleva.

`<banco>/p6/prueba-sintaxis.ps1`:

```powershell
# P6 (H0b): comprueba un .ps1 con el analizador de PowerShell y busca lo que Windows PowerShell 5.1 no
# entiende (operadores ?? ?. ?[ && || y el ternario, y parametros que solo existen desde la 6 o la 7).
# Uso: pwsh -NoLogo -NoProfile -File prueba-sintaxis.ps1 <archivo.ps1>   (sale con 1 si encuentra algo)
$errores = $null
$tokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($args[0], [ref]$tokens, [ref]$errores)
'errores de sintaxis: {0}' -f $errores.Count
foreach ($e in $errores) { '  linea {0}: {1}' -f $e.Extent.StartLineNumber, $e.Message }
$solo7 = $ast.FindAll({
    param($n)
    $n -is [System.Management.Automation.Language.TernaryExpressionAst] -or
    $n -is [System.Management.Automation.Language.PipelineChainAst] -or
    ($n -is [System.Management.Automation.Language.BinaryExpressionAst] -and $n.Operator -eq 'QuestionQuestion') -or
    ($n -is [System.Management.Automation.Language.AssignmentStatementAst] -and $n.Operator -eq 'QuestionQuestionEquals') -or
    ($n -is [System.Management.Automation.Language.MemberExpressionAst] -and $n.NullConditional) -or
    ($n -is [System.Management.Automation.Language.IndexExpressionAst] -and $n.NullConditional) -or
    ($n -is [System.Management.Automation.Language.CommandParameterAst] -and
        $n.ParameterName -in 'AsByteStream', 'Parallel', 'AsHashtable', 'SkipCertificateCheck', 'SkipHttpErrorCheck')
}, $true)
'construcciones solo de PowerShell 6 o 7: {0}' -f @($solo7).Count
foreach ($n in $solo7) { '  linea {0}: {1}' -f $n.Extent.StartLineNumber, $n.Extent.Text }
if ($errores.Count -or @($solo7).Count) { exit 1 }
```

📍 Máquina de trabajo; las comprobaciones corren en contenedores efímeros sin red, con el volumen en solo lectura.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco'
docker exec -i vigia-build sh -c 'cat > /work/h0b/p6/control7.ps1' <<'EOF'
$a = $b ?? 1
Get-ChildItem && Get-Date
EOF
docker run --rm --network none --user 1001:1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro mcr.microsoft.com/powershell@sha256:042240d57ec9e47e511033b92625a8d95875ee5860af3015992c248b58a8be81 pwsh -NoLogo -NoProfile -File /work/banco/p6/prueba-sintaxis.ps1 /work/banco/p6/servidor.ps1; echo "salida: $?"
docker run --rm --network none --user 1001:1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro mcr.microsoft.com/powershell@sha256:042240d57ec9e47e511033b92625a8d95875ee5860af3015992c248b58a8be81 pwsh -NoLogo -NoProfile -File /work/banco/p6/prueba-sintaxis.ps1 /work/h0b/p6/control7.ps1; echo "salida: $?"
docker exec vigia-build rm /work/h0b/p6/control7.ps1
```

Esperado:

```
errores de sintaxis: 0
construcciones solo de PowerShell 6 o 7: 0
salida: 0
errores de sintaxis: 0
construcciones solo de PowerShell 6 o 7: 2
  linea 1: $b ?? 1
  linea 2: Get-ChildItem && Get-Date
salida: 1
```

- [ ] **Paso 7: el servidor pasa la prueba**

📍 Máquina de trabajo.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cp /work/banco/p6/servidor.ps1 /work/h0b/p6/servidor/'
docker exec -d p6-servidor sh -c 'exec pwsh -NoLogo -NoProfile -File /work/h0b/p6/servidor/servidor.ps1 > /work/h0b/p6/servidor/servidor.log 2>&1'
docker run --rm --network container:p6-servidor --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro vigia-build:h0b bash /work/banco/p6/prueba-servidor.sh /work/h0b/p6/servidor; echo "salida: $?"
docker exec vigia-build cat /work/h0b/p6/servidor/servidor.log
```

Esperado (en unos 2 s):

```
bien: GET /primitivas.html
bien: primitivas.html: los mismos bytes
bien: GET /primitivas.js
bien: primitivas.js: los mismos bytes
bien: GET /muestra.aac
bien: muestra.aac: los mismos bytes
bien: cabeceras no-store y close
bien: GET con consulta (?v=2)
bien: GET /
bien: GET /servidor.ps1
bien: GET /PRIMITIVAS.HTML
bien: GET /../servidor.ps1
bien: GET /resultado
bien: GET /resultado-1.json
bien: POST /primitivas.html
bien: Host ajeno
bien: cabecera de más de 16 KiB
bien: GET con otra conexión abierta y callada
bien: POST JSON
bien: respuesta del POST
bien: resultado-1.json: los mismos bytes
bien: POST JSON con Origin del propio servidor
bien: respuesta del segundo POST
bien: POST como text/plain
bien: POST desde otro origen
bien: POST con JSON roto
bien: POST con un JSON que no es objeto
bien: POST de más de 64 KiB
bien: POST con el cuerpo en otro envío
bien: archivos guardados
bien: escuchas en el puerto 8080
bien: escuchas IPv6 en el puerto 8080
servidor.ps1: todo bien
salida: 0
Servidor de P6 en http://127.0.0.1:8080/primitivas.html (solo 127.0.0.1). Carpeta: /work/h0b/p6/servidor
Ctrl+C para pararlo.
GET /primitivas.html -> 200
GET /primitivas.html -> 200
GET /primitivas.js -> 200
GET /muestra.aac -> 200
GET /primitivas.html -> 200
GET / -> 404
GET /servidor.ps1 -> 404
GET /PRIMITIVAS.HTML -> 404
GET /../servidor.ps1 -> 404
GET /resultado -> 404
GET /resultado-1.json -> 404
POST /primitivas.html -> 404
GET /primitivas.html -> 403 host no admitido
? ? -> 431 cabecera de mas de 16 KiB
GET /primitivas.js -> 200
POST /resultado -> 201 resultado-1.json
POST /resultado -> 201 resultado-2.json
POST /resultado -> 415 se espera application/json
POST /resultado -> 403 origen no admitido
POST /resultado -> 400 no es un objeto JSON
POST /resultado -> 400 no es un objeto JSON
POST /resultado -> 413 cuerpo de mas de 64 KiB
POST /resultado -> 201 resultado-3.json
```

- [ ] **Paso 8: Ctrl+C para el servidor y libera el puerto**

En el portátil, la persona responsable para el servidor con Ctrl+C. Aquí se le manda la misma señal (SIGINT) a `pwsh`: el bloque `finally` cierra las conexiones y la escucha.

📍 Máquina de trabajo.

Ejecutar:

```sh
docker exec p6-servidor sh -c 'for d in /proc/[0-9]*; do [ "$(cat $d/comm 2>/dev/null)" = pwsh ] && kill -INT ${d#/proc/}; done; sleep 2; tail -n 1 /work/h0b/p6/servidor/servidor.log; echo "escuchas en 8080: $(awk "\$4 == \"0A\" && \$2 ~ /:1F90\$/" /proc/net/tcp | wc -l)"'
```

Esperado:

```
Servidor parado.
escuchas en 8080: 0
```

- [ ] **Paso 9: escribir la spec de la página**

La spec de H0a pedía la página a `http.server` en el puerto 8000; ahora la sirve `servidor.ps1` en el 8080, con la etiqueta de cada motor en el fragmento, y comprueba también lo nuevo: el contexto seguro, que no está dentro de Telegram, el resumen, el envío y que el servidor lo guardó. Una segunda prueba comprueba que el ✓ de X25519 exige la clave importada: anula `importKey` con X25519 antes de que cargue la página y espera ✗ con el error del caso de RFC 7748; su envío lo contesta Playwright (`page.route`), así que no llega al servidor. Como el volumen va en solo lectura, la spec escribe en `/tmp` y Playwright deja sus salidas en `/tmp/test-results` (`--output`).

`<banco>/p6/primitivas.spec.mjs`:

```js
// P6: primitivas de WebCrypto y decodificación ADTS en los tres motores, con la página servida por
// servidor.ps1 en 127.0.0.1:8080 (el mismo servidor que usa el portátil con adb reverse).
// El volumen de trabajo va en solo lectura: lo que escribe la spec va a /tmp.
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

// X25519 y ADTS se anotan sin bloquear: tienen plan B (@noble/curves) y se miden en navegadores reales en H0b.
const OBLIGATORIAS = ['aesgcm', 'hkdf', 'ecdsa'];

test('primitivas', async ({ page, browserName }) => {
  await page.goto(`http://127.0.0.1:8080/primitivas.html#${browserName}`);
  await page.waitForFunction(() => window.envioPrimitivas !== undefined);
  const informe = await page.evaluate(() => window.informeP6);
  const envio = await page.evaluate(() => window.envioPrimitivas);
  writeFileSync(`/tmp/resultado-${browserName}.json`, JSON.stringify({ informe, envio }, null, 2));
  expect(informe.pagina).toBe('p6-h0b');
  expect(informe.etiqueta).toBe(browserName);
  expect(informe.seguro).toBe(true);
  expect(informe.webviewTelegram).toBe(false);
  expect(informe.userAgent).toBe(await page.evaluate(() => navigator.userAgent));
  expect(Object.keys(informe.primitivas)).toEqual(['x25519', 'aesgcm', 'hkdf', 'ecdsa', 'adts']);
  expect(envio.estado, `envío en ${browserName}: ${envio.error ?? ''}`).toBe(201);
  expect(envio.archivo).toMatch(/^resultado-\d+\.json$/);
  const bien = Object.values(informe.primitivas).filter((p) => p.ok).length;
  await expect(page.getByTestId('resumen')).toHaveText(new RegExp(`^${bien} de 5 ✓`));
  await expect(page.getByTestId('envio')).toHaveText(`Guardado en el portátil: ${envio.archivo}`);
  await expect(page.getByTestId('seguro')).toHaveText('sí');
  for (const n of OBLIGATORIAS) expect(informe.primitivas[n].ok, `${n} en ${browserName}: ${informe.primitivas[n].detalle}`).toBe(true);
});

// El ✓ de X25519 exige también el caso de RFC 7748 con la clave importada, que es lo que hará la bóveda:
// si importKey falla con X25519, la página da ✗. Su envío lo contesta Playwright y no llega al servidor.
test('x25519 exige la clave importada', async ({ page, browserName }) => {
  await page.addInitScript(() => {
    const importar = crypto.subtle.importKey.bind(crypto.subtle);
    crypto.subtle.importKey = (formato, datos, algoritmo, ...resto) => ((algoritmo?.name ?? algoritmo) === 'X25519'
      ? Promise.reject(new Error('importación anulada por la prueba'))
      : importar(formato, datos, algoritmo, ...resto));
  });
  await page.route('**/resultado', (ruta) => ruta.fulfill({ status: 201, json: { archivo: 'resultado-0.json' } }));
  await page.goto(`http://127.0.0.1:8080/primitivas.html#${browserName}`);
  await page.waitForFunction(() => window.resultadosPrimitivas !== undefined);
  const x25519 = await page.evaluate(() => window.resultadosPrimitivas.x25519);
  expect(x25519.ok, `x25519 en ${browserName} sin importar la clave`).toBe(false);
  expect(x25519.detalle).toContain('RFC 7748');
});
```

- [ ] **Paso 10: ver que la spec falla con la página de H0a**

La carpeta del servidor sigue teniendo la página de H0a, que no envía nada: en los tres motores, `primitivas` espera a `window.envioPrimitivas` hasta agotar los 30 s, y `x25519 exige la clave importada` falla porque la página de H0a da ✓ sin importar ninguna clave. Antes se borran los resultados que dejó la prueba del paso 7, para que en la carpeta solo queden los de Playwright.

📍 Máquina de trabajo; `npm ci` corre dentro de `vigia-build` (con red, desde el lockfile de H0a) y Playwright, en un contenedor que comparte la red del servidor.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && rm -f /work/h0b/p6/servidor/resultado-*.json && cd /work/banco/p6 && npm ci --ignore-scripts > /dev/null && echo "npm ci: $?"'
docker exec -d p6-servidor sh -c 'exec pwsh -NoLogo -NoProfile -File /work/h0b/p6/servidor/servidor.ps1 > /work/h0b/p6/servidor/servidor.log 2>&1'
docker run --rm --network container:p6-servidor --user 1001:1001 --cap-drop ALL --security-opt no-new-privileges -e HOME=/tmp -v vigia-trabajo:/work:ro -w /work/banco/p6 mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 sh -c 'npx playwright test --output=/tmp/test-results > /tmp/p6.log 2>&1; echo "salida: $?"; tail -n 7 /tmp/p6.log'
```

Esperado (en unos 35 s; el orden de los motores puede cambiar):

```
npm ci: 0
salida: 1
  6 failed
    [chromium] › primitivas.spec.mjs:10:1 › primitivas ─────────────────────────────────────────────
    [chromium] › primitivas.spec.mjs:33:1 › x25519 exige la clave importada ────────────────────────
    [firefox] › primitivas.spec.mjs:10:1 › primitivas ──────────────────────────────────────────────
    [firefox] › primitivas.spec.mjs:33:1 › x25519 exige la clave importada ─────────────────────────
    [webkit] › primitivas.spec.mjs:10:1 › primitivas ───────────────────────────────────────────────
    [webkit] › primitivas.spec.mjs:33:1 › x25519 exige la clave importada ──────────────────────────
```

- [ ] **Paso 11: escribir la página**

Las cinco pruebas son las de H0a, y X25519 suma lo que hará la bóveda con la clave del contacto: el caso de RFC 7748, sección 6.1, en el que la privada de Alice, importada en PKCS #8 y no extraíble, y la pública de Bob, en crudo, dan el secreto publicado. El ✓ de X25519 exige las dos pruebas, y un fallo del caso conocido sale como `RFC 7748 (6.1): …`. Lo demás nuevo: cada primitiva tiene un límite de 10 s (una que no responde no deja la página sin resumen ni envío), el resumen grande se lee en una captura del teléfono (`meta viewport` y colores fijos), el texto siempre entra con `textContent` (nunca HTML) y el envío del resultado. El navegador interno de Telegram reescribe su userAgent para que parezca Chrome (quita `; wv`, el modelo y `Version/`; código de Telegram Android, `BotWebViewContainer.java`), pero siempre inyecta el puente `TelegramWebviewProxy`: la página anota si está.

`<banco>/p6/primitivas.html`:

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Primitivas</title>
<style>
  body { margin: 16px; font: 18px/1.4 system-ui, sans-serif; color: #111; background: #fff; }
  h1 { margin: 0 0 12px; font-size: 1.2rem; }
  #resumen { margin: 0 0 12px; padding: 12px 16px; border-radius: 8px; font-size: 2.2rem; font-weight: 700; background: #e4e4e4; }
  #resumen.bien { background: #bfe8bf; }
  #resumen.mal { background: #f4bcbc; }
  ul { margin: 0 0 12px; padding: 0; list-style: none; font-size: 1.2rem; }
  li { overflow-wrap: anywhere; }
  #envio { margin: 0 0 12px; font-weight: 700; }
  dt { font-weight: 700; }
  dd { margin: 0 0 8px; overflow-wrap: anywhere; }
  #ua, #marcas { font: 14px/1.3 ui-monospace, monospace; }
</style>
</head>
<body>
<h1>P6: primitivas del navegador</h1>
<p id="resumen" data-testid="resumen">Si este texto no cambia, el JavaScript de la página no se ejecutó.</p>
<ul id="resultados"></ul>
<p id="envio" data-testid="envio"></p>
<dl>
  <dt>Navegador anotado</dt><dd id="etiqueta"></dd>
  <dt>Contexto seguro (isSecureContext)</dt><dd id="seguro" data-testid="seguro"></dd>
  <dt>Dentro del navegador de Telegram (TelegramWebviewProxy)</dt><dd id="telegram"></dd>
  <dt>navigator.userAgent</dt><dd id="ua"></dd>
  <dt>navigator.userAgentData</dt><dd id="marcas"></dd>
</dl>
<script type="module" src="primitivas.js"></script>
</body>
</html>
```

`<banco>/p6/primitivas.js`:

```js
// P6 (H0b): las primitivas que necesita la bóveda, en el navegador real. Una línea por primitiva con ✓ o ✗
// y su error, un resumen grande para la captura y el resultado en JSON por POST a /resultado del mismo
// origen (servidor.ps1 lo guarda en el portátil). El navegador se anota en el fragmento de la URL
// (#chrome, #samsung, #mi o #telegram, con -act tras actualizarlo), que no llega al servidor.
// El navegador interno de Telegram reescribe el userAgent para que parezca Chrome, pero siempre inyecta
// el puente TelegramWebviewProxy: su presencia es lo que distingue ese navegador de una pestaña de Chrome.
const sutil = crypto.subtle;
const igual = (a, b) => {
  const x = new Uint8Array(a), y = new Uint8Array(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
const texto = (s) => new TextEncoder().encode(s);
const bytes = (hex) => Uint8Array.from(hex.match(/../g), (b) => parseInt(b, 16));
// RFC 7748, sección 6.1: la privada de Alice (aquí dentro de su PKCS #8), la pública de Bob y el secreto que acuerdan.
const RFC7748 = {
  privada: '302e020100300506032b656e04220420' + '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a',
  publica: 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f',
  compartido: '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742',
};

const pruebas = {
  async x25519() {
    // Como en H0a: dos claves generadas acuerdan el mismo secreto.
    const a = await sutil.generateKey({ name: 'X25519' }, false, ['deriveBits']);
    const b = await sutil.generateKey({ name: 'X25519' }, false, ['deriveBits']);
    const s1 = await sutil.deriveBits({ name: 'X25519', public: b.publicKey }, a.privateKey, 256);
    const s2 = await sutil.deriveBits({ name: 'X25519', public: a.publicKey }, b.privateKey, 256);
    if (!igual(s1, s2)) return false;
    // Y lo que hará la bóveda: la privada importada, no extraíble, y la pública en crudo dan el secreto
    // publicado. El ✓ exige las dos pruebas.
    try {
      const privada = await sutil.importKey('pkcs8', bytes(RFC7748.privada), { name: 'X25519' }, false, ['deriveBits']);
      const publica = await sutil.importKey('raw', bytes(RFC7748.publica), { name: 'X25519' }, true, []);
      const secreto = await sutil.deriveBits({ name: 'X25519', public: publica }, privada, 256);
      if (!igual(secreto, bytes(RFC7748.compartido))) throw new Error('otro secreto');
    } catch (e) {
      throw new Error(`RFC 7748 (6.1): ${e?.message ?? e}`);
    }
    return true;
  },
  async aesgcm() {
    const k = await sutil.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await sutil.encrypt({ name: 'AES-GCM', iv }, k, texto('hola'));
    return igual(await sutil.decrypt({ name: 'AES-GCM', iv }, k, ct), texto('hola'));
  },
  async hkdf() {
    const base = await sutil.importKey('raw', new Uint8Array(32), 'HKDF', false, ['deriveBits']);
    const bits = await sutil.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(16), info: new Uint8Array(0) }, base, 256);
    return bits.byteLength === 32;
  },
  async ecdsa() {
    const k = await sutil.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const firma = await sutil.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.privateKey, texto('m'));
    return sutil.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.publicKey, firma, texto('m'));
  },
  async adts() {
    const datos = await (await fetch('muestra.aac')).arrayBuffer();
    const audio = await new AudioContext().decodeAudioData(datos);
    return audio.duration > 3.5 && audio.numberOfChannels === 1;
  },
};

// Una primitiva que no responde no puede dejar la página sin resumen ni envío.
const LIMITE_MS = 10000;
const conLimite = (promesa) => {
  let reloj;
  const limite = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(`sin respuesta en ${LIMITE_MS / 1000} s`)), LIMITE_MS);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
};
const mostrar = (id, valor) => { document.getElementById(id).textContent = valor; };

const etiqueta = location.hash.slice(1).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
const marcas = navigator.userAgentData?.brands?.map((m) => `${m.brand} ${m.version}`) ?? null;
const webviewTelegram = typeof window.TelegramWebviewProxy !== 'undefined';
mostrar('etiqueta', etiqueta || '(ninguno)');
mostrar('seguro', window.isSecureContext ? 'sí' : 'no');
mostrar('telegram', webviewTelegram ? 'sí' : 'no');
mostrar('ua', navigator.userAgent);
mostrar('marcas', marcas ? marcas.join(', ') : '(no lo tiene)');

const resultados = {};
const lista = document.getElementById('resultados');
for (const [nombre, prueba] of Object.entries(pruebas)) {
  let ok = false;
  let detalle = '';
  try {
    ok = Boolean(await conLimite(prueba()));
    if (!ok) detalle = 'resultado incorrecto';
  } catch (e) {
    detalle = String(e?.message ?? e);
  }
  resultados[nombre] = { ok, detalle };
  const li = document.createElement('li');
  li.setAttribute('data-testid', nombre);
  li.textContent = `${ok ? '✓' : '✗'} ${nombre}${detalle ? `: ${detalle}` : ''}`;
  lista.append(li);
}
window.resultadosPrimitivas = resultados;

const nombres = Object.keys(resultados);
const fallan = nombres.filter((n) => !resultados[n].ok);
const resumen = document.getElementById('resumen');
resumen.textContent = `${nombres.length - fallan.length} de ${nombres.length} ✓${fallan.length ? `, falla ${fallan.join(', ')}` : ''}`;
resumen.className = fallan.length ? 'mal' : 'bien';

const informe = {
  pagina: 'p6-h0b', etiqueta, seguro: window.isSecureContext, webviewTelegram,
  userAgent: navigator.userAgent, marcas, primitivas: resultados,
};
window.informeP6 = informe;
try {
  const respuesta = await fetch('/resultado', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(informe),
    cache: 'no-store',
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  window.envioPrimitivas = { estado: respuesta.status, archivo: cuerpo.archivo ?? null };
  mostrar('envio', respuesta.status === 201 ? `Guardado en el portátil: ${cuerpo.archivo}` : `✗ No se guardó: HTTP ${respuesta.status}`);
} catch (e) {
  window.envioPrimitivas = { estado: 0, archivo: null, error: String(e?.message ?? e) };
  mostrar('envio', `✗ No se guardó: ${window.envioPrimitivas.error}`);
}
```

- [ ] **Paso 12: la página pasa en los tres motores, servida por `servidor.ps1`**

📍 Máquina de trabajo.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cp /work/banco/p6/primitivas.html /work/banco/p6/primitivas.js /work/h0b/p6/servidor/'
docker run --rm --network container:p6-servidor --user 1001:1001 --cap-drop ALL --security-opt no-new-privileges -e HOME=/tmp -v vigia-trabajo:/work:ro -w /work/banco/p6 mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 sh -c 'npx playwright test --output=/tmp/test-results > /tmp/p6.log 2>&1; echo "salida: $?"; tail -n 9 /tmp/p6.log'
docker exec vigia-build sh -c 'cd /work/h0b/p6/servidor && ls resultado-*.json && grep -c "^POST /resultado -> 201" servidor.log'
```

Esperado (el orden de los motores puede cambiar):

```
salida: 0

  ✓  3 [chromium] › primitivas.spec.mjs:10:1 › primitivas (…)
  ✓  4 [chromium] › primitivas.spec.mjs:33:1 › x25519 exige la clave importada (…)
  ✓  1 [webkit] › primitivas.spec.mjs:10:1 › primitivas (…)
  ✓  5 [webkit] › primitivas.spec.mjs:33:1 › x25519 exige la clave importada (…)
  ✓  2 [firefox] › primitivas.spec.mjs:10:1 › primitivas (…)
  ✓  6 [firefox] › primitivas.spec.mjs:33:1 › x25519 exige la clave importada (…)

  6 passed (…)
resultado-1.json
resultado-2.json
resultado-3.json
3
```

Los tres resultados son los de `primitivas`: los envíos de la otra prueba no llegan al servidor. Cada motor deja también su `resultado-<motor>.json`, como en H0a, pero en el `/tmp` de su contenedor, que desaparece con él: lo que cuenta es lo que guardó el servidor, que lee el paso 15. Con Chromium 153, Firefox 155 y WebKit 26.6 de esta imagen, las cinco primitivas dan ✓ en los tres (15 de 15, como en H0a), X25519 ya con el caso de RFC 7748.

- [ ] **Paso 13: escribir las pruebas del análisis y ver que fallan**

El análisis de la sesión 3 clasifica cada resultado por su userAgent y su puente de Telegram, lo cruza con la etiqueta, lee las versiones de `dumpsys`, comprueba las capturas y dice qué navegadores tienen X25519 en su última medida. Cambiar el ajuste de Telegram es opcional: si el enlace se abrió fuera de su navegador y no hay otra medida, el navegador interno queda «sin medir» y P6 sigue completo. Nunca imprime el userAgent, que lleva el modelo del teléfono.

`<banco>/p6/prueba_analizar.py`:

```python
"""Pruebas de analizar.py (P6, H0b). Solo biblioteca estándar.

Uso: python3 -I -B prueba_analizar.py
"""
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout

_ruta = pathlib.Path(__file__).with_name('analizar.py')
_spec = importlib.util.spec_from_file_location('analizar', _ruta)
analizar = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(analizar)

MODELO = '2201117TG'
UA = {
    'chrome': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) '
              'Chrome/141.0.0.0 Mobile Safari/537.36',
    'samsung28': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) '
                 'SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
    'samsung29': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) '
                 'SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36',
    'mi': f'Mozilla/5.0 (Linux; U; Android 12; es-es; {MODELO} Build/SKQ1.211103.001) AppleWebKit/537.36 '
          '(KHTML, like Gecko) Version/4.0 Chrome/112.0.5615.136 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.2.2-gn',
    'mi_act': f'Mozilla/5.0 (Linux; U; Android 12; es-es; {MODELO} Build/SKQ1.211103.001) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Version/4.0 Chrome/136.0.7103.125 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.40.1-gn',
    # El navegador interno de Telegram quita "; wv", el modelo y "Version/" del userAgent del WebView.
    'telegram': 'Mozilla/5.0 (Linux; Android 12; K) AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/141.0.7390.122 Mobile Safari/537.36',
    # En las mini apps añade además su versión y el modelo.
    'telegram_bot': 'Mozilla/5.0 (Linux; Android 12; K) AppleWebKit/537.36 (KHTML, like Gecko) '
                    f'Chrome/141.0.7390.122 Mobile Safari/537.36 Telegram-Android/12.8.0 (Xiaomi {MODELO}; '
                    'Android 12; SDK 31; AVERAGE)',
    'webview': f'Mozilla/5.0 (Linux; Android 12; {MODELO} Build/SKQ1.211103.001; wv) AppleWebKit/537.36 '
               '(KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.122 Mobile Safari/537.36',
    'firefox': 'Mozilla/5.0 (Android 12; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0',
}
VERSIONES = """== com.android.chrome
    versionName=141.0.7390.122
    versionName=120.0.6099.230
== com.sec.android.app.sbrowser
    versionName=28.0.3.59
== com.mi.globalbrowser
== com.android.browser
== org.telegram.messenger
    versionName=12.8.0
== org.telegram.messenger.web
== com.google.android.webview
    versionName=141.0.7390.122
== webviewupdate
Current WebView package (name, version): (com.google.android.webview, 141.0.7390.122)
"""
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 16


def resultado(etiqueta, ua, falla=None, seguro=True, telegram=False, marcas=None):
    primitivas = {n: {'ok': n != falla, 'detalle': 'Algorithm: Unrecognized name.' if n == falla else ''}
                  for n in analizar.PRIMITIVAS}
    return {'pagina': 'p6-h0b', 'etiqueta': etiqueta, 'seguro': seguro, 'webviewTelegram': telegram,
            'userAgent': ua, 'marcas': marcas, 'primitivas': primitivas}


class Sesion:
    """Carpeta temporal con lo que sube la persona responsable tras la sesión."""

    def __init__(self, resultados, versiones=None, capturas=()):
        self.tmp = tempfile.TemporaryDirectory()
        self.carpeta = pathlib.Path(self.tmp.name)
        for n, r in enumerate(resultados, start=1):
            texto = r if isinstance(r, str) else json.dumps(r)
            (self.carpeta / f'resultado-{n}.json').write_text(texto, encoding='utf-8')
        for nombre, texto in (versiones or {}).items():
            (self.carpeta / nombre).write_text(texto, encoding='utf-8')
        for nombre in capturas:
            (self.carpeta / nombre).write_bytes(PNG)

    def informe(self):
        salida = io.StringIO()
        with redirect_stdout(salida), redirect_stderr(salida):
            codigo = analizar.main([str(self.carpeta)])
        self.tmp.cleanup()
        return codigo, salida.getvalue()


class Navegador(unittest.TestCase):
    def test_cada_navegador_por_su_user_agent(self):
        casos = {
            'chrome': ('chrome', 'Chrome 141', 'Chromium 141'),
            'samsung28': ('samsung', 'Samsung Internet 28.0', 'Chromium 130'),
            'mi': ('mi', 'Mi Browser 14.2.2-gn', 'Chromium 112'),
            'telegram_bot': ('telegram', 'Telegram 12.8.0, navegador interno', 'WebView 141'),
            'webview': ('webview', 'WebView de otra app', 'WebView 141'),
            'firefox': ('firefox', 'Firefox 143.0', 'Gecko'),
        }
        for clave, esperado in casos.items():
            with self.subTest(clave):
                n = analizar.navegador(UA[clave])
                self.assertEqual((n['tipo'], n['nombre'], n['motor']), esperado)

    def test_el_navegador_interno_de_telegram_se_reconoce_por_su_puente(self):
        n = analizar.navegador(UA['telegram'], webview_telegram=True)
        self.assertEqual((n['tipo'], n['nombre'], n['motor']), ('telegram', 'Telegram, navegador interno', 'WebView 141'))
        self.assertEqual(analizar.navegador(UA['telegram'])['tipo'], 'chrome')

    def test_un_webview_se_reconoce_tambien_por_su_marca(self):
        self.assertEqual(analizar.navegador(UA['chrome'], marcas=['Android WebView 141', 'Chromium 141'])['tipo'], 'webview')

    def test_user_agent_desconocido(self):
        self.assertEqual(analizar.navegador('curl/8.5.0')['tipo'], 'otro')


class Versiones(unittest.TestCase):
    def test_lee_la_primera_version_de_cada_paquete_y_el_webview_activo(self):
        v = analizar.leer_versiones(VERSIONES)
        self.assertEqual(v['paquetes']['com.android.chrome'], '141.0.7390.122')
        self.assertEqual(v['paquetes']['com.sec.android.app.sbrowser'], '28.0.3.59')
        self.assertIsNone(v['paquetes']['com.mi.globalbrowser'])
        self.assertEqual(v['webview'], 'com.google.android.webview 141.0.7390.122')


class Informe(unittest.TestCase):
    def test_sesion_completa_con_actualizacion_y_telegram_fuera_y_dentro(self):
        # Samsung Internet, instalado desde Google Play en su versión del día; Mi Browser, como venía y actualizado.
        antes = VERSIONES.replace('28.0.3.59', '29.0.0.12').replace(
            '== com.mi.globalbrowser\n', '== com.mi.globalbrowser\n    versionName=14.2.2-gn\n')
        codigo, texto = Sesion(
            [resultado('chrome', UA['chrome']),
             resultado('samsung', UA['samsung29']),
             resultado('mi', UA['mi'], falla='x25519'),
             resultado('telegram', UA['chrome']),
             resultado('telegram', UA['telegram'], telegram=True),
             resultado('mi-act', UA['mi_act'])],
            versiones={'p6-versiones.txt': antes, 'p6-versiones-act.txt': antes.replace('14.2.2-gn', '14.40.1-gn')},
            capturas=['p6-chrome.png', 'p6-samsung.png', 'p6-mi.png', 'p6-telegram-ajuste.png', 'p6-telegram.png',
                      'p6-telegram-interno.png', 'p6-mi-act.png'],
        ).informe()
        self.assertEqual(codigo, 0)
        self.assertIn('| resultado-3.json | mi | Mi Browser 14.2.2-gn | Chromium 112 | sí | ✗ | ✓ | ✓ | ✓ | ✓ |', texto)
        self.assertIn('- resultado-3.json, x25519: Algorithm: Unrecognized name.', texto)
        self.assertIn('| com.sec.android.app.sbrowser | 29.0.0.12 | 29.0.0.12 |', texto)
        self.assertIn('| com.mi.globalbrowser | 14.2.2-gn | 14.40.1-gn |', texto)
        self.assertIn('- 7 capturas PNG: p6-chrome.png, p6-mi-act.png, p6-mi.png, p6-samsung.png, p6-telegram-ajuste.png, '
                      'p6-telegram-interno.png, p6-telegram.png', texto)
        self.assertIn('- Samsung Internet: Samsung Internet 29.0 (Chromium 136), 5 de 5 ✓ (resultado-2.json).', texto)
        self.assertIn('- Telegram abrió el enlace fuera de su navegador en resultado-4.json (userAgent de Chrome 141): '
                      'mira su captura y el ajuste del navegador de Telegram.', texto)
        self.assertIn('- Navegador interno de Telegram: Telegram, navegador interno (WebView 141), 5 de 5 ✓ '
                      '(resultado-5.json).', texto)
        self.assertIn('- Mi Browser: Mi Browser 14.2.2-gn (Chromium 112), falla x25519 (resultado-3.json); '
                      'tras actualizar: Mi Browser 14.40.1-gn (Chromium 136), 5 de 5 ✓ (resultado-6.json).', texto)
        self.assertIn('- P6 en el teléfono: completo (Chrome, Samsung Internet y el navegador interno de Telegram).', texto)
        self.assertIn('- X25519 en WebCrypto hoy (última medida de cada navegador): ✓ en Chrome (Chromium 141), '
                      'Samsung Internet (Chromium 136), el navegador interno de Telegram (WebView 141) y Mi Browser '
                      '(Chromium 136).', texto)
        self.assertIn('- Primitivas: ✓ en todos los navegadores en su última medida; antes de actualizar, '
                      'falla x25519 en Mi Browser 14.2.2-gn.', texto)

    def test_telegram_fuera_de_su_navegador_sin_cambiar_el_ajuste(self):
        # Cambiar el ajuste de Telegram es opcional: sin él, el navegador interno queda sin medir y se acepta.
        _, texto = Sesion([resultado('chrome', UA['chrome']), resultado('samsung', UA['samsung29']),
                           resultado('telegram', UA['chrome'])]).informe()
        self.assertIn('- Navegador interno de Telegram: sin medir (Telegram abrió el enlace fuera de su navegador).', texto)
        self.assertIn('- P6 en el teléfono: completo (Chrome, Samsung Internet y el enlace desde Telegram, que se abrió '
                      'fuera de su navegador: el navegador interno de Telegram queda sin medir).', texto)

    def test_no_imprime_el_user_agent_ni_el_modelo(self):
        _, texto = Sesion([resultado('mi', UA['mi']), resultado('telegram', UA['telegram_bot'])]).informe()
        self.assertNotIn(MODELO, texto)
        self.assertNotIn('Mozilla/5.0', texto)

    def test_sesion_incompleta(self):
        _, texto = Sesion([resultado('chrome', UA['chrome'])]).informe()
        self.assertIn('- P6 en el teléfono: incompleto, falta Samsung Internet y el enlace desde Telegram.', texto)
        self.assertIn('- X25519 en WebCrypto hoy (última medida de cada navegador): ✓ en Chrome (Chromium 141).', texto)
        self.assertIn('- Primitivas: ✓ en todos los navegadores en su última medida.', texto)

    def test_sin_ningun_navegador_del_telefono_ni_capturas(self):
        _, texto = Sesion([resultado('chromium', UA['chrome'])]).informe()
        self.assertIn('- P6 en el teléfono: incompleto, falta Chrome, Samsung Internet y el enlace desde Telegram.', texto)
        self.assertNotIn('X25519 en WebCrypto hoy', texto)
        self.assertIn('- 0 capturas PNG.', texto)

    def test_falla_sin_actualizar(self):
        _, texto = Sesion([resultado('samsung', UA['samsung28'], falla='x25519')]).informe()
        self.assertIn('- X25519 en WebCrypto hoy (última medida de cada navegador): ✗ en Samsung Internet (Chromium 130).',
                      texto)
        self.assertIn('- Primitivas: ✗ en su última medida: x25519 en Samsung Internet 28.0.', texto)

    def test_contexto_no_seguro_no_vale(self):
        _, texto = Sesion([resultado('chrome', UA['chrome'], seguro=False)]).informe()
        self.assertIn('- ✗ resultado-1.json: contexto no seguro, la medida no vale '
                      '(¿se abrió por otra dirección que 127.0.0.1?).', texto)
        self.assertIn('- Chrome: sin medir.', texto)

    def test_etiqueta_que_no_cuadra_con_el_user_agent(self):
        _, texto = Sesion([resultado('samsung', UA['chrome'])]).informe()
        self.assertIn('- ✗ resultado-1.json: la etiqueta samsung no cuadra con el userAgent (Chrome 141).', texto)

    def test_archivo_que_no_es_un_resultado(self):
        codigo, texto = Sesion(['{"otra":1}', 'esto no es JSON', resultado('chrome', UA['chrome'])]).informe()
        self.assertEqual(codigo, 0)
        self.assertIn('- ✗ resultado-1.json: no es un resultado de la página de P6.', texto)
        self.assertIn('- ✗ resultado-2.json: no es un resultado de la página de P6.', texto)
        self.assertIn('| resultado-3.json | chrome | Chrome 141 |', texto)

    def test_textos_raros_no_rompen_el_markdown(self):
        r = resultado('chr|ome\n', UA['chrome'], falla='hkdf')
        r['primitivas']['hkdf']['detalle'] = 'linea 1\n| linea 2'
        _, texto = Sesion([r, '[' * 50000]).informe()
        self.assertIn('| resultado-1.json | chrome | Chrome 141 |', texto)
        self.assertIn('- resultado-1.json, hkdf: linea 1 / linea 2', texto)
        self.assertIn('- ✗ resultado-2.json: no es un resultado de la página de P6.', texto)

    def test_captura_que_no_es_png(self):
        sesion = Sesion([resultado('chrome', UA['chrome'])], capturas=['p6-chrome.png'])
        (sesion.carpeta / 'p6-mal.png').write_bytes(b'texto')
        _, texto = sesion.informe()
        self.assertIn('- ✗ p6-mal.png no es un PNG.', texto)

    def test_carpeta_sin_resultados(self):
        codigo, texto = Sesion([]).informe()
        self.assertEqual(codigo, 2)
        self.assertIn('no hay ningún resultado-*.json', texto)


if __name__ == '__main__':
    unittest.main(verbosity=1)
```

📍 Máquina de trabajo (biblioteca estándar, `python3 -I`).

Ejecutar:

```sh
python3 -I -B <banco>/p6/prueba_analizar.py 2>&1 | tail -n 1; python3 -I -B <banco>/p6/prueba_analizar.py > /dev/null 2>&1; echo "salida: $?"
```

Esperado:

```
FileNotFoundError: [Errno 2] No such file or directory: '<banco>/p6/analizar.py'
salida: 1
```

- [ ] **Paso 14: escribir el análisis**

`<banco>/p6/analizar.py`:

```python
"""P6 (H0b): análisis de la sesión del teléfono. Lee lo que subió la persona responsable (los
resultado-<n>.json que guardó servidor.ps1, p6-versiones*.txt de dumpsys y las capturas p6-*.png) e imprime
en markdown una fila por medida, las versiones, las capturas y el veredicto, con qué navegadores tienen
X25519 en WebCrypto en su última medida. Solo biblioteca estándar; no imprime el userAgent (lleva el modelo
del teléfono), solo el navegador que se deduce de él.

Uso: python3 -I -B analizar.py <carpeta de la sesión>
"""
import json
import pathlib
import re
import sys

PRIMITIVAS = ('x25519', 'aesgcm', 'hkdf', 'ecdsa', 'adts')
CABECERAS = ('X25519', 'AES-GCM', 'HKDF', 'ECDSA', 'ADTS')
# Etiqueta del fragmento de la URL -> tipo de navegador que debe dar el userAgent y nombre en el veredicto.
ESPERADOS = {
    'chrome': ('chrome', 'Chrome'),
    'samsung': ('samsung', 'Samsung Internet'),
    'telegram': ('telegram', 'Navegador interno de Telegram'),
    'mi': ('mi', 'Mi Browser'),
}
OBLIGATORIOS = ('chrome', 'samsung', 'telegram')
PAQUETES = ('com.android.chrome', 'com.sec.android.app.sbrowser', 'com.mi.globalbrowser', 'com.android.browser',
            'org.telegram.messenger', 'org.telegram.messenger.web', 'com.google.android.webview')
PNG = b'\x89PNG\r\n\x1a\n'


def _version(ua, patron):
    m = re.search(patron, ua)
    return m.group(1) if m else '?'


def navegador(ua, marcas=None, webview_telegram=False):
    """Tipo, nombre y motor del navegador (sin el modelo del teléfono). El navegador interno de Telegram
    reescribe el userAgent para que parezca Chrome: se reconoce por su puente TelegramWebviewProxy."""
    chromium = _version(ua, r'Chrome/(\d+)')
    if webview_telegram or 'Telegram-Android/' in ua:
        version = _version(ua, r'Telegram-Android/([0-9.]+)')
        nombre = 'Telegram, navegador interno' if version == '?' else f'Telegram {version}, navegador interno'
        return {'tipo': 'telegram', 'nombre': nombre, 'motor': f'WebView {chromium}'}
    if 'SamsungBrowser/' in ua:
        return {'tipo': 'samsung', 'nombre': f"Samsung Internet {_version(ua, r'SamsungBrowser/([0-9.]+)')}",
                'motor': f'Chromium {chromium}'}
    if 'MiuiBrowser/' in ua:
        return {'tipo': 'mi', 'nombre': f"Mi Browser {_version(ua, r'MiuiBrowser/([0-9A-Za-z.-]+)')}",
                'motor': f'Chromium {chromium}'}
    if '; wv)' in ua or any(str(m).startswith('Android WebView') for m in marcas or []):
        return {'tipo': 'webview', 'nombre': 'WebView de otra app', 'motor': f'WebView {chromium}'}
    if 'Firefox/' in ua:
        return {'tipo': 'firefox', 'nombre': f"Firefox {_version(ua, r'Firefox/([0-9.]+)')}", 'motor': 'Gecko'}
    if 'Chrome/' in ua:
        return {'tipo': 'chrome', 'nombre': f'Chrome {chromium}', 'motor': f'Chromium {chromium}'}
    return {'tipo': 'otro', 'nombre': 'otro navegador', 'motor': '?'}


def leer_versiones(texto):
    """Primera versionName de cada paquete (None si no está) y el WebView activo, de la salida de dumpsys."""
    paquetes, actual = {}, None
    for linea in texto.splitlines():
        if linea.startswith('== '):
            actual = linea[3:].strip()
            paquetes.setdefault(actual, None)
            continue
        m = re.search(r'versionName=(\S+)', linea)
        if m and actual and paquetes.get(actual) is None:
            paquetes[actual] = m.group(1)
    m = re.search(r'Current WebView package \(name, version\): \(([^,]+), ([^)]+)\)', texto)
    return {'paquetes': paquetes, 'webview': f'{m.group(1)} {m.group(2)}' if m else None}


def _es_resultado(d):
    return (isinstance(d, dict) and d.get('pagina') == 'p6-h0b' and isinstance(d.get('etiqueta'), str)
            and isinstance(d.get('seguro'), bool) and isinstance(d.get('webviewTelegram'), bool)
            and isinstance(d.get('userAgent'), str) and isinstance(d.get('marcas'), (list, type(None)))
            and isinstance(d.get('primitivas'), dict)
            and all(isinstance(d['primitivas'].get(n), dict) and isinstance(d['primitivas'][n].get('ok'), bool)
                    for n in PRIMITIVAS))


def leer_medidas(carpeta, avisos):
    medidas = []
    archivos = sorted(carpeta.glob('resultado-*.json'), key=lambda p: int(re.sub(r'\D', '', p.name) or 0))
    for archivo in archivos:
        try:
            d = json.loads(archivo.read_text(encoding='utf-8')) if archivo.stat().st_size <= 65536 else None
        except (ValueError, UnicodeDecodeError, RecursionError):
            d = None
        if not _es_resultado(d):
            avisos.append(f'✗ {archivo.name}: no es un resultado de la página de P6.')
            continue
        # Etiqueta y errores, sin nada que rompa el markdown (la página ya limpia la etiqueta).
        m = {'archivo': archivo.name, 'etiqueta': re.sub(r'[^a-z0-9-]', '', d['etiqueta'])[:24], 'seguro': d['seguro'],
             'navegador': navegador(d['userAgent'], d['marcas'], d['webviewTelegram']),
             'primitivas': {n: (d['primitivas'][n]['ok'],
                                ' '.join(str(d['primitivas'][n].get('detalle', '')).split()).replace(' | ', ' / ')[:160])
                            for n in PRIMITIVAS}}
        if not m['seguro']:
            avisos.append(f'✗ {m["archivo"]}: contexto no seguro, la medida no vale '
                          '(¿se abrió por otra dirección que 127.0.0.1?).')
        base = m['etiqueta'].removesuffix('-act')
        if base in ESPERADOS and base != 'telegram' and m['navegador']['tipo'] != ESPERADOS[base][0]:
            avisos.append(f'✗ {m["archivo"]}: la etiqueta {m["etiqueta"]} no cuadra con el userAgent '
                          f'({m["navegador"]["nombre"]}).')
        medidas.append(m)
    return medidas


def _lista(partes):
    return partes[0] if len(partes) == 1 else f'{", ".join(partes[:-1])} y {partes[-1]}'


def _fallan(m):
    return [n for n in PRIMITIVAS if not m['primitivas'][n][0]]


def _describe(m):
    n = m['navegador']
    quien = n['nombre'] if n['tipo'] == 'chrome' else f"{n['nombre']} ({n['motor']})"
    fallan = _fallan(m)
    estado = f'falla {", ".join(fallan)}' if fallan else '5 de 5 ✓'
    return f'{quien}, {estado} ({m["archivo"]})'


def veredicto(medidas):
    validas = [m for m in medidas if m['seguro']]
    lineas, faltan, ultimas, antes = [], [], [], []
    interno_sin_medir = False
    for base, (tipo, titulo) in ESPERADOS.items():
        propias = [m for m in validas if m['etiqueta'] == base and m['navegador']['tipo'] == tipo]
        tras = [m for m in validas if m['etiqueta'] == f'{base}-act' and m['navegador']['tipo'] == tipo]
        fuera = []
        if base == 'telegram':
            fuera = [m for m in validas if m['etiqueta'] in ('telegram', 'telegram-act') and m['navegador']['tipo'] != tipo]
            for m in fuera:
                lineas.append(f'Telegram abrió el enlace fuera de su navegador en {m["archivo"]} '
                              f'(userAgent de {m["navegador"]["nombre"]}): mira su captura y el ajuste '
                              'del navegador de Telegram.')
        if not propias and not tras:
            if fuera:
                # Cambiar el ajuste de Telegram es opcional: sin él, su navegador interno queda sin medir.
                lineas.append(f'{titulo}: sin medir (Telegram abrió el enlace fuera de su navegador).')
                interno_sin_medir = True
                continue
            lineas.append(f'{titulo}: sin medir.')
            if base in OBLIGATORIOS:
                faltan.append('el enlace desde Telegram' if base == 'telegram' else titulo)
            continue
        texto = f'{titulo}: {_describe(propias[-1])}' if propias else f'{titulo}: sin medida antes de actualizar'
        if tras:
            texto += f'; tras actualizar: {_describe(tras[-1])}'
        lineas.append(texto + '.')
        ultima = (tras or propias)[-1]
        ultimas.append((base, titulo, ultima))
        if tras and propias and _fallan(propias[-1]):
            antes.append(f'{", ".join(_fallan(propias[-1]))} en {propias[-1]["navegador"]["nombre"]}')
    if faltan:
        lineas.append(f'P6 en el teléfono: incompleto, falta {_lista(faltan)}.')
    elif interno_sin_medir:
        lineas.append('P6 en el teléfono: completo (Chrome, Samsung Internet y el enlace desde Telegram, que se abrió '
                      'fuera de su navegador: el navegador interno de Telegram queda sin medir).')
    else:
        lineas.append('P6 en el teléfono: completo (Chrome, Samsung Internet y el navegador interno de Telegram).')
    if ultimas:
        # Qué navegadores medidos tienen X25519 hoy, con su motor: es lo que va al informe.
        con, sin = [], []
        for base, titulo, m in ultimas:
            quien = f'{"el navegador interno de Telegram" if base == "telegram" else titulo} ({m["navegador"]["motor"]})'
            (con if m['primitivas']['x25519'][0] else sin).append(quien)
        partes = ([f'✓ en {_lista(con)}'] if con else []) + ([f'✗ en {_lista(sin)}'] if sin else [])
        lineas.append(f'X25519 en WebCrypto hoy (última medida de cada navegador): {"; ".join(partes)}.')
    mal = [f'{", ".join(_fallan(m))} en {m["navegador"]["nombre"]}' for _, _, m in ultimas if _fallan(m)]
    if mal:
        texto = f'Primitivas: ✗ en su última medida: {"; ".join(mal)}.'
    else:
        texto = 'Primitivas: ✓ en todos los navegadores en su última medida.'
    if antes:
        texto = texto[:-1] + f'; antes de actualizar, falla {"; ".join(antes)}.'
    lineas.append(texto)
    return lineas


def informe(carpeta):
    avisos, salida = [], []
    medidas = leer_medidas(carpeta, avisos)
    salida.append(f'# P6 en el teléfono: {carpeta.name}\n')
    salida.append('| Archivo | Navegador anotado | Navegador (userAgent) | Motor | Seguro | ' + ' | '.join(CABECERAS) + ' |')
    salida.append('|' + '---|' * (5 + len(CABECERAS)))
    for m in medidas:
        marcas = ' | '.join('✓' if m['primitivas'][n][0] else '✗' for n in PRIMITIVAS)
        salida.append(f'| {m["archivo"]} | {m["etiqueta"] or "(ninguno)"} | {m["navegador"]["nombre"]} | '
                      f'{m["navegador"]["motor"]} | {"sí" if m["seguro"] else "no"} | {marcas} |')
    errores = [f'- {m["archivo"]}, {n}: {m["primitivas"][n][1]}' for m in medidas for n in PRIMITIVAS
               if not m['primitivas'][n][0]]
    if errores:
        salida += ['', 'Errores de las primitivas:', *errores]

    versiones = [leer_versiones(carpeta.joinpath(n).read_text(encoding='utf-8', errors='replace'))
                 if carpeta.joinpath(n).is_file() else None for n in ('p6-versiones.txt', 'p6-versiones-act.txt')]
    salida += ['', '## Versiones (dumpsys)', '', '| Paquete | Al empezar | Tras actualizar |', '|---|---|---|']
    for paquete in PAQUETES:
        celdas = ['-' if v is None else (v['paquetes'].get(paquete) or 'no está') for v in versiones]
        salida.append(f'| {paquete} | {celdas[0]} | {celdas[1]} |')
    celdas = ['-' if v is None else (v['webview'] or '?') for v in versiones]
    salida.append(f'| WebView activo (webviewupdate) | {celdas[0]} | {celdas[1]} |')

    capturas = sorted(carpeta.glob('p6-*.png'))
    nombres = f': {", ".join(p.name for p in capturas)}' if capturas else '.'
    salida += ['', '## Capturas', '', f'- {len(capturas)} capturas PNG{nombres}']
    for p in capturas:
        with p.open('rb') as f:
            if f.read(8) != PNG:
                avisos.append(f'✗ {p.name} no es un PNG.')

    salida += ['', '## Veredicto', '', *(f'- {a}' for a in avisos), *(f'- {v}' for v in veredicto(medidas))]
    return '\n'.join(salida)


def main(argv):
    if len(argv) != 1 or not pathlib.Path(argv[0]).is_dir():
        print('Uso: python3 -I -B analizar.py <carpeta de la sesión>', file=sys.stderr)
        return 2
    carpeta = pathlib.Path(argv[0])
    if not any(carpeta.glob('resultado-*.json')):
        print(f'{carpeta}: no hay ningún resultado-*.json', file=sys.stderr)
        return 2
    print(informe(carpeta))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
```

📍 Máquina de trabajo.

Ejecutar:

```sh
python3 -I -B <banco>/p6/prueba_analizar.py; echo "salida: $?"
```

Esperado:

```
.................
----------------------------------------------------------------------
Ran 17 tests in …s

OK
salida: 0
```

- [ ] **Paso 15: el análisis lee lo que guarda el servidor**

Los tres resultados de Playwright los escribió la página de verdad y los guardó `servidor.ps1`: si el análisis los lee, página, servidor y análisis hablan el mismo JSON. Son motores de escritorio con las etiquetas `chromium`, `firefox` y `webkit`, así que el veredicto dice que faltan los del teléfono.

📍 Máquina de trabajo; corre dentro de `vigia-build` (solo biblioteca estándar).

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && python3 -I -B /work/banco/p6/analizar.py /work/h0b/p6/servidor; echo "salida: $?"'
```

Esperado (qué motor tiene cada número depende de cuál llegó antes):

```
# P6 en el teléfono: servidor

| Archivo | Navegador anotado | Navegador (userAgent) | Motor | Seguro | X25519 | AES-GCM | HKDF | ECDSA | ADTS |
|---|---|---|---|---|---|---|---|---|---|
| resultado-1.json | chromium | Chrome 153 | Chromium 153 | sí | ✓ | ✓ | ✓ | ✓ | ✓ |
| resultado-2.json | webkit | otro navegador | ? | sí | ✓ | ✓ | ✓ | ✓ | ✓ |
| resultado-3.json | firefox | Firefox 155.0 | Gecko | sí | ✓ | ✓ | ✓ | ✓ | ✓ |

## Versiones (dumpsys)

| Paquete | Al empezar | Tras actualizar |
|---|---|---|
| com.android.chrome | - | - |
| com.sec.android.app.sbrowser | - | - |
| com.mi.globalbrowser | - | - |
| com.android.browser | - | - |
| org.telegram.messenger | - | - |
| org.telegram.messenger.web | - | - |
| com.google.android.webview | - | - |
| WebView activo (webviewupdate) | - | - |

## Capturas

- 0 capturas PNG.

## Veredicto

- Chrome: sin medir.
- Samsung Internet: sin medir.
- Navegador interno de Telegram: sin medir.
- Mi Browser: sin medir.
- P6 en el teléfono: incompleto, falta Chrome, Samsung Internet y el enlace desde Telegram.
- Primitivas: ✓ en todos los navegadores en su última medida.
salida: 0
```

- [ ] **Paso 16: parar el servidor y limpiar**

⚠️ Borra el contenedor del servidor y su carpeta de prueba, con los resultados y el registro, que ya no hacen falta. `muestra.aac` se queda en `/work/h0b/p6/` para la sesión 3.

📍 Máquina de trabajo.

Ejecutar:

```sh
docker rm -f p6-servidor
docker exec vigia-build sh -c 'rm -rf /work/h0b/p6/servidor && ls /work/h0b/p6'
```

Esperado:

```
p6-servidor
muestra.aac
```

- [ ] **Paso 17: commit en el banco**

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit.

Ejecutar:

```sh
git -C <banco> add p6/primitivas.html p6/primitivas.js p6/primitivas.spec.mjs p6/servidor.ps1 p6/prueba-servidor.sh p6/prueba-sintaxis.ps1 p6/analizar.py p6/prueba_analizar.py
git -C <banco> status --short; git -C <banco> diff --cached --stat | tail -n 1
git -C <banco> commit -q -m "P6: página de primitivas ampliada, servidor local en PowerShell y análisis de la sesión del teléfono" && git -C <banco> log --oneline -1
for f in primitivas.html primitivas.js servidor.ps1; do echo "$(git -C <banco> show HEAD:p6/$f | sha256sum | cut -c1-64)  $f"; done
```

Esperado:

```
A  p6/analizar.py
M  p6/primitivas.html
M  p6/primitivas.js
M  p6/primitivas.spec.mjs
A  p6/prueba-servidor.sh
A  p6/prueba-sintaxis.ps1
A  p6/prueba_analizar.py
A  p6/servidor.ps1
 8 files changed, 914 insertions(+), 9 deletions(-)
<commit> P6: página de primitivas ampliada, servidor local en PowerShell y análisis de la sesión del teléfono
6648019297440fcfd3a4f5d0beec26cefe3b822e7a7938b1d62008a3c2fdff3e  primitivas.html
14e684e1e6cfd63a1dcfdd7e80c2e6a951e3145d613b6a5e9bff4ca04a52382f  primitivas.js
7d4f94624bb954f90a795768dd22e2299ef3a49a9d010a992a488d83c28007fb  servidor.ps1
```

Las tres sumas son las de los archivos de este plan: la tarea 15 (P6, paso 5) las da a la persona responsable para comprobar lo que baja.

**Notas:**

- **Nota:** validado el 14-oct-2026 en `vigia-build` (todavía con la imagen de H0a, que solo se diferencia de `vigia-build:h0b` en la capa de iproute2) sobre una copia del andamio de la tarea 4: este plan se generó leyendo los archivos validados y se volvió a ejecutar entero tal cual, paso a paso, con las rutas de la copia (`/work/h0b-plan/web/…` en lugar de `/work/banco` y `/work/h0b`), y otra vez, también entero, tras la revisión (el volumen en solo lectura y el caso de RFC 7748), en `/work/h0b-plan/arreglo-web/…`. Antes del caso de RFC 7748, la prueba `x25519 exige la clave importada` falló en los tres motores con la página anterior, que daba ✓ sin importar ninguna clave. Comprobado además a mano: una conexión callada se cierra a los 10 s, una segunda instancia con el puerto ocupado sale con `No se pudo abrir 127.0.0.1:8080: …` y código 1, y sin `muestra.aac` el servidor avisa al arrancar y responde 404 a esa ruta. Las capturas de la página a 360 px de ancho (bien, y con X25519 forzado a fallar) se leen sin ampliar.
- **Nota:** `servidor.ps1` no se ha ejecutado en Windows PowerShell 5.1: la primera vez es en la sesión 3. Lo cubren el paso 6 (sintaxis de la 5.1) y que solo usa .NET que ya está en .NET Framework 4.5. Si en el portátil falla, el plan B es el mismo archivo con `pwsh` (PowerShell 7) si la persona responsable lo tiene, o abrir la página en el host de prueba del tramo B.
- **Nota:** la prueba X25519 hace lo de H0a (dos claves generadas acuerdan el mismo secreto) y lo que hará la bóveda: importar la privada del contacto no extraíble y la pública `enc` en crudo, con el caso de RFC 7748, sección 6.1 (la privada en PKCS #8). Los vectores de HPKE de CFRG no corren en ningún navegador del teléfono en este tramo (P5 los pasa en Kotlin y en Hermes), así que este caso es lo único que comprueba en el navegador la importación de X25519; el ✓ exige las dos pruebas, y la segunda prueba de la spec comprueba que sin importar la clave sale ✗.
- **Nota:** el contrato dice que en el portátil no se pegan archivos `.ps1`, por la ExecutionPolicy y la marca de la web. `servidor.ps1` es la excepción que pide esta tarea: se lanza con `-ExecutionPolicy Bypass`, que solo vale para ese proceso y no cambia la configuración de Windows (si una directiva de grupo fija la política, no basta: no es el caso de un portátil personal).

---

### Tarea 11: P7 en la máquina: arnés con la cola real y netem en `vigia-p7`

P7 pregunta cuál es la duración de fragmento más corta (2, 4 u 8 s) con la que la cola de subida no crece con 3G degradada; su criterio es que "la cola del minuto 30 no supera a la del minuto 1, y el retraso es de 2 fragmentos o menos el 95 % del tiempo" (plan maestro, P7). Esta tarea hace la parte de la máquina: el cliente de subida real (la `Cola` del núcleo de `f2-h1` con un adaptador HTTP) contra el backend de `f2-h1` en `wrangler dev`, 30 min por duración, con la red degradada por netem en la red interna `vigia-p7` (decisión 5). La parte del teléfono es del tramo B.

**Archivos (banco, `<banco>`):**
- Modificar: `jvm/arnes/build.gradle.kts` y `jvm/arnes/src/main/kotlin/vigia/banco/arnes/Main.kt` (los mínimos del andamio de la tarea 4).
- Crear:
  - en `jvm/arnes/src/main/kotlin/vigia/banco/arnes/`: `Clasificador.kt`, `Medida.kt` y `Contrato.kt`;
  - en `jvm/arnes/src/test/kotlin/vigia/banco/arnes/`: `ClasificadorTest.kt`, `MedidaTest.kt` y `ContratoTest.kt`;
  - en `p7/`: `p7.sh` (el guion de la prueba, en la máquina de trabajo), `worker.sh` (dentro de `p7-worker`), `calibrar.py`, `analizar.py` y `prueba_analizar.py`.
- Fuera del banco, en el volumen: `/work/h0b/p7/resultados/` (un CSV y un registro por tanda: `d2`, `d4`, `d8` y, si hace falta el plan B, `d8-b`), que lee la tarea 16, y en `<intercambio>/resultados/` (la carpeta de la tarea 3) `p7-calibracion.txt` y `p7.txt`, la calibración y el veredicto. Lo demás solo existe mientras dura la prueba y lo borra la limpieza: los contenedores `p7-worker` y `p7-arnes` (con el tmpfs de `p7-worker`: la clave de acuse de dev, `.dev.vars`, la configuración y el estado de wrangler), `/work/h0b/p7/claves-dev.txt` (la lista pública de claves) y, con el plan B, `/work/h0b/p7/nucleo-b/` y `/work/h0b/p7/arnes-b/`.

**Interfaces:**
- Consume:
  - Tarea 2: la imagen `vigia-build:h0b` (con `tc` y `ss` de iproute2) y el contenedor `vigia-build` con `/work/.gradle` llena.
  - Tarea 4: `/work/f2-h1` (`packages/nucleo/build/libs/nucleo.jar` con SHA-256 `188cec81ba0e2ce481e80a0fa3548c6c2d09acf1a7056e1841d75a8cbbc376d9`; `packages/backend` con `wrangler.prueba.jsonc`, `herramientas/generar-dev-vars.ts` y wrangler 4.147.0 en `node_modules`) y el proyecto `jvm/` (`:arnes` con `application`, `nucleo.jar` de `$F2H1`, bcprov 1.86 y JUnit 6.1.3). Esta tarea no añade dependencias a `jvm/`: `verification-metadata.xml` no cambia.
  - H0a: la red `vigia-p7` (bridge interna, `Internal: true`, sin contenedores).
  - Núcleo de `f2-h1` (`vigia.nucleo`): `Cola(reloj, azar, hosts, claves, dispositivo, abiertos)` con `encolar`, `siguiente`, `registrar`, `proximaHora`, `pendientes` y `rechazados`; `Elemento`, `Pendiente`, `Prioridad` y `Resultado` (`Alta`, `Acuse`, `Hora`, `Limite`, `Interno`, `Rechazo` y `Red`); `Reloj`, `Azar` y `EntradaClave`; `FabricaSobres`, `FirmanteSoftware`, `Cuerpos`, `Peticion.cabeceras` y `Registros.hash`; `Jcv`, `Codificacion`, `Spki` y `ErrorFormato`.
  - Contrato de H1: rutas, tipos de contenido y lista cerrada de códigos (sección 11) y la tabla "Respuesta HTTP a `Resultado`" (sección 17).
- Produce:
  - Kotlin, paquete `vigia.banco.arnes` (lo puede reutilizar el adaptador HTTP de H3a):

    ```kotlin
    object Clasificador {
        val ESTADO_DE: Map<String, Int>                                                  // código de la lista cerrada -> estado HTTP
        fun clasificar(estado: Int, cabecera: (String) -> String?, cuerpo: ByteArray): Resultado
    }
    data class Fila(val minuto: Int, val pendientes: Int, val pendientesMin: Int, val enVuelo: Int, val retraso: Int,
                    val msSobre2: Long, val acuses: Int, val fueraDeOrden: Int, val rechazos: Int, val limites: Int,
                    val internos: Int, val red: Int) {
        fun csv(): String
        companion object { const val CABECERA: String }
    }
    class Medida(inicio: Long) {                                                         // ms monotónicos
        fun generado(t: Long); fun salida(t: Long); fun vuelta(t: Long, seq: Int?); fun resultado(r: Resultado)
        fun cerrarMinuto(t: Long): Fila
    }
    object Api {
        const val DISPOSITIVOS = "/v1/devices"; const val INCIDENTES = "/v1/incidents"
        const val TIPO_JSON = "application/json"; const val TIPO_SOBRE = "application/vnd.vigia.sobre"
        fun fragmento(incidente: String, seq: Int): String                              // /v1/incidents/<id>/chunks/<seq>
        fun cierre(incidente: String): String                                           // /v1/incidents/<id>/close
    }
    object RelojReal : Reloj
    class AzarSeguro(azar: SecureRandom) : Azar
    fun nuevoId(azar: SecureRandom): String                                              // 16 bytes en b64u
    fun leerClaves(texto: ByteArray): List<EntradaClave>                                 // claves-dev.txt; lanza ErrorFormato
    fun subidasEnVuelo(): Int                                                            // 1 con el núcleo de f2-h1, 2 con el del plan B
    class Arnes(base: String, claves: List<EntradaClave>, segundos: Int, minutos: Int, csv: File) { fun correr() }
    ```

  - La distribución del arnés (`installDist`) en `/work/banco/jvm/arnes/build/install/arnes`: `bin/arnes <base> <claves-dev.txt> <segundos por fragmento> <minutos> <csv>`. Escribe en el CSV, y en la salida, la cabecera `minuto,pendientes,pendientes_min,en_vuelo,retraso,ms_retraso_sobre_2,acuses,fuera_de_orden,rechazos,limites,internos,red` y una fila al acabar cada minuto de grabación; al final, una línea `fin: …`.
  - `sh <banco>/p7/p7.sh montar | netem | calibrar | tanda <segundos> <minutos> [b] | planb | analizar | limpiar`, en la máquina de trabajo. Por entorno: `IMAGEN` (`vigia-build:h0b`) y las rutas del volumen `BANCO` (`/work/banco`), `F2H1` (`/work/f2-h1`) y `P7` (`/work/h0b/p7`).
  - El veredicto de `analizar.py` por duración y su última línea, `P7: la duración más corta que cumple es N s` (o la que diga que ninguna cumple), que la tarea 16 lleva al informe.

- [ ] **Paso 1: la prueba del clasificador**

La tabla "Respuesta HTTP a `Resultado`" del contrato de H1 (sección 17), caso a caso; lo que no es una respuesta de Vigía (una página de la plataforma, un código que no casa con su estado, un JSON que no es JCV) es `Red`.

`<banco>/jvm/arnes/src/test/kotlin/vigia/banco/arnes/ClasificadorTest.kt`:

```kotlin
package vigia.banco.arnes

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import vigia.nucleo.Resultado

// La tabla "Respuesta HTTP a Resultado" del contrato de H1 (sección 17).
class ClasificadorTest {
    private val sinCabeceras: (String) -> String? = { null }

    // Como HttpHeaders: el nombre de la cabecera no distingue mayúsculas.
    private fun cabeceras(vararg pares: Pair<String, String>): (String) -> String? {
        val mapa = pares.associate { it.first.lowercase() to it.second }
        return { mapa[it.lowercase()] }
    }

    private fun error(codigo: String) = "{\"codigo\":\"$codigo\"}".toByteArray()

    private fun clasificar(estado: Int, cuerpo: ByteArray, cabecera: (String) -> String? = sinCabeceras) =
        Clasificador.clasificar(estado, cabecera, cuerpo)

    @Test
    fun `un 201 o un 200 con el id del dispositivo es Alta`() {
        val cuerpo = "{\"dispositivo\":\"AbCdEfGhIjKlMnOpQrStU_\"}".toByteArray()
        assertEquals(Resultado.Alta("AbCdEfGhIjKlMnOpQrStU_"), clasificar(201, cuerpo))
        assertEquals(Resultado.Alta("AbCdEfGhIjKlMnOpQrStU_"), clasificar(200, cuerpo))
    }

    @Test
    fun `cualquier otro 200 o 201 es Acuse con los bytes tal cual y lo comprueba la cola`() {
        val cuerpo = "{\"firma\":\"x\",\"hora_servidor\":1,\"kid\":\"dev_1\",\"r\":\"00\",\"v\":1}".toByteArray()
        for (estado in listOf(200, 201)) {
            val r = clasificar(estado, cuerpo)
            assertTrue(r is Resultado.Acuse)
            assertArrayEquals(cuerpo, (r as Resultado.Acuse).bytes)
        }
    }

    @Test
    fun `401 hora con X-Vigia-Hora-Servidor es Hora y sin ella o mal formada es Red`() {
        val hora = cabeceras("x-vigia-hora-servidor" to "1791940116436")
        assertEquals(Resultado.Hora(1_791_940_116_436), clasificar(401, error("hora"), hora))
        assertEquals(Resultado.Red, clasificar(401, error("hora")))
        for (mala in listOf("", "-5", "017", "12a", "1.5")) {
            assertEquals(Resultado.Red, clasificar(401, error("hora"), cabeceras("X-Vigia-Hora-Servidor" to mala)))
        }
    }

    @Test
    fun `429 es Limite con su codigo y Retry-After por 1000`() {
        assertEquals(Resultado.Limite("limite", 60_000), clasificar(429, error("limite"), cabeceras("Retry-After" to "60")))
        assertEquals(Resultado.Limite("cuota", 3_600_000), clasificar(429, error("cuota"), cabeceras("Retry-After" to "3600")))
        assertEquals(Resultado.Limite("tope_altas", null), clasificar(429, error("tope_altas")))
        val fecha = cabeceras("Retry-After" to "Wed, 21 Oct 2026 07:28:00 GMT")
        assertEquals(Resultado.Limite("limite", null), clasificar(429, error("limite"), fecha))
    }

    @Test
    fun `500 interno es Interno y otro 500 es Red`() {
        assertEquals(Resultado.Interno, clasificar(500, error("interno")))
        assertEquals(Resultado.Red, clasificar(500, "<html>error</html>".toByteArray()))
    }

    @Test
    fun `400 401 firma 404 409 413 y 415 de la lista cerrada son Rechazo con su estado y su codigo`() {
        val casos = listOf(
            400 to "formato", 400 to "hash", 401 to "firma", 404 to "no_existe", 409 to "conflicto",
            413 to "demasiado_grande", 415 to "tipo_contenido",
        )
        for ((estado, codigo) in casos) assertEquals(Resultado.Rechazo(estado, codigo), clasificar(estado, error(codigo)))
    }

    @Test
    fun `lo que no es una respuesta de Vigia es Red`() {
        assertEquals(Resultado.Red, clasificar(502, "<html>Bad Gateway</html>".toByteArray())) // página de la plataforma
        assertEquals(Resultado.Red, clasificar(400, error("conflicto"))) // código de otro estado
        assertEquals(Resultado.Red, clasificar(404, error("interno")))
        assertEquals(Resultado.Red, clasificar(400, error("otro"))) // fuera de la lista cerrada
        assertEquals(Resultado.Red, clasificar(400, "{ \"codigo\":\"formato\"}".toByteArray())) // no es JCV
        assertEquals(Resultado.Red, clasificar(204, ByteArray(0)))
        assertEquals(Resultado.Red, clasificar(302, ByteArray(0)))
    }
}
```

📍 Máquina de trabajo; la orden corre dentro de `vigia-build` (`sincronizar banco` copia el árbol del banco a `/work/banco`).

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon :arnes:test'
```

Esperado: `e: file:///work/banco/jvm/arnes/src/test/kotlin/vigia/banco/arnes/ClasificadorTest.kt:22:9 Unresolved reference 'Clasificador'.` y `BUILD FAILED`.

- [ ] **Paso 2: el clasificador**

Un 200 o 201 que no es un alta es `Acuse` con los bytes tal cual: lo verifica la cola con las claves fijadas y, si no vale, lo trata como `Red` (ACU-02). `Retry-After` solo se lee en segundos (los 429 de Vigía nunca llevan fecha).

`<banco>/jvm/arnes/src/main/kotlin/vigia/banco/arnes/Clasificador.kt`:

```kotlin
package vigia.banco.arnes

import vigia.nucleo.ErrorFormato
import vigia.nucleo.Jcv
import vigia.nucleo.Resultado

/**
 * Respuesta HTTP a Resultado, con la tabla del contrato de H1 (sección 17), que el adaptador HTTP de H3a
 * aplicará igual. Lo que no es una respuesta de Vigía (una página de la plataforma, un 502, un código que no
 * casa con su estado) es Red. Un 200 o 201 que no es un alta es Acuse: la cola lo verifica y, si no vale, lo
 * trata como Red (ACU-02).
 */
object Clasificador {
    /** Estado de cada código de la lista cerrada (sección 11, ERR-01). */
    val ESTADO_DE = mapOf(
        "formato" to 400, "hash" to 400, "firma" to 401, "hora" to 401, "no_existe" to 404, "conflicto" to 409,
        "demasiado_grande" to 413, "tipo_contenido" to 415, "limite" to 429, "cuota" to 429, "tope_altas" to 429,
        "interno" to 500,
    )
    private val ERROR = mapOf("codigo" to Jcv.Cadena(Regex(ESTADO_DE.keys.joinToString("|"))))
    private val ALTA = mapOf("dispositivo" to Jcv.Cadena(Regex("[A-Za-z0-9_-]{22}")))
    private val MILISEGUNDOS = Regex("0|[1-9][0-9]{0,15}")
    private val SEGUNDOS = Regex("0|[1-9][0-9]{0,8}")

    /** `cabecera` da el valor de una cabecera de la respuesta, sin distinguir mayúsculas en el nombre. */
    fun clasificar(estado: Int, cabecera: (String) -> String?, cuerpo: ByteArray): Resultado {
        if (estado == 200 || estado == 201) {
            val alta = jcv(cuerpo, ALTA) ?: return Resultado.Acuse(cuerpo)
            return Resultado.Alta(alta["dispositivo"] as String)
        }
        val codigo = jcv(cuerpo, ERROR)?.get("codigo") as String?
        if (codigo == null || ESTADO_DE[codigo] != estado) return Resultado.Red
        return when (codigo) {
            "hora" -> cabecera("X-Vigia-Hora-Servidor")?.takeIf(MILISEGUNDOS::matches)?.let { Resultado.Hora(it.toLong()) } ?: Resultado.Red
            "limite", "cuota", "tope_altas" -> Resultado.Limite(codigo, cabecera("Retry-After")?.takeIf(SEGUNDOS::matches)?.let { it.toLong() * 1_000 })
            "interno" -> Resultado.Interno
            else -> Resultado.Rechazo(estado, codigo)
        }
    }

    private fun jcv(cuerpo: ByteArray, esquema: Map<String, Jcv.Campo>): Map<String, Any>? =
        try {
            Jcv.analizar(cuerpo, esquema)
        } catch (e: ErrorFormato) {
            null
        }
}
```

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon :arnes:test && grep -ho "tests=\"[0-9]*\" skipped=\"0\" failures=\"0\" errors=\"0\"" arnes/build/test-results/test/*.xml | awk -F"\"" "{n++; t+=\$2} END {print n \" clases, \" t \" pruebas, sin fallos\"}"'
```

Esperado: `BUILD SUCCESSFUL` y `1 clases, 7 pruebas, sin fallos`.

- [ ] **Paso 3: la prueba de la medida**

La medida es la de P7, minuto a minuto: la cola que espera turno (sin lo que va en vuelo), la que no llega a vaciarse en todo el minuto, el retraso en fragmentos, el tiempo con el retraso por encima de 2 (integrado, no muestreado: el criterio dice "el 95 % del tiempo"), los acuses fuera de orden y los fallos.

`<banco>/jvm/arnes/src/test/kotlin/vigia/banco/arnes/MedidaTest.kt`:

```kotlin
package vigia.banco.arnes

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import vigia.nucleo.Resultado

// La medida por minuto de P7 con horas inventadas (ms monotónicos): el minuto 1 va de 1 000 a 61 000.
class MedidaTest {
    private val medida = Medida(1_000)

    @Test
    fun `un minuto sin nada da una fila de ceros y el siguiente es el 2`() {
        assertEquals(Fila(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), medida.cerrarMinuto(61_000))
        assertEquals(2, medida.cerrarMinuto(121_000).minuto)
    }

    @Test
    fun `pendientes son los que esperan turno y en vuelo los que se estan subiendo`() {
        repeat(3) { medida.generado(5_000L + it * 4_000) } // a los 5, 9 y 13 s
        medida.salida(13_000)
        val fila = medida.cerrarMinuto(61_000)
        assertEquals(2, fila.pendientes)
        assertEquals(1, fila.enVuelo)
        assertEquals(3, fila.retraso)
    }

    @Test
    fun `la cola de un minuto es la que no se vacia en todo el minuto`() {
        repeat(3) { medida.generado(10_000) }
        val primero = medida.cerrarMinuto(61_000)
        assertEquals(listOf(3, 0), listOf(primero.pendientes, primero.pendientesMin)) // empezó vacía
        medida.salida(70_000)
        val segundo = medida.cerrarMinuto(121_000)
        assertEquals(listOf(2, 2), listOf(segundo.pendientes, segundo.pendientesMin)) // nunca bajó de 2
        medida.vuelta(130_000, 1)
        medida.salida(130_000)
        medida.vuelta(140_000, 2)
        medida.salida(140_000)
        medida.generado(150_000)
        val tercero = medida.cerrarMinuto(181_000)
        assertEquals(listOf(1, 0), listOf(tercero.pendientes, tercero.pendientesMin)) // se vació a los 140 s
    }

    @Test
    fun `el tiempo con el retraso por encima de 2 se integra y se reparte entre los minutos`() {
        repeat(3) { medida.generado(50_000) } // retraso 3 desde los 50 s
        medida.salida(50_000)
        assertEquals(11_000, medida.cerrarMinuto(61_000).msSobre2) // de 50 a 61 s
        medida.vuelta(70_000, 1) // retraso 2 desde los 70 s: ya no cuenta
        assertEquals(9_000, medida.cerrarMinuto(121_000).msSobre2) // de 61 a 70 s
    }

    @Test
    fun `un acuse que llega antes que el de un fragmento anterior cuenta fuera de orden`() {
        repeat(3) { medida.generado(10_000) }
        medida.salida(10_000)
        medida.salida(10_000)
        medida.vuelta(12_000, 2)
        val primero = medida.cerrarMinuto(61_000)
        assertEquals(1, primero.fueraDeOrden)
        assertEquals(3, primero.retraso) // el 1 sigue sin acuse
        assertEquals(1, primero.pendientes) // el 3; el 1 va en vuelo
        medida.vuelta(62_000, 1)
        val segundo = medida.cerrarMinuto(121_000)
        assertEquals(0, segundo.fueraDeOrden)
        assertEquals(1, segundo.retraso) // con el 1 y el 2 acusados solo falta el 3
        assertEquals(1, segundo.acuses)
    }

    @Test
    fun `un fragmento que vuelve sin acuse vuelve a esperar turno`() {
        medida.generado(10_000)
        medida.salida(10_000)
        medida.vuelta(11_000, null)
        val fila = medida.cerrarMinuto(61_000)
        assertEquals(listOf(1, 0, 0), listOf(fila.pendientes, fila.enVuelo, fila.acuses))
    }

    @Test
    fun `rechazos limites internos y fallos de red se cuentan en su minuto`() {
        medida.resultado(Resultado.Red)
        medida.resultado(Resultado.Red)
        medida.resultado(Resultado.Limite("limite", 60_000))
        medida.resultado(Resultado.Rechazo(409, "conflicto"))
        medida.resultado(Resultado.Interno)
        medida.resultado(Resultado.Hora(1))
        val fila = medida.cerrarMinuto(61_000)
        assertEquals(listOf(1, 1, 1, 2), listOf(fila.rechazos, fila.limites, fila.internos, fila.red))
        assertEquals(Fila(2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), medida.cerrarMinuto(121_000))
    }

    @Test
    fun `la fila sale en el orden de la cabecera del CSV`() {
        val cabecera = "minuto,pendientes,pendientes_min,en_vuelo,retraso,ms_retraso_sobre_2,acuses,fuera_de_orden,rechazos,limites,internos,red"
        assertEquals(cabecera, Fila.CABECERA)
        assertEquals("7,1,2,3,4,5,6,7,8,9,10,11", Fila(7, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11).csv())
    }
}
```

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon :arnes:test'
```

Esperado: `e: file:///work/banco/jvm/arnes/src/test/kotlin/vigia/banco/arnes/MedidaTest.kt:9:26 Unresolved reference 'Medida'.`, `e: file:///work/banco/jvm/arnes/src/test/kotlin/vigia/banco/arnes/MedidaTest.kt:13:22 Unresolved reference 'Fila'.` (y otros errores que se siguen de esos dos) y `BUILD FAILED`.

- [ ] **Paso 4: la medida**

`<banco>/jvm/arnes/src/main/kotlin/vigia/banco/arnes/Medida.kt`:

```kotlin
package vigia.banco.arnes

import vigia.nucleo.Resultado

/** Una fila del CSV de P7: cómo está la subida al acabar un minuto y lo que pasó en él. */
data class Fila(
    val minuto: Int,
    val pendientes: Int, // fragmentos sin acuse que esperan turno al acabar el minuto (sin los que van en vuelo)
    val pendientesMin: Int, // el mínimo de pendientes en el minuto: la cola que no llega a vaciarse
    val enVuelo: Int,
    val retraso: Int, // último fragmento generado menos el último acusado sin huecos delante
    val msSobre2: Long, // ms del minuto con el retraso por encima de 2 fragmentos
    val acuses: Int, // fragmentos acusados en el minuto
    val fueraDeOrden: Int, // de ellos, los que llegaron con algún fragmento anterior aún sin acuse
    val rechazos: Int, // estos cuatro, de cualquier petición del minuto
    val limites: Int,
    val internos: Int,
    val red: Int,
) {
    fun csv(): String =
        listOf(minuto, pendientes, pendientesMin, enVuelo, retraso, msSobre2, acuses, fueraDeOrden, rechazos, limites, internos, red)
            .joinToString(",")

    companion object {
        const val CABECERA =
            "minuto,pendientes,pendientes_min,en_vuelo,retraso,ms_retraso_sobre_2,acuses,fuera_de_orden,rechazos,limites,internos,red"
    }
}

/**
 * Medida de P7, minuto a minuto, desde `inicio` (ms monotónicos, que nunca bajan). El criterio del plan maestro
 * pide el retraso "el 95 % del tiempo": se integra en el tiempo, no se muestrea. La cola de cada minuto es su
 * mínimo: la foto al acabar el minuto depende de si justo entonces hay un PUT a medias.
 */
class Medida(inicio: Long) {
    private var ultima = inicio // hora del último cambio
    private var minuto = 1
    private var generados = 0
    private var contiguo = 0 // el mayor n con los fragmentos 1..n acusados
    private val acusados = HashSet<Int>() // los acusados por encima de contiguo
    private var enVuelo = 0
    private var minimo = 0 // de pendientes, en el minuto en curso
    private var msSobre2 = 0L
    private var acuses = 0
    private var fueraDeOrden = 0
    private var rechazos = 0
    private var limites = 0
    private var internos = 0
    private var red = 0

    private val retraso get() = generados - contiguo
    private val pendientes get() = generados - contiguo - acusados.size - enVuelo

    fun generado(t: Long) {
        avanzar(t)
        generados++
        minimo = minOf(minimo, pendientes)
    }

    /** Un fragmento sale a la red. */
    fun salida(t: Long) {
        avanzar(t)
        enVuelo++
        minimo = minOf(minimo, pendientes)
    }

    /** Un fragmento vuelve de la red; `seq` si quedó acusado (la cola lo borró), o null si sigue en la cola. */
    fun vuelta(t: Long, seq: Int?) {
        avanzar(t)
        enVuelo--
        if (seq != null) {
            acuses++
            if (seq > contiguo + 1) fueraDeOrden++
            acusados.add(seq)
            while (acusados.remove(contiguo + 1)) contiguo++
        }
        minimo = minOf(minimo, pendientes)
    }

    /** El resultado de cualquier petición, tal como lo dio el clasificador. */
    fun resultado(r: Resultado) {
        when (r) {
            is Resultado.Rechazo -> rechazos++
            is Resultado.Limite -> limites++
            Resultado.Interno -> internos++
            Resultado.Red -> red++
            else -> {}
        }
    }

    /** Cierra el minuto en curso en `t`, su final, y empieza el siguiente. */
    fun cerrarMinuto(t: Long): Fila {
        avanzar(t)
        val fila = Fila(
            minuto, pendientes, minimo, enVuelo, retraso, msSobre2, acuses, fueraDeOrden, rechazos, limites, internos, red,
        )
        minuto++
        minimo = pendientes
        msSobre2 = 0
        acuses = 0
        fueraDeOrden = 0
        rechazos = 0
        limites = 0
        internos = 0
        red = 0
        return fila
    }

    private fun avanzar(t: Long) {
        if (retraso > 2) msSobre2 += t - ultima
        ultima = t
    }
}
```

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon :arnes:test && grep -ho "tests=\"[0-9]*\" skipped=\"0\" failures=\"0\" errors=\"0\"" arnes/build/test-results/test/*.xml | awk -F"\"" "{n++; t+=\$2} END {print n \" clases, \" t \" pruebas, sin fallos\"}"'
```

Esperado: `BUILD SUCCESSFUL` y `2 clases, 15 pruebas, sin fallos`.

- [ ] **Paso 5: la prueba de las piezas del contrato**

Lo que fija el contrato de H1 y el núcleo solo tiene en TS o en las pruebas: rutas y tipos de contenido, `idPeticion` de 16 bytes en b64u, el lector de `claves-dev.txt` (sección 7), el azar de las esperas con `SecureRandom` y cuántas subidas deja en vuelo el núcleo con el que corre el arnés (`EN_VUELO_POR_CLASE` es privada: se mira en una cola de prueba).

`<banco>/jvm/arnes/src/test/kotlin/vigia/banco/arnes/ContratoTest.kt`:

```kotlin
package vigia.banco.arnes

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.spec.ECGenParameterSpec
import vigia.nucleo.Codificacion
import vigia.nucleo.ErrorFormato

// Lo que fija el contrato de H1 y el núcleo no trae: rutas, tipos, ids, lista de claves, azar y en vuelo.
class ContratoTest {
    private val azar = SecureRandom()
    private val spki = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair().public.encoded

    // Una línea de claves-dev.txt como la escribe generar-dev-vars.ts (sección 7), con su salto final.
    private fun entrada(kid: String = "dev_1", spki: ByteArray = this.spki, hasta: String = "") =
        "{\"desde\":1791940116436,\"estado\":\"activa\",$hasta\"kid\":\"$kid\",\"spki\":\"${Codificacion.b64u(spki)}\",\"v\":1}\n"

    @Test
    fun `rutas y tipos de contenido son los del contrato`() {
        val id = "AbCdEfGhIjKlMnOpQrStU_"
        assertEquals(listOf("/v1/devices", "/v1/incidents"), listOf(Api.DISPOSITIVOS, Api.INCIDENTES))
        assertEquals("/v1/incidents/$id/chunks/7", Api.fragmento(id, 7))
        assertEquals("/v1/incidents/$id/close", Api.cierre(id))
        assertEquals(listOf("application/json", "application/vnd.vigia.sobre"), listOf(Api.TIPO_JSON, Api.TIPO_SOBRE))
    }

    @Test
    fun `nuevoId da 22 caracteres b64u y cada vez otro`() {
        val a = nuevoId(azar)
        assertTrue(Regex("[A-Za-z0-9_-]{22}").matches(a))
        assertNotEquals(a, nuevoId(azar))
    }

    @Test
    fun `lee la lista de claves que escribe generar-dev-vars`() {
        val claves = leerClaves(entrada().toByteArray())
        assertEquals(1, claves.size)
        assertEquals(listOf("dev_1", "activa"), listOf(claves[0].kid, claves[0].estado))
        assertEquals(1_791_940_116_436, claves[0].desde)
        assertNull(claves[0].hasta)
        assertArrayEquals(spki, claves[0].spki)
        assertEquals(emptyList<Any>(), leerClaves(ByteArray(0)))
    }

    @Test
    fun `rechaza una lista de claves que no cumple la seccion 7`() {
        val malas = listOf(
            entrada().dropLast(1), // sin el salto final
            "\n" + entrada(), // línea vacía
            entrada() + entrada(), // kid repetido
            entrada(spki = ByteArray(91)), // no es una SPKI P-256
            entrada(hasta = "\"hasta\":1,"), // hasta antes de desde
        )
        for (mala in malas) assertThrows(ErrorFormato::class.java) { leerClaves(mala.toByteArray()) }
    }

    @Test
    fun `el azar de las esperas queda entre sus limites`() {
        val a = AzarSeguro(azar)
        assertEquals(5L, a.entre(5, 5))
        repeat(1_000) { assertTrue(a.entre(500, 1_000) in 500L..1_000L) }
    }

    @Test
    fun `el nucleo de f2-h1 deja una sola subida en vuelo`() {
        assertEquals(1, subidasEnVuelo())
    }
}
```

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon :arnes:test'
```

Esperado: entre los errores, `e: file:///work/banco/jvm/arnes/src/test/kotlin/vigia/banco/arnes/ContratoTest.kt:28:69 Unresolved reference 'Api'.`, y `BUILD FAILED`.

- [ ] **Paso 6: las piezas del contrato**

`<banco>/jvm/arnes/src/main/kotlin/vigia/banco/arnes/Contrato.kt`:

```kotlin
package vigia.banco.arnes

import java.security.SecureRandom
import vigia.nucleo.Azar
import vigia.nucleo.Cola
import vigia.nucleo.Codificacion
import vigia.nucleo.Elemento
import vigia.nucleo.EntradaClave
import vigia.nucleo.ErrorFormato
import vigia.nucleo.Jcv
import vigia.nucleo.Prioridad
import vigia.nucleo.Reloj
import vigia.nucleo.Spki

/** Rutas y tipos de contenido de la API de H1 (contrato, secciones 10 y 11); el núcleo solo los tiene en TS. */
object Api {
    const val DISPOSITIVOS = "/v1/devices"
    const val INCIDENTES = "/v1/incidents"
    const val TIPO_JSON = "application/json"
    const val TIPO_SOBRE = "application/vnd.vigia.sobre"

    fun fragmento(incidente: String, seq: Int) = "/v1/incidents/$incidente/chunks/$seq"

    fun cierre(incidente: String) = "/v1/incidents/$incidente/close"
}

/** Reloj de la JVM: nanoTime como el monotónico (en Android, elapsedRealtime) y la hora de pared. */
object RelojReal : Reloj {
    override fun monotonico(): Long = System.nanoTime() / 1_000_000

    override fun pared(): Long = System.currentTimeMillis()
}

/** El azar de las esperas de la cola, con SecureRandom. */
class AzarSeguro(private val azar: SecureRandom) : Azar {
    override fun entre(min: Long, maxIncluido: Long): Long = min + azar.nextLong(maxIncluido - min + 1)
}

/** idPeticion e id de incidente: 16 bytes de un CSPRNG en b64u, 22 caracteres (contrato, sección 2). */
fun nuevoId(azar: SecureRandom): String = Codificacion.b64u(ByteArray(16).also(azar::nextBytes))

private val ENTRADA = mapOf(
    "desde" to Jcv.Entero(0, 9_007_199_254_740_991),
    "estado" to Jcv.Cadena(Regex("activa|retirada|comprometida")),
    "hasta" to Jcv.Entero(0, 9_007_199_254_740_991, opcional = true),
    "kid" to Jcv.Cadena(Regex("[a-z][a-z0-9_]{0,31}")),
    "spki" to Jcv.Cadena(Regex("[A-Za-z0-9_-]{122}")),
    "v" to Jcv.Entero(1, 1),
)

/**
 * Lista fijada de claves de acuse (contrato, sección 7), como la escribe generar-dev-vars.ts: una entrada JCV
 * por línea, cada una con su salto. Rechaza una línea vacía, un kid repetido, una spki que no es P-256 de
 * 91 bytes y hasta antes de desde.
 */
fun leerClaves(texto: ByteArray): List<EntradaClave> {
    if (texto.isEmpty()) return emptyList()
    if (texto.last() != '\n'.code.toByte()) throw ErrorFormato("lista de claves sin el salto final")
    val claves = String(texto, Charsets.ISO_8859_1).dropLast(1).split('\n').map { linea ->
        val c = Jcv.analizar(linea.toByteArray(Charsets.ISO_8859_1), ENTRADA)
        val spki = Codificacion.deB64u(c["spki"] as String)
        val desde = c["desde"] as Long
        val hasta = c["hasta"] as Long?
        if (!Spki.esP256(spki)) throw ErrorFormato("spki que no es P-256 de 91 bytes")
        if (hasta != null && hasta < desde) throw ErrorFormato("hasta antes de desde")
        EntradaClave(c["kid"] as String, spki, c["estado"] as String, desde, hasta)
    }
    if (claves.map { it.kid }.toSet().size != claves.size) throw ErrorFormato("kid repetido")
    return claves
}

/**
 * Cuántas subidas deja en vuelo a la vez el núcleo con el que corre el arnés (EN_VUELO_POR_CLASE, privada):
 * 1 con el de f2-h1 y 2 con la copia del plan B. Lo mira en una cola de prueba con tres fragmentos listos.
 */
fun subidasEnVuelo(): Int {
    val quieto = object : Reloj {
        override fun monotonico() = 0L
        override fun pared() = 0L
    }
    val cola = Cola(quieto, Azar { min, _ -> min }, listOf("-"), emptyList(), "A".repeat(22), setOf("i"))
    repeat(3) { cola.encolar(Elemento("e$it", Prioridad.FRAGMENTO, it.toLong(), "i", "PUT", "-", "-", null) { ByteArray(0) }) }
    return generateSequence { cola.siguiente() }.count()
}
```

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && ./gradlew --no-daemon :arnes:test && grep -ho "tests=\"[0-9]*\" skipped=\"0\" failures=\"0\" errors=\"0\"" arnes/build/test-results/test/*.xml | awk -F"\"" "{n++; t+=\$2} END {print n \" clases, \" t \" pruebas, sin fallos\"}"'
```

Esperado: `BUILD SUCCESSFUL` y `3 clases, 21 pruebas, sin fallos`.

- [ ] **Paso 7: el bucle del arnés y su distribución**

Un teléfono sintético: alta, apertura (sin envolturas, como el simulador de H1), un fragmento cada `segundos` s durante `minutos` min y el cierre. Cada fragmento lleva `4 000 × segundos` bytes de audio al azar (32 kbps, incompresible como el AAC), y `FabricaSobres` le añade los 28 bytes de AES-GCM; el fragmento k está completo a los k × `segundos` s y su `hora_telefono` es la de su primera muestra. Un solo hilo maneja la cola (no es segura entre hilos): cierra el minuto que acaba, genera lo que toca, registra las respuestas, envía lo que la cola dé por listo y duerme hasta lo siguiente (el próximo minuto, el próximo fragmento, `proximaHora()` o una respuesta). Las peticiones salen por `java.net.http.HttpClient` en HTTP/1.1, firmadas en cada intento con `Peticion.cabeceras` (también el PUT, como el simulador) y con el `idPeticion` del elemento. Tras la grabación espera como mucho 10 min a que la cola se vacíe.

`<banco>/jvm/arnes/src/main/kotlin/vigia/banco/arnes/Main.kt` (sustituye al del andamio):

```kotlin
package vigia.banco.arnes

import java.io.File
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.spec.ECGenParameterSpec
import java.time.Duration
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import vigia.nucleo.Cola
import vigia.nucleo.Cuerpos
import vigia.nucleo.Elemento
import vigia.nucleo.EntradaClave
import vigia.nucleo.FabricaSobres
import vigia.nucleo.FirmanteSoftware
import vigia.nucleo.Pendiente
import vigia.nucleo.Peticion
import vigia.nucleo.Prioridad
import vigia.nucleo.Registros
import vigia.nucleo.Resultado

private const val VACIADO_MS = 600_000L // tras la grabación, cuánto espera como mucho a que la cola se vacíe
private val ESPERA_CONEXION = Duration.ofSeconds(10)
private val ESPERA_PETICION = Duration.ofSeconds(20) // hasta tener la respuesta; un PUT de 8 s sube en unos 3,5 s

/** Uso: arnes <base> <claves-dev.txt> <segundos por fragmento> <minutos> <csv> */
fun main(args: Array<String>) {
    require(args.size == 5) { "Uso: arnes <base> <claves-dev.txt> <segundos por fragmento> <minutos> <csv>" }
    val (base, claves, segundos, minutos, csv) = args
    Arnes(base, leerClaves(File(claves).readBytes()), segundos.toInt(), minutos.toInt(), File(csv)).correr()
}

private fun nuevoPar(): KeyPair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()

/**
 * Arnés de P7 (H0b): un teléfono sintético que graba `minutos` min en fragmentos de `segundos` s a 32 kbps y los
 * sube con la Cola del núcleo contra el Worker. Un solo hilo maneja la cola, que no es segura entre hilos; las
 * respuestas llegan de HttpClient por `vueltas`. Escribe en `csv` una fila por minuto (Medida).
 */
class Arnes(
    private val base: String,
    claves: List<EntradaClave>,
    private val segundos: Int,
    private val minutos: Int,
    private val csv: File,
) {
    private val azar = SecureRandom()
    private val cola = Cola(RelojReal, AzarSeguro(azar), listOf(base), claves)
    private val firmante = FirmanteSoftware(nuevoPar())
    private val http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(ESPERA_CONEXION).build()
    private val vueltas = LinkedBlockingQueue<Pair<Elemento, Resultado>>()
    private val seqDe = HashMap<Elemento, Int>() // los fragmentos sin acuse y su seq
    private var orden = 0L

    fun correr() {
        println("arnés: el núcleo deja ${subidasEnVuelo()} subida(s) en vuelo; fragmentos de $segundos s durante $minutos min contra $base")
        val incidente = nuevoId(azar)
        val fabrica = FabricaSobres(firmante, incidente, ByteArray(32).also(azar::nextBytes))
        encolar(Prioridad.ALTA, null, "POST", Api.DISPOSITIVOS, Api.TIPO_JSON, null, Cuerpos.alta(firmante.spki, nuevoPar().public.encoded))
        val pared = RelojReal.pared()
        val inicio = RelojReal.monotonico()
        val apertura = fabrica.apertura(pared, "VE", "grabar")
        encolar(Prioridad.APERTURA, incidente, "POST", Api.INCIDENTES, Api.TIPO_JSON, Registros.hash(apertura.r), Cuerpos.incidente(apertura, emptyList(), null))
        val medida = Medida(inicio)
        val total = minutos * 60 / segundos
        val fin = inicio + minutos * 60_000L
        var generados = 0
        var minuto = 1
        var cerrado = false
        var vuelta: Pair<Elemento, Resultado>? = null
        csv.printWriter().use { salida ->
            salida.println(Fila.CABECERA)
            println(Fila.CABECERA)
            while (true) {
                val ahora = RelojReal.monotonico()
                // Primero el minuto que acaba: su fila no ve el fragmento que se genera en ese mismo instante.
                while (minuto <= minutos && inicio + minuto * 60_000L <= ahora) {
                    val fila = medida.cerrarMinuto(inicio + minuto * 60_000L).csv()
                    salida.println(fila)
                    salida.flush()
                    println(fila)
                    minuto++
                }
                // El fragmento k está completo a los k × segundos; su hora_telefono es la de su primera muestra.
                while (generados < total && inicio + (generados + 1) * segundos * 1_000L <= ahora) {
                    val audio = ByteArray(4_000 * segundos).also(azar::nextBytes) // 32 kbps; FabricaSobres añade los 28 bytes de GCM
                    val sobre = fabrica.fragmento(pared + generados * segundos * 1_000L, audio)
                    generados++
                    val e = encolar(Prioridad.FRAGMENTO, incidente, "PUT", Api.fragmento(incidente, generados), Api.TIPO_SOBRE, Registros.hash(sobre.r), sobre.cuerpo())
                    seqDe[e] = generados
                    medida.generado(ahora)
                }
                if (generados == total && !cerrado) {
                    val cierre = fabrica.cierre(RelojReal.pared())
                    encolar(Prioridad.CIERRE, incidente, "POST", Api.cierre(incidente), Api.TIPO_JSON, Registros.hash(cierre.r), Cuerpos.cierre(cierre))
                    cerrado = true
                }
                var v = vuelta ?: vueltas.poll()
                while (v != null) {
                    registrar(v.first, v.second, medida, ahora)
                    v = vueltas.poll()
                }
                while (true) {
                    val p = cola.siguiente() ?: break
                    if (p.elemento in seqDe) medida.salida(ahora)
                    enviar(p)
                }
                if (cerrado && cola.pendientes().isEmpty() || ahora >= fin + VACIADO_MS) break
                val despierta = listOfNotNull(
                    (inicio + minuto * 60_000L).takeIf { minuto <= minutos },
                    (inicio + (generados + 1) * segundos * 1_000L).takeIf { generados < total },
                    cola.proximaHora(),
                    fin + VACIADO_MS,
                ).min()
                vuelta = vueltas.poll(maxOf(0, despierta - RelojReal.monotonico()), TimeUnit.MILLISECONDS)
            }
        }
        val tras = (RelojReal.monotonico() - fin) / 1_000
        val quedan = cola.pendientes()
        println(
            if (quedan.isEmpty()) "fin: $total fragmentos y el cierre con acuse; la cola se vació $tras s después de acabar la grabación"
            else "fin: ${quedan.size} envíos sin acuse $tras s después de acabar la grabación (${cola.rechazados().size} rechazados)",
        )
    }

    private fun encolar(prioridad: Prioridad, incidente: String?, metodo: String, ruta: String, tipo: String, rHash: String?, cuerpo: ByteArray): Elemento =
        Elemento(nuevoId(azar), prioridad, orden++, incidente, metodo, ruta, tipo, rHash) { cuerpo }.also(cola::encolar)

    private fun registrar(e: Elemento, r: Resultado, medida: Medida, ahora: Long) {
        cola.registrar(e, r)
        medida.resultado(r)
        val seq = seqDe[e] ?: return
        val acusado = e !in cola.pendientes() // la cola solo lo borra con un acuse que verifica (ACU-02)
        if (acusado) seqDe.remove(e)
        medida.vuelta(ahora, if (acusado) seq else null)
    }

    // Cada intento firma de nuevo con la hora corregida por el desfase; el idPeticion es el del elemento (regla 7).
    private fun enviar(p: Pendiente) {
        val e = p.elemento
        val cuerpo = e.cargar()
        val firmadas = Peticion.cabeceras(firmante, p.dispositivo ?: "registro", e.metodo, e.ruta, RelojReal.pared() + p.desfaseMs, e.id, cuerpo)
        val peticion = HttpRequest.newBuilder(URI.create(p.host + e.ruta))
            .timeout(ESPERA_PETICION)
            .header("Content-Type", e.tipoContenido)
            .apply { firmadas.forEach { (nombre, valor) -> header(nombre, valor) } }
            .method(e.metodo, HttpRequest.BodyPublishers.ofByteArray(cuerpo))
            .build()
        http.sendAsync(peticion, HttpResponse.BodyHandlers.ofByteArray()).whenComplete { r, error ->
            val resultado = if (r == null || error != null) Resultado.Red
            else Clasificador.clasificar(r.statusCode(), { r.headers().firstValue(it).orElse(null) }, r.body())
            vueltas.put(e to resultado)
        }
    }
}
```

`<banco>/jvm/arnes/build.gradle.kts` (sustituye al del andamio):

```kotlin
// Arnés de P7 (tarea 11): la cola real del núcleo contra el Worker, con la red degradada por netem.
plugins {
    application
}

application {
    mainClass.set("vigia.banco.arnes.MainKt")
    applicationDefaultJvmArgs = listOf(
        // La JVM 17 escribe con la codificación del sistema, que en el contenedor no es UTF-8.
        "-Dfile.encoding=UTF-8",
        // wrangler dev (workerd) cierra una conexión tras 5 s sin peticiones y netem retrasa ese cierre: una
        // petición que sale justo entonces encuentra la conexión cerrada. El cliente no reutiliza conexiones con
        // más de 3 s de reposo y, si aun así le pasa, repite la petición en una conexión nueva, como OkHttp (la
        // API de H1 es idempotente: el mismo idPeticion y el mismo cuerpo firmado).
        "-Djdk.httpclient.keepalive.timeout=3",
        "-Djdk.httpclient.enableAllMethodRetry=true",
    )
}
```

📍 Máquina de trabajo; la orden corre dentro de `vigia-build`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/jvm && sha256sum /work/f2-h1/packages/nucleo/build/libs/nucleo.jar && ./gradlew --no-daemon :arnes:test :arnes:installDist && grep -ho "tests=\"[0-9]*\" skipped=\"0\" failures=\"0\" errors=\"0\"" arnes/build/test-results/test/*.xml | awk -F"\"" "{n++; t+=\$2} END {print n \" clases, \" t \" pruebas, sin fallos\"}" && cd arnes/build/install/arnes && sha256sum lib/nucleo.jar lib/bcprov-jdk18on-1.86.jar && grep "^DEFAULT_JVM_OPTS=" bin/arnes'
```

Esperado:

```
188cec81ba0e2ce481e80a0fa3548c6c2d09acf1a7056e1841d75a8cbbc376d9  /work/f2-h1/packages/nucleo/build/libs/nucleo.jar
BUILD SUCCESSFUL in …
3 clases, 21 pruebas, sin fallos
188cec81ba0e2ce481e80a0fa3548c6c2d09acf1a7056e1841d75a8cbbc376d9  lib/nucleo.jar
2af190b300cbb0b35e248ccf5f4a06b6072030aeb3da7a98ec73abe5b4cb371f  lib/bcprov-jdk18on-1.86.jar
DEFAULT_JVM_OPTS='"-Dfile.encoding=UTF-8" "-Djdk.httpclient.keepalive.timeout=3" "-Djdk.httpclient.enableAllMethodRetry=true"'
```

con el aviso `Deprecated Gradle features were used in this build` del plugin de Kotlin, como en la tarea 4. El `nucleo.jar` de la distribución es el de `f2-h1` y bcprov es el de Maven que verifica `verification-metadata.xml` (la suma del informe de H0a). Si `nucleo.jar` da otra suma, parar: no es el núcleo de la etiqueta.

- [ ] **Paso 8: commit del arnés en el banco**

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit:

```sh
git -C <banco> add jvm/arnes/build.gradle.kts jvm/arnes/src/main/kotlin/vigia/banco/arnes/Main.kt jvm/arnes/src/main/kotlin/vigia/banco/arnes/Clasificador.kt jvm/arnes/src/main/kotlin/vigia/banco/arnes/Medida.kt jvm/arnes/src/main/kotlin/vigia/banco/arnes/Contrato.kt jvm/arnes/src/test/kotlin/vigia/banco/arnes/ClasificadorTest.kt jvm/arnes/src/test/kotlin/vigia/banco/arnes/MedidaTest.kt jvm/arnes/src/test/kotlin/vigia/banco/arnes/ContratoTest.kt
git -C <banco> diff --cached --stat | tail -1
git -C <banco> commit -q -m "Arnés de P7: la cola del núcleo contra el Worker, con clasificador y medida por minuto

El clasificador aplica la tabla de respuestas del contrato de H1 (sección 17).
La medida integra en el tiempo el retraso en fragmentos y guarda, por minuto,
la cola que no llega a vaciarse. Núcleo de f2-h1 (nucleo.jar 188cec81)." && git -C <banco> log --oneline -1
```

Esperado: ` 8 files changed, 669 insertions(+), 3 deletions(-)` y el commit con su hash corto.

- [ ] **Paso 9: la prueba del análisis**

`analizar.py` da el veredicto del plan maestro por duración a partir de los CSV del arnés. La prueba lo ejecuta con tandas inventadas: una que cumple, una cola que crece, el retraso justo en el límite del 5 % y un milisegundo por encima, acuses fuera de orden (suspenden el plan B y, sin él, se muestran pero no deciden), la duración más corta y el plan B aparte, una tanda corta y un CSV ajeno. Corre con la biblioteca estándar en la máquina de trabajo.

`<banco>/p7/prueba_analizar.py`:

```python
"""Pruebas de analizar.py (H0b, tarea 11) con tandas inventadas. Uso: python3 -I prueba_analizar.py"""
import pathlib
import subprocess
import sys
import tempfile
import unittest

ANALIZAR = pathlib.Path(__file__).with_name('analizar.py')
CABECERA = 'minuto,pendientes,pendientes_min,en_vuelo,retraso,ms_retraso_sobre_2,acuses,fuera_de_orden,rechazos,limites,internos,red'


def tanda(minutos=30, pendientes_min=lambda m: 0, ms_sobre_2=0, fuera_de_orden=0):
    """CSV de una tanda: 15 acuses por minuto, un fragmento en vuelo y lo que se pida en cada columna."""
    filas = [f'{m},0,{pendientes_min(m)},1,1,{ms_sobre_2},15,{fuera_de_orden},0,0,0,0' for m in range(1, minutos + 1)]
    return '\n'.join([CABECERA, *filas]) + '\n'


class PruebaAnalizar(unittest.TestCase):
    def analizar(self, **tandas):
        """Escribe cada tanda como <nombre>.csv y devuelve la salida de analizar.py."""
        with tempfile.TemporaryDirectory() as carpeta:
            rutas = []
            for nombre, texto in tandas.items():
                ruta = pathlib.Path(carpeta, nombre.replace('_', '-') + '.csv')
                ruta.write_text(texto, encoding='ascii')
                rutas.append(str(ruta))
            r = subprocess.run([sys.executable, '-I', str(ANALIZAR), *rutas], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout

    def test_cola_que_se_vacia_y_retraso_bajo_cumple(self):
        salida = self.analizar(d4=tanda())
        self.assertIn('cola que no se vacía en el minuto 1: 0; en el minuto 30: 0 (no supera)', salida)
        self.assertIn('retraso de 2 fragmentos o menos: 100,0 % del tiempo', salida)
        self.assertIn('veredicto: cumple', salida)
        self.assertIn('P7: la duración más corta que cumple es 4 s', salida)

    def test_cola_que_crece_no_cumple(self):
        salida = self.analizar(d2=tanda(pendientes_min=lambda m: m - 1))
        self.assertIn('en el minuto 30: 29 (supera)', salida)
        self.assertIn('veredicto: no cumple', salida)
        self.assertIn('P7: ninguna tanda de 30 min cumple', salida)

    def test_retraso_sobre_2_justo_el_5_por_ciento_cumple_y_un_ms_mas_no(self):
        self.assertIn('veredicto: cumple', self.analizar(d4=tanda(ms_sobre_2=3_000)))
        salida = self.analizar(d4=tanda(ms_sobre_2=3_001))
        self.assertIn('retraso de 2 fragmentos o menos: 94,9 % del tiempo', salida)
        self.assertIn('veredicto: no cumple', salida)

    def test_acuses_fuera_de_orden_en_el_plan_b_no_cumplen(self):
        salida = self.analizar(d8_b=tanda(fuera_de_orden=1))
        self.assertIn('con dos subidas en vuelo (plan B)', salida)
        self.assertIn('acuses fuera de orden: 30', salida)
        self.assertIn('veredicto: no cumple', salida)

    def test_fuera_de_orden_sin_plan_b_se_muestra_pero_no_decide(self):
        salida = self.analizar(d4=tanda(fuera_de_orden=1))
        self.assertIn('acuses fuera de orden: 30', salida)
        self.assertIn('veredicto: cumple', salida)

    def test_la_mas_corta_que_cumple_sin_plan_b_y_el_plan_b_aparte(self):
        crece = tanda(pendientes_min=lambda m: m - 1)
        self.assertIn('P7: la duración más corta que cumple es 4 s', self.analizar(d2=crece, d4=tanda(), d8=tanda()))
        salida = self.analizar(d2=crece, d4=crece, d8=crece, d8_b=tanda())
        self.assertIn('P7: ninguna duración cumple con una subida en vuelo; el plan B cumple con 8 s', salida)

    def test_una_tanda_corta_no_da_veredicto(self):
        salida = self.analizar(d4=tanda(minutos=3))
        self.assertIn('aviso: tanda de 3 min', salida)
        self.assertIn('P7: sin tandas de 30 min, no hay veredicto', salida)

    def test_un_csv_que_no_es_del_arnes_se_rechaza(self):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = pathlib.Path(carpeta, 'd4.csv')
            ruta.write_text('minuto,cola\n1,0\n', encoding='ascii')
            r = subprocess.run([sys.executable, '-I', str(ANALIZAR), str(ruta)], capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('no es un CSV del arnés', r.stderr)


unittest.main(verbosity=2)
```

📍 Máquina de trabajo.

Ejecutar:

```sh
python3 -I <banco>/p7/prueba_analizar.py
```

Esperado: ocho `FAIL`, cada uno con `can't open file '<banco>/p7/analizar.py': [Errno 2] No such file or directory`, y al final `FAILED (failures=8)`.

- [ ] **Paso 10: el análisis**

La cola de un minuto es la parte que no llega a vaciarse en todo el minuto (el mínimo de fragmentos esperando turno): la foto al acabar el minuto depende de si justo entonces hay un PUT a medias (nota 4). El porcentaje se calcula con enteros y se redondea hacia abajo, para que un 94,99 % no salga como "95,0".

`<banco>/p7/analizar.py`:

```python
"""Veredicto de P7 (H0b, tarea 11) por duración del fragmento, con el criterio del plan maestro: "la cola del
minuto 30 no supera a la del minuto 1, y el retraso es de 2 fragmentos o menos el 95 % del tiempo". El plan B
(8 s con dos subidas en vuelo) pide además no romper el orden de los acuses.

Lee los CSV del arnés (una fila por minuto):
- la cola de un minuto es su columna pendientes_min: el mínimo de fragmentos sin acuse que esperan turno (sin
  los que van en vuelo) en todo el minuto, la parte de la cola que no llega a vaciarse. Una cola que no crece
  se vacía cada poco y da 0; una que crece arrastra lo que no le da tiempo a subir y su mínimo sube con ella.
  La foto al acabar el minuto (pendientes) depende de si justo entonces hay un PUT a medias: se muestra, pero
  no decide;
- el tiempo con el retraso por encima de 2 fragmentos es la suma de ms_retraso_sobre_2, que el arnés integra;
- un acuse fuera de orden es el de un fragmento que llega con alguno anterior todavía sin acuse.

Uso: python3 -I analizar.py <dN.csv>...   (d2.csv, d4.csv y d8.csv; d8-b.csv si se hizo el plan B)
"""
import csv
import re
import sys

CABECERA = ['minuto', 'pendientes', 'pendientes_min', 'en_vuelo', 'retraso', 'ms_retraso_sobre_2', 'acuses',
            'fuera_de_orden', 'rechazos', 'limites', 'internos', 'red']
MINUTOS = 30


def analizar(ruta):
    nombre = re.search(r'd([0-9]+)(-b)?\.csv$', ruta)
    with open(ruta, newline='', encoding='ascii') as f:
        filas = list(csv.reader(f))
    if nombre is None or not filas or filas[0] != CABECERA or len(filas) < 2:
        raise SystemExit(f'{ruta}: no es un CSV del arnés')
    filas = [dict(zip(CABECERA, map(int, fila))) for fila in filas[1:]]
    if [f['minuto'] for f in filas] != list(range(1, len(filas) + 1)):
        raise SystemExit(f'{ruta}: faltan minutos')
    segundos, plan_b, n = int(nombre.group(1)), nombre.group(2) is not None, len(filas)
    cola_1, cola_n = filas[0]['pendientes_min'], filas[-1]['pendientes_min']
    total_ms, sobre_2 = n * 60_000, sum(f['ms_retraso_sobre_2'] for f in filas)
    retraso_bien = 20 * sobre_2 <= total_ms  # por encima de 2 fragmentos, el 5 % del tiempo como mucho
    decimas = 1000 * (total_ms - sobre_2) // total_ms  # el % con 2 o menos, en décimas y por abajo
    fuera = sum(f['fuera_de_orden'] for f in filas)
    total = {k: sum(f[k] for f in filas) for k in ('acuses', 'rechazos', 'limites', 'internos', 'red')}
    cumple = cola_n <= cola_1 and retraso_bien and (fuera == 0 or not plan_b)  # el orden solo lo pide el plan B

    print(f'{ruta}: fragmentos de {segundos} s{", con dos subidas en vuelo (plan B)" if plan_b else ""}; {n} min')
    if n < MINUTOS:
        print(f'  aviso: tanda de {n} min; el criterio pide {MINUTOS} y este veredicto no vale para el informe')
    print(f'  cola que no se vacía en el minuto 1: {cola_1}; en el minuto {n}: {cola_n} ({"no supera" if cola_n <= cola_1 else "supera"})')
    print(f'  esperando turno al acabar el minuto 1: {filas[0]["pendientes"]}; al acabar el {n}: {filas[-1]["pendientes"]}')
    print(f'  retraso de 2 fragmentos o menos: {decimas // 10},{decimas % 10} % del tiempo (pide 95 %)')
    print(f'  acuses fuera de orden: {fuera}')
    print(f'  en total: {total["acuses"]} acuses, {total["rechazos"]} rechazos, {total["limites"]} límites, '
          f'{total["internos"]} internos y {total["red"]} fallos de red')
    print(f'  veredicto: {"cumple" if cumple else "no cumple"}')
    return segundos, plan_b, cumple, n >= MINUTOS


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Uso: python3 -I analizar.py <dN.csv>...')
    resultados = [analizar(ruta) for ruta in sys.argv[1:]]
    validas = [(segundos, plan_b, cumple) for segundos, plan_b, cumple, completa in resultados if completa]
    sin_b = sorted(segundos for segundos, plan_b, cumple in validas if cumple and not plan_b)
    con_b = sorted(segundos for segundos, plan_b, cumple in validas if cumple and plan_b)
    if not validas:
        print(f'P7: sin tandas de {MINUTOS} min, no hay veredicto')
    elif sin_b:
        print(f'P7: la duración más corta que cumple es {sin_b[0]} s')
    elif con_b:
        print(f'P7: ninguna duración cumple con una subida en vuelo; el plan B cumple con {con_b[0]} s')
    else:
        print(f'P7: ninguna tanda de {MINUTOS} min cumple')


main()
```

📍 Máquina de trabajo.

Ejecutar:

```sh
python3 -I <banco>/p7/prueba_analizar.py
```

Esperado: las ocho pruebas con `... ok`, `Ran 8 tests` y `OK`.

- [ ] **Paso 11: el worker, la calibración y el guion de la prueba**

`p7.sh` corre en la máquina de trabajo y solo llama a `docker`. Monta dos contenedores en `vigia-p7`, los dos con `--init`, el usuario 1001, `--cap-drop ALL`, `no-new-privileges` y el volumen `vigia-trabajo`, sin puertos publicados:
- `p7-worker` ejecuta `worker.sh`: genera con `generar-dev-vars.ts` la clave de acuse de dev (en su tmpfs) y la lista pública (en el volumen), aplica la migración de la D1 local y arranca `wrangler dev` del backend de `f2-h1` en la IP del contenedor en `vigia-p7`, puerto 8787, con el inspector en 127.0.0.1. Usa una copia de `wrangler.prueba.jsonc` con las rutas absolutas y deja configuración, registros y caché de wrangler en el tmpfs: no escribe nada en `/work/f2-h1`.
- `p7-arnes` solo espera órdenes (`sleep infinity`): ahí corren la calibración y el arnés.

netem lo aplica `p7-netem`, un contenedor de un solo uso que comparte la red del destino (`--network container:…`), con el usuario 0, solo `NET_ADMIN` (decisión 5) y sin el volumen de trabajo, y se borra al terminar; lo aplicado se queda en la red de ese contenedor hasta que se para. El perfil del plan maestro (subida de 96 kbit/s, RTT de 600 ± 200 ms y 3 % de pérdida) se reparte así:
- Retraso: 300 ± 100 ms (uniforme) en cada sentido. El RTT queda en 600 de media y entre 400 y 800 ms (la suma de los dos sorteos), simétrico como un enlace de radio.
- Pérdida: 3 % en cada sentido, independiente. La subida, que es donde van los datos, pierde exactamente el 3 %; un ida y vuelta pierde el 5,9 %. Es la lectura pesimista de "3 % de pérdida" sin sentido.
- Ritmo: 96 kbit/s en la subida (sale de `p7-arnes`). En la bajada (sale de `p7-worker`), 1 Mbit/s, que no limita nada (las respuestas de la API son de menos de 1 KB): está para que netem ordene.
- Reordenamiento: evitado. Con `rate`, netem calcula la salida de cada paquete a partir del último que tiene en cola, así que el jitter nunca hace que un paquete adelante a otro. La consecuencia, declarada: en una ráfaga, cada paquete espera al anterior y el retraso efectivo tiende al mayor de los sorteados; es lo que hace un enlace móvil que entrega en orden, y es pesimista para P7 (lo que la máquina no mide, y favorece a las duraciones cortas, está en la nota 8). TCP lo confirma: sus contadores de reordenamiento (`TCPSACKReorder`, `TCPRenoReorder` y `TCPTSReorder`) siguen en 0 tras la calibración y tras cada tanda, y quedan en `p7-calibracion.txt` y al final del registro de cada tanda.
- `gso_max_segs 1` en las dos interfaces: netem ve paquetes reales. Con GSO, un "paquete" de netem podía ser un bloque de varios segmentos TCP y una pérdida los tiraría todos.

La calibración mide lo aplicado con la biblioteca estándar, dentro de `p7-arnes`: el RTT y la pérdida con 200 conexiones TCP (el saludo tarda un RTT; si se pierde el SYN o el SYN-ACK, Linux lo repite al cabo de 1 s) y el ritmo con tres PUT de 60 000 bytes que el worker lee enteros antes de responder 400 `formato`. Cada conexión se cierra con RST y espera medio segundo, para que la cola de netem esté vacía al salir el SYN siguiente: sin esa espera, el SYN sale detrás del ACK y del FIN de la conexión anterior y, como netem entrega en orden, la mediana sube a unos 700 ms (visto en la validación).

`<banco>/p7/worker.sh`:

```sh
#!/bin/sh
# Worker de P7 (H0b, tarea 11), dentro de p7-worker: el backend de f2-h1 con wrangler dev en la IP del
# contenedor en vigia-p7 (excepción acotada a OPS-03, decisión 5), con la D1 y el R2 locales de Miniflare.
# La clave de acuse de dev (.dev.vars), la configuración y todo lo que escribe wrangler viven en el tmpfs
# /tmp/p7 y desaparecen al parar el contenedor; al volumen solo va la lista pública de claves, que lee el arnés.
# Por entorno: F2H1 (/work/f2-h1) y P7 (/work/h0b/p7).
set -eu
F2H1=${F2H1:-/work/f2-h1}
P7=${P7:-/work/h0b/p7}
BACKEND="$F2H1/packages/backend"
DIR=/tmp/p7
umask 077
mkdir "$DIR"
mkdir -p "$P7"
# Sin métricas y con la configuración, los registros y la caché de wrangler en el tmpfs.
export WRANGLER_SEND_METRICS=false XDG_CONFIG_HOME="$DIR/config" WRANGLER_CACHE_DIR="$DIR/cache"

# La configuración de pruebas de H1 tal cual, con sus dos rutas absolutas: así wrangler deja su .wrangler/
# en el tmpfs y no escribe nada en la copia de f2-h1.
python3 -I - "$BACKEND" "$DIR/wrangler.json" <<'EOF'
import json
import sys

backend, destino = sys.argv[1], sys.argv[2]
with open(backend + '/wrangler.prueba.jsonc', encoding='utf-8') as f:
    config = json.load(f)
config['main'] = backend + '/src/index.ts'
config['d1_databases'][0]['migrations_dir'] = backend + '/migraciones'
with open(destino, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2)
EOF

node "$BACKEND/herramientas/generar-dev-vars.ts" "$DIR/.dev.vars" "$P7/claves-dev.txt"
cd "$DIR"
"$BACKEND/node_modules/.bin/wrangler" d1 migrations apply DB --local -c wrangler.json --persist-to estado
exec "$BACKEND/node_modules/.bin/wrangler" dev -c wrangler.json --ip "$(hostname -i)" --port 8787 \
    --inspector-ip 127.0.0.1 --persist-to estado --show-interactive-dev-session=false
```

`<banco>/p7/calibrar.py`:

```python
"""Calibración de la red de P7 (H0b, tarea 11), dentro de p7-arnes y antes de las tandas.

Mide lo que netem aplica entre p7-arnes y p7-worker (biblioteca estándar, sin dependencias):
- RTT y pérdida: 200 conexiones TCP al worker. Cada una tarda un RTT (SYN y SYN-ACK). Si se pierde uno de
  los dos, Linux lo repite al cabo de 1 s: las que tardan 1 s o más son las que perdieron un paquete.
  Cada conexión se cierra con RST y espera medio segundo, para que la cola de netem esté vacía cuando sale
  el SYN siguiente. Si no, el SYN sale detrás del ACK y del FIN de la anterior y, como netem con rate
  entrega en orden, su retraso es el mayor de los sorteados (la mediana sube a unos 700 ms).
- Ritmo de subida: 3 PUT de 60 000 bytes, cada uno por una conexión ya abierta y en reposo. El worker lee el
  cuerpo entero antes de responder 400 formato, así que el tiempo es la subida más un RTT.

Uso: python3 -I calibrar.py <IP del worker>
     python3 -I calibrar.py contadores   (segmentos TCP de p7-arnes y reordenamientos que vio TCP)
"""
import http.client
import socket
import statistics
import struct
import sys
import time

PUERTO = 8787
CONEXIONES = 200
CUERPO = 60_000
RUTA = '/v1/incidents/' + 'A' * 22 + '/chunks/1'


def coma(x):
    return f'{x:.1f}'.replace('.', ',')


def conexiones(ip):
    rtt, perdidas = [], 0
    for _ in range(CONEXIONES):
        t0 = time.monotonic()
        conexion = socket.create_connection((ip, PUERTO), timeout=10)
        ms = (time.monotonic() - t0) * 1000
        conexion.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack('ii', 1, 0))  # cierra con RST
        conexion.close()
        time.sleep(0.5)
        if ms >= 1000:
            perdidas += 1
        else:
            rtt.append(ms)
    return rtt, perdidas


def subidas(ip):
    tiempos = []
    for _ in range(3):
        conexion = http.client.HTTPConnection(ip, PUERTO, timeout=60)
        conexion.connect()
        time.sleep(0.5)  # que el ACK del saludo salga antes de medir
        t0 = time.monotonic()
        conexion.request('PUT', RUTA, body=bytes(CUERPO), headers={'Content-Type': 'application/vnd.vigia.sobre'})
        respuesta = conexion.getresponse()
        respuesta.read()
        tiempos.append(time.monotonic() - t0)
        conexion.close()
        if respuesta.status != 400:
            raise SystemExit(f'MAL: el PUT de calibración da {respuesta.status} y no 400')
    return tiempos


def tabla(ruta, prefijo):
    with open(ruta, encoding='ascii') as f:
        filas = [linea.split() for linea in f if linea.startswith(prefijo)]
    return dict(zip(filas[0][1:], map(int, filas[1][1:])))


def contadores():
    tcp = tabla('/proc/net/snmp', 'Tcp:')
    ext = tabla('/proc/net/netstat', 'TcpExt:')
    enviados, repetidos = tcp['OutSegs'], tcp['RetransSegs']
    print(f'segmentos TCP que envió p7-arnes: {enviados}; retransmitidos: {repetidos} ({coma(100 * repetidos / max(enviados, 1))} %)')
    print('reordenamientos que vio TCP: ' + ', '.join(f'{k} {v}' for k, v in ext.items() if 'Reorder' in k))


def comprobar(cumple, texto):
    print(('bien: ' if cumple else 'MAL: ') + texto)
    return cumple


def main():
    if sys.argv[1:] == ['contadores']:
        contadores()
        return
    ip = sys.argv[1]
    rtt, perdidas = conexiones(ip)
    mediana = statistics.median(rtt)
    print(f'RTT de {len(rtt)} conexiones sin pérdida: mínimo {min(rtt):.0f} ms, mediana {mediana:.0f} ms, máximo {max(rtt):.0f} ms')
    print(f'conexiones que perdieron el SYN o el SYN-ACK: {perdidas} de {CONEXIONES} ({coma(100 * perdidas / CONEXIONES)} %; con 3 % en cada sentido, 5,9 %)')
    tiempos = subidas(ip)
    kbit = CUERPO * 8 / (min(tiempos) - mediana / 1000) / 1000
    print(f'PUT de 60 000 bytes: {"; ".join(coma(t) + " s" for t in tiempos)}; el mejor, sin un RTT: {coma(kbit)} kbit/s de carga útil')
    bien = all([
        comprobar(570 <= mediana <= 650, 'RTT mediana entre 570 y 650 ms (netem: 600)'),
        comprobar(min(rtt) >= 400 and max(rtt) <= 830, 'RTT entre 400 y 830 ms (netem: 400 a 800, más lo que tarda el paquete en salir)'),
        comprobar(2 <= perdidas <= 24, 'entre el 1 % y el 12 % de las conexiones pierden un paquete'),
        comprobar(75 <= kbit <= 96, 'subida entre 75 y 96 kbit/s (netem: 96 en la línea; las cabeceras TCP/IP se llevan cerca del 5 %)'),
    ])
    contadores()
    print('calibración: ' + ('bien' if bien else 'MAL'))
    sys.exit(0 if bien else 1)


main()
```

`<banco>/p7/p7.sh`:

```sh
#!/bin/sh
# P7 en la máquina de build (H0b, tarea 11): la cola real del núcleo (arnés en p7-arnes) contra el backend de
# f2-h1 (wrangler dev en p7-worker), los dos en la red interna vigia-p7, sin salida a internet ni puertos
# publicados. netem lo aplica un contenedor auxiliar de un solo uso, p7-netem, el único con NET_ADMIN y el
# único que no es el usuario 1001 (excepción acotada a OPS-03, decisión 5 del plan de H0b).
# Corre en la máquina de trabajo y solo llama a docker.
#
# Uso: sh p7.sh montar | netem | calibrar | tanda <segundos> <minutos> [b] | planb | analizar | limpiar
# Por entorno: IMAGEN (vigia-build:h0b) y las rutas dentro del volumen vigia-trabajo BANCO (/work/banco),
# F2H1 (/work/f2-h1) y P7 (/work/h0b/p7, donde quedan los resultados).
set -eu
IMAGEN=${IMAGEN:-vigia-build:h0b}
BANCO=${BANCO:-/work/banco}
F2H1=${F2H1:-/work/f2-h1}
P7=${P7:-/work/h0b/p7}
# SHA-256 del nucleo.jar de la copia de f2-h1 con EN_VUELO_POR_CLASE = 2 (Gradle 9 hace jar reproducibles).
NUCLEO_B=a7ad24667b94b79bb4b4c1c36bfd57118d95fde04962bf95d5d79f9853374fb6
# ENV-01 en todos los contenedores de P7: init (recoge los huérfanos), sin capacidades, sin privilegios nuevos.
# El volumen de trabajo va aparte, solo en los que lo usan (el análisis, en solo lectura): p7-netem, el único
# con privilegios, no lo monta.
COMUN="--init --cap-drop ALL --security-opt no-new-privileges"

ip_worker() {
    docker inspect -f '{{(index .NetworkSettings.Networks "vigia-p7").IPAddress}}' p7-worker
}

case "${1:-}" in
montar)
    test "$(docker network inspect -f '{{.Internal}}' vigia-p7)" = true || { echo "MAL: vigia-p7 no es una red interna"; exit 1; }
    # El tmpfs de p7-worker guarda la clave de acuse de dev y el estado de wrangler: se va al parar el contenedor.
    docker run -d --name p7-worker $COMUN --network vigia-p7 --user 1001 --tmpfs /tmp:size=256m \
        -v vigia-trabajo:/work -e F2H1="$F2H1" -e P7="$P7" "$IMAGEN" sh "$BANCO/p7/worker.sh" > /dev/null
    docker run -d --name p7-arnes $COMUN --network vigia-p7 --user 1001 --tmpfs /tmp:size=64m -v vigia-trabajo:/work \
        "$IMAGEN" sleep infinity > /dev/null
    ip=$(ip_worker)
    docker exec p7-arnes sh -c 'for i in $(seq 120); do curl -s -o /dev/null -m 2 "http://$1:8787/" && exit 0; sleep 1; done; exit 1' sh "$ip" \
        || { echo "MAL: el worker no responde"; docker logs --tail 20 p7-worker; exit 1; }
    echo "worker: $(docker exec p7-arnes curl -s -m 5 -w ' %{http_code}' "http://$ip:8787/")"
    # OPS-03 con la excepción de la decisión 5: nada en 0.0.0.0 ni en ::, y en la IP de vigia-p7 solo wrangler dev.
    docker exec p7-worker ss -ltnpH | while read -r _ _ _ local _ proceso; do
        proceso=$(echo "$proceso" | sed 's/^users:(("\([^"]*\)".*/\1/')
        case "$local" in
            127.*) echo "bien (local) $local $proceso" ;;
            "$ip:8787") echo "bien (vigia-p7: wrangler dev) $local $proceso" ;;
            "$ip":*) [ "$proceso" = MainThread ] && echo "bien (vigia-p7: servidor de vuelta de Miniflare) $local $proceso" || echo "MAL $local $proceso" ;;
            *) echo "MAL $local $proceso" ;;
        esac
    done
    for c in p7-worker p7-arnes; do
        docker exec "$c" sh -c 'curl -s -o /dev/null -m 5 https://1.1.1.1/ || getent hosts registry.npmjs.org > /dev/null' \
            && echo "MAL: $c sale a internet" || echo "bien: $c sin salida a internet"
    done
    docker exec vigia-build curl -s -o /dev/null -m 5 "http://$ip:8787/" \
        && echo "MAL: vigia-build llega al worker" || echo "bien: desde fuera de vigia-p7 no se llega al worker"
    [ -z "$(docker port p7-worker)$(docker port p7-arnes)" ] && echo "bien: sin puertos publicados" || echo "MAL: hay puertos publicados"
    ;;
netem)
    # Subida (sale de p7-arnes): 96 kbit/s, 300 ± 100 ms y 3 % de pérdida. Bajada (sale de p7-worker): 300 ± 100 ms
    # y 3 %, con 1 Mbit/s, que no limita (las respuestas son de menos de 1 KB). Con rate, netem saca cada paquete
    # después del anterior: el jitter no reordena. gso_max_segs 1: netem ve los paquetes reales (con GSO, una
    # pérdida tiraría varios segmentos a la vez).
    for destino in "p7-arnes 96kbit" "p7-worker 1mbit"; do
        set -- $destino
        docker run --rm --name p7-netem $COMUN --user 0 --cap-add NET_ADMIN --network "container:$1" "$IMAGEN" sh -c \
            'ip link set dev eth0 gso_max_segs 1 && tc qdisc replace dev eth0 root netem delay 300ms 100ms loss 3% rate "$2" && echo "$1: $(tc qdisc show dev eth0); $(ip -d link show eth0 | grep -o "gso_max_segs [0-9]*"); usuario $(id -u), CapEff $(awk "/^CapEff/ {print \$2}" /proc/self/status)"' \
            sh "$1" "$2"
    done
    ;;
calibrar)
    docker exec p7-arnes python3 -I "$BANCO/p7/calibrar.py" "$(ip_worker)"
    ;;
tanda)
    # tanda <segundos> <minutos> [b]: con b, el arnés del plan B (dos subidas en vuelo; antes, sh p7.sh planb).
    # El registro acaba con los contadores de TCP de p7-arnes (acumulados desde que arrancó).
    nombre="d$2${4:+-$4}"
    arnes="$BANCO/jvm/arnes/build/install/arnes"
    [ "${4:-}" = b ] && arnes="$P7/arnes-b"
    docker exec p7-arnes sh -c 'mkdir -p "$3/resultados" && { "$1/bin/arnes" "http://$2:8787" "$3/claves-dev.txt" "$4" "$5" "$3/resultados/$6.csv"; echo "salida del arnés: $?"; python3 -I "$7/p7/calibrar.py" contadores; } 2>&1 | tee "$3/resultados/$6.log"' \
        sh "$arnes" "$(ip_worker)" "$P7" "$2" "$3" "$nombre" "$BANCO"
    ;;
planb)
    # Plan B: una copia del núcleo de f2-h1 con EN_VUELO_POR_CLASE = 2, solo para el arnés (en vigia-build, que
    # tiene la caché de Gradle). La distribución del arnés es la misma con ese nucleo.jar en lib/.
    docker exec vigia-build sh -c 'set -e
        rm -rf "$2/nucleo-b" "$2/arnes-b"
        mkdir -p "$2/nucleo-b"
        cp -a "$1/packages/nucleo/." "$2/nucleo-b/"
        cd "$2/nucleo-b"
        rm -rf build .gradle .kotlin
        sed -i "s/const val EN_VUELO_POR_CLASE = 1 /const val EN_VUELO_POR_CLASE = 2 /" src/main/kotlin/vigia/nucleo/Cola.kt
        diff "$1/packages/nucleo/src/main/kotlin/vigia/nucleo/Cola.kt" src/main/kotlin/vigia/nucleo/Cola.kt || true
        ./gradlew --no-daemon -q jar
        echo "$4  build/libs/nucleo.jar" | sha256sum -c
        cp -a "$3/jvm/arnes/build/install/arnes" "$2/arnes-b"
        cp build/libs/nucleo.jar "$2/arnes-b/lib/nucleo.jar"' sh "$F2H1" "$P7" "$BANCO" "$NUCLEO_B"
    ;;
analizar)
    docker run --rm $COMUN --network none --user 1001 -v vigia-trabajo:/work:ro "$IMAGEN" sh -c 'python3 -I "$1/p7/analizar.py" "$2"/resultados/d*.csv' sh "$BANCO" "$P7"
    ;;
limpiar)
    # Con p7-worker se van su tmpfs (clave de acuse de dev, .dev.vars, configuración y estado de wrangler) y,
    # con cada contenedor, su netem. Los resultados quedan en $P7/resultados.
    docker stop p7-arnes p7-worker > /dev/null 2>&1 || true
    docker rm -f p7-arnes p7-worker > /dev/null 2>&1 || true
    docker run --rm $COMUN --network none --user 1001 -v vigia-trabajo:/work "$IMAGEN" rm -rf "$P7/claves-dev.txt" "$P7/nucleo-b" "$P7/arnes-b"
    echo "contenedores de P7: $(docker ps -aq --filter name=p7- | wc -l)"
    echo "contenedores en vigia-p7: $(docker network inspect -f '{{len .Containers}}' vigia-p7)"
    ;;
*)
    echo "Uso: sh p7.sh montar | netem | calibrar | tanda <segundos> <minutos> [b] | planb | analizar | limpiar" >&2
    exit 2
    ;;
esac
```

`NUCLEO_B` es la suma del `nucleo.jar` que da el paso `planb`: el mismo jar, byte a byte, en dos carpetas distintas (Gradle 9 hace jar reproducibles, como el de `f2-h1`).

📍 Máquina de trabajo.

Ejecutar:

```sh
sh -n <banco>/p7/p7.sh && sh -n <banco>/p7/worker.sh && python3 -I -c 'import ast, sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())' <banco>/p7/calibrar.py && echo "sintaxis bien"
```

Esperado: `sintaxis bien`.

- [ ] **Paso 12: montar la prueba en `vigia-p7`**

`sincronizar banco` lleva `p7/` a `/work/banco`, donde lo leen los contenedores; la distribución del arnés del paso 7 sigue en `/work/banco/jvm/arnes/build/install/arnes` (`sincronizar` no toca lo que ignora git). `montar` espera a que el worker responda y hace las comprobaciones de OPS-03 con la excepción de la decisión 5: nada escucha en `0.0.0.0` ni en `::`; en la IP de `vigia-p7`, solo `wrangler dev` (8787) y el servidor de vuelta de Miniflare (puerto al azar, nota 2); sin salida a internet desde ningún contenedor; desde fuera de `vigia-p7` (desde `vigia-build`) no se llega al worker, y sin puertos publicados.

📍 Máquina de trabajo; `sincronizar` corre dentro de `vigia-build` y `p7.sh` llama a `docker`.

Ejecutar:

```sh
docker exec vigia-build sh -c 'sincronizar banco'
sh <banco>/p7/p7.sh montar
docker inspect -f '{{.Name}}: init={{.HostConfig.Init}} usuario={{.Config.User}} sin={{.HostConfig.CapDrop}} con={{.HostConfig.CapAdd}} {{.HostConfig.SecurityOpt}} red={{.HostConfig.NetworkMode}} puertos={{len .HostConfig.PortBindings}} {{range .Mounts}}{{.Type}}:{{.Name}}->{{.Destination}} {{end}}tmpfs={{.HostConfig.Tmpfs}}' p7-worker p7-arnes
```

Esperado (en unos 10 s; las escuchas pueden salir en otro orden y los puertos `<…>` son al azar):

```
worker: {"codigo":"no_existe"} 404
bien (local) 127.0.0.1:9229 workerd
bien (local) 127.0.0.1:<puerto> workerd
bien (local) 127.0.0.1:<puerto> workerd
bien (local) 127.0.0.1:<puerto> workerd
bien (local) 127.0.0.1:<puerto> workerd
bien (local) 127.0.0.1:<puerto> MainThread
bien (local) 127.0.0.11:<puerto> 
bien (vigia-p7: wrangler dev) <IP>:8787 workerd
bien (vigia-p7: servidor de vuelta de Miniflare) <IP>:<puerto> MainThread
bien: p7-worker sin salida a internet
bien: p7-arnes sin salida a internet
bien: desde fuera de vigia-p7 no se llega al worker
bien: sin puertos publicados
/p7-worker: init=true usuario=1001 sin=[ALL] con=[] [no-new-privileges] red=vigia-p7 puertos=0 volume:vigia-trabajo->/work tmpfs=map[/tmp:size=256m]
/p7-arnes: init=true usuario=1001 sin=[ALL] con=[] [no-new-privileges] red=vigia-p7 puertos=0 volume:vigia-trabajo->/work tmpfs=map[/tmp:size=64m]
```

`<IP>` es la de `p7-worker` en `vigia-p7` (`192.168.128.0/20`). `127.0.0.11` es el DNS interno de Docker. Con una línea `MAL`, o si el worker no responde (`montar` enseña las 20 últimas líneas de `docker logs p7-worker`), parar y limpiar (paso 20). `docker logs p7-worker` muestra `Unable to fetch the Request.cf object! Falling back to a default placeholder` con `EAI_AGAIN workers.cloudflare.com`: es wrangler intentando salir a internet sin conseguirlo, y el Worker no usa `request.cf`.

- [ ] **Paso 13: la calibración sabe fallar sin netem**

📍 Máquina de trabajo; `p7.sh` llama a `docker`.

Ejecutar:

```sh
sh <banco>/p7/p7.sh calibrar; echo "salida: $?"
```

Esperado (unos 2 min):

```
RTT de 200 conexiones sin pérdida: mínimo 0 ms, mediana 0 ms, máximo <0 a 3> ms
conexiones que perdieron el SYN o el SYN-ACK: 0 de 200 (0,0 %; con 3 % en cada sentido, 5,9 %)
PUT de 60 000 bytes: 0,0 s; 0,0 s; 0,0 s; el mejor, sin un RTT: <un número enorme> kbit/s de carga útil
MAL: RTT mediana entre 570 y 650 ms (netem: 600)
MAL: RTT entre 400 y 830 ms (netem: 400 a 800, más lo que tarda el paquete en salir)
MAL: entre el 1 % y el 12 % de las conexiones pierden un paquete
MAL: subida entre 75 y 96 kbit/s (netem: 96 en la línea; las cabeceras TCP/IP se llevan cerca del 5 %)
segmentos TCP que envió p7-arnes: <n>; retransmitidos: 0 (0,0 %)
reordenamientos que vio TCP: TCPSACKReorder 0, TCPRenoReorder 0, TCPTSReorder 0
calibración: MAL
salida: 1
```

- [ ] **Paso 14: aplicar netem**

⚠️ Da `NET_ADMIN` a un contenedor (`p7-netem`, usuario 0, sin ninguna otra capacidad y sin el volumen de trabajo) dentro de la red de `p7-arnes` y luego de la de `p7-worker`: es la excepción de la decisión 5. La qdisc de netem solo afecta a esos dos contenedores y desaparece al pararlos (paso 20). El primer `tc` carga además el módulo `sch_netem` en el núcleo del host, que se queda cargado hasta reiniciar (la validación del 14-oct ya lo dejó cargado). No da acceso a nadie más: solo lo usa quien tiene `NET_ADMIN`, que podría cargarlo igual, y en este host los espacios de usuario sin privilegios están desactivados. Si se prefiere quitarlo, la persona responsable puede hacerlo con root después del paso 20 (`sudo modprobe -r sch_netem`), aunque aporta poco.

📍 Máquina de trabajo; `p7.sh` llama a `docker`.

Ejecutar:

```sh
sh <banco>/p7/p7.sh netem
docker ps -a --filter name=p7-netem --format '{{.Names}}' | wc -l
```

Esperado (el número de `qdisc` puede ser otro):

```
p7-arnes: qdisc netem 8001: root refcnt 17 limit 1000 delay 300ms  100ms loss 3% rate 96Kbit; gso_max_segs 1; usuario 0, CapEff 0000000000001000
p7-worker: qdisc netem 8002: root refcnt 17 limit 1000 delay 300ms  100ms loss 3% rate 1Mbit; gso_max_segs 1; usuario 0, CapEff 0000000000001000
0
```

`CapEff 0000000000001000` es solo `CAP_NET_ADMIN` (el bit 12), y el `0` final dice que `p7-netem` ya no existe. Si sale `Error: Specified qdisc kind is unknown.`, el núcleo del host no tiene `sch_netem`: parar, limpiar y avisar.

- [ ] **Paso 15: calibrar la red**

📍 Máquina de trabajo; `p7.sh` llama a `docker`. La salida queda también en `<intercambio>/resultados/p7-calibracion.txt`, de donde la toma el informe (tarea 16).

Ejecutar:

```sh
sh <banco>/p7/p7.sh calibrar > <intercambio>/resultados/p7-calibracion.txt; s=$?; cat <intercambio>/resultados/p7-calibracion.txt; echo "salida: $s"
```

Esperado (unos 4 min y medio; las cifras cambian en cada ejecución, estas son de la validación):

```
RTT de 186 conexiones sin pérdida: mínimo 411 ms, mediana 604 ms, máximo 800 ms
conexiones que perdieron el SYN o el SYN-ACK: 14 de 200 (7,0 %; con 3 % en cada sentido, 5,9 %)
PUT de 60 000 bytes: 6,2 s; 6,0 s; 5,8 s; el mejor, sin un RTT: 91,5 kbit/s de carga útil
bien: RTT mediana entre 570 y 650 ms (netem: 600)
bien: RTT entre 400 y 830 ms (netem: 400 a 800, más lo que tarda el paquete en salir)
bien: entre el 1 % y el 12 % de las conexiones pierden un paquete
bien: subida entre 75 y 96 kbit/s (netem: 96 en la línea; las cabeceras TCP/IP se llevan cerca del 5 %)
segmentos TCP que envió p7-arnes: <n>; retransmitidos: <m> (<p> %)
reordenamientos que vio TCP: TCPSACKReorder 0, TCPRenoReorder 0, TCPTSReorder 0
calibración: bien
salida: 0
```

Las cuatro líneas con `bien`, `calibración: bien` y los tres contadores de reordenamiento en 0. La otra calibración de la validación dio mediana 612 ms (418 a 778), 6,5 % y 92,0 kbit/s. El techo de carga útil es de unos 91,8 kbit/s: netem cuenta la trama entera (1 514 bytes por cada 1 448 de datos). Con `calibración: MAL`, parar: las tandas no valdrían; se limpia (paso 20) y se repite desde el paso 12.

- [ ] **Paso 16: commit de `p7/` en el banco**

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit:

```sh
git -C <banco> add p7/p7.sh p7/worker.sh p7/calibrar.py p7/analizar.py p7/prueba_analizar.py
git -C <banco> diff --cached --stat | tail -1
git -C <banco> commit -q -m "P7 en la máquina: worker en vigia-p7, netem de un solo uso, calibración, tandas y análisis

wrangler dev del backend de f2-h1 escucha en la IP de vigia-p7 (excepción
acotada a OPS-03, decisión 5), con la clave de acuse de dev en un tmpfs.
netem: 96 kbit/s de subida, 300 ± 100 ms y 3 % de pérdida en cada sentido,
sin reordenar (rate en los dos sentidos) y sin GSO." && git -C <banco> log --oneline -1 && git -C <banco> status --short | wc -l
```

Esperado: ` 5 files changed, 411 insertions(+)`, el commit con su hash corto y `0` (nada pendiente en el banco).

- [ ] **Paso 17: las tres tandas de 30 min**

Una tanda por duración, una tras otra contra el mismo worker (cada una da de alta su propio dispositivo y abre su propio incidente). Cada una tarda unos 31 min: se lanza en segundo plano y se espera a que acabe; su registro termina con `salida del arnés:` y los contadores de TCP. El progreso se ve con `docker exec p7-arnes tail -n 3 /work/h0b/p7/resultados/d<segundos>.log`.

📍 Máquina de trabajo; `p7.sh` llama a `docker` y el arnés corre en `p7-arnes`.

Ejecutar, de una en una:

```sh
sh <banco>/p7/p7.sh tanda 2 30
```

```sh
sh <banco>/p7/p7.sh tanda 4 30
```

```sh
sh <banco>/p7/p7.sh tanda 8 30
```

Esperado, en cada una (con 4 s; con 2 s son 900 fragmentos y unos 30 acuses por minuto, y con 8 s, 225 y unos 7 u 8):

```
arnés: el núcleo deja 1 subida(s) en vuelo; fragmentos de 4 s durante 30 min contra http://<IP>:8787
minuto,pendientes,pendientes_min,en_vuelo,retraso,ms_retraso_sobre_2,acuses,fuera_de_orden,rechazos,limites,internos,red
1,0,0,0,0,0,14,0,0,0,0,0
… (una fila por minuto, hasta la 30)
fin: 450 fragmentos y el cierre con acuse; la cola se vació <n> s después de acabar la grabación
salida del arnés: 0
segmentos TCP que envió p7-arnes: <n>; retransmitidos: <m> (<2 a 3> %)
reordenamientos que vio TCP: TCPSACKReorder 0, TCPRenoReorder 0, TCPTSReorder 0
```

`fuera_de_orden` es 0 con una subida en vuelo, salvo tras un 500 interno o un rechazo (la cola aparta ese fragmento y sale el siguiente); solo decide en el plan B. `rechazos`, `limites` e `internos` deberían ser 0 (si no lo son, el registro de la tanda y `docker logs p7-worker` dicen por qué); `red` cuenta los tiempos agotados y las respuestas que no son de Vigía. Con 2 s la línea va cerca del 75 % de su capacidad y una racha de pérdidas tarda en recuperarse: en la validación, dos tandas de 3 min dieron el retraso por encima de 2 fragmentos el 0,04 % y el 12 % del tiempo. Si una tanda no acaba en `fin:` y `salida del arnés: 0`, el registro dice dónde se paró; se repite esa tanda.

Las dos últimas líneas, que también cierran `d<segundos>.log`, son los contadores de TCP de `p7-arnes`, acumulados desde que arrancó. Si un contador de reordenamiento no da 0, esa tanda no vale: parar, comprobar netem (`docker exec p7-arnes tc qdisc show dev eth0` y lo mismo con `p7-worker` deben dar las qdisc del paso 14), limpiar (paso 20), repetir los pasos 12, 14 y 15 (con un `p7-arnes` nuevo, los contadores vuelven a 0) y repetir la tanda. Si vuelve a pasar, se declara en el informe y se decide con la persona responsable.

- [ ] **Paso 18: el veredicto**

📍 Máquina de trabajo; `p7.sh` llama a `docker` y el análisis corre en un contenedor efímero sin red, con el volumen de trabajo en solo lectura. El veredicto queda también en `<intercambio>/resultados/p7.txt`, de donde lo toma el informe (tarea 16).

Ejecutar:

```sh
sh <banco>/p7/p7.sh analizar > <intercambio>/resultados/p7.txt; cat <intercambio>/resultados/p7.txt
```

Esperado: un bloque por tanda, con este formato. Con 4 s, si la tanda se porta como la de 3 min de la validación (cola en 0, 100,0 % del tiempo y ningún fallo), sale:

```
/work/h0b/p7/resultados/d4.csv: fragmentos de 4 s; 30 min
  cola que no se vacía en el minuto 1: 0; en el minuto 30: 0 (no supera)
  esperando turno al acabar el minuto 1: 0; al acabar el 30: 0
  retraso de 2 fragmentos o menos: 100,0 % del tiempo (pide 95 %)
  acuses fuera de orden: 0
  en total: 449 acuses, 0 rechazos, 0 límites, 0 internos y 0 fallos de red
  veredicto: cumple
```

y al final una de estas líneas:
- `P7: la duración más corta que cumple es N s`, con N de 2, 4 u 8: es la respuesta de P7 y va al informe (tarea 16), con los tres bloques;
- `P7: ninguna tanda de 30 min cumple`: toca el plan B (paso 19).

Los acuses del total son los que llegaron dentro de los 30 min: el último fragmento se genera justo al acabar el minuto 30 y su acuse llega en el vaciado (lo cuenta la línea `fin:` del registro).

- [ ] **Paso 19 (solo si el paso 18 dice `P7: ninguna tanda de 30 min cumple`): plan B, 8 s con dos subidas en vuelo**

El plan B del plan maestro: 8 s con 2 subidas en vuelo sin romper el orden de los acuses. `EN_VUELO_POR_CLASE` es una constante privada del núcleo: se construye una copia del núcleo de `f2-h1` con esa constante en 2 (un `sed` de una línea, que el paso enseña con `diff`), se comprueba su suma y se pone su `nucleo.jar` en una copia de la distribución del arnés. El núcleo de `f2-h1` y el arnés normal no cambian.

📍 Máquina de trabajo; `planb` corre dentro de `vigia-build` (la caché de Gradle está ahí) y la tanda en `p7-arnes`.

Ejecutar:

```sh
sh <banco>/p7/p7.sh planb
```

Esperado (en unos 20 s):

```
227c227
<         const val EN_VUELO_POR_CLASE = 1 // si P7 (H0b) pide dos en la subida, se cambia el código (contrato, regla 3)
---
>         const val EN_VUELO_POR_CLASE = 2 // si P7 (H0b) pide dos en la subida, se cambia el código (contrato, regla 3)
build/libs/nucleo.jar: OK
```

Después, en segundo plano como en el paso 17 (unos 31 min):

```sh
sh <banco>/p7/p7.sh tanda 8 30 b
```

Esperado: como en el paso 17, con `arnés: el núcleo deja 2 subida(s) en vuelo; fragmentos de 8 s durante 30 min …` en la primera línea y `fin: 225 fragmentos y el cierre con acuse; …`. Luego, otra vez el análisis, que sustituye a `p7.txt`:

```sh
sh <banco>/p7/p7.sh analizar > <intercambio>/resultados/p7.txt; cat <intercambio>/resultados/p7.txt
```

Esperado: además de los tres bloques del paso 18, el de `d8-b.csv` (`fragmentos de 8 s, con dos subidas en vuelo (plan B); 30 min`) y la última línea `P7: ninguna duración cumple con una subida en vuelo; el plan B cumple con 8 s` o, si tampoco, `P7: ninguna tanda de 30 min cumple`: entonces se declara el límite y M2 mostrará el retraso real (plan maestro). Con dos subidas en vuelo, un acuse que llega antes que el de un fragmento anterior cuenta como fuera de orden y el plan B no cumple (nota 6).

- [ ] **Paso 20: limpieza**

⚠️ Para y borra `p7-worker` y `p7-arnes`. Con `p7-worker` desaparece su tmpfs, que tiene la clave de acuse de dev, `.dev.vars`, la configuración, los registros y el estado de wrangler (la D1 y el R2 locales). Con cada contenedor desaparece también su qdisc de netem (el módulo `sch_netem` sigue cargado en el host hasta reiniciar: paso 14). Borra además la lista pública de claves y, si se hizo el plan B, la copia del núcleo y la distribución del plan B. Los resultados (`/work/h0b/p7/resultados/`) se quedan para el informe; la red `vigia-p7` se queda (es de H0a), vacía.

📍 Máquina de trabajo; `p7.sh` llama a `docker` y el `ls` corre dentro de `vigia-build`.

Ejecutar:

```sh
sh <banco>/p7/p7.sh limpiar
docker exec vigia-build ls /work/h0b/p7 /work/h0b/p7/resultados
```

Esperado:

```
contenedores de P7: 0
contenedores en vigia-p7: 0
/work/h0b/p7:
resultados

/work/h0b/p7/resultados:
d2.csv
d2.log
d4.csv
d4.log
d8.csv
d8.log
```

(y `d8-b.csv` y `d8-b.log` si se hizo el plan B).

**Notas:**

- **Nota 1 (validación):** validado el 14-oct-2026. `vigia-build:h0b` aún no existía: el worker, el arnés, netem y el análisis corrieron con una imagen temporal hecha con la capa de iproute2 de la tarea 2 sobre `vigia-build:h0a` (borrada al terminar), con `BANCO`, `F2H1` y `P7` apuntando a una copia del banco con el andamio, a la copia de `f2-h1` de la tarea 4 y a una carpeta propia. Se comprobó: la secuencia TDD de los pasos 1 a 7 sobre una copia limpia del andamio (con las salidas de arriba), dos mutaciones que las pruebas detectan (el umbral del retraso y el código que no casa con su estado), los commits de los pasos 8 y 16 (árbol limpio tras compilar), `prueba_analizar.py` sin y con `analizar.py`, `montar` (los contenedores de la red y la comprobación de OPS-03), `wrangler dev` arrancando sin salida a internet en unos 3 s y sin escribir nada en la copia de `f2-h1` (`find -newer` da 0 archivos), la calibración sin netem (MAL) y con netem (bien, dos veces), las cuentas de netem frente a las de TCP (un paquete de netem por segmento: sin GSO), tandas cortas con 4 s (3 min, cumple), con 2 s (3 min, dos veces) y con el plan B (2 min, "2 subida(s) en vuelo"), el análisis y la limpieza. Las tandas de 30 min no se ejecutaron. Tras la revisión del plan se repitió, con otra imagen temporal hecha igual, lo que tocan sus arreglos: `prueba_analizar.py` (la prueba nueva en rojo y luego en verde), el commit del paso 16 y `montar`, `netem` (el auxiliar, sin el volumen), una tanda de 4 s de 2 min (su registro acaba con los contadores de TCP), `analizar` (con el volumen en solo lectura) y `limpiar`.
- **Nota 2 (OPS-03):** en la IP de `vigia-p7` escuchan `wrangler dev` (puerto 8787, `workerd`) y el servidor de vuelta de Miniflare (`MainThread`, puerto al azar): Miniflare abre ese servidor, por el que `workerd` llama a Node, en la misma dirección que `--ip` cuando no es de 127.0.0.0/8 (`#startLoopbackServer` en `miniflare/dist/src/index.js`). Responde 404 a lo que no conoce y solo lo alcanza `p7-arnes`. Todo lo demás (el inspector, la ruta de `scheduled` y los puertos internos de `workerd`) está en 127.0.0.1. Además, el primer `tc` carga el módulo `sch_netem` en el núcleo del host, que sigue cargado hasta reiniciar (paso 14): no da acceso a nadie más, porque solo lo usa quien tiene `NET_ADMIN`, que podría cargarlo igual, y en este host los espacios de usuario sin privilegios están desactivados.
- **Nota 3 (cliente HTTP):** HTTP/1.1, 10 s para conectar y 20 s para tener la respuesta (un PUT de 8 s sube en unos 3,5 s). `wrangler dev` (`workerd`) cierra una conexión tras 5 s sin peticiones y netem retrasa ese FIN, así que una petición que sale justo entonces encuentra la conexión cerrada (`HTTP/1.1 header parser received no bytes`); con 8 s pasaba en 6 de 15 fragmentos. El arnés no reutiliza conexiones con más de 3 s de reposo y, si aun así le pasa, el JDK repite la petición en una conexión nueva (`jdk.httpclient.enableAllMethodRetry`, lo que OkHttp hace por defecto), cosa segura porque la API de H1 es idempotente: el mismo `idPeticion` y el mismo cuerpo firmado. Con las dos, 0 fallos en la validación. Con 8 s, cada fragmento abre conexión (un RTT más): pesimista frente a Cloudflare, que mantiene las conexiones mucho más.
- **Nota 4 (la cola de un minuto):** el criterio compara "la cola del minuto 30" con "la del minuto 1". Con la foto al acabar el minuto, una cola que no crece da 0 o 1 según haya justo entonces un PUT a medias: en la validación, una tanda de 2 s dio 0 al acabar el minuto 1 y 1 al acabar el minuto 3, con la cola vaciándose cada pocos segundos. Por eso la cola de un minuto es su mínimo (`pendientes_min`): una cola que no crece se vacía cada poco y da 0, y una que crece arrastra lo que no le da tiempo a subir, con el mínimo creciendo con ella. La foto (`pendientes`) sale en el CSV y en el análisis, pero no decide.
- **Nota 5 (qué cuenta el CSV):** `acuses` y `fuera_de_orden` son de fragmentos; `rechazos`, `limites`, `internos` y `red`, de cualquier petición (alta, apertura, fragmentos y cierre). El retraso es el último fragmento generado menos el último acusado sin huecos delante. Las horas son las del reloj monotónico del arnés y las filas cubren los 30 min de grabación; el vaciado posterior solo sale en la línea `fin:`.
- **Nota 6 (plan B):** "sin romper el orden de los acuses" se mide como acuses fuera de orden, los que llegan con algún fragmento anterior todavía sin acuse, y el veredicto del plan B exige 0. En las tandas con una subida en vuelo se muestran, pero no deciden: el plan maestro solo se lo pide al plan B, y ahí solo aparecen tras un 500 interno o un rechazo (paso 17). Con dos PUT a la vez en dos conexiones, el segundo puede acabar antes que el primero: es una duda abierta para la persona responsable si eso rompe "el orden" que pide el plan maestro (la cadena de `prev` no se rompe por el orden de llegada).
- **Nota 7 (duración):** unas 2 h en total: 10 s de montaje, 2 min de calibración sin netem y 4 min y medio con netem, tres tandas de unos 31 min y, si hace falta, el plan B (otros 31 min).
- **Nota 8 (lo que favorece a las duraciones cortas):** el montaje es pesimista en la red (la pérdida en cada sentido, las ráfagas que salen en orden y, con 8 s, una conexión nueva por fragmento), pero la máquina no incluye dos tiempos que, con el teléfono y el servidor reales, se suman a cada intento de subida. El primero es la latencia del servidor de producción: el Worker es `wrangler dev`, con la D1 y el R2 locales de Miniflare en un tmpfs, y en producción cada PUT de un fragmento nuevo va a la primaria de D1 y a R2 (7 consultas y 1 `put`, medido en H1: contrato, sección 13). El segundo es la firma en el Keystore de cada intento, si el PUT lleva firma de petición (regla de la cabecera): el arnés firma con `FirmanteSoftware`, en memoria. Con una subida en vuelo, los dos se suman enteros a cada ciclo. Favorecen a las duraciones cortas, sobre todo a 2 s, con la línea ya cerca del 75 % (paso 17), y por eso el valor es provisional hasta P7 en el teléfono (tramo B), que se mide con Cloudflare y con el Keystore. El margen de 3 puntos de la regla de "justa" (cabecera) no los tiene en cuenta.

---

### Tarea 12: P8 sin la persona: consulta de OONI

**Archivos (banco, `<banco>`):**
- Crear: `p8/ooni.py` y `p8/prueba_ooni.py`.
- Fuera del banco: `<intercambio>/resultados/ooni-<AAAA-MM-DD>.md` y `.json` (datos públicos agregados; los lee la tarea 16).

**Interfaces:**
- Consume: la API pública de OONI, sin cuenta (`https://api.ooni.io/api/v1/`: `aggregation`, `measurements` y `raw_measurement`), y el Python 3.12 de la máquina de trabajo con la biblioteca estándar (`python3 -I`). Es lo único de esta tarea que sale a internet desde la máquina de trabajo: lecturas públicas, sin credenciales ni datos propios.
- Produce:
  - `python3 -I -B <banco>/p8/ooni.py [--hasta AAAA-MM-DD] [--dias 90] [--crudas 3] [--json <archivo>]`: las tablas en markdown por la salida estándar, el progreso por la de error y, con `--json`, el mismo resultado en un archivo nuevo (no pisa uno que exista). Ventana: los `--dias` días completos anteriores a `--hasta` (por defecto, hoy en UTC; OONI trata `until` como exclusivo). Sale con 1, antes de consultar nada, si el archivo de `--json` ya existe, y con 1 si OONI no responde tras 4 intentos.
  - JSON: `{"fuente","pais":"VE","desde","hasta_exclusivo","crudas_por_asn","redes":{"AS<n>":"<nombre de la red>"},"mensajeria":{"telegram"|"signal"|"whatsapp":[{"asn","mediciones","anomalas","confirmadas","fallidas"}]},"dominios":{"dominios_medidos","workers.dev"|"pages.dev":{"dominios","mediciones","anomalas","confirmadas","fallidas","por_asn":[…]}},"push":{"dominio":"fcm.googleapis.com","por_asn":[…]},"doh":{"Google"|"Cloudflare"|"Quad9"|"AdGuard"|"NextDNS"|"Mullvad":{"input","por_asn":[{"asn","mediciones","muestras","resuelven","fallos":{"arranque: <tipo>"|"consulta: <tipo>": n},"arranque_fallido":{"<tipo>": n}}],"por_ip":{"por_asn":[…]}}},"consultado"}`, con `por_ip` solo en Google, Cloudflare y Quad9 (sin su entrada, que lleva la IP) y `arranque_fallido` contando, entre las que resuelven, las que fallaron en el arranque. Sin IPs, sin identificadores de medición ni de informe y sin nombres de dominio.
  - Funciones, para quien quiera reutilizarlas: `ventana(hasta: date, dias: int) -> (str, str)`, `por_asn(filas) -> list`, `del_sufijo(dominio, sufijo) -> bool`, `tipo_fallo(fallo) -> str`, `evaluar_dnscheck(cruda) -> (estado, tipo)` (`resuelve`, `arranque` o `consulta`; con `resuelve`, `tipo` es el fallo del arranque si lo hubo, y si no `None`), `dnscheck(consultar, entrada, desde, hasta, crudas, redes) -> list`, `recopilar(consultar, desde, hasta, crudas, avisar) -> dict` y `markdown(resultado) -> str`; `consultar(ruta, **parametros)` se puede sustituir (así se prueba sin red).
  - Para la tarea 16: la sección de P8 del informe (lo que OONI ya contesta, con la fecha de la consulta) y, para los tramos B y C, la misma orden repetida cada semana.

Qué pregunta cada tabla, según el informe `cloudflare-ooni`: Telegram, Signal y WhatsApp por operador (pruebas `telegram`, `signal` y `whatsapp`); si se miden `*.workers.dev` y `*.pages.dev` en VE (`web_connectivity` no admite comodines: se pide la lista de dominios con su ASN y se filtra aquí); los resolvedores DoH que prueba P8 (Google, Cloudflare, Quad9, AdGuard, NextDNS y Mullvad), con las mediciones crudas de `dnscheck`, porque su agregado marca todo como fallo; y `fcm.googleapis.com`, el servicio al que se envían los avisos de Web Push de Chrome. Los seis resolvedores se miden por su nombre y, Google, Cloudflare y Quad9, también por IP (`https://8.8.8.8/dns-query`, `https://1.1.1.1/dns-query` y `https://9.9.9.9/dns-query`, en columnas propias): la app fija el DoH por IP (AND-09), y OONI no mide por IP a los otros tres. Por nombre, `dnscheck` resuelve primero el nombre del resolvedor con el DNS del operador (el arranque), que en VE puede estar envenenado (`dns_bogon_error`), y con Google, Cloudflare y Quad9 consulta además sus IP conocidas aunque el arranque falle (código de probe-cli: `dnscheck.go` y `richerinput.go`). De `dnscheck` se leen, por resolvedor y operador, hasta 3 mediciones recientes de informes distintos (unas 190 mediciones crudas por nombre y, con unos 4 operadores por resolvedor por IP, unas 35 más; la consulta entera son unas 310 peticiones y tarda de 2 a 4 min). "Resuelve" es que alguna consulta DoH devolvió respuestas, aunque fallara el arranque (eso se anota aparte: un nombre envenenado no tumba el DoH por IP); si no resuelve, solo se guarda el tipo de fallo de OONI (`dns_bogon_error`), porque el resto del texto puede llevar IPs. Los nombres de las redes salen de esas mediciones crudas.

- [ ] **Paso 1: escribir las pruebas, sin red**

La API se sustituye por respuestas fijas que llevan IPs e identificadores como los de verdad: la salida no debe tener ninguno.

`<banco>/p8/prueba_ooni.py`:

```python
"""Pruebas de ooni.py (P8, H0b), sin red: la API de OONI se sustituye por respuestas fijas.

Uso: python3 -I -B prueba_ooni.py
"""
import datetime
import importlib.util
import io
import json
import pathlib
import re
import tempfile
import unittest
from contextlib import redirect_stderr

_ruta = pathlib.Path(__file__).with_name('ooni.py')
_spec = importlib.util.spec_from_file_location('ooni', _ruta)
ooni = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ooni)

IP = re.compile(r'\b\d{1,3}(\.\d{1,3}){3}\b')
UID = re.compile(r'\d{14}\.\d+_VE_|_VE_\d+_n\d_')


def fila(n, anom=0, conf=0, fall=0, **dimension):
    return {'measurement_count': n, 'anomaly_count': anom, 'confirmed_count': conf, 'failure_count': fall,
            'ok_count': n - anom - fall, **dimension}


def cruda(asn, red, bootstrap=None, consultas=()):
    """Medición dnscheck cruda, con IPs como las de verdad (que nunca deben salir)."""
    lookups = {f'https://203.0.113.{i}/dns-query': {
        'failure': fallo, 'queries': [{'answers': [] if fallo else [{'ipv4': '93.184.215.14'}]}]}
        for i, fallo in enumerate(consultas)}
    return {'probe_asn': asn, 'probe_network_name': red, 'probe_ip': '127.0.0.1', 'resolver_ip': '200.44.32.12',
            'test_keys': {'bootstrap_failure': bootstrap, 'lookups': lookups,
                          'bootstrap': {'queries': [{'answers': [{'ipv4': '8.8.8.8'}]}]}}}


CRUDAS = {
    # Google en CANTV: tres informes distintos, uno repetido (se toma una sola medición de cada informe).
    'g1': cruda('AS8048', 'CANTV Servicios, Venezuela', consultas=[None, None]),
    'g2': cruda('AS8048', 'CANTV Servicios, Venezuela', consultas=['generic_timeout_error', None]),
    'g3': cruda('AS8048', 'CANTV Servicios, Venezuela',
                consultas=['unknown_failure: dial tcp 203.0.113.9:443: connect: connection refused']),
    'g4': cruda('AS8048', 'CANTV Servicios, Venezuela', consultas=[None]),
    # Mullvad en Inter: falla al resolver el nombre del resolvedor.
    'm1': cruda('AS21826', 'Corporacion Telemic C.A.', bootstrap='dns_bogon_error'),
    'm2': cruda('AS21826', 'Corporacion Telemic C.A.', bootstrap='dns_bogon_error'),
    # Cloudflare por nombre en Inter: el nombre falla en el arranque, pero OONI consulta igual sus IP conocidas.
    'c1': cruda('AS21826', 'Corporacion Telemic C.A.', bootstrap='dns_bogon_error', consultas=[None]),
    'c2': cruda('AS21826', 'Corporacion Telemic C.A.', bootstrap='dns_bogon_error',
                consultas=['generic_timeout_error', None]),
    # Google por IP en CANTV.
    'i1': cruda('AS8048', 'CANTV Servicios, Venezuela', consultas=[None]),
    'i2': cruda('AS8048', 'CANTV Servicios, Venezuela', consultas=['generic_timeout_error']),
}


class ApiFalsa:
    def __init__(self):
        self.llamadas = []

    def __call__(self, ruta, **p):
        self.llamadas.append((ruta, p))
        if ruta == 'aggregation' and p.get('test_name') in ooni.MENSAJERIA:
            filas = {'telegram': [fila(3745, 35, probe_asn=8048), fila(593, 2, probe_asn=6306), fila(10, 0, probe_asn=14593)],
                     'signal': [fila(3700, 2000, probe_asn=8048), fila(600, 300, probe_asn=6306)],
                     'whatsapp': [fila(3740, 40, probe_asn=8048)]}[p['test_name']]
            return {'result': filas}
        if ruta == 'aggregation' and p.get('axis_x') == 'domain':
            assert p['axis_y'] == 'probe_asn' and p['test_name'] == 'web_connectivity'
            return {'result': [fila(5, 1, domain='a.workers.dev', probe_asn=8048), fila(2, 2, 1, domain='a.workers.dev', probe_asn=6306),
                               fila(4, 0, domain='b.workers.dev', probe_asn=8048), fila(9, 0, domain='notworkers.dev', probe_asn=8048),
                               fila(7, 0, domain='workers.dev.example.com', probe_asn=8048), fila(3, 3, domain='', probe_asn=8048),
                               fila(1, 0, domain='example.org', probe_asn=8048)]}
        if ruta == 'aggregation' and p.get('domain') == ooni.PUSH:
            return {'result': [fila(400, 1, probe_asn=8048), fila(30, 0, probe_asn=6306)]}
        if ruta == 'aggregation' and p.get('test_name') == 'dnscheck':
            return {'result': {ooni.DOH['Google']: [fila(426, fall=426, probe_asn=8048)],
                               ooni.DOH_IP['Google']: [fila(120, fall=120, probe_asn=8048)],
                               ooni.DOH['Cloudflare']: [fila(50, fall=50, probe_asn=21826)],
                               ooni.DOH['Mullvad']: [fila(93, fall=93, probe_asn=21826)]}.get(p['input'], [])}
        if ruta == 'measurements':
            assert p['order_by'] == 'measurement_start_time' and p['order'] == 'desc'
            filas = {(ooni.DOH['Google'], 'AS8048'): [('g1', 'r1'), ('g2', 'r1'), ('g3', 'r2'), ('g4', 'r3'), ('g1', 'r4')],
                     (ooni.DOH_IP['Google'], 'AS8048'): [('i1', 'r7'), ('i2', 'r8')],
                     (ooni.DOH['Cloudflare'], 'AS21826'): [('c1', 'r5'), ('c2', 'r9')],
                     (ooni.DOH['Mullvad'], 'AS21826'): [('m1', 'r5'), ('m2', 'r6')]}[(p['input'], p['probe_asn'])]
            return {'results': [{'measurement_uid': f'20261013045934.287014_VE_dnscheck_{uid}', 'report_id': r,
                                 'probe_asn': p['probe_asn']} for uid, r in filas[:p['limit']]]}
        if ruta == 'raw_measurement':
            return CRUDAS[p['measurement_uid'].rsplit('_', 1)[1]]
        raise AssertionError(f'consulta inesperada: {ruta} {p}')


class Piezas(unittest.TestCase):
    def test_ventana_de_90_dias_completos_antes_de_hoy(self):
        self.assertEqual(ooni.ventana(datetime.date(2026, 10, 14), 90), ('2026-07-16', '2026-10-14'))

    def test_asn(self):
        self.assertEqual(ooni.asn(8048), 'AS8048')
        self.assertEqual(ooni.asn('AS6306'), 'AS6306')

    def test_sufijo(self):
        self.assertTrue(ooni.del_sufijo('a.workers.dev', 'workers.dev'))
        self.assertTrue(ooni.del_sufijo('workers.dev', 'workers.dev'))
        self.assertFalse(ooni.del_sufijo('notworkers.dev', 'workers.dev'))
        self.assertFalse(ooni.del_sufijo('workers.dev.example.com', 'workers.dev'))

    def test_tipo_de_fallo_sin_ip(self):
        self.assertEqual(ooni.tipo_fallo('unknown_failure: dial tcp 203.0.113.9:443: connect: refused'), 'unknown_failure')
        self.assertEqual(ooni.tipo_fallo('dns_bogon_error'), 'dns_bogon_error')
        self.assertEqual(ooni.tipo_fallo('Error raro'), 'otro')

    def test_evaluar_dnscheck(self):
        self.assertEqual(ooni.evaluar_dnscheck(CRUDAS['g2']), ('resuelve', None))
        self.assertEqual(ooni.evaluar_dnscheck(CRUDAS['g3']), ('consulta', 'unknown_failure'))
        self.assertEqual(ooni.evaluar_dnscheck(CRUDAS['m1']), ('arranque', 'dns_bogon_error'))
        self.assertEqual(ooni.evaluar_dnscheck({'test_keys': {'bootstrap_failure': None, 'lookups': {}}}),
                         ('consulta', 'sin_respuesta'))

    def test_si_responde_por_ip_resuelve_aunque_el_nombre_falle_en_el_arranque(self):
        self.assertEqual(ooni.evaluar_dnscheck(CRUDAS['c1']), ('resuelve', 'dns_bogon_error'))
        self.assertEqual(ooni.evaluar_dnscheck(CRUDAS['c2']), ('resuelve', 'dns_bogon_error'))


class Recopilar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = ApiFalsa()
        cls.avisos = []
        cls.r = ooni.recopilar(cls.api, '2026-07-16', '2026-10-14', crudas=3, avisar=cls.avisos.append)
        cls.texto = json.dumps(cls.r, ensure_ascii=False)
        cls.md = ooni.markdown(cls.r)

    def test_ninguna_ip_ni_identificador_de_medicion(self):
        for salida in (self.texto, self.md):
            self.assertIsNone(IP.search(salida), IP.search(salida))
            self.assertIsNone(UID.search(salida))
            self.assertNotIn('r1', re.findall(r'\br\d\b', salida))

    def test_mensajeria_por_asn(self):
        self.assertEqual(self.r['mensajeria']['telegram'][0],
                         {'asn': 'AS8048', 'mediciones': 3745, 'anomalas': 35, 'confirmadas': 0, 'fallidas': 0})
        self.assertEqual([f['asn'] for f in self.r['mensajeria']['telegram']], ['AS8048', 'AS6306', 'AS14593'])

    def test_dominios_por_sufijo(self):
        d = self.r['dominios']
        self.assertEqual(d['dominios_medidos'], 5)
        self.assertEqual(d['workers.dev']['dominios'], 2)
        self.assertEqual((d['workers.dev']['mediciones'], d['workers.dev']['anomalas'], d['workers.dev']['confirmadas']), (11, 3, 1))
        self.assertEqual(d['workers.dev']['por_asn'][0], {'asn': 'AS8048', 'mediciones': 9, 'anomalas': 1, 'confirmadas': 0, 'fallidas': 0})
        self.assertEqual(d['pages.dev'], {'dominios': 0, 'mediciones': 0, 'anomalas': 0, 'confirmadas': 0, 'fallidas': 0, 'por_asn': []})

    def test_doh_con_muestras_de_informes_distintos(self):
        g = self.r['doh']['Google']['por_asn'][0]
        self.assertEqual(g, {'asn': 'AS8048', 'mediciones': 426, 'muestras': 3, 'resuelven': 2,
                             'fallos': {'consulta: unknown_failure': 1}, 'arranque_fallido': {}})
        m = self.r['doh']['Mullvad']['por_asn'][0]
        self.assertEqual(m, {'asn': 'AS21826', 'mediciones': 93, 'muestras': 2, 'resuelven': 0,
                             'fallos': {'arranque: dns_bogon_error': 2}, 'arranque_fallido': {}})
        self.assertEqual(self.r['doh']['Quad9']['por_asn'], [])
        crudas = [p['measurement_uid'] for ruta, p in self.api.llamadas if ruta == 'raw_measurement']
        self.assertEqual(len(crudas), 9)

    def test_doh_por_ip_de_google_cloudflare_y_quad9(self):
        self.assertEqual(self.r['doh']['Google']['por_ip']['por_asn'],
                         [{'asn': 'AS8048', 'mediciones': 120, 'muestras': 2, 'resuelven': 1,
                           'fallos': {'consulta: generic_timeout_error': 1}, 'arranque_fallido': {}}])
        self.assertEqual(self.r['doh']['Cloudflare']['por_ip'], {'por_asn': []})
        self.assertEqual(self.r['doh']['Quad9']['por_ip'], {'por_asn': []})
        self.assertNotIn('por_ip', self.r['doh']['AdGuard'])
        self.assertNotIn('por_ip', self.r['doh']['Mullvad'])
        self.assertIn('dnscheck Google por IP: 1 ASN', self.avisos)

    def test_doh_que_resuelve_aunque_el_nombre_falle_en_el_arranque(self):
        self.assertEqual(self.r['doh']['Cloudflare']['por_asn'],
                         [{'asn': 'AS21826', 'mediciones': 50, 'muestras': 2, 'resuelven': 2, 'fallos': {},
                           'arranque_fallido': {'dns_bogon_error': 2}}])

    def test_redes_por_asn_de_las_mediciones_crudas(self):
        self.assertEqual(self.r['redes'], {'AS8048': 'CANTV Servicios, Venezuela', 'AS21826': 'Corporacion Telemic C.A.'})

    def test_push(self):
        self.assertEqual(self.r['push']['por_asn'][1], {'asn': 'AS6306', 'mediciones': 30, 'anomalas': 0, 'confirmadas': 0, 'fallidas': 0})

    def test_markdown(self):
        self.assertIn('| AS8048 | CANTV Servicios, Venezuela | 35 / 3.745 (0,9 %) | 2.000 / 3.700 (54,1 %) | 40 / 3.740 (1,1 %) |', self.md)
        self.assertIn('| total (3 ASN) |  | 37 / 4.348 (0,9 %) | 2.300 / 4.300 (53,5 %) | 40 / 3.740 (1,1 %) |', self.md)
        self.assertIn('Confirmadas: Telegram 0, Signal 0, WhatsApp 0.', self.md)
        self.assertIn('| *.workers.dev | 2 | 11 | 3 | 1 |', self.md)
        self.assertIn('| *.pages.dev | 0 | 0 | 0 | 0 |', self.md)
        self.assertIn('| ASN | Red | Google | Google por IP | Cloudflare | Cloudflare por IP | Quad9 | Quad9 por IP | '
                      'AdGuard | NextDNS | Mullvad |', self.md)
        self.assertIn('| AS8048 | CANTV Servicios, Venezuela | 2/3 (unknown_failure) | 1/2 (generic_timeout_error) | '
                      '- | - | - | - | - | - | - |', self.md)
        self.assertIn('| AS21826 | Corporacion Telemic C.A. | - | - | 2/2 (nombre: dns_bogon_error) | - | - | - | - | - | '
                      '0/2 (dns_bogon_error) |', self.md)
        self.assertIn('AdGuard, NextDNS y Mullvad, solo por nombre', self.md)
        self.assertIn('| AS8048 | CANTV Servicios, Venezuela | 400 | 1 | 0 |', self.md)
        self.assertIn('mediciones del 2026-07-16 al 2026-10-13', self.md)

    def test_resto_cuando_hay_mas_asn_que_filas(self):
        filas = [{'asn': f'AS{n}', 'mediciones': 10 * n, 'anomalas': n, 'confirmadas': 0, 'fallidas': 0} for n in range(1, 12)]
        r = dict(self.r, mensajeria={'telegram': filas, 'signal': [], 'whatsapp': []})
        md = ooni.markdown(r)
        self.assertIn('| resto (3 ASN) |  | 6 / 60 (10,0 %) | 0 / 0 | 0 / 0 |', md)
        self.assertIn('| total (11 ASN) |  | 66 / 660 (10,0 %) | 0 / 0 | 0 / 0 |', md)


class Linea(unittest.TestCase):
    def test_no_pisa_un_json_que_existe_y_para_antes_de_consultar(self):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = pathlib.Path(carpeta, 'ooni.json')
            ruta.write_text('{}', encoding='utf-8')
            errores = io.StringIO()
            with redirect_stderr(errores):
                self.assertEqual(ooni.main(['--json', str(ruta)]), 1)
            self.assertIn('ya existe: no se pisa', errores.getvalue())
            self.assertEqual(ruta.read_text(encoding='utf-8'), '{}')


if __name__ == '__main__':
    unittest.main(verbosity=1)
```

- [ ] **Paso 2: ver que fallan**

📍 Máquina de trabajo.

Ejecutar:

```sh
python3 -I -B <banco>/p8/prueba_ooni.py 2>&1 | tail -n 1; python3 -I -B <banco>/p8/prueba_ooni.py > /dev/null 2>&1; echo "salida: $?"
```

Esperado:

```
FileNotFoundError: [Errno 2] No such file or directory: '<banco>/p8/ooni.py'
salida: 1
```

- [ ] **Paso 3: escribir la consulta**

`<banco>/p8/ooni.py`:

```python
"""P8 (H0b, sin la persona): lo que OONI ya mide en Venezuela. Consulta de solo lectura a la API pública
de OONI (api.ooni.io, sin cuenta), solo con la biblioteca estándar. Imprime agregados, nunca IPs ni
identificadores de medición: las tablas en markdown para el informe por la salida estándar y, con
--json <archivo>, el mismo resultado en JSON. El progreso va por la salida de error.

Consultas (ventana: los N días completos anteriores a --hasta, que por defecto es hoy en UTC):
- telegram, signal y whatsapp por ASN (agregados de OONI);
- dominios *.workers.dev y *.pages.dev en web_connectivity, por ASN;
- DoH de Google, Cloudflare, Quad9, AdGuard, NextDNS y Mullvad por nombre, y de Google, Cloudflare y Quad9
  también por IP (así fija la app el DoH): el agregado de dnscheck marca todo como fallo, así que se leen
  hasta --crudas mediciones crudas recientes, de informes distintos, por ASN;
- fcm.googleapis.com en web_connectivity, por ASN.

Uso: python3 -I -B ooni.py [--hasta AAAA-MM-DD] [--dias 90] [--crudas 3] [--json <archivo>]
"""
import argparse
import collections
import datetime
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = 'https://api.ooni.io/api/v1/'
PAIS = 'VE'
MENSAJERIA = {'telegram': 'Telegram', 'signal': 'Signal', 'whatsapp': 'WhatsApp'}  # test_name -> nombre
SUFIJOS = ('workers.dev', 'pages.dev')
DOH = {
    'Google': 'https://dns.google/dns-query',
    'Cloudflare': 'https://cloudflare-dns.com/dns-query',
    'Quad9': 'https://dns.quad9.net/dns-query',
    'AdGuard': 'https://dns.adguard.com/dns-query',
    'NextDNS': 'https://dns.nextdns.io/dns-query',
    'Mullvad': 'https://adblock.doh.mullvad.net/dns-query',
}
# Los mismos resolvedores por IP, sin pasar por el DNS del operador; de los seis, OONI solo mide así estos tres.
# Las IP no salen nunca en el resultado: van en 'por_ip', sin la entrada.
DOH_IP = {
    'Google': 'https://8.8.8.8/dns-query',
    'Cloudflare': 'https://1.1.1.1/dns-query',
    'Quad9': 'https://9.9.9.9/dns-query',
}
PUSH = 'fcm.googleapis.com'
CAMPOS = ('mediciones', 'anomalas', 'confirmadas', 'fallidas')
FILAS = 8  # filas por ASN en las tablas de markdown; el JSON lleva todas


def consultar(ruta, **parametros):
    """GET a la API de OONI con tiempo de espera; reintenta ante 429, 5xx o un error de red."""
    url = API + ruta + '?' + urllib.parse.urlencode(parametros)
    for intento in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as respuesta:
                return json.load(respuesta)
        except urllib.error.HTTPError as e:
            if (e.code != 429 and e.code < 500) or intento == 3:
                raise
        except (urllib.error.URLError, TimeoutError):
            if intento == 3:
                raise
        time.sleep(2 ** intento)


def ventana(hasta, dias):
    """Los `dias` días completos anteriores a `hasta` (OONI trata `until` como exclusivo)."""
    return (hasta - datetime.timedelta(days=dias)).isoformat(), hasta.isoformat()


def asn(valor):
    texto = str(valor)
    return texto if texto.startswith('AS') else f'AS{texto}'


def cuentas(f):
    return {'mediciones': f.get('measurement_count', 0), 'anomalas': f.get('anomaly_count', 0),
            'confirmadas': f.get('confirmed_count', 0), 'fallidas': f.get('failure_count', 0)}


def ordenar(por):
    return sorted(({'asn': a, **c} for a, c in por.items()), key=lambda x: (-x['mediciones'], x['asn']))


def por_asn(filas):
    """Filas de aggregation con un eje probe_asn -> una entrada por ASN, de más a menos mediciones."""
    por = collections.defaultdict(lambda: dict.fromkeys(CAMPOS, 0))
    for f in filas:
        for campo, n in cuentas(f).items():
            por[asn(f['probe_asn'])][campo] += n
    return ordenar(por)


def del_sufijo(dominio, sufijo):
    return dominio == sufijo or dominio.endswith('.' + sufijo)


def tipo_fallo(fallo):
    """Solo el tipo de fallo de OONI (dns_bogon_error...): el resto del texto puede llevar IPs."""
    m = re.match(r'[a-z_]+(?=$|[:\s])', str(fallo))
    return m.group(0) if m else 'otro'


def evaluar_dnscheck(cruda):
    """('resuelve', None) si alguna consulta DoH devolvió respuestas, o ('resuelve', tipo) si además falló el
    arranque (el nombre del resolvedor no resolvió con el DNS del operador, pero OONI lo consultó igual en sus
    IP conocidas). Sin respuestas: ('arranque', tipo) si falló resolver el nombre del propio resolvedor y, si
    no, ('consulta', tipo)."""
    claves = cruda.get('test_keys') or {}
    arranque = claves.get('bootstrap_failure')
    consultas = list((claves.get('lookups') or {}).values())
    if any(c.get('failure') is None and any(q.get('answers') for q in c.get('queries') or []) for c in consultas):
        return 'resuelve', tipo_fallo(arranque) if arranque else None
    if arranque:
        return 'arranque', tipo_fallo(arranque)
    fallos = [c['failure'] for c in consultas if c.get('failure')]
    return 'consulta', tipo_fallo(fallos[0]) if fallos else 'sin_respuesta'


def dominios(filas):
    """Filas de aggregation con axis_x=domain y axis_y=probe_asn -> agregados por sufijo, sin nombres."""
    resultado = {'dominios_medidos': len({f['domain'] for f in filas if f.get('domain')})}
    for sufijo in SUFIJOS:
        propias = [f for f in filas if del_sufijo(f.get('domain') or '', sufijo)]
        total = {campo: sum(cuentas(f)[campo] for f in propias) for campo in CAMPOS}
        resultado[sufijo] = {'dominios': len({f['domain'] for f in propias}), **total, 'por_asn': por_asn(propias)}
    return resultado


def dnscheck(consultar, entrada, desde, hasta, crudas, redes):
    """Por ASN, hasta `crudas` mediciones crudas recientes de `entrada`, de informes distintos."""
    filas = consultar('aggregation', probe_cc=PAIS, test_name='dnscheck', input=entrada,
                      since=desde, until=hasta, axis_x='probe_asn')['result']
    lista = []
    for total in por_asn(filas):
        recientes = consultar('measurements', probe_cc=PAIS, test_name='dnscheck', input=entrada,
                              probe_asn=total['asn'], since=desde, until=hasta, limit=20,
                              order_by='measurement_start_time', order='desc')['results']
        elegidas, informes = [], set()
        for m in recientes:
            if m['report_id'] not in informes and len(elegidas) < crudas:
                informes.add(m['report_id'])
                elegidas.append(m['measurement_uid'])
        fallos, arranque = collections.Counter(), collections.Counter()
        resuelven = 0
        for uid in elegidas:
            cruda = consultar('raw_measurement', measurement_uid=uid)
            if cruda.get('probe_network_name'):
                redes.setdefault(total['asn'], cruda['probe_network_name'])
            estado, tipo = evaluar_dnscheck(cruda)
            if estado == 'resuelve':
                resuelven += 1
                if tipo:
                    arranque[tipo] += 1
            else:
                fallos[f'{estado}: {tipo}'] += 1
        lista.append({'asn': total['asn'], 'mediciones': total['mediciones'], 'muestras': len(elegidas),
                      'resuelven': resuelven, 'fallos': dict(fallos), 'arranque_fallido': dict(arranque)})
    return lista


def doh(consultar, desde, hasta, crudas, redes, avisar):
    resultado = {}
    for nombre, entrada in DOH.items():
        resultado[nombre] = {'input': entrada, 'por_asn': dnscheck(consultar, entrada, desde, hasta, crudas, redes)}
        avisar(f'dnscheck {nombre}: {len(resultado[nombre]["por_asn"])} ASN')
        if nombre in DOH_IP:
            resultado[nombre]['por_ip'] = {'por_asn': dnscheck(consultar, DOH_IP[nombre], desde, hasta, crudas, redes)}
            avisar(f'dnscheck {nombre} por IP: {len(resultado[nombre]["por_ip"]["por_asn"])} ASN')
    return resultado


def recopilar(consultar, desde, hasta, crudas, avisar=lambda texto: None):
    redes = {}
    resultado = {'fuente': 'API pública de OONI (api.ooni.io), sin cuenta', 'pais': PAIS,
                 'desde': desde, 'hasta_exclusivo': hasta, 'crudas_por_asn': crudas, 'redes': redes}
    resultado['mensajeria'] = {
        t: por_asn(consultar('aggregation', probe_cc=PAIS, test_name=t, since=desde, until=hasta,
                             axis_x='probe_asn')['result'])
        for t in MENSAJERIA}
    avisar('mensajería: hecho')
    resultado['dominios'] = dominios(consultar('aggregation', probe_cc=PAIS, test_name='web_connectivity',
                                               since=desde, until=hasta, axis_x='domain',
                                               axis_y='probe_asn')['result'])
    avisar('dominios: hecho')
    resultado['push'] = {'dominio': PUSH, 'por_asn': por_asn(consultar(
        'aggregation', probe_cc=PAIS, test_name='web_connectivity', domain=PUSH, since=desde, until=hasta,
        axis_x='probe_asn')['result'])}
    avisar('push: hecho')
    resultado['doh'] = doh(consultar, desde, hasta, crudas, redes, avisar)
    return resultado


def _n(numero):
    return f'{numero:,}'.replace(',', '.')


def _proporcion(anomalas, mediciones):
    if not mediciones:
        return f'{_n(anomalas)} / 0'
    porcentaje = f'{100 * anomalas / mediciones:.1f}'.replace('.', ',')
    return f'{_n(anomalas)} / {_n(mediciones)} ({porcentaje} %)'


def _filas(asns, celdas, redes):
    """Las FILAS primeras, luego 'resto' y 'total' con las celdas sumadas."""
    lineas = [f'| {a} | {redes.get(a, "")} | ' + ' | '.join(celdas([a])) + ' |' for a in asns[:FILAS]]
    if len(asns) > FILAS:
        lineas.append(f'| resto ({len(asns) - FILAS} ASN) |  | ' + ' | '.join(celdas(asns[FILAS:])) + ' |')
    lineas.append(f'| total ({len(asns)} ASN) |  | ' + ' | '.join(celdas(asns)) + ' |')
    return lineas


def markdown(r):
    redes = r['redes']
    hasta = datetime.date.fromisoformat(r['hasta_exclusivo']) - datetime.timedelta(days=1)
    dias = (hasta - datetime.date.fromisoformat(r['desde'])).days + 1
    salida = ['## P8: lo que OONI ya mide en Venezuela', '',
              f'Fuente: {r["fuente"]}; mediciones del {r["desde"]} al {hasta.isoformat()} ({dias} días)'
              + (f', consultada el {r["consultado"]}' if r.get('consultado') else '') + '. Solo agregados. '
              'Una medición anómala puede ser un falso positivo; confirmada = página de bloqueo o IP de '
              'censura conocida.', '',
              '### Mensajería por operador (anómalas / mediciones)', '',
              '| ASN | Red | Telegram | Signal | WhatsApp |', '|---|---|---|---|---|']
    tablas = {t: {f['asn']: f for f in r['mensajeria'][t]} for t in MENSAJERIA}
    totales = collections.Counter()
    for t in MENSAJERIA:
        for f in r['mensajeria'][t]:
            totales[f['asn']] += f['mediciones']
    asns = sorted(totales, key=lambda a: (-totales[a], a))

    def celdas_mensajeria(grupo):
        resultado = []
        for t in MENSAJERIA:
            presentes = [tablas[t][a] for a in grupo if a in tablas[t]]
            if len(grupo) == 1 and not presentes:
                resultado.append('-')
            else:
                resultado.append(_proporcion(sum(f['anomalas'] for f in presentes), sum(f['mediciones'] for f in presentes)))
        return resultado

    salida += _filas(asns, celdas_mensajeria, redes)
    confirmadas = ', '.join(f'{nombre} {sum(f["confirmadas"] for f in r["mensajeria"][t])}'
                            for t, nombre in MENSAJERIA.items())
    salida += ['', f'Confirmadas: {confirmadas}.', '',
               '### workers.dev y pages.dev en web_connectivity', '',
               '| Sufijo | Dominios medidos | Mediciones | Anómalas | Confirmadas |', '|---|---|---|---|---|']
    for sufijo in SUFIJOS:
        d = r['dominios'][sufijo]
        salida.append(f'| *.{sufijo} | {_n(d["dominios"])} | {_n(d["mediciones"])} | {_n(d["anomalas"])} | '
                      f'{_n(d["confirmadas"])} |')
    columnas = []
    for nombre in DOH:
        columnas.append((nombre, r['doh'][nombre]['por_asn']))
        if 'por_ip' in r['doh'][nombre]:
            columnas.append((f'{nombre} por IP', r['doh'][nombre]['por_ip']['por_asn']))
    salida += ['', f'De {_n(r["dominios"]["dominios_medidos"])} dominios medidos en VE en web_connectivity.', '',
               '### DoH (dnscheck, mediciones crudas): resuelven / muestras por operador', '',
               '| ASN | Red | ' + ' | '.join(titulo for titulo, _ in columnas) + ' |',
               '|---|---|' + '---|' * len(columnas)]
    doh_asn = [{f['asn']: f for f in filas} for _, filas in columnas]
    totales = collections.Counter()
    for _, filas in columnas:
        for f in filas:
            totales[f['asn']] += f['mediciones']
    asns = sorted(totales, key=lambda a: (-totales[a], a))

    def celdas_doh(grupo):
        resultado = []
        for por in doh_asn:
            presentes = [por[a] for a in grupo if a in por]
            if not presentes:
                resultado.append('-')
                continue
            muestras = sum(f['muestras'] for f in presentes)
            resuelven = sum(f['resuelven'] for f in presentes)
            fallos, arranque = collections.Counter(), collections.Counter()
            for f in presentes:
                for clave, n in f['fallos'].items():
                    fallos[clave.split(': ', 1)[1]] += n
                arranque.update(f['arranque_fallido'])
            notas = [fallos.most_common(1)[0][0]] if fallos else []
            if arranque:
                notas.append(f'nombre: {arranque.most_common(1)[0][0]}')
            resultado.append(f'{resuelven}/{muestras}' + (f' ({"; ".join(notas)})' if notas else ''))
        return resultado

    salida += _filas(asns, celdas_doh, redes)
    salida += ['', f'Hasta {r["crudas_por_asn"]} mediciones crudas recientes de informes distintos por resolvedor y '
               'operador; "-": OONI no tiene mediciones. Resuelve = alguna consulta DoH devolvió respuestas. '
               'Google, Cloudflare y Quad9 se miden por nombre y por IP (columnas "por IP": así fija la app el DoH); '
               'AdGuard, NextDNS y Mullvad, solo por nombre. Entre paréntesis, el fallo más frecuente de las que no '
               'resuelven y, tras "nombre:", el del arranque en las que resuelven igual (por nombre, OONI consulta '
               'también las IP conocidas de Google, Cloudflare y Quad9). Un fallo de arranque (dns_bogon_error: el '
               'DNS del operador dio una IP no pública para el nombre del resolvedor) es del nombre, no del DoH por IP.',
               '',
               f'### {PUSH} (web_connectivity)', '', '| ASN | Red | Mediciones | Anómalas | Confirmadas |',
               '|---|---|---|---|---|']
    push = {f['asn']: f for f in r['push']['por_asn']}

    def celdas_push(grupo):
        presentes = [push[a] for a in grupo]
        return [_n(sum(f[c] for f in presentes)) for c in ('mediciones', 'anomalas', 'confirmadas')]

    salida += _filas([f['asn'] for f in r['push']['por_asn']], celdas_push, redes)
    return '\n'.join(salida)


def main(argv):
    parser = argparse.ArgumentParser(description='P8: lo que OONI ya mide en Venezuela (solo agregados).')
    parser.add_argument('--hasta', type=datetime.date.fromisoformat,
                        default=datetime.datetime.now(datetime.timezone.utc).date(),
                        help='fin de la ventana, exclusivo (AAAA-MM-DD; por defecto, hoy en UTC)')
    parser.add_argument('--dias', type=int, default=90)
    parser.add_argument('--crudas', type=int, default=3, help='mediciones crudas de dnscheck por resolvedor y ASN')
    parser.add_argument('--json', help='archivo donde escribir también el resultado en JSON')
    args = parser.parse_args(argv)
    if args.json and pathlib.Path(args.json).exists():
        print(f'{args.json} ya existe: no se pisa', file=sys.stderr)
        return 1
    desde, hasta = ventana(args.hasta, args.dias)
    try:
        r = recopilar(consultar, desde, hasta, args.crudas, avisar=lambda texto: print(texto, file=sys.stderr))
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        print(f'No se pudo consultar OONI: {e}', file=sys.stderr)
        return 1
    r['consultado'] = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    if args.json:
        with open(args.json, 'x', encoding='utf-8') as f:
            json.dump(r, f, ensure_ascii=False, indent=1)
            f.write('\n')
    print(markdown(r))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
```

- [ ] **Paso 4: las pruebas pasan**

📍 Máquina de trabajo.

Ejecutar:

```sh
python3 -I -B <banco>/p8/prueba_ooni.py; echo "salida: $?"
```

Esperado:

```
.................
----------------------------------------------------------------------
Ran 17 tests in …s

OK
salida: 0
```

- [ ] **Paso 5: la consulta de verdad**

Lecturas públicas desde la máquina de trabajo (sin cuenta ni datos propios); de 2 a 4 min. El resultado va a la carpeta de resultados de la carpeta de intercambio, con la fecha en el nombre. `set -C` impide que la redirección pise el `.md` de una consulta anterior del mismo día.

📍 Máquina de trabajo.

Ejecutar:

```sh
fecha=$(date -u +%F)
set -C; python3 -I -B <banco>/p8/ooni.py --json <intercambio>/resultados/ooni-$fecha.json > <intercambio>/resultados/ooni-$fecha.md; echo "salida: $?"
cat <intercambio>/resultados/ooni-$fecha.md
```

Esperado: por la salida de error, `mensajería: hecho`, `dominios: hecho`, `push: hecho` y una línea `dnscheck <resolvedor>: <n> ASN` por resolvedor, más `dnscheck <resolvedor> por IP: <n> ASN` para Google, Cloudflare y Quad9; después `salida: 0` y las tablas. Las cifras cambian con cada día de mediciones. La consulta de la validación, el 14-oct-2026, se hizo antes de añadir las columnas por IP y dio lo de abajo. Con ellas, la cabecera de la tabla de DoH es `| ASN | Red | Google | Google por IP | Cloudflare | Cloudflare por IP | Quad9 | Quad9 por IP | AdGuard | NextDNS | Mullvad |`, y su leyenda explica las columnas «por IP» y la nota «nombre:» (la consulta con el código nuevo se cortó con un 429: ver la primera nota).

```markdown
## P8: lo que OONI ya mide en Venezuela

Fuente: API pública de OONI (api.ooni.io), sin cuenta; mediciones del 2026-07-16 al 2026-10-13 (90 días), consultada el 2026-10-14. Solo agregados. Una medición anómala puede ser un falso positivo; confirmada = página de bloqueo o IP de censura conocida.

### Mensajería por operador (anómalas / mediciones)

| ASN | Red | Telegram | Signal | WhatsApp |
|---|---|---|---|---|
| AS8048 | CANTV Servicios, Venezuela | 34 / 3.559 (1,0 %) | 3.173 / 3.557 (89,2 %) | 58 / 3.560 (1,6 %) |
| AS263703 | VIGINET C.A | 2 / 2.026 (0,1 %) | 1.281 / 2.021 (63,4 %) | 15 / 2.030 (0,7 %) |
| AS11562 | Net Uno, C.A. | 9 / 1.676 (0,5 %) | 389 / 1.691 (23,0 %) | 5 / 1.679 (0,3 %) |
| AS21826 | Corporación Telemic C.A. | 5 / 1.565 (0,3 %) | 738 / 1.565 (47,2 %) | 6 / 1.567 (0,4 %) |
| AS264731 | Corporacion Digitel C.A. | 6 / 1.009 (0,6 %) | 832 / 1.005 (82,8 %) | 48 / 1.003 (4,8 %) |
| AS6306 | TELEFONICA VENEZOLANA, C.A. | 0 / 539 (0,0 %) | 155 / 542 (28,6 %) | 1 / 538 (0,2 %) |
| AS61461 | Airtek Solutions C.A. | 0 / 486 (0,0 %) | 0 / 484 (0,0 %) | 0 / 489 (0,0 %) |
| AS272809 | THUNDERNET, C.A. | 1 / 438 (0,2 %) | 107 / 441 (24,3 %) | 6 / 438 (1,4 %) |
| resto (38 ASN) |  | 13 / 1.600 (0,8 %) | 170 / 1.584 (10,7 %) | 15 / 1.597 (0,9 %) |
| total (46 ASN) |  | 70 / 12.898 (0,5 %) | 6.845 / 12.890 (53,1 %) | 154 / 12.901 (1,2 %) |

Confirmadas: Telegram 0, Signal 0, WhatsApp 0.

### workers.dev y pages.dev en web_connectivity

| Sufijo | Dominios medidos | Mediciones | Anómalas | Confirmadas |
|---|---|---|---|---|
| *.workers.dev | 0 | 0 | 0 | 0 |
| *.pages.dev | 0 | 0 | 0 | 0 |

De 2.959 dominios medidos en VE en web_connectivity.

### DoH (dnscheck, mediciones crudas): resuelven / muestras por operador

| ASN | Red | Google | Cloudflare | Quad9 | AdGuard | NextDNS | Mullvad |
|---|---|---|---|---|---|---|---|
| AS11562 | Net Uno, C.A. | 3/3 | 3/3 | 2/3 (generic_timeout_error) | 3/3 | 3/3 | 3/3 |
| AS8048 | CANTV Servicios, Venezuela | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | - |
| AS272809 | THUNDERNET, C.A. | 3/3 | 3/3 | 2/3 (generic_timeout_error) | 3/3 | 3/3 | - |
| AS61461 | Airtek Solutions C.A. | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | - |
| AS263703 | VIGINET C.A | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | - |
| AS264731 | Corporacion Digitel C.A. | 3/3 | 3/3 | 1/3 (unknown_failure) | 3/3 | 2/3 (generic_timeout_error) | - |
| AS6306 | TELEFONICA VENEZOLANA, C.A. | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | - |
| AS21826 | Corporación Telemic C.A. | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 (dns_bogon_error) |
| resto (4 ASN) |  | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 6/6 |
| total (12 ASN) |  | 34/34 | 34/34 | 30/34 (generic_timeout_error) | 34/34 | 33/34 (generic_timeout_error) | 9/12 (dns_bogon_error) |

Hasta 3 mediciones crudas recientes de informes distintos por resolvedor y operador; "-": OONI no tiene mediciones. Resuelve = alguna consulta DoH devolvió respuestas. Entre paréntesis, el fallo más frecuente (dns_bogon_error en el arranque: el nombre del resolvedor no resolvió a una IP pública).

### fcm.googleapis.com (web_connectivity)

| ASN | Red | Mediciones | Anómalas | Confirmadas |
|---|---|---|---|---|
| AS8048 | CANTV Servicios, Venezuela | 287 | 1 | 0 |
| AS11562 | Net Uno, C.A. | 169 | 0 | 0 |
| AS21826 | Corporación Telemic C.A. | 94 | 0 | 0 |
| AS272809 | THUNDERNET, C.A. | 77 | 0 | 0 |
| AS6306 | TELEFONICA VENEZOLANA, C.A. | 72 | 0 | 0 |
| AS264731 | Corporacion Digitel C.A. | 71 | 0 | 0 |
| AS61461 | Airtek Solutions C.A. | 47 | 0 | 0 |
| AS27717 |  | 7 | 0 | 0 |
| resto (4 ASN) |  | 8 | 0 | 0 |
| total (12 ASN) |  | 832 | 1 | 0 |
```

Si sale `No se pudo consultar OONI: …` y `salida: 1`, la API no respondió tras 4 intentos: no se escribió el `.json` y el `.md` quedó vacío; borrar ese `.md` y repetir más tarde. Si el error es `HTTP Error 429: Too Many Requests`, la API está limitando las consultas desde esta IP (pasó el 14-oct-2026, en la cuarta consulta del día): repetir al cabo de unas horas o al día siguiente. Si la shell dice que el `.md` ya existe (`File exists` en sh, `cannot overwrite existing file` en bash, `file exists` en zsh; la salida no es 0) o el script dice `… ya existe: no se pisa`, la consulta de hoy ya está hecha: no se repite, o se borran antes los dos archivos de hoy.

- [ ] **Paso 6: comprobar que no salen IPs ni identificadores**

📍 Máquina de trabajo.

Ejecutar:

```sh
fecha=$(date -u +%F)
python3 -I - <intercambio>/resultados/ooni-$fecha.md <intercambio>/resultados/ooni-$fecha.json <<'EOF'
import re, sys
for ruta in sys.argv[1:]:
    texto = open(ruta, encoding='utf-8').read()
    ips = re.findall(r'\b\d{1,3}(?:\.\d{1,3}){3}\b', texto)
    ids = re.findall(r'\d{14}\.\d+_VE_|_VE_\d+_n\d_', texto)
    print(f'{ruta.rsplit("/", 1)[-1]}: {len(ips)} IPs, {len(ids)} identificadores de medición')
EOF
```

Esperado, con la fecha de hoy:

```
ooni-<AAAA-MM-DD>.md: 0 IPs, 0 identificadores de medición
ooni-<AAAA-MM-DD>.json: 0 IPs, 0 identificadores de medición
```

- [ ] **Paso 7: commit en el banco**

📍 Máquina de trabajo. Tras el `git add`, revisar `git -C <banco> diff --cached` antes del commit.

Ejecutar:

```sh
git -C <banco> add p8/ooni.py p8/prueba_ooni.py
git -C <banco> status --short; git -C <banco> diff --cached --stat | tail -n 1
git -C <banco> commit -q -m "P8: consulta de OONI para Venezuela (mensajería, workers.dev y pages.dev, DoH y FCM), solo agregados" && git -C <banco> log --oneline -1
```

Esperado:

```
A  p8/ooni.py
A  p8/prueba_ooni.py
 2 files changed, 563 insertions(+)
<commit> P8: consulta de OONI para Venezuela (mensajería, workers.dev y pages.dev, DoH y FCM), solo agregados
```

**Notas:**

- **Nota:** validado el 14-oct-2026: las pruebas, en la máquina de trabajo, y la consulta de verdad, también desde ella, tres veces (de 1 min 46 s a 3 min 9 s, unas 270 peticiones a la API cada vez); este plan se generó leyendo los archivos validados y se volvió a ejecutar entero, paso a paso, con las rutas de una copia del banco. La salida del paso 5 es la de esa consulta; sus dos archivos se guardaron como salida de ejemplo. Tras la revisión (las consultas antes que el arranque y las columnas por IP), las pruebas nuevas se vieron en rojo con el código anterior (sin `DOH_IP`, y `arranque` donde ahora es `resuelve`) y las 17, en verde con el nuevo, y los pasos 1 a 4 y 7 se repitieron en otra copia. La consulta de verdad con el código nuevo se cortó a los 54 s con `HTTP Error 429: Too Many Requests` (era la cuarta del día desde la misma IP), después de `dnscheck Google por IP: 4 ASN` y `dnscheck Cloudflare por IP: 4 ASN`: salió con 1, sin `.json` y con el `.md` vacío, como prevé el paso 5, y no se repitió. Las tablas con las columnas por IP se ven por primera vez en la ejecución.
- **Nota:** lo que OONI contesta ya (14-oct-2026, 90 días): Telegram sin bloqueo confirmado (0,5 % de anómalas, 0 confirmadas), Signal con anomalías en más de la mitad de las mediciones, WhatsApp en el 1,2 %; ninguna medición de `*.workers.dev` ni de `*.pages.dev` en VE (de 2.959 dominios medidos); el DoH de Google, Cloudflare y AdGuard resuelve en todos los operadores con muestras, NextDNS y Quad9 con algún fallo suelto por tiempo, y Mullvad falla en Inter (AS21826) con `dns_bogon_error` al resolver su propio nombre (todo por nombre; por IP, Google y Cloudflare tienen mediciones en 4 operadores, aún sin cifras); `fcm.googleapis.com`, 1 anómala de 832. Para P8, "al menos 2 resolvedores responden" ya se cumple en todos los operadores con datos. Lo que OONI no puede contestar (que la página desechable cargue, la entrega real de Web Push y de Telegram) sigue en el tramo C.
- **Nota:** la muestra de `dnscheck` es pequeña (3 por resolvedor y operador) y de los días más recientes; `--crudas` la sube, a costa de más peticiones. Un fallo suelto por tiempo (`generic_timeout_error`) no indica bloqueo; un `dns_bogon_error` repetido en el arranque, sí (el nombre del resolvedor resuelve a una IP no pública). Con Google, Cloudflare y Quad9, un arranque fallido no impide que el DoH responda por IP: sale como «nombre: dns_bogon_error» en una celda que resuelve, y es lo que importa para AND-09 (DoH fijado por IP).

---

### Tarea 13: Sesión 1 con el teléfono: adb en Windows, instalación, P1, ficha del aparato, P2 y P5

**Archivos:** ninguno del repo ni del banco. Fuera de los dos:
- `<intercambio>/entrega/sesion-1/`: los APK que baja la persona responsable y sus sumas.
- `<intercambio>/telefono/sesion-1/` y `<intercambio>/telefono/sesion-1-r8/`: lo que sube la persona responsable (las capturas y la carpeta `files` del banco, o el registro del banco con el plan B).
- `<intercambio>/resultados/`: `sesion-1-info.txt`, `sesion-1-p2.txt`, `sesion-1-p5-firmas.txt`, `sesion-1-p5-sellado.txt`, `sesion-1-p5-tiempos.txt`, `sesion-1-r8-p5-sellado.txt` y `sesion-1-r8-p5-tiempos.txt`.

**Interfaces:**
- Consume: `compilar.sh` y lo que deja en `/work/h0b/salida/apk/` (`sin-r8/`, `con-r8/` y `compilacion.txt`) y en `/work/h0b/limpio` (tarea 4, con el código de las tareas 5 a 9); `p2/maquina/resumen.ts` (tarea 8); `p5/maquina/firmas.ts`, `sellado.ts` y `tiempos.ts` (tarea 9); `<privada>/escucha/privada.b64u` y `publica.b64u` (tarea 3).
- Produce: P1 en el teléfono (el APK se instala con adb y abre en modo avión); la ficha del aparato (modelo, Android, ABIs, RAM, StrongBox y versiones del WebView, de los navegadores y de Telegram); los resultados de P2 y de P5, sin R8 y con R8, para la tarea 16; y si `adb pull` de la carpeta del banco funciona en este teléfono, que necesitan las sesiones 2 y 3.

Las tres sesiones miden el mismo APK: el que compila el paso 1 desde el último commit del banco. Si el banco cambia entre sesiones, Claude repite los pasos 1 y 2 y la persona responsable reinstala con los pasos 14, 15 y 53 (el primero y el último, solo si se decidió que el APK no salga a analizar) antes de seguir.

Resumen para la persona responsable: vas a preparar adb en tu portátil, activar la depuración en el teléfono, instalar el banco y pasar en modo avión la ficha del aparato (P1), P2 y P5; al final compruebas el sellado con el banco compilado con R8 y dejas el teléfono como estaba. Son 52 pasos tuyos (del 3 al 54; algunos solo si hace falta), entre 1 h y 1 h 30 min: el botón 4 de P5 puede tardar 10 min. Necesitas el portátil Windows con internet, el teléfono cargado con su cable USB de datos, la SIM puesta y la cuenta Mi iniciada (MIUI las pide para «Instalar vía USB»), code-server abierto en el navegador y haber decidido si el teléfono puede mandar el banco a analizar fuera (decisión de integración 22 de la cabecera, paso 14).

#### Preparar e instalar (pasos 1 a 20)

- [ ] **Paso 1 (Claude): compilar el banco que se va a medir**

📍 Máquina de trabajo; la orden `docker exec` corre dentro de `vigia-build`. Compila desde un clon limpio del último commit del banco, con el código de las tareas 5 a 9 (las tareas 10 a 12 no tocan la app).

Ejecutar:

```sh
docker exec vigia-build sh -c 'rm -rf /work/h0b/limpio && git clone -q /fuente/banco /work/h0b/limpio && sh /work/h0b/limpio/compilar.sh > /work/h0b/compilar.log 2>&1; echo "salida: $?" >> /work/h0b/compilar.log; tail -n 9 /work/h0b/compilar.log'
docker exec vigia-build sh -c 'for f in /work/h0b/salida/apk/*/*.ficha.txt; do grep -q application-debuggable "$f" && echo "MAL, depurable: $f"; done; echo "fichas revisadas"; cat /work/h0b/salida/apk/compilacion.txt; git -C /work/h0b/limpio log --oneline -1'
git -C <banco> log --oneline -1
```

Esperado: los tamaños de los seis APK (tres bajo `== sin-r8` y tres bajo `== con-r8`) y `salida: 0`; después `fichas revisadas` sin ninguna línea `MAL`, `versionName: <commit>`, `nucleo.jar: 188cec81…`, `paquete450: 8 archivos`, la pública de escucha de `<privada>/escucha/publica.b64u` y una línea que empieza por `<commit>`; y la última, de `<banco>`, también empieza por ese `<commit>`. Si `salida` no es 0, el error está al final de `/work/h0b/compilar.log` (`docker exec vigia-build tail -n 60 /work/h0b/compilar.log`): no se sigue sin un APK. Si la pública de escucha no es la de `<privada>/escucha/publica.b64u`, parar: el APK sellaría para otra clave.

- [ ] **Paso 2 (Claude): dejar los APK en la carpeta de entrega**

📍 Máquina de trabajo. Copia los APK sin R8 (los de las medidas) y con R8 (para comprobar en los pasos 44 a 49 que el sellado y los vectores funcionan también así), de las dos ABI de ARM, cada uno con su suma.

Ejecutar:

```sh
mkdir -p <intercambio>/entrega/sesion-1
for v in sin-r8 con-r8; do for a in arm64-v8a armeabi-v7a; do
  n=app-$a-release.apk; d=$n; [ $v = con-r8 ] && d=con-r8-$n
  docker cp -L vigia-build:/work/h0b/salida/apk/$v/$n <intercambio>/entrega/sesion-1/$d && test -f <intercambio>/entrega/sesion-1/$d && ! test -L <intercambio>/entrega/sesion-1/$d
done; done
(cd <intercambio>/entrega/sesion-1 && sha256sum *.apk > sumas.sha256 && cat sumas.sha256)
```

Esperado: cuatro líneas `<64 hex>  <nombre>.apk`: `app-arm64-v8a-release.apk`, `app-armeabi-v7a-release.apk`, `con-r8-app-arm64-v8a-release.apk` y `con-r8-app-armeabi-v7a-release.apk`. Claude pasa a la persona responsable la ruta real de `<intercambio>/entrega/sesion-1` por el chat.

- [ ] **Paso 3 (persona responsable): crear las carpetas de trabajo en el portátil**

📍 PowerShell en tu portátil Windows (usuario normal, no hace falta administrador).

```powershell
New-Item -ItemType Directory -Force (Join-Path $HOME 'vigia-h0b\sesion-1') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $HOME 'vigia-h0b\sesion-1-r8') | Out-Null
Set-Location (Join-Path $HOME 'vigia-h0b')
Get-Location
```

Qué hace: las dos primeras líneas crean `vigia-h0b` y, dentro, `sesion-1` y `sesion-1-r8` (adb no crea carpetas al traer archivos); la tercera entra en `vigia-h0b`; la cuarta dice dónde estás.
Esperado: la ruta `C:\Users\<tu usuario>\vigia-h0b`.

- [ ] **Paso 4 (persona responsable): bajar adb de Google**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/platform-tools_r37.0.1-win.zip' -OutFile '.\platform-tools_r37.0.1-win.zip'
```

Qué hace: las tres primeras líneas preparan la ventana (la carpeta de trabajo; adb aún no está, y no importa); la cuarta quita la barra de progreso (en PowerShell 5.1 hace la descarga muy lenta); la quinta baja las herramientas oficiales de Android (adb) en su versión fijada.
Esperado: ninguna salida; tarda unos segundos (8 MB). Si sale un error en rojo (por ejemplo «No se puede crear un canal seguro SSL/TLS»), ejecuta `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12` y repite la quinta línea; si sigue fallando, baja el zip con el navegador desde esa misma dirección y guárdalo en `vigia-h0b`.

- [ ] **Paso 5 (persona responsable): comprobar la suma de adb**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
(Get-FileHash -Algorithm SHA256 '.\platform-tools_r37.0.1-win.zip').Hash
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta calcula la huella SHA-256 del zip para comprobar que es el original de Google.
Esperado, exactamente: `45F4D63113E895EBDE0C90F194099A4676B6AC653BD28D54314A9E022BBC1A99`. Si sale otra cosa, no lo descomprimas: bórralo con `Remove-Item '.\platform-tools_r37.0.1-win.zip'` y avisa a Claude.

- [ ] **Paso 6 (persona responsable): descomprimir adb y comprobar su versión**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Expand-Archive -Path '.\platform-tools_r37.0.1-win.zip' -DestinationPath '.' -Force
.\platform-tools\adb.exe version
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta descomprime en `vigia-h0b\platform-tools`; la quinta pregunta a adb su versión.
Esperado: `Android Debug Bridge version 1.0.41` y en otra línea `Version 37.0.1-…`. Si dice otra versión, es que en la ruta hay otro adb: avisa a Claude.

- [ ] **Paso 7 (persona responsable): activar las opciones de desarrollador en el teléfono**

📍 En el teléfono (no en el portátil). Ajustes → Sobre el teléfono → toca 7 veces seguidas «Versión de MIUI» (o «Versión de HyperOS»).
Esperado: el aviso «Ya eres desarrollador». Si pide el PIN del teléfono, ponlo.

- [ ] **Paso 8 (persona responsable): activar la depuración USB y la instalación por USB**

📍 En el teléfono. Ajustes → Ajustes adicionales → Opciones de desarrollador. Activa, en este orden:
1. «Depuración USB».
2. «Instalar vía USB» (MIUI exige la SIM puesta y la cuenta Mi iniciada; acepta su aviso).
3. «Depuración USB (ajustes de seguridad)» (deja que adb simule el toque que abre el banco).

Esperado: los tres interruptores activados. Si «Instalar vía USB» dice que falta la cuenta Mi o la SIM, ponlas y vuelve a intentarlo. El cierre de la sesión 3 los apaga.

- [ ] **Paso 9 (persona responsable): conectar el teléfono y autorizar el portátil**

📍 Conecta el teléfono al portátil con el cable USB de datos. En el teléfono, si pregunta el modo USB, elige «Transferencia de archivos». En PowerShell, en `vigia-h0b`:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb devices
```

Qué hace: las tres primeras líneas preparan la ventana (la carpeta de trabajo y adb en la ruta; las repetirás al empezar cada bloque); la última lista los teléfonos que ve adb. La primera orden de adb deja en tu portátil un servicio de adb que escucha en 127.0.0.1:5037, solo para el propio portátil; el paso 52 lo para al acabar. No guardes esa salida ni la pegues: lleva el número de serie del teléfono.
Esperado: en el teléfono sale «¿Permitir depuración USB?»: marca «Permitir siempre desde este ordenador» y acepta. Vuelve a ejecutar `adb devices`: una línea `<número de serie>  device`. Si dice `unauthorized`, acepta el aviso del teléfono; si no sale ninguna línea, instala el controlador USB de Xiaomi o el de Google (developer.android.com/studio/run/oem-usb), desconecta y vuelve a conectar.

- [ ] **Paso 10 (persona responsable): ver qué APK le corresponde al teléfono**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell getprop ro.product.cpu.abilist
adb shell getprop ro.build.version.release
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta pregunta al teléfono qué tipo de procesador admite; la quinta, qué versión de Android tiene.
Esperado: la primera, una lista como `arm64-v8a,armeabi-v7a,armeabi`; la segunda, `11`, `12` o `13`. Si la lista empieza por `arm64-v8a`, tu ABI es `arm64-v8a`; si solo trae `armeabi-v7a`, es `armeabi-v7a`. Si la versión no es 11, 12 ni 13, avisa a Claude antes de seguir.

- [ ] **Paso 11 (persona responsable): bajar los APK desde code-server**

📍 En el navegador, en code-server. En el explorador de la izquierda, abre la carpeta de entrega que te dio Claude (`…/entrega/sesion-1`). Clic derecho sobre cada archivo → «Download…»: `sumas.sha256`, el APK de tu ABI (paso 10): `app-arm64-v8a-release.apk` o `app-armeabi-v7a-release.apk`, y el mismo con R8: `con-r8-app-arm64-v8a-release.apk` o `con-r8-app-armeabi-v7a-release.apk`. Si el navegador te pide elegir una carpeta, elige `C:\Users\<tu usuario>\vigia-h0b` y acepta guardar los cambios; si no pregunta, los deja en Descargas y el paso siguiente los lleva. No abras estos archivos en el editor de code-server.
Esperado: los tres archivos bajados.

- [ ] **Paso 12 (persona responsable): llevar lo bajado a `vigia-h0b`**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
foreach ($f in 'sumas.sha256', 'app-arm64-v8a-release.apk', 'app-armeabi-v7a-release.apk', 'con-r8-app-arm64-v8a-release.apk', 'con-r8-app-armeabi-v7a-release.apk') { $bajado = Join-Path (Join-Path $HOME 'Downloads') $f; if (Test-Path -LiteralPath $bajado) { Move-Item -LiteralPath $bajado -Destination . -Force } }
Get-ChildItem '.\*.apk', '.\sumas.sha256' | Select-Object Name, Length
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta mueve a `vigia-h0b` cada uno de esos archivos que esté en tu carpeta de Descargas (en disco se llama `Downloads`; si los guardaste directamente en `vigia-h0b`, no hace nada); la quinta los lista con su tamaño en bytes.
Esperado: `sumas.sha256` (386 bytes: cuatro líneas, una por APK de la entrega) y los dos APK de tu ABI (de 30 a 45 millones de bytes cada uno). Si falta alguno, o en Descargas quedó con otro nombre (por ejemplo `sumas (1).sha256`, porque ya había uno), bórralo de Descargas, bájalo otra vez y repite este paso.

- [ ] **Paso 13 (persona responsable): comprobar las sumas de los APK**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Get-ChildItem '.\*.apk' | ForEach-Object { '{0}  {1}' -f $_.Name, (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLower() }
Get-Content '.\sumas.sha256'
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta calcula la suma de cada APK que bajaste; la quinta muestra las que publicó Claude.
Esperado: la suma de cada APK coincide con la de su nombre en `sumas.sha256`. Si alguna no coincide, borra ese APK y vuelve a bajarlo; si sigue sin coincidir, avisa a Claude.

- [ ] **Paso 14 (persona responsable, opcional): que el teléfono no mande el banco a analizar fuera**

Solo si decidiste (decisión de integración 22 de la cabecera) que Google y Xiaomi no reciban el APK al instalarlo. Si lo aceptas, salta este paso.

📍 En el teléfono:
1. Google Play → tu foto de perfil → Play Protect → la rueda de ajustes → desactiva «Mejorar la detección de apps dañinas» (es el envío a Google de las apps que no vienen de Play). Deja activado «Analizar apps con Play Protect».
2. App Seguridad de MIUI → la rueda de ajustes → desactiva la comprobación de apps antes de instalar, si existe en tu versión (el nombre cambia entre versiones de MIUI).

Esperado: los dos ajustes apagados (o el segundo no existe). El paso 53 los vuelve a encender.

- [ ] **Paso 15 (persona responsable): instalar el banco**

⚠️ Si ya había una versión anterior del banco con otra firma, la instalación falla: en ese caso, desinstálala con `adb uninstall dev.banco.prueba` (borra sus datos de prueba, que no valen para nada) y repite.

📍 La misma ventana de PowerShell, en `vigia-h0b`. Desbloquea antes el teléfono: el aviso de MIUI sale en su pantalla. Si tu ABI es `arm64-v8a` (paso 10):

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb install -r '.\app-arm64-v8a-release.apk'
```

Si tu ABI es solo `armeabi-v7a`, pega este en su lugar:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb install -r '.\app-armeabi-v7a-release.apk'
```

Qué hace: las tres primeras líneas preparan la ventana; la última instala el banco en el teléfono.
Esperado: en el teléfono sale el aviso de MIUI «Instalar vía USB»: acéptalo en menos de 10 s. En PowerShell, `Success`. Si sale `INSTALL_FAILED_USER_RESTRICTED`, no aceptaste a tiempo: desbloquea el teléfono y repite.

- [ ] **Paso 16 (persona responsable): activar «No molestar»**

📍 En el teléfono. Desliza desde arriba para abrir los ajustes rápidos y toca «No molestar» (el icono de la luna).
Esperado: el icono de la luna en la barra de estado. Así ninguna notificación sale en las capturas. El paso 54 lo quita.

- [ ] **Paso 17 (persona responsable): poner el teléfono en modo avión**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell cmd connectivity airplane-mode enable
adb shell cmd connectivity airplane-mode
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta activa el modo avión desde el portátil (el cable USB sigue funcionando); la quinta lo comprueba.
Esperado: la quinta responde `enabled`. Si responde `disabled` o un error, actívalo a mano en los ajustes rápidos del teléfono. Si el modo avión ya estaba activado antes de este paso, abre los ajustes rápidos y comprueba que el Wi-Fi y el Bluetooth están apagados; si no, apágalos.

- [ ] **Paso 18 (persona responsable): abrir el banco y sacar la ficha del aparato (P1)**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell monkey -p dev.banco.prueba -c android.intent.category.LAUNCHER 1
```

Qué hace: las tres primeras líneas preparan la ventana; la última abre el banco en el teléfono como si tocaras su icono.
Esperado: `Events injected: 1` y el banco abierto en el teléfono. En el banco, toca «Información del teléfono». Deben salir en grande el fabricante y el modelo, la versión de Android, las ABI, la RAM, «StrongBox: sí» o «no», «Modo avión: sí» y «Banco: <commit>», el del paso 1. Si sale «Modo avión: no», vuelve al paso 17 y después toca «Leer otra vez».

Si el banco se cierra solo al abrir, trae solo los cierres del banco (no el registro entero del teléfono) y avisa a Claude. 📍 La misma ventana de PowerShell, en `vigia-h0b`. ⚠️ La sexta línea borra del teléfono el archivo temporal que crea la cuarta, cuando la quinta ya lo copió al portátil.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell "logcat -d -b crash | grep -B 1 -A 60 dev.banco.prueba > /data/local/tmp/cierre.txt"
adb pull /data/local/tmp/cierre.txt .\sesion-1\
adb shell rm /data/local/tmp/cierre.txt
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta guarda en el teléfono solo las líneas de los cierres del banco (la de `FATAL EXCEPTION` y las 60 siguientes); la quinta las trae a `vigia-h0b\sesion-1`; la sexta las borra del teléfono. `cierre.txt` se sube con lo demás de la sesión.

- [ ] **Paso 19 (persona responsable): captura de la ficha**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

⚠️ La sexta línea borra del teléfono la captura temporal que crea la cuarta, cuando la quinta ya la copió al portátil. Lo mismo en todas las capturas y los volcados del registro de esta sesión: la última orden de cada bloque borra del teléfono solo el archivo temporal que acaba de crear.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p1-info.png
adb pull /data/local/tmp/p1-info.png .\sesion-1\
adb shell rm /data/local/tmp/p1-info.png
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta hace una captura de la pantalla del teléfono en su carpeta temporal; la quinta la trae al portátil; la sexta la borra del teléfono.
Esperado: `1 file pulled` y el archivo en `vigia-h0b\sesion-1`.

- [ ] **Paso 20 (persona responsable): comprobar que se pueden sacar los resultados del banco**

Se comprueba ahora, con la ficha, porque si el teléfono no deja sacar la carpeta del banco la sesión tiene que pasar al plan B antes de P2.

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb pull /sdcard/Android/data/dev.banco.prueba/files .\sesion-1\
(Get-Content '.\sesion-1\files\resultados.jsonl').Count
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta copia la carpeta de resultados del banco a `vigia-h0b\sesion-1\files`; la quinta cuenta sus líneas.
Esperado: `… files pulled` y un número de 1 o más (una línea por cada vez que se leyó la ficha). Sigue con el paso 21.

Si `adb pull` dice `Permission denied` o `does not exist`, este teléfono no deja sacar la carpeta del banco y la sesión sigue con el plan B: los resultados se sacan del registro del teléfono. ⚠️ El plan B amplía el búfer del registro del teléfono hasta el final de la sesión; el paso 51 lo devuelve a su tamaño. En la misma ventana:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb logcat -g
adb logcat -G 16M
adb logcat -g
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta enseña el tamaño de los búferes del registro: apunta el de `main` (por ejemplo `256 KiB`); la quinta lo sube a 16 MiB, para que los resultados del banco no se pierdan antes de guardarlos; la sexta lo comprueba. Esperado: en la sexta, el búfer `main` con 16 MiB. Si la quinta da un error, prueba con `adb logcat -G 8M`. Dile a Claude que vas por el plan B.

#### P2: FTS5, `vault.db` y la cola (pasos 21 a 27)

- [ ] **Paso 21 (persona responsable): que la pantalla no se apague mientras duren P2 y P5**

Con la pantalla apagada Android puede congelar la app y los tiempos dejarían de valer. Esto cambia un ajuste del teléfono (no borra nada): el paso 41 lo deja como estaba.

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell svc power stayon usb
adb shell settings get global stay_on_while_plugged_in
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta deja la pantalla encendida mientras el teléfono esté conectado por USB; la quinta lee ese ajuste.
Esperado: ninguna salida de la cuarta y `2` de la quinta. Si sale otra cosa, activa a mano «Mantener activo» en Ajustes → Ajustes adicionales → Opciones de desarrollador.

- [ ] **Paso 22 (persona responsable): abrir P2**

📍 En el teléfono. En el banco, si estás en "Información del teléfono", toca «Volver al menú». Después toca «P2: FTS5, vault.db y cola».

Esperado: la pantalla «P2: FTS5, vault.db y cola», con los botones «1. Autoprueba: FTS5, legal.db y vault.db» y «2. Cola: 450 sobres en archivos y en vault.db». Si el banco se cierra solo, sigue lo que dice el paso 18 (el bloque del registro de cierres) y avisa a Claude.

- [ ] **Paso 23 (persona responsable): la autoprueba**

📍 En el teléfono. Toca «1. Autoprueba: FTS5, legal.db y vault.db» y espera sin salir de la pantalla. Primero sale «En marcha...»; suele tardar menos de 30 s.

Esperado: tres líneas grandes, cada una con ✓:
- `✓ "detencion" encuentra "detención": N de N` (las dos N iguales; deberían ser 819);
- `✓ vault.db no se lee sin clave y su cabecera no es "SQLite format 3"`;
- `✓ legal.db se reconstruye en … ms (menos de 2000)`.

Debajo sale el resultado completo en letra pequeña. Si una línea sale con ✗, no repitas: es un resultado, y la captura del paso 24 lo recoge. Si sale `Error: …` en lugar de las tres líneas, haz igualmente la captura y avisa a Claude con ese texto.

- [ ] **Paso 24 (persona responsable): captura de la autoprueba**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p2-autoprueba.png
adb pull /data/local/tmp/p2-autoprueba.png .\sesion-1\
adb shell rm /data/local/tmp/p2-autoprueba.png
```

Qué hace: las tres primeras líneas preparan la ventana (adb de `vigia-h0b` y esa carpeta); la cuarta hace la captura en la carpeta temporal de adb del teléfono (`/data/local/tmp`, fuera del almacenamiento compartido que ven las demás apps); la quinta la trae a `vigia-h0b\sesion-1`; la sexta la borra del teléfono.
Esperado: `1 file pulled` y el archivo `p2-autoprueba.png` en `vigia-h0b\sesion-1`. Si dice `no devices/emulators found`, el cable se soltó: reconéctalo, comprueba con `adb devices` que sale `device` (sin guardar ni pegar esa salida: lleva el número de serie) y repite el bloque.

- [ ] **Paso 25 (persona responsable): la cola de 450 sobres**

📍 En el teléfono. Toca «2. Cola: 450 sobres en archivos y en vault.db» y espera sin salir de la pantalla. Escribe y lee 450 sobres de tres formas: puede tardar de 1 a 5 min.

Esperado: tres líneas con ✓: `✓ Keystore por sobre: escribir p95 … ms, leer p95 … ms`, `✓ Clave de datos: …` y `✓ vault.db desde JS: …`. El ✓ solo dice que los 450 sobres se leyeron iguales; los tiempos los juzga Claude. Si sale `Error: …`, haz la captura y avisa a Claude con ese texto.

- [ ] **Paso 26 (persona responsable): captura de la cola**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p2-cola.png
adb pull /data/local/tmp/p2-cola.png .\sesion-1\
adb shell rm /data/local/tmp/p2-cola.png
```

Qué hace: lo mismo que el paso 24, con `p2-cola.png`.
Esperado: `1 file pulled`. Si vas por el plan B del paso 20, sigue con el paso 27; si no, con P5 (paso 28).

- [ ] **Paso 27 (persona responsable; solo con el plan B del paso 20): guardar el registro de P2**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

⚠️ La sexta línea borra del teléfono el archivo temporal que crea la cuarta, cuando la quinta ya lo copió al portátil.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell logcat -d -v raw -s BANCO:I -f /data/local/tmp/banco-p2.txt
adb pull /data/local/tmp/banco-p2.txt .\sesion-1\
adb shell rm /data/local/tmp/banco-p2.txt
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta escribe en el teléfono los resultados que el banco dejó en su registro hasta ahora; la quinta los trae a `vigia-h0b\sesion-1`; la sexta los borra del teléfono.
Esperado: `1 file pulled`. Sin el plan B, salta este paso.

#### P5: Keystore, sellado y verificador; sacar los resultados (pasos 28 a 50)

- [ ] **Paso 28 (persona responsable): abrir P5**

📍 En el teléfono. En el banco, toca «Volver al menú» y después «P5: Keystore, sellado y verificador».

Esperado: la pantalla de P5 con seis botones numerados del 1 al 6. Pulsa cada uno solo cuando el anterior haya terminado (el texto de abajo deja de decir «En marcha...») y no salgas de la pantalla mientras uno esté en marcha.

- [ ] **Paso 29 (persona responsable): botón 1, las firmas del Keystore**

📍 En el teléfono. Toca «1. Firmas del Keystore (TEE y StrongBox)». Crea una llave en el chip de seguridad del teléfono y firma 100 veces con ella, y otra vez con StrongBox si el teléfono lo tiene: tarda de unos segundos a 2 min.

Esperado: un bloque con `"tee"` (con `"nivel": "tee"`, o `"hardware"` en Android 11, y `"verifica_en_kotlin": true`) y `"strongbox"` (con sus tiempos, o `"disponible": false` y el motivo: lo normal en un gama baja). Si sale `"nivel": "software"`, sigue, pero díselo a Claude: la llave no está en hardware. Si sale `Error: …`, haz la captura y avisa a Claude con ese texto.

- [ ] **Paso 30 (persona responsable): captura de las firmas**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p5-firmas.png
adb pull /data/local/tmp/p5-firmas.png .\sesion-1\
adb shell rm /data/local/tmp/p5-firmas.png
```

Qué hace: hace la captura en la carpeta temporal de adb del teléfono (`/data/local/tmp`, fuera del almacenamiento compartido que ven las demás apps), la trae a `vigia-h0b\sesion-1` y la borra del teléfono.
Esperado: `1 file pulled`.

- [ ] **Paso 31 (persona responsable): botón 2, el sellado**

📍 En el teléfono. Toca «2. Sellado para la clave de escucha». Tarda unos segundos.

Esperado: `"envoltura_bytes": 80`, un `"kc"` de 64 letras y cifras, y los tiempos. Si sale `Error: …`, avisa a Claude con ese texto.

- [ ] **Paso 32 (persona responsable): botón 3, Hermes y vectores**

📍 En el teléfono. Toca «3. Hermes y vectores (noble y Kotlin)». Tarda menos de 1 min.

Esperado: en `"hermes"`, `"text_encoder": true`, `"text_decoder": true`, `"intl_zona": true`, `"bigint": true` y `"object_has_own": true`; en `"noble"` y en `"kotlin"`, `"total": 72` y `"bien": 72`, con `"fallos": []`. Si algo sale `false` o `"bien"` es menor que 72, no lo repitas: es un resultado. Haz la captura del paso 33 y sigue.

- [ ] **Paso 33 (persona responsable): captura de los vectores**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p5-vectores.png
adb pull /data/local/tmp/p5-vectores.png .\sesion-1\
adb shell rm /data/local/tmp/p5-vectores.png
```

Qué hace: lo mismo que el paso 30, con `p5-vectores.png`.
Esperado: `1 file pulled`.

- [ ] **Paso 34 (persona responsable): botón 4, el verificador con noble (el lento)**

📍 En el teléfono. Toca «4. Verificador con noble (con K y sin K)». Verifica dos veces 30 min de evidencia sintética en JavaScript puro. Puede tardar de 1 a 10 min: no toques la pantalla hasta que salga el resultado.

Esperado: una lista con dos medidas, `"con_k": true` y `"con_k": false`, cada una con `"estado": "integro"`, `"fragmentos": 450`, `"ok": true` y sus `"ms"`. Que tarde más de 5 s es un resultado, no un fallo. Si a los 15 min sigue en «En marcha...», haz la captura del paso 35 y avisa a Claude antes de seguir.

- [ ] **Paso 35 (persona responsable): captura del verificador con noble**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p5-noble.png
adb pull /data/local/tmp/p5-noble.png .\sesion-1\
adb shell rm /data/local/tmp/p5-noble.png
```

Qué hace: lo mismo que el paso 30, con `p5-noble.png`.
Esperado: `1 file pulled`.

- [ ] **Paso 36 (persona responsable): botón 5, el verificador con Kotlin**

📍 En el teléfono. Toca «5. Verificador con Kotlin (con K y sin K)». Lo mismo, con las primitivas en Kotlin: menos de 1 min.

Esperado: como en el paso 34, dos medidas con `"estado": "integro"`, `"fragmentos": 450` y `"ok": true`.

- [ ] **Paso 37 (persona responsable): captura del verificador con Kotlin**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p5-kotlin.png
adb pull /data/local/tmp/p5-kotlin.png .\sesion-1\
adb shell rm /data/local/tmp/p5-kotlin.png
```

Qué hace: lo mismo que el paso 30, con `p5-kotlin.png`.
Esperado: `1 file pulled`.

- [ ] **Paso 38 (persona responsable): botón 6, la cota en Kotlin puro**

📍 En el teléfono. Toca «6. Cota en Kotlin puro (con K y sin K)». Menos de 1 min.

Esperado: dos bloques, `"con_k": true` y `"con_k": false`, cada uno con dos `"pasadas"` con `"fallos": 0` y `"fragmentos": 450`.

- [ ] **Paso 39 (persona responsable): captura de la cota**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p5-cota.png
adb pull /data/local/tmp/p5-cota.png .\sesion-1\
adb shell rm /data/local/tmp/p5-cota.png
```

Qué hace: lo mismo que el paso 30, con `p5-cota.png`.
Esperado: `1 file pulled`.

- [ ] **Paso 40 (persona responsable): sacar los resultados de la sesión**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb pull /sdcard/Android/data/dev.banco.prueba/files .\sesion-1\
(Get-Content '.\sesion-1\files\resultados.jsonl').Count
```

Qué hace: la cuarta línea copia la carpeta de resultados del banco a `vigia-h0b\sesion-1\files`; la quinta cuenta sus líneas, una por resultado.
Esperado: `… files pulled` y un número de 16 o más (16 de P2 y P5 si pulsaste cada botón una vez, más una línea por cada vez que se leyó la ficha).

Si fuiste por el plan B del paso 20, en lugar de este bloque usa este, que guarda el registro del banco desde P2.

⚠️ La sexta línea borra del teléfono el archivo temporal que crea la cuarta, cuando la quinta ya lo copió al portátil.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell logcat -d -v raw -s BANCO:I -f /data/local/tmp/banco-p5.txt
adb pull /data/local/tmp/banco-p5.txt .\sesion-1\
adb shell rm /data/local/tmp/banco-p5.txt
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta escribe en el teléfono los resultados que el banco dejó en su registro; la quinta los trae a `vigia-h0b\sesion-1`; la sexta los borra del teléfono.
Esperado: `1 file pulled`.

- [ ] **Paso 41 (persona responsable): devolver el ajuste de la pantalla**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell svc power stayon false
adb shell settings get global stay_on_while_plugged_in
```

Qué hace: deshace el paso 21; la última línea lo comprueba.
Esperado: `0`. Si activaste «Mantener activo» a mano en el paso 21, desactívalo igual a mano.

- [ ] **Paso 42 (persona responsable): crear la carpeta de la sesión en code-server**

📍 En el navegador, en code-server. En el explorador de la izquierda, abre la carpeta de intercambio que te dio Claude, clic derecho sobre `telefono` → «Nueva carpeta…» y llámala `sesion-1`.

Esperado: la carpeta `telefono/sesion-1`, vacía.

- [ ] **Paso 43 (persona responsable): subir los resultados y las capturas**

📍 En el navegador, en code-server, y en el Explorador de archivos de Windows. Arrastra a `telefono/sesion-1` la carpeta `files` (o, con el plan B del paso 20, `banco-p2.txt` y `banco-p5.txt`), `cierre.txt` si existe y los archivos `.png` que hay en `C:\Users\<tu usuario>\vigia-h0b\sesion-1`. No abras estos archivos en el editor de code-server (guarda historial local de lo que abre).

Esperado: en code-server, `telefono/sesion-1/files/resultados.jsonl` y las capturas (`p1-info.png`, `p2-autoprueba.png`, `p2-cola.png`, `p5-firmas.png`, `p5-vectores.png`, `p5-noble.png`, `p5-kotlin.png` y `p5-cota.png`). Sigue con el paso 44.

- [ ] **Paso 44 (persona responsable): instalar el banco compilado con R8**

Es el mismo banco, compilado con R8 (que quita y renombra código): hay que ver que el sellado y los vectores también funcionan así. Se instala el APK con R8 de la ABI de tu teléfono, la del paso 10, sea `arm64-v8a` o solo `armeabi-v7a`.

Desbloquea el teléfono antes de pegar el bloque: la pantalla ya puede apagarse y, si hay que desbloquearlo cuando sale el aviso de MIUI «Instalar vía USB», no suele dar tiempo a aceptarlo en sus 10 s.

⚠️ Sustituye la app instalada por la compilada con R8, sin borrar sus datos; el paso 48 la devuelve.

📍 PowerShell en tu portátil, en `vigia-h0b`. Si tu teléfono es `arm64-v8a`:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb install -r '.\con-r8-app-arm64-v8a-release.apk'
```

Si tu teléfono es solo `armeabi-v7a`, pega este en su lugar:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb install -r '.\con-r8-app-armeabi-v7a-release.apk'
```

Qué hace: sustituye el banco instalado por el compilado con R8 de tu ABI. Los resultados y las llaves del banco se conservan (misma firma).
Esperado: el aviso de MIUI «Instalar vía USB» en el teléfono (acéptalo en menos de 10 s) y `Success`. Si sale `INSTALL_FAILED_USER_RESTRICTED`, el aviso no se aceptó a tiempo: desbloquea el teléfono y repite el bloque.

- [ ] **Paso 45 (persona responsable): sellado y vectores con R8**

📍 En el teléfono. Abre el banco, entra en «P5: Keystore, sellado y verificador» y toca el botón 2 («Sellado…») y, cuando acabe, el 3 («Hermes y vectores…»).

Esperado: lo mismo que en los pasos 31 y 32 (`"envoltura_bytes": 80`; 72 de 72 con noble y con Kotlin). Si el banco se cierra al abrir P5 o sale `Error: …`, es justo lo que se busca: haz la captura y sigue.

- [ ] **Paso 46 (persona responsable): captura con R8**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p5-r8.png
adb pull /data/local/tmp/p5-r8.png .\sesion-1-r8\
adb shell rm /data/local/tmp/p5-r8.png
```

Qué hace: lo mismo que el paso 30, con `p5-r8.png`, pero a una carpeta aparte, `vigia-h0b\sesion-1-r8`, la que creó el paso 3.
Esperado: `1 file pulled`.

- [ ] **Paso 47 (persona responsable): sacar los resultados con R8**

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb pull /sdcard/Android/data/dev.banco.prueba/files .\sesion-1-r8\
(Get-Content '.\sesion-1-r8\files\resultados.jsonl').Count
```

Qué hace: como el paso 40, a `vigia-h0b\sesion-1-r8\files`; el archivo trae todo lo de la sesión más lo del banco con R8.
Esperado: `… files pulled` y 3 líneas más que en el paso 40 (sellado, Hermes y vectores), o alguna más si abriste la ficha.

Si fuiste por el plan B del paso 20, en lugar de este bloque usa este.

⚠️ La sexta línea borra del teléfono el archivo temporal que crea la cuarta, cuando la quinta ya lo copió al portátil.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell logcat -d -v raw -s BANCO:I -f /data/local/tmp/banco-r8.txt
adb pull /data/local/tmp/banco-r8.txt .\sesion-1-r8\
adb shell rm /data/local/tmp/banco-r8.txt
```

Qué hace: lo mismo que el plan B del paso 40, con el registro del banco con R8, a `vigia-h0b\sesion-1-r8`.
Esperado: `1 file pulled`.

- [ ] **Paso 48 (persona responsable): volver al banco sin R8**

⚠️ Sustituye otra vez la app instalada (sin borrar sus datos). Hay que hacerlo: las sesiones siguientes miden con el banco sin R8.

Desbloquea el teléfono antes de pegar el bloque: el aviso «Instalar vía USB» sale en su pantalla.

📍 PowerShell en tu portátil, en `vigia-h0b`. Si tu teléfono es `arm64-v8a`:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb install -r '.\app-arm64-v8a-release.apk'
```

Si tu teléfono es solo `armeabi-v7a`, pega este en su lugar:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb install -r '.\app-armeabi-v7a-release.apk'
```

Qué hace: vuelve a instalar el banco sin R8 de tu ABI encima del que tiene R8, conservando sus datos.
Esperado: el aviso de «Instalar vía USB» (acéptalo en menos de 10 s) y `Success`. Si sale `INSTALL_FAILED_USER_RESTRICTED`, desbloquea el teléfono y repite el bloque.

- [ ] **Paso 49 (persona responsable): subir la carpeta con R8**

📍 En el navegador, en code-server: clic derecho sobre `telefono` → «Nueva carpeta…» → `sesion-1-r8`, y arrastra dentro la carpeta `files` (o, con el plan B, `banco-r8.txt`) y `p5-r8.png` de `C:\Users\<tu usuario>\vigia-h0b\sesion-1-r8`.

Esperado: `telefono/sesion-1-r8/files/resultados.jsonl` y `p5-r8.png`. Avisa a Claude.

- [ ] **Paso 50 (persona responsable): comprobación final de P5: queda instalado el banco sin R8**

Los dos APK llevan el mismo commit, así que la ficha del banco no los distingue: se compara la suma del APK que tiene instalado el teléfono con la del APK sin R8 de tu ABI.

📍 PowerShell en tu portátil, en `vigia-h0b`. Si tu teléfono es `arm64-v8a`:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
$telefono = (adb shell 'sha256sum $(pm path dev.banco.prueba | cut -d: -f2)') -split ' ' | Select-Object -First 1
$portatil = (Get-FileHash -Algorithm SHA256 '.\app-arm64-v8a-release.apk').Hash.ToLower()
$telefono
$portatil
$telefono -eq $portatil
```

Si tu teléfono es solo `armeabi-v7a`, pega este en su lugar:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
$telefono = (adb shell 'sha256sum $(pm path dev.banco.prueba | cut -d: -f2)') -split ' ' | Select-Object -First 1
$portatil = (Get-FileHash -Algorithm SHA256 '.\app-armeabi-v7a-release.apk').Hash.ToLower()
$telefono
$portatil
$telefono -eq $portatil
```

Qué hace: la cuarta línea pide al teléfono la suma SHA-256 del APK del banco que tiene instalado (`pm path` dice dónde está; la orden va entre comillas simples para que PowerShell se la pase entera a adb) y se queda con la suma; la quinta calcula la del APK sin R8 que tienes en el portátil; las dos siguientes las enseñan y la última las compara.
Esperado: dos líneas iguales de 64 letras y cifras y, debajo, `True`. Si sale `False`, el teléfono no tiene el banco sin R8: repite el paso 48 y después este. Si la cuarta línea da un error de adb (por ejemplo, `no devices/emulators found`), el cable se soltó: reconéctalo y repite el bloque. En code-server tienes `telefono/sesion-1` y `telefono/sesion-1-r8`. Solo queda cerrar la sesión.

#### Cierre de la sesión (pasos 51 a 54)

- [ ] **Paso 51 (persona responsable; solo con el plan B del paso 20): devolver el búfer del registro a su tamaño**

📍 La misma ventana de PowerShell, en `vigia-h0b`. Cambia `<TAMAÑO>` por el tamaño de `main` que apuntaste en el paso 20, escrito con K o M y sin espacio: por ejemplo `256K` o `1M`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb logcat -G <TAMAÑO>
adb logcat -g
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta devuelve el búfer del registro al tamaño que tenía; la quinta lo comprueba.
Esperado: en la última línea, `main` con el tamaño que apuntaste. Sin el plan B, salta este paso.

- [ ] **Paso 52 (persona responsable): quitar el modo avión**

📍 La misma ventana de PowerShell, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell cmd connectivity airplane-mode disable
adb shell cmd connectivity airplane-mode
adb kill-server
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta quita el modo avión del paso 17; la quinta lo comprueba; la sexta para el servicio de adb del portátil (escuchaba en 127.0.0.1:5037, solo para el propio portátil; el próximo bloque con adb lo vuelve a arrancar solo).
Esperado: `disabled`. Si sale otra cosa, quítalo a mano en los ajustes rápidos del teléfono.

- [ ] **Paso 53 (persona responsable, opcional): volver a encender el análisis de apps**

Solo si hiciste el paso 14.

📍 En el teléfono: vuelve a activar «Mejorar la detección de apps dañinas» en Play Protect y, si la desactivaste, la comprobación de apps antes de instalar de la app Seguridad.
Esperado: los dos ajustes como estaban.

- [ ] **Paso 54 (persona responsable): quitar «No molestar»**

📍 En el teléfono. Abre los ajustes rápidos y toca otra vez «No molestar».
Esperado: el icono de la luna ya no está en la barra de estado. Ya puedes desconectar el cable: el banco y la depuración USB se quedan para las sesiones 2 y 3 (el cierre de la sesión 3 los quita). Dile a Claude que la sesión 1 ha terminado y está subida.

## Análisis en la máquina (Claude, tras la subida)

- [ ] **Paso A1: revisar lo subido, dejar que el contenedor lo lea y comprobar el commit**

code-server sube los archivos como root y el contenedor corre con el uid 1001. Solo se abre la lectura si lo subido son archivos y carpetas normales (ni enlaces ni archivos especiales). El 700 de `<intercambio>` frena a los usuarios sin privilegios de la máquina (no a root; decisión de integración 21). Las herramientas tienen que ser las del commit del APK medido.

📍 Máquina de trabajo.

Ejecutar:

```sh
for s in sesion-1 sesion-1-r8; do
  [ -d <intercambio>/telefono/$s ] || { echo "$s: no está"; continue; }
  test "$(find <intercambio>/telefono/$s ! -type f ! -type d | wc -l)" -eq 0 && chmod -R a+rX <intercambio>/telefono/$s && echo "$s: bien, solo archivos y carpetas, legibles para el contenedor"
done
stat -c '%a %n' <intercambio>
docker exec vigia-build sh -c 'grep "^versionName" /work/h0b/salida/apk/compilacion.txt; git -C /work/h0b/limpio log --oneline -1'
```

Esperado: `sesion-1: bien, …` y `sesion-1-r8: bien, …`, `700 <intercambio>`, `versionName: <commit>` y una línea que empieza por ese `<commit>`, el «Banco:» de `p1-info.png`. Si una carpeta no da `bien`, trae enlaces u otros archivos especiales: no se analiza nada de ella y se avisa a la persona responsable. Si una carpeta `no está`, se le pide que la suba. Si el commit no cuadra (se recompiló después de la sesión), `docker exec vigia-build git -C /work/h0b/limpio diff --stat <commit del teléfono> -- p2/maquina p5/maquina` debe salir vacío (las herramientas no han cambiado); si no, se analiza con un clon de ese commit.

Si la sesión fue por el plan B (están los `banco-*.txt` y no `files/`), primero se rehace `resultados.jsonl` en cada carpeta con las líneas enteras de sus registros, sin repetir ninguna (los volcados se solapan):

```sh
for s in sesion-1 sesion-1-r8; do
  ls <intercambio>/telefono/$s/banco-*.txt > /dev/null 2>&1 || continue
  mkdir <intercambio>/telefono/$s/files && cat <intercambio>/telefono/$s/banco-*.txt | python3 -I -c '
import json, sys
vistas = set()
for l in sys.stdin:
    l = l.strip()
    if not l.startswith("{") or l in vistas:
        continue
    try:
        json.loads(l)
    except ValueError:
        print("recortada:", l[:60], file=sys.stderr)
        continue
    vistas.add(l)
    print(l)
' > <intercambio>/telefono/$s/files/resultados.jsonl && chmod -R a+rX <intercambio>/telefono/$s/files && wc -l <intercambio>/telefono/$s/files/resultados.jsonl
done
```

Esperado: el número de líneas de cada carpeta (16 o más en `sesion-1`). Cada `recortada: …` es una línea que logcat cortó: la de las firmas con StrongBox no cabe, y entonces el paso A4 no tiene sus datos.

- [ ] **Paso A2: la ficha del aparato y P1**

La ficha es la primera línea `info` (la del paso 18, en modo avión). Corre en la máquina de trabajo con la biblioteca estándar: solo lee JSON.

📍 Máquina de trabajo.

Ejecutar:

```sh
python3 -I - <intercambio>/telefono/sesion-1/files/resultados.jsonl <<'EOF' > <intercambio>/resultados/sesion-1-info.txt; echo "salida: $?"; cat <intercambio>/resultados/sesion-1-info.txt
import json, sys
lineas = [json.loads(l) for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
info = [l["datos"] for l in lineas if l["prueba"] == "info"]
if not info:
    print("✗ no hay ninguna línea info: el banco no llegó a leer la ficha")
    sys.exit(1)
d = info[0]
def app(x):
    return f"{x['paquete']} {x['version']}" if x else "no está"
print(f"{d['fabricante']} {d['modelo']}; Android {d['android']} (SDK {d['sdk']}); ABI {', '.join(d['abis'])}; RAM {d['ram_bytes'] / 2**30:.1f} GiB; StrongBox: {'sí' if d['strongbox'] else 'no'}")
for k in ("webview", "chrome", "samsung_browser", "mi_browser", "telegram"):
    print(f"{k}: {app(d[k])}")
commits = sorted({x["commit"] for x in info})
print("banco:", ", ".join(commits))
bien = d["modo_avion"] and len(commits) == 1
print("✓ P1: el banco instalado con adb abrió en modo avión" if bien else f"✗ P1: modo avión {d['modo_avion']}; commits {len(commits)}")
sys.exit(0 if bien else 1)
EOF
```

Esperado: `salida: 0` y, con los datos del teléfono:

```
salida: 0
Xiaomi <modelo>; Android <11 a 13> (SDK <30 a 33>); ABI arm64-v8a, armeabi-v7a, armeabi; RAM <x.x> GiB; StrongBox: no
webview: com.google.android.webview <versión>
chrome: com.android.chrome <versión>
samsung_browser: no está
mi_browser: com.mi.globalbrowser <versión>
telegram: org.telegram.messenger <versión>
banco: <commit>
✓ P1: el banco instalado con adb abrió en modo avión
```

Es el criterio de P1 en el teléfono ("la app abre en modo avión"); el tamaño de cada APK es el de `compilacion.txt` y `tamaños.txt` del paso 1. Con `✗ P1: modo avión False`, la primera ficha se leyó sin modo avión: si alguna otra línea `info` lo tiene, sirve esa (se anota); si ninguna, se repiten los pasos 17 a 19 en la sesión 2. Con dos commits, el teléfono tuvo dos APK distintos: se analiza solo lo del commit del paso 1. Este archivo se queda en `<intercambio>`: al informe van el modelo y el Android, no las versiones de las apps.

- [ ] **Paso A3: el resumen de P2, en un contenedor efímero sin red**

Como todas las herramientas de la sesión: sin red, con `vigia-trabajo` en solo lectura (la herramienta solo lee) y con la memoria limitada a 2 GB sin swap (`--memory 2g --memory-swap 2g`), para que nada de la sesión pase al disco de la máquina.

📍 Máquina de trabajo.

Ejecutar:

```sh
docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-1:/sesion:ro vigia-build:h0b node /work/h0b/limpio/p2/maquina/resumen.ts /sesion/files/resultados.jsonl > <intercambio>/resultados/sesion-1-p2.txt; echo "salida: $?"; cat <intercambio>/resultados/sesion-1-p2.txt
```

Esperado: `salida: 0` y unas líneas como estas (las cifras, del teléfono), con el veredicto en ✓:

```
salida: 0
P2 (SQLite 3.…, SQLCipher 4.… community)
✓ FTS5: "detencion" encuentra 819 de los 819 documentos con "detención" (con "DETENCIÓN", 819)
✓ vault.db: sin clave, "…"; con otra clave, "…"; cabecera <32 hex>; se reabre con la clave: sí (abrir: … ms)
✓ legal.db: reconstruida en … ms (criterio: menos de 2000 ms) con 1060 de 1060 documentos y 908776 bytes
Cola de 450 sobres de 16384 bytes (ms por sobre: p50 / p95 / máx; total):
  ✓ Keystore por sobre: escribir … · leer … · 450 de 450 · fsync de la carpeta: sí
  ✓ Clave de datos: escribir … · leer … · 450 de 450 · fsync de la carpeta: sí · envolver … ms, desenvolver … ms
  ✓ vault.db desde JS: insertar … · leer … · 450 de 450 · journal_mode …, synchronous …
Veredicto: ✓ autoprueba de P2 con 3 de 3 puntos; colas completas: 3 de 3
```

Con algún ✗, `salida: 1`. Qué hacer si sale ✗:
- FTS5 con ✗: op-sqlite no pliega la tilde o no tiene FTS5. Plan B de P2 (plan maestro): FTS4 con el mismo tokenizador y, si tampoco, LIKE sobre texto normalizado. Se anota y se decide en la tarea 16.
- `vault.db` con ✗: se lee sin clave o su cabecera es la de SQLite en claro: SQLCipher no está cifrando. Parar P2 y avisar a la persona responsable: `vault.db` no puede guardar nada hasta saber por qué.
- `legal.db` con ✗ por tiempo: se anota el tiempo y los bytes (la reconstrucción solo pasa al cambiar el pack); con `filas` distinto de 1060, es un fallo del banco: avisar.
- Una cola con menos de 450 correctos: un sobre no se leyó igual: es un fallo, no una medida. Se repite el botón 2 en la sesión siguiente.
- `fsync de la carpeta: no`: el sistema no deja sincronizar la carpeta; se anota (el renombrado podría perderse en un corte de corriente).

Con el veredicto ✓, las cifras van al informe en la tarea 16: los tres puntos de la autoprueba y la tabla de la cola, con la regla de la tarea 8 (Keystore por sobre si su p95 de escribir es menos de 400 ms).

- [ ] **Paso A4: las firmas del Keystore, verificadas con WebCrypto**

Como todas las herramientas de la sesión: sin red, con `vigia-trabajo` en solo lectura (la herramienta solo lee) y con la memoria limitada a 2 GB sin swap (`--memory 2g --memory-swap 2g`), para que nada de la sesión pase al disco de la máquina.

📍 Máquina de trabajo.

Ejecutar:

```sh
docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-1:/sesion:ro vigia-build:h0b node /work/h0b/limpio/p5/maquina/firmas.ts /sesion/files/resultados.jsonl > <intercambio>/resultados/sesion-1-p5-firmas.txt; echo "salida: $?"; cat <intercambio>/resultados/sesion-1-p5-firmas.txt
```

Esperado:

```
salida: 0
✓ tee (nivel tee): 3 de 3 firmas DER del Keystore verifican en WebCrypto, con DER estricto y la misma P1363 que en Kotlin; con un bit cambiado, ninguna
- strongbox: no disponible (sin FEATURE_STRONGBOX_KEYSTORE)
```

(Con StrongBox, su línea es como la de `tee`, con `nivel strongbox`; en Android 11, el nivel sale `hardware`.) Es el criterio de P5 "la firma DER del Keystore se verifica en WebCrypto". Con ✗ y `el DER no es estricto`, el Keystore da un DER que `derAP1363` de shared rechaza: lo verifica `Der.aP1363` de Kotlin, que es más laxo, pero el servidor no; se avisa y se decide en la tarea 16.

- [ ] **Paso A5: el sellado del teléfono, abierto con la privada de escucha**

La privada entra por la entrada estándar del contenedor efímero sin red y nunca se imprime (contrato del banco, "Herramientas de la máquina"); en la máquina, solo se redirige desde `<privada>/escucha/privada.b64u`. El contenedor no deja nada fuera de su memoria: `--log-driver none` (el daemon no copia su salida a su registro en `/var/lib/docker/containers/`, por si una herramienta imprimiera la privada en un error), `--memory 2g --memory-swap 2g` (sin swap, la privada no puede acabar en el swapfile de la máquina) y `vigia-trabajo` en solo lectura (la privada no puede quedarse en el volumen, que `vigia-build`, con red, sí lee). Se comprueban las dos carpetas: el sellado del banco sin R8 y el del banco con R8.

📍 Máquina de trabajo.

Ejecutar:

```sh
for s in sesion-1 sesion-1-r8; do
  [ -d <intercambio>/telefono/$s ] || { echo "$s: no está"; continue; }
  docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/$s:/sesion:ro vigia-build:h0b node /work/h0b/limpio/p5/maquina/sellado.ts /sesion/files/resultados.jsonl < <privada>/escucha/privada.b64u > <intercambio>/resultados/$s-p5-sellado.txt; echo "$s, salida: $?"; cat <intercambio>/resultados/$s-p5-sellado.txt
done
```

Esperado:

```
sesion-1, salida: 0
✓ la privada de escucha abre la envoltura del teléfono y kc coincide (sellar: primera … ms; luego p50 … ms, p95 … ms)
sesion-1-r8, salida: 0
✓ la privada de escucha abre la envoltura del teléfono y kc coincide (sellar: primera … ms; luego p50 … ms, p95 … ms)
✓ la privada de escucha abre la envoltura del teléfono y kc coincide (sellar: primera … ms; luego p50 … ms, p95 … ms)
```

(En `sesion-1-r8` están los dos sellados: el sin R8 y, el último, el de R8.) Es el criterio de P5 "un sellado HPKE hecho en el teléfono se abre en la máquina de build", con BouncyCastle sobre ART y, en la segunda carpeta, con R8. Con `sesion-1-r8: no está`, faltan los pasos con el banco con R8: se piden a la persona responsable antes de seguir. Con `✗ el teléfono selló para otra pública`, el APK lleva otra clave de escucha que la de `<privada>/escucha/`: se compara la línea `pública de escucha` de `compilacion.txt` con `<privada>/escucha/publica.b64u`. Con `✗ la privada de escucha no abre la envoltura` o `kc no coincide`, falla la interoperabilidad de HPKE en el teléfono: parar P5 y avisar.

- [ ] **Paso A6: los tiempos frente al criterio de menos de 5 s, sin R8 y con R8**

Como todas las herramientas de la sesión: sin red, con `vigia-trabajo` en solo lectura y con la memoria sin swap.

📍 Máquina de trabajo.

Ejecutar:

```sh
for s in sesion-1 sesion-1-r8; do
  [ -d <intercambio>/telefono/$s ] || { echo "$s: no está"; continue; }
  docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/$s:/sesion:ro vigia-build:h0b node /work/h0b/limpio/p5/maquina/tiempos.ts /sesion/files/resultados.jsonl > <intercambio>/resultados/$s-p5-tiempos.txt; echo "$s, salida: $?"; cat <intercambio>/resultados/$s-p5-tiempos.txt
done
```

Esperado (la forma; las cifras son las del teléfono), primero para `sesion-1`:

```
sesion-1, salida: 0
Firmas tee (nivel tee): generar … ms; primera … + … ms; initSign p50 … / p95 … / máx … ms; sign p50 … / p95 … / máx … ms; por firma, p95 … ms (rápida: 2 × p95 frente a 400 ms)
- Firmas strongbox: no disponible (sin FEATURE_STRONGBOX_KEYSTORE)
Sellado HPKE en el teléfono: primera … ms; luego p50 … / p95 … / máx … ms
✓ Hermes …: tiene lo que usa el verificador (getRandomValues: no; subtle: no)
✓ Vectores con cripto-noble: 72 de 72
✓ Vectores con cripto-kotlin: 72 de 72
Verificador sobre 450 fragmentos (criterio: menos de 5000 ms con K):
  ✓ o ✗ noble con K: … ms, integro, 450 fragmentos (leer el paquete: … ms)
  ✓ o ✗ noble sin K: … ms, integro, 450 fragmentos (leer el paquete: … ms)
  ✓ o ✗ kotlin con K: … ms, integro, 450 fragmentos (leer el paquete: … ms)
  ✓ o ✗ kotlin sin K: … ms, integro, 450 fragmentos (leer el paquete: … ms)
  - cota inferior en Kotlin puro con K (sin cadena, cierre ni marcas): … ms en frío y … ms en caliente (ECDSA …, SHA-256 …, AES …, HMAC … ms), 0 fallos
  - cota inferior en Kotlin puro sin K (sin cadena, cierre ni marcas): … ms en frío y … ms en caliente (…), 0 fallos
Veredicto: ✓ verifican 30 min con K en menos de 5 s en Hermes: …
```

La cota sale sin ✓: no hace la cadena, el cierre ni las marcas de `verificarPaquete`, así que su tiempo es una cota inferior y no cuenta como verificador (su línea solo lleva ✗ si no verificó los 450 fragmentos sin fallos). Si ninguna variante de Hermes baja de 5 s, `salida: 1` y el veredicto lo dice con la cota al lado: `Veredicto: ✗ ninguna variante de Hermes verifica 30 min con K en menos de 5 s; solo baja la cota en Kotlin puro (… ms en frío), que es una cota inferior: …` o `…; tampoco la cota en Kotlin puro (… ms en frío): …`.

Qué decide cada línea (en la tarea 16, con la persona responsable):
- **Dónde verifica la app:** de las dos variantes que corren `verificarPaquete` en Hermes, la más ligera que pase los 72 vectores y verifique los 450 fragmentos con K en menos de 5 s. Si pasa noble, la app verifica en JS (sin código nativo nuevo). Si solo pasa Kotlin (`cripto-kotlin`), la app usa `verificarPaquete` de shared con las primitivas del módulo (una sola lógica de verificación, en TS). La cota en Kotlin puro no es una tercera opción: no hace la cadena, el cierre ni las marcas, así que su tiempo es una cota inferior de lo que tardaría un verificador nativo entero. Si no pasa ninguna variante (`Veredicto: ✗` y `salida: 1`) y solo baja la cota, se declara como cota inferior (sin cadena, cierre ni marcas) y se decide con la persona responsable; si tampoco baja la cota, se declara la cifra y se decide igual.
- **TEE o StrongBox:** la regla de la cabecera. StrongBox si el teléfono lo tiene y 2 × p95 de su firma es como mucho el 10 % de `D` (400 ms con fragmentos de 4 s), es decir, si su línea `Firmas strongbox` sale `rápida`; si no, TEE, y "StrongBox no disponible" (lo normal en gama baja) se anota. Si la llave elegida sale con nivel `software`, se declara: el teléfono no sirve como referencia de gama baja con TEE. Con la llave elegida, la misma marca decide si el PUT de un fragmento lleva firma de petición (`rápida`) o le basta `s` (`lenta`, plan B de P5).
- **Hermes:** con alguna comprobación en `false`, el verificador de JS no puede correr en este teléfono tal cual: se anota qué falta y se busca un relleno antes de H4.
- **R8:** el sellado del paso A5 en `sesion-1-r8` y, en `sesion-1-r8-p5-tiempos.txt`, las líneas de Hermes y de los vectores, que son las del banco con R8 (las demás son las de antes de instalarlo y repiten las de `sesion-1`).

- [ ] **Paso A7: qué necesitan las sesiones 2 y 3 de esta sesión**

Sin orden: es una decisión con lo que salió.
- Si `adb pull` funcionó en el paso 20 (lo esperado), las sesiones 2 y 3 sacan sus grabaciones igual y no hace falta nada más.
- Si la sesión fue por el plan B, las sesiones 2 y 3 no pueden sacar sus grabaciones: son sobres binarios y logcat solo lleva texto. Antes de la sesión 2 hace falta que el banco copie la carpeta de la grabación fuera de `Android/data`, con su prueba, y un APK nuevo (pasos 1 y 2, y reinstalar con los pasos 14, 15 y 53). No se escribe por adelantado porque lo normal es que el pull funcione; si hace falta, Claude lo plantea a la persona responsable como tarea añadida, con su propio plan, antes de la sesión 2.
- Si alguna prueba se cortó (el banco se cerró, `Error: …` o una cola incompleta), se repite al empezar la sesión 2, con el mismo APK, antes de P3.

**Comprobación final (Claude):** en `<intercambio>/resultados/` están `sesion-1-info.txt` (con `✓ P1`), `sesion-1-p2.txt` (que acaba en `Veredicto: ✓ …`), `sesion-1-p5-firmas.txt`, `sesion-1-p5-sellado.txt`, `sesion-1-p5-tiempos.txt`, `sesion-1-r8-p5-sellado.txt` y `sesion-1-r8-p5-tiempos.txt`. No hay ningún ✗ salvo, quizá, los de las variantes del verificador por encima de 5 s y el del veredicto si ninguna baja, que son medidas. Las cifras van al informe en la tarea 16, sin números de serie ni horas.

---

### Tarea 14: Sesión 2 con el teléfono: P3, 30 min con clics y 20 arranques

**Archivos:** ninguno del repo ni del banco. Entradas: `/work/h0b/p3/pista.wav` (tarea 7). Salidas: `<intercambio>/entrega/sesion-2/pista-clics.wav`, `<intercambio>/telefono/sesion-2-ensayo/` y `<intercambio>/telefono/sesion-2/` (lo que sube la persona responsable) y `<intercambio>/resultados/sesion-2-ensayo.json`, `sesion-2-p3.json` y `sesion-2-codificadores.json` (los análisis).

**Interfaces:**
- Consume: el banco instalado en la sesión 1 (tarea 13), con la pantalla «P3 y P4» de la tarea 6; `p3/maquina/analizar.sh` y la pista de la tarea 7; la clave de escucha de la tarea 3 (`<privada>/escucha/privada.b64u`, solo por la entrada estándar de contenedores sin red).
- Produce: P3 en el teléfono: los codificadores AAC (prueba `p3-codificadores`, guardada en `sesion-2-codificadores.json`), una grabación de 30 min con un clic cada 10 s, los 20 arranques (`p3-arranques`) y el JSON con un veredicto por criterio (formato, muestras frente al tiempo, clics, arranques, verificación y carpeta). Lo usa la tarea 16 para el informe.

Resumen para la persona responsable: vas a grabar 30 min con el banco mientras el portátil reproduce una pista de clics, y después a cronometrar 20 arranques. Antes harás un ensayo de 1 min que Claude revisa, para no perder los 30 min si algo falla. Son 37 pasos y algo más de 1 h, de la que 35 min es esperar sin tocar nada. Necesitas: el portátil Windows enchufado a la corriente y con sus altavoces, el teléfono con el banco de la sesión 1 y su cable USB de datos, una sala donde nadie hable durante unos 45 min (el banco solo debe oír los clics, DAT-01) y code-server abierto en el navegador.

- [ ] **Paso 1 (Claude): dejar la pista de clics en la carpeta de entrega**

📍 Máquina de trabajo.

Ejecutar:

```sh
umask 077 && mkdir -p <intercambio>/entrega/sesion-2
docker cp -L vigia-build:/work/h0b/p3/pista.wav <intercambio>/entrega/sesion-2/pista-clics.wav && test -f <intercambio>/entrega/sesion-2/pista-clics.wav && ! test -L <intercambio>/entrega/sesion-2/pista-clics.wav
sha256sum <intercambio>/entrega/sesion-2/pista-clics.wav
docker exec vigia-build sh -c 'grep versionName /work/h0b/salida/apk/compilacion.txt'
```

Esperado: `c0400c42f8afe0f9014001934b32839b8ed94503461fcf0bf0c3062774c89468  <intercambio>/entrega/sesion-2/pista-clics.wav` (la suma de la tarea 7) y `versionName: <commit>`, el del APK instalado en la sesión 1 (si después se compiló otro, el de la sesión 1 está en `"commit"` de la prueba `info` de `<intercambio>/telefono/sesion-1/files/resultados.jsonl`). Claude pasa a la persona responsable por el chat la ruta real de `<intercambio>/entrega/sesion-2`, la de `<intercambio>/telefono` y el `<commit>`.

- [ ] **Paso 2 (persona responsable): preparar PowerShell y las carpetas de la sesión**

📍 PowerShell en tu portátil Windows (usuario normal, sin administrador).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
New-Item -ItemType Directory -Force '.\sesion-2-ensayo', '.\sesion-2' | Out-Null
Get-ChildItem -Directory -Name
```

Qué hace: las tres primeras líneas preparan la ventana, como en la sesión 1 (la carpeta de trabajo, adb en la ruta y entrar en ella); la cuarta crea las dos carpetas donde traerás el ensayo y la sesión; la quinta lista las carpetas.
Esperado: entre otras, `platform-tools`, `sesion-1`, `sesion-2` y `sesion-2-ensayo`. Si dice que no encuentra la ruta, la carpeta `vigia-h0b` no está: es la de la sesión 1 (tarea 13, paso 3).

- [ ] **Paso 3 (persona responsable): bajar la pista de clics**

📍 En el navegador, en code-server. En el explorador de la izquierda, abre la carpeta de entrega que te dio Claude (`…/entrega/sesion-2`). Clic derecho sobre `pista-clics.wav` → «Download…». Si el navegador te pide elegir una carpeta, elige `vigia-h0b` (`C:\Users\<tu usuario>\vigia-h0b`) y acepta guardar cambios; si no pregunta nada, la guarda en Descargas y el paso siguiente la mueve. No la abras en el editor de code-server.

Esperado: la descarga de `pista-clics.wav` (86 MB) termina sin error.

- [ ] **Paso 4 (persona responsable): llevar la pista a `vigia-h0b`**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
$bajado = Join-Path (Join-Path $HOME 'Downloads') 'pista-clics.wav'; if (Test-Path -LiteralPath $bajado) { Move-Item -LiteralPath $bajado -Destination . -Force }
Get-Item '.\pista-clics.wav' | Select-Object Name, Length
```

Qué hace: la cuarta línea mueve `pista-clics.wav` de tu carpeta de Descargas (en disco se llama `Downloads`) a `vigia-h0b`, si está allí (si la guardaste directamente en `vigia-h0b`, no hace nada); la quinta muestra su nombre y su tamaño en bytes.
Esperado: una línea con `pista-clics.wav` y `86400044`. Si dice que no encuentra `pista-clics.wav`, o en Descargas quedó con otro nombre (por ejemplo `pista-clics (1).wav`, porque ya había una), bórrala de Descargas, bájala otra vez (paso 3) y repite este paso.

- [ ] **Paso 5 (persona responsable): comprobar la suma de la pista**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
(Get-FileHash -Algorithm SHA256 '.\pista-clics.wav').Hash
```

Qué hace: calcula la huella SHA-256 de la pista para comprobar que es la que dejó Claude.
Esperado, exactamente: `C0400C42F8AFE0F9014001934B32839B8ED94503461FCF0BF0C3062774C89468`. Si sale otra, bórrala con `Remove-Item '.\pista-clics.wav'` y vuelve al paso 3.

- [ ] **Paso 6 (persona responsable): conectar el teléfono y comprobar la versión del banco**

📍 Conecta el teléfono al portátil con el cable USB de datos (si pregunta el modo USB, «Transferencia de archivos»). Después, en PowerShell:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb devices
adb shell dumpsys package dev.banco.prueba | Select-String -Pattern 'versionName'
```

Qué hace: `adb devices` comprueba que adb ve el teléfono (no guardes ni pegues su salida: lleva el número de serie); la última línea pregunta al teléfono qué versión del banco tiene instalada.
Esperado: una línea `<número de serie>  device` y otra `versionName=<commit>`, con el commit que te dio Claude. Si sale `unauthorized`, acepta el aviso del teléfono y repite. Si la versión es otra o no sale ninguna, para y avisa a Claude.

- [ ] **Paso 7 (persona responsable): poner el teléfono en modo avión**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell cmd connectivity airplane-mode enable
adb shell cmd connectivity airplane-mode
```

Qué hace: activa el modo avión desde el portátil (el cable sigue funcionando: así no entran llamadas ni mensajes que suenen durante la grabación) y lo comprueba.
Esperado: la última orden responde `enabled`. Si responde `disabled` o un error, actívalo a mano en los ajustes rápidos del teléfono.

- [ ] **Paso 8 (persona responsable): activar «No molestar» en el teléfono**

📍 En el teléfono. Desliza desde arriba para abrir los ajustes rápidos y activa «No molestar».
Esperado: el icono de la luna en la barra de estado. Así ninguna notificación suena mientras graba.

- [ ] **Paso 9 (persona responsable): vaciar el registro del sistema del teléfono**

⚠️ `adb logcat -c` borra el registro de mensajes del sistema del teléfono (no toca los datos del teléfono ni los del banco; el registro se vuelve a llenar solo). Sirve para que en el paso 24 solo aparezcan los mensajes de esta grabación.

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb logcat -c
```

Qué hace: vacía el registro del sistema del teléfono.
Esperado: ninguna salida.

- [ ] **Paso 10 (persona responsable): listar los codificadores AAC**

📍 En el teléfono. Abre el banco (si no está abierto, desde su icono «Banco»), toca «P3 y P4: grabación y servicio» y después «Codificadores AAC».
Esperado: un bloque de texto con `"codificadores"` y uno o más codificadores con su `"nombre"`, normalmente entre ellos `"c2.android.aac.encoder"`; al final, `"para_16k_mono_lc"` con un nombre. No hace falta copiarlo: queda guardado en el teléfono. Si sale `Error: …`, haz una foto de la pantalla y avisa a Claude.

- [ ] **Paso 11 (persona responsable): dejar la sala sin conversaciones**

📍 En la sala. Que nadie hable durante los próximos 45 min y que no haya radio, televisión ni música: el banco solo debe oír los clics (protección de datos del proyecto, DAT-01). Un ruido suelto y corto (un coche, una puerta) no estropea la prueba: el análisis lo cuenta aparte, como golpe, y Claude te preguntará qué sonó. Evítalos igualmente: uno que coincida con un bip sí la estropea.

- [ ] **Paso 12 (persona responsable): que el portátil no se suspenda**

📍 En el portátil. Enchúfalo a la corriente. Abre Configuración → Sistema → Inicio/apagado y suspensión (en Windows 11: Energía y batería → Pantalla y suspensión) y comprueba que, con corriente, «Suspender» está en «Nunca» o en más de 45 min.
Esperado: el portátil no se dormirá durante la prueba. Si se duerme, la pista se para y el análisis lo detecta (los clics no cubren la grabación): habría que repetir la grabación.

- [ ] **Paso 13 (persona responsable): silenciar las notificaciones del portátil**

📍 En el portátil. Las notificaciones suenan por los mismos altavoces que la pista, a medio metro del teléfono. Abre Configuración (tecla Windows + I) y:
- Windows 11: Sistema → Notificaciones → activa «No molestar».
- Windows 10: Sistema → Asistente de concentración → marca «Solo alarmas».

Cierra también las aplicaciones que puedan sonar (correo, chat, calendario). Anota cómo estaba el ajuste antes de cambiarlo: el paso 34 lo deja igual.
Esperado: «No molestar» activado (Windows 11) o «Solo alarmas» marcado (Windows 10).

- [ ] **Paso 14 (persona responsable): colocar el teléfono**

📍 En la sala. Deja el teléfono boca arriba sobre la mesa, a unos 50 cm de los altavoces del portátil, con el cable USB conectado y el banco en la pantalla «P3 y P4».

- [ ] **Paso 15 (persona responsable): poner la pista**

📍 En el portátil. Doble clic sobre `pista-clics.wav` (en `C:\Users\<tu usuario>\vigia-h0b`): se abre en el reproductor de Windows. Comprueba que la repetición está desactivada y sube el volumen hasta oír un «bip» corto y claro cada 10 s (el primero, a los 2 s). La pista dura 45 min.
Esperado: un bip cada 10 s. Si no suena nada, revisa que el portátil no esté en silencio.

- [ ] **Paso 16 (persona responsable): empezar el ensayo de 1 min**

📍 En el teléfono, en «P3 y P4». Deja «Fuente: MIC» (o la que te diga Claude si repites el ensayo) y «Fragmento: 4 s» (si no lo pone, toca el botón hasta que lo ponga), y el interruptor «Latido cada minuto (P4)» apagado. Con la pista sonando, toca «Iniciar grabación».
- Si pregunta por el micrófono, elige «Mientras se usa la app».
- Si pregunta por las notificaciones, elige «Permitir».

Esperado: un bloque de texto con `"incidente"`, `"codec": "c2.android.aac.encoder"` (si sale otro nombre, anótalo) y `"arranque"` con `"primera_unidad_ms"`; en la barra de notificaciones, «Banco de pruebas: Prueba en curso». Si sale `Error: …`, haz una foto de la pantalla y avisa a Claude: no sigas.

- [ ] **Paso 17 (persona responsable): detener el ensayo**

📍 En el teléfono, cuando haya pasado 1 min (con la pantalla encendida vale). Toca «Detener».
Esperado: un bloque de texto con `"motivo": "detener"`, `"error": null`, `"cierre": true`, `"eos": true` y `"fragmentos"` entre 14 y 17. Si `"error"` no es `null` o falta alguna de esas líneas, haz una foto de la pantalla y avisa a Claude: no sigas.

- [ ] **Paso 18 (persona responsable): parar la pista**

📍 En el portátil. Detén el reproductor (no lo cierres: en el paso 22 la volverás a poner desde el principio).

- [ ] **Paso 19 (persona responsable): traer el ensayo al portátil**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
New-Item -ItemType Directory -Force '.\sesion-2-ensayo' | Out-Null
adb pull /sdcard/Android/data/dev.banco.prueba/files/ .\sesion-2-ensayo\
```

Qué hace: la cuarta línea vuelve a crear `sesion-2-ensayo` si se borró para repetir el ensayo (si existe, no hace nada; sin ella, adb dejaría los archivos sin la carpeta `files`); la quinta copia al portátil la carpeta de resultados del banco, con el ensayo. El audio va cifrado: en el teléfono nunca está en claro.
Esperado: una línea que acaba en `files pulled, 0 skipped.` (unos 30 archivos, con los de la sesión 1). Si sale `Permission denied`, `0 files pulled` o `failed to stat remote object`, para y avisa a Claude: MIUI no deja sacar esa carpeta y hace falta otra versión del banco que la copie a Descargas.

- [ ] **Paso 20 (persona responsable): subir el ensayo**

📍 En el navegador, en code-server. Arrastra la carpeta `sesion-2-ensayo` desde el Explorador de Windows (`C:\Users\<tu usuario>\vigia-h0b\sesion-2-ensayo`) hasta la carpeta `telefono` de la carpeta de intercambio que te dio Claude. No abras sus archivos en el editor. Cuando termine, avisa a Claude y espera su respuesta.
Esperado: en el explorador de code-server, dentro de `telefono`, la carpeta `sesion-2-ensayo` con `files`, y dentro `resultados.jsonl` y la carpeta `p3` (con una carpeta de 22 caracteres por grabación). Si `files` no está dentro de `sesion-2-ensayo`, se subió otra carpeta: avisa a Claude.

- [ ] **Paso 21 (Claude): revisar el ensayo**

Lo subido es del teléfono: antes de nada se comprueba que no trae enlaces ni archivos especiales y se deja legible para el contenedor (que corre con el usuario 1001); `<intercambio>` sigue con 700, que frena a los usuarios sin privilegios de la máquina (no a root; decisión de integración 21). Después, la lista de grabaciones y el análisis de P3 con `DURACION_MIN=50`, porque el ensayo dura 1 min.

📍 Máquina de trabajo; cada `docker run` es un contenedor efímero sin red.

Ejecutar:

```sh
test "$(find <intercambio>/telefono/sesion-2-ensayo ! -type f ! -type d | wc -l)" -eq 0 && chmod -R a+rX <intercambio>/telefono/sesion-2-ensayo && echo "bien: solo archivos y carpetas, legibles para el contenedor"
docker exec vigia-build sincronizar banco
docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-2-ensayo:/sesion:ro vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh < /dev/null
```

Esperado: `bien: solo archivos y carpetas, legibles para el contenedor` y una lista con una grabación de unos 60 `"segundos"`, `"motivo": "detener"` y `"latidos": false`. Si no sale la línea `bien: …`, lo subido trae enlaces u otros archivos especiales: parar, no se analiza nada de esa carpeta.

Ejecutar, con `<incidente>` el de la lista (el contenedor que recibe la privada no guarda registro ni usa memoria de intercambio):

```sh
docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-2-ensayo:/sesion:ro -e DURACION_MIN=50 vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh <incidente> p3 < <privada>/escucha/privada.b64u > <intercambio>/resultados/sesion-2-ensayo.json; echo "salida: $?"
python3 -I -c 'import json, sys; r = json.load(sys.stdin); print(r["modo"], r["veredicto"], " ".join(f"{k}={v["veredicto"]}" for k, v in r["criterios"].items())); c = r["criterios"]; print(c["formato"].get("kbps"), "kb/s |", c["clics"].get("detectados"), "clics | otros sonidos", c["clics"].get("otros_sonidos"), "| golpes", c["clics"].get("golpes"), "| arranque de la grabación", c["arranques"].get("grabacion_ms"), "ms |", c["carpeta"]["problemas"])' < <intercambio>/resultados/sesion-2-ensayo.json
```

Esperado: `salida: 1`, porque los 20 arranques aún no se han hecho, y `p3 falla carpeta=pasa verificacion=pasa muestras_frente_al_tiempo=pasa formato=pasa clics=pasa arranques=sin_datos`, con unos 30 kb/s, 6 clics, `otros sonidos 0`, `golpes 0`, un arranque de la grabación por debajo de 2 000 ms y `[]`. Qué hacer si no:
- `otros sonidos` o `golpes` mayores que 0: mira «Si una grabación tiene indicios de voces» (tras el paso 37) antes de seguir.
- `carpeta=falla`: el teléfono escribe algo distinto de lo que espera el análisis (lo dicen los `problemas`). Si el fallo es del análisis, se corrige `analisis.py` (con su prueba) y se vuelve a analizar el mismo ensayo; si es del grabador, hace falta una build nueva: se para la sesión.
- `clics=sin_datos` o menos de 5 clics: el teléfono no oye bien la pista. La persona responsable sube el volumen o acerca el teléfono y repite desde el paso 15 (el ensayo nuevo se trae a `sesion-2-ensayo` otra vez; antes se borran la carpeta subida y la del portátil). Si con más volumen los clics siguen sin llegar, el ensayo se repite con la fuente `VOICE_RECOGNITION` (en el paso 16, toca el botón de la fuente hasta que la ponga), que no aplica la supresión de ruido.
- `formato=falla`: mirar `codec`, `hz` y `kbps` en el JSON. Es un resultado de P3 y la sesión se para: el plan B (otra tasa u otro codificador) necesita antes de repetir la sesión 2 una tarea nueva con sus pruebas (la tasa como parámetro de `iniciar`, de `Grabador` y de la pantalla, `CortadorAdts(segundos × hz, hz)` y `analisis.py` con la tasa), como la decisión de integración 6, y se decide con la persona responsable.
- `verificacion=falla`: es un fallo del banco, no un resultado: parar y revisar el JSON entero; se arregla y se repite el ensayo.
- `arranques=falla`: el arranque de esta grabación pasó de 2 000 ms. Es un resultado de P3: se anota con su cifra y se sigue; se decide con la persona responsable junto con el análisis del paso 36.

Claude le dice a la persona responsable que siga o qué cambiar, y con qué fuente quedó el último ensayo bueno (MIC o VOICE_RECOGNITION).

- [ ] **Paso 22 (persona responsable): volver a poner la pista desde el principio**

📍 En el portátil. Pon la pista desde el principio (si el reproductor la tiene a medias, llévala al inicio o ciérralo y vuelve a abrir `pista-clics.wav`).
Esperado: el primer bip a los 2 s. Desde aquí, en la sala no habla nadie.

- [ ] **Paso 23 (persona responsable): iniciar la grabación de 30 min**

📍 En el teléfono, en «P3 y P4», durante el primer minuto de la pista. Pon la fuente del último ensayo bueno (MIC o VOICE_RECOGNITION, la que te confirmó Claude en el paso 21), «Fragmento: 4 s» y el interruptor «Latido cada minuto (P4)» apagado, y toca «Iniciar grabación».
Esperado: el bloque con `"incidente"`, la `"fuente"` que pusiste y `"arranque"`, como en el ensayo. Mira la hora: la grabación tiene que durar al menos 30 min. Si sale `Error: …`, foto y avisa a Claude.

- [ ] **Paso 24 (persona responsable): comprobar dos avisos del sistema**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell "logcat -d | grep -E 'microphone access|Requested bitrate'"
```

Qué hace: busca en el registro del teléfono (en el propio teléfono, sin traerlo) dos avisos: que el servicio no tenga micrófono por haber empezado en segundo plano, y que el códec no acepte los 32 kbps. Las comillas simples van dentro de las dobles a propósito: PowerShell 5.1 no pasa bien a adb unas comillas dobles metidas dentro de unas simples.
Esperado: ninguna salida. Si sale alguna línea, cópiala en el chat para Claude (son mensajes del sistema sobre el banco) y sigue.

- [ ] **Paso 25 (persona responsable): apagar la pantalla y esperar 30 min**

📍 En el teléfono. Pulsa una vez el botón de encendido para apagar la pantalla. Pon un temporizador de 30 min en otro aparato (no en este teléfono) y no toques ni el teléfono ni el portátil hasta que suene. Que nadie hable en la sala.
Esperado: la pantalla del teléfono apagada y un bip cada 10 s en el portátil durante los 30 min.

- [ ] **Paso 26 (persona responsable): detener la grabación**

📍 En el teléfono, cuando suene el temporizador. Enciende la pantalla, desbloquéalo y, en el banco, toca «Detener» (si no ves la pantalla «P3 y P4», ábrela desde el menú: la grabación sigue y la encuentra).
Esperado: `"motivo": "detener"`, `"error": null`, `"cierre": true`, `"eos": true` y unos 450 `"fragmentos"` (uno cada 4 s). Si responde `no hay ninguna grabación`, el sistema cerró el banco durante la prueba: anótalo y sigue (es un resultado de P3 y P4). Si sale otro `"error"`, foto de la pantalla y sigue: Claude lo verá en el análisis.

- [ ] **Paso 27 (persona responsable): parar la pista**

📍 En el portátil. Detén el reproductor.

- [ ] **Paso 28 (persona responsable): que la pantalla no se apague durante los arranques**

Los 20 arranques corren en la app, sin el servicio: con la pantalla apagada Android puede frenarla o congelarla y los tiempos dejarían de valer. Esto cambia un ajuste del teléfono (no borra nada): el paso 30 lo deja como estaba.

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell svc power stayon usb
adb shell settings get global stay_on_while_plugged_in
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta deja la pantalla encendida mientras el teléfono esté conectado por USB; la quinta lee ese ajuste.
Esperado: ninguna salida de la cuarta y `2` de la quinta. Si sale otra cosa, activa a mano «Mantener activo» en Ajustes → Ajustes adicionales → Opciones de desarrollador.

- [ ] **Paso 29 (persona responsable): los 20 arranques**

📍 En el teléfono, en «P3 y P4» (si la pantalla se apagó antes del paso 28, enciéndela y desbloquéalo). Toca «20 arranques» y espera unos 40 s sin tocar nada.
Esperado: un bloque con `"n": 20`, la lista de los 20 y, al final, `"primero_ms"`, `"mediana_ms"` y `"max_ms"`. Si `"max_ms"` pasa de 2000, anótalo: es un resultado. Si sale `Error: …`, foto y avisa a Claude.

- [ ] **Paso 30 (persona responsable): devolver el ajuste de la pantalla**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell svc power stayon false
adb shell settings get global stay_on_while_plugged_in
```

Qué hace: deshace el paso 28; la última línea lo comprueba.
Esperado: `0`. Si activaste «Mantener activo» a mano en el paso 28, desactívalo igual a mano.

- [ ] **Paso 31 (persona responsable): traer la sesión al portátil**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
New-Item -ItemType Directory -Force '.\sesion-2' | Out-Null
adb pull /sdcard/Android/data/dev.banco.prueba/files/ .\sesion-2\
```

Qué hace: la cuarta línea crea `sesion-2` si no está (como en el paso 19); la quinta copia al portátil la carpeta de resultados del banco: el ensayo, la grabación de 30 min (cifrada) y los resultados de los arranques.
Esperado: una línea que acaba en `files pulled, 0 skipped.` (unos 500 archivos). Si sale un error, para y avisa a Claude.

- [ ] **Paso 32 (persona responsable): quitar el modo avión**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell cmd connectivity airplane-mode disable
adb shell cmd connectivity airplane-mode
adb kill-server
```

Qué hace: desactiva el modo avión, lo comprueba y para el servicio de adb del portátil (escuchaba en 127.0.0.1:5037, solo para el propio portátil; el próximo bloque con adb lo vuelve a arrancar solo).
Esperado: `disabled`.

- [ ] **Paso 33 (persona responsable): quitar «No molestar» del teléfono**

📍 En el teléfono, en los ajustes rápidos: desactiva «No molestar».
Esperado: ya no sale el icono de la luna.

- [ ] **Paso 34 (persona responsable): devolver las notificaciones del portátil**

📍 En el portátil, en Configuración (tecla Windows + I): deja el ajuste del paso 13 como lo anotaste (Windows 11: Sistema → Notificaciones → «No molestar»; Windows 10: Sistema → Asistente de concentración).
Esperado: el ajuste como estaba antes de la sesión.

- [ ] **Paso 35 (persona responsable): subir la sesión**

📍 En el navegador, en code-server. Arrastra la carpeta `sesion-2` desde el Explorador de Windows (`C:\Users\<tu usuario>\vigia-h0b\sesion-2`) hasta la carpeta `telefono` de la carpeta de intercambio. No abras sus archivos en el editor. Cuando termine, avisa a Claude.
Esperado: en el explorador de code-server, dentro de `telefono`, la carpeta `sesion-2` con `files`, y dentro `resultados.jsonl` y la carpeta `p3` (con el ensayo y la grabación de 30 min). Si `files` no está dentro de `sesion-2`, se subió otra carpeta: avisa a Claude.

- [ ] **Paso 36 (Claude): analizar P3**

📍 Máquina de trabajo; cada `docker run` es un contenedor efímero sin red.

Ejecutar:

```sh
test "$(find <intercambio>/telefono/sesion-2 ! -type f ! -type d | wc -l)" -eq 0 && chmod -R a+rX <intercambio>/telefono/sesion-2 && echo "bien: solo archivos y carpetas, legibles para el contenedor"
docker exec vigia-build sincronizar banco
docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-2:/sesion:ro vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh < /dev/null
```

Esperado: `bien: solo archivos y carpetas, legibles para el contenedor` (si no sale, parar como en el paso 21) y una lista con dos grabaciones por hora de inicio (o más, si se repitió el ensayo): el ensayo (unos 60 `"segundos"`) y la de 30 min (1 800 o más, `"motivo": "detener"`, unos 450 `"fragmentos"`). Si la de 30 min tiene `"motivo": "sin_resumen"`, el sistema cerró el banco: se analiza igual y el resultado lo dirá.

Ejecutar, con `<incidente>` el de la grabación de 30 min:

```sh
docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-2:/sesion:ro vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh <incidente> p3 < <privada>/escucha/privada.b64u > <intercambio>/resultados/sesion-2-p3.json; echo "salida: $?"
python3 -I -c 'import json, sys; r = json.load(sys.stdin); print(r["modo"], r["veredicto"], " ".join(f"{k}={v["veredicto"]}" for k, v in r["criterios"].items())); c = r["criterios"]; print(json.dumps({"codec": r["eventos"]["codec"], "respaldo": r["eventos"]["respaldo"], "csd": r["eventos"]["csd"], "fuente": (r["resumen"] or {}).get("fuente"), "formato": c["formato"], "muestras": c["muestras_frente_al_tiempo"], "clics": c["clics"], "arranques": c["arranques"], "verificacion": c["verificacion"]["resumen"], "silenciado": r["eventos"]["silenciado"], "errores": r["eventos"]["errores"]}, ensure_ascii=False, indent=1))' < <intercambio>/resultados/sesion-2-p3.json
```

Esperado si P3 se cumple: `salida: 0` y `p3 pasa carpeta=pasa verificacion=pasa muestras_frente_al_tiempo=pasa formato=pasa clics=pasa arranques=pasa`, y en el detalle: `"codec": "c2.android.aac.encoder"`, `"respaldo": false`, `"csd": "1408"`, la `"fuente"` del último ensayo bueno; formato `aac`, `LC`, 16 000 Hz, 1 canal y de 28,8 a 35,2 kb/s; muestras frente al tiempo con `"duracion_s"` de 1 800 o más, `"max_desfase_s"` por debajo de 1 y `"saltos": 0`; clics con unos 180 `"detectados"` igual a `"esperados"`, `"faltan": []`, `"repetidos": 0`, `"desplazados": 0`, `"max_error_intervalo_ms"` y `"max_error_ms"` de 20 o menos, `"deriva_ppm"` (la diferencia de reloj entre el portátil y el teléfono) por debajo de 1 000 en valor absoluto, `"otros_sonidos": 0` y `"golpes": 0`; arranques con `"n": 20`, `"max_ms"` y `"grabacion_ms"` (el arranque de esta grabación, desde el toque) por debajo de 2 000; el resumen de la verificación empieza por `✓` y dice `cadena íntegra`; sin `silenciado` ni `errores`.

Ejecutar, para guardar la lista de codificadores del teléfono (la última línea `p3-codificadores`, del paso 10). Corre en la máquina de trabajo con la biblioteca estándar, como el paso A2 de la tarea 13: solo lee JSON.

```sh
python3 -I - <intercambio>/telefono/sesion-2/files/resultados.jsonl <<'EOF' > <intercambio>/resultados/sesion-2-codificadores.json; echo "salida: $?"
import json, sys
ultima = None
for linea in open(sys.argv[1], encoding="utf-8"):
    try:
        obj = json.loads(linea)
    except ValueError:
        continue
    if isinstance(obj, dict) and obj.get("prueba") == "p3-codificadores":
        ultima = linea.strip()
if ultima is None:
    sys.exit("✗ no hay ninguna línea p3-codificadores (paso 10)")
print(ultima)
EOF
python3 -I - <intercambio>/resultados/sesion-2-codificadores.json <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))["datos"]
print("para 16 kHz mono LC:", d["para_16k_mono_lc"])
for c in d["codificadores"]:
    print(c["nombre"], "| frecuencias:", c["frecuencias"], "| bits por segundo:", c["bits_por_segundo"])
EOF
```

Esperado: `salida: 0`, `para 16 kHz mono LC: c2.android.aac.encoder` (u otro nombre, que va al informe) y una línea por codificador AAC del teléfono con sus frecuencias y su intervalo de bits por segundo. Es la cifra que dice qué tasas acepta cada codificador si hiciera falta el plan B.

Qué hacer con lo que sale:
- `otros_sonidos` o `golpes` mayores que 0: mira «Si una grabación tiene indicios de voces», abajo, antes de nada más.
- `clics=falla` con `faltan`, `desplazados` o un `hueco_final_s` grande: los clics dejaron de llegar o se movieron. Si `silenciado` trae `true`, el sistema silenció el micrófono: es un resultado de P3. Si no, antes de anotarlo Claude pregunta a la persona responsable si el portátil se durmió o el reproductor se paró; sin esa comprobación el fallo no se atribuye al teléfono. Si fue eso, se repite la grabación: Claude borra antes `<intercambio>/telefono/sesion-2` (la subida nueva la trae entera) y se repiten los pasos 7 a 14 y del 22 al final, sin el ensayo.
- `formato=falla` (tasa, perfil, canales o kb/s): es un resultado de P3. El plan B (otra tasa u otro codificador, con las frecuencias de `sesion-2-codificadores.json`) necesita antes de repetir la sesión 2 una tarea nueva con sus pruebas: la tasa como parámetro de `iniciar`, de `Grabador` y de la pantalla, `CortadorAdts(segundos × hz, hz)`, y `analisis.py` y el teléfono simulado con la tasa, como la decisión de integración 6.
- `muestras_frente_al_tiempo=falla`, `clics=falla` de verdad o `arranques=falla` (los 20 o el de la grabación, `grabacion_ms`, de más de 2 000 ms): se declaran con sus cifras (`saltos` o `faltan` dicen dónde se perdió audio, `max_retraso_lector_s` cuánto se retrasó el lector) y se decide con la persona responsable.
- `carpeta=falla` o `verificacion=falla`: son fallos del banco, no resultados: se arreglan (con su prueba) y se repite la grabación.

- [ ] **Paso 37 (persona responsable): borrar las copias del portátil**

⚠️ Borra del portátil las carpetas `sesion-2-ensayo` y `sesion-2` (solo hay audio cifrado y resultados, que ya están en el servidor). Hazlo después de que Claude confirme el paso 36: con las grabaciones fuera del portátil, solo quedan en el teléfono y en `<intercambio>` (DAT-01).

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Remove-Item -Recurse -Force '.\sesion-2-ensayo', '.\sesion-2'
Get-ChildItem -Directory -Name
```

Qué hace: borra las dos carpetas y lista lo que queda.
Esperado: ya no aparecen `sesion-2-ensayo` ni `sesion-2`. `pista-clics.wav` se queda: la usa la sesión 3.

**Si una grabación tiene indicios de voces (DAT-01)**

Lo deciden los pasos 21 y 36: con `otros_sonidos` (sonidos de más de 200 ms, como una voz, música o la televisión) o `golpes` (sonidos cortos) mayores que 0, Claude pregunta a la persona responsable qué sonó en la sala. Si alguien habló o sonó una radio, una televisión o música, o si con `otros_sonidos` mayor que 0 no sabe qué fue, hay indicios de voces: esa grabación no se analiza más, se borra del teléfono, del portátil y de `<intercambio>`, y se repite. Si fue un ruido sin voces (una puerta, un coche), se anota (DAT-01) y se sigue. Claude pasa por el chat `<incidente>` (el de la grabación), `<carpeta>` (`sesion-2-ensayo` si es el ensayo, `sesion-2` si es la de 30 min) y `<json>` (su análisis: `sesion-2-ensayo.json` o `sesion-2-p3.json`).

- [ ] **Borrado 1 (Claude): en `<intercambio>`**

⚠️ Borra la carpeta subida de esa parte de la sesión (al repetir se vuelve a subir, ya sin esa grabación) y el análisis de la grabación.

📍 Máquina de trabajo.

```sh
rm -r <intercambio>/telefono/<carpeta>
rm -f <intercambio>/resultados/<json>
ls <intercambio>/telefono <intercambio>/resultados
```

Esperado: en la lista ya no están `<carpeta>` ni `<json>`.

- [ ] **Borrado 2 (persona responsable): en el teléfono**

⚠️ Borra del teléfono esa grabación (solo la carpeta de ese incidente).

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell rm -r /sdcard/Android/data/dev.banco.prueba/files/p3/<incidente>
adb shell ls /sdcard/Android/data/dev.banco.prueba/files/p3/
```

Qué hace: la cuarta línea borra la carpeta de la grabación (`<incidente>`, el que te dio Claude); la quinta lista las grabaciones que quedan.
Esperado: ninguna salida de la cuarta y, en la lista, ya no sale `<incidente>`. Si la cuarta dice `No such file or directory`, revisa el `<incidente>` con Claude. Si dice `Permission denied` (MIUI no deja borrar dentro de `Android/data`), sigue con el bloque de abajo.

⚠️ Solo si la orden anterior dio `Permission denied`, y solo cuando Claude te confirme que todo lo demás de la sesión ya está en el portátil y subido: `pm clear` borra todos los datos del banco en el teléfono, también los resultados de la sesión 1 y lo que quede de esta (ya están sacados), y deja el banco como recién instalado.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell pm clear dev.banco.prueba
```

Qué hace: borra los datos del banco en el teléfono, con su carpeta de resultados.
Esperado: `Success`. Al repetir, el banco puede volver a pedir el micrófono y las notificaciones: acepta como en el ensayo.

- [ ] **Borrado 3 (persona responsable): en el portátil**

⚠️ Borra la copia de esa grabación del portátil.

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Remove-Item -Recurse -Force '.\<carpeta>\files\p3\<incidente>'
Get-ChildItem '.\<carpeta>\files\p3' -Name
```

Qué hace: borra la carpeta de la grabación en la copia del portátil y lista las que quedan.
Esperado: ya no sale `<incidente>`.

- [ ] **Borrado 4 (persona responsable): repetir la grabación**

📍 Los pasos de esta sesión, otra vez. Si era el ensayo, repite desde el paso 15. Si era la de 30 min, repite los pasos 7 a 14 y después del 22 al final (el ensayo no hace falta: salió bien). Si usaste `pm clear`, repite también el paso 10. Claude anota que una grabación se repitió por indicios de voces y se borró, sin describir el audio.

**Comprobación final (Claude)**

📍 Máquina de trabajo.

```sh
ls -l <intercambio>/resultados/sesion-2-ensayo.json <intercambio>/resultados/sesion-2-p3.json <intercambio>/resultados/sesion-2-codificadores.json
python3 -I -c 'import json, sys; r = json.load(sys.stdin); print(r["veredicto"], {k: v["veredicto"] for k, v in r["criterios"].items()})' < <intercambio>/resultados/sesion-2-p3.json
```

Esperado: los tres archivos y la línea de veredictos del paso 36. Para el informe (tarea 16) se anotan: el modelo y la versión del codificador elegido y las frecuencias que acepta (`sesion-2-codificadores.json`), la fuente usada (MIC o VOICE_RECOGNITION), el AudioSpecificConfig, los kb/s, el desfase máximo y la deriva, el error máximo de los clics y su deriva entre relojes, el arranque más lento de los 20 y el de cada grabación (`grabacion_ms` del ensayo y de la de 30 min), `otros_sonidos` y `golpes`, y que el audio subido fue la pista de clics en una sala sin conversaciones (DAT-01; si una grabación se repitió por voces, también). Nada de horas, rutas ni números de serie.

**Notas:**

- **Nota:** el ensayo de 1 min se analiza antes de grabar 30 min: comprueba en un minuto que el teléfono escribe la carpeta que espera el análisis, que oye los clics y que el formato es el esperado. Sus clics no cuentan para P3; su arranque, sí (`grabacion_ms`).
- **Nota:** la pista dura 45 min: la grabación de 30 min empieza en el primer minuto de la pista y acaba mucho antes que ella aunque los pasos 24 a 26 se alarguen. Con una pista más corta que la grabación, `clics` fallaría sin que faltara audio.
- **Nota:** el registro del sistema se mira justo después de iniciar (paso 24) porque en 30 min el búfer de logcat del teléfono puede haber descartado los mensajes del arranque.
- **Nota:** si `adb pull` de `Android/data` no funciona en el teléfono (paso 19), el plan B del contrato por logcat no sirve para los sobres, que son binarios: hace falta una función del banco que copie la grabación a `Download/` y una build nueva antes de seguir.
- **Nota:** P3 se mide con la fuente `MIC`. Si los clics llegan muy atenuados (la supresión de ruido de algunos teléfonos), el ensayo se repite con `VOICE_RECOGNITION`, que no la aplica, y la grabación de 30 min y las de P4 usan la fuente del último ensayo bueno; la fuente usada va al informe.

---

### Tarea 15: Sesión 3 con el teléfono: P4 sin subida (MIUI por defecto y sin restricciones) y P6 en los navegadores del teléfono

**Archivos:** ninguno del repo ni del banco. Fuera de los dos:
- P4: lo que sube la persona responsable, `<intercambio>/telefono/sesion-3/p4/` (la carpeta del banco y `exit-info-a.txt` y `exit-info-b.txt`), y los análisis `<intercambio>/resultados/sesion-3-p4-a.json`, `sesion-3-p4-b.json`, `sesion-3-p4-a-audio.json` y `sesion-3-p4-b-audio.json`.
- P6: la entrega `<intercambio>/entrega/sesion-3/p6/` (la página, la muestra, `servidor.ps1` y `sumas-p6.sha256`), lo que sube la persona responsable, `<intercambio>/telefono/sesion-3/p6/`, y el análisis `<intercambio>/resultados/sesion-3-p6.md`.

**Interfaces:**
- Consume: el banco instalado en la sesión 1 (tarea 13), con la pantalla «P3 y P4» (tarea 6); la pista de clics que la persona responsable ya tiene en el portátil y la fuente del último ensayo bueno (tarea 14); `p3/maquina/analizar.sh` (tarea 7); `p6/primitivas.html`, `p6/primitivas.js`, `p6/servidor.ps1` y `p6/analizar.py` del banco y `/work/h0b/p6/muestra.aac` (tarea 10); la ficha del aparato (tarea 13, `sesion-1-info.txt`); la privada de escucha, `<privada>/escucha/privada.b64u` (tarea 3).
- Produce:
  - P4 sin subida en las dos configuraciones de batería de MIUI. Por cada una: si el servicio sigue vivo 30 min con la pantalla apagada y Doze forzado (un latido por minuto, `latidos`), si al detener se cierra entero (`cierre`), si el audio sigue entrando en Doze (`muestras_frente_al_tiempo` y, con la pista, `clics`) por qué terminó el proceso si el sistema lo mató (`exit-info`), el arranque de cada grabación y los otros sonidos y golpes de la sala (lo que respalda "sin voces"). La batería no se mide en el tramo A (el cable USB carga el teléfono): va al tramo B.
  - P6 medido en Chrome, Samsung Internet (en su versión de Google Play del día), el navegador interno de Telegram (o "sin medir" si no se cambió su ajuste) y Mi Browser si está, con las versiones de cada uno y la del WebView, y qué navegadores tienen hoy X25519 en WebCrypto, con su motor.
  - Las dos cosas las usa la tarea 16 para el informe, y P4 también para la guía por fabricante de H3a.

Resumen para la persona responsable: la sesión 3 tiene dos partes independientes que puedes hacer en el orden que prefieras, el mismo día o en dos días distintos, y un cierre al acabar las dos que desinstala el banco y apaga los ajustes de desarrollador del teléfono:
- **Parte 1, P4** (48 pasos, algo más de 1 h 30 min, casi todo esperar): dos grabaciones de 30 min con la pantalla apagada y el teléfono forzado a Doze, la primera con la batería de MIUI como viene y la segunda con el banco «Sin restricciones». Necesitas el portátil enchufado a la corriente con `pista-clics.wav`, el teléfono con su cable USB de datos conectado todo el rato y una sala sin conversaciones durante 1 h 15 min.
- **Parte 2, P6** (37 pasos cortos, del 2 al 38, de 35 a 45 min): abrir la página de primitivas en cada navegador del teléfono. Necesitas internet en el teléfono (para Google Play y Telegram) y Telegram con la sesión iniciada, y haber aceptado lo que sale del teléfono durante P6 (lo detalla la parte 2).

Las dos usan code-server abierto en el navegador. Cada parte numera sus pasos desde 1, y los títulos llevan la parte («P4, paso 19» o «P6, paso 19»): cuando un paso dice «el paso 19», es siempre el de su misma parte.

#### Parte 1: P4 sin subida, con MIUI por defecto y sin restricciones

- [ ] **P4, paso 1 (Claude): preparar la carpeta de subida**

📍 Máquina de trabajo.

Ejecutar:

```sh
umask 077 && mkdir -p <intercambio>/telefono/sesion-3 && stat -c '%a %n' <intercambio>/telefono/sesion-3
```

Esperado: `700 <intercambio>/telefono/sesion-3` (si P6 ya se hizo, la carpeta existía y no cambia). Claude pasa a la persona responsable por el chat la ruta real de `<intercambio>/telefono/sesion-3` y la fuente del último ensayo bueno de la sesión 2 (MIC o VOICE_RECOGNITION).

- [ ] **P4, paso 2 (persona responsable): preparar PowerShell y la carpeta de la sesión**

📍 PowerShell en tu portátil Windows (usuario normal, sin administrador).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
New-Item -ItemType Directory -Force '.\sesion-3\p4' | Out-Null
Get-ChildItem -Name; Get-ChildItem '.\sesion-3' -Name
```

Qué hace: las tres primeras líneas preparan la ventana, como en las sesiones anteriores; la cuarta crea `vigia-h0b\sesion-3\p4`, donde traerás lo de P4; la quinta lista lo que hay en `vigia-h0b` y en `sesion-3`.
Esperado: entre otros, `platform-tools`, `sesion-3` y `pista-clics.wav` y, dentro de `sesion-3`, `p4` (y `p6` si P6 ya se hizo). Si falta `pista-clics.wav`, bájala, llévala a `vigia-h0b` y compruébala como en los pasos 3 a 5 de la sesión 2 (tarea 14).

- [ ] **P4, paso 3 (persona responsable): conectar el teléfono y comprobar la versión del banco**

📍 Conecta el teléfono al portátil con el cable USB de datos. En PowerShell:

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb devices
adb shell dumpsys package dev.banco.prueba | Select-String -Pattern 'versionName'
```

Qué hace: comprueba que adb ve el teléfono (no guardes ni pegues la salida de `adb devices`: lleva el número de serie) y qué versión del banco tiene.
Esperado: `<número de serie>  device` y `versionName=<commit>`, el mismo de la sesión 2. Si es otro, para y avisa a Claude.

- [ ] **P4, paso 4 (persona responsable): poner el teléfono en modo avión**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell cmd connectivity airplane-mode enable
adb shell cmd connectivity airplane-mode
```

Qué hace: activa el modo avión (el cable sigue funcionando) y lo comprueba. En el tramo A, P4 no sube nada: la red no hace falta, y así nada suena ni despierta al teléfono.
Esperado: `enabled`.

- [ ] **P4, paso 5 (persona responsable): activar «No molestar» en el teléfono**

📍 En el teléfono. Desliza desde arriba para abrir los ajustes rápidos y activa «No molestar».
Esperado: el icono de la luna en la barra de estado.

- [ ] **P4, paso 6 (persona responsable): ver cómo trata MIUI la batería del banco (A: como viene)**

📍 En el teléfono. Abre Ajustes → Aplicaciones → Administrar aplicaciones → «Banco» (en HyperOS, Ajustes → Aplicaciones → «Banco»). Mira «Ahorro de batería» (o «Ahorro de energía») e «Inicio automático». No cambies nada: la grabación A mide el teléfono como lo tendría una persona que no toca esos ajustes.
Esperado: anota las dos opciones tal como salen (por ejemplo, «Ahorro de batería: Ahorro de batería» e «Inicio automático: desactivado»). Si ya estaban cambiadas de antes, devuélvelas a la opción que MIUI marca como recomendada y anótalo.

- [ ] **P4, paso 7 (persona responsable): comprobar que el banco no está exento de Doze**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'dumpsys deviceidle whitelist | grep -c dev.banco.prueba'
```

Qué hace: cuenta cuántas veces sale el banco en la lista de apps que Android deja sin Doze (solo se imprime el número).
Esperado: `0`. Si sale `1`, el banco ya está exento de Doze: anótalo y sigue. El teléfono entrará igual en Doze (los latidos lo dirán), pero con el banco exento, y el informe tiene que decirlo.

- [ ] **P4, paso 8 (persona responsable): dejar la sala sin conversaciones**

📍 En la sala. Que nadie hable durante 1 h 15 min y que no haya radio, televisión ni música: el banco graba todo ese tiempo (DAT-01). Un ruido suelto y corto (un coche, una puerta) no estropea la prueba: el análisis lo cuenta aparte, como golpe, y Claude te preguntará qué sonó.

- [ ] **P4, paso 9 (persona responsable): que el portátil no se suspenda**

📍 En el portátil. Enchufado a la corriente y con «Suspender» en «Nunca» o en más de 1 h 30 min (como en el paso 12 de la sesión 2, tarea 14).
Esperado: el portátil no se dormirá durante las dos grabaciones.

- [ ] **P4, paso 10 (persona responsable): silenciar las notificaciones del portátil**

📍 En el portátil. Las notificaciones suenan por los mismos altavoces que la pista. Abre Configuración (tecla Windows + I) y:
- Windows 11: Sistema → Notificaciones → activa «No molestar».
- Windows 10: Sistema → Asistente de concentración → marca «Solo alarmas».

Cierra también las aplicaciones que puedan sonar (correo, chat, calendario). Anota cómo estaba el ajuste antes de cambiarlo: el paso 42 lo deja igual.
Esperado: «No molestar» activado (Windows 11) o «Solo alarmas» marcado (Windows 10).

- [ ] **P4, paso 11 (persona responsable): colocar el teléfono**

📍 En la sala. El teléfono boca arriba sobre la mesa, a unos 50 cm de los altavoces del portátil, con el cable USB conectado y el banco en la pantalla «P3 y P4».

- [ ] **P4, paso 12 (persona responsable): poner la pista de clics (A)**

📍 En el portátil. Doble clic sobre `pista-clics.wav`; la repetición, desactivada; el volumen, el de la sesión 2.
Esperado: el primer bip a los 2 s y uno cada 10 s. La pista dura 45 min, más que la grabación: sirve para comprobar que el audio sigue entrando con Doze.

- [ ] **P4, paso 13 (persona responsable): iniciar la grabación A**

📍 En el teléfono, en el banco, pantalla «P3 y P4». Pon la fuente del último ensayo bueno de la sesión 2 (MIC o VOICE_RECOGNITION, la que te dio Claude en el paso 1) y «Fragmento: 4 s», y enciende el interruptor «Latido cada minuto (P4)»: vuelve a apagado cada vez que se abre la pantalla. En el primer minuto de la pista, toca «Iniciar grabación».
Esperado: el bloque con `"incidente"`, `"latidos": true` y `"arranque"`. Mira la hora. Si dice `"latidos": false`, toca «Detener» y empieza otra vez con el interruptor encendido. Si sale `Error: …`, foto de la pantalla y avisa a Claude.

- [ ] **P4, paso 14 (persona responsable): apagar la pantalla**

📍 En el teléfono. Pulsa una vez el botón de encendido.
Esperado: la pantalla apagada. Desde aquí no toques el teléfono hasta el paso 21.

- [ ] **P4, paso 15 (persona responsable): hacer que el teléfono crea que va con batería**

⚠️ Cambia lo que el teléfono cree de su batería: hasta el paso 20 pensará que está desenchufado (sigue cargando de verdad). Se deshace en el paso 20 con `dumpsys battery reset`; si la sesión se corta antes, ejecuta esa orden igualmente.

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys battery unplug
```

Qué hace: Doze no empieza mientras el teléfono carga; esta orden le dice que no carga.
Esperado: ninguna salida.

- [ ] **P4, paso 16 (persona responsable): forzar Doze**

⚠️ Mete el teléfono en reposo profundo hasta el paso 19 (`unforce`). Si la sesión se corta antes, ejecuta igualmente `adb shell dumpsys deviceidle unforce` y `adb shell dumpsys battery reset`.

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys deviceidle force-idle
adb shell dumpsys deviceidle get deep
```

Qué hace: la primera orden lleva el teléfono a Doze profundo aunque no haya pasado el tiempo que espera Android; la segunda pregunta en qué estado está.
Esperado: `Now forced in to deep idle mode` y `IDLE`. Qué hacer si no:
- `Unable to go deep idle; not enabled`: el fabricante tiene apagado el Doze profundo. Anótalo, sigue igualmente y avisa a Claude al final (la grabación medirá el servicio con la pantalla apagada, sin Doze).
- `Unable to go deep idle; stopped at …`: espera 10 s y repite el bloque una vez; si vuelve a salir, anótalo y sigue.

- [ ] **P4, paso 17 (persona responsable): esperar 15 min**

📍 Pon un temporizador de 15 min en otro aparato. No toques el teléfono. Que nadie hable en la sala.

- [ ] **P4, paso 18 (persona responsable): comprobar a mitad que sigue en Doze**

📍 La misma ventana de PowerShell (no enciende la pantalla del teléfono).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys deviceidle get deep
```

Qué hace: pregunta el estado de Doze sin despertar el teléfono.
Esperado: `IDLE` (o, un momento, `IDLE_MAINTENANCE`: una ventana de mantenimiento de Doze). Si sale `ACTIVE`, algo sacó al teléfono de Doze: anótalo. Después, otro temporizador de 15 min y sigue sin tocar nada.

- [ ] **P4, paso 19 (persona responsable): quitar el Doze forzado**

📍 La misma ventana de PowerShell, cuando hayan pasado los otros 15 min (30 en total desde el paso 13).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys deviceidle unforce
```

Qué hace: deja que Android vuelva a decidir solo cuándo entra y sale de Doze.
Esperado: una línea `Light state: …, deep state: …` (los estados dependen de la pantalla y de la carga: vale cualquiera).

- [ ] **P4, paso 20 (persona responsable): devolver el estado real de la batería**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys battery reset
adb shell dumpsys deviceidle get deep
```

Qué hace: el teléfono vuelve a saber que está enchufado, y con eso sale de Doze; la segunda orden lo comprueba.
Esperado: ninguna salida en la primera y `ACTIVE` en la segunda (si sale otro estado, espera 10 s y repite la segunda).

- [ ] **P4, paso 21 (persona responsable): detener la grabación A**

📍 En el teléfono. Enciende la pantalla, desbloquéalo y, en el banco, pantalla «P3 y P4», toca «Detener». Mira también el reproductor del portátil: si ya llegó al final de la pista, anótalo.
Esperado: `"motivo": "detener"`, `"error": null`, `"cierre": true`, `"eos": true` y unos 450 `"fragmentos"`. Si responde `no hay ninguna grabación`, MIUI cerró el banco durante la prueba: es el resultado que busca P4; anótalo y sigue. Si sale otro error, foto de la pantalla y sigue.

- [ ] **P4, paso 22 (persona responsable): parar la pista**

📍 En el portátil. Detén el reproductor.

- [ ] **P4, paso 23 (persona responsable): guardar por qué ha terminado el proceso del banco (A)**

📍 La misma ventana de PowerShell.

⚠️ La sexta línea borra del teléfono el archivo temporal que crea la cuarta, cuando la quinta ya lo copió al portátil.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'dumpsys activity exit-info dev.banco.prueba > /data/local/tmp/exit-info-a.txt'
adb pull /data/local/tmp/exit-info-a.txt .\sesion-3\p4\
adb shell rm /data/local/tmp/exit-info-a.txt
```

Qué hace: la primera orden escribe en el teléfono, en su carpeta temporal de adb (`/data/local/tmp`, fuera del almacenamiento compartido), el historial de cierres del banco que guarda Android (cuándo y por qué terminó cada proceso, solo del banco); la segunda lo trae a `sesion-3\p4`; la tercera lo borra del teléfono. Nunca se redirige con `>` en PowerShell: el `>` va dentro de las comillas y lo ejecuta el teléfono.
Esperado: `1 file pulled` y ninguna salida en las otras dos.

- [ ] **P4, paso 24 (persona responsable): poner el banco «Sin restricciones» (B)**

📍 En el teléfono. Ajustes → Aplicaciones → Administrar aplicaciones → «Banco» → «Ahorro de batería» (o «Ahorro de energía») → «Sin restricciones».
Esperado: la opción «Sin restricciones» marcada. Anota cómo se llama exactamente en este teléfono.

- [ ] **P4, paso 25 (persona responsable): activar el inicio automático del banco (B)**

📍 En el teléfono, en la misma pantalla de «Banco» (en MIUI 14 y HyperOS puede estar en «Permisos» → «Inicio automático»). Activa «Inicio automático».
Esperado: el interruptor activado. Anota dónde estaba.

- [ ] **P4, paso 26 (persona responsable): ver si MIUI ha quitado el banco de Doze**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'dumpsys deviceidle whitelist | grep -c dev.banco.prueba'
```

Qué hace: lo mismo que el paso 7, ahora con los ajustes de B.
Esperado: `0` o `1`: los dos son resultados. Anótalo (con `1`, «Sin restricciones» exime al banco de Doze).

- [ ] **P4, paso 27 (persona responsable): poner la pista de clics (B)**

📍 En el portátil. Pon la pista desde el principio.
Esperado: el primer bip a los 2 s.

- [ ] **P4, paso 28 (persona responsable): iniciar la grabación B**

📍 En el teléfono, en «P3 y P4», en el primer minuto de la pista. Pon la misma fuente que en A (la del último ensayo bueno) y «Fragmento: 4 s», y enciende el interruptor «Latido cada minuto (P4)»: vuelve a apagado cada vez que se abre la pantalla. Toca «Iniciar grabación».
Esperado: el bloque con `"incidente"`, `"latidos": true` y `"arranque"`. Mira la hora. Si dice `"latidos": false`, toca «Detener» y empieza otra vez con el interruptor encendido.

- [ ] **P4, paso 29 (persona responsable): apagar la pantalla**

📍 En el teléfono. Pulsa una vez el botón de encendido. No lo toques hasta el paso 36.

- [ ] **P4, paso 30 (persona responsable): hacer que el teléfono crea que va con batería**

⚠️ Como en el paso 15: se deshace en el paso 35.

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys battery unplug
```

Esperado: ninguna salida.

- [ ] **P4, paso 31 (persona responsable): forzar Doze**

⚠️ Como en el paso 16: se deshace en el paso 34.

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys deviceidle force-idle
adb shell dumpsys deviceidle get deep
```

Esperado: `Now forced in to deep idle mode` y `IDLE` (si no, lo mismo que en el paso 16).

- [ ] **P4, paso 32 (persona responsable): esperar 15 min**

📍 Temporizador de 15 min en otro aparato. No toques el teléfono.

- [ ] **P4, paso 33 (persona responsable): comprobar a mitad que sigue en Doze**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys deviceidle get deep
```

Esperado: `IDLE` (o un momento `IDLE_MAINTENANCE`). Después, otro temporizador de 15 min.

- [ ] **P4, paso 34 (persona responsable): quitar el Doze forzado**

📍 La misma ventana de PowerShell, a los 30 min del paso 28.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys deviceidle unforce
```

Esperado: `Light state: …, deep state: …`.

- [ ] **P4, paso 35 (persona responsable): devolver el estado real de la batería**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell dumpsys battery reset
adb shell dumpsys deviceidle get deep
```

Esperado: ninguna salida y `ACTIVE`.

- [ ] **P4, paso 36 (persona responsable): detener la grabación B**

📍 En el teléfono. Enciende la pantalla, desbloquéalo y, en «P3 y P4», toca «Detener». Mira también el reproductor del portátil: si ya llegó al final de la pista, anótalo.
Esperado: `"motivo": "detener"`, `"error": null`, `"cierre": true`, `"eos": true` y unos 450 `"fragmentos"`. Con `no hay ninguna grabación`, MIUI cerró el banco también así: anótalo.

- [ ] **P4, paso 37 (persona responsable): parar la pista**

📍 En el portátil. Detén el reproductor.

- [ ] **P4, paso 38 (persona responsable): guardar por qué ha terminado el proceso del banco (B)**

📍 La misma ventana de PowerShell.

⚠️ La sexta línea borra del teléfono el archivo temporal que crea la cuarta, cuando la quinta ya lo copió al portátil.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'dumpsys activity exit-info dev.banco.prueba > /data/local/tmp/exit-info-b.txt'
adb pull /data/local/tmp/exit-info-b.txt .\sesion-3\p4\
adb shell rm /data/local/tmp/exit-info-b.txt
```

Qué hace: lo mismo que el paso 23, para la grabación B.
Esperado: `1 file pulled` y ninguna salida en las otras dos.

- [ ] **P4, paso 39 (persona responsable): traer la sesión al portátil**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb pull /sdcard/Android/data/dev.banco.prueba/files/ .\sesion-3\p4\
Get-ChildItem '.\sesion-3\p4' -Name
```

Qué hace: trae la carpeta de resultados del banco (las grabaciones van cifradas) y lista lo que hay en `sesion-3\p4`.
Esperado: una línea que acaba en `files pulled, 0 skipped.` y la lista `exit-info-a.txt`, `exit-info-b.txt` y `files`.

- [ ] **P4, paso 40 (persona responsable): quitar el modo avión**

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell cmd connectivity airplane-mode disable
adb shell cmd connectivity airplane-mode
adb kill-server
```

La última línea para el servicio de adb del portátil (escuchaba en 127.0.0.1:5037, solo para el propio portátil; el próximo bloque con adb lo vuelve a arrancar solo).
Esperado: `disabled`.

- [ ] **P4, paso 41 (persona responsable): quitar «No molestar» del teléfono**

📍 En el teléfono, en los ajustes rápidos: desactiva «No molestar».
Esperado: ya no sale el icono de la luna.

- [ ] **P4, paso 42 (persona responsable): devolver las notificaciones del portátil**

📍 En el portátil, en Configuración (tecla Windows + I): deja el ajuste del paso 10 como lo anotaste (Windows 11: Sistema → Notificaciones → «No molestar»; Windows 10: Sistema → Asistente de concentración).
Esperado: el ajuste como estaba antes de la sesión.

- [ ] **P4, paso 43 (persona responsable): subir la sesión**

📍 En el navegador, en code-server. Arrastra la carpeta `p4` (`C:\Users\<tu usuario>\vigia-h0b\sesion-3\p4`) hasta la carpeta `telefono/sesion-3` de la carpeta de intercambio (la que te dio Claude en el paso 1). No abras sus archivos en el editor. Pasa a Claude por el chat lo que anotaste en los pasos 6, 7, 16, 18, 21, 24, 25, 26, 31, 33 y 36.
Esperado: en el explorador de code-server, dentro de `telefono/sesion-3`, la carpeta `p4` con `exit-info-a.txt`, `exit-info-b.txt` y `files` (dentro, `resultados.jsonl` y la carpeta `p3`). Si `files` no está dentro de `p4`, se subió otra carpeta: avisa a Claude.

- [ ] **P4, paso 44 (Claude): comprobar lo subido y listar las grabaciones**

📍 Máquina de trabajo; el `docker run` es un contenedor efímero sin red.

Ejecutar:

```sh
test "$(find <intercambio>/telefono/sesion-3/p4 ! -type f ! -type d | wc -l)" -eq 0 && chmod -R a+rX <intercambio>/telefono/sesion-3/p4 && echo "bien: solo archivos y carpetas, legibles para el contenedor"
docker exec vigia-build sincronizar banco
docker run --rm --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-3/p4:/sesion:ro vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh < /dev/null
```

Esperado: `bien: solo archivos y carpetas, legibles para el contenedor` (si no sale, lo subido trae enlaces u otros archivos especiales: parar) y la lista por hora de inicio. Las de esta sesión son las dos últimas con `"latidos": true`: la primera es A y la segunda B (las de la sesión 2 van antes, sin latidos). Una con `"motivo": "sin_resumen"` es una grabación que el sistema cortó: su inicio sale de sus eventos y latidos y el orden se mantiene.

- [ ] **P4, paso 45 (Claude): analizar P4 de A y de B**

📍 Máquina de trabajo; los contenedores que reciben la privada no guardan registro ni usan memoria de intercambio.

Ejecutar, con `<incidente A>` e `<incidente B>` los de la lista:

```sh
docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-3/p4:/sesion:ro vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh <incidente A> p4 < <privada>/escucha/privada.b64u > <intercambio>/resultados/sesion-3-p4-a.json; echo "salida: $?"
docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-3/p4:/sesion:ro vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh <incidente B> p4 < <privada>/escucha/privada.b64u > <intercambio>/resultados/sesion-3-p4-b.json; echo "salida: $?"
for f in <intercambio>/resultados/sesion-3-p4-a.json <intercambio>/resultados/sesion-3-p4-b.json; do python3 -I -c 'import json, sys; r = json.load(sys.stdin); c = r["criterios"]; print(r["modo"], r["veredicto"], " ".join(f"{k}={v["veredicto"]}" for k, v in c.items())); print(json.dumps({"latidos": c["latidos"], "cierre": c["cierre"], "muestras": c["muestras_frente_al_tiempo"], "ventana": r["ventana"], "errores": r["eventos"]["errores"], "silenciado": r["eventos"]["silenciado"]}, ensure_ascii=False))' < "$f"; done
```

Esperado si P4 sin subida se cumple: `salida: 0` y `p4 pasa carpeta=pasa verificacion=pasa muestras_frente_al_tiempo=pasa latidos=pasa cierre=pasa`; en `latidos`, unos 31 latidos, `"max_hueco_s"` de 65 o menos, casi todos `"en_doze"`, `"pantalla_encendida"` 1 (el del inicio) y `"sin_optimizar"` (si Android exime al banco de la optimización de batería, que «Sin restricciones» puede cambiar); en `cierre`, `"motivo": "detener"`, `"eos": true` y `"verificacion": "integro"`. Lo esperable es que B pase; que A falle es un resultado válido de P4 (MIUI por defecto mata o congela el servicio) y alimenta la guía por fabricante y el aviso de H3a ("Tu teléfono cerró la grabación a las HH:MM"). Cómo leer un fallo:
- `latidos=falla` con un `"max_hueco_s"` grande y `"motivo"` `detener`: el proceso vivió pero se quedó congelado ese tiempo (el lector no leyó: también lo dicen los `saltos` de `muestras_frente_al_tiempo`).
- `cierre=falla` con `sin resumen.json`: el proceso murió; su hora y su motivo están en `exit-info` (paso 46).
- `latidos=sin_doze`: la grabación no pasó por Doze (pasos 7, 16 y 26).

- [ ] **P4, paso 46 (Claude): leer `exit-info`**

📍 Máquina de trabajo. `cat -v` enseña cualquier carácter raro sin interpretarlo (el archivo viene del teléfono).

```sh
grep -nE 'ApplicationExitInfo|timestamp=|reason=|description=' <intercambio>/telefono/sesion-3/p4/exit-info-a.txt | cat -v
grep -nE 'ApplicationExitInfo|timestamp=|reason=|description=' <intercambio>/telefono/sesion-3/p4/exit-info-b.txt | cat -v
```

Esperado: por cada cierre guardado, un bloque `ApplicationExitInfo #n:` con `timestamp=AAAA-MM-DD HH:MM:SS.mmm` (hora local del teléfono), `reason=<n> (<MOTIVO>)` y `description=…`. Se compara cada `timestamp` con `"ventana"` del paso 45 (`inicio_telefono` y `fin_telefono`; si la grabación no tiene resumen, la ventana va en UTC y la zona del teléfono sale de la otra grabación o de la sesión 2). Ningún cierre dentro de la ventana de A o de B: el sistema no mató el banco mientras grababa. Uno dentro: va al informe su `reason` (por ejemplo `OTHER KILLS BY SYSTEM`, `LOW_MEMORY` o `USER REQUESTED`) y su `description`, sin la hora. Los cierres de fuera de las ventanas son de otros días o de cuando se cerró la app a mano.

- [ ] **P4, paso 47 (Claude): el audio en Doze, con P3**

Las dos grabaciones llevaban la pista: el análisis de P3 dice si el audio siguió entrando entero con Doze, si sonó algo en la sala (`otros_sonidos` y `golpes`) y cuánto tardó en arrancar cada grabación (`grabacion_ms`). Aquí no cuentan para P4 ni los arranques ni el veredicto de conjunto (la tanda de 20 arranques es la de la sesión 2).

📍 Máquina de trabajo; los contenedores que reciben la privada no guardan registro ni usan memoria de intercambio.

Ejecutar:

```sh
docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-3/p4:/sesion:ro vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh <incidente A> p3 < <privada>/escucha/privada.b64u > <intercambio>/resultados/sesion-3-p4-a-audio.json; echo "salida: $?"
docker run --rm -i --init --network none --user 1001 --cap-drop ALL --security-opt no-new-privileges --log-driver none --memory 2g --memory-swap 2g -v vigia-trabajo:/work:ro --tmpfs /tmp:size=1g -v <intercambio>/telefono/sesion-3/p4:/sesion:ro vigia-build:h0b sh /work/banco/p3/maquina/analizar.sh <incidente B> p3 < <privada>/escucha/privada.b64u > <intercambio>/resultados/sesion-3-p4-b-audio.json; echo "salida: $?"
for f in <intercambio>/resultados/sesion-3-p4-a-audio.json <intercambio>/resultados/sesion-3-p4-b-audio.json; do python3 -I -c 'import json, sys; r = json.load(sys.stdin); c = r["criterios"]; k = c["clics"]; print("clics=" + k["veredicto"], "muestras=" + c["muestras_frente_al_tiempo"]["veredicto"], "formato=" + c["formato"]["veredicto"]); print(json.dumps({x: k.get(x) for x in ("faltan", "desplazados", "max_error_intervalo_ms", "hueco_final_s", "otros_sonidos", "golpes")} | {"silenciado": r["eventos"]["silenciado"], "grabacion_ms": c["arranques"].get("grabacion_ms")}, ensure_ascii=False))' < "$f"; done
```

Esperado con P4 cumplido, en las dos: `salida: 0` o `salida: 1` (la salida sigue al veredicto de conjunto, que aquí no cuenta), `clics=pasa muestras=pasa formato=pasa` y `{"faltan": [], "desplazados": 0, "max_error_intervalo_ms": <20 o menos>, "hueco_final_s": <11 o menos>, "otros_sonidos": 0, "golpes": 0, "silenciado": [], "grabacion_ms": <menos de 2000>}`. Cómo leerlo:
- `otros_sonidos` o `golpes` mayores que 0: mira «Si una grabación tiene indicios de voces», abajo, antes de nada más.
- `clics=falla` con `faltan`, `desplazados` o un `hueco_final_s` grande: los clics dejaron de llegar antes del final. Si `silenciado` trae `true`, el sistema silenció el micrófono (Doze o MIUI, aunque el proceso siguiera): va al informe junto con los latidos. Si no, antes de anotarlo Claude pregunta a la persona responsable si el portátil se durmió o el reproductor se paró (lo que anotó en los pasos 21 y 36); sin esa comprobación no se atribuye a Doze ni a MIUI.
- `grabacion_ms` de 2 000 o más: es un resultado de P3 (un arranque de más de 2 s), que va con los de la sesión 2.

- [ ] **P4, paso 48 (persona responsable): borrar la copia del portátil**

⚠️ Borra del portátil la carpeta `sesion-3\p4` (solo hay audio cifrado y resultados, que ya están en el servidor). Hazlo después de que Claude confirme el paso 47: con las grabaciones fuera del portátil, solo quedan en el teléfono y en `<intercambio>` (DAT-01).

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Remove-Item -Recurse -Force '.\sesion-3\p4'
Get-ChildItem '.\sesion-3' -Name
```

Qué hace: borra la carpeta de P4 de la sesión 3 y lista lo que queda en `sesion-3`.
Esperado: ya no aparece `p4` (si P6 ya se hizo, sigue `p6`).

**Si una grabación tiene indicios de voces (DAT-01)**

Lo decide el paso 47: con `otros_sonidos` (sonidos de más de 200 ms, como una voz, música o la televisión) o `golpes` (sonidos cortos) mayores que 0 en A o en B, Claude pregunta a la persona responsable qué sonó en la sala. Si alguien habló o sonó una radio, una televisión o música, o si con `otros_sonidos` mayor que 0 no sabe qué fue, hay indicios de voces: esa grabación no se analiza más, se borra del teléfono, del portátil y de `<intercambio>`, y se repite. Si fue un ruido sin voces (una puerta, un coche), se anota (DAT-01) y se sigue. Claude pasa por el chat `<incidente>`, el de la grabación (A o B).

- [ ] **Borrado 1 (Claude): en `<intercambio>`**

⚠️ Borra la carpeta subida de P4 (al repetir se vuelve a subir, ya sin esa grabación) y los cuatro análisis de P4, que se rehacen.

📍 Máquina de trabajo.

```sh
rm -r <intercambio>/telefono/sesion-3/p4
rm -f <intercambio>/resultados/sesion-3-p4-a.json <intercambio>/resultados/sesion-3-p4-b.json <intercambio>/resultados/sesion-3-p4-a-audio.json <intercambio>/resultados/sesion-3-p4-b-audio.json
ls <intercambio>/telefono/sesion-3 <intercambio>/resultados
```

Esperado: ya no están `p4` ni los cuatro `sesion-3-p4-*.json`.

- [ ] **Borrado 2 (persona responsable): en el teléfono**

⚠️ Borra del teléfono esa grabación (solo la carpeta de ese incidente).

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell rm -r /sdcard/Android/data/dev.banco.prueba/files/p3/<incidente>
adb shell ls /sdcard/Android/data/dev.banco.prueba/files/p3/
```

Qué hace: la cuarta línea borra la carpeta de la grabación (`<incidente>`, el que te dio Claude); la quinta lista las grabaciones que quedan.
Esperado: ninguna salida de la cuarta y, en la lista, ya no sale `<incidente>`. Si la cuarta dice `No such file or directory`, revisa el `<incidente>` con Claude. Si dice `Permission denied` (MIUI no deja borrar dentro de `Android/data`), sigue con el bloque de abajo.

⚠️ Solo si la orden anterior dio `Permission denied`, y solo cuando Claude te confirme que todo lo demás ya está en el portátil y subido: `pm clear` borra todos los datos del banco en el teléfono, también los resultados de las sesiones 1 y 2 (ya están sacados), y deja el banco como recién instalado.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell pm clear dev.banco.prueba
```

Qué hace: borra los datos del banco en el teléfono, con su carpeta de resultados.
Esperado: `Success`. Al repetir, el banco puede volver a pedir el micrófono y las notificaciones: acepta como en la sesión 2.

- [ ] **Borrado 3 (persona responsable): en el portátil**

⚠️ Borra la copia de esa grabación del portátil (`exit-info-a.txt` y `exit-info-b.txt` se quedan).

📍 La misma ventana de PowerShell.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Remove-Item -Recurse -Force '.\sesion-3\p4\files\p3\<incidente>'
Get-ChildItem '.\sesion-3\p4\files\p3' -Name
```

Qué hace: borra la carpeta de la grabación en la copia del portátil y lista las que quedan.
Esperado: ya no sale `<incidente>`.

- [ ] **Borrado 4 (persona responsable): repetir la grabación**

📍 Los pasos de esta parte, otra vez. Si era B, repite los pasos 4, 5, 10 y 11 y después del 26 al final. Si era A, devuelve antes los ajustes de batería del banco a los que anotaste en el paso 6 y repite desde el paso 4 hasta el final: A y B otra vez, para que las dos últimas grabaciones con latidos sigan siendo A y B. Claude anota que una grabación se repitió por indicios de voces y se borró, sin describir el audio.

**Comprobación final de P4 (Claude)**

📍 Máquina de trabajo.

```sh
ls -l <intercambio>/resultados/sesion-3-p4-*.json
for f in <intercambio>/resultados/sesion-3-p4-a.json <intercambio>/resultados/sesion-3-p4-b.json; do python3 -I -c 'import json, sys; r = json.load(sys.stdin); print(r["veredicto"], {k: v["veredicto"] for k, v in r["criterios"].items()}, r["bateria"])' < "$f"; done
```

Esperado: los cuatro archivos y una línea por grabación con sus veredictos y `sin_medir: el cable USB carga el teléfono en el tramo A`. Para el informe (tarea 16), por cada configuración (A: MIUI por defecto; B: «Sin restricciones» e inicio automático, con los nombres exactos que anotó la persona responsable): si el servicio aguantó 30 min con la pantalla apagada y Doze forzado (latidos y hueco máximo), si se cerró entero al detener, si el audio siguió entrando (clics, con la lectura del paso 47), el arranque de la grabación (`grabacion_ms`), `otros_sonidos` y `golpes`, si el banco quedó exento de Doze (pasos 7 y 26) y, si el sistema lo mató, el motivo de `exit-info`. Sin horas, rutas ni números de serie. La batería y la subida cada minuto quedan para el tramo B.

**Notas:**

- **Nota:** el tramo A no sube nada: "ningún minuto sin subida mientras hay red" se mide aquí como "ningún minuto sin latido" (el latido lo escribe el hilo lector, así que también se para si se congela el audio), y "la cola se vacía tras Detener", como que la grabación se cierra entera y sin errores tras Detener. La subida real, con WorkManager o con el propio servicio en `dataSync`, y la batería con y sin ubicación son del tramo B.
- **Nota:** la secuencia de Doze es la del plan maestro con `deviceidle unforce`, que añadió la tarea 1: `battery unplug`, `deviceidle force-idle`, `get deep` y, al terminar, `deviceidle unforce` y `battery reset`. Las salidas citadas son las de `DeviceIdleController` de AOSP 13; MIUI puede cambiarlas.
- **Nota:** `exit-info` solo guarda el historial del banco (proceso, `pid`, `uid`, motivo y hora local); no lleva datos personales ni de otras apps. Se escribe en `/data/local/tmp` (no en el almacenamiento compartido, que indexa MediaStore) y se borra del teléfono tras traerlo.
- **Nota:** la pista dura 45 min y cada grabación empieza en su primer minuto: aunque los pasos 14 a 21 (o 29 a 36) se alarguen unos minutos, la grabación acaba antes que la pista. Un `hueco_final_s` grande no sale entonces del final de la pista, sino de que los clics dejaron de llegar (paso 47).
- **Nota:** las dos configuraciones se miden con el mismo APK y la misma pantalla; entre A y B solo cambian los dos ajustes de MIUI (pasos 24 y 25). Si se quiere repetir A, hay que devolver esos ajustes a lo que se anotó en el paso 6.

#### Parte 2: P6, primitivas en los navegadores reales del teléfono

Vas a usar dos ventanas de PowerShell, las dos con tu usuario normal (no hace falta administrador):
- **Terminal A**: la de adb, la misma de la sesión 1.
- **Terminal B**: una segunda ventana, solo para el servidor. Ábrela cuando lo diga el paso 6 (menú Inicio → escribe `PowerShell` → Windows PowerShell).

Cada bloque de PowerShell empieza por las mismas tres líneas, que preparan la ventana: la carpeta de trabajo (`vigia-h0b`, en tu carpeta de usuario), adb en la ruta y entrar en esa carpeta. Así da igual en qué ventana o en qué orden lo pegues.

Qué sale del teléfono durante P6, para que lo aceptes antes de empezar. Los resultados y las capturas van por el cable a tu portátil; lo que sale es la dirección de la página, `http://127.0.0.1:8080/primitivas.html` con el nombre del navegador detrás de `#` (no lleva datos tuyos ni de la prueba):
- Telegram: el enlace que te envías a «Mensajes guardados» se guarda en la nube de Telegram y llega a los demás dispositivos de la cuenta hasta que lo borras (paso 34).
- Chrome: guarda la dirección en su historial y, si tiene una cuenta con la sincronización activada, la sube a Google.
- Mi Browser, si lo usas: puede enviar a Xiaomi las direcciones que visita.
- Google Play: la instalación de Samsung Internet queda en la cuenta de Google del teléfono.

Al acabar, los pasos 32 a 36 cierran el puerto del portátil y el del teléfono, borran el enlace de Telegram y las visitas del historial de los navegadores, quitan «No molestar» y, si quieres, desinstalan Samsung Internet.

- [ ] **P6, paso 1 (Claude): dejar los archivos en la carpeta de entrega y crear la de subida**

📍 Máquina de trabajo. Los tres archivos del banco salen de su commit (`git show`), no de la copia de trabajo; la muestra, del volumen.

Ejecutar:

```sh
umask 077 && mkdir -p <intercambio>/entrega/sesion-3/p6 <intercambio>/telefono/sesion-3/p6
for f in primitivas.html primitivas.js servidor.ps1; do git -C <banco> show HEAD:p6/$f > <intercambio>/entrega/sesion-3/p6/$f; done
docker cp -L vigia-build:/work/h0b/p6/muestra.aac <intercambio>/entrega/sesion-3/p6/muestra.aac && test -f <intercambio>/entrega/sesion-3/p6/muestra.aac && ! test -L <intercambio>/entrega/sesion-3/p6/muestra.aac
(cd <intercambio>/entrega/sesion-3/p6 && sha256sum primitivas.html primitivas.js muestra.aac servidor.ps1 > sumas-p6.sha256 && cat sumas-p6.sha256)
```

Esperado:

```
6648019297440fcfd3a4f5d0beec26cefe3b822e7a7938b1d62008a3c2fdff3e  primitivas.html
14e684e1e6cfd63a1dcfdd7e80c2e6a951e3145d613b6a5e9bff4ca04a52382f  primitivas.js
7cf6e56750c93d7b905ef82704c5b1bd8cf5272985ce013c5629048b08afcb15  muestra.aac
7d4f94624bb954f90a795768dd22e2299ef3a49a9d010a992a488d83c28007fb  servidor.ps1
```

Si una suma no es esta, el banco no está en el commit de la tarea 10 (o la muestra no es la del paso 2 de la tarea 10): parar y revisarlo antes de seguir. Claude pasa a la persona responsable por el chat la ruta real de `<intercambio>/entrega/sesion-3/p6` y la de `<intercambio>/telefono/sesion-3/p6`.

- [ ] **P6, paso 2 (persona responsable): crear las carpetas del portátil**

📍 Terminal A (PowerShell, tu usuario, en `C:\Users\<tu usuario>\vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
New-Item -ItemType Directory -Force '.\p6', '.\sesion-3\p6' | Out-Null
Get-ChildItem -Directory . , .\sesion-3 | Select-Object FullName
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta crea `vigia-h0b\p6` (los archivos del servidor y los resultados que guarde) y `vigia-h0b\sesion-3\p6` (lo que subirás al final); la quinta las enseña.
Esperado: entre las carpetas, `C:\Users\<tu usuario>\vigia-h0b\p6`, `C:\Users\<tu usuario>\vigia-h0b\sesion-3` y `C:\Users\<tu usuario>\vigia-h0b\sesion-3\p6`. Si dice que no encuentra `vigia-h0b`, esta no es la carpeta de la sesión 1: avisa a Claude.

- [ ] **P6, paso 3 (persona responsable): bajar los cinco archivos desde code-server**

📍 En el navegador del portátil, en code-server. En el explorador de la izquierda, abre la carpeta de entrega que te dio Claude (`…/entrega/sesion-3/p6`). Clic derecho sobre cada archivo → «Download…»: `primitivas.html`, `primitivas.js`, `muestra.aac`, `servidor.ps1` y `sumas-p6.sha256`. Si el navegador te pregunta dónde guardarlos, elige `C:\Users\<tu usuario>\vigia-h0b\p6`. No abras ninguno en el editor de code-server.
Esperado: los cinco bajados. Si el navegador avisa de que `servidor.ps1` puede ser peligroso (lo hace con los `.ps1`), elige «Conservar»: es el servidor de esta prueba y en el paso 5 se comprueba su suma.

- [ ] **P6, paso 4 (persona responsable): llevar lo bajado a `vigia-h0b\p6`**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
foreach ($f in 'primitivas.html', 'primitivas.js', 'muestra.aac', 'servidor.ps1', 'sumas-p6.sha256') { $bajado = Join-Path (Join-Path $HOME 'Downloads') $f; if (Test-Path -LiteralPath $bajado) { Move-Item -LiteralPath $bajado -Destination .\p6\ -Force } }
Get-ChildItem .\p6 | Select-Object Name, Length
```

Qué hace: la cuarta línea mueve cada uno de los cinco archivos de tu carpeta de Descargas (en disco se llama `Downloads`) a `vigia-h0b\p6`, si está allí (si los guardaste directamente en `p6`, no hace nada); la quinta lista `p6` con el tamaño de cada archivo.
Esperado, exactamente estos cinco con estos tamaños (en bytes):

```
Name            Length
----            ------
muestra.aac      16998
primitivas.html   1507
primitivas.js     6544
servidor.ps1      8977
sumas-p6.sha256    319
```

Si falta alguno, o en Descargas quedó con otro nombre (por ejemplo `servidor (1).ps1`, porque ya había uno con ese nombre), bórralo de Descargas, bájalo otra vez y repite este paso.

- [ ] **P6, paso 5 (persona responsable): comprobar las sumas**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Get-Content .\p6\sumas-p6.sha256 | ForEach-Object { $suma, $nombre = $_ -split '\s+', 2; if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path .\p6 $nombre)).Hash.ToLower() -eq $suma) { "bien: $nombre" } else { "MAL: $nombre" } }
```

Qué hace: para cada línea de `sumas-p6.sha256` (la suma que publicó Claude y el nombre), calcula la suma SHA-256 del archivo que bajaste y dice si coinciden.
Esperado:

```
bien: primitivas.html
bien: primitivas.js
bien: muestra.aac
bien: servidor.ps1
```

Las sumas tienen que ser también las de este plan (las del paso 1). Si sale un `MAL`, borra ese archivo de `vigia-h0b\p6`, bájalo otra vez (paso 3), muévelo (paso 4) y repite; si sigue saliendo `MAL`, avisa a Claude y no arranques el servidor.

- [ ] **P6, paso 6 (persona responsable): arrancar el servidor**

⚠️ Abre el puerto 8080 en tu portátil, solo en `127.0.0.1` (ninguna otra máquina de la red llega a él), mientras dura P6: lo cierra Ctrl+C en el paso 32. Mientras está abierto, cualquier programa de tu portátil puede pedirle la página o mandarle un resultado, que se guardaría en `vigia-h0b\p6`.

📍 Terminal B: abre una segunda ventana de PowerShell (menú Inicio → `PowerShell` → Windows PowerShell), con tu usuario normal. Este bloque se pega ahí y esa ventana se queda abierta hasta el paso 32.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Set-Location .\p6
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\servidor.ps1
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta entra en `vigia-h0b\p6`; la quinta arranca el servidor con Windows PowerShell. `-ExecutionPolicy Bypass` vale solo para ese proceso (Windows no deja ejecutar un `.ps1` bajado sin eso) y no cambia ninguna configuración de tu equipo; `-NoProfile` no carga tu perfil. El servidor solo escucha en `127.0.0.1` (tu propio portátil, ninguna red), solo sirve los tres archivos de la página y guarda en esta carpeta lo que le mande la página.
Esperado:

```
Servidor de P6 en http://127.0.0.1:8080/primitivas.html (solo 127.0.0.1). Carpeta: C:\Users\<tu usuario>\vigia-h0b\p6
Ctrl+C para pararlo.
```

y la ventana se queda esperando: cada petición saldrá como una línea (`GET /primitivas.html -> 200`). Si sale otra cosa:
- `Aviso: falta muestra.aac en …` (u otro archivo): para con Ctrl+C y repite los pasos 3 a 5.
- `No se pudo abrir 127.0.0.1:8080: …`: otro programa usa el puerto 8080. En la Terminal A, `Get-NetTCPConnection -LocalPort 8080 -State Listen | ForEach-Object { Get-Process -Id $_.OwningProcess }` dice cuál; pásale a Claude su nombre y no cierres nada sin hablarlo.
- Un error rojo que dice que la ejecución de scripts está deshabilitada: una directiva de tu equipo manda sobre `-ExecutionPolicy`. Avisa a Claude.
- Si el Firewall de Windows pregunta si permites el acceso: «Cancelar». El servidor solo usa `127.0.0.1` y no necesita la red.

- [ ] **P6, paso 7 (persona responsable): comprobar el teléfono**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`). Teléfono conectado por el cable USB de datos y desbloqueado.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb get-state
adb shell cmd connectivity airplane-mode
```

Qué hace: la cuarta línea pregunta si adb ve el teléfono (sin enseñar su número de serie); la quinta, si el modo avión está activado.
Esperado: `device` y `disabled`. Si la segunda dice `enabled`, desactívalo con `adb shell cmd connectivity airplane-mode disable` (Google Play y Telegram necesitan red). Si la primera da un error (`no devices/emulators found` o `unauthorized`), desconecta y vuelve a conectar el cable y acepta en el teléfono el aviso de depuración USB.

- [ ] **P6, paso 8 (persona responsable): activar «No molestar»**

📍 En el teléfono. Desliza desde arriba para abrir los ajustes rápidos y activa «No molestar».
Esperado: el icono de la luna en la barra de estado. Así no salen notificaciones encima de la página en las capturas. Los avisos que Telegram dibuja dentro de su app (un mensaje que llega mientras la tienes abierta) pueden salir igual: por eso el paso 31 te pide mirar las capturas antes de subirlas.

- [ ] **P6, paso 9 (persona responsable): conectar el puerto 8080 del teléfono con el del portátil**

⚠️ Abre el puerto 8080 dentro del teléfono (en su `127.0.0.1`, no en la red) hacia el servidor de tu portátil, mientras dura P6: lo cierra el paso 33. Mientras está abierto, cualquier app del teléfono puede llegar al servidor (pedir la página o mandarle un resultado).

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb reverse tcp:8080 tcp:8080
adb reverse --list
```

Qué hace: la cuarta línea hace que, en el teléfono, `127.0.0.1:8080` lleve por el cable al `127.0.0.1:8080` de tu portátil (al servidor); nada pasa por el Wi-Fi ni por internet. Así la página se abre en el teléfono como `http://127.0.0.1:8080`, que los navegadores tratan como contexto seguro: por la IP de tu red local no lo sería, y las primitivas no existirían. La quinta lista lo conectado.
Esperado: `8080` (o nada, según la versión de adb) y una línea que termina en `tcp:8080 tcp:8080`. Esa línea no la pegues en el chat.

- [ ] **P6, paso 10 (persona responsable): abrir la página en Chrome**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'am start -a android.intent.action.VIEW -d http://127.0.0.1:8080/primitivas.html#chrome -p com.android.chrome'
```

Qué hace: abre la página en Chrome, en el teléfono, sin teclear nada; `#chrome` anota qué navegador es (no llega al servidor, solo a la página).
Esperado: en PowerShell, una línea que empieza por `Starting: Intent {`. En el teléfono, en unos segundos, un recuadro grande: verde con `5 de 5 ✓`, o rojo con `N de 5 ✓, falla …`; debajo, una línea por primitiva y `Guardado en el portátil: resultado-1.json`. En la Terminal B: `GET /primitivas.html -> 200`, `GET /primitivas.js -> 200`, `GET /muestra.aac -> 200` y `POST /resultado -> 201 resultado-1.json`; una línea `GET /favicon.ico -> 404` es normal (el navegador pide el icono de la página, que no tiene). Si sale otra cosa:
- Chrome enseña sus pantallas de bienvenida: acéptalas sin iniciar sesión y repite la orden.
- «No se puede acceder a este sitio» o `ERR_CONNECTION_REFUSED`: mira que la Terminal B siga con el servidor y repite el paso 9.
- El recuadro sigue diciendo `Si este texto no cambia, el JavaScript de la página no se ejecutó.`: haz igualmente la captura (paso 11) y avisa a Claude.
- `✗ No se guardó: …`: haz la captura igualmente y avisa a Claude; mira qué dice la Terminal B.
- `Error: Activity not started, unable to resolve Intent`: Chrome no está instalado o está desactivado; avisa a Claude.

- [ ] **P6, paso 11 (persona responsable): captura de Chrome**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`). Con la página de Chrome en la pantalla del teléfono, ya con el recuadro verde o rojo.

⚠️ La sexta línea borra un archivo del teléfono: solo la captura temporal que acaba de crear la cuarta, cuando la quinta ya la copió al portátil. Lo mismo en todas las capturas de esta sesión.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p6-chrome.png
adb pull /data/local/tmp/p6-chrome.png .\sesion-3\p6\
adb shell rm /data/local/tmp/p6-chrome.png
```

Qué hace: la cuarta línea hace una captura de la pantalla del teléfono y la deja en `/data/local/tmp`, una carpeta temporal de adb que no ven las demás apps ni las copias en la nube; la quinta la trae a `vigia-h0b\sesion-3\p6`; la sexta borra del teléfono esa captura temporal (solo ese archivo, que acaba de crear la cuarta).
Esperado: `/data/local/tmp/p6-chrome.png: 1 file pulled, 0 skipped.` seguido de la velocidad y el tamaño. Si dice `No such file or directory`, repite el bloque entero (la captura, traerla y borrarla).

- [ ] **P6, paso 12 (persona responsable): instalar o actualizar Samsung Internet desde Google Play**

📍 En el teléfono. Abre Google Play, busca `Samsung Internet` y elige la app de «Samsung Electronics Co., Ltd.» (puede llamarse «Samsung Internet Browser» o «Samsung Browser»). Toca «Instalar»; si ya estaba instalada y sale «Actualizar», toca «Actualizar». No hace falta abrirla todavía.
Esperado: el botón pasa a «Abrir». Anota si Samsung Internet ya estaba instalada antes de este paso: el paso 36 solo ofrece desinstalarla si la instalaste ahora. Samsung Internet no viene en un Xiaomi: se mide en su versión de Google Play del día, no en la que tendría un contacto que no actualiza; el motor a partir del cual hay X25519 sale de la documentación (paso 27), no de esta medida.

- [ ] **P6, paso 13 (persona responsable): abrir la página en Samsung Internet**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'am start -a android.intent.action.VIEW -d http://127.0.0.1:8080/primitivas.html#samsung -p com.sec.android.app.sbrowser'
```

Qué hace: abre la página en Samsung Internet, anotada como `#samsung`.
Esperado: lo mismo que en el paso 10, ahora con `resultado-2.json` (o el número siguiente). La primera vez, Samsung Internet enseña sus condiciones y opciones: acepta lo mínimo, rechaza lo opcional (compartir datos, notificaciones) y repite la orden. Si sale `unable to resolve Intent`, no se instaló: repite el paso 12.

- [ ] **P6, paso 14 (persona responsable): captura de Samsung Internet**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`). Con el recuadro verde o rojo en la pantalla.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p6-samsung.png
adb pull /data/local/tmp/p6-samsung.png .\sesion-3\p6\
adb shell rm /data/local/tmp/p6-samsung.png
```

Qué hace y qué debe salir: como en el paso 11, con `p6-samsung.png`.

- [ ] **P6, paso 15 (persona responsable): ver si el teléfono tiene Mi Browser**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell pm path com.mi.globalbrowser
adb shell pm path com.android.browser
```

Qué hace: pregunta al teléfono si están instalados los dos paquetes que usa Mi Browser (el de la versión global de MIUI y el de la china).
Esperado: cada línea imprime `package:` y una ruta si ese paquete está, o nada si no. Si sale algo en la primera, Mi Browser es `com.mi.globalbrowser`; si solo en la segunda, es `com.android.browser`. Si no sale nada en ninguna, sáltate los pasos 16 y 17.

- [ ] **P6, paso 16 (persona responsable; solo si está Mi Browser): abrir la página en Mi Browser**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`). Cambia `<PAQUETE>` por el paquete del paso 15 (`com.mi.globalbrowser` o `com.android.browser`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'am start -a android.intent.action.VIEW -d http://127.0.0.1:8080/primitivas.html#mi -p <PAQUETE>'
```

Qué hace: abre la página en Mi Browser, anotada como `#mi`.
Esperado: como en el paso 10, con el número de resultado siguiente. Si enseña sus condiciones, acepta lo mínimo y repite la orden.

- [ ] **P6, paso 17 (persona responsable; solo si está Mi Browser): captura de Mi Browser**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p6-mi.png
adb pull /data/local/tmp/p6-mi.png .\sesion-3\p6\
adb shell rm /data/local/tmp/p6-mi.png
```

Qué hace y qué debe salir: como en el paso 11, con `p6-mi.png`.

- [ ] **P6, paso 18 (persona responsable): mirar, sin cambiarlo, cómo abre Telegram los enlaces**

📍 En el teléfono. Telegram → menú (☰) → Ajustes → Ajustes de chat. Busca la opción del navegador con el que se abren los enlaces (según la versión, en inglés «In-App Browser», «Web Browser» u «Open links in»; en español, algo como «Navegador integrado» o «Abrir enlaces en»). Déjala en la pantalla y no la cambies.
Esperado: ves si los enlaces se abren en Telegram o en otro navegador. Si no encuentras la opción, deja en la pantalla «Ajustes de chat» y sigue: la propia página dirá en el paso 20 dónde se abrió.

- [ ] **P6, paso 19 (persona responsable): captura del ajuste de Telegram**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p6-telegram-ajuste.png
adb pull /data/local/tmp/p6-telegram-ajuste.png .\sesion-3\p6\
adb shell rm /data/local/tmp/p6-telegram-ajuste.png
```

Qué hace y qué debe salir: como en el paso 11, con `p6-telegram-ajuste.png`.

- [ ] **P6, paso 20 (persona responsable): abrir la página desde Telegram**

📍 En el teléfono. En Telegram, abre «Mensajes guardados» (menú ☰ → Mensajes guardados). Escribe exactamente este texto y envíalo:

```
http://127.0.0.1:8080/primitivas.html#telegram
```

Toca el enlace del mensaje enviado; si Telegram pregunta si quieres abrirlo, «Abrir».
Esperado: la página, con su recuadro grande. Mira la línea «Dentro del navegador de Telegram (TelegramWebviewProxy)»:
- `sí`: se abrió en el navegador interno de Telegram, que es lo que hay que medir. Anota también qué se ve arriba (la barra de Telegram con su ✕).
- `no`: Telegram la abrió fuera de su navegador: en una pestaña de Chrome (barra con la dirección y, en su menú ⋮, «Abrir en Chrome») o en otro navegador. Anota cuál.

En la Terminal B sale `POST /resultado -> 201 resultado-<n>.json`.

- [ ] **P6, paso 21 (persona responsable): captura de Telegram**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`). Con la página en la pantalla.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p6-telegram.png
adb pull /data/local/tmp/p6-telegram.png .\sesion-3\p6\
adb shell rm /data/local/tmp/p6-telegram.png
```

Qué hace y qué debe salir: como en el paso 11, con `p6-telegram.png`. Si en el paso 20 salió `sí`, sáltate los pasos 22 a 25.

- [ ] **P6, paso 22 (persona responsable, opcional; solo si en el paso 20 salió `no`): abrir los enlaces dentro de Telegram**

Es opcional: si prefieres no cambiar el ajuste, sáltate los pasos 22 a 25 y sigue en el 26. El navegador interno de Telegram queda «sin medir» y el análisis lo acepta así.

⚠️ Este ajuste es de la cuenta de Telegram: cambia también en los demás dispositivos con esa cuenta. Lo devuelves en el paso 25.

📍 En el teléfono. Telegram → Ajustes → Ajustes de chat → la opción del paso 18: elige que los enlaces se abran dentro de Telegram (navegador integrado).
Esperado: la opción cambiada.

- [ ] **P6, paso 23 (persona responsable; solo si hiciste el 22): abrir otra vez el enlace**

📍 En el teléfono. En «Mensajes guardados», toca otra vez el enlace del paso 20.
Esperado: la página con `sí` en «Dentro del navegador de Telegram». Si sigue en `no`, avisa a Claude con lo que ves.

- [ ] **P6, paso 24 (persona responsable; solo si hiciste el 22): captura del navegador interno**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell screencap -p /data/local/tmp/p6-telegram-interno.png
adb pull /data/local/tmp/p6-telegram-interno.png .\sesion-3\p6\
adb shell rm /data/local/tmp/p6-telegram-interno.png
```

Qué hace y qué debe salir: como en el paso 11, con `p6-telegram-interno.png`.

- [ ] **P6, paso 25 (persona responsable; solo si hiciste el 22): devolver el ajuste de Telegram**

📍 En el teléfono. Telegram → Ajustes → Ajustes de chat → la opción del paso 18: déjala como estaba (como en la captura `p6-telegram-ajuste.png`).
Esperado: el ajuste como al principio.

- [ ] **P6, paso 26 (persona responsable): anotar las versiones de los navegadores y del WebView**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

⚠️ La sexta línea borra del teléfono el archivo temporal que crea la cuarta, cuando la quinta ya lo copió al portátil.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'for p in com.android.chrome com.sec.android.app.sbrowser com.mi.globalbrowser com.android.browser org.telegram.messenger org.telegram.messenger.web com.google.android.webview; do echo == $p; dumpsys package $p | grep versionName; done > /data/local/tmp/p6-versiones.txt; echo == webviewupdate >> /data/local/tmp/p6-versiones.txt; dumpsys webviewupdate >> /data/local/tmp/p6-versiones.txt'
adb pull /data/local/tmp/p6-versiones.txt .\sesion-3\p6\
adb shell rm /data/local/tmp/p6-versiones.txt
Get-Content .\sesion-3\p6\p6-versiones.txt -TotalCount 20
```

Qué hace: la cuarta línea escribe en el teléfono, en `/data/local/tmp/p6-versiones.txt` (la carpeta temporal de adb), la versión de cada navegador (Chrome, Samsung Internet, los dos paquetes de Mi Browser, los dos de Telegram y Android System WebView) y el WebView que usan las apps; la quinta lo trae; la sexta borra el archivo temporal del teléfono; la séptima te enseña el principio. Va todo entre comillas simples porque es una orden para el teléfono, no para PowerShell.
Esperado: líneas como `== com.android.chrome` seguidas de `versionName=…` (una o dos: la instalada y la de fábrica), sin nada debajo en los paquetes que no están, y más abajo `Current WebView package (name, version): (com.google.android.webview, …)`.

- [ ] **P6, paso 27 (persona responsable; solo si algún recuadro dijo «falla»): actualizar ese navegador**

X25519 está en WebCrypto desde Chromium 133: según la tabla de compatibilidad de MDN, desde Chrome 133 y, con él, Chrome para Android, el WebView de Android y Samsung Internet 29. Un navegador con un motor anterior da `falla x25519`. En este teléfono lo más probable es Mi Browser, que trae su propio motor: Chrome y el WebView se actualizan desde Google Play, y Samsung Internet se instaló en su versión del día. La medida de la versión que venía ya está guardada (su resultado, su captura y el paso 26): ahora se repite con la versión nueva.

⚠️ Después de actualizar no se puede volver fácilmente a la versión anterior.

📍 En el teléfono, Google Play. Actualiza solo lo que falló: Chrome → «Google Chrome»; Mi Browser → su ficha en Google Play, si la tiene (si no, anótalo y no la actualices); el navegador interno de Telegram → «Android System WebView» (y Telegram, si tiene actualización). Si falló Samsung Internet, no hay nada que actualizar (ya está en la versión del día): anótalo y, si fue el único, sáltate los pasos 28 a 30.
Esperado: «Abrir» en lugar de «Actualizar». Si no había actualización, anótalo: esa versión es la última.

- [ ] **P6, paso 28 (persona responsable; solo si hiciste el 27): repetir la página en el navegador actualizado**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`). Cambia `<ETIQUETA>` y `<PAQUETE>` según el navegador: Chrome, `chrome` y `com.android.chrome`; Mi Browser, `mi` y el paquete del paso 15. Para Telegram no uses este bloque: en «Mensajes guardados» envía `http://127.0.0.1:8080/primitivas.html#telegram-act` y toca el enlace.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'am start -a android.intent.action.VIEW -d http://127.0.0.1:8080/primitivas.html#<ETIQUETA>-act -p <PAQUETE>'
```

Qué hace: abre otra vez la página, anotada con `-act` (actualizado) para no mezclarla con la primera medida.
Esperado: como en el paso 10, con el número de resultado siguiente.

- [ ] **P6, paso 29 (persona responsable; solo si hiciste el 27): captura del navegador actualizado**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`). Cambia `<ETIQUETA>`, con los signos `<` y `>`, como en el paso 28 (para Telegram, `telegram`); si se te olvida cambiarlo, el teléfono da un error y no hace nada: cámbialo y repite el bloque.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'screencap -p /data/local/tmp/p6-<ETIQUETA>-act.png'
adb pull /data/local/tmp/p6-<ETIQUETA>-act.png .\sesion-3\p6\
adb shell 'rm /data/local/tmp/p6-<ETIQUETA>-act.png'
```

Qué hace y qué debe salir: como en el paso 11, con `p6-<ETIQUETA>-act.png`. Si fallaron varios navegadores, repite los pasos 27 a 29 con cada uno.

- [ ] **P6, paso 30 (persona responsable; solo si hiciste el 27): las versiones después de actualizar**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

⚠️ La sexta línea borra del teléfono el archivo temporal que crea la cuarta, cuando la quinta ya lo copió al portátil.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb shell 'for p in com.android.chrome com.sec.android.app.sbrowser com.mi.globalbrowser com.android.browser org.telegram.messenger org.telegram.messenger.web com.google.android.webview; do echo == $p; dumpsys package $p | grep versionName; done > /data/local/tmp/p6-versiones-act.txt; echo == webviewupdate >> /data/local/tmp/p6-versiones-act.txt; dumpsys webviewupdate >> /data/local/tmp/p6-versiones-act.txt'
adb pull /data/local/tmp/p6-versiones-act.txt .\sesion-3\p6\
adb shell rm /data/local/tmp/p6-versiones-act.txt
Get-Content .\sesion-3\p6\p6-versiones-act.txt -TotalCount 20
```

Qué hace y qué debe salir: como en el paso 26, en `p6-versiones-act.txt` (también borra solo el archivo temporal del teléfono); ahora con la versión nueva del navegador que actualizaste.

- [ ] **P6, paso 31 (persona responsable): mirar las capturas antes de subirlas**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`). La Terminal B sigue con el servidor: si hay que repetir una captura, hace falta.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Invoke-Item .\sesion-3\p6
```

Qué hace: abre la carpeta `vigia-h0b\sesion-3\p6` en el Explorador de Windows. Abre cada `p6-*.png` con doble clic y mírala entera, también la parte de arriba.
Esperado: ninguna enseña una notificación ni un aviso con datos de alguien (de otra app o de Telegram: quién escribe, qué dice, una llamada, un recordatorio), ni en una tira arriba ni encima de la página; los iconos pequeños de la barra de estado no importan. Si una lo enseña: ciérrala y bórrala del todo, sin pasar por la Papelera (⚠️ borrado definitivo: selecciónala en el Explorador y pulsa Mayús+Supr); vuelve a poner en el teléfono la misma pantalla (el navegador desde la lista de apps recientes, o repitiendo su paso de abrir la página; el ajuste de Telegram, como en el paso 18) y repite su paso de captura. Después mira la nueva.

- [ ] **P6, paso 32 (persona responsable): parar el servidor**

📍 Terminal B. Pulsa Ctrl+C.
Esperado: `Servidor parado.` y vuelve el cursor de PowerShell: el puerto 8080 del portátil ya está cerrado. Puedes cerrar esta ventana.

- [ ] **P6, paso 33 (persona responsable): desconectar el puerto 8080 del teléfono**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb reverse --remove tcp:8080
adb reverse --list
adb kill-server
```

Qué hace: la cuarta línea quita lo que conectó el paso 9; la quinta comprueba que no queda nada; la sexta para el servicio de adb del portátil (escuchaba en 127.0.0.1:5037, solo para el propio portátil; el próximo bloque con adb lo vuelve a arrancar solo).
Esperado: ninguna salida en la cuarta ni en la quinta.

- [ ] **P6, paso 34 (persona responsable): borrar el enlace de «Mensajes guardados» y las visitas del historial**

📍 En el teléfono, en Telegram → «Mensajes guardados». Mantén pulsado el mensaje con el enlace del paso 20 → «Eliminar» y confirma. Si enviaste también el de `#telegram-act` (paso 28), bórralo igual. Después, en Chrome: ⋮ → Historial, y borra las entradas de `127.0.0.1:8080`; si usaste Mi Browser, lo mismo en su historial.
Esperado: los mensajes del enlace ya no están, y las visitas a `127.0.0.1:8080` ya no salen en el historial (con la sincronización de Chrome activada, se borran también de la cuenta). Al ser tu propio chat, se borran también de la nube de Telegram y de los demás dispositivos de la cuenta.

- [ ] **P6, paso 35 (persona responsable): quitar «No molestar»**

📍 En el teléfono, en los ajustes rápidos: desactiva «No molestar».
Esperado: ya no sale el icono de la luna.

- [ ] **P6, paso 36 (persona responsable, opcional; solo si instalaste Samsung Internet en el paso 12): desinstalar Samsung Internet**

Es opcional: si prefieres conservarla, sáltate este paso.

⚠️ Borra Samsung Internet del teléfono con todos sus datos (también el historial de esta prueba). Si después hiciera falta repetir P6, se vuelve a instalar desde Google Play (paso 12).

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb uninstall com.sec.android.app.sbrowser
adb shell pm path com.sec.android.app.sbrowser
adb kill-server
```

Qué hace: la cuarta línea desinstala Samsung Internet; la quinta pregunta si sigue instalado; la sexta para el servicio de adb del portátil (escuchaba en 127.0.0.1:5037, solo para el propio portátil; el próximo bloque con adb lo vuelve a arrancar solo).
Esperado: `Success` en la cuarta y nada en la quinta.

- [ ] **P6, paso 37 (persona responsable): juntar los resultados con las capturas**

📍 Terminal A (tu usuario; el bloque entra en `vigia-h0b`).

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Copy-Item .\p6\resultado-*.json .\sesion-3\p6\
Get-ChildItem .\sesion-3\p6 | Select-Object Name, Length
```

Qué hace: copia los resultados que guardó el servidor (`resultado-1.json`, `resultado-2.json`…) a la carpeta de la sesión, junto a las capturas, y la lista.
Esperado: al menos `resultado-1.json` a `resultado-3.json`, `p6-chrome.png`, `p6-samsung.png`, `p6-telegram-ajuste.png`, `p6-telegram.png` y `p6-versiones.txt`, más lo de Mi Browser, Telegram interno y `-act` si hiciste esos pasos (y un resultado más por cada página que volviste a abrir en el paso 31). Ningún archivo con tamaño 0.

- [ ] **P6, paso 38 (persona responsable): subir la carpeta a code-server**

📍 En el navegador del portátil, en code-server. En el explorador de la izquierda, clic derecho sobre la carpeta `…/telefono/sesion-3/p6` que te dio Claude → «Upload…». En el diálogo, entra en `C:\Users\<tu usuario>\vigia-h0b\sesion-3\p6`, selecciona todos los archivos (Ctrl+A) y «Abrir». No abras ninguno en el editor.
Esperado: los archivos aparecen dentro de `p6` en code-server. Avisa a Claude de que ya están.

**Comprobación final de P6 (persona responsable):** en la Terminal A, `Get-ChildItem .\sesion-3\p6 | Measure-Object | Select-Object Count` da el mismo número de archivos que ves en code-server dentro de `telefono/sesion-3/p6`; la Terminal B ya no tiene el servidor, el teléfono ya no tiene «No molestar» y en «Mensajes guardados» ya no está el enlace.

##### Análisis de Claude después de P6

- [ ] **P6, paso 39 (Claude): comprobar lo subido**

📍 Máquina de trabajo.

Ejecutar:

```sh
find <intercambio>/telefono/sesion-3/p6 ! -type f ! -type d | wc -l
ls -l <intercambio>/telefono/sesion-3/p6
```

Esperado: `0` (solo archivos: ningún enlace) y la lista del paso 37. Si la primera no da 0, no se lee nada y se pregunta a la persona responsable.

- [ ] **P6, paso 40 (Claude): el análisis**

📍 Máquina de trabajo (biblioteca estándar, `python3 -I`; los datos se pasan como argumento).

Ejecutar:

```sh
python3 -I -B <banco>/p6/analizar.py <intercambio>/telefono/sesion-3/p6 > <intercambio>/resultados/sesion-3-p6.md; echo "salida: $?"
cat <intercambio>/resultados/sesion-3-p6.md
```

Esperado: `salida: 0` y el informe en markdown. Por ejemplo, para una sesión con Chrome bien, Samsung Internet en su versión del día, Mi Browser con X25519 en ✗ y después actualizado, y Telegram abierto primero en una pestaña de Chrome y luego en su navegador (los datos de la prueba `test_sesion_completa…` de `prueba_analizar.py`, con la carpeta llamada `p6`):

```markdown
# P6 en el teléfono: p6

| Archivo | Navegador anotado | Navegador (userAgent) | Motor | Seguro | X25519 | AES-GCM | HKDF | ECDSA | ADTS |
|---|---|---|---|---|---|---|---|---|---|
| resultado-1.json | chrome | Chrome 141 | Chromium 141 | sí | ✓ | ✓ | ✓ | ✓ | ✓ |
| resultado-2.json | samsung | Samsung Internet 29.0 | Chromium 136 | sí | ✓ | ✓ | ✓ | ✓ | ✓ |
| resultado-3.json | mi | Mi Browser 14.2.2-gn | Chromium 112 | sí | ✗ | ✓ | ✓ | ✓ | ✓ |
| resultado-4.json | telegram | Chrome 141 | Chromium 141 | sí | ✓ | ✓ | ✓ | ✓ | ✓ |
| resultado-5.json | telegram | Telegram, navegador interno | WebView 141 | sí | ✓ | ✓ | ✓ | ✓ | ✓ |
| resultado-6.json | mi-act | Mi Browser 14.40.1-gn | Chromium 136 | sí | ✓ | ✓ | ✓ | ✓ | ✓ |

Errores de las primitivas:
- resultado-3.json, x25519: Algorithm: Unrecognized name.

## Versiones (dumpsys)

| Paquete | Al empezar | Tras actualizar |
|---|---|---|
| com.android.chrome | 141.0.7390.122 | 141.0.7390.122 |
| com.sec.android.app.sbrowser | 29.0.0.12 | 29.0.0.12 |
| com.mi.globalbrowser | 14.2.2-gn | 14.40.1-gn |
| com.android.browser | no está | no está |
| org.telegram.messenger | 12.8.0 | 12.8.0 |
| org.telegram.messenger.web | no está | no está |
| com.google.android.webview | 141.0.7390.122 | 141.0.7390.122 |
| WebView activo (webviewupdate) | com.google.android.webview 141.0.7390.122 | com.google.android.webview 141.0.7390.122 |

## Capturas

- 7 capturas PNG: p6-chrome.png, p6-mi-act.png, p6-mi.png, p6-samsung.png, p6-telegram-ajuste.png, p6-telegram-interno.png, p6-telegram.png

## Veredicto

- Chrome: Chrome 141, 5 de 5 ✓ (resultado-1.json).
- Samsung Internet: Samsung Internet 29.0 (Chromium 136), 5 de 5 ✓ (resultado-2.json).
- Telegram abrió el enlace fuera de su navegador en resultado-4.json (userAgent de Chrome 141): mira su captura y el ajuste del navegador de Telegram.
- Navegador interno de Telegram: Telegram, navegador interno (WebView 141), 5 de 5 ✓ (resultado-5.json).
- Mi Browser: Mi Browser 14.2.2-gn (Chromium 112), falla x25519 (resultado-3.json); tras actualizar: Mi Browser 14.40.1-gn (Chromium 136), 5 de 5 ✓ (resultado-6.json).
- P6 en el teléfono: completo (Chrome, Samsung Internet y el navegador interno de Telegram).
- X25519 en WebCrypto hoy (última medida de cada navegador): ✓ en Chrome (Chromium 141), Samsung Internet (Chromium 136), el navegador interno de Telegram (WebView 141) y Mi Browser (Chromium 136).
- Primitivas: ✓ en todos los navegadores en su última medida; antes de actualizar, falla x25519 en Mi Browser 14.2.2-gn.
```

El veredicto, y lo que sigue a cada caso:
- `P6 en el teléfono: completo (…)` y `Primitivas: ✓ en todos los navegadores en su última medida.`: P6 cumple en el teléfono. El informe (tarea 16) lo anota con el navegador, su motor y la versión mayor de Chromium; las versiones exactas se quedan en `<intercambio>/resultados`. Si hubo `antes de actualizar, falla …`, anota además que ese navegador sin actualizar no tiene X25519 (en VE los habrá).
- `X25519 en WebCrypto hoy (…)`: es lo que la tarea 16 lleva al informe, qué navegadores medidos lo tienen hoy y con qué motor. Donde no lo hay, la bóveda usa el respaldo con `@noble/curves` que ya fija H4, declarado (con él, la clave del contacto es extraíble en ese navegador). El motor a partir del cual hay X25519 sale de la documentación (paso 27), no de esta sesión.
- `Primitivas: ✗ en su última medida: …`: si es `x25519`, ni actualizado lo tiene: ese navegador usará el respaldo de H4, y el informe lo declara. Si es otra primitiva (`aesgcm`, `hkdf`, `ecdsa` o `adts`), el plan maestro no le da respaldo: pasa a la tarea 16 para decidirlo con la persona responsable.
- `P6 en el teléfono: completo (Chrome, Samsung Internet y el enlace desde Telegram, …)`, con `Navegador interno de Telegram: sin medir (…)`: no se cambió el ajuste de Telegram (el paso 22 es opcional) o, cambiado, el enlace no se abrió dentro. Se acepta así, y el informe lo declara como sin medir.
- `P6 en el teléfono: incompleto, falta …`: se repite lo que falta en otra tanda: pasos 6 a 9, los de abrir y capturar ese navegador (10 y 11 para Chrome, 13 y 14 para Samsung Internet, 20 y 21 para el enlace desde Telegram) y 31 a 38 (el 34 y el 36, si tocan).
- `✗ resultado-<n>.json: contexto no seguro…`: esa medida no vale (se abrió por otra dirección que `127.0.0.1`): se repite ese navegador.
- `✗ resultado-<n>.json: la etiqueta … no cuadra con el userAgent`: se abrió otro navegador del anotado: se mira su captura y se repite.

- [ ] **P6, paso 41 (Claude): mirar las capturas**

📍 Máquina de trabajo. Claude abre cada `p6-*.png` de `<intercambio>/telefono/sesion-3/p6` (Read) y comprueba que el recuadro grande y las líneas de cada captura dicen lo mismo que la fila de su resultado, que `p6-telegram.png` (o `p6-telegram-interno.png`) enseña la barra del navegador de Telegram si su resultado dice `Telegram, navegador interno`, y qué opción se ve en `p6-telegram-ajuste.png`. Lo anota al final de `<intercambio>/resultados/sesion-3-p6.md`. Si una captura enseña una notificación o un aviso con datos de alguien (quién escribe o qué dice), Claude no transcribe nada de ella: la borra de `<intercambio>/telefono/sesion-3/p6`, anota solo «captura con una notificación, borrada» y pide a la persona responsable que repita esa medida (como en el caso `incompleto` del paso 40).
Esperado: cada captura coincide con su fila. Si una no coincide, esa medida se repite.

**Notas:**

- **Nota:** nada de esto se ha probado con el teléfono ni en Windows. Lo validado (14-oct-2026) es el servidor con PowerShell 7.5 en Linux, la página en los tres motores de Playwright servida por ese servidor, y el análisis con datos de prueba y con los resultados reales de Playwright (tarea 10). Que `adb reverse` lleve al `127.0.0.1` IPv4 del portátil, el texto exacto de los menús de Telegram, de Samsung Internet y de Mi Browser, que `am start -p` abra cada navegador y que `screencap` y `adb pull` funcionen con `/data/local/tmp` en MIUI se ven por primera vez en esta sesión.
- **Nota:** el navegador interno de Telegram se reconoce por el puente `TelegramWebviewProxy`, que Telegram inyecta siempre en su WebView (código de Telegram Android: `BotWebViewContainer.java` y `ArticleViewer.java`); su userAgent no sirve, porque Telegram lo reescribe para que parezca el de Chrome. Las mini apps añaden además `Telegram-Android/<versión>`; el navegador de enlaces, no.
- **Nota (DAT-01):** las capturas y los resultados solo tienen la página de prueba, el navegador y sus versiones (el userAgent de Mi Browser lleva el modelo del teléfono); se quedan en la carpeta de intercambio, con las versiones exactas. Al informe del repo van solo el navegador, su motor y la versión mayor de Chromium, y el ✓ o ✗ de cada primitiva. El análisis no imprime el userAgent. Una captura con una notificación o un aviso de otra app no se sube ni se transcribe: se borra y se repite (pasos 31 y 41).

#### Cierre de la sesión 3 (después de las dos partes)

Cuando las dos partes estén hechas y analizadas. Deja el teléfono como estaba antes de la sesión 1: sin el banco y sin los ajustes de desarrollador. El tramo B instalará su propio APK y volverá a activar lo que necesite.

- [ ] **Cierre, paso 1 (Claude): confirmar que no hay que repetir nada**

Sin orden: los análisis de las tres sesiones (tareas 13, 14 y 15) están hechos y ninguno pide repetir una prueba con el teléfono. Si alguno lo pide, se repite antes de este cierre, con el mismo APK.
Esperado: Claude le dice a la persona responsable que puede cerrar.

- [ ] **Cierre, paso 2 (persona responsable): desinstalar el banco**

⚠️ Borra la app y todos sus datos del teléfono (las grabaciones cifradas, las llaves del Keystore del banco y los resultados), que ya están sacados, subidos y analizados. Si después hiciera falta repetir algo, se vuelve a instalar el mismo APK (tarea 13, pasos 14, 15 y 53).

📍 PowerShell en tu portátil, en `vigia-h0b`, con el teléfono conectado por USB.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
adb uninstall dev.banco.prueba
adb shell pm list packages dev.banco.prueba
adb kill-server
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta desinstala el banco; la quinta busca si sigue instalado; la sexta para el servicio de adb del portátil.
Esperado: `Success` y ninguna línea en la quinta. Si la cuarta dice `Unknown package`, ya no estaba: sigue.

- [ ] **Cierre, paso 3 (persona responsable): quitar la autorización del portátil y apagar los ajustes de desarrollador**

📍 En el teléfono. Ajustes → Ajustes adicionales → Opciones de desarrollador:
1. Toca «Revocar autorizaciones de depuración USB» y acepta.
2. Desactiva «Depuración USB (ajustes de seguridad)», «Instalar vía USB» y «Depuración USB».
3. Arriba del todo, desactiva las opciones de desarrollador.

Esperado: la pantalla de opciones de desarrollador desaparece de Ajustes adicionales. Desconecta el cable.

- [ ] **Cierre, paso 4 (persona responsable): borrar las copias del portátil que queden**

⚠️ Borra del portátil las carpetas de las sesiones y de P6, con las grabaciones cifradas, las capturas y los resultados. Todo eso ya está en `<intercambio>`. Se quedan `platform-tools`, los APK, el zip de adb y la pista de clics.

📍 PowerShell en tu portátil, en `vigia-h0b`.

```powershell
$h0b = Join-Path $HOME 'vigia-h0b'
$env:Path = "$h0b\platform-tools;$env:Path"
Set-Location $h0b
Remove-Item -Recurse -Force '.\sesion-1', '.\sesion-1-r8', '.\sesion-2-ensayo', '.\sesion-2', '.\sesion-3', '.\p6' -ErrorAction SilentlyContinue
Get-ChildItem | Select-Object Name
```

Qué hace: las tres primeras líneas preparan la ventana; la cuarta borra esas carpetas (las que ya no estén, las salta); la quinta lista lo que queda.
Esperado: en la lista ya no salen `sesion-1`, `sesion-1-r8`, `sesion-2-ensayo`, `sesion-2`, `sesion-3` ni `p6`. Dile a Claude que la sesión 3 está cerrada.

---

### Tarea 16: Informe del tramo A, cambios a DESIGN.md, revisión final y parada para `f2-h0b-a`

**Archivos (repo de Vigía):**
- Modificar: `docs/pico/informe.md` (secciones del tramo A, "Decisiones del tramo A", "Audio subido", "Para H2" y "Queda para los tramos B y C"; la fila de `iproute2` de "Versiones fijadas (H0b)" ya la puso la tarea 2) y `DESIGN.md` (decisiones 75 a 80 y sus remisiones en "Bases locales", "Formato de audio", "Envoltura", la lista de pruebas de `shared` y "Riesgos abiertos").
- Fuera del repo: ninguno nuevo. Se leen `<intercambio>/resultados/`, `/work/h0b/salida/apk/`, `/work/h0b/p5/pesos/` y `/work/h0b/p7/resultados/`.

**Interfaces:**
- Consume:
  - Tarea 13: `sesion-1-info.txt`, `sesion-1-p2.txt`, `sesion-1-p5-firmas.txt`, `sesion-1-p5-sellado.txt`, `sesion-1-p5-tiempos.txt`, `sesion-1-r8-p5-sellado.txt` y `sesion-1-r8-p5-tiempos.txt`; los tamaños de `/work/h0b/salida/apk/*/tamaños.txt` (su paso 1).
  - Tarea 14: `sesion-2-ensayo.json`, `sesion-2-p3.json` y `sesion-2-codificadores.json`.
  - Tarea 15: `sesion-3-p4-a.json`, `sesion-3-p4-b.json`, `sesion-3-p4-a-audio.json`, `sesion-3-p4-b-audio.json` y `sesion-3-p6.md`.
  - Tarea 11: `/work/h0b/p7/resultados/` (`d2`, `d4`, `d8` y, si hubo plan B, `d8-b`, en `.csv` y `.log`), y en `<intercambio>/resultados/`, `p7-calibracion.txt` (la calibración de la red) y `p7.txt` (el veredicto de `p7.sh analizar`).
  - Tarea 12: `<intercambio>/resultados/ooni-<fecha>.md`.
  - Tarea 9: los pesos de BouncyCastle y Tink con R8 (`pesos.sh`, su paso de pesos) y el tamaño de `paquete450` dentro del APK (unos 7,44 MB).
  - Las reglas de decisión de la cabecera de este plan.
- Produce: `docs/pico/informe.md` con el tramo A, los cambios a DESIGN.md y, con la aprobación de la persona responsable, la etiqueta `f2-h0b-a`, que deja empezar H2.

- [ ] **Paso 1 (Claude): reunir los resultados y ver que no falta ninguno**

📍 Máquina de trabajo.

Ejecutar:

```sh
cd <intercambio>/resultados && for f in sesion-1-info.txt sesion-1-p2.txt sesion-1-p5-firmas.txt sesion-1-p5-sellado.txt sesion-1-p5-tiempos.txt sesion-1-r8-p5-sellado.txt sesion-1-r8-p5-tiempos.txt sesion-2-ensayo.json sesion-2-p3.json sesion-2-codificadores.json sesion-3-p4-a.json sesion-3-p4-b.json sesion-3-p4-a-audio.json sesion-3-p4-b-audio.json sesion-3-p6.md p7-calibracion.txt p7.txt; do [ -s "$f" ] && echo "está: $f" || echo "FALTA: $f"; done; ls ooni-*.md
```

Esperado: `está: …` en todos y al menos un `ooni-<fecha>.md`. Si falta alguno, se vuelve a la tarea que lo produce (su sección de análisis) antes de seguir: el informe no se escribe con huecos que se puedan medir.

- [ ] **Paso 2 (Claude): aplicar las reglas de decisión**

Sin orden: se escribe en `<intercambio>/resultados/decisiones-tramo-a.md` (fuera del repo) una tabla con una fila por regla de la cabecera de este plan: la cifra que la decide (con el archivo y la línea de donde sale), el resultado de la regla y la decisión que sale de él. Las cifras se copian de los archivos de resultados tal cual; nada se recalcula a mano. Si una regla no se puede aplicar (falta la cifra, o el resultado cae justo en el umbral), la fila dice "pendiente de la persona responsable" y el porqué, y se le pregunta en este mismo paso, con una recomendación, antes de escribir el informe; su respuesta se anota en la fila con su fecha.

Comprobación: `grep -c '^|' <intercambio>/resultados/decisiones-tramo-a.md` da 11 (la cabecera, la línea de separación y las 9 reglas).

- [ ] **Paso 3 (Claude): escribir el informe del tramo A**

Se añaden a `docs/pico/informe.md`, antes de "Queda para H0b" (que se sustituye en este mismo paso), estas secciones, cada una con pregunta, medición, resultado y decisión, en el estilo de las de H0a:

1. `## Teléfono de pruebas`: fabricante, modelo, Android y SDK, ABIs, RAM y StrongBox, de `sesion-1-info.txt`. Nada que lo identifique ni que diga de quién es: ni número de serie, ni cuentas, ni versión de MIUI con su número de compilación, ni versiones de las apps.
2. `## P1. Compilación (parte del teléfono)`: el APK del commit del banco instalado con adb desde Windows y abierto en modo avión; los tamaños de los seis APK (sin R8 y con R8) y cada uno también sin `paquete450` (los 7,44 MB del paquete sintético de P5), diciendo qué lleva el banco que no llevará la app de producto (ese paquete y el código de las pruebas).
3. `## P2. SQLCipher y FTS5 juntos`: los tres puntos de la autoprueba y la tabla de la cola (p50, p95 y máximo de escribir y de leer de las tres opciones), de `sesion-1-p2.txt`. El corpus es sintético con forma de ley (1 060 documentos y 908 776 bytes), no el borrador VE, que llega en H2.
4. `## P3. Grabación de 30 min`: códec, AudioSpecificConfig, kb/s, desfase máximo y saltos de las muestras frente al tiempo, clics detectados y esperados con su error máximo, la deriva, los otros sonidos y los golpes (`criterios.clics`); el arranque más lento de los 20 y el de cada grabación iniciada, contra 2 s (`criterios.arranques.grabacion_ms` de cada JSON de grabación); los codificadores AAC del teléfono, de `sesion-2-codificadores.json`; y la fuente (`MIC` o `VOICE_RECOGNITION`, `resumen.fuente`), de `sesion-2-p3.json`.
5. `## P4. Servicio en segundo plano, sin subida`: por configuración (A, MIUI como viene; B, «Sin restricciones» e «Inicio automático»), latidos y hueco máximo, latidos en Doze, cierre, si el audio siguió entrando en Doze (con la lectura de la tarea 15) y el motivo de `exit-info` si el sistema mató el proceso. Todo provisional hasta P4 con subida (tramo B, sin el cable); "batería: sin medir (tramo B)".
6. `## P5. Interoperabilidad criptográfica y Keystore (teléfono)`: sellado abierto en la máquina sin R8 y con R8, firmas DER verificadas en WebCrypto, latencias de TEE (y de StrongBox, o "no disponible"), Hermes, los 72 vectores con noble y con Kotlin, los tiempos del verificador por variante con y sin `K` (la cota en Kotlin puro, como cota inferior), y los pesos con R8 de la tarea 9 (BouncyCastle y Tink, optimizado y con `-dontoptimize`).
7. `## P6. Navegadores reales`: tabla navegador × primitiva con ✓ o ✗, con el motor y la versión mayor de Chromium de cada navegador y del WebView (como venía y, si se actualizó, después). Samsung Internet se midió en la versión de Google Play del día; el navegador interno de Telegram puede quedar "sin medir" (se declara); Safari iOS, "sin medir". La línea "X25519 en WebCrypto hoy (última medida de cada navegador)" de `sesion-3-p6.md` es la que pide la regla. Las versiones exactas se quedan en `<intercambio>/resultados`.
8. `## P7. Duración del fragmento (máquina)`: el perfil de netem (300 ± 100 ms y 3 % de pérdida en cada sentido, 96 kbit/s de subida y 1 Mbit/s de bajada, sin GSO ni reordenamiento) y las cifras de la calibración, de `p7-calibracion.txt`, y "sin reordenamiento" con los contadores de TCP del final del registro de cada tanda; un bloque por duración (la cola del minuto 1 y la del 30, el porcentaje del tiempo con retraso de 2 fragmentos o menos, los acuses y los fallos) y la duración elegida, de `p7.txt`, provisional hasta P7 en el teléfono (tramo B), porque la máquina no incluye la latencia del servidor de producción ni la firma en el Keystore de cada intento, y las dos favorecen a las duraciones cortas; qué es "la cola del minuto" (lo que no llega a vaciarse en ese minuto) y cómo se mide el retraso; el ajuste del cliente HTTP (conexiones de 3 s en reposo y repetir la petición si el servidor ya cerró la conexión, que el cliente de H3a también necesita); y la excepción a OPS-03 (decisión 5), con el servidor de vuelta de Miniflare que escucha en la IP de `vigia-p7`
9. `## P8. Venezuela (datos públicos de OONI)`: la tabla de `ooni-<fecha>.md` con su leyenda (las columnas por IP de Google, Cloudflare y Quad9, y las notas "nombre: <tipo>" de un fallo de arranque por nombre), su ventana de fechas (días, sin horas) y el hueco de `mtalk.google.com` (OONI no lo mide).
10. `## Decisiones del tramo A`: la tabla del paso 2, sin las columnas de archivo y línea, con la nota de que las reglas que dependen de `D` valen para fragmentos de 4 s.
11. `## Audio subido (DAT-01)`: cuántas grabaciones y cuánto duró cada una (el ensayo de 1 min y la de 30 min de la sesión 2; las dos de 30 min de la sesión 3), con los otros sonidos y los golpes de cada una (`criterios.clics`, la cifra que respalda "sala sin voces"); que fueron de una sala sin voces con una pista de clics sintética, que salieron del teléfono cifradas y que solo se descifraron en un contenedor sin red, en memoria; y si alguna se borró y se repitió por indicios de voces.
12. `## Para H2`: pasar el APK a `proguard-android-optimize.txt` (con la cifra de BouncyCastle de la tarea 9), revisar `sqlite3_enable_load_extension` en op-sqlite, las globales de Hermes que usa el verificador elegido, repetir con el pack VE la búsqueda de "detencion" y la reconstrucción de `legal.db`, que la app salga de una plantilla fijada con su lockfile (lo de H0a) y si la imagen de producto incluye `noble-security`, que falta en la instantánea de apt de H0a.
13. `## Queda para los tramos B y C` (sustituye a "Queda para H0b"): B, la cuenta endurecida, los hosts neutros (decisión 74), P9, P4 con subida y batería (con y sin ubicación), P7 en el teléfono (la duración definitiva y, con ella, qué duraciones se prueban en los 3 fabricantes de H8b; si cambia, se recalculan las reglas que dependen de `D`) y P6 en el host HTTPS; C, P8 con la persona en VE (el canal principal en VE). Al cerrar H0b: borrar las grabaciones cifradas de la carpeta de intercambio (el banco ya se desinstaló del teléfono al acabar la sesión 3).

En "Versiones fijadas (H0b)" se añaden las filas de `@noble/hashes`, `@noble/curves` y `@noble/ciphers` 2.4.0 (con su integrity de la tarea 9), Tink 1.23.0 con su SHA-256 (solo para medir el peso) y la imagen de PowerShell 7.5.0 por digest (solo para validar `servidor.ps1`). En "Página de presentación (WEB-01)", "6 de 6 pruebas" pasa a "9 de 9 pruebas (con los iconos de la marca, 14-oct-2026)", y la CSP lleva `img-src 'self'`.

- [ ] **Paso 4 (Claude): comprobar que el informe no lleva lo que no debe**

📍 Máquina de trabajo, en `<repo>`.

Ejecutar:

```sh
git diff -U0 docs/pico/informe.md | grep '^+' | grep -n -E '[0-9]{1,2}:[0-9]{2}|/root|/work|/tmp|/sdcard|/data/local|intercambio|workers\.dev|pages\.dev|serial|IMEI|userAgent|Mozilla/' ; echo "coincidencias: $?"
```

Esperado: `coincidencias: 1` (ninguna línea). Una coincidencia legítima de la primera (por ejemplo, "workers.dev" en la tabla de OONI, que es el dominio genérico y no un host de Vigía) se mira y se deja; una hora, una ruta, un número de serie o un userAgent se quitan. Las horas de los JSON nunca van al informe; las fechas, solo como día. Los nombres de quienes participan los para el hook de pre-commit del paso 5, que compara cada palabra y cada frase de hasta 4 palabras con la lista privada de huellas, con los nombres también sueltos (decisión de integración 23).

- [ ] **Paso 5 (Claude): commit del informe**

📍 Máquina de trabajo, en `<repo>`.

```sh
git add docs/pico/informe.md && git diff --cached --stat
git commit -m "Informe del pico: tramo A de H0b (teléfono y máquina)" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Esperado: `1 file changed`, los hooks sin hallazgos (`no leaks found`) y el commit hecho. Si un hook rechaza el commit, se arregla el texto que señala y se repite; nunca `--no-verify`.

- [ ] **Paso 6 (Claude): DESIGN.md, las decisiones 75 a 80**

Se añaden a la tabla de decisiones, después de la 74, con la fecha del día y el texto que corresponda al resultado de cada regla (paso 2):

| Nº | Nombre | Si la regla sale como se espera | Si no |
|---|---|---|---|
| 75 | Formato de audio | Confirma "Formato de audio" y la 20: AAC-LC mono a 16 kHz, con las kb/s medidas en 30 min, el códec y la fuente | Lo que diga la regla según el criterio que falló: la tasa o el codificador del plan B, o lo que decida la persona responsable |
| 76 | Cola de sobres | Detalla "Bases locales" y la 53: cada sobre es un archivo cifrado con el Keystore (o con una clave de datos que el Keystore envuelve una vez), con escritura atómica (temporal, fsync, renombrado y fsync de la carpeta); `vault.db` no guarda la cola. Válida para fragmentos de 4 s: si el tramo B fija otra duración, se recalcula con las mismas medidas | La cifra que la descartó y la opción elegida |
| 77 | HPKE en el teléfono | BouncyCastle 1.86, la del núcleo de H1, con su peso con R8 | Lo que decida la persona responsable con el plan B de P5 |
| 78 | Verificador de la app | Dónde verifica la app (JS con noble, o `verificarPaquete` con las primitivas de Kotlin) y su tiempo para 30 min con `K`; si es con Kotlin, la frase "un único código" de la lista de pruebas de `shared` dice cuál. Válida para fragmentos de 4 s | Ninguna bajó de 5 s (o solo la cota en Kotlin puro, que es una cota inferior): la cifra, declarada, y lo que decida la persona responsable |
| 79 | Firma de las subidas | La llave de firma en TEE o en StrongBox, con su p95; el PUT de un fragmento lleva firma de petición, o no la lleva y le basta `s`. Válida para fragmentos de 4 s | Las dos salidas de la regla valen |
| 80 | Respaldo X25519 | Confirma H4 con las medidas de P6: la bóveda usa WebCrypto X25519 donde el navegador lo tiene y, donde no, el respaldo con `@noble/curves`, declarado (la clave del contacto es extraíble en ese navegador); qué navegadores medidos lo tenían, con su motor y su versión mayor | No aplica: lo decide H4 |

Y las remisiones: en "Bases locales", la frase "y, si el pico lo confirma, la cola de sobres (si no, archivos cifrados con una clave del Keystore)" pasa a remitir a la 76; en "Formato de audio", "Se valida en el pico técnico de F2" pasa a "Medido en el pico (decisión 75); la duración del fragmento sigue provisional hasta el tramo B (decisión 29)"; en "Envoltura", la librería de la 77; en la lista de pruebas de `shared`, "si la app verifica en Kotlin, lo decide el pico" pasa a lo que diga la 78; y en "Riesgos abiertos", "Pico técnico de F2" queda en lo que falta: la duración del fragmento en el teléfono y el consumo con la ubicación (tramo B), y Web Push y DNS en VE (tramo C). Las filas que quedaron pendientes en el paso 2 se escriben con la respuesta que dio la persona responsable.

Comprobación: `grep -c -E '^\| (75|76|77|78|79|80) \|' DESIGN.md` da 6; `grep -o -E '^\| (7[3-9]|80) \|' DESIGN.md` las da de la 73 a la 80, en orden. El hook de pre-commit del paso 7 hace con DESIGN.md la comprobación de nombres del paso 4.

- [ ] **Paso 7 (Claude): commit de DESIGN.md**

📍 Máquina de trabajo, en `<repo>`.

```sh
git add DESIGN.md && git diff --cached --stat
git commit -m "DESIGN.md: decisiones 75 a 80, del tramo A del pico" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Esperado: `1 file changed` y los hooks sin hallazgos.

- [ ] **Paso 8 (Claude): revisión final con verificación adversarial**

Un workflow de revisión (como el de H1) con dos revisores y un escéptico por hallazgo. Uno compara cada cifra del informe y de DESIGN.md con su archivo de resultados y cada decisión con su regla. El otro mira la privacidad (el paso 4 otra vez, más lo que el grep no ve: un modelo, una versión o un detalle que identifique a alguien, una descripción del audio) y comprueba dos cosas:
- que nada del banco ha entrado al repo: `git diff --stat "$(git log --format=%H -1 --grep='^Lleva a DESIGN.md y al plan maestro las decisiones de H0b')^"..HEAD` (desde el commit anterior al de la tarea 1) solo lista `DESIGN.md`, el plan maestro, este plan (`docs/plan/2026-10-14-h0b-a-pico-telefono.md`), `.gitignore`, `entorno/Dockerfile`, `packages/nucleo/gradle/verification-metadata.xml` y `docs/pico/informe.md`;
- que ningún proceso automático de memoria, resumen o indexado de la máquina ha recogido nada de `<intercambio>` ni de `<privada>` (ENV-01): con sus rutas reales, de `h0b-entorno.md`, Claude busca las dos en lo que guarden esos procesos, si los hay, y da 0 coincidencias.

Cada hallazgo confirmado se arregla con su commit; los menores se anotan para la persona responsable.

- [ ] **Paso 9 (Claude): parar y presentar el tramo A a la persona responsable**

Sin orden: un resumen con las decisiones que salen de las reglas y las que tomó la persona responsable en el paso 2, lo que queda para B y C, y los commits que publicará el push (`git log --oneline origin/main..HEAD`, que incluye los del favicon si aún no se han publicado). No se etiqueta ni se publica nada sin su aprobación.

- [ ] **Paso 10 (Claude, con la aprobación de la persona responsable): la etiqueta `f2-h0b-a`**

📍 Máquina de trabajo, en `<repo>`.

```sh
git tag -a f2-h0b-a -m "H0b, tramo A: pico en el teléfono y en la máquina, sin Cloudflare"
git show --no-patch --format='%H %s' f2-h0b-a^{commit}
```

Esperado: el commit de DESIGN.md del paso 7 (o el último arreglo del paso 8). La publica la persona responsable desde su terminal, con su token y la orden de siempre: `env -u GIT_ASKPASS git push origin 'f2-h0b-a^{commit}:refs/heads/main' 'refs/tags/f2-h0b-a'`. Después, Claude comprueba sin credenciales que `git ls-remote origin refs/heads/main refs/tags/f2-h0b-a` da el commit de la etiqueta y su objeto.

- [ ] **Paso 11 (Claude): cerrar el tramo**

Se borra `/work/h0b-plan` si queda algo (lo usó la escritura de este plan). `/work/h0b`, la imagen `vigia-build:h0a` y la de PowerShell se quedan hasta cerrar H0b (tramo B); el banco ya se desinstaló del teléfono al acabar la sesión 3. La memoria del proyecto anota `f2-h0b-a` y lo que espera al tramo B.

**Comprobación final (Claude):** el informe tiene las 13 secciones del paso 3 y ninguna coincidencia en el paso 4; DESIGN.md tiene las decisiones 75 a 80 (o las que haya decidido la persona responsable) y sus remisiones; los hooks pasaron en los dos commits; y, tras el push, `git ls-remote` muestra `main` y `f2-h0b-a` en el commit de la etiqueta.

---

## Tramos B y C (esbozo; se detallan al tener la llave)

- B0 (persona responsable): 2FA con dos llaves FIDO2 y códigos de respaldo fuera de línea; revisar miembros, tokens, Audit Logs, cron usados (máximo 5 en Free) y si R2 está activado.
- B1: tokens de cuenta con filtro de IP y caducidad (alta de 1 día; despliegue de 7 días como máximo; candado de 1 día), en archivos 600 fuera de los montajes, pasados a un contenedor efímero dedicado por la entrada estándar o por `docker exec -e` sin valor.
- B2: hosts neutros (decisión 4): proyectos de Pages Direct Upload con nombre neutro y Workers con `workers_dev: false`, `preview_urls: false` y `observability` (incluido `issues`) apagado; cada nombre real a la lista privada el mismo día.
- B3: P9 (candado de R2 en `i/`, cron de 24 h, marcador en registros y métricas, respaldo en Pages con service binding).
- B4: P4 con subida real, batería con y sin ubicación; P7 en el teléfono (3G o el punto de acceso del portátil); P6 en el host HTTPS.
- B5: infraestructura de P8 probada con los aparatos de la persona responsable. C: P8 en VE con todas sus protecciones.
