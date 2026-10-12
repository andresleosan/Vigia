"""Reglas del repo público de Vigía, para los hooks de git.

Rechaza, en todo lo que se va a publicar (ruta y contenido completo de cada archivo,
mensajes, autores, etiquetas y nombres de las referencias):
- la raya larga (U+2014);
- los correos que no sean noreply ni de ejemplo;
- los teléfonos de VE o CO, móviles o fijos, con prefijo o con separadores;
- las coincidencias con la lista privada de patrones (SHA-256 de frases normalizadas);
- las rutas de claves, almacenes de claves y configuración local (.env*, .dev.vars*);
- lo que no se puede leer (binarios y punteros de Git LFS), salvo que su SHA-256 esté
  en .githooks/revisados.sha256 porque una persona lo revisó.
Lo mismo pasa por gitleaks, en un contenedor sin red.

No interpreta la salida de git diff: lee los blobs del índice (pre-commit) o de los commits
que se empujan (pre-push), y las reglas y gitleaks reciben las mismas lecturas (lecturas()).
pre-push es la última barrera: revisa todo lo que aún no está en el remoto, se haya creado
como se haya creado (commit --no-verify, revert, cherry-pick, rebase, merge, etiquetas).

Uso: comprobar.py pre-commit | commit-msg <archivo> | secretos [<archivo>]
     | pre-push <remoto> (con las referencias por stdin) | huellas-desde <archivo>
"""
import hashlib
import html
import re
import subprocess
import sys
import unicodedata
import urllib.parse

RAYA = chr(0x2014)
CORREO = re.compile(r"[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}")
CORREO_PERMITIDO = re.compile(
    r"^noreply@anthropic\.com$|@users\.noreply\.github\.com$|@example\.(?:com|org|net|invalid)$",
    re.IGNORECASE)

# Teléfonos: el código de área va junto (0414, 412, 300, 601) y las 7 cifras del abonado admiten
# hasta 3 separadores entre cada dos (espacios, puntos, paréntesis, barras y guiones, también los
# tipográficos U+2010 a U+2015 y U+2212). Así "555 12 34" cuenta y "4 / 8 / 12 / 16" no.
GUIONES = "".join(map(chr, (*range(0x2010, 0x2016), 0x2212)))
S = rf"[\s.()/\-{GUIONES}]"
SEP = S + "{0,3}"
SIETE = SEP.join([r"\d"] * 7)
TELEFONO = re.compile(
    rf"(?<!\w)(?:"
    rf"\(?(?:\+|00)?{SEP}58{SEP}(?:\(?0\)?)?{SEP}\(?[24]\d\d\)?{SEP}{SIETE}"   # VE con prefijo (o wa.me)
    rf"|\(?(?:\+|00)?{SEP}57{SEP}\(?(?:3\d\d|60\d)\)?{SEP}{SIETE}"            # CO con prefijo
    rf"|\(?0[24]\d\d\)?{SEP}{SIETE}"                                           # VE nacional
    rf"|(?P<suelto>\(?(?:[234]\d\d|60\d)\)?{S}{{1,3}}{SIETE})"               # sin prefijo ni 0
    r")(?!\w)")

MAX_PALABRAS = 8  # huellas-desde rechaza las líneas más largas, para que ninguna quede sin proteger
CAMEL = re.compile(r"(?<=[a-zß-öø-ÿ])(?=[A-ZÀ-ÖØ-Þ])")
# Invisibles además de los de categoría Cf (propiedad Default_Ignorable_Code_Point de Unicode).
IGNORABLES = {0x034F, 0x115F, 0x1160, 0x17B4, 0x17B5, 0x3164, 0xFFA0,
              *range(0x180B, 0x1810), *range(0xFE00, 0xFE10), *range(0xE0100, 0xE01F0)}
ESCAPE = re.compile(re.escape(chr(92)) + r"(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2}))")
LFS = b"version https://git-lfs.github.com/spec/"
RUTA_PROHIBIDA = re.compile(
    r"(?i)(?:^|/)(?:\.env[^/]*|\.dev\.vars[^/]*)$|\.(?:p12|pfx|jks|keystore|pk8|der|pem|key)$")
CEROS = "0" * 40


def invisible(c):
    return unicodedata.category(c) == "Cf" or ord(c) in IGNORABLES


def desescapar(texto):
    """Deshace los escapes de JSON (barra + u o x), las entidades de HTML y el %XX de las URL."""
    texto = ESCAPE.sub(lambda m: chr(int(m.group(1) or m.group(2), 16)), texto)
    return urllib.parse.unquote(html.unescape(texto))


def lecturas(contenido, escapes=True):
    """Formas de leer un blob, comunes a todas las reglas y a gitleaks.

    UTF-8 o, si no lo es, también cp1252; cada una tal cual y, si `escapes`, sin escapes; todas
    normalizadas (NFKC) y con los invisibles (U+00AD, U+200B, U+034F...) quitados y como espacio.
    """
    try:
        textos = [contenido.decode("utf-8")]
    except UnicodeDecodeError:
        textos = [contenido.decode("utf-8", "replace"), contenido.decode("cp1252", "replace")]
    vistas = []
    for texto in textos:
        for t in (texto, desescapar(texto)) if escapes else (texto,):
            t = unicodedata.normalize("NFKC", t)
            invisibles = [ord(c) for c in set(t) if invisible(c)]
            for por in ("", " "):
                vista = t.translate(dict.fromkeys(invisibles, por))
                if vista not in vistas:
                    vistas.append(vista)
    return vistas


def palabras(texto):
    """Palabras sin mayúsculas, tildes ni invisibles."""
    texto = unicodedata.normalize("NFKD", texto).casefold()
    quitar = {ord(c): None for c in set(texto) if unicodedata.category(c)[0] == "M" or invisible(c)}
    return re.findall(r"[a-z0-9]+", texto.translate(quitar))


def huella(frase):
    return hashlib.sha256(" ".join(frase).encode()).hexdigest()


def huellas(texto):
    """Huella de cada frase de hasta MAX_PALABRAS palabras, con las palabras ordenadas para que
    coincida en cualquier orden ("FICTICIA, ZOILA"). También con el camelCase partido y sin las
    iniciales sueltas ("Zoila M. Ficticia")."""
    for t in {texto, CAMEL.sub(" ", texto)}:
        p = palabras(t)
        for lista in {tuple(p), tuple(w for w in p if len(w) > 1)}:
            for n in range(1, MAX_PALABRAS + 1):
                for i in range(len(lista) - n + 1):
                    yield huella(sorted(lista[i:i + n]))


def problemas(contenido, patrones):
    hallados = set()
    # La raya es una regla de estilo sobre el carácter escrito: un escape en código no cuenta.
    if any(RAYA in texto for texto in lecturas(contenido, escapes=False)):
        hallados.add("raya larga (U+2014)")
    for texto in lecturas(contenido):
        if any(not CORREO_PERMITIDO.search(m.group(0)) for m in CORREO.finditer(texto)):
            hallados.add("correo que no es noreply")
        if TELEFONO.search(texto):
            hallados.add("número de teléfono")
        if any(h in patrones for h in huellas(texto)):
            hallados.add("coincide con un patrón privado")
    return hallados


def opaco(contenido):
    """Lo que las reglas no pueden leer: binarios (bytes NUL) y punteros de Git LFS."""
    return b"\0" in contenido or contenido.startswith(LFS)


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
                 "o tiene líneas que no son huellas SHA-256. Bloqueado.")
    return set(lineas)


def revisados_en(rev):
    """SHA-256 de .githooks/revisados.sha256 tal como está en `rev` ("" es el índice)."""
    r = subprocess.run(["git", "show", f"{rev}:.githooks/revisados.sha256"], capture_output=True)
    if r.returncode:
        return set()
    hashes = set()
    for linea in r.stdout.decode("utf-8", "replace").splitlines():
        if linea.strip() and not linea.startswith("#"):
            h = linea.split()[0].lower()
            if not re.fullmatch(r"[0-9a-f]{64}", h):
                sys.exit("Hay una línea mal formada en .githooks/revisados.sha256 "
                         "(se espera «sha256  descripción»). Bloqueado.")
            hashes.add(h)
    return hashes


def entradas(salida):
    """(ruta, modo, objeto) de una salida --raw -z de git diff o git diff-tree."""
    campos = salida.split(b"\0")
    for meta, ruta in zip(campos[0::2], campos[1::2]):
        _, modo, _, objeto, _ = meta.decode().split()
        yield ruta, modo, objeto


def blob(modo, objeto):
    # Un submódulo no tiene blob: se revisa solo su ruta.
    return b"" if modo == "160000" else git("cat-file", "blob", objeto)


DIFF = ("--raw", "-z", "--no-abbrev", "--no-renames", "--no-relative", "--ignore-submodules=none",
        "--diff-filter=d")


def preparado():
    """Piezas (dónde, ruta, contenido) de lo que entra en el commit, leído del índice."""
    return [("", ruta, blob(modo, objeto))
            for ruta, modo, objeto in entradas(git("diff", "--cached", *DIFF))]


def mensaje(ruta):
    # Entero, también las líneas con "#" y lo que siga a una línea de tijera: lo que git quite
    # depende de -m, -v, commit.cleanup y core.commentChar, y el hook no lo sabe.
    with open(ruta, "rb") as f:
        return [("mensaje del commit", None, f.read())]


def objeto_git(sha, clase, identidad):
    """Piezas de un commit o de una etiqueta anotada: su mensaje y cada autor que no sea la
    identidad configurada en el repo."""
    cabecera, _, texto = git("cat-file", clase, sha).partition(b"\n\n")
    donde = f"{'commit' if clase == 'commit' else 'etiqueta'} {sha[:7]}: "
    piezas = [(donde + "mensaje", None, texto)]
    for linea in cabecera.split(b"\n"):
        m = re.fullmatch(rb"(author|committer|tagger) (.*) <(.*)> \d+ [+-]\d{4}", linea)
        if m and (m.group(2), m.group(3)) != identidad:
            piezas.append((donde + m.group(1).decode(), None, m.group(2) + b" <" + m.group(3) + b">"))
    return piezas


def empujado(remoto, lineas):
    """Piezas de todo lo que el push publica y no está ya en el remoto, y los blobs revisados."""
    refs = [l.split() for l in lineas if l.strip()]
    ya_publicado = [r for *_, r in refs if r != CEROS
                    and subprocess.run(["git", "cat-file", "-e", r], capture_output=True).returncode == 0]
    identidad = (config("user.name").encode(), config("user.email").encode())
    piezas, vistos, revisados = [], set(), set()
    for ref, sha, _, _ in refs:
        if sha == CEROS:
            continue  # borrar una referencia remota no publica nada
        revisados |= revisados_en(sha)
        piezas.append(("nombre de la referencia", None, ref.encode()))
        if git("cat-file", "-t", sha).strip() == b"tag":
            piezas += objeto_git(sha, "tag", identidad)
        for c in git("rev-list", sha, "--not", f"--remotes={remoto}", *ya_publicado).decode().split():
            piezas += objeto_git(c, "commit", identidad)
            for ruta, modo, objeto in entradas(git("diff-tree", "-r", "--root", "-m", "--no-commit-id",
                                                    *DIFF, c)):
                if (ruta, objeto) not in vistos:
                    vistos.add((ruta, objeto))
                    piezas.append((f"commit {c[:7]}: ", ruta, blob(modo, objeto)))
    return piezas, revisados


def etiqueta(donde, ruta, patrones):
    """Nombre de una pieza en los mensajes y lo que incumple su ruta. Una ruta con algo sensible
    no se imprime: la terminal puede quedar grabada."""
    if ruta is None:
        return donde, set()
    en_ruta = problemas(ruta, patrones)
    if RUTA_PROHIBIDA.search(ruta.decode("utf-8", "replace")):
        en_ruta.add("ruta de una clave o de configuración local")
    return donde + ("(ruta que no se muestra)" if en_ruta else ruta.decode("utf-8", "replace")), en_ruta


def revisar(piezas, patrones, revisados):
    fallos = set()
    for donde, ruta, contenido in piezas:
        nombre, en_ruta = etiqueta(donde, ruta, patrones)
        fallos |= {f"{nombre}, en la ruta: {p}" for p in en_ruta}
        if hashlib.sha256(contenido).hexdigest() in revisados:
            continue  # una persona revisó exactamente este contenido
        if opaco(contenido):
            fallos.add(f"{nombre}: binario o puntero de Git LFS sin revisar "
                       "(si una persona lo revisó, su SHA-256 va en .githooks/revisados.sha256)")
        fallos |= {f"{nombre}: {p}" for p in problemas(contenido, patrones)}
    return sorted(fallos)


def gitleaks(piezas, patrones, revisados):
    imagen = config("vigia.gitleaks")
    if not imagen:
        sys.exit("Falta git config vigia.gitleaks (imagen de gitleaks fijada por digest). Bloqueado.")
    flujo = "".join(f"==> {etiqueta(donde, ruta, patrones)[0]} <==\n" + "\n".join(lecturas(contenido)) + "\n"
                    for donde, ruta, contenido in piezas
                    if hashlib.sha256(contenido).hexdigest() not in revisados)
    # Sin red, sin privilegios y sin montar nada: solo ve lo que se va a publicar (ENV-01).
    r = subprocess.run(["docker", "run", "--rm", "-i", "--network", "none", "--cap-drop", "ALL",
                        "--security-opt", "no-new-privileges", "--read-only", imagen,
                        "stdin", "--redact", "--no-banner"], input=flujo.encode("utf-8", "replace"))
    if r.returncode:
        print("Rechazado: gitleaks encontró un posible secreto o no pudo revisar.", file=sys.stderr)
    return r.returncode


def huellas_desde(ruta):
    """Huellas de la lista privada: cada línea con sus palabras ordenadas y, si son varias,
    también pegadas (dominios y usuarios); con el camelCase entero y partido."""
    with open(ruta, encoding="utf-8") as f:
        lineas = [l for l in f if palabras(l)]
    largas = [i for i, l in enumerate(lineas, 1) if len(palabras(CAMEL.sub(" ", l))) > MAX_PALABRAS]
    if largas:
        sys.exit(f"Las líneas {largas} tienen más de {MAX_PALABRAS} palabras y nunca coincidirían. "
                 "Acórtalas (por ejemplo, nombre y primer apellido) o sube MAX_PALABRAS.")
    salida = []
    for linea in lineas:
        for p in (palabras(linea), palabras(CAMEL.sub(" ", linea))):
            for h in [huella(sorted(p))] + ([huella(["".join(p)])] if len(p) > 1 else []):
                if h not in salida:
                    salida.append(h)
    print(*salida, sep="\n")
    return 0


def main(argv):
    modo = argv[1] if len(argv) > 1 else ""
    if modo == "huellas-desde":
        return huellas_desde(argv[2])
    if modo == "pre-push":
        piezas, revisados = empujado(argv[2], sys.stdin.read().splitlines())
    elif modo in ("pre-commit", "secretos") and len(argv) == 2:
        piezas, revisados = preparado(), revisados_en("")
    elif modo in ("commit-msg", "secretos") and len(argv) == 3:
        piezas, revisados = mensaje(argv[2]), set()
    else:
        print(__doc__, file=sys.stderr)
        return 2
    patrones = cargar_patrones()
    if modo == "secretos":
        return gitleaks(piezas, patrones, revisados)
    fallos = revisar(piezas, patrones, revisados)
    if fallos:
        print("Rechazado por las reglas del repo público:", *fallos, sep="\n  ", file=sys.stderr)
        return 1
    return gitleaks(piezas, patrones, revisados) if modo == "pre-push" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
