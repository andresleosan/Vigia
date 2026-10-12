"""Pruebas de las reglas del repo público (solo biblioteca estándar).

Los datos sensibles de prueba se construyen al ejecutar: este archivo no contiene ni
correos, ni teléfonos enteros, ni la raya larga. Las pruebas que necesitan gitleaks se
saltan si no hay docker o si no está configurado vigia.gitleaks.
"""
import hashlib
import pathlib
import secrets
import shutil
import subprocess
import sys
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parent / "comprobar.py"
RAYA = chr(0x2014)
ARROBA = "@"
B = chr(92)  # barra invertida
NOMBRE = "Zoila Ficticia"  # nombre inventado; no está en el registro real
GITLEAKS = subprocess.run(["git", "-C", str(SCRIPT.parent), "config", "--get", "vigia.gitleaks"],
                          capture_output=True, text=True).stdout.strip()
CON_DOCKER = unittest.skipUnless(GITLEAKS and shutil.which("docker"), "sin docker o sin vigia.gitleaks")


def tel(*partes):
    """Une un teléfono de prueba partido: ningún literal de este archivo lo contiene entero."""
    return "".join(partes)


def h(*palabras):
    return hashlib.sha256(" ".join(palabras).encode()).hexdigest()


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = pathlib.Path(self.tmp.name)
        self.repo = self.base / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        self.patrones = self.base / "patrones.sha256"
        self.git("config", "vigia.patrones", str(self.patrones))
        self.lista(NOMBRE)

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True)

    def comprobar(self, *args, entrada=None):
        return subprocess.run([sys.executable, "-I", str(SCRIPT), *args], cwd=self.repo,
                              capture_output=True, text=True, input=entrada)

    def lista(self, *nombres):
        """Genera la lista privada con huellas-desde, como en el uso real."""
        fuente = self.base / "nombres.txt"
        fuente.write_text("\n".join(nombres) + "\n", encoding="utf-8")
        r = self.comprobar("huellas-desde", str(fuente))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.patrones.write_text(r.stdout)

    def preparar(self, contenido, nombre="a.txt"):
        ruta = self.repo / nombre
        ruta.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(contenido, bytes):
            ruta.write_bytes(contenido)
        else:
            ruta.write_text(contenido, encoding="utf-8")
        self.git("add", nombre)

    def rechaza(self, contenido, nombre="a.txt"):
        self.git("read-tree", "--empty")  # solo lo de esta comprobación en el índice
        self.preparar(contenido, nombre)
        r = self.comprobar("pre-commit")
        self.assertIn(r.returncode, (0, 1), r.stderr)
        return r.returncode == 1

    def mensaje(self, texto):
        ruta = self.base / "MENSAJE"
        ruta.write_text(texto, encoding="utf-8")
        return self.comprobar("commit-msg", str(ruta))


class PruebasReglas(Base):
    def test_texto_limpio(self):
        self.assertFalse(self.rechaza("Grabar y consultar derechos sin red.\n"))

    def test_raya_larga_rechazada(self):
        self.preparar(f"Texto {RAYA} con raya\n")
        r = self.comprobar("pre-commit")
        self.assertEqual(r.returncode, 1)
        self.assertIn("raya larga", r.stderr)

    def test_correos(self):
        self.assertTrue(self.rechaza(f"Escribe a alguien{ARROBA}correo.com\n"))
        self.assertFalse(self.rechaza(f"prueba{ARROBA}example.invalid\n"))

    def test_telefonos_rechazados(self):
        guion, guion_duro = chr(0x2013), chr(0x2011)
        numeros = (
            # VE con prefijo, nacionales, fijos, en pares y sin el 0
            tel("+58 414 55", "5 12 34"), tel("0414-55", "5.12.34"), tel("(0414) 55", "5.12.34"),
            tel("0414 55", "5 12 34"), tel("+58-412-55", "5.12.34"), tel("0412-55", "5-1234"),
            tel("04125", "551234"), tel("00", "58 41", "2 555 1234"), tel("wa.me/5841", "25551234"),
            tel("+58 212 55", "5 1234"), tel("0212-55", "5-1234"), tel("(0212) 55", "5-1234"),
            tel("0414/55", "51234"), tel("0414", guion, "555", guion, "1234"),
            tel("0414", guion_duro, "555", guion_duro, "1234"), tel("412-55", "5-1234"),
            tel("+58 (412) 55", "5 1234"), tel("+58 (0) 412 55", "5 1234"), tel("+58 0412 55", "5 1234"),
            # CO móviles y fijos
            tel("+57 300 55", "5 12 34"), tel("300 55", "51234"), tel("(300) 55", "51234"),
            tel("300 55", "5 12 34"), tel("+57 601 55", "5 1234"), tel("601 55", "5 1234"),
            tel("(601) 55", "5 1234"), tel("(+57) 300 55", "5 1234"), tel("3", "00 555 1234"),
        )
        for numero in numeros:
            with self.subTest(numero=numero):
                self.assertTrue(self.rechaza(f"Llama al {numero} hoy\n"))

    def test_no_son_telefonos(self):
        for texto in ("61fc662f01996cd06d713dacf5e133167bd309a1f329442d53f1e21a47b3ede6 04125551234567",
                      "Límite: 2.147.483.647 filas", "Versión 4.147.0, 12-oct-2026, 33.002.634 bytes",
                      "Identificador 3005551234 sin separadores", "Ritmo: 4 / 8 / 12 / 16 / 24 / 32 dp",
                      "https://mobbin.com/flows/b3c2b6da-8cb9-4312-8112-12bb74cb7ce8"):
            with self.subTest(texto=texto):
                self.assertFalse(self.rechaza(texto + "\n"))

    def test_patron_con_grafia_distinta(self):
        self.preparar("Reunión con ZOILA   Fíctícia mañana\n")
        r = self.comprobar("pre-commit")
        self.assertEqual(r.returncode, 1)
        self.assertNotIn("oila", r.stderr)  # nunca imprime el texto que coincidió

    def test_patron_en_otras_formas(self):
        for texto in ("Reunión con Zoila\nFicticia mañana",   # partido en dos líneas
                      "FICTICIA, ZOILA",                      # orden de los listados oficiales
                      "Zoila M. Ficticia",                    # con una inicial
                      "https://zoilaficticia.org/informe",    # pegado, en un dominio
                      "const contactoZoilaFicticia = 1;"):    # camelCase
            with self.subTest(texto=texto):
                self.assertTrue(self.rechaza(texto + "\n"))

    def test_patron_en_el_nombre_del_archivo(self):
        self.preparar("Texto limpio\n", nombre="notas-zoila-ficticia.txt")
        r = self.comprobar("pre-commit")
        self.assertEqual(r.returncode, 1)
        self.assertNotIn("oila", r.stderr)  # la ruta tampoco se imprime

    def test_invisibles(self):
        zwsp, shy, wj, cgj = chr(0x200B), chr(0x00AD), chr(0x2060), chr(0x034F)
        for texto in (f"Zoi{shy}la Ficticia", f"Zoila{zwsp}Ficticia", f"Zoila{wj} Ficticia",
                      f"Zoi{cgj}la Ficticia", f"alguien{zwsp}{ARROBA}correo.com",
                      f"alguien{ARROBA}corr{shy}eo.com", f"alguien{cgj}{ARROBA}correo.com",
                      tel("04", f"12{zwsp}555{zwsp}1234")):
            with self.subTest(texto=texto):
                self.assertTrue(self.rechaza(f"Contacto: {texto}\n"))

    def test_escapes(self):
        for texto in (f'{{"n": "Zoil{B}u0061 Ficticia"}}', f"Zoil{B}x61 Ficticia", "Zoil&#97; Ficticia",
                      "?q=Zoila%20Ficticia", tel("mailto:alguien%", "40correo.com"), "Zoila&nbsp;Ficticia"):
            with self.subTest(texto=texto):
                self.assertTrue(self.rechaza(texto + "\n"))

    def test_cp1252(self):
        self.assertTrue(self.rechaza("Reunión con Zoila Fíctícia".encode("cp1252")))

    def test_nombre_largo(self):
        self.lista("María de los Ángeles Ficticia")
        self.assertTrue(self.rechaza("Reunión con MARÍA DE LOS ÁNGELES FICTICIA mañana\n"))

    def test_huellas_desde(self):
        self.lista("Zoila  Fícticia")
        self.assertEqual(self.patrones.read_text().split(), [h("ficticia", "zoila"), h("zoilaficticia")])

    def test_huellas_desde_con_camel_case(self):
        self.lista("ZoilaFicticia")
        self.assertTrue(self.rechaza("Reunión con Zoila Ficticia\n"))
        self.assertTrue(self.rechaza("Ver zoilaficticia.org\n"))

    def test_huellas_desde_rechaza_lineas_largas(self):
        fuente = self.base / "largo.txt"
        fuente.write_text("Uno Dos Tres Cuatro Cinco Seis Siete Ocho Nueve\n", encoding="utf-8")
        r = self.comprobar("huellas-desde", str(fuente))
        self.assertEqual(r.returncode, 1)
        self.assertEqual(r.stdout, "")
        self.assertNotIn("Cinco", r.stderr)

    def test_lista_privada_mal_configurada_bloquea(self):
        for contenido in ("", h("ficticia", "zoila") + "\nzoila ficticia\n", None):
            with self.subTest(contenido=contenido):
                if contenido is None:
                    self.patrones.unlink()
                else:
                    self.patrones.write_text(contenido)
                self.preparar("Texto limpio\n")
                self.assertNotEqual(self.comprobar("pre-commit").returncode, 0)

    def test_lista_privada_en_mayusculas(self):
        self.patrones.write_text(h("ficticia", "zoila").upper() + "\n")
        self.assertTrue(self.rechaza("Reunión con Zoila Ficticia\n"))

    def test_binarios_y_lfs(self):
        png = bytes([0x89]) + b"PNG" + bytes(4) + b"IHDR"
        lfs = b"version https://git-lfs.github.com/spec/v1\noid sha256:" + b"a" * 64 + b"\nsize 12\n"
        for contenido in (png, lfs, NOMBRE.encode("utf-16")):
            with self.subTest(contenido=contenido[:12]):
                self.git("read-tree", "--empty")
                self.preparar(contenido, nombre="imagen.png")
                r = self.comprobar("pre-commit")
                self.assertEqual(r.returncode, 1)
                self.assertIn("binario", r.stderr)

    def test_binario_revisado(self):
        png = bytes([0x89]) + b"PNG" + bytes(4) + b"IHDR"
        self.preparar(png, nombre="imagen.png")
        self.preparar(hashlib.sha256(png).hexdigest() + "  imagen de prueba\n", nombre=".githooks/revisados.sha256")
        self.assertEqual(self.comprobar("pre-commit").returncode, 0)
        self.preparar("no es una huella\n", nombre=".githooks/revisados.sha256")
        self.assertNotEqual(self.comprobar("pre-commit").returncode, 0)

    def test_rutas_de_claves_y_configuracion(self):
        for nombre in (".env.production", "backend/.dev.vars.production", "claves/firma.pfx", "x.key", "y.PEM"):
            with self.subTest(nombre=nombre):
                self.assertTrue(self.rechaza("Texto limpio\n", nombre=nombre))

    def test_ruta_no_ascii(self):
        self.assertTrue(self.rechaza(tel("Llama al 0412 55", "5 1234\n"), nombre="ñandú.txt"))

    def test_prefijos_de_diff_alterados(self):
        for clave in ("diff.mnemonicPrefix", "diff.noprefix"):
            with self.subTest(clave=clave):
                self.git("config", clave, "true")
                self.assertTrue(self.rechaza(f"Texto {RAYA} con raya\n"))

    def test_archivo_marcado_como_binario(self):
        self.preparar("*.txt binary\n", nombre=".gitattributes")
        self.preparar(f"Texto {RAYA} con raya\n")
        self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_submodulo_no_rompe(self):
        sub = self.repo / "sub"
        sub.mkdir()
        for orden in (["init", "-q"], ["-c", "user.name=p", "-c", f"user.email=p{ARROBA}example.invalid",
                                       "commit", "-q", "--allow-empty", "-m", "x"]):
            subprocess.run(["git", *orden], cwd=sub, check=True, capture_output=True)
        self.git("add", "sub")
        self.assertEqual(self.comprobar("pre-commit").returncode, 0)

    def test_mensajes(self):
        trailer = f"Co-Authored-By: Claude Opus 5.5 (1M context) <noreply{ARROBA}anthropic.com>"
        self.assertEqual(self.mensaje(f"Añade la base\n\n{trailer}\n").returncode, 0)
        for texto in (f"Arregla algo {RAYA} rápido\n",
                      # git conserva las líneas con "#" con -m, y lo que sigue a una tijera escrita a mano
                      f"Añade la base\n# Escribe a alguien{ARROBA}correo.com\n",
                      f"Añade la base\n# {'-' * 24} >8 {'-' * 24}\nEscribe a alguien{ARROBA}correo.com\n"):
            with self.subTest(texto=texto):
                self.assertEqual(self.mensaje(texto).returncode, 1)


@CON_DOCKER
class PruebasConGitleaks(Base):
    def setUp(self):
        super().setUp()
        for clave, valor in (("core.hooksPath", str(SCRIPT.parent)), ("vigia.gitleaks", GITLEAKS),
                             ("user.name", "prueba"), ("user.email", f"prueba{ARROBA}example.invalid")):
            self.git("config", clave, valor)

    def commit(self, *args):
        return subprocess.run(["git", "commit", "-q", *args], cwd=self.repo, capture_output=True, text=True)

    def push(self, *refs):
        return subprocess.run(["git", "push", "-q", "origin", *refs], cwd=self.repo, capture_output=True, text=True)

    def test_hooks_de_commit(self):
        self.preparar("Texto limpio\n")
        self.assertEqual(self.commit("-m", "Base").returncode, 0)
        token = "ghp_" + secrets.token_hex(18)
        (self.repo / "a.txt").write_text(f'clave = "{token}"\n', encoding="utf-8")
        for caso, orden in (("commit -a", ["-am", "Prueba"]),  # índice temporal
                            ("mensaje", ["--allow-empty", "-m", f"Clave {token}"])):
            with self.subTest(caso=caso):
                r = self.commit(*orden)
                self.assertNotEqual(r.returncode, 0)
                self.assertIn("leaks found", r.stderr)
                self.assertNotIn(token, r.stdout + r.stderr)

    def test_vectores_publicos_revisados(self):
        vectores = "[" + ",".join(f'{{"key": "{secrets.token_hex(32)}", "secret": "{secrets.token_hex(32)}"}}'
                                  for _ in range(4)) + "]\n"
        self.preparar(vectores, nombre="test-vectors.json")
        self.assertIn("leaks found", self.commit("-m", "Vectores").stderr)
        self.preparar(hashlib.sha256(vectores.encode()).hexdigest() + "  vectores públicos de prueba\n",
                      nombre=".githooks/revisados.sha256")
        r = self.commit("-m", "Vectores")
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_pre_push(self):
        remoto = self.base / "remoto.git"
        subprocess.run(["git", "init", "-q", "--bare", str(remoto)], check=True)
        self.git("remote", "add", "origin", str(remoto))
        self.preparar("Texto limpio\n")
        self.commit("-m", "Base")
        r = self.push("HEAD:refs/heads/main")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.git("fetch", "-q", "origin")
        autor = f"Zoila Ficticia <zoila{ARROBA}correo.com>"
        casos = (
            ("commit sin hooks", ["--no-verify", "-m", "Prueba"], "HEAD:refs/heads/main"),
            ("autor ajeno", ["--no-verify", "--allow-empty", f"--author={autor}", "-m", "Prueba"],
             "HEAD:refs/heads/main"),
            ("etiqueta", None, "refs/tags/f2-prueba"),
        )
        for caso, orden, destino in casos:
            with self.subTest(caso=caso):
                if caso == "commit sin hooks":
                    self.preparar(tel("Llama al 0412 55", "5 1234\n"), nombre="b.txt")
                if orden:
                    self.assertEqual(self.commit(*orden).returncode, 0)
                else:
                    self.git("tag", "-a", "f2-prueba", "-m", f"Aprobado por alguien{ARROBA}correo.com")
                r = self.push(destino)
                self.assertNotEqual(r.returncode, 0)
                self.assertIn("Rechazado", r.stderr)
                self.git("reset", "-q", "--hard", "origin/main")
                if not orden:
                    self.git("tag", "-d", "f2-prueba")
        self.preparar("Otro texto limpio\n", nombre="c.txt")
        self.commit("-m", "Sigue limpio")
        self.git("tag", "-a", "f2-prueba", "-m", "Hito aprobado")
        r = self.push("HEAD:refs/heads/main", "refs/tags/f2-prueba")
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
