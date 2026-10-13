package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import javax.crypto.AEADBadTagException

class CifradoTest {
    private val k = ByteArray(32) { it.toByte() }
    private val inc = "incidente_de_prueba_01"

    @Test
    fun `con el nonce del vector, el mismo cifrado que shared, y se descifra`() {
        val v = Vectores.leer("cifrado.json")
        val kv = v.bytes("k")
        for (c in v.getJSONArray("aes_gcm").objetos()) {
            val cifrado = Cifrado.cifrarConNonce(c.bytes("nonce"), kv, c.bytes("aad"), c.bytes("claro"))
            assertEquals(c.getString("cifrado"), Codificacion.hex(cifrado), c.getString("nombre"))
            assertArrayEquals(c.bytes("claro"), Cifrado.descifrar(kv, c.bytes("aad"), cifrado))
        }
    }

    @Test
    fun `audio y loc de los fragmentos de los vectores, con sus nonces`() {
        val v = Vectores.leer("registros.json")
        val kv = v.bytes("k")
        var conLoc = 0
        for (caso in v.getJSONArray("registros").objetos()) {
            val f = registroDe(caso.getString("jcv")) as? Fragmento ?: continue
            val ct = Cifrado.cifrarConNonce(caso.bytes("nonce"), kv, Aad.de("ct", f.incidente, f.seq.toLong()), caso.bytes("audio"))
            assertEquals(caso.getString("cifrado"), Codificacion.hex(ct))
            if (!caso.has("posicion")) continue
            val claro = posicionDe(caso.getJSONObject("posicion")).bytes()
            val loc = Codificacion.b64u(Cifrado.cifrarConNonce(caso.bytes("nonce_loc"), kv, Aad.de("loc", f.incidente, f.seq.toLong()), claro))
            assertEquals(208, loc.length)
            assertEquals(f.loc, loc)
            conLoc++
        }
        assertTrue(conLoc > 0)
    }

    @Test
    fun `dos cifrados de lo mismo llevan nonces distintos`() {
        val aad = Aad.de("ct", inc, 1)
        val a = Cifrado.cifrar(k, aad, ascii("audio"))
        val b = Cifrado.cifrar(k, aad, ascii("audio"))
        assertFalse(a.copyOfRange(0, 12).contentEquals(b.copyOfRange(0, 12)))
        assertArrayEquals(ascii("audio"), Cifrado.descifrar(k, aad, a))
        assertArrayEquals(ascii("audio"), Cifrado.descifrar(k, aad, b))
    }

    @Test
    fun `con la AAD de otro tipo, otro seq u otro incidente no se descifra`() {
        val c = Cifrado.cifrar(k, Aad.de("ct", inc, 1), ascii("audio"))
        for (otra in listOf(Aad.de("loc", inc, 1), Aad.de("ct", inc, 2), Aad.de("ct", "incidente_de_prueba_02", 1))) {
            assertThrows<AEADBadTagException> { Cifrado.descifrar(k, otra, c) }
        }
    }

    @Test
    fun `K que no mide 32 bytes y cifrado mas corto que nonce y etiqueta se rechazan`() {
        assertThrows<ErrorFormato> { Cifrado.cifrar(ByteArray(16), ByteArray(0), ByteArray(0)) }
        assertThrows<ErrorFormato> { Cifrado.descifrar(k, ByteArray(0), ByteArray(27)) }
    }
}
