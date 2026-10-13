package vigia.nucleo

import org.json.JSONObject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class AcusesTest {
    private val servidor = FirmanteSoftware(parP256())
    private val rHash = "b".repeat(64)

    // El acuse que firmaría el Worker (contrato, sección 7), firmado aquí con una clave de prueba.
    private fun acuse(kid: String, hora: Long, r: String = rHash, clave: Firmante = servidor): ByteArray {
        val contenido = mapOf<String, Any>("hora_servidor" to hora, "kid" to kid, "r" to r, "v" to 1L)
        val firma = clave.firmar(Prefijos.ACUSE + Jcv.codificar(contenido))
        return Jcv.codificar(contenido + ("firma" to Codificacion.b64u(firma)))
    }

    private val lista = listOf(
        EntradaClave("prueba_activa", servidor.spki, "activa", HORA - 1000, null),
        EntradaClave("prueba_retirada", servidor.spki, "retirada", HORA - 1000, HORA + 1000),
        EntradaClave("prueba_comprometida", servidor.spki, "comprometida", HORA - 1000, null),
    )

    private fun verifica(bytes: ByteArray, r: String = rHash) = Acuses.verificar(lista, Acuses.analizar(bytes), r)

    @Test
    fun `analizar da los campos del acuse`() {
        val a = Acuses.analizar(acuse("prueba_activa", HORA))
        assertEquals(Acuse(1, "prueba_activa", rHash, HORA, a.firma), a)
        assertEquals(86, a.firma.length)
    }

    @Test
    fun `un acuse de una clave activa o retirada dentro de su ventana verifica`() {
        assertTrue(verifica(acuse("prueba_activa", HORA)))
        assertTrue(verifica(acuse("prueba_retirada", HORA + 1000)))
    }

    @Test
    fun `no verifica con un bit cambiado, otro r, kid desconocido, clave comprometida, fuera de la ventana u otra clave`() {
        val bueno = acuse("prueba_activa", HORA)
        val i = String(bueno, Charsets.US_ASCII).indexOf("\"hora_servidor\":") + 20 // una cifra de la hora
        val cambiado = bueno.copyOf().also { it[i] = (it[i].toInt() xor 1).toByte() }
        assertFalse(verifica(cambiado))
        assertFalse(verifica(bueno, "c".repeat(64)))
        assertFalse(verifica(acuse("prueba_otra", HORA)))
        assertFalse(verifica(acuse("prueba_comprometida", HORA)))
        assertFalse(verifica(acuse("prueba_retirada", HORA + 1001)))
        assertFalse(verifica(acuse("prueba_activa", HORA - 1001)))
        assertFalse(verifica(acuse("prueba_activa", HORA, clave = FirmanteSoftware(parP256()))))
    }

    @Test
    fun `la clave de dev no verifica contra la lista de produccion (vacia en H1)`() {
        assertFalse(Acuses.verificar(emptyList(), Acuses.analizar(acuse("prueba_activa", HORA)), rHash))
    }

    @Test
    fun `analizar rechaza claves de mas, v distinto de 1 y una firma que no mide 86 caracteres`() {
        val contenido = mapOf<String, Any>("firma" to "A".repeat(86), "hora_servidor" to HORA, "kid" to "prueba_activa", "r" to rHash, "v" to 1L)
        Acuses.analizar(Jcv.codificar(contenido))
        for (malo in listOf(contenido + ("extra" to "x"), contenido + ("v" to 2L), contenido + ("firma" to "A".repeat(85)), contenido - "kid")) {
            assertThrows<ErrorFormato> { Acuses.analizar(Jcv.codificar(malo)) }
        }
    }

    @Test
    fun `cada acuse de shared da en Kotlin el resultado anotado`() {
        val f = Vectores.leer("firmas-ts.json")
        val claves = f.getJSONArray("claves_acuse").textos().map { entradaDe(JSONObject(it)) }
        for (c in f.getJSONArray("acuses").objetos()) {
            val esperado = c.getString("resultado") == "valido"
            assertEquals(esperado, Acuses.verificar(claves, Acuses.analizar(c.texto("acuse")), c.getString("r")), c.getString("nombre"))
        }
    }

    // Una línea JCV de la lista fijada de claves de acuse (contrato, sección 7).
    private fun entradaDe(o: JSONObject) = EntradaClave(
        o.getString("kid"), Codificacion.deB64u(o.getString("spki")), o.getString("estado"), o.getLong("desde"),
        if (o.has("hasta")) o.getLong("hasta") else null,
    )
}
