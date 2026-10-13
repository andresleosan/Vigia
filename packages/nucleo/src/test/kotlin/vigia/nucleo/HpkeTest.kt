package vigia.nucleo

import org.bouncycastle.crypto.InvalidCipherTextException
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class HpkeTest {
    private val hpke = HpkeBouncyCastle()
    private val suite = hpke.suite
    private val inc = "incidente_de_prueba_01"
    private val k = ByteArray(32) { it.toByte() }

    @Test
    fun `vector de CFRG de la suite en modo base, con la suite de HpkeBouncyCastle`() {
        val v = Vectores.leer("hpke-cfrg.json")
        val receptor = suite.deriveKeyPair(v.bytes("ikmR"))
        assertEquals(v.getString("pkRm"), Codificacion.hex(suite.serializePublicKey(receptor.public)))
        val emisor = suite.setupBaseS(receptor.public, v.bytes("info"), suite.deriveKeyPair(v.bytes("ikmE")))
        assertEquals(v.getString("enc"), Codificacion.hex(emisor.encapsulation))
        val abre = suite.setupBaseR(v.bytes("enc"), receptor, v.bytes("info"))
        val cifrados = v.getJSONArray("encryptions").objetos()
        assertEquals(257, cifrados.size)
        for (c in cifrados) {
            assertEquals(c.getString("ct"), Codificacion.hex(emisor.seal(c.bytes("aad"), c.bytes("pt"))))
            assertEquals(c.getString("pt"), Codificacion.hex(abre.open(c.bytes("aad"), c.bytes("ct"))))
        }
    }

    @Test
    fun `sellar y abrir del contrato (un Seal, AAD vacia) con la clave y el nonce del vector de CFRG`() {
        val v = Vectores.leer("hpke-cfrg.json")
        val pt = v.getJSONArray("encryptions").getJSONObject(0).bytes("pt")
        val sellado = hpke.sellarConSemilla(v.bytes("ikmE"), v.bytes("pkRm"), v.bytes("info"), pt)
        assertEquals(v.getString("enc"), Codificacion.hex(sellado.copyOfRange(0, 32)))
        // El primer Seal del contexto es AES-256-GCM con su key y su base_nonce.
        val aes = Cipher.getInstance("AES/GCM/NoPadding")
        aes.init(Cipher.ENCRYPT_MODE, SecretKeySpec(v.bytes("key"), "AES"), GCMParameterSpec(128, v.bytes("base_nonce")))
        assertArrayEquals(aes.doFinal(pt), sellado.copyOfRange(32, sellado.size))
        val privada = suite.serializePrivateKey(suite.deriveKeyPair(v.bytes("ikmR")).private)
        assertArrayEquals(pt, hpke.abrir(privada, sellado.copyOfRange(0, 32), v.bytes("info"), sellado.copyOfRange(32, sellado.size)))
    }

    @Test
    fun `con la efimera del vector, la misma envoltura que shared, y se desenvuelve`() {
        val v = Vectores.leer("envoltura.json")
        val receptor = suite.deriveKeyPair(v.bytes("semilla_receptor"))
        assertEquals(v.getString("publica_receptor"), Codificacion.hex(suite.serializePublicKey(receptor.public)))
        val privada = suite.serializePrivateKey(receptor.private)
        for (c in v.getJSONArray("casos").objetos()) {
            val info = Envoltura.info(v.getString("incidente"), c.getString("rol"))
            assertEquals(c.getString("info"), Codificacion.hex(info))
            val envoltura = hpke.sellarConSemilla(v.bytes("semilla_efimera"), v.bytes("publica_receptor"), info, v.bytes("k"))
            assertEquals(c.getString("envoltura"), Codificacion.hex(envoltura), c.getString("rol"))
            assertArrayEquals(v.bytes("k"), Envoltura.desenvolver(hpke, privada, v.getString("incidente"), c.getString("rol"), envoltura))
        }
    }

    @Test
    fun `dos envolturas de la misma K miden 80 bytes y llevan enc distintos`() {
        val publica = suite.serializePublicKey(suite.generatePrivateKey().public)
        val a = Envoltura.envolver(hpke, publica, inc, "contacto", k)
        val b = Envoltura.envolver(hpke, publica, inc, "contacto", k)
        assertEquals(80, a.size)
        assertFalse(a.copyOfRange(0, 32).contentEquals(b.copyOfRange(0, 32)))
    }

    @Test
    fun `otro incidente u otro rol no abren`() {
        val receptor = suite.generatePrivateKey()
        val privada = suite.serializePrivateKey(receptor.private)
        val e = Envoltura.envolver(hpke, suite.serializePublicKey(receptor.public), inc, "contacto", k)
        assertArrayEquals(k, Envoltura.desenvolver(hpke, privada, inc, "contacto", e))
        assertThrows<InvalidCipherTextException> { Envoltura.desenvolver(hpke, privada, "incidente_de_prueba_02", "contacto", e) }
        assertThrows<InvalidCipherTextException> { Envoltura.desenvolver(hpke, privada, inc, "recuperacion", e) }
    }

    @Test
    fun `K de otro largo y envolturas que no miden 80 bytes se rechazan`() {
        val receptor = suite.generatePrivateKey()
        assertThrows<ErrorFormato> { Envoltura.envolver(hpke, suite.serializePublicKey(receptor.public), inc, "contacto", ByteArray(16)) }
        assertThrows<ErrorFormato> { Envoltura.desenvolver(hpke, suite.serializePrivateKey(receptor.private), inc, "contacto", ByteArray(79)) }
    }
}
