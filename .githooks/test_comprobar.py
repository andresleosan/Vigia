"""Pruebas de las reglas del repo público (solo biblioteca estándar).

Los datos sensibles de prueba se construyen al ejecutar, para que este
archivo no contenga ni correos, ni teléfonos, ni la raya larga.
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
RAYA = "\u2014"
ARROBA = "@"
PATRON = "zoila ficticia"  # nombre inventado; no está en el registro real
GITLEAKS = subprocess.run(["git", "-C", str(SCRIPT.parent), "config", "--get", "vigia.gitleaks"],
                          capture_output=True, text=True).stdout.strip()


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
        for numero in (tel("+5", "8 412 555 1234"), tel("0", "412-555-1234"), tel("00", "58 412 555 1234")):
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

    def test_comentarios_del_mensaje_tambien_se_revisan(self):
        # git puede conservar las líneas con "#" (commit.cleanup o core.commentChar): no se ignoran.
        texto = f"Añade la base\n# Escribe a alguien{ARROBA}correo.com\n"
        self.assertEqual(self.mensaje(texto).returncode, 1)

    def test_ruta_no_ascii(self):
        # git escribe estas rutas entre comillas en el diff.
        self.preparar(tel("Llama al +5", "8 412 555 1234\n"), nombre="ñandú.txt")
        self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_prefijos_de_diff_alterados(self):
        for clave in ("diff.mnemonicPrefix", "diff.noprefix"):
            with self.subTest(clave=clave):
                self.git("config", clave, "true")
                self.preparar(f"Texto {RAYA} con raya\n")
                self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_archivo_marcado_como_binario(self):
        (self.repo / ".gitattributes").write_text("*.txt binary\n", encoding="utf-8")
        self.git("add", ".gitattributes")
        self.preparar(f"Texto {RAYA} con raya\n")
        self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_patron_en_el_nombre_del_archivo(self):
        self.preparar("Texto limpio\n", nombre="notas-zoila-ficticia.txt")
        r = self.comprobar("pre-commit")
        self.assertEqual(r.returncode, 1)
        self.assertNotIn("oila", r.stderr)  # la ruta tampoco se imprime

    def test_patron_en_camel_case(self):
        self.preparar("const contactoZoilaFicticia = 1;\n")
        self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_mensaje_tras_tijera_ignorado(self):
        # Con commit -v, git pone el diff tras la tijera y lo quita del mensaje.
        texto = f"Añade la base\n# {'-' * 24} >8 {'-' * 24}\n-Escribe a alguien{ARROBA}correo.com\n"
        self.assertEqual(self.mensaje(texto).returncode, 0)

    def test_submodulo_no_rompe(self):
        sub = self.repo / "sub"
        sub.mkdir()
        for orden in (["init", "-q"], ["-c", "user.name=p", "-c", f"user.email=p{ARROBA}example.invalid",
                                       "commit", "-q", "--allow-empty", "-m", "x"]):
            subprocess.run(["git", *orden], cwd=sub, check=True, capture_output=True)
        self.git("add", "sub")
        self.assertEqual(self.comprobar("pre-commit").returncode, 0)

    def test_patron_con_caracteres_invisibles(self):
        for texto in ("Zoi\u00adla Ficticia", "Zoila\u200bFicticia", "Zoila\u2060 Ficticia"):
            with self.subTest(texto=texto):
                self.preparar(f"Reunión con {texto}\n")
                self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_telefono_con_parentesis(self):
        for numero in (tel("(0", "412) 555-1234"), tel("+5", "8 (412) 555 1234"), tel("(3", "00) 555-1234")):
            with self.subTest(numero=numero):
                self.preparar(f"Llama al {numero}\n")
                self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    def test_lista_privada_vacia_bloquea(self):
        self.patrones.write_text("")
        self.preparar("Texto limpio\n")
        self.assertNotEqual(self.comprobar("pre-commit").returncode, 0)

    def test_lista_privada_con_linea_invalida_bloquea(self):
        self.patrones.write_text(hashlib.sha256(PATRON.encode()).hexdigest() + "\nzoila ficticia\n")
        self.preparar("Texto limpio\n")
        self.assertNotEqual(self.comprobar("pre-commit").returncode, 0)

    def test_lista_privada_en_mayusculas(self):
        self.patrones.write_text(hashlib.sha256(PATRON.encode()).hexdigest().upper() + "\n")
        self.preparar("Reunión con Zoila Ficticia\n")
        self.assertEqual(self.comprobar("pre-commit").returncode, 1)

    @unittest.skipUnless(GITLEAKS and shutil.which("docker"), "sin docker o sin git config vigia.gitleaks")
    def test_hooks_con_gitleaks(self):
        for clave, valor in (("core.hooksPath", str(SCRIPT.parent)), ("vigia.gitleaks", GITLEAKS),
                             ("user.name", "prueba"), ("user.email", f"prueba{ARROBA}example.invalid")):
            self.git("config", clave, valor)
        self.preparar("Texto limpio\n")
        self.git("commit", "-qm", "Base")  # lo limpio pasa
        token = "ghp_" + secrets.token_hex(18)
        (self.repo / "a.txt").write_text(f'clave = "{token}"\n', encoding="utf-8")
        for orden in (["commit", "-qam", "Con commit -a"],                    # índice temporal
                      ["commit", "-q", "--allow-empty", "-m", f"Clave {token}"]):  # en el mensaje
            with self.subTest(orden=orden[1]):
                r = subprocess.run(["git", *orden], cwd=self.repo, capture_output=True, text=True)
                self.assertNotEqual(r.returncode, 0)
                self.assertIn("leaks found", r.stderr)
                self.assertNotIn(token, r.stdout + r.stderr)

    def test_huellas_desde(self):
        lista = pathlib.Path(self.tmp.name) / "lista.txt"
        lista.write_text("Zoila  Fícticia\n\n", encoding="utf-8")
        r = self.comprobar("huellas-desde", str(lista))
        self.assertEqual(r.stdout.split(), [hashlib.sha256(PATRON.encode()).hexdigest()])


if __name__ == "__main__":
    unittest.main()
