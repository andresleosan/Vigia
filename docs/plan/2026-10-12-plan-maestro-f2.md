# Plan maestro de F2: el slice de Venezuela de Vigía

> **Estado:** F1, versión con las decisiones del 12-oct-2026 (sección "Decisiones de F1"), pendiente de aprobación. No lleva código.
>
> **Para agentes:** este documento no se ejecuta tarea a tarea. Cada hito tiene su plan detallado (superpowers:writing-plans), que se escribe justo antes de construirlo y se ejecuta con superpowers:subagent-driven-development o superpowers:executing-plans.

**Objetivo:** construir hito a hito, con una parada de aprobación en cada uno, el slice VE de Vigía (app Android, Worker, bóveda web y página de presentación) hasta pasar en un Android real la aceptación de F2 de DESIGN.md.

**Arquitectura:**
- Un monorepo pnpm:
  - `packages/shared`: contratos, sobre, cadena, verificador y tipo CountryPack. No tiene dependencias de terceros y recibe la criptografía inyectada: WebCrypto en el Worker, en la bóveda y en Node.
  - `packages/packs`: VE como datos.
  - `packages/mobile`: Expo con el módulo Kotlin `recorder` (audio, sobre, firma, cola de subida, notificaciones locales y ubicación).
  - `packages/backend`: un Worker Hono con D1, R2, cron cada minuto y webhook de Telegram. Depende solo de hono y de shared.
  - `packages/boveda`: la página estática de la bóveda. Su única librería criptográfica, si hace falta, va empaquetada en sus archivos estáticos y nunca entra en las dependencias del Worker.
  - `sitio/`: la página de presentación, estática.
- El teléfono cifra, encadena y firma cada fragmento en RAM.
- El servidor guarda solo blobs opacos y devuelve acuses firmados.
- La bóveda descifra y verifica en el navegador del contacto.

**Hosts (solo gratuitos en F2):**
- `<host-api>` y `<host-bóveda>`: dos Workers con nombres neutros en el subdominio neutro de workers.dev de una cuenta dedicada. Comparten D1 y R2, y solo el de la API tiene el cron.
- `<host-respaldo>`: el mismo código como proyecto de Pages con nombre neutro (modo avanzado, con los mismos D1 y R2), en pages.dev, para que un bloqueo de todo workers.dev no deje sin respaldo. P9 comprueba que es viable.
- Página de presentación: `vigiaapp.pages.dev`, con el nombre, porque es lo que se promociona. Nunca enlaza a los hosts anteriores, y estos nunca la nombran.
- Los nombres reales de los hosts neutros viven fuera del repo.

**Stack:**
- Cloudflare Workers + Hono + D1 + R2 (cron cada minuto) y Pages (página de presentación y respaldo).
- Expo (build con el JS dentro) + op-sqlite + FTS5 + SQLCipher.
- Kotlin: AudioRecord + MediaCodec, Keystore, WorkManager, y APIs de Android para las notificaciones locales y la ubicación. No se usan expo-notifications ni expo-location, porque arrastran Firebase o Google Play Services.
- Pruebas: Vitest, JUnit en la JVM y Playwright.
- Prohibidos: Supabase, Vercel y Firebase.

**Spec:** `DESIGN.md` (F0 aprobado el 12-oct-2026) y `PRODUCT.md`, con los cambios de la sección "Cambios a DESIGN.md".

## Restricciones globales

- Grabar y consultar derechos funcionan 100 % sin red ni backend, también en una instalación que nunca tuvo red.
- Audio: AAC-LC mono a 16 kHz, unos 32 kbps (unos 14 MB por hora); fragmentos ADTS de 2 a 8 s; se parte de 4 s y el pico técnico fija el valor.
- Sobre en RAM:
  - `p = SHA-256(audio)`;
  - `ct = AES-256-GCM(K, nonce aleatorio de 96 bits, aad = "vigia/v1" ‖ tipo ‖ incidente ‖ seq)`, con la misma codificación para `loc` y los metadatos;
  - `r = {v, incidente, seq, hora_teléfono, p, c = SHA-256(ct), loc, prev = SHA-256(r_anterior)}`, con bytes canónicos;
  - `s = firma_dispositivo(r)`, con un prefijo de dominio propio.
  - Al disco solo van `ct + r + s`.
  - El origen de la cadena es un registro de apertura firmado que lleva el `country_code` del incidente.
- Claves:
  - dispositivo: ECDSA P-256 en el Keystore, no exportable;
  - incidente `K`: AES-256 en memoria nativa;
  - contacto: X25519;
  - recuperación: X25519 y Ed25519, derivadas con HKDF-SHA256 del código de 24 caracteres;
  - servidor: ECDSA P-256 como secreto del Worker, con `kid`;
  - lectura: ECDSA P-256 en el Keystore, distinta de la de firma y con `setUnlockedDeviceRequired`, solo para las lecturas firmadas;
  - envoltura local de `K` en modo base: HPKE para una pública local cuya privada se guarda cifrada con una clave que sale de HMAC_Keystore(PIN). Grabar no pide el PIN; escuchar, sí.
- Envoltura de `K`: HPKE (RFC 9180: DHKEM-X25519, HKDF-SHA256, AES-256-GCM), modo base, con `info` ligado al incidente y al rol.
- Peticiones del dispositivo: cadena canónica versionada (prefijo, método, ruta sin query, hora, idPeticion, idDispositivo y SHA-256 del cuerpo crudo), firma P1363 y hora dentro de ±5 min. Si el reloj está desfasado, se corrige con la hora del servidor sin tocar `hora_teléfono`. Las órdenes son idempotentes por estado: llevan el estado que vio la app (por ejemplo, el plazo vigente al extender), y el incidente guarda el idPeticion de la última orden aplicada de cada tipo. Solo cuenta como señal una petición con firma de petición de un teléfono no revocado.
- Acuse firmado `{prefijo, kid, SHA-256(r), hora_servidor}`. La app y la bóveda lo verifican con las claves públicas fijadas.
- "Respaldado hasta" es la hora del último fragmento del tramo contiguo con acuse válido desde la apertura, con la hora corregida por el desfase. Un acuse falso, un hueco o una cola parada nunca lo mueven.
- Cola de subida (en Kotlin): una sola cola para todo lo firmado, con prioridad fija: apertura; SOS y cancelación; desarme y extensión; cierre; latido; fragmentos. El SOS se intenta enviar al momento y, si falla, queda el primero. Backoff exponencial con jitter de 1 s a 5 min y rotación de hosts; cupos separados para órdenes, subida y lecturas en el límite por dispositivo. Tras Detener con sobres pendientes, el servicio sigue activo hasta vaciar la cola (con un tope de horas), y WorkManager cubre las muertes del servicio y los reinicios. Borra la copia local solo con un acuse válido.
- Temporizador: 30 min por defecto (15/30/60/120), recordatorio 5 min antes, extender +30 min sin PIN como mucho 2 veces seguidas (la tercera pide el PIN) y desarmar con PIN. Los fragmentos no extienden ni desarman. Una extensión sin red se muestra pendiente, y el recordatorio local usa el plazo confirmado.
- SOS: mantener 3 s y cuenta atrás de 5 s; 3 vibraciones largas cuando el servidor confirma. Sin grabación, el SOS crea la apertura de un incidente sin audio, que no arma el temporizador; cancelar el SOS con el PIN lo cierra, y Grabar con esa alerta activa continúa el mismo incidente.
- Avisos:
  - uno por incidente o teléfono y por tipo, con sus repeticiones a los 10 y a los 30 min;
  - novedades como mucho una vez cada 10 min;
  - una cancelación solo llega a quien recibió la alerta;
  - textos: "Tienes un aviso. Abre tu enlace." y "Hay novedades. Abre tu enlace.".
- Contactos: máximo 3; la invitación caduca a las 48 h; `accessId` de 128 bits. Los contactos con iPhone usan solo Telegram en F2.
- Bóveda:
  - enlace `/v/#a=…&k=…&d=…`: el `accessId`, la clave y la huella van en el fragmento, y las rutas de la API son constantes;
  - prueba de posesión: `HKDF-SHA256(k, sal fija, "vigia/v1/acceso" ‖ accessId)`, calculada una vez al leer `#k`; el servidor guarda solo su SHA-256 y nunca la pública del contacto;
  - un navegador puede ser contacto de varias personas: una entrada por `accessId` y una suscripción push compartida;
  - vuelta a la bóveda: el contacto guarda las direcciones cortas de los dos hosts (`/v/`, sin secretos); en WebKit, además, el enlace completo fuera del teléfono;
  - acceso y contenido: caduca 7 días después del último fragmento (ampliable) y solo muestra incidentes con SOS;
  - cabeceras: CSP solo `self`, sin `unsafe-inline` ni `eval`, con `frame-ancestors 'none'`; `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex`; sin cookies ni terceros;
  - maquetación: 640 px de ancho máximo, sin scroll horizontal desde 320 px y estados en 320, 600 y 1024 px.
- Hosts operativos: nombres neutros, sin "vigia" ni "sos". La página de presentación sí lleva el nombre y nunca enlaza a ellos.
- Borrado: candado de R2 de 30 días. Se ejecuta cuando el fragmento más reciente (por la hora de recepción del servidor) cumple 30 días, y nunca con un SOS activo. Se deshace con el PIN. Mientras se borra, la ingesta de ese incidente responde 409, y ninguna alerta activa del incidente o del teléfono (tampoco la falta de señales) deja que se ejecute. No hay borrado automático de incidentes de teléfonos inactivos.
- Aviso por falta de señales: apagado por defecto; umbral de 12, 24 o 48 h; latido cada hora; recordatorio local 2 h antes; W4 caduca a los 7 días. Tras una pausa, el plazo cuenta desde su fin.
- PIN de 6 dígitos o más, con espera exponencial desde 30 s tras 5 fallos. El PIN de coacción difiere del real en al menos 2 dígitos.
- Código de recuperación: 24 caracteres en 6 grupos de 4; se confirma reescribiendo 2 grupos. Obligatorio en modo avanzado y opcional en modo base, desde M10. Con una alerta activa no se puede crear ni cambiar, y una clave creada después de la configuración inicial no tiene poderes hasta pasadas 72 h.
- Ubicación: una posición por minuto mientras graba, solo "mientras se usa" y nunca en segundo plano.
- Vibraciones: 1 corta, 2 largas y 3 largas en F2; ninguna por fragmento. La de 2 cortas (alerta legal) llega con la IA, después de F2.
- Textos ocultos: "Servicio activo" y "Recordatorio pendiente". Nunca aparecen "Vigía" ni "grabando" en la fachada, la notificación ni los recordatorios.
- Interfaz:
  - objetivos táctiles de 48 dp como mínimo y de 56 a 64 dp en las acciones principales;
  - todo en sp, probado al 200 %; `caption` nunca por debajo de 14 sp;
  - tarjetas con frases de 12 palabras como máximo;
  - el ámbar solo en el temporizador, el SOS y la banda "Cuidado";
  - nunca la raya larga (U+2014).
- Packs: la variante release no compila con un pack en `draft`, y no hay interruptor para saltarlo. La variante de pruebas sí compila y muestra siempre "BORRADOR: no validado".
- Métricas del piloto (se miden e informan; solo bloquea la integridad):
  - arranque en menos de 2 s en el 99 %;
  - "Respaldado hasta" como mucho 2 fragmentos por detrás el 95 % del tiempo con 3G;
  - 0 fragmentos con acuse que falten en R2 y 0 duplicados (esta sí bloquea);
  - avisos en menos de 2 min en el 95 %;
  - batería: 8 % o menos por hora con la pantalla apagada;
  - si las falsas alarmas pasan del 10 %, se sube el umbral sugerido.

## Foco de revisión

1. **Teléfono quitado o destruido a mitad de la grabación.** Lo que tenía acuse está en el servidor y, si hubo SOS o con el código de recuperación, se puede ver y verificar. "Respaldado hasta" nunca miente: un acuse falso, un hueco, una cola parada o un reloj desfasado no cuentan como respaldo.
2. **Temporizador que vence mientras la persona está retenida** (carrera con el desarme, cron caído, reintentos o reenvíos). La alerta se crea una sola vez (las repeticiones de los 10 y los 30 min son parte de ella), a tiempo o con el retraso declarado como fallo nuestro. Nunca se pierde, nunca llega una cancelación sin su alerta, y quien tenga el teléfono en la mano no puede aplazarla más de 2 veces sin el PIN.
3. **Desbloqueo forzado y revisión del teléfono durante horas.** La calculadora y el señuelo no delatan nada dentro de los límites declarados, y el PIN de coacción avisa en silencio. No hay nada en claro en el disco, en logcat, en el portapapeles, en las sugerencias del teclado ni en las notificaciones.
4. **El contacto abre la bóveda con datos manipulados en el servidor, una transcripción hostil o su propio teléfono revisado.** Solo se muestra lo que verifica contra la huella del enlace, ningún texto se ejecuta como código y su navegador conserva lo mínimo. Si lo manipulado es el código que sirve el servidor, es un límite declarado: la vía independiente es el paquete descargado más el verificador abierto.
5. **La persona lee sus derechos en plena alcabala.** Encuentra opciones tranquilas que nunca instigan, con artículo y fuente oficial. Si el pack no está validado, ve "BORRADOR: no validado" y no hay release.

## Cómo trabajamos

- **Solo `main`:** sin ramas, worktrees, merges ni PRs. Las skills que los proponen (using-git-worktrees, finishing-a-development-branch, subagent-driven-development) se usan sin esa parte.
- **Un solo agente escribe y hace commits a la vez,** siempre con `git add <rutas>` y nunca con `git add -A`. Los demás agentes solo leen o revisan.
- **Commits:** Claude hace commits pequeños durante el hito, en español y solo con las pruebas en verde.
- **Identidad de los commits:** la configurada en el repo local. Se mantiene por decisión del 12-oct-2026.
- **Etiqueta por hito aprobado:** etiqueta anotada (`f2-h0a`, `f2-h0b`, `f2-h1`…) en el commit aprobado. El hito entero se revisa con `git diff f2-h1 f2-h2`. Si se rechaza un hito, se corrige con commits nuevos o con `git revert`, nunca con `reset` ni con push forzado.
- **El push lo hace la persona responsable, empujando la etiqueta aprobada y no `main`:**

  ```
  git push origin 'f2-h1^{commit}:refs/heads/main' 'refs/tags/f2-h1'
  ```

  Antes de empujar, `git log --oneline <etiqueta anterior>..<etiqueta nueva>` debe mostrar solo commits del hito aprobado.
- **Orden de los commits si dos hitos avanzan a la vez** (H0b, que espera días a VE y a las 24 h del cron, y H1): solo uno de los dos hace commits en `main` hasta tener su etiqueta. El informe del pico se redacta fuera del repo y se commitea cuando el otro hito ya está etiquetado.
- **Despliegues:**
  - la página de presentación se publica sola desde `main` (aprobado el 12-oct-2026); como solo llegan etiquetas aprobadas, nunca sale nada sin aprobación;
  - los Workers y el respaldo los despliega Claude con wrangler desde el entorno de build, solo con autorización para cada entorno;
  - el entorno dev usa datos sintéticos o grabaciones de prueba sin terceros (DAT-01).
- **Entorno de build aislado (ENV-01):** el código de terceros (dependencias de npm, Gradle, Expo, el SDK de Android y wrangler) se instala y se ejecuta en un entorno que no ve nada fuera de su árbol de trabajo, no controla el host, usa un usuario sin privilegios y no tiene credenciales de GitHub. Los secretos entran solo en la orden que los usa: se generan y se pasan por tubería, nunca se pegan ni se imprimen. Las sesiones de trabajo de Vigía no alimentan procesos automáticos de memoria, resumen o indexado. Los detalles del entorno viven en el archivo privado.
- **Configuración de los entornos fuera del repo (CFG-01):** hosts, ids de cuenta, D1, R2, nombre del bot, sub de VAPID y ruta del webhook se inyectan en el build desde un archivo privado. El repo lleva solo una plantilla con valores ficticios. Cada host o bot real entra en la lista privada de patrones de los hooks el mismo día en que se crea.
- **Variantes de la app:**

  | Variante | Para qué | Build | Firma | Pack en borrador | Extras |
  |---|---|---|---|---|---|
  | debug | Desarrollo y búsquedas con `run-as` | Depurable | Depuración | Sí, con la banda | Temporizador corto, umbral corto de falta de señales, inyección de batería baja y de bloqueo de host, fixture CO |
  | pruebas | Aceptación y métricas en teléfonos de prueba | Como release: R8, no depurable, sin dev client ni OTA | Clave de firma de pruebas | Sí, con la banda | Autopruebas, registro de tiempos y fixture CO. Con el interruptor de compilación `capturas`, sin `FLAG_SECURE` |
  | release | Publicación, después de F4 y de la firma legal | Release | Clave de publicación (SUM-04) | No compila | Nada de lo anterior |

  En debug y en pruebas, `K` se envuelve además para la **clave de escucha de pruebas**, que vive fuera del repo, para verificar y escuchar en la máquina de build. Es una excepción al cifrado de extremo a extremo que solo existe en teléfonos de prueba (cambio 21 a DESIGN.md). Una prueba de Gradle comprueba que la clave de escucha, `capturas` y los extras de debug solo existen en los conjuntos de fuentes y en el `BuildConfig` de debug y pruebas. La búsqueda sobre un APK release real se hace en el primer release, después de la firma legal, y bloquea esa publicación.
- **Evidencia del teléfono:** Claude no tiene acceso al teléfono. Cada plan detallado trae un guion de adb con las órdenes completas para el portátil de la persona responsable, que lo ejecuta y guarda las salidas en la carpeta privada del proyecto, donde Claude las lee. Las pruebas instrumentadas se compilan en el entorno de build, se instalan con adb y se ejecutan desde el portátil (`adb shell am instrument -w <paquete>.test/androidx.test.runner.AndroidJUnitRunner`). TalkBack se revisa con su registro de voz.
- **Evidencia visual:** Claude no ve la app, y `FLAG_SECURE` deja las capturas en negro. La persona responsable toma las capturas con adb y el APK `capturas` y las deja en la carpeta privada; cada informe cita el archivo de cada captura.
- **Datos de prueba:** todas las pruebas de campo se graban sin conversaciones de terceros. La clave de escucha de pruebas se destruye al cerrar F2; la clave de firma de pruebas se conserva para F4. Cada informe anota qué audio de prueba se subió. El APK se desinstala de los teléfonos prestados antes de devolverlos.
- **TDD obligatorio** (superpowers:test-driven-development) en la lógica crítica: sobre, cadena, verificador, firma de peticiones, HPKE, validador, LegalEngine, cola de subida, cron, PIN y borrado.
- **Cierre de cada hito:**
  1. superpowers:verification-before-completion;
  2. un informe de cierre con la evidencia de cada criterio, en la carpeta privada; al repo llega solo un resumen sin números de serie, rutas, nombres de host, horas ni descripción del audio de prueba (`docs/pico/informe.md` sigue la misma regla);
  3. la parada: no se empieza el siguiente hito sin aprobación.
- **Skills:**
  - en todo el código: ponytail:ponytail y antislop-code;
  - en los Workers: cloudflare:workers-best-practices y cloudflare:wrangler;
  - en la bóveda y en la página de presentación: frontend-security-coder, web-performance-optimization, impeccable y antislop;
  - en la UI móvil: impeccable y taste-skill contra DESIGN.md, más accessibility;
  - al cerrar la fase: security-review.
- **Repositorio público:**
  - nunca nombres ni contactos de personas u organizaciones que participan (viven en un registro privado fuera del repo);
  - desde H0a, el README avisa: "Prototipo en construcción. Todavía no lo uses para protegerte.";
  - hooks versionados (`core.hooksPath`) además de gitleaks. Rechazan en lo añadido y en el mensaje: la raya larga (escrita en los hooks como U+2014, nunca literal); los correos que no sean noreply (el trailer `Co-Authored-By` con la dirección noreply se acepta); los números con formato de teléfono de VE o de CO, con prefijo +58 o +57 o con separadores (así el JSON de vectores de CFRG no da falsos positivos, comprobado el 12-oct-2026); y las coincidencias con la lista privada de patrones, guardada fuera del repo como hashes;
  - el código desechable del pico vive en un repositorio local aparte, sin remoto: a `main` solo llegan sus resultados.
- **Tamaños:** S hasta 1 día, M de 2 a 3 días y L de 4 a 6 días de trabajo, sin contar el tiempo de campo. Total de F2: unos 38 a 57 días de trabajo.

## Hitos

| Id | Nombre | Entregable | Depende de | Tamaño |
|---|---|---|---|---|
| H0a | Base del repositorio y pico en la máquina de build | Entorno aislado; .gitignore, SECURITY.md, README, LICENSE, hooks y página de presentación; informe parcial del pico (P1, P5 y P6) | Aprobación de F1 | M |
| H0b | Pico en el teléfono, en Cloudflare y en VE | Informe completo del pico y sus cambios a DESIGN.md | H0a; teléfono y cuenta de Cloudflare | M, más 3 a 5 días de calendario en VE |
| H1 | Contratos y cadena de evidencia sin teléfono | shared con vectores, verificador y CLI; núcleo Kotlin en la JVM; Worker de ingesta local; teléfono simulado | H0a | L |
| H2 | Derechos sin red: primer APK de producto | Pack VE en borrador, validador y export; LegalEngine; M1, M3 y M4; variantes y build endurecido | H1 y H0b | M |
| H3a | Grabar sin red y respaldar con acuse | recorder, Keystore, vault.db, cola de subida en Kotlin, M2 y M7 base; Worker en dev | H2 | L |
| H3b | PIN, bloqueo, errores diseñados, ubicación y M8 base | PIN y bloqueo, `FLAG_SECURE`, ubicación, errores diseñados, M8 base | H3a | M |
| H4 | Contactos y bóveda inactiva | M9, W1 y W3, registro de accesos, Telegram, Web Push, Probar alerta | H3b y P8 (o la decisión de seguir con Telegram) | L |
| H5a | Avisa sola: temporizador, SOS y entrega | Cron, M6, repeticiones, acuse de apertura y eje de aviso | H4 | L |
| H5b | Bóveda que verifica y reproduce | W2 y W3 (caducado y "no coincide"); prueba del teléfono quitado | H5a | M |
| H6 | Modo avanzado: coacción, camuflaje y código | M0 calculadora, alias del lanzador, PIN de coacción y M11, código de recuperación y flujo H | H5b | L |
| H7 | Ciclo de vida y aviso por falta de señales | Borrado diferido con candado, paquete exportado y descargado, latido y W4 | H6 | M |
| H8a | Configuración inicial, ajustes y pasada de diseño | Configuración completa, M10 completo, inicio honesto y pasada de diseño | H7 | M |
| H8b | Censura, aceptación de F2 y revisión de seguridad | APK de pruebas que pasa la aceptación con los hosts definitivos; informe de cierre de F2 | H8a | L |

Si el teléfono o la cuenta de Cloudflare tardan, H1 va antes que H0b (con la regla de orden de los commits). Nada que dependa de MediaCodec, del servicio en primer plano o de la cola en el teléfono empieza antes de cerrar H0b.

## Detalle de los hitos

### H0a. Base del repositorio y pico en la máquina de build (M)

- **Objetivo:** dejar el entorno de build aislado, el repo con sus defensas y la página de presentación, y medir lo que no necesita teléfono: la compilación, la interoperabilidad criptográfica en la JVM y en Node, y las primitivas de los navegadores.
- **Entregable:**
  - en el repo: `.gitignore`, `SECURITY.md`, `README.md` con el aviso de prototipo, `LICENSE` (Apache-2.0), hooks versionados, `sitio/` y `docs/pico/informe.md` con P1, P5 y P6 en su parte de la máquina de build;
  - fuera del repo: el entorno de build aislado, el banco de pruebas y la lista privada de patrones.
- **Incluye:**
  - Antes de instalar ninguna dependencia:
    - el entorno de build aislado, con versiones fijadas de JDK 17, SDK de Android de línea de comandos, build-tools, NDK, CMake, Node y pnpm;
    - Playwright en su imagen oficial, compartiendo la red del entorno de build y sin puertos publicados;
    - una red aislada para toxiproxy (P7), con las mismas reglas.
  - Lo que hace la persona responsable, con los pasos que da Claude: sacar de la máquina el registro privado o cifrarlo con una clave que no viva en ella; bajar la caché del token de GitHub a 5 min; comprobar que las sesiones de Vigía quedan fuera de los procesos automáticos de memoria y resumen; y los ajustes de GitHub (regla que bloquea en `main` el push forzado y el borrado, escaneo de secretos y protección de push).
  - `.gitignore`: `.dev.vars`, `.env*`, keystores, APK, `node_modules` y la configuración de entornos.
  - `SECURITY.md`: aviso privado de vulnerabilidades de GitHub, sin contactos personales.
  - Hooks de pre-commit y commit-msg con gitleaks de versión fijada (ver "Cómo trabajamos"), y la lista privada de patrones con los nombres del registro privado.
  - `sitio/`: página de presentación mínima y estática, en español, con el nombre Vigía, qué es y el aviso de prototipo. No enlaza al repo mientras esté en una cuenta personal, porque mostraría la cuenta del titular. Sin descarga hasta el primer release, sin terceros ni analítica, con `_headers` (CSP solo `self`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`) y sin ningún host operativo. Sigue los tokens de DESIGN.md.
  - Banco de pruebas en un repositorio local aparte, sin remoto: app Expo mínima con un módulo Kotlin y op-sqlite (sqlcipher y fts5), y la página de primitivas.
  - P1 en la máquina de build, P5 en la JVM y en Node, y P6 en Playwright. La versión de Playwright queda fijada en el informe, y H1 la copia al `package.json`.
- **Excluye:** teléfono, Cloudflare y VE (H0b); código de producto (H1).
- **Criterios de aceptación:**
  - Desde el entorno de build, leer fuera de su árbol de trabajo y controlar el host fallan; `javac -version` y `jlink --version` responden.
  - El registro privado no está en claro en la máquina; `git config --get-all credential.helper` muestra la caché de 5 min; la exclusión de las sesiones está comprobada y anotada en el archivo privado.
  - Desde un clon limpio del banco, un solo comando compila en release y termina en BUILD SUCCESSFUL, con un APK por ABI y su tamaño anotado como línea base.
  - El `test-vectors.json` de cfrg/draft-irtf-cfrg-hpke, descargado de un commit fijado y comprobado con su SHA-256, pasa al 100 % en el modo base de la suite 0x0020/0x0001/0x0002, en la JVM (BouncyCastle) y en Node (@hpke/core). El cruce funciona en los dos sentidos.
  - Una firma DER de una clave P-256 de software se verifica en WebCrypto tras convertirla a P1363.
  - Playwright en Chromium, Firefox y WebKit da ✓ en X25519 (o declara el respaldo), AES-GCM, HKDF, ECDSA P-256 y la decodificación de un ADTS a 16 kHz.
  - Hooks: se rechaza un commit con la raya larga, con un correo que no es noreply, con un teléfono o con un patrón de la lista privada; pasan un commit con el trailer de coautoría noreply y el de `test-vectors.json`. gitleaks informa 0 hallazgos y `git ls-files` no contiene nada del banco.
  - `sitio/` servida en 127.0.0.1 con wrangler (versión fijada): las cabeceras de `_headers` aparecen, Playwright no ve ninguna petición a otro origen y no contiene ningún host operativo.
  - Aprobación: commit en `main` y etiqueta `f2-h0a`. Tras el push, `curl -sI https://vigiaapp.pages.dev` muestra las mismas cabeceras (se comprueba al empezar H0b).
- **Cubre de DESIGN.md:** Riesgos abiertos (pico técnico: compilación, interoperabilidad y navegadores); Seguridad (identidades de quienes participan); la página de presentación (cambio 7).
- **Seguridad:** ENV-01, REPO-01, SUM-06, SEC-01 (base), OPS-03 y WEB-01.
- **Requisitos:** los pasos de la persona responsable de "Incluye".
- **Riesgos:** el SDK y el NDK ocupan unos 10 GB y tardan en bajar; WebKit necesita librerías del sistema, por eso los navegadores van en la imagen oficial de Playwright.
- **Skills:** superpowers:test-driven-development (vectores), impeccable y antislop (página), frontend-security-coder, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H0b. Pico en el teléfono, en Cloudflare y en VE (M, más 3 a 5 días de calendario en VE)

- **Objetivo:** medir en el teléfono, en Cloudflare y en VE las incógnitas que pueden cambiar la arquitectura, y dejar cada respuesta en DESIGN.md antes de construir producto que dependa de ellas.
- **Entregable:** `docs/pico/informe.md` completo (pregunta, medición y decisión por cada P, con marcadores en lugar de hosts reales) y los cambios a DESIGN.md que salen de él. Fuera del repo, los Workers y la página de prueba.
- **Incluye:**
  - Cuenta de Cloudflare dedicada, endurecida antes del primer despliegue: 2FA con llave física, subdominio de workers.dev neutro elegido antes de desplegar nada y token de API mínimo con caducidad. Claude despliega solo con wrangler y ese token, con la configuración fuera del repo (CFG-01).
  - Teléfono: instalar el banco con adb desde el portátil y correr su autoprueba (FTS5, cabecera de `vault.db`, firma del Keystore y su latencia con TEE y con StrongBox).
  - P2, P3, P4, P5 (parte del teléfono), P6 (navegadores reales), P7, P8 y P9.
  - Audio de prueba sin terceros. Los fragmentos salen cifrados con la clave de escucha de pruebas y se descifran en la máquina de build: el audio en claro no toca el disco del teléfono ni en el pico.
- **Excluye:** código de producto; alias del lanzador (P10, al empezar H6); fabricantes (H8b).
- **Criterios de aceptación:**
  - La autoprueba del banco en el teléfono marca ✓ en tres puntos:
    - "detencion" encuentra "detención" en FTS5;
    - `vault.db` no abre sin clave y su cabecera no es "SQLite format 3";
    - el Keystore firma, con su latencia anotada.
  - Tras descifrar en la máquina de build una grabación de 30 min:
    - `ffprobe` informa "aac (LC), 16000 Hz, mono" (o la tasa del plan B);
    - las muestras PCM leídas cuadran con el tiempo monotónico, con menos de 1 s de diferencia;
    - los clics de referencia, uno cada 10 s desde otro aparato, caen donde deben.
  - P4: con el teléfono desconectado del cable y Doze forzado, la cola en Kotlin sube cada minuto durante 30 min y se vacía tras Detener. La batería queda anotada con y sin ubicación, con el procedimiento de P4.
  - P5 en el teléfono:
    - un sellado HPKE hecho en el teléfono se abre en la máquina de build;
    - la firma DER del Keystore se verifica en WebCrypto;
    - el verificador elegido verifica 30 min de evidencia en menos de 5 s.
  - P6: la página de primitivas da ✓ o ✗ por primitiva en Chrome Android, Samsung Internet y el navegador interno de Telegram; Safari iOS queda medido o declarado sin medir.
  - P9: queda anotado el error exacto del candado de R2; el cron corre con menos de 60 s de retraso en el 99 % de 24 h; un `accessId` marcador no aparece en Workers Logs ni en las métricas; el respaldo en Pages con los mismos D1 y R2 funciona, o queda decidido su plan B.
  - P8 cerrado, o en marcha con la fecha de su resultado (condición de entrada de H4).
  - `git grep` del subdominio de workers.dev, de los nombres de los Workers, del proyecto de respaldo y del bot de prueba devuelve 0 líneas; el informe usa marcadores (`<host-api>`, `<host-bóveda>`, `<host-respaldo>`, `<bot>`).
  - El informe fija:
    - modelo y versión de Android del teléfono de pruebas;
    - la duración del fragmento;
    - dónde guarda la cola los sobres (`vault.db` o archivos cifrados con una clave del Keystore) y cómo la comparten Kotlin y op-sqlite;
    - la librería HPKE;
    - dónde verifica la app (Kotlin o una librería JS solo en la app);
    - el respaldo X25519 para navegadores;
    - si el PUT de un fragmento lleva firma de petición o le basta `s`;
    - qué duraciones se prueban en los 3 fabricantes;
    - el error del candado, la puntualidad del cron y la viabilidad del respaldo en Pages;
    - el canal principal en VE, o la fecha en que llega esa medición.
  - Aprobación del informe y de sus cambios a DESIGN.md: commit y etiqueta `f2-h0b`.
- **Cubre de DESIGN.md:** decisiones 11, 16, 18, 20 y 29; Arquitectura (formato de audio, bases locales, `recorder` y cola de subida); Riesgos abiertos (pico técnico y Web Push en VE).
- **Seguridad:** OPS-01, CFG-01, HOST-03 (nombres de prueba neutros), LOG-01 (P9) y DAT-01.
- **Requisitos:**
  - teléfono de gama baja (Xiaomi o Redmi con Android 11 a 13 y 2 a 3 GB de RAM) con SIM y datos, excluido del ahorro de batería durante las pruebas y con la depuración USB activada (por eso no sirve para protegerse);
  - adb en el portátil, por USB o con depuración inalámbrica en la red local;
  - cuenta de Cloudflare dedicada;
  - bot de Telegram de prueba con nombre neutro, cuyo token llega por un canal privado y va solo como secreto;
  - persona de confianza en VE con las protecciones de P8;
  - de 4 a 6 h de pruebas con el teléfono.
- **Riesgos:**
  - Sin Cloudflare a tiempo, H1 va antes que H0b, y P8 y P9 esperan.
  - Sin nadie en VE, Telegram queda como canal principal y el riesgo se declara.
  - Si el fabricante mata el servicio, guía por fabricante y el aviso de H3a.
- **Skills:** cloudflare:wrangler, cloudflare:workers-best-practices, superpowers:test-driven-development (cortador ADTS del banco), ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H1. Contratos y cadena de evidencia sin teléfono (L)

- **Objetivo:** fijar con vectores y TDD los formatos que comparten Kotlin, el Worker y la bóveda, y construir la ingesta que valida, guarda y acusa. Todo se prueba en la máquina de build, sin teléfono ni cuenta de Cloudflare.
- **Entregable:**
  - monorepo pnpm;
  - `packages/shared`: contratos, sobre canónico, firma de peticiones, acuse, HPKE, formato del paquete, verificador y CLI `verificar`;
  - núcleo Kotlin puro del `recorder`, probado en la JVM;
  - `packages/backend` con alta, incidentes, fragmentos, cierre y lecturas firmadas, sobre D1 y R2 locales;
  - teléfono simulado;
  - `docs/verificacion.md` (especificación pública);
  - plantilla de configuración de entornos con valores ficticios.
- **Incluye:**
  - Cadena de suministro desde el primer `package.json`: lockfile congelado, versiones exactas, `packageManager` con hash, `minimumReleaseAge`, `allowBuilds` revisado y wrangler como devDependency fijada. En Gradle, versiones exactas, wrapper con `distributionSha256Sum` y verification-metadata.
  - shared, formatos y firmas:
    - bytes canónicos de `r` (apertura con `country_code`, fragmento, hueco y cierre);
    - apertura firmada como origen de la cadena;
    - prefijos de dominio distintos para peticiones, registros, cierre, acuses y recuperación;
    - AAD con codificación fija;
    - conversión DER a P1363;
    - acuse con `kid`.
  - shared recibe un proveedor criptográfico inyectado (SHA-256, ECDSA P-256, AES-GCM y HPKE): WebCrypto en el Worker, en la bóveda y en Node, y en la app lo que fije el pico.
  - shared, verificador: mensajes legibles y formato ZIP del paquete, fijados aquí para no cambiarlos después.
  - Núcleo Kotlin: escritor y cortador ADTS, sobre en RAM con una interfaz de firmante (en Android, el Keystore), sellado HPKE con la librería provisional del pico y cola de subida con reloj virtual. Vectores dorados compartidos con TS. La tasa de muestreo, la duración del fragmento y el límite de cuerpo son parámetros hasta cerrar H0b.
  - Worker, firma de peticiones: cadena canónica; ventana de ±5 min con la respuesta `hora` para corregir el desfase; idPeticion único por dispositivo, con las filas borradas a los 10 min.
  - Worker, alta de dispositivos:
    - prueba de posesión;
    - tope global de altas por hora, sin IP, con la cota de crecimiento de R2 calculada (altas por hora × 24 × 30 × cuota por dispositivo) y cuotas que la mantengan pagable;
    - si hace falta una prueba de trabajo en el alta, se decide en el plan detallado de H1 con esa cota.
  - Worker, ingesta:
    - idempotente, con escritura única en R2 y clave de objeto construida por el servidor tras comprobar el dueño;
    - acuse solo cuando R2 y D1 confirman;
    - acepta fragmentos fuera de orden: comprueba `prev` si el anterior ya está guardado y, cuando llega el anterior, comprueba el siguiente; un fallo así se marca como bifurcación para el verificador y no se borra nada;
    - con el cierre guardado, un `seq` mayor que el suyo responde 409, y los menores deben encadenar con su hash final, aunque el cierre llegue antes;
    - un PUT repetido no cambia la hora de recepción ni las marcas, y nunca cuenta como señal si no lleva firma de petición;
    - el límite por dispositivo cuenta solo los fragmentos nuevos, después de verificar `s`, con cupos separados para órdenes, subida y lecturas.
  - Worker, lecturas firmadas del dispositivo: contrato de `GET /v1/incidents/:id/chunks/:seq`, firmada con la clave de lectura (el Worker rechaza las lecturas firmadas con la clave de los fragmentos), y de su versión firmada con la clave de recuperación (la usan H3b y H6).
  - Worker, operación:
    - límites por dispositivo con el binding de rate limiting (clave = id del dispositivo);
    - errores con una lista cerrada de códigos;
    - `observability` desactivada y `preview_urls: false`;
    - configuración de cada entorno inyectada desde el archivo privado.
  - Contadores agregados de integridad (decisión 37). La conciliación D1/R2 la hace un script externo con un token de R2 de solo lectura: el Worker nunca lista.
- **Excluye:** app (H2 y H3a); contactos, temporizador y bóveda (H4 a H5b); borrado (H7); despliegue en Cloudflare (H3a); derivación del código de recuperación (H6).
- **Criterios de aceptación:**
  - Desde un clon limpio, `pnpm install --frozen-lockfile && pnpm -r test` en verde: shared en Node y backend con `@cloudflare/vitest-pool-workers` sobre D1 y R2 locales.
  - `./gradlew test` del núcleo Kotlin en verde; los vectores dorados coinciden byte a byte entre Kotlin y TS.
  - Manipulación, con una prueba por caso y el texto de DESIGN.md en cada una:
    - 1 byte cambiado en `ct`;
    - dos fragmentos intercambiados;
    - firma de otro dispositivo;
    - `country_code` alterado en la apertura;
    - cierre ausente: "el teléfono dejó de enviar a las HH:MM".
  - Ingesta, entradas inválidas:
    - firma, `c` o esquema inválidos: 4xx con código propio y nada escrito;
    - el mismo `seq` con otro `c`: 409 y el original intacto;
    - el dispositivo B en un incidente de A: 404;
    - reloj desfasado 6 min: 401 `hora`, y el reintento corregido pasa;
    - 64 KB + 1: 413, también sin Content-Length.
  - Fuera de orden: el `seq` 7 llega antes que el 6 y se aceptan los dos; si el 7 no encadena con el 6, queda marcado como bifurcación y el verificador lo dice.
  - Reintento legítimo: el mismo PUT repetido devuelve el mismo acuse y deja un solo objeto. Un reenvío dentro de la ventana devuelve el resultado original, y la tabla anti-reenvío no conserva filas de más de 10 min.
  - Con el cierre guardado, un `seq` mayor responde 409; reenviar 100 veces los sobres de un paquete no cambia ninguna hora de recepción ni le provoca un 429 al teléfono simulado; una lectura firmada con la clave de los fragmentos se rechaza.
  - Altas: el informe anota la cota, su coste mensual y las cuotas elegidas; por encima del tope, el teléfono simulado recibe 429 y reintenta sin perder sobres.
  - El teléfono simulado acumula 2 min sin red (30 fragmentos de 4 s) contra el Worker local y luego los sube. `pnpm --filter shared verificar` imprime "✓ 30 fragmentos, cadena íntegra…" y `ffprobe` reconoce el audio descifrado.
  - `grep -rniE "cf-connecting-ip|x-forwarded-for|x-real-ip|request[.]cf" packages/backend/src` no devuelve nada; una prueba de configuración comprueba `observability` desactivada y `preview_urls: false`.
  - `pnpm --filter backend list --prod --depth Infinity` solo contiene hono y shared, y shared no tiene dependencias de terceros.
  - `git grep` de los valores reales de configuración devuelve 0 líneas.
- **Cubre de DESIGN.md:**
  - decisiones 1, 3, 5 (verificación), 6 (`country_code`), 20, 26 (lecciones 5 y 7), 28 (solo cuenta lo que tiene acuse), 29 (como parámetro) y 37 (integridad);
  - Evidencia y cifrado;
  - Superficie de la API: alta, incidentes, fragmentos, cierre, lecturas firmadas y límites por dispositivo;
  - D1 (borrador);
  - QA-03, QA-04 y QA-05 (parte del servidor).
- **Seguridad:** FIR-01, FIR-02 (fragmentos), FIR-03 (servidor), FIR-04, ENT-01, ENT-02, ID-01, LIM-01 (peticiones y cuota), ERR-01, LOG-01, D1-01, D1-02, R2-01, ACU-01, CIF-01, CIF-02 (vectores), CIF-03, SEC-01, CFG-01, SUM-01, SUM-02, SUM-07, OPS-02, OPS-03 y PRIV-01 (anti-reenvío).
- **Requisitos:** aprobar el formato canónico y la especificación de verificación, porque cambiarlos después obliga a tocar Kotlin, TS y el navegador.
- **Riesgos:**
  - Una serialización ambigua rompería la interoperabilidad: la cubren los vectores byte a byte.
  - El plan Free da 10 ms de CPU por petición: se mide la verificación ECDSA en local y se anota en H3a; si se acerca al límite, Workers Paid.
  - D1 no tiene transacciones interactivas: se usan batch y restricciones únicas.
- **Skills:** superpowers:test-driven-development, cloudflare:workers-best-practices, cloudflare:wrangler, security-best-practices, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H2. Derechos sin red: primer APK de producto (M)

- **Objetivo:** que en el teléfono, en modo avión, se encuentre la situación y se lea qué puedes hacer, qué no pueden hacerte y qué evitar, con su artículo y su fuente. Y entregar pronto el export del pack, porque la validación legal es lo que más tarda.
- **Entregable:** `packs/ve` en borrador con validador y export legible; PackLoader y LegalEngine; un APK con M1 (situaciones y chip de país), M3, M4 y los pasos 1 y 2 de la configuración inicial; las tres variantes y el build Android endurecido.
- **Incluye:**
  - Tipo CountryPack tal cual DESIGN.md y validador único (corre en las pruebas, en el build y al cargar). `release-check` falla con un pack en `draft` en la variante release y pasa en la de pruebas.
  - `packs/ve`, redactado por Claude a partir de textos oficiales (decisión de F1 10.7):
    - situaciones: `stop`, `search`, `phone`, `documents`, `bribe`, `detention` y `border` (esta última solo con pautas de seguridad física);
    - leyes con `officialRef` (Gaceta, número y fecha) y fecha de consulta;
    - `contactGuide` sin nombres de organizaciones;
    - `recordingNote`, `promptContext`, `threat.defaults` (camuflaje y modo avanzado sugerido) y `copy`.
  - Fixture CO mínimo en las pruebas y, con su banda de borrador, en debug y en pruebas: sirve para probar en el teléfono el cambio de país, el paso 2 con dos tarjetas y la pista MCC, y para que F3 no necesite código nuevo.
  - LegalEngine probado en Node con `node:sqlite` (FTS5 con `unicode61 remove_diacritics 2`, el mismo SQL que op-sqlite). PackLoader reconstruye `legal.db` si cambia la versión. Una autoprueba de la variante de pruebas ejecuta en el teléfono las mismas consultas doradas, compara los ids con los de Node y anota la versión de SQLite de cada lado.
  - App:
    - base: tokens de día y noche, Overpass empaquetada, barra inferior, orientación vertical y testID estables para Maestro (F4);
    - pantallas: M1, M3 (tres bandas, placas con hoja inferior, "BORRADOR: no validado" y estado "sin tarjeta para esa situación") y M4 ("Prueba con otra palabra");
    - configuración: paso 1 y paso 2 (país con pista MCC que solo sugiere).
  - Campos de texto: un parche nativo pone `IME_FLAG_NO_PERSONALIZED_LEARNING` e `importantForAutofill="no"` en todos.
  - Build endurecido:
    - sin copias de seguridad;
    - solo el lanzador exportado;
    - sin esquema de URL;
    - sin WebView;
    - sin expo-updates ni dev client fuera de debug;
    - R8 quita los logs nativos y un plugin de Babel quita `console.*` del bundle;
    - red sin texto plano y solo con CAs del sistema;
    - lista cerrada de permisos;
    - lista de dependencias prohibidas que hace fallar la compilación: expo-notifications, expo-location, expo-updates, expo-dev-client fuera de debug, `com.google.firebase` y `com.google.android.gms`.
  - El APK lleva el bundle JS dentro (sin Metro por la red) y se instala con adb desde el portátil.
- **Excluye:** grabar, PIN y bloqueo (H3a y H3b); la firma legal (no bloquea F2, sí el release); pack CO real y la situación `protest` (F3); packs por OTA.
- **Criterios de aceptación:**
  - `pnpm --filter shared test` y `pnpm --filter packs test` en verde, con una prueba en rojo por cada regla del validador y las mismas pruebas para VE y para el fixture CO.
  - `release-check` falla en la variante release con "Pack VE en borrador: no hay release sin validación" y pasa en la de pruebas. `apksigner verify --print-certs` muestra la clave de firma de pruebas en el APK de pruebas.
  - `pnpm --filter packs export ve` genera el documento legible con la versión y el hash del pack.
  - Una tarjeta que cita una ley que ya no está en el pack hace fallar el validador (QA-22).
  - LegalEngine: "detencion", "requisa", "celular" y "alcabala" devuelven los ids esperados en Node y en la autoprueba del teléfono; una palabra inexistente, una lista vacía.
  - La prueba de textos recorre todas las cadenas de la app, de la bóveda, de la página de presentación y de las plantillas. Falla si una frase de tarjeta pasa de 12 palabras, si aparece la raya larga (buscada como U+2014), si una tarjeta usa un verbo de la lista de confrontación prohibida o si una cadena de notificación, de recordatorio o de la fachada contiene "Vigía" o "grabando".
  - Teléfono en modo avión, con la variante de pruebas:
    - "Me piden revisar el teléfono" aparece en menos de 1 s tras el toque;
    - la placa abre la hoja con la Gaceta y la fecha;
    - la banda de borrador se ve;
    - con `adb shell settings put system font_scale 2.0` y TalkBack nada se corta;
    - cambiar de VE al fixture CO funciona sin red, y un MCC simulado de CO solo sugiere;
    - con una tarjeta de VE abierta, cambiar a un fixture CO sin esa situación muestra "sin tarjeta para esa situación".
  - Tras buscar "detencion" en M4, escribir "dete" en otra app con Gboard no la sugiere.
  - `grep -rnE "Venezuela|'734'" packages/mobile/src packages/shared/src` devuelve 0 líneas.
  - `apkanalyzer` y `aapt2` sobre el APK de pruebas muestran:
    - `allowBackup` en false;
    - solo componentes LAUNCHER exportados;
    - ningún intent-filter VIEW;
    - permisos iguales a la lista aprobada;
    - ninguna clase de Firebase, de Google Play Services ni de expo-updates.
  - `./gradlew :app:dependencies` no contiene ninguna dependencia prohibida.
  - En `adb logcat`, ninguna línea del PID de la app contiene ids, rutas, textos de la interfaz ni consultas (con una lista blanca de etiquetas del sistema).
- **Cubre de DESIGN.md:**
  - decisiones 2, 6, 7, 8, 17 (valores por defecto del pack) y 25;
  - Interfaz CountryPack: tipo, validador, carga y paso 1 del proceso de firma;
  - Modelo de amenaza: frontera y trochas;
  - pantallas M1 (situaciones y chip), M3 y M4;
  - configuración inicial, pasos 1 y 2;
  - Voz y textos;
  - componentes fila de situación, banda de señal, placa de artículo y chip de estado.
- **Seguridad:** AND-01, AND-02, AND-03, AND-08, AND-09, AND-11, AND-15, AND-17, AND-18, AND-19, VAR-01, OPS-03, SUM-03 y SUM-07.
- **Requisitos:** revisar el tono y las fuentes del borrador; decidir cuándo llega el export a un/a abogado/a, siempre por un canal privado; el teléfono y adb; capturas de M1, M3 y M4 de día y de noche.
- **Riesgos:**
  - Contenido legal incorrecto: va marcado BORRADOR y no hay release.
  - Fuentes oficiales caídas: se cita la referencia de la Gaceta con la fecha de consulta.
  - Expo puede añadir permisos o `allowBackup`: la comprobación del manifiesto lo detecta.
- **Skills:** superpowers:test-driven-development, impeccable, taste-skill, accessibility, metodologia-investigacion, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H3a. Grabar sin red y respaldar con acuse (L)

- **Objetivo:** recorrer el camino crítico de la evidencia en un Android real:
  1. grabar sin red ni backend;
  2. cifrar en RAM;
  3. guardar solo lo cifrado;
  4. subir con acuse verificado;
  5. mostrar el estado tal cual es.
- **Entregable:** un APK que respalda en el entorno dev de Cloudflare, con el `recorder`, el Keystore, `vault.db` con SQLCipher, la cola de subida en Kotlin y M2 y M7 base; y el primer despliegue del Worker de producto en dev.
- **Incluye:**
  - Despliegue en dev (`<host-api>` en workers.dev, configuración fuera del repo), con el candado de R2 de 30 días en el bucket dev.
  - `recorder`, servicio y audio: servicio en primer plano de micrófono, con la notificación "Servicio activo" en un canal neutro, visibilidad secreta y sin acciones, y 1 vibración corta. AudioRecord + MediaCodec con el formato y la duración del pico, y sobre en RAM con el núcleo de H1.
  - Petición mínima de los permisos de micrófono y de notificaciones al primer Grabar; H3b la convierte en el paso 3 de la configuración.
  - `recorder`, claves: ECDSA en el Keystore (TEE o StrongBox, según P5); `K` en memoria nativa, envuelta con la clave local. Al disco solo van `ct + r + s`.
  - Cola de subida en Kotlin dentro del servicio, con WorkManager de respaldo y los sobres donde fijó el pico:
    - apertura primero y luego FIFO, con backoff de 1 s a 5 min y jitter;
    - rotación de hosts;
    - verifica el acuse con la clave fijada antes de borrar o de contar algo como respaldado;
    - los sobres rechazados se marcan, se reintentan y se ven en M7;
    - corrige el desfase del reloj;
    - una sola cola para todo lo firmado, con la prioridad fija de las Restricciones;
    - tras Detener con sobres pendientes, el servicio sigue activo (tipo sincronización de datos, con "Servicio activo") hasta vaciar la cola o hasta un tope de horas; WorkManager cubre las muertes del servicio y los reinicios.

    JS solo lee el estado. Aquí se decide si la cola funciona antes del primer desbloqueo tras un reinicio (con los sobres, ya cifrados, en el almacenamiento del dispositivo) o si se declara el límite.
  - Primer arranque sin red: el alta del dispositivo espera en la cola y grabar nunca depende de ella. Si el tope global de altas está agotado, el alta se reintenta y M1 lo dice.
  - El incidente fija el `country_code` del país activo al empezar.
  - Estado honesto en los ejes de incidente y respaldo: "El servidor aún no lo sabe", "Respaldado hasta HH:MM:SS · N en el teléfono", "Cierre pendiente de confirmar", "Sin red. Tu grabación se guarda en el teléfono." y el texto del flujo E.2.
  - Si el servicio muere: al reabrir, M7 marca "Interrumpido HH:MM" y un banner dice "Tu teléfono cerró la grabación a las HH:MM. Abre Ajustes de batería para evitarlo.", con arreglo de un toque.
  - Grabar también desde M3, con una tarjeta abierta.
- **Excluye:** PIN, bloqueo, ubicación, el resto de errores diseñados y M8 base (H3b); contactos (H4); temporizador y SOS (H5a).
- **Criterios de aceptación:**
  - `./gradlew testDebugUnitTest` del recorder y de la cola, con reloj virtual, en verde:
    - corte ADTS exacto;
    - orden y backoff;
    - rotación con 3 hosts falsos: si el primero falla, sigue el orden `<host-api>`, `<host-respaldo>` y segundo nombre de respaldo;
    - borrado solo con un acuse válido;
    - un acuse con otra clave, un `kid` desconocido o el hash de otro sobre no borra nada ni mueve "Respaldado hasta" ni el contador;
    - con el sobre 5 rechazado y del 6 al 10 con acuse, "Respaldado hasta" se queda en el 4 y cuenta 6 en el teléfono.
  - La prueba de Gradle de VAR-01 pasa: la clave de escucha, `capturas` y los extras de debug no están en los conjuntos de fuentes ni en el `BuildConfig` de release.
  - Instalación limpia y primer arranque en modo avión: los pasos 1 y 2 y Grabar 2 min funcionan. Al volver la red salen en orden el alta, la apertura y los fragmentos, sin duplicados.
  - Con el tope de altas de dev en 0, una instalación nueva graba, el alta espera en la cola y se reintenta, y M1 lo dice.
  - Modo avión con el teléfono ya dado de alta: Grabar 2 min y Detener. M2 dice "El servidor aún no lo sabe" y M7 "Cierre pendiente de confirmar" (QA-02, QA-16).
  - Al volver la red, en menos de 2 min M7 muestra "Subidos 30/30" (con 4 s) y el cierre confirmado. En la máquina de build, el verificador da "✓ cadena íntegra" y el audio descifrado dura 120 s ± 1 s.
  - Red intermitente: 5 min alternando la red cada 20 s. D1 queda con `seq` contiguos y 0 duplicados, y el verificador no marca huecos (QA-03, QA-04).
  - Con la hora automática apagada y el reloj adelantado 2 h, la cola corrige el desfase, sube sin duplicados y "Respaldado hasta" muestra la hora corregida.
  - Quitar la app de Recientes no corta la grabación. Forzar la detención a mitad (`adb shell am force-stop <paquete>`): al reabrir, M7 dice "Interrumpido HH:MM", aparece el banner y lo pendiente sube sin duplicados, con 0 `seq` repetidos en D1 (QA-06).
  - Si el Worker dev responde 4xx a un sobre, el sobre sigue en la cola, marcado, se reintenta y se ve en M7.
  - Sin excluir la app del ahorro de batería y con Doze forzado, la cola se vacía tras Detener en menos de 5 min si hay red. Al reiniciar con sobres pendientes, suben, o el límite queda escrito en DESIGN.md.
  - Con una llamada entrante de 30 s, el hueco queda marcado y la grabación sigue.
  - Con una tarjeta abierta en M3, Grabar empieza la grabación y lleva a M2.
  - Cambiar el chip de país durante una grabación no cambia el `country_code` del incidente.
  - `adb shell dumpsys notification --noredact` muestra solo "Servicio activo", en un canal neutro, con visibilidad secreta y sin acciones.
  - Con la variante de pruebas, tras grabar 2 min, subir y detener, ninguna línea del PID de la app en `adb logcat` contiene ids de incidente, `seq`, horas de incidente, rutas, hosts ni textos.
  - En la build depurable (`adb shell run-as`): `vault.db` no empieza por "SQLite format 3", y un marcador de audio y una etiqueta de prueba no aparecen en claro en los datos, el `-wal` ni la caché.
  - Se miden y se anotan, sin bloquear el hito: el retraso de "Respaldado hasta" durante 30 min con la pantalla apagada y 3G (si el operador no la ofrece, en el punto de acceso del portátil con el perfil de P7); 20 arranques; y el p99 de CPU por PUT en dev frente a 10 ms.
- **Cubre de DESIGN.md:**
  - decisiones 3, 18 (rotación), 20, 21, 23 (1 corta), 28 (incidente y respaldo) y 29;
  - flujos A y E;
  - pantallas M1 (Grabar y sus estados), M2, M3 (Grabar) y M7;
  - errores diseñados: servicio cerrado por el fabricante, sobre rechazado y sin red;
  - QA-02, QA-03, QA-04, QA-06 y QA-16.
- **Seguridad:** ACU-02, AND-05, AND-06, AND-07, AND-08, AND-10, AND-13 (Grabar y Detener), AND-14, AND-17 (tipos de servicio), FIR-03 (cliente), CIF-01 (Kotlin), R2-02 (dev), OPS-02 (alta en cola), VAR-01 y DAT-01.
- **Requisitos:** el teléfono y adb; un segundo teléfono para llamar; de 1 a 2 h de prueba de campo sin terceros; autorizar el despliegue en dev.
- **Riesgos:**
  - Integrar el módulo Kotlin y op-sqlite con la arquitectura nueva de React Native.
  - Desde Android 14, el servicio de micrófono solo arranca con la app en primer plano: Grabar siempre se inicia desde la interfaz.
  - Keystore defectuoso en algún modelo: se detecta y se avisa.
- **Skills:** superpowers:test-driven-development, cloudflare:wrangler, impeccable, taste-skill, accessibility, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H3b. PIN, bloqueo, errores diseñados, ubicación y M8 base (M)

- **Objetivo:** que lo grabado quede detrás del PIN, que cada fallo previsible se diga en pantalla y que la persona pueda escuchar y verificar sus incidentes.
- **Entregable:** PIN y bloqueo, `FLAG_SECURE`, ubicación opcional, el resto de errores diseñados, M8 base y los pasos 3 y 4 de la configuración.
- **Incluye:**
  - PIN de 6 dígitos o más, con teclado propio:
    - verificador HMAC con una clave del Keystore;
    - contador persistente;
    - esperas con reloj monotónico que sobreviven al reinicio.

    Texto de fallo: "PIN incorrecto." y, desde el tercer fallo, "Te quedan N intentos antes de esperar". Así se corrige la contradicción de DESIGN.md entre "Te quedan 2 intentos" y "tras 5 fallos".
  - Bloqueo al salir de la app o apagar la pantalla, también grabando. `FLAG_SECURE` en todas las ventanas, salvo en el APK `capturas`.
  - Ubicación: una posición por minuto con LocationManager dentro del servicio, cifrada en `loc` y solo con el permiso "mientras se usa". El servicio declara el tipo location solo si está activada.
  - Errores diseñados:
    - hueco marcado por una llamada u otra app con el micrófono;
    - "Quedan unos 20 min", y parada limpia al llenarse sin borrar nada que no tenga acuse;
    - batería baja;
    - ubicación activada sin posición;
    - permiso revocado, con arreglo de un toque;
    - botón deshabilitado "Falta permiso de micrófono".
  - M8 base: lista y detalle. Con el PIN, reproduce desde memoria: lo pendiente, desde el teléfono; lo respaldado, con la lectura firmada de H1, y si no hay red lo dice. Verifica la cadena y los acuses con el verificador que eligió el pico.
  - Claves de escucha en modo base: la clave de lectura, con `setUnlockedDeviceRequired`, y la envoltura local de `K` para una pública cuya privada solo se abre con el PIN, así que escuchar exige el PIN también ante un análisis del teléfono.
  - Configuración inicial: paso 3 (permisos con su consecuencia y guía de batería del fabricante del teléfono de pruebas) y paso 4 (PIN).
- **Excluye:** contactos (H4); temporizador y SOS (H5a); calculadora y coacción (H6); exportar y borrar (H7).
- **Criterios de aceptación:**
  - Pruebas del Lock con reloj falso: 5 fallos dan 30 s de espera y después crece. Se mantiene tras `adb shell am force-stop <paquete>`, con la hora del sistema adelantada y tras reiniciar el teléfono: la espera pendiente se aplica entera desde el arranque y el contador no baja.
  - Pantalla, con la variante de pruebas sin `capturas`:
    - `adb exec-out screencap -p` da una imagen negra y la miniatura de Recientes está vacía, también con un diálogo abierto;
    - al apagar y encender la pantalla grabando, pide el PIN y la grabación sigue.
  - Instalación limpia y primer arranque en modo avión: los pasos 1 a 4 y Grabar 2 min funcionan; al volver la red salen en orden el alta, la apertura y los fragmentos, sin duplicados.
  - Con la cola vacía tras "Subidos 30/30", M8 reproduce y verifica los 30 fragmentos con red. Sin red, dice que hace falta conexión para lo ya respaldado.
  - Prueba instrumentada: con la pantalla bloqueada, una lectura firmada falla; sin el PIN, la envoltura local de `K` no abre.
  - Espacio: con un archivo de relleno aparece "Quedan unos 20 min". Al llenarse el almacenamiento, la grabación se detiene limpia, lo grabado se conserva y sube después, y no se borra ningún sobre sin acuse.
  - Con la batería bajo el umbral (inyección solo en debug) y con el GPS apagado aparece su aviso, y el verificador marca el hueco de posición.
  - Quitar el permiso de micrófono en Ajustes muestra el banner y el botón deshabilitado; un toque lleva al arreglo.
  - En la build depurable (`adb shell run-as`), tras reproducir, un marcador de audio de 64 bytes no aparece en claro en el almacenamiento.
- **Cubre de DESIGN.md:**
  - decisiones 15 (base), 26 (lección 3), 30 y 36 (permisos y espacio);
  - pantallas M0 (teclado de PIN sin camuflaje) y M8 base;
  - configuración inicial, pasos 3 y 4;
  - errores diseñados restantes;
  - Do's: `FLAG_SECURE` y bloqueo también grabando;
  - QA-23.
- **Seguridad:** AND-04, AND-07, AND-12 (PIN), AND-13 (PIN), AND-16, AND-17 (ubicación) y AND-20.
- **Requisitos:** el teléfono y adb; capturas de M1, M2, M7 y M8 de día y de noche.
- **Riesgos:** bajo estrés el teclado propio debe ser tan rápido como el del sistema; se mide con la persona responsable.
- **Skills:** superpowers:test-driven-development, impeccable, taste-skill, accessibility, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H4. Contactos y bóveda inactiva (L)

- **Objetivo:**
  - dar de alta hasta 3 contactos por QR o por mensaje;
  - que cada contacto elija Telegram o Web Push sin crear cuenta;
  - que "Probar alerta" llegue de verdad;
  - que cada incidente nuevo envuelva `K` para los contactos listos.
- **Entregable:** M9 en la app; W1 y W3 (revocado, sin clave y sin conexión) en `<host-bóveda>` y en `<host-respaldo>`; el registro de accesos; el bot con su webhook; Web Push con VAPID; la prueba de punta a punta.
- **Condición de entrada:** P8 cerrado, o la decisión de seguir con Telegram como canal principal.
- **Incluye:**
  - Contactos, alta:
    - par X25519 y `accessId` de 128 bits por contacto;
    - invitación de 48 h (el servidor guarda solo el hash);
    - QR en persona, o enlace por mensaje con un aviso: solo por mensajeros cifrados de extremo a extremo, y borrar el mensaje cuando el contacto ya guardó sus direcciones (y, en iPhone, el enlace completo fuera del teléfono);
    - el contacto abre los dos enlaces (dos QR, o el segundo enlace que W1 muestra con la clave aún en memoria), y cada origen guarda su propia copia no extraíble; ninguna página escribe en otro origen; W1 muestra "Clave guardada en 2 de 2 direcciones" y reintenta la que falte;
    - la prueba de posesión se calcula al leer `#k` y el teléfono registra solo su SHA-256; la pública del contacto nunca sale del teléfono, y el alias va firmado por el dispositivo dentro de lo cifrado;
    - el enlace de invitación va al portapapeles marcado como sensible y se borra a los 60 s.
  - Contactos, después del alta: el teléfono olvida la privada cuando el contacto queda listo; el servidor impone el máximo de 3; revocar borra el canal y da de baja la suscripción.
  - Envoltura HPKE de `K` para cada contacto listo, con `info` ligado al incidente y al rol. El alias viaja cifrado para el contacto.
  - Worker, rutas:
    - `POST` y `DELETE /v1/contacts`, y `GET /v1/contacts` firmada (estado, canal y último acceso);
    - `POST /v1/contacts/:id/test`, con límite diario;
    - bóveda con rutas constantes: el `accessId` y la prueba de posesión derivada de `#k` viajan en cabeceras;
    - webhook `POST /tg/<ruta-secreta>` con `secret_token`.
  - Worker, registro de accesos: cada llamada de la bóveda con prueba válida deja una fila sin IP; límite de peticiones por `accessId`. Sin prueba válida, el mismo 404 sin fila y solo un contador agregado.
  - Worker, seguridad:
    - código de vinculación de Telegram de un solo uso y corta duración, distinto del `accessId`;
    - el bot nunca envía el enlace ni el host, descarta el campo `from` y borra cada aviso suyo cuando el contacto lo abre, dentro del plazo que permite la API;
    - `chat_id` y suscripción cifrados con AAD;
    - lista de servicios push permitidos, sub de VAPID neutro y push sin carga o solo con el tipo cifrado;
    - mapa de host a grupo de rutas.
  - Bóveda, entrega y clave:
    - estática y sin terceros, en un Worker propio (`<host-bóveda>`) y en el respaldo;
    - cabeceras en todas las respuestas: la página lleva CSP con Trusted Types, COOP, CORP, Permissions-Policy, `nosniff` y `no-store`; los blobs y el JSON, tipo exacto, `nosniff` y CSP `default-src 'none'; sandbox`;
    - `#a` y `#k` se leen una vez y `replaceState` los quita antes de cualquier petición;
    - la clave se guarda no extraíble en IndexedDB donde el navegador tenga X25519 en WebCrypto; donde no, respaldo con `@noble/curves`, declarado.
  - Bóveda, avisos e interfaz:
    - service worker solo para push, en `/sw/`, sin `fetch` ni caché y con textos fijos;
    - W1 con el texto nuevo sobre guardar el enlace, "Olvidar este enlace en este navegador", qué queda en el navegador, cómo borrar la entrada del historial y la recomendación de un navegador sin sincronización;
    - vuelta a la bóveda: W1 pide guardar las direcciones cortas de los dos hosts (`/v/`, sin secretos) como marcador o acceso con nombre neutro, y dice "si una no abre, prueba la otra"; el clic de la notificación abre el host que respondió la última vez;
    - en WebKit, W1 avisa de que el navegador borra la clave tras 7 días sin abrir el enlace y pide guardar el enlace completo fuera del teléfono (papel o gestor de contraseñas);
    - varias personas en un mismo navegador: una entrada por `accessId`; abrir una invitación nunca borra otra; `/v/` sin fragmento deja elegir por el alias descifrado; la suscripción push se comparte y solo se da de baja cuando no queda ninguna entrada;
    - "Olvidar este enlace" recorre los dos orígenes: borra el actual, navega al otro con `/v/#olvidar` (sin secretos), que borra y vuelve, y dice el resultado de cada uno; lo mismo al recibir un 410;
    - contactos con iPhone: solo Telegram en F2, y W1 lo dice;
    - guía del país antes de cualquier alerta;
    - Overpass recortada, servida por el Worker;
    - estados en 320, 600 y 1024 px.
  - M9 con todos sus estados, incluido "canal caído"; chip "N contactos listos" y aviso "Sin contactos, el SOS no avisa a nadie"; paso 6 de la configuración (se puede saltar).
- **Excluye:** alertas reales, temporizador y SOS (H5a); W2 (H5b); W4 (H7).
- **Criterios de aceptación:**
  - `pnpm --filter backend test` con reloj falso:
    - la invitación caduca a las 48 h (410);
    - con 4 altas simultáneas se crean exactamente 3 contactos;
    - el webhook sin cabecera responde 401 sin escribir;
    - un código de vinculación usado dos veces, o caducado, no vincula;
    - D1 no tiene el `chat_id` ni el endpoint en claro;
    - un endpoint push fuera de la lista responde 400;
    - una llamada de la bóveda sin prueba recibe el mismo 404 que un `accessId` inexistente, sin fila en el registro;
    - cada llamada con prueba deja una fila sin IP, y la que supera el límite por `accessId` recibe 429;
    - tras revocar, D1 no tiene ninguna fila de canal de ese contacto;
    - D1 no contiene la pública X25519 de ningún contacto, y un alias cambiado por el servidor no se muestra;
    - con el cliente de Telegram simulado, el bot pide borrar su aviso tras la apertura.
  - Kotlin y JS pasan los vectores de CFRG, JS abre una `K` envuelta por Kotlin, y abrir con el `info` de otro incidente falla.
  - Playwright en la imagen oficial (Chromium, Firefox y WebKit), contra los Workers locales:
    - seguridad de la página:
      - 0 violaciones de CSP;
      - `location.hash` vacío tras cargar;
      - clave no extraíble donde aplica;
      - 0 peticiones a otros orígenes, y ninguna URL lleva el `accessId`;
      - un push con url `javascript:` no navega (en Chromium, entregado por CDP; en Firefox y WebKit, prueba unitaria de los manejadores `push` y `notificationclick`);
      - un único service worker, con scope `/sw/`;
      - un `<img onerror>` en un alias se ve como texto;
    - dos orígenes: tras el alta, los dos tienen la clave y W1 abre en el segundo sin volver a usar el enlace;
    - "Olvidar este enlace" en A deja vacíos los IndexedDB de A y de B, y B muestra W3 "sin clave"; con B bloqueado, la página no afirma que se olvidó todo;
    - en un navegador con dos identidades, olvidar o revocar A deja a B con su acceso y su push;
    - en WebKit, W1 muestra el aviso de los 7 días;
    - ni W1, ni W3, ni el `<title>`, ni los textos del service worker dicen "Vigía";
    - estados y diseño: un enlace sin `#k` muestra "Abre el enlace original completo"; sin scroll horizontal en 320, 600 y 1024 px; foco visible.
  - Con un perfil persistente de Chromium se busca `#k` en la base de historial del perfil. El resultado va al informe y, si se confirma, a W1.
  - Prueba instrumentada: el enlace de invitación va al portapapeles marcado como sensible y a los 60 s el portapapeles está vacío.
  - `curl -sI` en dev:
    - la página lleva la CSP, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` y `nosniff`, sin `Set-Cookie`;
    - los blobs van con `application/octet-stream` y CSP `sandbox`.
  - De punta a punta:
    1. un segundo dispositivo se da de alta por QR, elige Telegram y pulsa Probar;
    2. "Tienes un aviso. Abre tu enlace." llega en menos de 2 min;
    3. M9 lo refleja.

    Lo mismo con Web Push en Chrome Android. Un bot bloqueado deja la fila en "canal caído".
  - Revocar desde M9: W3 "revocado" en menos de 1 min, y el siguiente incidente ya no lleva envoltura para ese contacto.
  - Ni el bot ni sus mensajes dicen "Vigía". `git grep` del nombre del bot, de los hosts y de la ruta del webhook devuelve 0 líneas.
- **Cubre de DESIGN.md:**
  - decisiones 5 (página estática, clave en el fragmento y cabeceras), 11, 19, 24, 26 (lecciones 1, 2 y 4) y 36 (contacto probado);
  - flujo D;
  - pantallas M1 (chip y aviso), M9, W1 y W3 (revocado, sin clave y sin conexión);
  - Cabeceras de la bóveda;
  - Typography: Overpass servida por el Worker;
  - configuración inicial, paso 6;
  - envoltura HPKE.
- **Seguridad:** BOV-02 (prueba de posesión), BOV-01C, BOV-02C, BOV-03C, BOV-04C, BOV-06C, BOV-07C, BOV-09C (revocado), BOV-11C, BOV-12C, BOV-13C, BOV-14C (dev), BOV-15C, BOV-16C, CIF-02, CIF-04, ID-01 (tokens), TG-01, PUSH-01, CAN-01, HOST-01 (mapa de rutas), HOST-02, LIM-01 (contactos), AND-12 (invitación), CFG-01 y SUM-02 (una sola librería criptográfica en la bóveda).
- **Requisitos:** el resultado de P8; el bot definitivo con nombre neutro; dos dispositivos de contacto (uno con Telegram y otro con Chrome).
- **Riesgos:**
  - Safari borra IndexedDB tras 7 días sin visitas: lo mitiga el aviso de W1; quien no guardó el enlace pierde el acceso hasta que se le reinvite (límite declarado).
  - El navegador interno de Telegram guarda mal los datos: W1 sugiere el navegador del sistema.
  - Una foto del QR expone la clave: por eso el alta es en persona por defecto.
  - Un host operativo puede estar bloqueado en VE: por eso hay respaldo en otro dominio.
- **Skills:** frontend-security-coder, web-performance-optimization, progressive-web-app, accessibility, cloudflare:workers-best-practices, cloudflare:wrangler, superpowers:test-driven-development, impeccable, taste-skill, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H5a. Avisa sola: temporizador, SOS y entrega (L)

- **Objetivo:** que el servidor avise solo cuando la persona ya no puede tocar el teléfono, que el SOS manual funcione sin red y que cada alerta llegue una sola vez, a tiempo o con el retraso declarado.
- **Entregable:** temporizador en el servidor con el cron; SOS (M6); entrega con repetición y acuse de apertura explícito; eje de aviso en la app; lecturas firmadas del estado del aviso y del registro de accesos.
- **Incluye:**
  - Órdenes, todas idempotentes por idPeticion:
    - `POST …/timer`: se arma con el acuse de la apertura; se extiende sin PIN como mucho 2 veces seguidas (el servidor también cuenta las extensiones y rechaza la tercera sin la marca de PIN); se desarma con PIN;
    - `POST …/sos`: el SOS sin grabación crea la apertura de un incidente sin audio, que no arma el temporizador; cancelarlo con el PIN lo cierra, y Grabar con la alerta activa continúa ese incidente;
    - idempotencia por estado: "extender" lleva el plazo que vio la app y el servidor solo lo aplica si coincide; la cuenta de extensiones seguidas solo se reinicia con un desarme o con una extensión marcada con PIN (marca que no resiste a root, y así se declara).
  - Cron:
    - transiciones condicionales en batch;
    - restricción única por incidente y tipo;
    - tabla de entregas (pendiente, enviado, fallido) que se reintenta;
    - antes de cada envío, comprueba que el contacto no está revocado;
    - lotes acotados y consultas con índice;
    - ninguna ruta HTTP lo dispara en producción.
  - Casos del flujo B: "conocido después de terminar"; retraso declarado; desarme tardío con las dos horas; "posterior a la alerta"; los fragmentos no extienden ni desarman.
  - Entrega (decisión 32):
    - a todos los contactos a la vez;
    - repetición a los 10 y a los 30 min mientras la alerta siga activa;
    - la cancelación solo se entrega a quien recibió la alerta; una entrega de alerta que seguía pendiente al cancelarse se envía una vez con el estado final, y la bóveda muestra la alerta y la cancelación con las dos horas;
    - "abierta" solo con un POST explícito tras descifrar;
    - "Otro contacto lo abrió a las HH:MM";
    - "Nadie lo abrió todavía" tras la repetición de los 30 min;
    - novedades como mucho cada 10 min;
    - contador agregado de la latencia de entrega.
  - Con una alerta activa, el servidor rechaza las órdenes del teléfono que reducen la protección: revocar contactos y cambiar canales (aquí), y apagar o pausar la falta de señales y programar borrados (H7).
  - Lectura firmada del estado del aviso y del registro de accesos de cada incidente, sin IP.
  - App, temporizador: rombo, "Extender 30 min" (la tercera seguida pide el PIN), "Extensión pendiente: si no llega al servidor, el aviso sale a las HH:MM" sin red, y recordatorio local 5 min antes con el plazo confirmado, con 2 vibraciones largas (NotificationManager y AlarmManager desde Kotlin; texto "Recordatorio pendiente").
  - App, SOS (M6): mantener 3 s, cuenta atrás de 5 s con Cancelar, "Avisando…", "Alerta enviada a N contactos" con 3 vibraciones largas, en cola sin red (el primero de la cola), estado "sin contactos" y cancelación con PIN.
  - App, resto: eje de aviso en M1, M2, M7 y M8; temporizador por defecto en M10; los tiempos de 3 s y 5 s se pueden ajustar.
- **Excluye:** W2 (H5b); coacción (H6); falta de señales, W4 y paquetes (H7).
- **Criterios de aceptación:**
  - `pnpm --filter backend test` con reloj falso y D1 local, temporizador:
    - dos cron en el mismo minuto: 1 alerta y 1 entrega por canal;
    - 200 carreras entre desarme y vencimiento: nunca 2 alertas; si la alerta salió, siempre la cancelación con las dos horas; si no salió, ninguna cancelación (QA-14, QA-24);
    - cron parado 10 min: "Aviso enviado con 10 min de retraso por un fallo nuestro" (QA-25);
    - apertura y cierre que llegan juntos y tarde: no se arma nada (QA-10, QA-26);
    - un fragmento posterior al vencimiento no extiende (QA-15);
    - "extender" reenviado deja el mismo plazo;
    - la tercera extensión seguida sin la marca de PIN se rechaza;
    - una extensión cuya respuesta se pierde y se reenvía a los 20 min deja el plazo de una sola extensión;
    - tras un SOS sin grabación cancelado con el PIN, a los 30 min no sale nada.
  - Mismas pruebas, entrega y acceso:
    - la repetición para con el primer POST de apertura, y un GET no la para;
    - un fallo simulado de Telegram deja la entrega pendiente y se reintenta;
    - fallo de Telegram para un contacto y desarme tardío: ese contacto recibe "Tienes un aviso. Abre tu enlace." una sola vez y nunca solo "Hay novedades";
    - un contacto revocado no recibe la repetición;
    - sin ninguna apertura, tras la repetición de los 30 min la cronología registra "Nadie lo abrió todavía";
    - un incidente ajeno pedido con prueba válida: 404 y fila en el registro de ese contacto; un `accessId` sin prueba válida: el mismo 404, sin fila (QA-19);
    - con SOS activo, revocar un contacto o cambiar su canal desde el teléfono responde 409.
  - Cada consulta del cron usa un índice (`EXPLAIN QUERY PLAN`). Con 10.000 incidentes sintéticos, las filas leídas por pasada crecen con lo vencido y no con el total; el informe anota las filas leídas al día frente al límite de D1, y la CPU y las subpeticiones de una pasada con 3 contactos y 2 alertas frente a 10 ms y 50.
  - En el teléfono:
    1. se graba con un temporizador de prueba de 2 min (solo en debug) y se deja vencer;
    2. Telegram y Web Push llegan en menos de 2 min;
    3. un fragmento enviado después queda "posterior a la alerta".
  - En M2, tras 2 extensiones seguidas, la tercera pide el PIN y, sin él, el plazo no cambia. Sin red, M2 muestra la extensión pendiente y el recordatorio local usa el plazo confirmado.
  - Con 450 sobres pendientes, un SOS hecho sin red sale el primero al volver la red y llega en menos de 2 min; con la subida al límite, el SOS no recibe 429.
  - `adb shell dumpsys notification --noredact` muestra solo "Servicio activo" y "Recordatorio pendiente", en canales neutros, con visibilidad secreta y sin acciones.
  - SOS:
    - soltar antes de 3 s no hace nada;
    - Cancelar en la cuenta atrás no envía nada;
    - sin red queda en cola y sale al volver;
    - con 0 contactos listos, M6 lo dice y nunca muestra "Alerta enviada a N contactos";
    - un SOS desde M1 sin grabar llega a los contactos, con red y sin ella;
    - al cancelar con PIN, el registro guarda "‹alias› canceló la alerta a las HH:MM con su PIN".
- **Cubre de DESIGN.md:**
  - decisiones 10, 22, 23 (2 y 3 largas), 26 (lección 5), 28 (eje de aviso), 32, 35 y 37 (latencia);
  - flujos B (1 a 3 y 5 a 8), C (1, 2 y 4) y F;
  - pantallas M2 (rombo), M6, M7 (marcas de SOS) y M10 (temporizador);
  - QA-10, QA-14, QA-15, QA-19, QA-24, QA-25 y QA-26.
- **Seguridad:** CRON-01, FIR-02 (órdenes), COA-01 (contactos y canales), LIM-01 (cupos del SOS), D1-02 (alertas y entregas), BOV-02 (apertura), BOV-02C, AND-13 (SOS y Cancelar), AND-14 y DAT-01.
- **Requisitos:** dos dispositivos de contacto que saben que son pruebas; aprobar los textos neutrales finales.
- **Riesgos:**
  - Carreras en el cron: las evitan las transiciones condicionales, la restricción única y las pruebas de concurrencia.
  - El plan Free limita a 10 ms de CPU y 50 subpeticiones externas por invocación del cron: varios avisos en el mismo minuto pueden superarlo. Se mide, y Workers Paid antes del piloto.
- **Skills:** superpowers:test-driven-development, cloudflare:workers-best-practices, cloudflare:wrangler, impeccable, taste-skill, accessibility, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H5b. Bóveda que verifica y reproduce (M)

- **Objetivo:** que el contacto vea, escuche y verifique la evidencia en su navegador, y que nada se muestre como evidencia sin pasar el verificador.
- **Entregable:** W2 y W3 (caducado y "no coincide"), y la prueba de punta a punta del teléfono quitado.
- **Incluye:**
  - Antes de mostrar nada, la bóveda comprueba la huella `d`, las firmas, la cadena, `c`, `p` y los acuses con `kid` fijado, y marca huecos, bifurcaciones y lo "posterior a la alerta" (un fragmento que llega tarde no lo es si su hash ya lo fijaban, antes de la alerta, el `prev` del siguiente o el cierre).
  - W2:
    - encabezado neutral (decisión 35), con "Esto no confirma qué pasó";
    - cronología, con "Otro contacto lo abrió a las HH:MM", "Nadie lo abrió todavía" y el registro de accesos;
    - `<audio>` sobre los fragmentos ADTS unidos (por tramos si una hora pesa demasiado); un incidente sin audio tiene su estado "SOS sin grabación", con texto neutral y sin reproductor;
    - posiciones con hora, coordenadas y precisión, con los huecos dichos y "Copiar" como acción principal ("Abrir en mapas" avisa antes);
    - "Ver prueba", "Extender 7 días" y guía del país.
  - W3 caducado (7 días tras el último fragmento; caducar no borra nada) y "no coincide".
- **Excluye:** "Descargar paquete" (H7).
- **Criterios de aceptación:**
  - Playwright en los tres motores, verificación:
    - W2 descifra 30 fragmentos y muestra "✓ 30 fragmentos, cadena íntegra…";
    - un byte cambiado muestra en rojo "Este fragmento no coincide con lo que firmó el teléfono";
    - si el servidor cambia la pública del dispositivo, todo falla por la huella;
    - un fragmento quitado aparece como hueco con su intervalo;
    - un acuse con `kid` desconocido falla;
    - un incidente abierto por un SOS sin grabación muestra el estado "SOS sin grabación", la cronología y la guía, sin reproductor ni "dejó de enviar", y su apertura verifica;
    - tras un SOS sin grabación y luego Grabar 1 min, los contactos reproducen ese audio en el mismo W2;
    - un fragmento que llega tarde con su hash fijado antes de la alerta no se marca "posterior a la alerta".
  - Mismas pruebas, página:
    - un `<script>` en una transcripción de prueba se ve como texto;
    - un enlace caducado lleva a W3;
    - sin scroll horizontal;
    - `Cache-Control: no-store` en los datos;
    - ni W2 ni su `<title>` dicen "Vigía".
  - "Ver prueba" muestra en cada fragmento `seq`, hash corto, firma ✓, acuse con la hora del servidor y "posterior a la alerta" cuando corresponde, y a 320 px pasa a pantalla completa. "Extender 7 días" mueve la caducidad y no reabre un enlace ya caducado.
  - Con perfiles persistentes de Chromium y Firefox, tras reproducir W2, una búsqueda en el perfil de un marcador del audio descifrado, del alias y de las coordenadas da 0 coincidencias.
  - Cuando el contacto abre W2 y descifra, en menos de 1 min M7 dice "1 la abrió" y M9 muestra su último acceso; pedir solo el HTML actualiza el último acceso pero no cuenta como apertura.
  - Teléfono quitado (QA-05): con un SOS activo y a mitad de la grabación, modo avión y forzar la detención sin volver a abrir la app. La bóveda reproduce y verifica exactamente los fragmentos con acuse (hasta el último "Respaldado hasta" visto en M2), ninguno más, y dice "el teléfono dejó de enviar a las HH:MM".
  - En Chrome Android, tras el vencimiento de H5a, la bóveda reproduce y verifica.
  - Un contacto de Telegram que borró la invitación llega a W2 desde la dirección corta que guardó.
- **Cubre de DESIGN.md:** decisiones 5 (caducidad y ampliación) y 30 (posiciones en la bóveda); pantallas W2 y W3; componentes de la bóveda web; E2E de la bóveda; QA-05.
- **Seguridad:** BOV-01, BOV-04C, BOV-05C, BOV-07C, BOV-09C (caducado) y BOV-10C.
- **Requisitos:** un contacto con Chrome Android; capturas de W2 en 320, 600 y 1024 px.
- **Riesgos:** una hora de audio en un móvil modesto del contacto; se mide y, si pesa, se reproduce por tramos.
- **Skills:** frontend-security-coder, web-performance-optimization, accessibility, superpowers:test-driven-development, impeccable, taste-skill, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H6. Modo avanzado: coacción, camuflaje y código de recuperación (L)

- **Objetivo:** que la app aguante el vistazo en la alcabala y el desbloqueo forzado, y que la persona tenga una llave fuera del teléfono.
- **Entregable:**
  - M0 calculadora;
  - alias del lanzador;
  - PIN de coacción y M11;
  - código de recuperación (obligatorio en modo avanzado y opcional en modo base) y flujo H en un segundo teléfono;
  - modo de solo escritura tras el cierre.
- **Incluye:**
  - P10 al empezar el hito.
  - Calculadora funcional con los colores dinámicos del sistema (respaldo neutro) y teclas de 72 dp:
    - PIN + "=" entra;
    - cualquier otro número se calcula sin error;
    - TalkBack la anuncia como calculadora;
    - la espera tras fallos se aplica sin mostrar nada, así que no rompe el camuflaje.
  - Cambio de icono y nombre con activity-alias (Vigía o Calculadora), con las reglas que dé P10. El camuflaje es un ajuste: la app se presenta y se promociona como Vigía.
  - Modo base o avanzado en M10 y en el paso 5 de la configuración, con los valores por defecto de VE.
  - PIN de coacción (al menos 2 dígitos distinto del real):
    - abre M11 y dispara el SOS en silencio, sin notificación ni vibración;
    - detiene la grabación de verdad;
    - finge desarmar, finge cancelar y, en el diálogo de la tercera extensión, finge extender;
    - no borra nada.

    Los dos PIN se comprueban siempre con el mismo coste, y en modo base existe un verificador de relleno.
  - M11 sin incidentes ni contactos y con tarjetas que funcionan. Mientras dura el señuelo no aparece ninguna notificación, vibración ni recordatorio de la app real, y la cola sigue subiendo en silencio.
  - Código de recuperación:
    - Crockford Base32, 24 símbolos en 6 grupos de 4 (120 bits);
    - confirmación de 2 grupos;
    - no se puede seleccionar ni copiar;
    - en modo base, opcional desde M10 (decisión de F1 10.2).

    De él salen, con HKDF-SHA256 y sal e info fijas, las claves X25519 y Ed25519. `K` también se envuelve para la recuperación. El servidor guarda la pública Ed25519, y cambiarla exige la firma de la vigente.

    Salvaguardas: con una alerta activa, el teléfono no puede crear ni cambiar la clave de recuperación; una clave creada después de la configuración inicial no tiene poderes durante 72 h, y M1 lo muestra todo ese tiempo ("Código de recuperación nuevo: se activa el DD-MM. Si no lo creaste tú, anúlalo con tu PIN"); una orden de recuperación que reduce la protección no vale sobre una alerta que empezó antes de que esa clave tuviera poderes. Al activarlo en modo base, el teléfono envuelve también las `K` que conserva, para que cubra lo ya grabado.
  - Worker: `GET /v1/recovery/incidents`, lectura de fragmentos firmada con la clave de recuperación, `POST /v1/recovery/ok` y `POST /v1/recovery/revoke`, firmadas con prefijo propio.
  - Teléfono revocado (decisión de F1 10.4): sus órdenes, sus lecturas firmadas y sus aperturas nuevas reciben la misma respuesta que una firma inválida; sus peticiones nunca cuentan como señal, y su aviso por falta de señales termina con una línea en la cronología. Solo se aceptan fragmentos y cierre de incidentes cuya apertura tuvo acuse antes de la revocación, marcados "recibido después de la revocación" por la hora de recepción. Se declara que aceptarlos le revela la revocación a quien tiene el teléfono.
  - "Tengo un código de recuperación" en la primera pantalla y "Abrir con código" en M8. En modo avanzado, al cerrar el incidente el teléfono olvida la envoltura local.
- **Excluye:** borrados con el código (H7); configuración inicial completa (H8a); ocultar la app ante un análisis forense (decisión 12).
- **Criterios de aceptación:**
  - Pruebas del Lock:
    - un PIN de coacción a 1 dígito del real se rechaza;
    - "1234 =" con otro PIN da 1234 sin ningún mensaje;
    - las esperas por fallos se aplican también en la calculadora, sin mostrar nada;
    - el esquema de `vault.db` es idéntico en modo base y en avanzado.
  - Prueba de componente: el código de recuperación no se puede seleccionar ni copiar.
  - Pruebas del Worker:
    - el SOS por coacción y la cancelación fingida dejan la alerta activa;
    - un código da siempre las mismas claves (vector fijo y variantes: minúsculas, espacios, O por 0, I y L por 1);
    - la firma de otro código recibe 401;
    - un teléfono revocado recibe, al desarmar, al cancelar un SOS y al abrir un incidente nuevo, la misma respuesta que una firma inválida;
    - un sobre de un incidente anterior que llega después de revocar se acepta marcado;
    - después de revocar, la bóveda sigue mostrando sus incidentes;
    - con el teléfono revocado, sus lecturas reciben la misma respuesta que una firma inválida, 10 peticiones suyas no aplazan W4 y una apertura con `hora_teléfono` anterior a la revocación se rechaza;
    - con un SOS activo, registrar una clave de recuperación da 409; una clave de menos de 72 h no cancela ni revoca;
    - el PIN de coacción en el diálogo de la tercera extensión muestra el plazo nuevo y dispara el SOS en silencio.
  - Con el camuflaje, el cajón de apps muestra "Calculadora", 7 × 8 = da 56 y PIN + "=" entra.
  - Otra persona revisa el teléfono durante al menos 2 h con el PIN de coacción, con un temporizador armado y la cola subiendo, siguiendo un guion: incidentes, contactos, ajustes, notificaciones, Recientes, "Apps activas" de los ajustes rápidos, uso de datos y de batería por app, panel de privacidad (micrófono y ubicación por hora), almacenamiento en Ajustes del sistema y sugerencias del teclado. Resultado: cero incoherencias, o cada una arreglada o declarada como límite en DESIGN.md antes de cerrar el hito.
  - Si se usa el PIN de coacción mientras graba: la notificación desaparece, no vibra, el Worker registra el SOS y la bóveda de los contactos muestra la alerta activa.
  - En un segundo teléfono:
    - "Tengo un código" lista los incidentes;
    - "Abrir con código" reproduce un incidente cerrado en modo avanzado;
    - con el primer teléfono en modo avanzado, sin SOS, en modo avión y con `adb shell am force-stop <paquete>` a mitad de la grabación, "Tengo un código" lista ese incidente, reproduce y verifica exactamente los fragmentos con acuse y dice "el teléfono dejó de enviar a las HH:MM";
    - "Estoy bien" cancela la alerta y la bóveda lo muestra "con su código, desde otro teléfono";
    - después de revocar, el primer teléfono ya no puede desarmar ni cancelar.
  - Instalación limpia en modo avión en modo avanzado, con el paso 5: al volver la red llegan la pública de recuperación y las envolturas de `K`, y "Tengo un código" lista ese incidente en el segundo teléfono.
  - En modo base, activar el código desde M10 permite "Tengo un código" en el segundo teléfono, también con un incidente grabado antes de activarlo.
  - TalkBack sobre la calculadora nunca dice "Vigía".
- **Cubre de DESIGN.md:**
  - decisiones 9, 12, 13, 14, 15 (avanzado), 17 y 33 (con el código opcional en modo base);
  - flujos A.1 (PIN + "="), B.3, C.3 y H;
  - pantallas M0, M8 (Abrir con código), M10 (modo, camuflaje, PIN y código) y M11;
  - componentes calculadora y teclado de PIN;
  - textos ocultos;
  - configuración inicial: paso 5 y "Recuperar con código".
- **Seguridad:** REC-01, COA-01 (la recuperación sí puede), FIR-04 (revocación), ERR-01, AND-12 (código), AND-13, AND-14 (coacción) y AND-16.
- **Requisitos:** una persona que haga de agente durante 2 h; un segundo Android; nombre e icono del disfraz (se recomienda "Calculadora").
- **Riesgos:**
  - El tamaño de los datos en los Ajustes del sistema, "Apps activas" y el panel de privacidad pueden delatar al señuelo: se arregla lo que se pueda y el resto se declara.
  - El lanzador del fabricante puede tardar en mostrar el cambio.
  - "Vigía" sigue visible a nivel de sistema (riesgo aceptado en la decisión 13).
  - Bajo estrés se pueden confundir los dos PIN.
  - El código en papel es una llave total: se advierte al crearlo.
- **Skills:** superpowers:test-driven-development, impeccable, taste-skill, accessibility, cloudflare:workers-best-practices, security-best-practices, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H7. Ciclo de vida de la evidencia y aviso por falta de señales (M)

- **Objetivo:** que la persona pueda borrar con plazo y deshacer, exportar o descargar el mismo paquete, y activar el aviso opcional por falta de señales.
- **Entregable:** borrado diferido con el candado real; "Exportar paquete" en M8 y "Descargar paquete" en W2; ajuste, latido, pausa y W4.
- **Incluye:**
  - Borrado con `POST|DELETE …/deletion` y `POST|DELETE /v1/recovery/deletion`:
    - oculta el incidente al instante en el teléfono;
    - el cron borra con las claves guardadas en D1 cuando el fragmento más reciente, por la hora de recepción del servidor, cumple 30 días, y nunca con una alerta activa del incidente o del teléfono (SOS, temporizador o falta de señales);
    - estados en D1: programado, borrando y borrado; al pasar a borrando (transición condicional en batch), la ingesta de ese incidente responde 409 y el cron reintenta hasta vaciar;
    - se deshace con el PIN;
    - revocar un teléfono cancela los borrados que programó;
    - con una alerta activa, el teléfono no puede programar borrados.
  - Sin borrado automático de los incidentes de teléfonos inactivos (decisión 7 de F1): el cron solo borra lo que la persona programó.
  - Paquete, contenido: formato de H1, con audio, registros, firmas, acuses, registro de accesos sin IP e instrucciones.
  - Paquete, exportar (M8, con PIN): baja lo respaldado con la lectura firmada, se genera en la caché privada con un FileProvider limitado, avisa antes de compartir y se borra al terminar y al arrancar.
  - Paquete, descargar (W2): solo con los fragmentos verificados, nombre neutro, aviso previo y sin enlace ni clave dentro.
  - Aviso por falta de señales:
    - ajuste en M10: apagado, 12, 24 o 48 h y "Pausar hasta", con `PUT /v1/devices/me/silence` (activar, pausar o apagar); la activación y la pausa se ven pendientes hasta que el servidor las confirma;
    - latido: `POST /v1/devices/me/heartbeat` cada hora con WorkManager; cualquier petición firmada cuenta como señal;
    - la hora firmada de la última señal se guarda solo con el aviso activo, se sobrescribe sin historial y se borra al apagarlo;
    - con una alerta activa, apagar o pausar el aviso responde 409, salvo con la firma de recuperación;
    - el servidor guarda la fecha de fin de la pausa, y el plazo cuenta desde ella;
    - solo cuentan como señal las peticiones con firma de petición de un teléfono no revocado;
    - avisos: recordatorio local 2 h antes ("Recordatorio pendiente"); el cron avisa con W4, que no muestra incidentes, caduca a los 7 días y se puede ampliar; después, "volvió a dar señales";
    - W1 nombra la falta de señales solo si está activa;
    - contador agregado de falsas alarmas: avisos seguidos de una señal nueva en menos de 6 h.
- **Excluye:** anclaje externo de sellos de tiempo (decisión 27).
- **Criterios de aceptación:**
  - Pruebas con reloj falso, borrado:
    - no borra con un SOS activo ni antes de los 30 días;
    - un fragmento de `seq` bajo subido tarde cuenta por su hora de recepción;
    - Deshacer lo conserva todo;
    - un teléfono revocado recibe el rechazo en `…/deletion` y sus borrados pendientes se cancelan;
    - un incidente de un teléfono sin señales durante meses no se borra solo;
    - un PUT durante el estado borrando no crea ningún objeto;
    - con W4 activo, un borrado vencido no se ejecuta.
  - Pruebas con reloj falso, falta de señales:
    - vence, se repite y avisa al volver (QA-09, QA-11 y QA-12);
    - una activación sin confirmar se ve pendiente en M10 y el servidor no avisa por ella;
    - una pausa sin confirmar muestra "Pausa pendiente: si no llega al servidor, el aviso sigue activo";
    - un latido reenviado no aplaza el aviso;
    - con el aviso apagado, tras 10 peticiones firmadas D1 no guarda ninguna hora de última señal;
    - con un SOS activo, `PUT /v1/devices/me/silence` para apagar o pausar responde 409, y con la firma de recuperación, 200;
    - el contador de falsas alarmas suma un aviso solo si llega una señal nueva antes de 6 h;
    - tras una pausa de 3 días sin señales, el aviso sale como pronto al fin de la pausa más el umbral;
    - reenviar 100 veces los sobres de un paquete no aplaza W4;
    - las consultas del cron usan índice, como en H5a.
  - Con el candado real, en un bucket de prueba con una regla de 1 día, un borrado anticipado falla con el error medido en P9 y el cron lo reintenta al vencer sin perder el estado.
  - Paquetes:
    - con el incidente ya respaldado, el ZIP de M8 y el de W2 pasan `pnpm --filter shared verificar` con el mismo resultado, y su registro de accesos es idéntico y sin IP;
    - tras compartir, `adb shell run-as <paquete> ls cache` (build depurable) no muestra nada;
    - el nombre cumple `paquete-AAAAMMDD.zip`;
    - dentro no hay `accessId`, `#k`, claves ni IP.
  - Playwright: W4 de un teléfono con incidentes sin SOS no muestra ninguno, "Extender" amplía sus 7 días, y W1 menciona la falta de señales solo con el aviso activo.
  - En el teléfono, con el umbral corto de debug:
    1. sin red aparece el recordatorio local;
    2. vencido el umbral, todavía sin red, la bóveda del contacto muestra W4;
    3. al volver la red, "volvió a dar señales".
- **Cubre de DESIGN.md:**
  - decisiones 16, 26 (lección 6), 31, 32 (falta de señales), 33 (borrados con el código), 34, 35 (falta de señales y señal recuperada), 36 (nunca borrar sin respaldo) y 37 (falsas alarmas);
  - flujos G e I;
  - pantallas M7 y M8 (borrado y exportar), M10 (falta de señales), W1 (falta de señales), W2 (Descargar paquete) y W4;
  - pruebas de borrado diferido y candado de R2;
  - Riesgos abiertos: retención.
- **Seguridad:** R2-02 (verificación real), CRON-01 (borrados y falta de señales), FIR-02 (latido), COA-01 (borrados y falta de señales), BOV-08C, AND-02 (FileProvider), AND-07 (temporal del paquete), AND-13 (Exportar y Borrar) y PRIV-01 (última señal).
- **Requisitos:** unas horas con el teléfono sin red.
- **Riesgos:**
  - WorkManager puede retrasar el latido: por eso el umbral mínimo es de 12 h.
  - Puede faltar espacio al generar el paquete: se avisa antes.
  - El candado retrasa el borrado real: el texto muestra la fecha.
- **Skills:** superpowers:test-driven-development, cloudflare:workers-best-practices, cloudflare:wrangler, frontend-security-coder, impeccable, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H8a. Configuración inicial, ajustes y pasada de diseño (M)

- **Objetivo:** cerrar el slice VE tal como lo vive una persona nueva, con todos los ajustes y una pasada de diseño y accesibilidad contra DESIGN.md.
- **Entregable:** configuración inicial completa, inicio honesto, M10 completo y el informe de la pasada de diseño.
- **Incluye:**
  - Configuración inicial completa (pasos 1 a 6) en 2 min o menos.
  - Inicio honesto (decisión 36) con todos sus estados.
  - M10 completo (sin el ajuste "datos móviles", que sale de F2 por la decisión de F1 10.1), con "Qué sale de tu teléfono": incluye la fila de la operadora (ve a qué dominio te conectas) y, para los contactos, que Web Push pasa por Google, Apple o Mozilla.
  - Guía de batería de los fabricantes que se prueban en H8b.
  - Pasada de diseño y accesibilidad contra DESIGN.md: día y noche, letra al 200 %, TalkBack, 48 dp y una acción dominante por pantalla.
- **Excluye:** censura y aceptación (H8b); M5 (con la IA, después de F2).
- **Criterios de aceptación:**
  - Una persona que no conoce la app llega de la instalación a Inicio en 2 min o menos (cronometrado).
  - Cada pantalla de M0 a M11 (salvo M5) y de W1 a W4 tiene su captura de día y de noche, con letra al 200 % y TalkBack revisado, y cada hallazgo queda arreglado o anotado.
  - M10 muestra la consecuencia de cada interruptor en una línea.
- **Cubre de DESIGN.md:** decisiones 6 (pista MCC), 9, 17, 25 y 36; configuración inicial (pasos 1 a 6); pantallas M1 (todos sus estados) y M10 (completo); Do's.
- **Seguridad:** se vuelven a verificar AND-04, AND-12 y AND-14 en las pantallas nuevas.
- **Requisitos:** una persona nueva para cronometrar la configuración; capturas.
- **Riesgos:** la pasada puede destapar cambios de diseño; los que toquen decisiones vuelven a aprobación.
- **Skills:** impeccable, taste-skill, accessibility, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

### H8b. Censura, aceptación de F2 y revisión de seguridad (L)

- **Objetivo:** pasar en un Android real la aceptación de F2 de DESIGN.md con los hosts definitivos, la censura simulada y la revisión de seguridad de la fase.
- **Entregable:** un APK de pruebas (pack en borrador, solo para pruebas) que pasa la aceptación, y el informe de cierre de F2 con mediciones y revisión de seguridad.
- **Incluye:**
  - Hosts y DNS:
    - `<host-api>` y `<host-bóveda>` en workers.dev y `<host-respaldo>` en pages.dev, en rotación;
    - DNS cifrado con varios resolvedores, fijados por IP, de los que respondieron en P8;
    - sugerencia de herramienta anticensura.
  - Entornos dev y producción separados, cada uno con sus secretos, D1 y R2, y su configuración fuera del repo.
  - Sin Logpush, y sin Web Analytics en los proyectos de Pages.
  - Métricas del piloto: se miden e informan; conciliación diaria de D1 y R2 con el script de solo lectura y lectura de los contadores agregados, sin id de dispositivo.
  - Pruebas en 3 fabricantes de gama baja, con las duraciones de fragmento que fijó el informe del pico: 30 min con la pantalla apagada, Doze, llamada, ubicación cada minuto y batería.
  - Revisión del señuelo repetida con el aviso por falta de señales activo.
  - Revisión de seguridad de la fase y corrección de los hallazgos altos y críticos.
- **Excluye:** firma legal y release público; pack CO (F3); Maestro, Detox y verificación integral (F4); Play Store, firma de release pública y huella (después de F4); bóveda reproducible (antes del piloto); iOS.
- **Criterios de aceptación:**
  - La lista de aceptación de F2 de DESIGN.md pasa en un Android real, con evidencia en el informe:
    1. 2 min sin red;
    2. sincronización;
    3. vence el temporizador;
    4. llegan Telegram y Web Push;
    5. la bóveda reproduce y verifica;
    6. coacción; borrado diferido (programar, ver "Se borra del servidor el DD-MMM · Deshacer" y deshacer; el borrado real ya se probó en H7 con la regla de 1 día); host de respaldo con el principal bloqueado; fragmento posterior a la alerta marcado.
  - Con el principal bloqueado en el punto de acceso del portátil (se descarta el SNI de `<host-api>`), "Respaldado hasta" avanza por el respaldo en menos de 2 min. Si caen todos los hosts, aparece el texto de E.2.
  - Con `<host-bóveda>` bloqueado de la misma forma, el contacto llega a la bóveda por `<host-respaldo>`, desde Telegram con la dirección guardada y desde la notificación push, con la clave del alta, y W2 verifica.
  - Integridad: la conciliación da 0 fragmentos con acuse que falten en R2 y 0 duplicados.
  - Métricas medidas e informadas, sin bloquear el cierre: arranque, "Respaldado hasta" con 3G o perfil degradado, avisos en menos de 2 min en 19 de 20 pruebas y batería en 1 h con la pantalla apagada y el teléfono desconectado, medida 2 veces.
  - En cada fabricante: 30 min con la pantalla apagada y Doze sin ningún minuto sin subida mientras hay red; la llamada deja el hueco marcado; la ubicación llega cada minuto; la batería queda anotada.
  - Otra persona repite al menos 2 h de revisión con el PIN de coacción, el guion de H6 y el aviso por falta de señales activo (umbral corto y parte del tiempo sin red): no aparece el recordatorio local ni ninguna notificación, vibración o recordatorio de la app real, y cada incoherencia queda arreglada o declarada en DESIGN.md.
  - Nombres: una captura de tráfico al grabar, sincronizar y abrir la bóveda (en el punto de acceso del portátil) no muestra ningún SNI con "vigia" ni "sos".
  - Producción, logs y bóveda:
    - la configuración de wrangler tiene `observability` desactivada y `preview_urls: false`;
    - un `accessId` marcador no aparece en Workers Logs ni en las métricas;
    - el HTML no lleva scripts añadidos por la plataforma;
    - la página de presentación no enlaza a ningún host operativo.
  - Producción, rutas y R2:
    - `/__scheduled` responde 404;
    - `wrangler r2 bucket lock list` muestra la regla de 30 días;
    - el bucket no tiene URL pública.
  - Desde un clon limpio: `pnpm -r test`, `./gradlew test` y la suite Playwright en verde; gitleaks con 0 hallazgos; `pnpm audit --prod --audit-level high` sin hallazgos, o con las excepciones anotadas.
  - La revisión de seguridad no deja hallazgos altos ni críticos abiertos.
  - El APK de pruebas está desinstalado de los teléfonos prestados.
- **Cubre de DESIGN.md:** decisiones 18 y 26 (lección 8); flujo E; pruebas en 3 fabricantes; Métricas del piloto; Aceptación de F2; Revisión de seguridad al cerrar la fase.
- **Seguridad:** HOST-01, HOST-03, RED-01, CRON-01 (producción), LOG-01 (producción), BOV-14C (hosts reales), R2-01 y R2-02 (producción), SEC-01 (entornos), CFG-01, SUM-02 (auditoría de cierre), OPS-02 (plan), AND-09 (DNS cifrado), WEB-01 y DAT-01. Además, se vuelven a verificar todos los requisitos de los hitos anteriores.
- **Requisitos:**
  - autorizar el despliegue de producción;
  - tres teléfonos de fabricantes distintos (pueden ser prestados);
  - el portátil como punto de acceso, para el bloqueo simulado y la captura de tráfico;
  - una persona que haga de agente durante 2 h;
  - aprobar el cierre de F2.
- **Riesgos:**
  - Resolvedores DNS cifrados bloqueados en VE.
  - Bloqueo de todo workers.dev o de todo pages.dev en VE: el respaldo cubre uno de los dos; si caen los dos, se valora un dominio propio antes del piloto.
  - Fabricantes que matan el servicio aunque esté exento.
  - La batería varía con la red.
- **Skills:** cloudflare:wrangler, cloudflare:workers-best-practices, security-review, ponytail:ponytail, antislop-code, superpowers:verification-before-completion.

## Pico técnico

**Ya comprobado el 12-oct-2026:**
- FTS5 con `unicode61 remove_diacritics 2`: "detencion" encuentra "detención".
- WebCrypto de Node tiene X25519, Ed25519 y P-256.
- Chromium decodifica AAC-LC ADTS mono a 16 kHz.
- Las pruebas de la app se hacen en teléfonos reales.

**Documentación de Cloudflare, consultada el 12-oct:**
- Plan Free: 100.000 peticiones al día; 10 ms de CPU por petición y por cron; 50 subpeticiones externas por invocación; 5 cron por cuenta.
- `observability` viene activada por defecto en los Workers nuevos.
- Sin un ajuste explícito, las URL de vista previa siguen el de workers.dev.
- El candado de R2 impide borrar y sobrescribir.
- Desde el 1-sep-2026, D1 Free falla al pasar los límites diarios de filas.

P1 (parte de la máquina de build), P5 (parte de la JVM y de Node) y P6 (parte de Playwright) se miden en H0a; el resto, en H0b, salvo P10, que se hace al empezar H6.

**P1. Compilación**
- Pregunta: ¿se compila sin emulador una app Expo con un módulo Kotlin y op-sqlite con SQLCipher y FTS5, y llega al teléfono?
- Experimento:
  1. instalar en el entorno aislado el JDK 17, el SDK de línea de comandos, build-tools, NDK y CMake;
  2. compilar el banco en release;
  3. repetir desde un clon limpio;
  4. instalarlo con adb desde el portátil (H0b).
- Criterio de éxito: BUILD SUCCESSFUL con un solo comando, un APK por ABI con su tamaño anotado y la app abre en modo avión.
- Plan B: como último recurso, EAS Build (pide cuenta de Expo y subir el código, que ya es público).

**P2. SQLCipher y FTS5 juntos**
- Pregunta: ¿conviven `legal.db` en claro con FTS5 y `vault.db` cifrada en op-sqlite?
- Experimento:
  1. compilar con sqlcipher y fts5;
  2. cargar el borrador VE en FTS5;
  3. abrir `vault.db` con una clave de 32 bytes envuelta por el Keystore;
  4. reabrirla sin clave;
  5. leer la cabecera;
  6. cronometrar la reconstrucción de `legal.db`.
- Criterio de éxito: "detencion" encuentra "detención"; `vault.db` no abre sin clave y no empieza por "SQLite format 3"; la reconstrucción tarda menos de 2 s.
- Plan B: FTS4 con el mismo tokenizador; si tampoco, LIKE sobre texto normalizado (el corpus es pequeño). Pasar a expo-sqlite cambiaría el stack, y eso se decide aparte.

**P3. Audio**
- Pregunta: ¿el gama baja codifica AAC-LC mono a 16 kHz y 32 kbps sin perder muestras, con el corte ADTS exacto y un arranque de menos de 2 s?
- Experimento:
  1. listar los codificadores con MediaCodecList;
  2. grabar con AudioRecord a 16 kHz en una sola sesión, cortando por tramas ADTS, con un clic de referencia cada 10 s desde otro aparato;
  3. contar las muestras PCM leídas frente al tiempo monotónico;
  4. cronometrar 20 arranques;
  5. analizar con `ffprobe` y `ffmpeg` lo exportado y descifrado.
- Criterio de éxito: aac (LC), 16000 Hz, mono y unos 32 kb/s; en 30 min, menos de 1 s de diferencia entre muestras y tiempo, y los clics en su sitio; los 20 arranques en menos de 2 s.
- Plan B: 24 o 44,1 kHz con los mismos 32 kbps (el peso lo fija la tasa de bits), o el codificador del fabricante. ADTS no cambia.

**P4. Segundo plano**
- Pregunta: ¿la cola en Kotlin sube 30 min con la pantalla apagada, en Doze y con el ahorro del fabricante, y se vacía tras Detener? ¿Cuánta batería gasta, con y sin ubicación?
- Experimento:
  - El servicio sube con un latido por minuto que queda en el registro de tiempos.
  - Tras Detener, la cola se vacía con WorkManager.
  - Doze: `adb shell dumpsys battery unplug` y después `adb shell dumpsys deviceidle force-idle`; al terminar, `adb shell dumpsys battery reset`.
  - Batería: con el teléfono desconectado del cable (adb inalámbrico, o lectura al reconectar), tras `adb shell dumpsys batterystats --reset`, 30 min con y sin una posición por minuto; se anotan brillo, red y temperatura, y se lee con `adb shell dumpsys batterystats`.
- Criterio de éxito: ningún minuto sin subida mientras hay red; la cola se vacía tras Detener; con ubicación, 4 % de batería o menos en 30 min.
- Plan B: si el fabricante mata el servicio, guía por fabricante y el aviso "Tu teléfono cerró la grabación a las HH:MM", que H3a implementa de todos modos.

**P5. Interoperabilidad criptográfica y Keystore**
- Pregunta:
  - ¿HPKE (suite 0x0020/0x0001/0x0002, modo base) interopera entre Kotlin y JS?
  - ¿la firma DER del Keystore se verifica en WebCrypto (P1363)?
  - ¿dónde verifica la app: en Hermes, que no trae WebCrypto, con una librería JS, o en Kotlin?
  - ¿cuánto tarda una firma del Keystore con TEE y con StrongBox?
- Experimento:
  - Vectores de CFRG (`test-vectors.json` en un commit fijado y con su SHA-256) en la JVM y en Node, más vectores cruzados en los dos sentidos (H0a).
  - Candidatas: Tink o BouncyCastle en Kotlin, `@hpke/core` en JS; peso de cada una en el APK con R8.
  - Un sellado real en el teléfono, abierto en la máquina de build (H0b).
  - Verificador sobre 450 sobres sintéticos (30 min a 4 s) en Hermes con la librería candidata y en Kotlin (H0b).
  - Latencia de 100 firmas con TEE y con StrongBox (H0b).
- Criterio de éxito: 100 % de los vectores; cruce en ambos sentidos; la firma del Keystore verificada; 30 min de evidencia verificados en menos de 5 s en el gama baja. Se elige la librería más ligera que lo pase todo, y TEE o StrongBox según la latencia.
- Plan B:
  - HPKE propio en modo base sobre primitivas probadas, con los mismos vectores.
  - Si firmar es lento, el PUT de un fragmento no lleva firma de petición: `s` ya autentica el contenido ante la clave del dueño del incidente, y el PUT es idempotente.

**P6. Navegadores de los contactos**
- Pregunta: ¿X25519 en WebCrypto, AES-GCM, HKDF y ECDSA P-256, y la decodificación ADTS, en los tres motores y en navegadores reales? (La bóveda no usa Ed25519.)
- Experimento:
  - La página de primitivas del banco en la imagen oficial de Playwright (Chromium, Firefox y WebKit), en H0a.
  - La misma página, servida en un host de prueba, abierta en Chrome Android, Samsung Internet y el navegador interno de Telegram (H0b). Safari iOS solo si hay un iPhone prestado; si no, queda declarado sin medir.
- Criterio de éxito: los tres motores pasan y la página da ✓ en todos los navegadores probados.
- Plan B: X25519 con `@noble/curves`, empaquetada en la bóveda, y WebCrypto para lo demás. Se declara que con la librería la clave sí es extraíble.

**P7. Duración del fragmento**
- Pregunta: ¿cuál es el valor más corto (2, 4 u 8 s) con el que la cola no crece en un gama baja con 3G degradada?
- Experimento:
  - El cliente de subida real contra la Worker de prueba, 30 min por cada duración, con red degradada por toxiproxy en la red aislada (subida de 96 kbit/s, RTT de 600 ± 200 ms y 3 % de pérdida).
  - En el teléfono, 10 min por duración y 30 min con el valor elegido, con la red preferida en 3G; si el operador no la ofrece, en el punto de acceso del portátil con conformado de tráfico y el mismo perfil.
- Criterio de éxito: la cola del minuto 30 no supera a la del minuto 1, y el retraso es de 2 fragmentos o menos el 95 % del tiempo.
- Plan B: 8 s con 2 subidas en vuelo sin romper el orden de los acuses. Si aun así crece, se declara el límite y M2 muestra el retraso real.

**P8. Venezuela**
- Pregunta: ¿llegan Web Push y Telegram en VE? ¿Qué resolvedores DNS cifrados responden allí? ¿Se puede llegar a workers.dev y a pages.dev?
- Protecciones de la persona que prueba:
  - consentimiento explícito del riesgo;
  - una cuenta de Telegram secundaria;
  - desde su línea solo se usa un host desechable (un proyecto de Pages con nombre neutro que nunca será de producción, no se reutiliza y se borra al terminar), nunca los hosts operativos;
  - el banco descarta el campo `from` y guarda solo el `chat_id` cifrado;
  - al terminar se borran el bot, sus mensajes, el host y los datos;
  - el informe del repo solo lleva agregados, sin ciudad ni horas;
  - su identidad nunca entra al repo.
- Experimento:
  - Se suscribe en Chrome Android, en la página desechable, y al bot de prueba.
  - Durante 3 a 5 días, la Worker de prueba envía unos 30 avisos sin contenido a horas al azar. En Web Push, el service worker anota la hora de llegada; en Telegram se anota si llegó y el minuto aproximado.
  - La página prueba Quad9, AdGuard, Mullvad, NextDNS, Google y Cloudflare, en cada operador disponible.
  - La accesibilidad de workers.dev y de pages.dev en VE se consulta en los datos públicos de OONI, sin usar la línea de la persona.
- Criterio de éxito: Telegram entrega el 95 % o más, dentro de la precisión con que se anota; Web Push queda medido; la página desechable carga en al menos un operador; al menos 2 resolvedores responden.
- Plan B: Telegram como canal principal en VE y Web Push para la diáspora. W1 sugiere una herramienta anticensura.

**P9. Cloudflare**
- Pregunta: ¿el candado de R2 impide borrar y sobrescribir, y con qué error? ¿Es puntual el cron cada minuto? ¿Quedan los registros sin URL ni IP? ¿Puede el respaldo en Pages usar los mismos D1 y R2?
- Experimento:
  - Un bucket de prueba con una regla de 1 día en `incidents/`: PUT, DELETE inmediato, otro PUT sobre la misma clave y DELETE tras vencer.
  - Un cron `* * * * *` que anota la hora durante 24 h.
  - Una petición con un `accessId` marcador, que después se busca en Workers Logs y en las métricas, con `observability` desactivada.
  - El mismo Worker como proyecto de Pages en modo avanzado, con los mismos D1, R2 y límite de peticiones.
- Criterio de éxito: DELETE y sobrescritura fallan con un error que la Worker distingue; el cron corre con menos de 60 s de retraso en el 99 % de las ejecuciones; el marcador no aparece; el respaldo en Pages lee y escribe en los mismos D1 y R2.
- Plan B:
  - Si el candado no está disponible, la ingesta idempotente y el borrado por claves de D1 siguen siendo correctos y se declara el riesgo.
  - Si el cron se retrasa, el retraso se declara como fallo nuestro y se evalúa el plan Paid.
  - Si Pages no puede ser el respaldo, el respaldo es otro nombre en workers.dev, y se declara que un bloqueo de todo workers.dev deja sin respaldo.

**P10. Lanzador (al empezar H6)**
- Pregunta: ¿el activity-alias cambia el icono y el nombre en el gama baja sin reiniciar y sin cortar una grabación?
- Experimento: dos alias y un botón para alternarlos, con y sin grabación activa, observando el lanzador, el cajón de apps y Ajustes.
- Criterio de éxito: el cambio se ve en menos de 10 s y la grabación no se corta (o el cambio queda bloqueado mientras se graba).
- Plan B: cambiar solo sin grabación y avisar "El icono puede tardar en cambiar".

## Requisitos de seguridad

Vienen de dos revisiones (servidor y criptografía; cliente, app y bóveda) y de la revisión adversarial del plan. Los de la revisión de cliente llevan el sufijo C (BOV-01C a BOV-15C) para no chocar con BOV-01 y BOV-02.

| Id | Componente | Requisito | Verificación | Hito |
|---|---|---|---|---|
| ENV-01 | Entorno de build | El código de terceros se instala y se ejecuta en un entorno que no ve nada fuera de su árbol de trabajo, no controla el host, usa un usuario sin privilegios y no tiene credenciales de GitHub; los secretos entran solo en la orden que los usa; las sesiones de Vigía no alimentan procesos automáticos de memoria o resumen | Desde el entorno de build, leer fuera de su árbol y controlar el host fallan; la exclusión de sesiones está anotada | H0a |
| FIR-01 | Firma de peticiones | Cadena canónica versionada con prefijo, método, ruta sin query, hora, idPeticion, idDispositivo y SHA-256 del cuerpo crudo; firma P1363 | Vectores idénticos en JS y JVM; cambiar cuerpo, ruta, método o añadir query da 401 | H1 |
| FIR-02 | Anti-reenvío | idPeticion firmado; UNIQUE(dispositivo, idPeticion); un duplicado devuelve el resultado original; idempotencia por estado en las órdenes (el plazo que vio la app y el idPeticion de la última orden aplicada) | "extender" reenviado, también a los 20 min, deja el mismo plazo; un SOS cancelado reenviado no crea alerta | H1, H5a, H7 |
| FIR-03 | Desfase de reloj | 401 `hora` con cabecera Date; el teléfono corrige su desfase sin tocar `hora_teléfono` | Reloj +2 h: 401 y luego 200; `r` conserva su hora | H1, H3a |
| FIR-04 | Alta y revocación | Prueba de posesión; pública P-256 válida y única; id generado por el servidor; un teléfono revocado recibe en sus órdenes, lecturas y aperturas nuevas la misma respuesta que una firma inválida y nunca cuenta como señal; solo se aceptan fragmentos y cierre de incidentes con apertura acusada antes de la revocación, marcados "recibido después de la revocación" | Alta firmada con otra clave: 401; respuesta idéntica byte a byte; sobre posterior marcado; apertura con hora anterior rechazada | H1, H6 |
| ENT-01 | Validación de entrada | Esquemas estrictos de shared; ids `^[A-Za-z0-9_-]{22}$`; `seq` canónico; Content-Type obligatorio; `r` sin claves duplicadas | Casos 400, 415 y 404 por ruta | H1 |
| ENT-02 | Tamaños y orden | bodyLimit por grupo de rutas (64 KB por fragmento, recalculado tras el pico); la URL coincide con el registro; `c = SHA-256(ct)`; fuera de orden aceptado, con `prev` comprobado cuando existe el anterior y la bifurcación marcada; con el cierre guardado, un `seq` mayor da 409; un PUT repetido no cambia la hora de recepción | 64 KB + 1 da 413, también sin Content-Length; `seq` 7 antes que 6, ambos aceptados; 100 reenvíos no cambian ninguna hora | H1 |
| ID-01 | Identificadores | 128 bits de CSPRNG en base64url; solo hashes de `accessId` y tokens | 10.000 ids sin repetirse; ningún id numérico salvo `seq` | H1, H4 |
| LIM-01 | Límites | 120 peticiones/min por id de dispositivo, con cupos separados para órdenes, subida y lecturas, contados después de verificar la firma; cuotas; pruebas de alerta al día; tope atómico de 3 contactos; una cuota nunca descarta evidencia | Petición 121: 429; con la subida al límite, el SOS no recibe 429; 4 altas simultáneas: 3 creadas; el sobre sigue en la cola | H1, H4, H5a |
| COA-01 | Órdenes con alerta activa | El teléfono no puede revocar contactos, cambiar canales, apagar ni pausar la falta de señales, programar borrados ni crear o cambiar la clave de recuperación; la recuperación sí, si su clave ya tenía poderes cuando empezó la alerta | Con SOS activo: 409; con firma de recuperación: 200 | H5a, H6, H7 |
| ERR-01 | Errores | Lista cerrada de códigos, sin pilas ni SQL; desconocido, firma inválida y revocado responden igual; ajeno e inexistente, el mismo 404 | Excepción: `{codigo: 'interno'}`; ninguna respuesta contiene SQLITE ni nombres de tablas | H1, H6 |
| LOG-01 | Logs | `observability` y trazas desactivadas; logs sin ids ni URL; nunca leer cabeceras de IP ni `request.cf`; registro de accesos sin IP | grep vacío; espía de console; el marcador no aparece en Workers Logs ni en las métricas | H0b, H1, H8b |
| PRIV-01 | Lo que guarda el servidor | Hora de la última señal solo con el aviso por falta de señales activo, borrada al apagarlo, y fecha de fin de la pausa; filas anti-reenvío borradas a los 10 min; solo cuenta como señal una petición con firma de petición de un teléfono no revocado | Reloj falso: 10 peticiones con el aviso apagado no dejan hora; ninguna fila anti-reenvío de más de 10 min | H1, H7 |
| D1-01 | Consultas | Solo `prepare` con SQL constante y `bind`; sin `exec` con datos; migraciones versionadas | grep de plantillas y `exec`; una inyección devuelve 0 filas | H1 |
| D1-02 | Esquema | PK(incidente, seq); UNIQUE de alertas, entregas, órdenes y hashes; CHECK; sin réplicas de lectura para el temporizador y la autorización | `sqlite_master` las muestra; insertar duplicados falla | H1, H5a |
| CRON-01 | Cron | Transiciones condicionales en batch; tabla de entregas con reintentos; la cancelación solo a quien recibió la alerta; borrado por estados (programado, borrando, borrado) y nunca con una alerta activa; consultas con índice; sin ruta HTTP del cron en producción | 2 cron dan 1 alerta; 200 carreras; fallo de Telegram reintentado; `EXPLAIN QUERY PLAN` con índice; `/__scheduled` da 404 | H5a, H7, H8b |
| R2-01 | R2: acceso y claves | Bucket sin URL pública; clave construida por el servidor tras comprobar el dueño; escritura única; acuse tras R2 y D1; el Worker nunca lista (la conciliación la hace un script externo de solo lectura) | El dispositivo B en un incidente de A: 404; mismo `seq` con otro `c`: 409 | H1, H8b |
| R2-02 | Candado | Regla de 30 días; la custodia de la cuenta forma parte del requisito | `lock list` muestra 30 días; un borrado anticipado falla | H3a, H7, H8b |
| TG-01 | Webhook de Telegram | `secret_token` comparado en tiempo constante; código de vinculación de un solo uso con caducidad; solo el `chat_id` cifrado; `from` descartado | Sin cabecera: 401 sin escribir; segundo uso: no vincula | H4 |
| PUSH-01 | Web Push | VAPID con sub https neutro; lista de servicios push; sin carga o solo el tipo cifrado; un 404 o 410 borra la suscripción | Endpoint http o fuera de la lista: 400; JWT con aud, exp y sub correctos | H4 |
| CAN-01 | Canales en reposo | AES-256-GCM con AAD de contacto, canal y versión de clave; un canal por contacto, y el cambio se ve; copia de seguridad de la clave de canales | La columna no contiene el `chat_id`; la AAD de otro contacto falla | H4 |
| SEC-01 | Secretos y entornos | Solo `wrangler secret put` desde un generador; entornos separados; `.gitignore` desde el primer commit; gitleaks antes de cada commit | git grep vacío; gitleaks 0; `secret list` con solo los esperados | H0a, H1, H8b |
| CFG-01 | Configuración de entornos | Hosts, ids de cuenta, D1, R2, bot, sub de VAPID y ruta del webhook se inyectan desde un archivo privado; el repo lleva una plantilla con valores ficticios; cada nombre real entra en la lista privada de patrones el día que se crea | `git grep` de cada valor real: 0 líneas | H0b, H1, H4, H8b |
| ACU-01 | Clave del acuse | Prefijo, `kid`, SHA-256(r) y hora; privada no extraíble; públicas con `kid` publicadas; procedimiento de rotación y de compromiso | 1 bit cambiado: inválido; clave de dev contra la lista de producción: inválido | H1 |
| ACU-02 | Verificar el acuse | Antes de borrar o contar: públicas fijadas por `kid` y el SHA-256(r) del mismo sobre; hosts fijados en el binario | Acuse falso: el sobre sigue y nada avanza | H3a |
| CIF-01 | AES-256-GCM | `K` nueva por incidente; nonce aleatorio de 96 bits; AAD `vigia/v1` ‖ tipo ‖ incidente ‖ seq | Vector igual en JS y JVM; la AAD de otro tipo o `seq` falla | H1, H3a |
| CIF-02 | HPKE | Suite fija en modo base; info `vigia/v1/envoltura` ‖ incidente ‖ rol; la privada del contacto nunca va al servidor | Vectores de CFRG en Kotlin y JS; el info de otro incidente falla | H1, H4 |
| CIF-03 | Formato de r | Codificación canónica; firma con prefijo sobre bytes exactos; apertura firmada con `country_code` como inicio de la cadena | Vectores; una clave duplicada se rechaza; sin apertura la cadena falla | H1 |
| REC-01 | Código de recuperación | Crockford Base32 de 24 símbolos (120 bits); normalización; HKDF con sal e info fijas; cambiar la pública exige la firma vigente; una clave creada después de la configuración inicial no tiene poderes durante 72 h y M1 lo muestra | Vector fijo igual en la app y el Worker; las variantes dan las mismas claves; sin la firma vigente: 401; una clave de menos de 72 h no cancela ni revoca | H6 |
| CIF-04 | Clave del contacto | CryptoKey no extraíble donde haya X25519; `replaceState`; la invitación recomienda canales cifrados de extremo a extremo | `location.href` sin `#k`; `exportKey` falla | H4 |
| BOV-01 | Verificación en la bóveda | Sobre datos crudos: huella `d`, firmas, cadena, `seq`, `c`, `p`, acuses con `kid` y "posterior a la alerta"; lo que falla no cuenta | Playwright con paquetes manipulados | H5b |
| BOV-02 | Autorización y apertura | Prueba `HKDF-SHA256(k, sal fija, "vigia/v1/acceso" ‖ accessId)` en una cabecera, de la que el servidor guarda solo el SHA-256 y nunca la pública del contacto; "abierta" solo con un POST tras descifrar; sin prueba, 404 sin fila (cuenta en un contador agregado) | Un GET no marca; el POST cancela las repeticiones | H4, H5a |
| HOST-01 | Separación de hosts | Un host por función (API, bóveda y respaldo) con su mapa de rutas; `preview_urls` false; sin CORS, cookies ni desafíos; `no-store` | Rutas cruzadas: 404; sin `Set-Cookie` | H4, H8b |
| HOST-02 | Respuestas que no son la página | Content-Type exacto, `nosniff`, CSP `default-src 'none'; sandbox`, CORP same-origin y `no-store`; `script-src` limitado a la ruta de recursos | `curl -sI`; un blob con `<script>` no se ejecuta | H4 |
| HOST-03 | Nombres visibles | Subdominio de workers.dev, Workers, proyecto de respaldo, bot y sub de VAPID neutros; fila de la operadora en "Qué sale"; ECH documentado | Lista de comprobación; grep en el APK | H0b, H8b |
| WEB-01 | Página de presentación | Estática, sin terceros ni analítica; cabeceras con CSP solo `self`, `frame-ancestors 'none'`, `nosniff` y `Referrer-Policy: no-referrer`; nunca enlaza ni nombra un host operativo; se publica solo desde `main` | `curl -sI`; Playwright sin peticiones a otros orígenes; grep de hosts operativos vacío | H0a, H8b |
| SUM-01 | pnpm | Lockfile congelado, versiones exactas, `packageManager` con hash, `minimumReleaseAge` 10080, trustPolicy no-downgrade, `allowBuilds` revisado | Revisión del workspace; un script no aprobado hace fallar la instalación | H1 |
| SUM-02 | Auditoría | `pnpm audit --prod --audit-level high` por hito; alertas de Dependabot sin PR; el Worker solo con hono y shared; una sola librería criptográfica en la bóveda | audit sin altos; árbol de producción del Worker con solo hono y shared | H1, H4, H8b |
| SUM-03 | Sin OTA | Sin expo-updates ni carga de JS remoto | `pnpm why` vacío; arranca en modo avión sin servidor | H2 |
| SUM-04 | Firma del APK | Clave de release fuera del repo y de EAS, copias cifradas, firmas v2 y v3 con linaje, huella publicada | `apksigner verify` | Fuera de F2: antes del primer APK que salga de los teléfonos de prueba |
| SUM-05 | Bóveda reproducible | Build determinista y hashes publicados; `verificar-boveda` | Dos builds dan los mismos hashes | Antes del piloto (F4) |
| SUM-06 | Repo público | Regla contra el push forzado y el borrado de `main`; escaneo de secretos y protección de push; se empuja solo la etiqueta aprobada | Ajustes de GitHub; `git ls-remote` | H0a |
| SUM-07 | Gradle | Versiones exactas; wrapper con `distributionSha256Sum`; verification-metadata | Revisión de los build.gradle y del wrapper | H1, H2 |
| OPS-01 | Cuenta de Cloudflare | Cuenta dedicada a Vigía; 2FA con llave; token mínimo con caducidad; subdominio de workers.dev neutro; desplegar desde un árbol limpio; sin conectores con OAuth amplio; revisar el registro de auditoría | Panel y `wrangler whoami` | H0b |
| OPS-02 | Plan y abuso | Workers Paid antes del piloto; tope global de altas por hora sin IP, con su cota calculada; el alta en cola nunca impide grabar; limits en wrangler | Por encima del tope: 429 y el teléfono sigue grabando; plan visible en el panel | H1, H3a, H8b |
| OPS-03 | Entorno de desarrollo | `wrangler dev` y Metro solo en 127.0.0.1; Playwright comparte la red del entorno de build, sin puertos publicados; el APK lleva el bundle dentro; nunca `expo start --tunnel` | `ss -ltnp`; una conexión desde fuera falla | H0a, H1, H2 |
| VAR-01 | Variantes | release no compila con un pack en draft, sin interruptor; pruebas con la clave de firma de pruebas y la banda de borrador; la clave de escucha, `capturas` y los extras de debug solo en debug y pruebas | `release-check`; `apksigner`; prueba de Gradle sobre los conjuntos de fuentes y el `BuildConfig`; búsqueda en el APK en el primer release | H2, H3a |
| DAT-01 | Datos de prueba | Grabaciones sin terceros en todas las pruebas de campo; clave de escucha de pruebas fuera del repo y destruida al cerrar F2; cada informe anota el audio subido; APK desinstalado de los teléfonos prestados | Informes; comprobación al devolver | H0b, H3a, H5a, H8b |
| BOV-01C | Clave en la bóveda | Leer `#a` y `#k` una vez y validarlos; importar la clave no extraíble; `replaceState` antes de nada; nunca a storage, red ni consola | Hash vacío; `exportKey` falla; el historial se mide | H4 |
| BOV-02C | Acceso por accessId | Prueba de posesión en toda acción; pedir el HTML no cuenta como apertura | Sin prueba: 404; una petición sin JS no cambia el estado | H4, H5a |
| BOV-03C | Cabeceras | CSP completa con Trusted Types, COOP, CORP, Permissions-Policy y `nosniff`; sin cookies ni CORS | `curl -sI` y prueba del middleware; un iframe no pinta la página | H4 |
| BOV-04C | Renderizado | Solo `textContent` o `createElement`; el lint prohíbe los sumideros; números validados | grep y lint; `<img onerror>` se ve como texto | H4, H5b |
| BOV-05C | Navegación | Solo `geo:` con números validados y rutas propias; aviso antes de abrir mapas; "Copiar" como acción principal | Vitest del enlace; Playwright de navegaciones | H5b |
| BOV-06C | Service worker | Uno solo, en `/sw/`, sin `fetch` ni caché; la carga push se trata como no confiable; texto fijo | `getRegistrations`; `caches.keys` vacío | H4 |
| BOV-07C | Caché | `no-store` en la página y en la API de la bóveda; `immutable` solo en los estáticos con hash; lo descifrado vive solo en memoria | curl; búsqueda en el perfil: 0 coincidencias | H4, H5b |
| BOV-08C | Descarga del paquete | Solo lo verificado; nombre neutro; sin enlace, clave ni IP; aviso previo | `suggestedFilename`; búsqueda en el ZIP | H7 |
| BOV-09C | Caducado o revocado | 410 con cuerpo mínimo; 404 si no existe; borrar la clave local y dar de baja la suscripción; extender no reabre | Vitest y Playwright | H4, H5b |
| BOV-10C | Verificar antes de mostrar | Nada se muestra como evidencia sin pasar el verificador con la huella `d` del enlace | Con otra pública del dispositivo, no se reproduce nada | H5b |
| BOV-11C | Sin terceros | Ningún recurso de otro origen; sin telemetría | `page.on('request')`: 100 % del propio origen | H4 |
| BOV-12C | Navegador revisado | W1 dice qué queda en el navegador y cómo borrar la entrada del historial; "Olvidar este enlace" recorre los dos orígenes con `/v/#olvidar` y dice el resultado de cada uno | Tras olvidar en A: IndexedDB vacío en A y en B, y W3; con B bloqueado, no afirma que se olvidó todo | H4 |
| BOV-13C | Alta por Telegram | Código de un solo uso y corta duración; `secret_token`; el bot nunca envía el enlace ni el host y borra sus avisos tras la apertura | Vitest; las plantillas no contienen el host ni `/v/` | H4 |
| BOV-14C | Plataforma | Sin scripts añadidos por la plataforma ni Logpush; el `accessId` no aparece en los registros ni en las métricas | curl sin scripts añadidos; búsqueda del marcador | H4, H8b |
| BOV-15C | accessId fuera de la URL | Enlace `/v/#a=…&k=…&d=…`; rutas de la API constantes; el `accessId` viaja en una cabecera con la prueba de posesión | `page.on('request')`: ninguna URL lleva el `accessId` | H4 |
| BOV-16C | Varias personas en un navegador | Una entrada por `accessId`; abrir una invitación nunca borra otra; la suscripción push se comparte y solo se da de baja cuando no queda ninguna entrada | Olvidar o revocar A deja a B con su acceso y su push | H4 |
| RED-01 | Nombres de host | Sin "vigia" ni "sos" en la API, la bóveda, el respaldo, los Workers ni el subdominio de workers.dev (la página de presentación es aparte y no se conecta a ellos) | Captura de SNI sin coincidencias | H8b |
| AND-01 | Copias de seguridad | `allowBackup` false y `dataExtractionRules` que excluye todo | apkanalyzer; `adb shell bmgr backupnow <paquete>` no copia nada | H2 |
| AND-02 | Componentes | Solo LAUNCHER exportado; FileProvider limitado; receptores no exportados | apkanalyzer; `adb shell am start -n <paquete>/<actividad>` denegado | H2, H7 |
| AND-03 | Enlaces profundos | Sin esquema propio ni App Links | `adb shell dumpsys package <paquete>` sin VIEW | H2 |
| AND-04 | Pantalla | `FLAG_SECURE` en toda ventana (salvo el APK `capturas`); vaciar lo descifrado al salir; vistas sensibles marcadas | `adb exec-out screencap -p` negro, también con un diálogo abierto | H3b |
| AND-05 | Keystore | Claves generadas dentro, nunca importadas; StrongBox o TEE; `K` nunca pasa a JS | Prueba instrumentada de securityLevel | H3a |
| AND-06 | vault.db | SQLCipher con clave raw de 256 bits envuelta; nada sensible fuera de la base | Cabecera; grep de una etiqueta: 0 | H3a |
| AND-07 | Audio en claro | Reproducción desde memoria; búferes a cero; el temporal del paquete se borra | Marcador de 64 bytes: 0 coincidencias | H3a, H3b, H7 |
| AND-08 | Logs de la app | Sin logs propios en release: R8 quita los nativos y Babel quita `console.*`; sin SDK de errores | Ninguna línea del PID de la app con ids, rutas, textos ni consultas | H2, H3a |
| AND-09 | Red | Sin texto plano; solo CAs del sistema; DoH fijado por IP | Una petición http falla; con una CA de usuario no conecta | H2, H8b |
| AND-10 | Acuses en la app | Igual que ACU-02 | Igual que ACU-02 | H3a |
| AND-11 | Sin WebView | Ni react-native-webview ni expo-web-browser | `pnpm why` vacío | H2 |
| AND-12 | Portapapeles y teclado | Código no copiable ni seleccionable; invitación marcada sensible y limpiada a los 60 s; campos sin autocorrección; PIN con teclado propio | Prueba instrumentada y de componente | H3b, H4, H6 |
| AND-13 | Tapjacking | Ignorar toques tapados en Grabar, Detener, SOS, Cancelar, PIN, Revocar, Exportar, Borrar y Estoy bien | Con una superposición, no avanza | H3a, H3b, H5a, H6, H7 |
| AND-14 | Notificaciones | Canales neutros, visibilidad secreta, sin acciones; solo "Servicio activo" y "Recordatorio pendiente"; la coacción no notifica ni vibra | `adb shell dumpsys notification --noredact` | H3a, H5a, H6 |
| AND-15 | Build de release | R8, no depurable, sin dev client ni OTA | aapt2 y apkanalyzer | H2 |
| AND-16 | PIN | HMAC con clave del Keystore; contador persistente; reloj monotónico que sobrevive al reinicio; mismo coste para los dos PIN; verificador de relleno | Pruebas con reloj falso; force-stop; reinicio | H3b, H6 |
| AND-17 | Permisos | Lista cerrada; sin ACCESS_BACKGROUND_LOCATION; foregroundServiceType microphone y location | diff de permisos vacío | H2, H3a, H3b |
| AND-18 | Dependencias nativas | verification-metadata de Gradle; SBOM; lista de dependencias prohibidas (Firebase, Google Play Services, expo-notifications, expo-location, expo-updates) que hace fallar la compilación | `./gradlew :app:dependencies`; apkanalyzer dex | H2 |
| AND-19 | Teclado y autocompletado | `IME_FLAG_NO_PERSONALIZED_LEARNING` e `importantForAutofill="no"` en todos los campos | Gboard no sugiere lo buscado en M4 | H2 |
| AND-20 | Escucha en modo base | Clave de lectura con `setUnlockedDeviceRequired`, distinta de la de firma; envoltura local de `K` para una pública cuya privada solo se abre con el PIN | Con la pantalla bloqueada, la lectura firmada falla; sin el PIN, la envoltura no abre | H3b |
| REPO-01 | Repositorio | gitleaks y hooks versionados (raya larga, correos que no sean noreply, teléfonos de VE y CO, patrones privados); `.gitignore`; `SECURITY.md` | Commits de prueba rechazados y aceptados según la regla; gitleaks 0; `ls-files` limpio | H0a |

## Cambios a DESIGN.md

DESIGN.md es la fuente de verdad, así que estos cambios se aplican en cuanto se aprueban.

**Al aprobar este plan (se aplican junto con él):**
1. **Formatos y firmas:** cadena canónica de las peticiones con idPeticion e idDispositivo y firma P1363; bytes canónicos de `r` con la apertura firmada (que lleva el `country_code`) como origen de la cadena; prefijos de dominio; AAD con codificación fija también para metadatos; `info` de HPKE ligado al incidente y al rol; acuse con prefijo y `kid`, verificado por la app con la clave fijada antes de borrar o contar; corrección del desfase del reloj; definición de "Respaldado hasta" como el último fragmento del tramo contiguo con acuse válido; idempotencia por estado en las órdenes; solo cuenta como señal una petición con firma de petición de un teléfono no revocado (FIR-01 a FIR-04, CIF-01 a CIF-03, ACU-01 y ACU-02).
2. **Ingesta:** clave de R2 construida por el servidor tras comprobar el dueño; escritura única; acuse tras R2 y D1; fragmentos fuera de orden aceptados, con `prev` comprobado cuando existe el anterior y la bifurcación marcada; "fragmento más reciente" medido por la hora de recepción; con el cierre guardado, un `seq` mayor da 409; un PUT repetido no cambia la hora de recepción ni las marcas; el límite cuenta después de verificar `s`, con cupos separados para órdenes, subida y lecturas; un fragmento que llega tarde no es "posterior a la alerta" si su hash ya lo fijaban antes el `prev` del siguiente o el cierre; conciliación externa de solo lectura (ENT-02, LIM-01 y R2-01).
3. **Cron y D1:** "vuelve a leer el estado en la misma transacción" pasa a ser transiciones condicionales en batch, restricciones únicas y una tabla de entregas con reintentos; la cancelación solo llega a quien recibió la alerta; sin réplicas de lectura para el temporizador ni la autorización; consultas con índice (CRON-01 y D1-02).
4. **Superficie de la API:** lecturas firmadas del dispositivo (fragmentos de un incidente, contactos con estado y último acceso, estado del aviso y registro de accesos); lectura de fragmentos firmada con la clave de recuperación; las lecturas del dispositivo, con una clave de lectura propia; el SOS sin grabación crea la apertura de un incidente sin audio, que no arma el temporizador, se cierra al cancelar con el PIN y continúa si se graba con la alerta activa (W2 tiene su estado "SOS sin grabación"); "abierta" cuenta solo con un POST explícito tras descifrar; registro de accesos sin IP y límite por `accessId` desde la primera llamada de la bóveda. Con esto, M8, "Abrir con código" y "Exportar paquete" leen lo ya respaldado del servidor: la copia local se sigue borrando con el acuse, y lo respaldado se escucha con red.
5. **Bóveda:** enlace `/v/#a=…&k=…&d=…` con rutas constantes y prueba de posesión en cabecera (BOV-02 y BOV-15C); cabeceras en todas las respuestas (HOST-02 y BOV-03C); un único service worker en `/sw/`; "Copiar" como acción principal de las posiciones y aviso antes de "Abrir en mapas"; aviso antes de "Descargar paquete", con nombre neutro; en W1, "Guarda este enlace en este navegador" se sustituye por un texto que no invita a guardarlo en marcadores sincronizados, más "Olvidar este enlace", qué queda en el navegador y la recomendación de un navegador sin sincronización; en WebKit, el aviso de los 7 días y el enlace completo guardado fuera del teléfono; durante el alta, el contacto abre los dos enlaces y cada origen guarda su propia copia de la clave ("Clave guardada en 2 de 2 direcciones"); vuelta a la bóveda por las direcciones cortas de los dos hosts, sin secretos; "Olvidar este enlace" recorre los dos orígenes; una entrada por `accessId` y una suscripción push compartida para quien es contacto de varias personas; prueba de posesión `HKDF-SHA256(k, sal fija, "vigia/v1/acceso" ‖ accessId)`, de la que el servidor guarda solo el SHA-256, sin la pública del contacto, y alias firmado por el dispositivo (BOV-12C y BOV-16C).
6. **Hosts:** `api.vigia.app` y `sos.vigia.app` pasan a `<host-api>`, `<host-bóveda>` y `<host-respaldo>`: dos Workers con nombres neutros en workers.dev y el respaldo en pages.dev, gratuitos y sin "vigia" ni "sos"; los nombres reales viven fuera del repo; un host por función con su mapa de rutas, `preview_urls: false`, sin CORS ni desafíos de bot (HOST-01, HOST-03, RED-01 y CFG-01). En F2 no se compran dominios.
7. **Superficie nueva, página de presentación:** `vigiaapp.pages.dev`, con el nombre, porque es lo que se promociona; estática, sin terceros ni analítica, publicada desde `sitio/` en `main`; nunca enlaza ni nombra un host operativo; mientras sea prototipo, avisa "Prototipo en construcción. Todavía no lo uses para protegerte." y no ofrece descarga (WEB-01). El camuflaje de la app sigue siendo un ajuste.
8. **Telegram y Web Push:** `secret_token`, código de vinculación de un solo uso, el bot nunca envía el enlace ni el host y borra sus avisos tras la apertura, lista de servicios push, sub de VAPID neutro, push sin carga o solo con el tipo cifrado, un canal por contacto (TG-01, PUSH-01, CAN-01 y BOV-13C). Los contactos con iPhone usan solo Telegram en F2.
9. **Coacción con el PIN real:** con una alerta activa, el servidor rechaza las órdenes que reducen la protección (revocar contactos, cambiar canales, apagar o pausar la falta de señales y programar borrados); solo la recuperación puede, y cambiar la pública de recuperación exige la firma de la vigente (COA-01 y REC-01).
10. **Código de recuperación:** Crockford Base32 de 24 símbolos (120 bits), normalización y HKDF-SHA256 con sal e info fijas (REC-01). Decisión 33: también opcional en modo base, desde M10, y al activarlo envuelve las `K` que el teléfono conserva. Salvaguardas: con una alerta activa no se crea ni se cambia; una clave creada después de la configuración inicial no tiene poderes durante 72 h y M1 lo muestra; una orden de recuperación no vale sobre una alerta que empezó antes de que la clave tuviera poderes.
11. **Teléfono revocado (flujo H.3):** sus órdenes, lecturas y aperturas nuevas se rechazan, y sus peticiones nunca cuentan como señal; solo se aceptan fragmentos y cierre de incidentes con apertura acusada antes de la revocación, marcados "recibido después de la revocación" por la hora de recepción.
12. **Temporizador (decisión 10):** extender sin PIN, como mucho 2 veces seguidas; la tercera pide el PIN (el de coacción finge extender y dispara el SOS en silencio); sin red, la extensión se muestra pendiente.
13. **PIN:** verificador HMAC con una clave del Keystore, contador persistente, reloj monotónico que sobrevive al reinicio, el mismo coste para los dos PIN y verificador de relleno; la espera se aplica en la calculadora sin mostrar nada; texto "Te quedan N intentos antes de esperar" desde el tercer fallo (AND-16).
14. **Android:** los requisitos AND-01 a AND-19 y SUM-03; notificaciones locales y ubicación con APIs de Android desde Kotlin; lista de dependencias prohibidas.
15. **Unidad de la cola de subida:** pasa de TypeScript a Kotlin, dentro del servicio, como una sola cola para todo lo firmado con prioridad fija (apertura; SOS y cancelación; desarme y extensión; cierre; latido; fragmentos); tras Detener, el servicio sigue hasta vaciarla; WorkManager de respaldo y pruebas JUnit con reloj virtual; JS solo lee el estado. Motivo: el hilo JS puede pausarse con la pantalla apagada y tras Detener, y entonces la evidencia no saldría antes de que quiten el teléfono.
16. **M10:** sale el ajuste "datos móviles" en F2.
17. **Plataforma Cloudflare:** cuenta dedicada; `observability` y trazas desactivadas; sin Logpush ni analítica; Workers Paid antes del piloto; tope global de altas con su cota (LOG-01, BOV-14C, OPS-01 y OPS-02).
18. **Lo que guarda el servidor:** la hora de la última señal solo con el aviso por falta de señales activo, y las filas anti-reenvío se borran a los 10 min (PRIV-01).
19. **"Qué sale de tu teléfono":** fila de la operadora, que ve a qué dominio te conectas (SNI); para los contactos, que Web Push pasa por Google, Apple o Mozilla.
20. **Retención (Riesgos abiertos):** ningún borrado automático de incidentes de teléfonos inactivos en la v1 ni en el piloto; se revisa con los datos del piloto y con un custodio legal antes del lanzamiento público.
21. **Variantes de prueba (VAR-01 y DAT-01):** debug y pruebas envuelven `K` también para la clave de escucha de pruebas (fuera del repo, destruida al cerrar F2) y admiten el interruptor `capturas` sin `FLAG_SECURE`; pruebas compila con packs en borrador y muestra la banda. Solo van a teléfonos de prueba con grabaciones sin terceros y nunca sirven para protegerse. Release no lleva nada de eso, y "Quién ve qué", la envoltura y el Do de `FLAG_SECURE` describen release.
22. **Lo opcional:** la IA, la transcripción, M5, la alerta legal con 2 vibraciones cortas y el temporizador de trayecto (flujo B.4) quedan fuera de F2.
23. **Riesgos abiertos y límites declarados:**
    - la cuenta de Cloudflare es la raíz de confianza: quien la controle puede servir una bóveda que robe las claves de los contactos; la vía independiente es el paquete descargado más el verificador abierto, y la bóveda reproducible llega antes del piloto (SUM-05);
    - el APK publicado revela los hosts a quien lo desensamble;
    - visitar la página de presentación delata el interés ante la operadora (SNI); la app nunca se conecta a ella;
    - la visita con `#k` puede quedar en el historial del navegador del contacto (se mide en H4);
    - Safari y los navegadores WebKit borran la clave del contacto tras 7 días sin abrir el enlace; quien no guardó el enlace pierde el acceso hasta que se le reinvite;
    - el paquete descargado nombra a Vigía en sus instrucciones de verificación;
    - un APK de pruebas en manos de una persona real expondría su evidencia al equipo;
    - en modo base, el PIN no es una barrera criptográfica ante un forense con root: la clave de `vault.db` está en el Keystore sin depender del PIN (se valora `setUnlockedDeviceRequired`);
    - el señuelo deja huellas que la app no controla: tamaño de los datos en Ajustes, panel de privacidad, "Apps activas", batería y datos por app;
    - si workers.dev y pages.dev quedan bloqueados en VE a la vez, no hay respaldo sin un dominio propio;
    - cada host que guardó claves de contactos es una raíz de confianza: un proyecto o un subdominio que sirvió la bóveda nunca se borra ni se renombra, porque otra persona podría registrar el mismo nombre; al retirarlo, sirve solo una página que borra el almacenamiento;
    - aceptar los sobres de un teléfono revocado le revela la revocación a quien lo tiene;
    - con root, el PIN de modo base se puede probar por fuerza bruta contra el Keystore del teléfono: la envoltura con el PIN sube el coste, no lo impide;
    - si la cola no funciona antes del primer desbloqueo, tras un reinicio nada sube hasta que la persona desbloquea el teléfono (se decide en H3a).
24. **Distribución:** la clave de firma de release se custodia fuera del repo y de EAS antes del primer APK que salga de los teléfonos de prueba (SUM-04).
25. **Pico técnico:** se quita Ed25519 de la línea de los navegadores (la bóveda no lo usa).
26. **Do's and Don'ts:** el carácter de "Nunca la raya larga" se escribe como "(U+2014)", para que los hooks no tengan que aceptarlo literal.
27. **Escucha en modo base:** las lecturas firmadas usan una clave de lectura con `setUnlockedDeviceRequired`, distinta de la de firma, y `K` se envuelve en local para una pública cuya privada solo se abre con el PIN: grabar no pide el PIN; escuchar, sí (AND-20).
28. **Borrado:** estados programado, borrando y borrado; durante el borrado, la ingesta de ese incidente responde 409; nunca se ejecuta con una alerta activa del incidente o del teléfono, tampoco la falta de señales (CRON-01).
29. **Falta de señales:** el servidor guarda la fecha de fin de la pausa y el plazo cuenta desde ella; las peticiones de un teléfono revocado no cuentan como señal (PRIV-01).

**Al cerrar H0b, con la aprobación de su informe:** formato de audio y duración del fragmento (decisiones 20 y 29); dónde guarda la cola los sobres (Bases locales); librería HPKE; dónde verifica la app y, si es en Kotlin, la frase "un único código"; respaldo X25519 de la bóveda; si el PUT de un fragmento lleva firma de petición; qué duraciones se prueban en los fabricantes; viabilidad del respaldo en Pages; canal principal en VE.

## Decisiones de F1 (12-oct-2026)

1. **Entorno de construcción:** se aísla (ENV-01). La persona responsable autoriza crear el entorno de build, el contenedor de Playwright y la red aislada de toxiproxy.
2. **Commits:** Claude hace commits pequeños en `main` durante cada hito, en español y con las pruebas en verde; al aprobar, etiqueta anotada, y la persona responsable empuja solo la etiqueta.
3. **Teléfono y herramientas:** gama baja Xiaomi o Redmi con Android 11 a 13 y 2 a 3 GB de RAM; APK instalado con adb desde el portátil (USB o depuración inalámbrica); JDK 17 y SDK de Android en el entorno de build.
4. **Cloudflare:** cuenta nueva solo para Vigía, con 2FA por llave y subdominio neutro; plan Free hasta antes del piloto; entorno dev público en workers.dev con nombres neutros y datos sintéticos; bot de Telegram de prueba con nombre neutro, cuyo token llega por un canal privado.
5. **Persona de confianza en VE:** sí, con un Android, en dos operadores si puede, con su consentimiento y una cuenta de Telegram secundaria; su identidad solo vive en el registro privado.
6. **Dominios:** en F2 solo subdominios gratuitos. La página de presentación es `vigiaapp.pages.dev`, con el nombre, publicada a producción desde GitHub; el servidor de la app, la bóveda y los avisos usan nombres neutros en workers.dev y pages.dev, nunca enlazados desde la página.
7. **Retención:** ningún borrado automático en la v1 ni en el piloto.
8. **Licencia:** Apache-2.0.
9. **Lo opcional:** el temporizador de trayecto y la IA con transcripción quedan fuera de F2.
10. **Decisiones menores:**
    1. el ajuste "datos móviles" sale de F2 (H8a);
    2. código de recuperación opcional en modo base, desde M10, con las salvaguardas de H6 (sin poderes durante 72 h y nunca con una alerta activa);
    3. como mucho 2 extensiones seguidas sin PIN (H5a);
    4. el teléfono revocado: fragmentos de incidentes ya abiertos aceptados y marcados; órdenes, lecturas y aperturas nuevas rechazadas (H6);
    5. la clave sigue en el enlace del contacto, con las medidas de H4;
    6. contactos con iPhone, solo Telegram en F2 (H4);
    7. el borrador del pack VE lo redacta Claude y la persona responsable revisa el tono y las fuentes (H2).

## Qué aporta la persona responsable y cuándo

| Recurso o decisión | Para qué | Cuándo | Si no llega |
|---|---|---|---|
| Pasos de H0a: registro privado fuera de la máquina o cifrado, caché del token a 5 min, exclusión de sesiones y ajustes de GitHub | ENV-01 y SUM-06 | H0a | H0a no cierra |
| Proyecto de Pages `vigiaapp` conectado al repo, solo con acceso a Vigia | Publicar la página de presentación | H0a | La página espera |
| Teléfono Android de gama baja con SIM y datos y la depuración USB activada | H0b y todos los hitos móviles | H0b | H1 se adelanta; H2 no empieza |
| adb en el portátil (USB o depuración inalámbrica en la red local) y ejecutar los guiones de adb | Instalar APK, Doze, logcat, `run-as`, capturas, pruebas instrumentadas y, en F4, Maestro | H0b | Muchos criterios no se pueden comprobar |
| Cuenta de Cloudflare dedicada, con 2FA por llave y token mínimo | Workers de prueba, R2, cron y canales reales | H0b | H1 se adelanta; P8 y P9 esperan |
| Bot de Telegram de prueba y luego el definitivo, con nombre neutro (token por un canal privado) | P8 y H4 | H0b y H4 | Solo Web Push |
| Persona de confianza en VE, con consentimiento y cuenta de Telegram secundaria | P8 | H0b, antes de H4 | Telegram principal y riesgo declarado |
| Autorización de cada despliegue de los Workers | Que nada operativo se publique sin permiso | H0b, H3a y H8b | No se despliega |
| Revisar el tono y las fuentes del pack VE | H2 | H2 | Sigue en borrador |
| Buscar abogado/a validador/a y entregarle el export por un canal privado | Firma del pack | En paralelo desde H2 | No bloquea F2, sí el release |
| Capturas de pantalla con adb | Revisiones de diseño | H2 a H8a | Fotos con otro teléfono |
| Un segundo teléfono para llamar | Hueco por llamada | H3a | El criterio de la llamada queda sin medir |
| Dos dispositivos de contacto (uno con Telegram y otro con Chrome) | Pruebas de punta a punta | H4 a H5b | Navegador del portátil para Web Push |
| Segundo Android | Flujo H | H6 | H6 no cierra los criterios del segundo teléfono |
| Una persona que haga de agente durante 2 h | Revisión del señuelo | H6 y H8b | El hito no cierra |
| Una persona nueva para cronometrar la configuración | H8a | H8a | El criterio queda como no medido y pasa al piloto |
| Tres teléfonos de fabricantes distintos y el portátil como punto de acceso | Fabricantes, bloqueo simulado y captura de SNI | H8b | Fabricantes en F4 |
| Horas de teléfono | Pruebas de campo | H0b: 4 a 6 h; H3a: 1 a 2 h; H5a: 1 h; H6: 2 a 3 h; H8b: varias horas | El hito no cierra |

En F2 no hacen falta ni cuenta de Expo (se compila en la máquina de build), ni cuenta de Google Play, ni dominios propios.

## Riesgos

- **Código de terceros en el build.** Lo cubre ENV-01.
- **El teléfono o Cloudflare tardan en llegar.** H1 se adelanta, con la regla de orden de los commits. Nada que dependa de MediaCodec, del servicio en primer plano o de la cola en el teléfono empieza antes de cerrar H0b.
- **El fabricante cierra el servicio.** Guía por fabricante y aviso "Tu teléfono cerró la grabación a las HH:MM" (H3a).
- **Formatos distintos entre Kotlin, TS y el navegador.** Vectores byte a byte desde H1 y especificación pública aprobada.
- **No se puede medir en VE.** Telegram como canal principal y el riesgo declarado en DESIGN.md.
- **Bloqueo de los hosts gratuitos en VE.** Respaldo en otro dominio (pages.dev) y datos de OONI; si caen workers.dev y pages.dev a la vez, se valora un dominio propio antes del piloto.
- **Límites del plan Free** (10 ms de CPU, 50 subpeticiones externas y 100.000 peticiones al día; además, desde el 1-sep-2026, D1 falla al pasar los límites diarios de filas). Un atacante podría agotarlos durante una ola de detenciones. Consultas con índice y Workers Paid antes del piloto.
- **Contenido legal erróneo o que instigue.** BORRADOR visible, release bloqueado, prueba de textos y revisión del tono en H2.
- **El señuelo delata.** Dos revisiones de 2 h con guion (H6 y H8b) y límites declarados.
- **La cuenta de Cloudflare es la raíz de confianza:** quien la controle sirve otra bóveda. Se mitiga con OPS-01 y, antes del piloto, con SUM-05.
- **Exponer a personas del proyecto.** Nada de nombres en el repo, hooks que lo comprueban, registro privado fuera del repo, informes de cierre privados y protecciones de P8.
- **Hitos que se alargan.** Ya están partidos (H0, H3, H5 y H8). Si uno pasa de una semana, se vuelve a partir en la parada.
- **Falsas alarmas a los contactos de prueba.** Saben que son pruebas, y el temporizador corto solo existe en debug.

## Qué queda fuera de F2 y por qué

- **Anclaje externo de los sellos de tiempo:** fuera de la v1 (decisión 27).
- **iOS:** Android primero (decisión 2). Web Push en iOS, hasta F4.
- **Pack CO, situación `protest` y cambio de país con dos packs reales:** F3, solo con datos. En F2, la independencia del país se prueba con el fixture CO.
- **Maestro o Detox y la verificación integral:** F4. Desde H2 las pantallas llevan testID estables.
- **Pruebas en fabricantes, si no hay tres teléfonos:** pasan a F4.
- **Play Store, firma de release pública y huella del certificado (SUM-04):** después de F4 y de la firma legal.
- **Bóveda reproducible (SUM-05):** antes del piloto. En F2 protegen el verificador abierto y el paquete descargable.
- **Dominios propios:** en F2 solo hosts gratuitos; se valoran antes del piloto si P8 u OONI muestran bloqueos.
- **Firma del/la abogado/a y release público:** no bloquean F2; sí la publicación.
- **Temporizador de trayecto (flujo B.4):** DESIGN.md no define su pantalla ni su API; queda para después de F2.
- **IA y transcripción:** después de F2, con su propio plan y su propia revisión de seguridad. Requisitos ya fijados para entonces: la transcripción con Groq apagada y con consentimiento (tercero, dato, propósito y plazo); Vigía IA solo reformula lo que FTS5 encontró y el Worker descarta las citas ajenas; Ollama por un túnel privado con token y solo en 127.0.0.1; la transcripción va delimitada como dato y la IA no tiene herramientas; la alerta legal con 2 vibraciones cortas, como mucho una por minuto; con la IA caída, grabar y subir siguen (QA-20).
- **Voz, multimodal e IA en el teléfono:** fase posterior (decisiones 4 y 38).
- **Custodio que pueda testificar y sostenibilidad:** no son software (Riesgos abiertos de DESIGN.md).
- **Ya descartado en F0:** pantalla negra (decisión 21), video (C4) y portal para personal (C1).

## Siguiente paso

1. Al aprobar este plan: se aplican los cambios a DESIGN.md y, antes del commit de F1, se pasa la lista privada de patrones sobre el plan y DESIGN.md.
2. Se escribe el plan detallado de H0a.
3. Se para en el checkpoint de F1, antes de tocar código.
