# H0a: base del repositorio y pico en la máquina de build. Plan de implementación

> **Para agentes:** sub-skill obligatoria: superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans, tarea a tarea. Los pasos usan casillas (`- [ ]`). Solo `main`: sin ramas ni worktrees, y un solo agente escribe y hace commits a la vez, siempre con `git add <rutas>`.

**Objetivo:** dejar un entorno de build aislado, el repo con sus defensas y la página de presentación, y medir sin teléfono la compilación (P1), la interoperabilidad criptográfica (P5) y las primitivas de los navegadores (P6).

**Arquitectura:**
- Todo el código de terceros (npm, Gradle, SDK de Android, wrangler y Playwright) corre en el contenedor `vigia-build` o en contenedores efímeros que comparten su red. Nunca en la máquina de trabajo.
- `vigia-build` lee el repo y el banco en solo lectura (`/fuente/vigia` y `/fuente/banco`), trabaja en su propio volumen (`/work`) y deja los resultados en `/salida`. Nada que genere entra al repo sin revisión.
- El banco del pico es un repositorio git local aparte, sin remoto. A `main` solo llegan sus resultados, en `docs/pico/informe.md`.

**Stack:** Ubuntu 24.04 (fijada por digest), OpenJDK 17, Node 24.21.0, SDK de Android (cmdline-tools 15859902), Expo SDK 57 (`expo` 57.0.26), `@op-engineering/op-sqlite` 18.2.5, BouncyCastle `bcprov-jdk18on` 1.86, `@hpke/core` 1.9.0, Playwright 1.63.0, wrangler 4.147.0 y gitleaks 8.30.1. Todas publicadas hace 7 días o más el 12-oct-2026.

**Spec:** `docs/plan/2026-10-12-plan-maestro-f2.md` (hito H0a y P1, P5 y P6), `DESIGN.md`, y las órdenes con rutas de la máquina en el archivo privado `h0a-entorno.md`.

## Restricciones globales

- ENV-01: ninguna orden de esta lista corre en la máquina de trabajo: `npm`, `npx`, `node` con dependencias de terceros, `gradlew`, `sdkmanager`, `java` con jars de terceros, `wrangler` ni `playwright`. Solo corren dentro de `vigia-build` (`docker exec vigia-build …`) o de un contenedor efímero.
- En la máquina de trabajo solo corren git, la biblioteca estándar de Python y `docker` (para crear contenedores, ejecutar en ellos y pasar gitleaks en un contenedor sin red).
- Versiones exactas, publicadas hace 7 días o más. Cada versión y su comprobación (SHA-256 o digest) quedan en el informe.
- Nada del banco entra al repo. En el repo, ni rutas de la máquina, ni nombres de personas, ni hosts reales.
- Textos en español. Nunca la raya larga: en el código se escribe `\u2014`.
- Commits pequeños, en verde, con el trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. La etiqueta `f2-h0a` solo se pone tras la aprobación.

## Foco de revisión

1. **Un nombre del registro privado escrito con otra grafía** (mayúsculas, tildes, espacios dobles o partido en dos líneas) pasa los hooks. Lo fijan `test_patron_con_grafia_distinta` y `test_patron_partido_en_dos_lineas` (tarea 4).
2. **Los hooks bloquean commits legítimos**: el trailer de coautoría, un correo de ejemplo, un hash largo o el JSON de vectores. Lo fijan `test_trailer_noreply_aceptado`, `test_correo_de_ejemplo_aceptado` y `test_hex_largo_no_es_telefono` (tarea 4).
3. **El entorno de build escribe en el repo o ve el socket de Docker.** Lo fija la comprobación del paso 5 de la tarea 1.
4. **La página de presentación pierde sus cabeceras o carga algo de otro origen.** Lo fija `sitio.spec.mjs` en los tres motores (tarea 5).
5. **El pico da por buena una cifra manipulada** (un falso positivo de interoperabilidad). Lo fijan los casos negativos "un byte cambiado no abre" en la JVM y en Node y "una firma cambiada no verifica" (tarea 7).

## Mapa de archivos

En el repo:

| Archivo | Responsabilidad |
|---|---|
| `entorno/Dockerfile` | Imagen del entorno de build aislado |
| `entorno/sincronizar.sh` | Copia una fuente de solo lectura al volumen de trabajo |
| `.gitignore` | Dependencias, builds, secretos y keystores fuera del repo |
| `SECURITY.md` | Cómo avisar de una vulnerabilidad, sin contactos personales |
| `README.md` | Qué es Vigía y el aviso de prototipo |
| `LICENSE` | Texto oficial de Apache-2.0 |
| `.githooks/comprobar.py` | Reglas del repo público (raya larga, correos, teléfonos, patrones privados) |
| `.githooks/test_comprobar.py` | Pruebas de esas reglas |
| `.githooks/pre-commit` y `.githooks/commit-msg` | Llaman a las reglas y a gitleaks |
| `sitio/index.html`, `sitio/estilos.css`, `sitio/_headers` | Página de presentación |
| `sitio/pruebas/` | Prueba Playwright de la página (`package.json`, lockfile, configuración y prueba) |
| `docs/pico/informe.md` | Informe del pico (P1, P5 y P6 en esta parte) |

Fuera del repo:
- Banco (repositorio local sin remoto): `app/`, `compilar.sh`, `p5/` y `p6/`.
- Archivo privado `h0a-entorno.md`: creación de `vigia-build`, rutas de la máquina y pasos de la persona responsable.
- Lista privada de patrones (`patrones.sha256`), fuera del repo.

---

### Tarea 1: entorno de build aislado

**Archivos:**
- Crear: `entorno/Dockerfile` y `entorno/sincronizar.sh`.
- Usar: las órdenes de creación del archivo privado `h0a-entorno.md`.

**Interfaces:**
- Produce: el contenedor `vigia-build` (usuario 1001, sin capacidades), el volumen `vigia-trabajo` en `/work`, las fuentes en solo lectura `/fuente/vigia` y `/fuente/banco`, la salida en `/salida` y la orden `sincronizar vigia|banco`.

- [ ] **Paso 1: escribir `entorno/sincronizar.sh`**

```sh
#!/bin/sh
# Copia una fuente de solo lectura al volumen de trabajo del entorno de build.
# Uso: sincronizar vigia | sincronizar banco
set -eu
origen="/fuente/$1/"
destino="/work/$1/"
[ -d "$origen" ] || { echo "No existe $origen" >&2; exit 1; }
mkdir -p "$destino"
# Lo que ignora git (dependencias y salidas de build) ni se copia ni se borra en el destino.
rsync -a --delete --exclude .git --filter=':- .gitignore' "$origen" "$destino"
```

- [ ] **Paso 2: escribir `entorno/Dockerfile`**

```dockerfile
# Entorno de build de Vigía (ENV-01): sin privilegios, sin credenciales y sin acceso al host.
# Las versiones llegan como argumentos y quedan anotadas en docs/pico/informe.md.
ARG BASE
FROM ${BASE}
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jdk-headless git curl unzip rsync ca-certificates python3 xz-utils ffmpeg \
 && rm -rf /var/lib/apt/lists/*
ARG NODE_VERSION
ARG NODE_SHA256
RUN curl -fsSLo /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
 && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
 && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 --no-same-owner \
 && rm /tmp/node.tar.xz
ENV ANDROID_HOME=/opt/android-sdk
ARG CMDLINE_TOOLS_ZIP
ARG CMDLINE_TOOLS_SHA256
RUN curl -fsSLo /tmp/clt.zip "https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP}" \
 && echo "${CMDLINE_TOOLS_SHA256}  /tmp/clt.zip" | sha256sum -c - \
 && mkdir -p "$ANDROID_HOME/cmdline-tools" \
 && unzip -q /tmp/clt.zip -d "$ANDROID_HOME/cmdline-tools" \
 && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" \
 && rm /tmp/clt.zip
COPY sincronizar.sh /usr/local/bin/sincronizar
RUN chmod 755 /usr/local/bin/sincronizar \
 && useradd -m -u 1001 -s /bin/bash vigia \
 && mkdir -p /work && chown vigia:vigia /work \
 && chown -R vigia:vigia "$ANDROID_HOME"
USER vigia
# Las fuentes son de otro usuario y se leen en solo lectura.
RUN git config --global --add safe.directory /fuente/vigia \
 && git config --global --add safe.directory /fuente/vigia/.git \
 && git config --global --add safe.directory /fuente/banco \
 && git config --global --add safe.directory /fuente/banco/.git
ENV PATH="/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:${PATH}" \
    WRANGLER_SEND_METRICS=false \
    NEXT_TELEMETRY_DISABLED=1 \
    EXPO_NO_TELEMETRY=1
# Instalar el SDK implica aceptar sus licencias (autorizado en la decisión 3 de F1).
RUN yes | sdkmanager --licenses > /dev/null && sdkmanager --install "platform-tools"
WORKDIR /work
```

Valores para los argumentos, comprobados el 12-oct-2026:
- `NODE_VERSION=24.21.0` y `NODE_SHA256=fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6` (de `SHASUMS256.txt` de nodejs.org).
- `CMDLINE_TOOLS_ZIP=commandlinetools-linux-15859902_latest.zip` y `CMDLINE_TOOLS_SHA256=4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583` (publicado en developer.android.com/studio y comprobado al descargarlo).
- `BASE`: `ubuntu:24.04` fijada por digest en el paso 3.

- [ ] **Paso 3: fijar la imagen base por digest**

Run (máquina de trabajo): `docker pull ubuntu:24.04 && docker inspect --format '{{index .RepoDigests 0}}' ubuntu:24.04`
Expected: una línea `ubuntu@sha256:<64 hex>`. Ese valor es `BASE` y va al informe.

- [ ] **Paso 4: construir la imagen y crear el contenedor**

Ejecutar las órdenes "Crear el entorno" del archivo privado `h0a-entorno.md`, con los valores de los pasos 2 y 3.
Expected: `docker ps --filter name=vigia-build --format '{{.Status}}'` muestra `Up …`.

- [ ] **Paso 5: comprobar el aislamiento (ENV-01)**

Run:

```sh
docker exec vigia-build sh -c '
  echo "usuario: $(id -u)";
  grep CapEff /proc/self/status;
  test -S /var/run/docker.sock && echo "MAL: ve el socket de Docker" || echo "bien: sin socket de Docker";
  touch /fuente/vigia/.prueba 2>/dev/null && echo "MAL: escribe en el repo" || echo "bien: el repo es de solo lectura";
  ls /fuente; javac -version; jlink --version; node --version'
```

Expected:

```
usuario: 1001
CapEff:	0000000000000000
bien: sin socket de Docker
bien: el repo es de solo lectura
banco
vigia
javac 17.<…>
17.<…>
v24.21.0
```

Si aparece cualquier línea con "MAL", se borra el contenedor (`docker rm -f vigia-build`) y se revisan las órdenes de creación antes de seguir.

- [ ] **Paso 6: commit**

```bash
git add entorno/Dockerfile entorno/sincronizar.sh
git commit -m "Añade el entorno de build aislado

Contenedor sin privilegios ni credenciales que lee el repo en solo
lectura y trabaja en su propio volumen (ENV-01).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Tarea 2: pasos de la persona responsable

**Archivos:** ninguno en el repo. Guía completa en el archivo privado `h0a-entorno.md`, sección "Pasos de la persona responsable".

- [ ] **Paso 1: lista privada de patrones.** Claude genera `patrones.sha256` desde el registro privado con `python3 -I .githooks/comprobar.py huellas-desde <lista>` (tarea 4), borra la lista temporal y comprueba que el archivo no contiene ningún nombre en claro: `grep -cvE '^[0-9a-f]{64}$' patrones.sha256` da `0`. Algunos nombres no se convierten en huellas porque bloquearían textos legítimos; para esos, la revisión de cada commit cubre el riesgo, y el criterio está en el archivo privado. La lista de huellas no protege ante quien entre en la máquina; su función es que un nombre no llegue al repo público por descuido.
- [ ] **Paso 2: registro privado.** La persona responsable lo saca de la máquina o lo cifra (guía del archivo privado). Comprobación: en la máquina de trabajo no queda una copia en claro.
- [ ] **Paso 3: caché del token de GitHub a 5 min.** La persona responsable ejecuta la orden del archivo privado. Comprobación: `git -C <repo> config --get-all credential.helper` muestra una línea vacía y `cache --timeout=300`.
- [ ] **Paso 4: sesiones fuera de la memoria automática.** Claude localiza, solo leyendo, la configuración de los procesos automáticos de memoria y resumen; la persona responsable excluye las sesiones de Vigía. Comprobación anotada en el archivo privado.
- [ ] **Paso 5: ajustes de GitHub.** Regla de `main` contra el push forzado y el borrado, escaneo de secretos, protección de push y aviso privado de vulnerabilidades. Comprobación: captura o descripción de cada ajuste en el archivo privado.
- [ ] **Paso 6: proyecto de Pages `vigiaapp`.** Creado con la rama `main`, sin framework, sin orden de build y con salida `sitio`; la app de GitHub de Cloudflare solo con acceso a este repo. Comprobación: tras el push de la etiqueta de H0a, `vigiaapp.pages.dev` sirve la página (tarea 5, paso 8).

### Tarea 3: base del repositorio

**Archivos:**
- Crear: `.gitignore`, `SECURITY.md`, `README.md` y `LICENSE`.

- [ ] **Paso 1: escribir `.gitignore`**

```gitignore
# Dependencias y salidas de build
node_modules/
.gradle/
build/
dist/
.expo/
*.apk
*.aab
# Secretos y claves (SEC-01)
.dev.vars
.env*
*.keystore
*.jks
*.p12
# Informes de pruebas y estado local de wrangler
playwright-report/
test-results/
.wrangler/
```

- [ ] **Paso 2: escribir `SECURITY.md`**

```markdown
# Seguridad

Vigía es un prototipo en construcción. Todavía no lo uses para protegerte.

## Cómo avisar de una vulnerabilidad

Usa el aviso privado de vulnerabilidades de GitHub: pestaña **Security** de este repositorio y después **Report a vulnerability**. Así el aviso solo lo ven quienes mantienen el proyecto.

No abras issues públicos con detalles de una vulnerabilidad, y no incluyas datos de personas reales.

## Qué pasa después

Respondemos por el mismo aviso privado. Si la vulnerabilidad se confirma, se corrige antes de publicar los detalles.
```

- [ ] **Paso 3: escribir `README.md`**

```markdown
# Vigía

> **Prototipo en construcción. Todavía no lo uses para protegerte.**

Vigía graba evidencia de un abuso sin llamar la atención, dice tus derechos al instante sin red y, si dejas de dar señales, avisa sola a tu gente con evidencia verificable.

- Diseño y decisiones: [DESIGN.md](DESIGN.md) y [PRODUCT.md](PRODUCT.md).
- Plan de construcción: [docs/plan/](docs/plan/).
- Seguridad: [SECURITY.md](SECURITY.md).

Licencia: [Apache-2.0](LICENSE).
```

- [ ] **Paso 4: descargar `LICENSE` y comprobarlo**

Run (máquina de trabajo; es un texto, no código):

```sh
curl -fsSLo LICENSE https://www.apache.org/licenses/LICENSE-2.0.txt
echo "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  LICENSE" | sha256sum -c -
```

Expected: `LICENSE: OK` (11358 bytes; comprobado el 12-oct-2026). Si no coincide, parar y avisar.

- [ ] **Paso 5: commit**

```bash
git add .gitignore SECURITY.md README.md LICENSE
git commit -m "Añade la base del repo público

.gitignore con secretos y builds fuera, aviso privado de
vulnerabilidades, README con el aviso de prototipo y licencia
Apache-2.0.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Tarea 4: hooks del repo público

**Archivos:**
- Crear: `.githooks/comprobar.py`, `.githooks/test_comprobar.py`, `.githooks/pre-commit` y `.githooks/commit-msg`.

**Interfaces:**
- Produce: `comprobar.py pre-commit`, `comprobar.py commit-msg <archivo>`, `comprobar.py secretos [<archivo>]` y `comprobar.py huellas-desde <archivo>`. Devuelve 0 si todo está bien y 1 si rechaza; nunca imprime el texto que coincidió, solo la regla y el archivo.
- Lee de la configuración local de git: `vigia.patrones` (ruta de la lista privada) y `vigia.gitleaks` (imagen de gitleaks fijada por digest). Ninguna ruta de la máquina va al repo.

> Nota del 12-oct-2026, al ejecutar: una revisión de seguridad encontró que la versión de abajo, que interpreta la salida de `git diff`, se podía saltar sin querer. Con `commit -a`, gitleaks leía el índice viejo y un token entraba. Las rutas con tildes, `diff.noprefix`, `.gitattributes` con `binary`, las líneas con `#` del mensaje y una lista de patrones vacía también dejaban pasar texto. El código vigente está en `.githooks/` (commits "Hace que los hooks revisen lo que de verdad entra en el commit" y "Revisa también lo que esconden la tijera, los invisibles y UTF-16"). Las reglas y gitleaks (`comprobar.py secretos`, por stdin y sin montar nada) reciben las mismas lecturas de los blobs del índice y revisan la ruta, el archivo completo y el mensaje entero; una lista de patrones mal formada bloquea. El código de abajo queda como registro del plan.

- [ ] **Paso 1: escribir las pruebas que fallan, `.githooks/test_comprobar.py`**

```python
"""Pruebas de las reglas del repo público (solo biblioteca estándar).

Los datos sensibles de prueba se construyen al ejecutar, para que este
archivo no contenga ni correos, ni teléfonos, ni la raya larga.
"""
import hashlib
import pathlib
import subprocess
import sys
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parent / "comprobar.py"
RAYA = "\u2014"
ARROBA = "@"
PATRON = "zoila ficticia"  # nombre inventado; no está en el registro real


def tel(*partes):
    """Une un teléfono de prueba partido, para que el archivo no lo contenga entero."""
    return "".join(partes)


class PruebasComprobar(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = pathlib.Path(self.tmp.name)
        self.repo = base / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        self.patrones = base / "patrones.sha256"
        self.patrones.write_text(hashlib.sha256(PATRON.encode()).hexdigest() + "\n")
        self.git("config", "vigia.patrones", str(self.patrones))

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True)

    def preparar(self, contenido, nombre="a.txt"):
        (self.repo / nombre).write_text(contenido, encoding="utf-8")
        self.git("add", nombre)

    def comprobar(self, *args):
        return subprocess.run([sys.executable, "-I", str(SCRIPT), *args],
                              cwd=self.repo, capture_output=True, text=True)

    def mensaje(self, texto):
        ruta = pathlib.Path(self.tmp.name) / "MENSAJE"
        ruta.write_text(texto, encoding="utf-8")
        return self.comprobar("commit-msg", str(ruta))

    def test_texto_limpio(self):
        self.preparar("Grabar y consultar derechos sin red.\n")
        self.assertEqual(self.comprobar("pre-commit").returncode, 0)

    def test_raya_larga_rechazada(self):
        self.preparar(f"Texto {RAYA} con raya\n")
        r = self.comprobar("pre-commit")
        self.assertEqual(r.returncode, 1)
        self.assertIn("raya larga", r.stderr)

    def test_correo_personal_rechazado(self):
        self.preparar(f"Escribe a alguien{ARROBA}correo.com\n")
        self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_correo_de_ejemplo_aceptado(self):
        self.preparar(f"prueba{ARROBA}example.invalid\n")
        self.assertEqual(self.comprobar("pre-commit").returncode, 0)

    def test_telefono_ve_rechazado(self):
        for numero in (tel("+5", "8 412 555 1234"), tel("0", "412-555-1234")):
            with self.subTest(numero=numero):
                self.preparar(f"Llama al {numero}\n")
                self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_telefono_co_rechazado(self):
        for numero in (tel("+57 3", "00 555 1234"), tel("3", "00 555 1234")):
            with self.subTest(numero=numero):
                self.preparar(f"Llama al {numero}\n")
                self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_hex_largo_no_es_telefono(self):
        self.preparar("61fc662f01996cd06d713dacf5e133167bd309a1f329442d53f1e21a47b3ede6 04125551234567\n")
        self.assertEqual(self.comprobar("pre-commit").returncode, 0)

    def test_patron_con_grafia_distinta(self):
        self.preparar("Reunión con ZOILA   Fíctícia mañana\n")
        r = self.comprobar("pre-commit")
        self.assertEqual(r.returncode, 1)
        self.assertNotIn("oila", r.stderr)  # nunca imprime el texto que coincidió

    def test_patron_partido_en_dos_lineas(self):
        self.preparar("Reunión con Zoila\nFicticia mañana\n")
        self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_sin_lista_privada_bloquea(self):
        self.git("config", "--unset", "vigia.patrones")
        self.preparar("Texto limpio\n")
        self.assertNotEqual(self.comprobar("pre-commit").returncode, 0)

    def test_mensaje_con_raya_rechazado(self):
        self.assertEqual(self.mensaje(f"Arregla algo {RAYA} rápido\n").returncode, 1)

    def test_trailer_noreply_aceptado(self):
        trailer = f"Co-Authored-By: Claude Opus 5.5 (1M context) <noreply{ARROBA}anthropic.com>"
        self.assertEqual(self.mensaje(f"Añade la base\n\n{trailer}\n").returncode, 0)

    def test_comentarios_del_mensaje_ignorados(self):
        texto = f"Añade la base\n# Escribe a alguien{ARROBA}correo.com\n"
        self.assertEqual(self.mensaje(texto).returncode, 0)

    def test_huellas_desde(self):
        lista = pathlib.Path(self.tmp.name) / "lista.txt"
        lista.write_text("Zoila  Fícticia\n\n", encoding="utf-8")
        r = self.comprobar("huellas-desde", str(lista))
        self.assertEqual(r.stdout.split(), [hashlib.sha256(PATRON.encode()).hexdigest()])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Paso 2: comprobar que fallan**

Run: `python3 -I .githooks/test_comprobar.py`
Expected: FAIL en todas, porque `comprobar.py` todavía no existe.

- [ ] **Paso 3: escribir `.githooks/comprobar.py`**

```python
"""Reglas del repo público de Vigía, para los hooks de git.

Rechaza, en lo que se añade y en el mensaje del commit:
- la raya larga (U+2014);
- los correos que no sean noreply ni de ejemplo;
- los teléfonos de VE o CO con prefijo o con separadores;
- las coincidencias con la lista privada de patrones (SHA-256 de frases normalizadas).

Uso: comprobar.py pre-commit | commit-msg <archivo> | huellas-desde <archivo>
"""
import hashlib
import re
import subprocess
import sys
import unicodedata

RAYA = "\u2014"
CORREO = re.compile(r"[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}")
CORREO_PERMITIDO = re.compile(
    r"^noreply@anthropic\.com$|@users\.noreply\.github\.com$|@example\.(?:com|org|net|invalid)$",
    re.IGNORECASE)
TELEFONO = re.compile(
    r"\+58[\s.-]?4\d{2}[\s.-]?\d{3}[\s.-]?\d{4}"   # VE con prefijo
    r"|\b04\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b"        # VE nacional
    r"|\+57[\s.-]?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}"  # CO con prefijo
    r"|\b3\d{2}[\s.-]\d{3}[\s.-]\d{4}\b")          # CO con separadores
MAX_PALABRAS = 4  # ponytail: nombres de hasta 4 palabras; subir si el registro tiene más largos


def palabras(texto):
    sin_tildes = unicodedata.normalize("NFKD", texto.lower())
    sin_tildes = "".join(c for c in sin_tildes if not unicodedata.combining(c))
    return re.findall(r"[a-z0-9]+", sin_tildes)


def huella(frase):
    return hashlib.sha256(" ".join(frase).encode()).hexdigest()


def huellas(texto):
    p = palabras(texto)
    for n in range(1, MAX_PALABRAS + 1):
        for i in range(len(p) - n + 1):
            yield huella(p[i:i + n])


def cargar_patrones():
    ruta = subprocess.run(["git", "config", "--get", "vigia.patrones"],
                          capture_output=True, text=True).stdout.strip()
    try:
        with open(ruta, encoding="utf-8") as f:
            return {l.strip() for l in f if re.fullmatch(r"[0-9a-f]{64}", l.strip())}
    except OSError:
        sys.exit("Falta la lista privada de patrones (git config vigia.patrones). Commit bloqueado.")


def problemas(texto, patrones):
    if RAYA in texto:
        yield "raya larga (U+2014)"
    if any(not CORREO_PERMITIDO.search(m.group(0)) for m in CORREO.finditer(texto)):
        yield "correo que no es noreply"
    if TELEFONO.search(texto):
        yield "número de teléfono"
    if any(h in patrones for h in huellas(texto)):
        yield "coincide con un patrón privado"


def añadido_por_archivo():
    diff = subprocess.run(["git", "diff", "--cached", "-U0", "--no-color", "--no-ext-diff"],
                          capture_output=True, text=True, check=True).stdout
    archivos, actual = {}, None
    for linea in diff.splitlines():
        if linea.startswith("+++ "):
            actual = linea[6:] if linea.startswith("+++ b/") else None
        elif linea.startswith("+") and actual:
            archivos.setdefault(actual, []).append(linea[1:])
    return {nombre: "\n".join(lineas) for nombre, lineas in archivos.items()}


def main(argv):
    modo = argv[1] if len(argv) > 1 else ""
    if modo == "huellas-desde":
        with open(argv[2], encoding="utf-8") as f:
            for linea in f:
                if palabras(linea):
                    print(huella(palabras(linea)))
        return 0
    if modo == "pre-commit":
        textos = añadido_por_archivo()
    elif modo == "commit-msg":
        with open(argv[2], encoding="utf-8") as f:
            textos = {"mensaje del commit": "".join(l for l in f if not l.startswith("#"))}
    else:
        print(__doc__, file=sys.stderr)
        return 2
    patrones = cargar_patrones()
    fallos = sorted({f"{nombre}: {p}" for nombre, texto in textos.items()
                     for p in problemas(texto, patrones)})
    if fallos:
        print("Commit rechazado por las reglas del repo público:", *fallos, sep="\n  ", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Paso 4: comprobar que pasan**

Run: `python3 -I .githooks/test_comprobar.py`
Expected: `Ran 14 tests` y `OK`.

- [ ] **Paso 5: escribir los hooks**

`.githooks/pre-commit`:

```sh
#!/bin/sh
# Reglas del repo público y búsqueda de secretos (REPO-01).
set -e
python3 -I .githooks/comprobar.py pre-commit
imagen=$(git config --get vigia.gitleaks || true)
[ -n "$imagen" ] || { echo "Falta git config vigia.gitleaks (imagen de gitleaks fijada por digest)." >&2; exit 1; }
# gitleaks corre en un contenedor sin red, con el repo en solo lectura (ENV-01).
docker run --rm --network none \
  -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/repo \
  -v "$(git rev-parse --show-toplevel)":/repo:ro \
  "$imagen" git --pre-commit --staged --redact --no-banner /repo
```

`.githooks/commit-msg`:

```sh
#!/bin/sh
exec python3 -I .githooks/comprobar.py commit-msg "$1"
```

Run: `chmod 755 .githooks/pre-commit .githooks/commit-msg`

- [ ] **Paso 6: fijar gitleaks por digest y activar los hooks**

Run (máquina de trabajo):

```sh
docker pull zricethezav/gitleaks:v8.30.1
docker inspect --format '{{index .RepoDigests 0}}' zricethezav/gitleaks:v8.30.1
```

Expected: `zricethezav/gitleaks@sha256:<64 hex>`. Ese valor va al informe y a la configuración local:

```sh
git config --local vigia.gitleaks 'zricethezav/gitleaks@sha256:<64 hex>'
git config --local vigia.patrones '<ruta de patrones.sha256 del archivo privado>'
git config --local core.hooksPath .githooks
```

- [ ] **Paso 7: commit (el propio commit ya pasa por los hooks)**

```bash
git add .githooks/comprobar.py .githooks/test_comprobar.py .githooks/pre-commit .githooks/commit-msg
git commit -m "Añade los hooks del repo público

Rechazan la raya larga, correos que no sean noreply, teléfonos de VE y
CO y coincidencias con la lista privada de patrones, y pasan gitleaks
en un contenedor sin red (REPO-01).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Expected: los hooks corren (reglas propias y gitleaks sin hallazgos) y el commit se crea.

- [ ] **Paso 8: probar los hooks de punta a punta**

Run, en un clon temporal junto al repo (la ruta tiene que poder montarse en el contenedor de gitleaks) y con la misma configuración local; nunca en el repo real:

```sh
tmp=$(mktemp -d "$(dirname "$PWD")/.prueba-hooks.XXXXXX") && git clone -q . "$tmp/r" && cd "$tmp/r"
for k in core.hooksPath vigia.gitleaks vigia.patrones; do git config --local "$k" "$(git -C "$OLDPWD" config --get "$k")"; done
git config user.name prueba && git config user.email prueba@example.invalid
printf 'clave = "ghp_%s"\n' "$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')" > secreto.txt
git add secreto.txt && git commit -qm "prueba" ; echo "salida: $?"
```

Expected: gitleaks informa un hallazgo (con el secreto tapado) y `salida: 1`. Después, con un archivo limpio y el trailer de coautoría, el commit pasa (`salida: 0`). Al terminar: `cd - && rm -rf "$tmp"`.

### Tarea 5: página de presentación

> Antes de empezar: preguntar a la persona responsable en qué modo aplica antislop (durante o después), como pide esa skill. Seguir los tokens de DESIGN.md: es un placeholder, sin rediseño.

**Archivos:**
- Crear: `sitio/index.html`, `sitio/estilos.css`, `sitio/_headers`, `sitio/pruebas/package.json`, `sitio/pruebas/package-lock.json`, `sitio/pruebas/playwright.config.mjs` y `sitio/pruebas/sitio.spec.mjs`.

**Interfaces:**
- Produce: la carpeta `sitio/` que Pages publica desde `main` (WEB-01).

- [ ] **Paso 1: escribir la prueba que falla, `sitio/pruebas/sitio.spec.mjs`**

```js
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
```

`sitio/pruebas/playwright.config.mjs`:

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

`sitio/pruebas/package.json`:

```json
{
  "private": true,
  "type": "module",
  "devDependencies": {
    "@playwright/test": "1.63.0"
  }
}
```

- [ ] **Paso 2: instalar en el entorno de build y copiar el lockfile**

Run:

```sh
docker exec vigia-build sh -c 'sincronizar vigia && cd /work/vigia/sitio/pruebas && npm install --ignore-scripts && cp package-lock.json /salida/sitio-package-lock.json'
```

Después, en la máquina de trabajo, revisar `/salida/sitio-package-lock.json` (solo `@playwright/test`, `playwright`, `playwright-core` y `fsevents` opcional) y copiarlo a `sitio/pruebas/package-lock.json`.

- [ ] **Paso 3: comprobar que falla**

Run:

```sh
docker exec -d vigia-build sh -c 'cd /work/vigia/sitio && npx --yes wrangler@4.147.0 pages dev . --ip 127.0.0.1 --port 8788'
docker run --rm --network container:vigia-build --user 1001:1001 -e HOME=/tmp -v vigia-trabajo:/work \
  -w /work/vigia/sitio/pruebas mcr.microsoft.com/playwright:v1.63.0-noble npx playwright test
```

Expected: FAIL, porque `sitio/index.html` no existe todavía.

- [ ] **Paso 4: escribir la página**

`sitio/index.html`:

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vigía</title>
<meta name="description" content="Vigía graba evidencia cifrada, dice tus derechos sin red y avisa a tu gente. Prototipo en construcción.">
<link rel="stylesheet" href="/estilos.css">
</head>
<body>
<main>
  <h1>Vigía</h1>
  <p class="cuidado" role="note">Prototipo en construcción. Todavía no lo uses para protegerte.</p>
  <p>Vigía graba evidencia de un abuso sin llamar la atención, dice tus derechos al instante sin red y, si dejas de dar señales, avisa sola a tu gente con evidencia verificable.</p>
</main>
</body>
</html>
```

`sitio/estilos.css` (tokens de DESIGN.md; el ámbar solo en la banda "Cuidado", con borde de tinta):

```css
:root {
  color-scheme: light dark;
  --fondo: #F6F7F5;
  --tinta: #1B1E1D;
  --secundario: #4A4F4C;
  --ambar: #F2A900;
  --tinta-sobre-ambar: #1B1E1D;
}

@media (prefers-color-scheme: dark) {
  :root {
    --fondo: #151817;
    --tinta: #ECEEEA;
    --secundario: #B9BEBA;
  }
}

html {
  background: var(--fondo);
  color: var(--tinta);
  font: 1rem/1.5 system-ui, sans-serif;
}

body { margin: 0; }

main {
  max-width: 40rem;
  margin: 0 auto;
  padding: 3rem 1rem;
}

h1 {
  font-size: 2rem;
  line-height: 1.2;
  margin: 0 0 1.5rem;
}

.cuidado {
  background: var(--ambar);
  color: var(--tinta-sobre-ambar);
  border: 2px solid var(--tinta-sobre-ambar);
  padding: 0.75rem 1rem;
  font-weight: 600;
}

```

`sitio/_headers`:

```
/*
  Content-Security-Policy: default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
```

- [ ] **Paso 5: comprobar que pasa**

Run: las dos órdenes del paso 3, tras `docker exec vigia-build sincronizar vigia`.
Expected: `6 passed` (2 pruebas × 3 motores).

- [ ] **Paso 6: comprobar que no nombra hosts operativos**

Run: `grep -rniE 'workers\.dev|<host-' sitio/ ; echo "salida: $?"`
Expected: `salida: 1` (ninguna coincidencia).

- [ ] **Paso 7: commit**

```bash
git add sitio/index.html sitio/estilos.css sitio/_headers sitio/pruebas/package.json sitio/pruebas/package-lock.json sitio/pruebas/playwright.config.mjs sitio/pruebas/sitio.spec.mjs
git commit -m "Añade la página de presentación

Página estática con el aviso de prototipo, sin terceros ni analítica,
con CSP estricta y su prueba en los tres motores (WEB-01).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Paso 8: después del push de la etiqueta (fuera de este hito)**

Al empezar H0b: `curl -sI https://vigiaapp.pages.dev/` muestra las mismas cabeceras del paso 4, y la prueba del paso 3 pasa con `-e SITIO=https://vigiaapp.pages.dev`.

### Tarea 6: banco y P1, compilación en release

**Archivos (banco, fuera del repo):** `app/` (andamio de Expo), `app/modules/banco/` (módulo Kotlin local), `compilar.sh` y `.gitignore`.

**Interfaces:**
- Produce: `/salida/p1/*.apk` (un APK por ABI) y `/salida/p1/tamaños.txt`, que van al informe.

- [ ] **Paso 1: crear el repositorio del banco**

En la máquina de trabajo, en la ruta del banco del archivo privado: `git init -q -b main` y este `.gitignore` (anclado, para no ignorar la carpeta `android/` del módulo Kotlin):

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
```

Sin remoto: `git remote -v` no muestra nada.

- [ ] **Paso 2: generar el andamio en el entorno de build**

```sh
docker exec vigia-build sh -c 'cd /work && rm -rf andamio && npx --yes create-expo-app@5.0.0 andamio --template blank-typescript@sdk-57 --no-install && rm -rf /salida/andamio && cp -r andamio /salida/andamio'
```

Expected: `/salida/andamio/package.json` con `"expo": "~57.0.…"`. Copiarlo a `app/` del banco sin su `.git`, `AGENTS.md` ni `LICENSE`: la plantilla crea ahí un repositorio git vacío que impide hacer commit en el banco.

- [ ] **Paso 3: fijar versiones y op-sqlite con SQLCipher y FTS5**

En `app/package.json` del banco: `expo` exacto a `57.0.26`, añadir `"@op-engineering/op-sqlite": "18.2.5"` y, en la raíz del archivo:

```json
"op-sqlite": {
  "sqlcipher": true,
  "fts5": true
}
```

- [ ] **Paso 4: escribir el módulo Kotlin local**

`app/modules/banco/expo-module.config.json`:

```json
{
  "platforms": ["android"],
  "android": { "modules": ["expo.modules.banco.BancoModule"] }
}
```

`app/modules/banco/android/build.gradle`:

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
}
```

`app/modules/banco/android/src/main/java/expo/modules/banco/BancoModule.kt`:

```kotlin
package expo.modules.banco

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Banco P1: solo comprueba que un módulo Kotlin propio compila y se enlaza.
class BancoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Banco")
    Function("hola") { "ok" }
  }
}
```

`app/modules/banco/index.ts`:

```ts
import { requireNativeModule } from 'expo';

export default requireNativeModule<{ hola(): string }>('Banco');
```

`app/App.tsx` (usa los dos módulos, para que el bundle de release los incluya):

```tsx
import { open } from '@op-engineering/op-sqlite';
import { Text, View } from 'react-native';
import Banco from './modules/banco';

export default function App() {
  const db = open({ name: 'banco.db' });
  db.close();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{Banco.hola()}</Text>
    </View>
  );
}
```

- [ ] **Paso 5: escribir `compilar.sh`**

```sh
#!/bin/sh
# P1: compila el banco en release, un APK por ABI. Se ejecuta dentro de vigia-build.
set -eu
cd "$(dirname "$0")/app"
npm ci
npx expo prebuild --platform android --clean --no-install
cat >> android/app/build.gradle <<'EOF'

// Banco P1: un APK por ABI
android {
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
(cd android && ./gradlew --no-daemon assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86_64)
mkdir -p /salida/p1
cp android/app/build/outputs/apk/release/*.apk /salida/p1/
ls -l /salida/p1/*.apk | awk '{print $5, $9}' > /salida/p1/tamaños.txt
cat /salida/p1/tamaños.txt
```

- [ ] **Paso 6: primer build y lockfile**

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/app && npm install && cp package-lock.json /salida/banco-package-lock.json && cd .. && sh compilar.sh'
```

Expected: `BUILD SUCCESSFUL` y tres APK con su tamaño. Copiar `/salida/banco-package-lock.json` a `app/package-lock.json` del banco y hacer commit en el banco.

- [ ] **Paso 7: build desde un clon limpio (criterio de P1)**

```sh
docker exec vigia-build sh -c 'rm -rf /work/limpio && git clone -q /fuente/banco /work/limpio && sh /work/limpio/compilar.sh'
```

Expected: `BUILD SUCCESSFUL` con un solo comando y los mismos tres APK. Si falla, el error exacto va al informe como resultado de P1, con su plan B.

### Tarea 7: banco y P5, interoperabilidad criptográfica

**Archivos (banco):** `p5/descargar.sh`, `p5/extraer.py`, `p5/Hpke.java`, `p5/node/package.json`, `p5/node/package-lock.json`, `p5/node/prueba.mjs` y `p5/correr.sh`.

**Interfaces:**
- Produce: la salida de `correr.sh` con ✓ o ✗ por comprobación, que va al informe.

- [ ] **Paso 1: escribir `p5/descargar.sh`**

```sh
#!/bin/sh
# Descarga los vectores de CFRG y BouncyCastle, comprobados por SHA-256.
set -eu
cd "$(dirname "$0")"
curl -fsSLo test-vectors.json https://raw.githubusercontent.com/cfrg/draft-irtf-cfrg-hpke/5f503c564da00b0687b3de75f1dfbdfc4079ad31/test-vectors.json
echo "61fc662f01996cd06d713dacf5e133167bd309a1f329442d53f1e21a47b3ede6  test-vectors.json" | sha256sum -c -
curl -fsSLo bcprov-jdk18on-1.86.jar https://repo1.maven.org/maven2/org/bouncycastle/bcprov-jdk18on/1.86/bcprov-jdk18on-1.86.jar
echo "2af190b300cbb0b35e248ccf5f4a06b6072030aeb3da7a98ec73abe5b4cb371f  bcprov-jdk18on-1.86.jar" | sha256sum -c -
```

- [ ] **Paso 2: escribir `p5/extraer.py`**

```python
"""Extrae a vector.txt el vector de Vigía: modo base, suite 0x0020/0x0001/0x0002."""
import json

with open("test-vectors.json", encoding="utf-8") as f:
    v = [x for x in json.load(f) if (x["mode"], x["kem_id"], x["kdf_id"], x["aead_id"]) == (0, 0x20, 1, 2)]
assert len(v) == 1, f"se esperaba 1 vector y hay {len(v)}"
v = v[0]
with open("vector.txt", "w", encoding="utf-8") as f:
    for k in ("ikmR", "pkRm", "ikmE", "enc", "info"):
        f.write(f"{k}={v[k]}\n")
    for e in v["encryptions"]:
        f.write(f"cifrado={e['aad']},{e['ct']},{e['pt']}\n")
print(f"vector.txt: {len(v['encryptions'])} cifrados")
```

- [ ] **Paso 3: escribir `p5/Hpke.java` (se ejecuta como archivo único, sin Gradle)**

```java
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.bouncycastle.crypto.AsymmetricCipherKeyPair;
import org.bouncycastle.crypto.hpke.HPKE;
import org.bouncycastle.crypto.hpke.HPKEContext;
import org.bouncycastle.crypto.hpke.HPKEContextWithEncapsulation;
import org.bouncycastle.util.encoders.Hex;

/** P5 en la JVM: vectores de CFRG, cruce con Node y firma DER convertida a P1363. */
public class Hpke {
  static final HPKE SUITE = new HPKE(HPKE.mode_base, HPKE.kem_X25519_SHA256, HPKE.kdf_HKDF_SHA256, HPKE.aead_AES_GCM256);
  static final byte[] IKM_CRUCE = "vigia-p5-receptor-de-prueba-0001".getBytes(StandardCharsets.UTF_8);
  static final byte[] INFO_CRUCE = "vigia/v1/prueba".getBytes(StandardCharsets.UTF_8);
  static final byte[] AAD_CRUCE = "aad de prueba".getBytes(StandardCharsets.UTF_8);
  static int fallos = 0;

  public static void main(String[] args) throws Exception {
    switch (args[0]) {
      case "vectores" -> vectores();
      case "sellar" -> sellar();
      case "abrir" -> abrir();
      case "firmar" -> firmar();
      default -> throw new IllegalArgumentException(args[0]);
    }
    if (fallos > 0) System.exit(1);
  }

  static void comprobar(boolean ok, String que) {
    System.out.println((ok ? "✓ " : "✗ ") + que);
    if (!ok) fallos++;
  }

  static Map<String, String> leer(String ruta) throws Exception {
    Map<String, String> m = new HashMap<>();
    for (String l : Files.readAllLines(Path.of(ruta))) {
      String[] kv = l.split("=", 2);
      m.put(kv[0], kv[1]);
    }
    return m;
  }

  static void vectores() throws Exception {
    Map<String, String> v = new HashMap<>();
    List<String[]> cifrados = new ArrayList<>();
    for (String l : Files.readAllLines(Path.of("vector.txt"))) {
      String[] kv = l.split("=", 2);
      if (kv[0].equals("cifrado")) cifrados.add(kv[1].split(",", -1)); else v.put(kv[0], kv[1]);
    }
    byte[] info = Hex.decode(v.get("info"));
    byte[] enc = Hex.decode(v.get("enc"));
    AsymmetricCipherKeyPair r = SUITE.deriveKeyPair(Hex.decode(v.get("ikmR")));
    comprobar(Arrays.equals(SUITE.serializePublicKey(r.getPublic()), Hex.decode(v.get("pkRm"))), "pkR derivada coincide");
    HPKEContextWithEncapsulation s = SUITE.setupBaseS(r.getPublic(), info, SUITE.deriveKeyPair(Hex.decode(v.get("ikmE"))));
    comprobar(Arrays.equals(s.getEncapsulation(), enc), "enc coincide");
    HPKEContext rc = SUITE.setupBaseR(enc, r, info);
    int ok = 0;
    for (String[] c : cifrados) {
      byte[] aad = Hex.decode(c[0]), ct = Hex.decode(c[1]), pt = Hex.decode(c[2]);
      if (Arrays.equals(s.seal(aad, pt), ct) && Arrays.equals(rc.open(aad, ct), pt)) ok++;
    }
    comprobar(ok == cifrados.size(), ok + "/" + cifrados.size() + " cifrados sellan y abren");
    HPKEContext otro = SUITE.setupBaseR(enc, r, info);
    byte[] ct0 = Hex.decode(cifrados.get(0)[1]);
    ct0[0] ^= 1;
    boolean rechazado;
    try { otro.open(Hex.decode(cifrados.get(0)[0]), ct0); rechazado = false; } catch (Exception e) { rechazado = true; }
    comprobar(rechazado, "un byte cambiado no abre");
  }

  static void sellar() throws Exception {
    AsymmetricCipherKeyPair r = SUITE.deriveKeyPair(IKM_CRUCE);
    HPKEContextWithEncapsulation s = SUITE.setupBaseS(r.getPublic(), INFO_CRUCE);
    byte[] ct = s.seal(AAD_CRUCE, "hola desde la JVM".getBytes(StandardCharsets.UTF_8));
    Files.writeString(Path.of("cruce-java.txt"), "enc=" + Hex.toHexString(s.getEncapsulation()) + "\nct=" + Hex.toHexString(ct) + "\n");
    comprobar(true, "la JVM sella para Node");
  }

  static void abrir() throws Exception {
    Map<String, String> m = leer("cruce-node.txt");
    HPKEContext rc = SUITE.setupBaseR(Hex.decode(m.get("enc")), SUITE.deriveKeyPair(IKM_CRUCE), INFO_CRUCE);
    String pt = new String(rc.open(AAD_CRUCE, Hex.decode(m.get("ct"))), StandardCharsets.UTF_8);
    comprobar(pt.equals("hola desde Node"), "la JVM abre lo que selló Node");
  }

  static void firmar() throws Exception {
    KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
    g.initialize(new ECGenParameterSpec("secp256r1"));
    KeyPair kp = g.generateKeyPair();
    byte[] msg = "registro de prueba".getBytes(StandardCharsets.UTF_8);
    Signature firma = Signature.getInstance("SHA256withECDSA");
    firma.initSign(kp.getPrivate());
    firma.update(msg);
    byte[] p1363 = derAP1363(firma.sign());
    comprobar(p1363.length == 64, "firma P1363 de 64 bytes");
    Files.writeString(Path.of("firma-java.txt"), "spki=" + Hex.toHexString(kp.getPublic().getEncoded())
        + "\nmsg=" + Hex.toHexString(msg) + "\nfirma=" + Hex.toHexString(p1363) + "\n");
  }

  /** DER (SEQUENCE de dos INTEGER) a P1363 (r ‖ s, 32 bytes cada uno) para P-256. */
  static byte[] derAP1363(byte[] der) {
    if (der[0] != 0x30 || (der[1] & 0x80) != 0) throw new IllegalArgumentException("DER inesperado");
    byte[] out = new byte[64];
    int i = 2;
    for (int k = 0; k < 2; k++) {
      if (der[i] != 0x02) throw new IllegalArgumentException("se esperaba INTEGER");
      int len = der[i + 1], ini = i + 2, fin = ini + len;
      while (len > 32 && der[ini] == 0) { ini++; len--; }
      if (len > 32) throw new IllegalArgumentException("entero de más de 32 bytes");
      System.arraycopy(der, ini, out, k * 32 + (32 - len), len);
      i = fin;
    }
    return out;
  }
}
```

- [ ] **Paso 4: escribir `p5/node/package.json` y `p5/node/prueba.mjs`**

```json
{
  "private": true,
  "type": "module",
  "dependencies": {
    "@hpke/core": "1.9.0"
  }
}
```

```js
// P5 en Node: vectores de CFRG (lado receptor), cruce con la JVM y firma P1363 en WebCrypto.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Aes256Gcm, CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from '@hpke/core';

const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
const bytes = (h) => new Uint8Array(Buffer.from(h, 'hex'));
const hex = (b) => Buffer.from(new Uint8Array(b)).toString('hex');
const txt = (s) => new TextEncoder().encode(s);
const leer = (ruta) => Object.fromEntries(readFileSync(ruta, 'utf8').trim().split('\n').map((l) => l.split('=')));
const IKM = txt('vigia-p5-receptor-de-prueba-0001');
const INFO = txt('vigia/v1/prueba');
const AAD = txt('aad de prueba');
let fallos = 0;

async function comprobar(que, fn) {
  try { await fn(); console.log('✓', que); } catch (e) { fallos++; console.log('✗', que, '-', e.message); }
}

const v = JSON.parse(readFileSync('../test-vectors.json', 'utf8'))
  .find((x) => x.mode === 0 && x.kem_id === 0x20 && x.kdf_id === 1 && x.aead_id === 2);
const receptor = () => suite.kem.deriveKeyPair(bytes(v.ikmR).buffer);

await comprobar('pkR derivada coincide', async () => {
  assert.equal(hex(await suite.kem.serializePublicKey((await receptor()).publicKey)), v.pkRm);
});

await comprobar(`${v.encryptions.length} cifrados abren`, async () => {
  const ctx = await suite.createRecipientContext({ recipientKey: await receptor(), enc: bytes(v.enc).buffer, info: bytes(v.info).buffer });
  for (const e of v.encryptions) assert.equal(hex(await ctx.open(bytes(e.ct).buffer, bytes(e.aad).buffer)), e.pt);
});

await comprobar('un byte cambiado no abre', async () => {
  const ctx = await suite.createRecipientContext({ recipientKey: await receptor(), enc: bytes(v.enc).buffer, info: bytes(v.info).buffer });
  const ct = bytes(v.encryptions[0].ct);
  ct[0] ^= 1;
  await assert.rejects(ctx.open(ct.buffer, bytes(v.encryptions[0].aad).buffer));
});

await comprobar('Node abre lo que selló la JVM', async () => {
  const m = leer('../cruce-java.txt');
  const kp = await suite.kem.deriveKeyPair(IKM.buffer);
  const pt = await suite.open({ recipientKey: kp, enc: bytes(m.enc).buffer, info: INFO.buffer }, bytes(m.ct).buffer, AAD.buffer);
  assert.equal(new TextDecoder().decode(pt), 'hola desde la JVM');
});

await comprobar('Node sella para la JVM', async () => {
  const kp = await suite.kem.deriveKeyPair(IKM.buffer);
  const { enc, ct } = await suite.seal({ recipientPublicKey: kp.publicKey, info: INFO.buffer }, txt('hola desde Node').buffer, AAD.buffer);
  writeFileSync('../cruce-node.txt', `enc=${hex(enc)}\nct=${hex(ct)}\n`);
});

await comprobar('la firma DER de la JVM, en P1363, verifica en WebCrypto y una cambiada no', async () => {
  const f = leer('../firma-java.txt');
  const clave = await webcrypto.subtle.importKey('spki', bytes(f.spki), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const algoritmo = { name: 'ECDSA', hash: 'SHA-256' };
  assert.ok(await webcrypto.subtle.verify(algoritmo, clave, bytes(f.firma), bytes(f.msg)));
  const cambiada = bytes(f.firma);
  cambiada[10] ^= 1;
  assert.ok(!(await webcrypto.subtle.verify(algoritmo, clave, cambiada, bytes(f.msg))));
});

if (fallos) process.exit(1);
```

- [ ] **Paso 5: escribir `p5/correr.sh`**

```sh
#!/bin/sh
# P5: se ejecuta dentro de vigia-build.
set -eu
cd "$(dirname "$0")"
python3 -I extraer.py
J="java -Dfile.encoding=UTF-8 -cp bcprov-jdk18on-1.86.jar Hpke.java"  # la JVM 17 con locale POSIX no lee ni escribe UTF-8 sin esto
$J vectores
$J sellar
$J firmar
(cd node && node prueba.mjs)
$J abrir
```

- [ ] **Paso 6: ejecutar**

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/p5 && sh descargar.sh && (cd node && npm install --ignore-scripts && cp package-lock.json /salida/p5-package-lock.json) && sh correr.sh'
```

Expected:

```
vector.txt: 257 cifrados
✓ pkR derivada coincide
✓ enc coincide
✓ 257/257 cifrados sellan y abren
✓ un byte cambiado no abre
✓ la JVM sella para Node
✓ firma P1363 de 64 bytes
✓ pkR derivada coincide
✓ 257 cifrados abren
✓ un byte cambiado no abre
✓ Node abre lo que selló la JVM
✓ Node sella para la JVM
✓ la firma DER de la JVM, en P1363, verifica en WebCrypto y una cambiada no
✓ la JVM abre lo que selló Node
```

Copiar `/salida/p5-package-lock.json` a `p5/node/package-lock.json` del banco y hacer commit en el banco. Cualquier ✗ va al informe con su plan B (HPKE propio sobre primitivas probadas, con los mismos vectores).

### Tarea 8: banco y P6, primitivas en los tres motores

**Archivos (banco):** `p6/primitivas.html`, `p6/primitivas.js`, `p6/primitivas.spec.mjs`, `p6/playwright.config.mjs`, `p6/package.json` y `p6/package-lock.json`. La muestra `p6/muestra.aac` se genera en el entorno de build.

**Interfaces:**
- Produce: `/work/banco/p6/resultado-<motor>.json` con `{ok, detalle}` por primitiva, que va al informe. La misma página se abre en navegadores reales en H0b.

- [ ] **Paso 1: escribir la prueba, `p6/primitivas.spec.mjs`**

```js
// P6: primitivas de WebCrypto y decodificación ADTS en los tres motores.
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

// X25519 y ADTS se anotan sin bloquear: tienen plan B (@noble/curves) y se miden en navegadores reales en H0b.
const OBLIGATORIAS = ['aesgcm', 'hkdf', 'ecdsa'];

test('primitivas', async ({ page, browserName }) => {
  await page.goto('http://127.0.0.1:8000/primitivas.html');
  await page.waitForFunction(() => window.resultadosPrimitivas !== undefined);
  const r = await page.evaluate(() => window.resultadosPrimitivas);
  writeFileSync(`resultado-${browserName}.json`, JSON.stringify(r, null, 2));
  for (const n of OBLIGATORIAS) expect(r[n].ok, `${n} en ${browserName}: ${r[n].detalle}`).toBe(true);
});
```

`p6/playwright.config.mjs`: el mismo contenido que `sitio/pruebas/playwright.config.mjs` (tarea 5, paso 1).

`p6/package.json`: el mismo contenido que `sitio/pruebas/package.json` (tarea 5, paso 1).

- [ ] **Paso 2: escribir la página**

`p6/primitivas.html`:

```html
<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Primitivas</title></head>
<body>
<h1>Primitivas del navegador</h1>
<ul id="resultados"></ul>
<script type="module" src="primitivas.js"></script>
</body>
</html>
```

`p6/primitivas.js`:

```js
const sutil = crypto.subtle;
const igual = (a, b) => {
  const x = new Uint8Array(a), y = new Uint8Array(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
const texto = (s) => new TextEncoder().encode(s);

const pruebas = {
  async x25519() {
    const a = await sutil.generateKey({ name: 'X25519' }, false, ['deriveBits']);
    const b = await sutil.generateKey({ name: 'X25519' }, false, ['deriveBits']);
    const s1 = await sutil.deriveBits({ name: 'X25519', public: b.publicKey }, a.privateKey, 256);
    const s2 = await sutil.deriveBits({ name: 'X25519', public: a.publicKey }, b.privateKey, 256);
    return igual(s1, s2);
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

const resultados = {};
const lista = document.getElementById('resultados');
for (const [nombre, prueba] of Object.entries(pruebas)) {
  let ok = false;
  let detalle = '';
  try { ok = Boolean(await prueba()); } catch (e) { detalle = String(e?.message ?? e); }
  resultados[nombre] = { ok, detalle };
  const li = document.createElement('li');
  li.setAttribute('data-testid', nombre);
  li.textContent = `${ok ? '✓' : '✗'} ${nombre}${detalle ? `: ${detalle}` : ''}`;
  lista.append(li);
}
window.resultadosPrimitivas = resultados;
```

- [ ] **Paso 3: generar la muestra, instalar y ejecutar**

```sh
docker exec vigia-build sh -c 'sincronizar banco && cd /work/banco/p6 && ffmpeg -loglevel error -y -f lavfi -i sine=frequency=440:duration=4 -ac 1 -ar 16000 -c:a aac -b:a 32k -f adts muestra.aac && npm install --ignore-scripts && cp package-lock.json /salida/p6-package-lock.json'
docker exec -d vigia-build python3 -m http.server 8000 --bind 127.0.0.1 -d /work/banco/p6
docker run --rm --network container:vigia-build --user 1001:1001 -e HOME=/tmp -v vigia-trabajo:/work \
  -w /work/banco/p6 mcr.microsoft.com/playwright:v1.63.0-noble npx playwright test
```

Expected: `3 passed` (AES-GCM, HKDF y ECDSA en los tres motores) y tres `resultado-<motor>.json`. X25519 y ADTS quedan anotados por motor; un ✗ en un motor de escritorio por falta de códecs del sistema se anota y se mide en el navegador real en H0b. Copiar el lockfile al banco y hacer commit en el banco.

- [ ] **Paso 4: fijar la imagen de Playwright por digest**

Run: `docker inspect --format '{{index .RepoDigests 0}}' mcr.microsoft.com/playwright:v1.63.0-noble`
Expected: `mcr.microsoft.com/playwright@sha256:<64 hex>`. Va al informe, y las órdenes de H0b en adelante usan el digest.

### Tarea 9: informe parcial del pico y cierre de H0a

**Archivos:**
- Crear: `docs/pico/informe.md`.

- [ ] **Paso 1: escribir el informe con los resultados reales**

```markdown
# Informe del pico técnico de F2

> Sin datos personales, números de serie, rutas de la máquina ni hosts reales. Los hosts van como marcadores.

## Versiones fijadas (H0a)

| Pieza | Versión | Comprobación |
|---|---|---|
| Imagen base | ubuntu:24.04 | digest `sha256:<…>` |
| JDK | OpenJDK 17.<…> (paquete de Ubuntu) | `javac -version` |
| Node | 24.21.0 | SHA-256 `fd8e59d5…cb2d6` |
| Android cmdline-tools | 15859902 | SHA-256 `4e4c464f…edf583` |
| Expo | 57.0.26 | lockfile del banco |
| op-sqlite | 18.2.5 | lockfile del banco |
| BouncyCastle | bcprov-jdk18on 1.86 | SHA-256 `2af190b3…cb371f` |
| @hpke/core | 1.9.0 | lockfile del banco |
| Playwright | 1.63.0 | digest `sha256:<…>` |
| wrangler | 4.147.0 | npx con versión exacta |
| gitleaks | 8.30.1 | digest `sha256:<…>` |
| Vectores HPKE | cfrg/draft-irtf-cfrg-hpke@5f503c56 | SHA-256 `61fc662f…3ede6` |

## P1. Compilación (parte de la máquina de build)
- Pregunta: …
- Medición: …
- Resultado: …
- Decisión: …

## P5. Interoperabilidad (JVM y Node)
(misma estructura)

## P6. Navegadores (Playwright)
(misma estructura, con la tabla de ✓ y ✗ por motor y primitiva)

## Queda para H0b
P1 en el teléfono, P2, P3, P4, P5 en el teléfono, P6 en navegadores reales, P7, P8 y P9.
```

Cada "…" se rellena con lo medido, sin rutas ni nombres.

- [ ] **Paso 2: verificación antes de cerrar (superpowers:verification-before-completion)**

Run, una por una, y pegar la salida en el informe de cierre privado:
- `python3 -I .githooks/test_comprobar.py` → `OK`.
- El paso 5 de la tarea 1 → sin ninguna línea "MAL".
- La prueba de la tarea 5 → `6 passed`.
- El paso 7 de la tarea 6 → `BUILD SUCCESSFUL`.
- El paso 6 de la tarea 7 → 13 líneas con ✓ y ninguna con ✗.
- El paso 3 de la tarea 8 → `3 passed`.
- `git ls-files | grep -E '^(app|p5|p6)/'` → nada (el banco no entró al repo).
- `docker run --rm --network none -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/repo -v "$PWD":/repo:ro "$(git config --get vigia.gitleaks)" git --redact --no-banner /repo` → `no leaks found`.

- [ ] **Paso 3: commit del informe**

```bash
git add docs/pico/informe.md
git commit -m "Añade el informe parcial del pico de F2

P1, P5 y P6 medidos en la máquina de build, con las versiones fijadas
y sus comprobaciones.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Paso 4: parada**

Informe de cierre a la persona responsable: qué se hizo, la evidencia de cada criterio de H0a del plan maestro y lo que queda para H0b. No se empieza H0b sin aprobación. Tras la aprobación: `git tag -a f2-h0a -m "H0a aprobado"`, y la persona responsable empuja la etiqueta con la orden de "Cómo trabajamos" del plan maestro.
