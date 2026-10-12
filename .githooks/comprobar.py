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
