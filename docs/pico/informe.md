# Informe del pico técnico de F2

> Sin datos personales, números de serie, rutas de la máquina ni hosts reales. Los hosts van como marcadores.
>
> Esta es la parte de H0a: lo que se puede medir sin teléfono (P1 en la máquina de build, P5 en la JVM y en Node, y P6 en Playwright). El resto llega con H0b.

## Versiones fijadas (H0a)

Todas publicadas hace 7 días o más el 12-oct-2026.

| Pieza | Versión | Comprobación |
|---|---|---|
| Imagen base del entorno de build | ubuntu:24.04 | digest `sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55` |
| JDK | OpenJDK 17.0.20.1 (paquete de Ubuntu) | `javac -version` |
| Node | 24.21.0 | SHA-256 `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6` |
| Android cmdline-tools | 15859902 | SHA-256 `4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583` |
| Android platform-tools | r37.0.1 | instaladas con `sdkmanager` |
| Android NDK | 27.1.12297006 | lo fija React Native 0.86.3; Gradle lo instaló en el primer build |
| Android SDK Platform y build-tools | android-36; build-tools 35.0.0 y 36.0.0 | ídem (compileSdk y targetSdk 36, minSdk 24) |
| CMake | 3.22.1 | ídem |
| create-expo-app | 5.0.0, plantilla `blank-typescript@sdk-57` | npx con versión exacta |
| Expo | 57.0.26 | lockfile del banco |
| React Native | 0.86.3 | lockfile del banco |
| op-sqlite | 18.2.5, con `sqlcipher` y `fts5` | lockfile del banco |
| Gradle | 9.3.1 | wrapper de la plantilla |
| BouncyCastle | bcprov-jdk18on 1.86 | SHA-256 `2af190b300cbb0b35e248ccf5f4a06b6072030aeb3da7a98ec73abe5b4cb371f` |
| @hpke/core | 1.9.0 | lockfile del banco |
| Playwright | 1.63.0 | imagen `mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27` |
| wrangler | 4.147.0 | npx con versión exacta |
| gitleaks | 8.30.1 | imagen `zricethezav/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f` |
| Vectores HPKE | cfrg/draft-irtf-cfrg-hpke@5f503c564da00b0687b3de75f1dfbdfc4079ad31 | SHA-256 `61fc662f01996cd06d713dacf5e133167bd309a1f329442d53f1e21a47b3ede6` |

## Entorno de build aislado (ENV-01)

- Pregunta: ¿se puede compilar y probar sin que el código de terceros vea el registro privado, controle el host o tenga credenciales?
- Medición: el contenedor del entorno corre con el usuario 1001 y `CapEff` en 0, sin el socket de Docker, con el repo en solo lectura y sin acceso a nada fuera de su árbol de trabajo.
- Resultado: las cinco comprobaciones pasan. `javac` 17.0.20.1, `jlink` 17.0.20.1 y Node 24.21.0 responden. Tras corregir `safe.directory` en el Dockerfile, la imagen se reconstruyó y se comprobó en un contenedor nuevo: clona el repo y el banco, con las mismas restricciones.
- Decisión: todo el código de terceros de F2 corre ahí o en contenedores efímeros que comparten su red.

## P1. Compilación (parte de la máquina de build)

- Pregunta: ¿se compila sin emulador, en la máquina de build, una app Expo con un módulo Kotlin propio y op-sqlite con SQLCipher y FTS5?
- Medición: andamio de create-expo-app 5.0.0 (Expo SDK 57, React Native 0.86.3), op-sqlite 18.2.5 con `sqlcipher` y `fts5`, un módulo Kotlin local mínimo, `expo prebuild` y Gradle 9.3.1 en release con un APK por ABI (armeabi-v7a, arm64-v8a y x86_64), con JDK 17.
- Resultado:
  - primer build: `BUILD SUCCESSFUL` en 5 min 11 s (360 tareas);
  - desde un clon limpio del banco y con un solo comando: `BUILD SUCCESSFUL` en 2 min 55 s (con la caché de Gradle del entorno ya llena);
  - línea base de tamaño, sin R8 ni recorte de recursos:

    | ABI | Bytes |
    |---|---|
    | arm64-v8a | 33.002.634 |
    | armeabi-v7a | 26.120.350 |
    | x86_64 | 33.775.410 |

- Decisión: se compila en la máquina de build, sin EAS. Instalar el APK en el teléfono y abrirlo en modo avión queda para H0b.
- Notas de método:
  - la plantilla de Expo crea un repositorio git vacío dentro de `app/` que hay que quitar;
  - git necesita `safe.directory` también para la ruta `.git` de las fuentes de solo lectura (corregido en el Dockerfile);
  - en el primer build, Gradle descargó del repositorio de Google el NDK, las build-tools, CMake y la plataforma 36, con las licencias ya aceptadas. Para que el entorno se reconstruya sin descargas implícitas, quedan por preinstalar en el Dockerfile.

## P5. Interoperabilidad criptográfica (JVM y Node)

- Pregunta: ¿HPKE en modo base con la suite 0x0020/0x0001/0x0002 interopera entre la JVM y JS? ¿Una firma DER convertida a P1363 se verifica en WebCrypto?
- Medición:
  - el único vector de CFRG de esa suite y modo (257 cifrados), en la JVM con BouncyCastle 1.86 y en Node 24 con @hpke/core 1.9.0;
  - cruce en los dos sentidos con un receptor derivado de una semilla fija;
  - una firma ECDSA P-256 de la JVM (DER), convertida a P1363 y verificada con WebCrypto de Node, más una cambiada que no debe verificar.
- Resultado: 13 de 13 comprobaciones con ✓.
  - JVM: la pública derivada coincide; con la efímera del vector, `enc` coincide; los 257 cifrados sellan y abren; un byte cambiado no abre.
  - Node: la pública derivada coincide; los 257 cifrados abren; un byte cambiado no abre.
  - Cruce: Node abre lo que selló la JVM y la JVM abre lo que selló Node.
  - Firma: la P1363 de 64 bytes verifica en WebCrypto, y una cambiada no.
- Decisión provisional: BouncyCastle en la JVM y @hpke/core en JS. Se confirma en H0b con el peso en el APK, un sellado en el teléfono y la firma del Keystore.
- Nota de método: en la JVM 17 con locale POSIX hace falta `-Dfile.encoding=UTF-8` para leer el código fuente y escribir la salida en UTF-8.

## P6. Navegadores (Playwright)

- Pregunta: ¿tienen los tres motores las primitivas que necesita la bóveda (X25519 en WebCrypto, AES-GCM, HKDF y ECDSA P-256) y decodifican ADTS AAC-LC mono a 16 kHz?
- Medición: la página de primitivas del banco en la imagen oficial de Playwright 1.63.0, con una muestra ADTS de 4 s generada con ffmpeg.

| Primitiva | Chromium | Firefox | WebKit |
|---|---|---|---|
| X25519 (WebCrypto) | ✓ | ✓ | ✓ |
| AES-GCM | ✓ | ✓ | ✓ |
| HKDF | ✓ | ✓ | ✓ |
| ECDSA P-256 | ✓ | ✓ | ✓ |
| ADTS AAC-LC mono 16 kHz | ✓ | ✓ | ✓ |

- Resultado: 15 de 15 con ✓.
- Decisión: en los motores de escritorio no hace falta el respaldo de X25519 con @noble/curves. Se confirma en navegadores reales en H0b (Chrome Android, Samsung Internet y el navegador interno de Telegram).

## Página de presentación (WEB-01)

- Medición: `sitio/` servida con wrangler 4.147.0 en local y probada con Playwright en los tres motores.
- Resultado: 6 de 6 pruebas pasan: las cabeceras de `_headers` llegan (CSP con `default-src 'none'` y `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`), no hay peticiones a otros orígenes ni scroll horizontal a 320 px, y no se nombra ningún host operativo.

## Queda para H0b

P1 en el teléfono, P2, P3, P4, P5 en el teléfono, P6 en navegadores reales, P7, P8 y P9. Además, preinstalar en el Dockerfile los componentes del SDK que hoy instala Gradle.
