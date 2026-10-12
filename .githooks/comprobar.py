"""Reglas del repo público de Vigía, para los hooks de git.

Rechaza, en lo que entra en el commit (ruta y contenido completo de cada archivo
del índice) y en el mensaje:
- la raya larga (U+2014);
- los correos que no sean noreply ni de ejemplo;
- los teléfonos de VE o CO con prefijo o con separadores;
- las coincidencias con la lista privada de patrones (SHA-256 de frases normalizadas).
Con «secretos», pasa lo mismo por gitleaks, en un contenedor sin red.

No interpreta la salida de git diff: lee del índice los blobs que van al commit.
Así, ni las comillas en las rutas, ni diff.noprefix, ni .gitattributes, ni textconv,
ni un índice temporal (commit -a) cambian lo que se revisa.

Uso: comprobar.py pre-commit | commit-msg <archivo> | secretos [<archivo>] | huellas-desde <archivo>
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
S = r"[\s.()-]{0,3}"  # separador entre bloques, con o sin paréntesis
TELEFONO = re.compile(
    rf"(?:\+|\b00)58{S}4\d{{2}}{S}\d{{3}}[\s.-]?\d{{4}}"        # VE con prefijo
    rf"|(?<![\w+])\(?04\d{{2}}{S}\d{{3}}[\s.-]?\d{{4}}\b"        # VE nacional
    rf"|(?:\+|\b00)57{S}3\d{{2}}{S}\d{{3}}[\s.-]?\d{{4}}"        # CO con prefijo
    r"|(?<![\w+])\(?3\d{2}(?:\)\s?|[\s.-])\d{3}[\s.-]\d{4}\b")   # CO con separadores
MAX_PALABRAS = 4  # ponytail: nombres de hasta 4 palabras; subir si el registro tiene más largos
CAMEL = re.compile(r"(?<=[a-zß-öø-ÿ])(?=[A-ZÀ-ÖØ-Þ])")
TIJERA = re.compile(rb"^\S+ -{24} >8 -{24}$", re.MULTILINE)


def palabras(texto, invisibles=""):
    """Palabras sin mayúsculas ni tildes; los invisibles (U+00AD, U+200B...) se cambian por `invisibles`."""
    texto = unicodedata.normalize("NFKD", texto).casefold()
    texto = "".join(invisibles if unicodedata.category(c) == "Cf" else c
                    for c in texto if not unicodedata.category(c).startswith("M"))
    return re.findall(r"[a-z0-9]+", texto)


def huella(frase):
    return hashlib.sha256(" ".join(frase).encode()).hexdigest()


def huellas(texto):
    # Variantes: invisibles quitados o como espacio, y camelCase entero o partido.
    variantes = {tuple(palabras(t, i)) for t in {texto, CAMEL.sub(" ", texto)} for i in ("", " ")}
    for p in variantes:
        for n in range(1, MAX_PALABRAS + 1):
            for i in range(len(p) - n + 1):
                yield huella(p[i:i + n])


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, check=True).stdout


def config(clave):
    return subprocess.run(["git", "config", "--get", clave], capture_output=True, text=True).stdout.strip()


def cargar_patrones():
    try:
        with open(config("vigia.patrones"), encoding="utf-8") as f:
            lineas = [l.strip().lower() for l in f if l.strip()]
    except (OSError, UnicodeError):
        lineas = []
    # Una lista vacía o con líneas que no son huellas dejaría pasar los nombres: se bloquea.
    if not lineas or not all(re.fullmatch(r"[0-9a-f]{64}", l) for l in lineas):
        sys.exit("La lista privada de patrones (git config vigia.patrones) falta, está vacía "
                 "o tiene líneas que no son huellas SHA-256. Commit bloqueado.")
    return set(lineas)


def preparado():
    """(ruta, contenido) de cada archivo que entra en el commit, leído del índice."""
    campos = git("diff", "--cached", "--raw", "-z", "--no-abbrev", "--no-renames", "--no-relative",
                 "--ignore-submodules=none", "--diff-filter=d").split(b"\0")
    for meta, ruta in zip(campos[0::2], campos[1::2]):
        _, modo, _, objeto, _ = meta.decode().split()
        # Un submódulo no tiene blob: se revisa solo su ruta.
        yield ruta.decode("utf-8", "replace"), b"" if modo == "160000" else git("cat-file", "blob", objeto)


def mensaje(ruta):
    # También las líneas con "#": git las conserva con -m o con commit.cleanup=verbatim.
    # Lo que va tras la línea de tijera (commit -v) git lo quita siempre.
    with open(ruta, "rb") as f:
        return [("mensaje del commit", TIJERA.split(f.read(), 1)[0])]


def problemas(texto, patrones):
    texto = unicodedata.normalize("NFKC", texto)
    if RAYA in texto:
        yield "raya larga (U+2014)"
    if any(not CORREO_PERMITIDO.search(m.group(0)) for m in CORREO.finditer(texto)):
        yield "correo que no es noreply"
    if TELEFONO.search(texto):
        yield "número de teléfono"
    if any(h in patrones for h in huellas(texto)):
        yield "coincide con un patrón privado"


def revisar(archivos, patrones):
    fallos = set()
    for ruta, contenido in archivos:
        en_ruta = set(problemas(ruta, patrones))
        # Una ruta con algo sensible no se imprime: la terminal puede quedar grabada.
        nombre = "(ruta que no se muestra)" if en_ruta else ruta
        fallos |= {f"{nombre}, en la ruta: {p}" for p in en_ruta}
        fallos |= {f"{nombre}: {p}" for p in problemas(contenido.decode("utf-8", "replace"), patrones)}
    return sorted(fallos)


def gitleaks(archivos):
    imagen = config("vigia.gitleaks")
    if not imagen:
        sys.exit("Falta git config vigia.gitleaks (imagen de gitleaks fijada por digest). Commit bloqueado.")
    flujo = b"".join(b"==> %s <==\n%s\n" % (ruta.encode(), contenido) for ruta, contenido in archivos)
    # Sin red, sin privilegios y sin montar nada: solo ve lo que entra en el commit (ENV-01).
    r = subprocess.run(["docker", "run", "--rm", "-i", "--network", "none", "--cap-drop", "ALL",
                        "--security-opt", "no-new-privileges", "--read-only", imagen,
                        "stdin", "--redact", "--no-banner"], input=flujo)
    if r.returncode:
        print("Commit rechazado: gitleaks encontró un posible secreto o no pudo revisar.", file=sys.stderr)
    return r.returncode


def main(argv):
    modo = argv[1] if len(argv) > 1 else ""
    if modo == "huellas-desde":
        with open(argv[2], encoding="utf-8") as f:
            for linea in f:
                if palabras(linea):
                    print(huella(palabras(linea)))
        return 0
    if modo == "secretos":
        return gitleaks(mensaje(argv[2]) if len(argv) > 2 else list(preparado()))
    if modo == "pre-commit":
        archivos = list(preparado())
    elif modo == "commit-msg":
        archivos = mensaje(argv[2])
    else:
        print(__doc__, file=sys.stderr)
        return 2
    fallos = revisar(archivos, cargar_patrones())
    if fallos:
        print("Commit rechazado por las reglas del repo público:", *fallos, sep="\n  ", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
