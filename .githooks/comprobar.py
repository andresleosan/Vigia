"""Reglas del repo público de Vigía, para los hooks de git.

Rechaza, en todo lo que se va a publicar (ruta y contenido completo de cada archivo,
mensajes y cabeceras de commits y etiquetas, autores y nombres de las referencias):
- la raya larga (U+2014);
- los correos que no sean noreply ni de ejemplo;
- los teléfonos de VE o CO, móviles o fijos, con prefijo o con separadores;
- las coincidencias con la lista privada de patrones (SHA-256 de frases normalizadas);
- las rutas de claves, almacenes de claves y configuración local (.env*, .dev.vars*);
- lo que no se puede leer (binarios, comprimidos, PDF y punteros de Git LFS).
Lo mismo pasa por gitleaks, en un contenedor sin red. Un blob cuyo SHA-256 está en
.githooks/revisados.sha256 (una persona lo revisó) queda fuera de la raya, los teléfonos,
la regla de binarios y gitleaks, pero no de la lista privada ni de los correos.

No interpreta la salida de git diff: lee los blobs del índice (pre-commit) o de los commits
que se empujan (pre-push), y las reglas y gitleaks reciben las mismas lecturas (lecturas()).
pre-push es la última barrera: revisa todo lo que el remoto aún no tiene, se haya creado
como se haya creado (commit --no-verify, revert, cherry-pick, rebase, merge, etiquetas).

Uso: comprobar.py pre-commit | commit-msg <archivo> | secretos [<archivo>]
     | pre-push <remoto> <url> (con las referencias por stdin) | huellas-desde <archivo>
"""
import hashlib
import html
import itertools
import os
import re
import subprocess
import sys
import unicodedata
import urllib.parse

# Lo que se revisa tiene que ser lo que git envía: sin refs/replace.
os.environ["GIT_NO_REPLACE_OBJECTS"] = "1"

RAYA = chr(0x2014)
CORREO = re.compile(r"(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}")
CORREO_PERMITIDO = re.compile(
    r"^noreply@anthropic\.com$|@users\.noreply\.github\.com$|@example\.(?:com|org|net|invalid)$",
    re.IGNORECASE)

# Teléfonos. El código de área va junto (0414, 412, 300, 601); entre las 7 cifras del abonado
# caben hasta 3 separadores horizontales (espacio, tabulador, punto, guion o guion bajo, también
# los guiones tipográficos U+2010 a U+2015 y U+2212); alrededor del prefijo y del código de área,
# además, paréntesis y barra. Sin saltos de línea, y una IPv4 no cuenta.
GUIONES = "".join(map(chr, (*range(0x2010, 0x2016), 0x2212)))
H = rf"[ \t.\-_{GUIONES}]"
S = rf"[ \t.()/\-_{GUIONES}]"
SEP = S + "{0,3}"
SIETE = (H + "{0,3}").join([r"\d"] * 7)
OCTETO = r"(?:25[0-5]|2[0-4]\d|1?\d?\d)"
TELEFONO = re.compile(
    rf"(?<![^\W_])(?!{OCTETO}(?:\.{OCTETO}){{3}}(?![\d.]))(?:"
    rf"\(?(?:\+|00)?{SEP}58{SEP}(?:\(?0\)?)?{SEP}\(?[24]\d\d\)?{SEP}{SIETE}"   # VE con prefijo (o wa.me)
    rf"|\(?(?:\+|00)?{SEP}57{SEP}\(?(?:3\d\d|60\d)\)?{SEP}{SIETE}"            # CO con prefijo
    rf"|\(?0[24]\d\d\)?{SEP}{SIETE}"                                           # VE nacional
    rf"|\(?(?:[234]\d\d|60\d)\)?{S}{{1,3}}{SIETE}"                             # sin prefijo ni 0
    r")(?![^\W_])")

MAX_PALABRAS = 8   # huellas-desde rechaza las líneas más largas
FRASE = 4          # frases seguidas de hasta 4 palabras ("Zoila de la Prueba")
VENTANA = 6        # dos palabras que identifican, a menos de 6 de distancia, cuentan como el nombre
PARTICULAS = {"de", "del", "la", "las", "los", "el", "y", "e", "da", "das", "do", "dos", "van", "von", "der"}
CAMEL = re.compile(r"(?<=[a-zß-öø-ÿ])(?=[A-ZÀ-ÖØ-Þ])")
# Invisibles además de los de categoría Cf (Default_Ignorable_Code_Point de Unicode) y el blanco Braille.
IGNORABLES = {0x034F, 0x115F, 0x1160, 0x17B4, 0x17B5, 0x2800, 0x3164, 0xFFA0,
              *range(0x180B, 0x1810), *range(0xFE00, 0xFE10), *range(0xE0100, 0xE01F0)}
B = re.escape(chr(92))  # barra invertida
ESCAPE = re.compile(B + r"(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2}))")
CONTROL = re.compile(B + r"([nrtbfv0])")
LITERAL = re.compile(B + r"([/\"'])")
LFS = b"version https://git-lfs.github.com/spec/"
MAGICOS = (b"%PDF-", b"BZh", b"Rar!", b"PK" + bytes([3, 4]), bytes.fromhex("1f8b"),
           bytes.fromhex("28b52ffd"), bytes.fromhex("377abcaf271c"))
RUTA_PROHIBIDA = re.compile(
    r"(?i)(?:^|/)(?:\.env[^/]*|\.dev\.vars[^/]*)$|\.(?:p12|pfx|jks|keystore|pk8|der|pem|key)$")
IDENTIDAD = re.compile(rb" ?(author|committer|tagger) (.*) <(.*)> \d+ [+-]\d{4}")
CEROS = "0" * 40


def invisible(c):
    return unicodedata.category(c) == "Cf" or ord(c) in IGNORABLES


def desescapar(texto):
    """Deshace los escapes de JSON, Kotlin y TS, las entidades de HTML y el %XX de las URL."""
    texto = ESCAPE.sub(lambda m: chr(int(m.group(1) or m.group(2), 16)), texto)
    texto = CONTROL.sub(lambda m: {"n": "\n", "r": "\r", "t": "\t"}.get(m.group(1), " "), texto)
    texto = html.unescape(LITERAL.sub(r"\1", texto))
    try:
        return urllib.parse.unquote(texto, errors="strict")
    except UnicodeDecodeError:  # %XX en Latin-1 o cp1252
        return urllib.parse.unquote(texto, encoding="cp1252", errors="replace")


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


def identifican(p):
    """Las palabras que identifican un nombre: sin partículas ni iniciales."""
    return [w for w in p if len(w) > 1 and w not in PARTICULAS]


def huella(frase):
    return hashlib.sha256(" ".join(frase).encode()).hexdigest()


def huellas(textos):
    """Huellas de unos textos: cada frase seguida de hasta FRASE palabras y cada par de palabras
    que identifican a menos de VENTANA de distancia ("FICTICIA PÉREZ, ZOILA MARÍA",
    "<b>Zoila</b> Ficticia"); siempre con las palabras ordenadas, para que valga cualquier orden,
    y también con el camelCase partido."""
    frases = set()
    for texto in textos:
        for t in {texto, CAMEL.sub(" ", texto)}:
            p = palabras(t)
            for n in range(1, FRASE + 1):
                frases.update(tuple(sorted(p[i:i + n])) for i in range(len(p) - n + 1))
            q = identifican(p)
            frases.update(tuple(sorted((q[i], q[j])))
                          for i in range(len(q)) for j in range(i + 1, min(i + VENTANA, len(q))))
    return {huella(f) for f in frases}


def opaco(contenido):
    """Lo que las reglas no pueden leer: binarios (bytes NUL), comprimidos, PDF y punteros de LFS."""
    return b"\0" in contenido or contenido.startswith(LFS) or contenido.startswith(MAGICOS)


def problemas(contenido, patrones, revisado=False):
    """Reglas que incumple un blob. Si una persona lo revisó, solo la lista privada y los correos,
    que no se pueden juzgar a mano (la lista solo existe como huellas)."""
    vistas = lecturas(contenido)
    hallados = set()
    if not revisado:
        # La raya es una regla de estilo sobre el carácter escrito: un escape en código no cuenta.
        if any(RAYA in t for t in lecturas(contenido, escapes=False)):
            hallados.add("raya larga (U+2014)")
        if any(TELEFONO.search(t) for t in vistas):
            hallados.add("número de teléfono")
        if opaco(contenido):
            hallados.add("binario, comprimido o puntero de Git LFS sin revisar")
    if any(not CORREO_PERMITIDO.search(m.group(0)) for t in vistas for m in CORREO.finditer(t)):
        hallados.add("correo que no es noreply")
    if not patrones.isdisjoint(huellas(vistas)):
        hallados.add("coincide con un patrón privado")
    return hallados


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


def identidades_publicas():
    """Autores que la persona responsable aprobó publicar, en la configuración local:
    git config --add vigia.identidad-publica 'Nombre <correo>'. Coincidir con user.name y
    user.email no basta: una identidad cambiada por error no debe salir sin revisar."""
    r = subprocess.run(["git", "config", "--get-all", "vigia.identidad-publica"], capture_output=True, text=True)
    return {l.strip().encode() for l in r.stdout.splitlines() if l.strip()}


def objeto_git(sha, clase, aprobadas):
    """Piezas de un commit o de una etiqueta: su texto entero (cabeceras incluidas, como mergetag
    o el nombre interno de la etiqueta, salvo hashes y firmas) y cada autor no aprobado."""
    cabecera, _, texto = git("cat-file", clase, sha).partition(b"\n\n")
    donde = f"{'commit' if clase == 'commit' else 'etiqueta'} {sha[:7]}: "
    piezas, lineas, firma = [], [], False
    for linea in cabecera.split(b"\n"):
        if linea.startswith((b"gpgsig ", b"gpgsig-sha256 ")):
            firma = True
            continue
        if firma and linea.startswith(b" "):
            continue
        firma = False
        m = IDENTIDAD.fullmatch(linea)
        if m:
            identidad = m.group(2) + b" <" + m.group(3) + b">"
            if identidad not in aprobadas:
                piezas.append((donde + m.group(1).decode(), None, identidad))
        elif not linea.startswith((b"tree ", b"parent ", b"object ")):
            lineas.append(linea)
    piezas.append((donde + "mensaje y cabeceras", None, b"\n".join(lineas) + b"\n\n" + texto))
    return piezas


def existe(sha):
    return subprocess.run(["git", "cat-file", "-e", sha], capture_output=True).returncode == 0


def publicado(url, refs):
    """Lo que el destino ya tiene: los SHA remotos que trae git por stdin y los que lista
    git ls-remote. Nunca refs/remotes: es estado local y puede estar viejo."""
    shas = {r for *_, r in refs if r != CEROS}
    try:
        r = subprocess.run(["git", "ls-remote", url], capture_output=True, text=True, timeout=60,
                           env={**os.environ, "GIT_TERMINAL_PROMPT": "0"})
        if r.returncode == 0:
            shas |= {l.split()[0] for l in r.stdout.splitlines() if l.strip()}
    except subprocess.TimeoutExpired:
        pass  # sin respuesta: se revisa de más, nunca de menos
    return {s for s in shas if existe(s)}


def empujado(url, lineas):
    """Piezas de todo lo que el push publica y el remoto no tiene, los blobs revisados y los
    fallos que no dependen del contenido."""
    refs = [l.split() for l in lineas if l.strip()]
    ya = publicado(url, refs)
    aprobadas = identidades_publicas()
    piezas, vistos, revisados, fallos = [], set(), set(), []
    if os.path.exists(git("rev-parse", "--git-path", "info/grafts").decode().strip()):
        fallos.append("hay .git/info/grafts: lo que se revisa no sería lo que se envía")
    for ref, sha, ref_remota, _ in refs:
        if sha == CEROS:
            continue  # borrar una referencia remota no publica nada
        revisados |= revisados_en(sha)
        # Se publica el nombre remoto (HEAD:refs/heads/<nombre>), pero se revisan los dos.
        piezas += [("nombre de la referencia", None, ref.encode()),
                   ("nombre de la referencia remota", None, ref_remota.encode())]
        objetivo = sha
        while objetivo not in ya and git("cat-file", "-t", objetivo).strip() == b"tag":
            piezas += objeto_git(objetivo, "tag", aprobadas)
            objetivo = re.search(rb"^object ([0-9a-f]+)$", git("cat-file", "tag", objetivo), re.M).group(1).decode()
        tipo = git("cat-file", "-t", objetivo).strip().decode()
        if tipo != "commit":
            fallos.append(f"{ref_remota} apunta a un {tipo}, no a un commit")
            continue
        for c in git("rev-list", objetivo, "--not", *ya).decode().split():
            piezas += objeto_git(c, "commit", aprobadas)
            for ruta, modo, objeto in entradas(git("diff-tree", "-r", "--root", "-m", "--no-commit-id",
                                                    *DIFF, c)):
                if (ruta, objeto) not in vistos:
                    vistos.add((ruta, objeto))
                    piezas.append((f"commit {c[:7]}: ", ruta, blob(modo, objeto)))
    return piezas, revisados, fallos


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
        revisado = hashlib.sha256(contenido).hexdigest() in revisados
        fallos |= {f"{nombre}: {p}" for p in problemas(contenido, patrones, revisado)}
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
    """Huellas de la lista privada. De cada línea: la frase entera tal como se escribe (hasta
    FRASE palabras), pegada, y cada par de palabras que identifican, ordenado y pegado en los dos
    órdenes (dominios y usuarios). Del camelCase partido, solo los pares de palabras que
    identifican: la frase con partículas que sale al partirlo puede ser común en textos legales."""
    with open(ruta, encoding="utf-8") as f:
        lineas = [l for l in f if palabras(l)]
    largas = [i for i, l in enumerate(lineas, 1) if len(palabras(CAMEL.sub(" ", l))) > MAX_PALABRAS]
    if largas:
        sys.exit(f"Las líneas {largas} tienen más de {MAX_PALABRAS} palabras. "
                 "Acórtalas (por ejemplo, nombre y apellidos) o sube MAX_PALABRAS.")
    salida = []
    for linea in lineas:
        for partido, p in ((False, palabras(linea)), (True, palabras(CAMEL.sub(" ", linea)))):
            q = identifican(p)
            frases = ([sorted(p)] if not partido and len(p) <= FRASE else []) + [["".join(p)]]
            frases += [sorted(par) for par in itertools.combinations(q, 2)]
            frases += [["".join(par)] for par in itertools.permutations(q, 2)]
            for h in map(huella, frases):
                if h not in salida:
                    salida.append(h)
    print(*salida, sep="\n")
    return 0


def main(argv):
    modo = argv[1] if len(argv) > 1 else ""
    extra = []
    if modo == "huellas-desde":
        return huellas_desde(argv[2])
    if modo == "pre-push" and len(argv) == 4:
        piezas, revisados, extra = empujado(argv[3], sys.stdin.read().splitlines())
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
    fallos = revisar(piezas, patrones, revisados) + extra
    if fallos:
        print("Rechazado por las reglas del repo público:", *fallos, sep="\n  ", file=sys.stderr)
        if any("sin revisar" in f for f in fallos):
            print("Si una persona revisó un binario, su SHA-256 va en .githooks/revisados.sha256.", file=sys.stderr)
        return 1
    return gitleaks(piezas, patrones, revisados) if modo == "pre-push" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
