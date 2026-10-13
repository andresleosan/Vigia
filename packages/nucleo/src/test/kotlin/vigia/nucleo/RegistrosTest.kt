package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class RegistrosTest {
    private val v = Vectores.leer("registros.json")
    private val inc = "incidente_de_prueba_01"
    private val h = "a".repeat(64)

    @Test
    fun `bytes, hash y prefijo de cada registro iguales que shared`() {
        val casos = v.getJSONArray("registros").objetos()
        val tipos = casos.map { registroDe(it.getString("jcv"))::class.simpleName }.toSet()
        assertEquals(setOf("Apertura", "Fragmento", "Hueco", "Cierre"), tipos)
        for (caso in casos) {
            val r = registroDe(caso.getString("jcv"))
            val bytes = Registros.bytes(r)
            assertArrayEquals(caso.texto("jcv"), bytes, caso.getString("nombre"))
            assertEquals(caso.getString("hash"), Registros.hash(bytes))
            assertEquals(caso.getString("prefijo"), Codificacion.hex(Registros.prefijo(r)))
        }
    }

    @Test
    fun `kc de la apertura, y p y c de cada fragmento, iguales que shared`() {
        val k = v.bytes("k")
        var fragmentos = 0
        for (caso in v.getJSONArray("registros").objetos()) {
            when (val r = registroDe(caso.getString("jcv"))) {
                is Apertura -> assertEquals(r.kc, Registros.compromisoK(v.getString("incidente"), k))
                is Fragmento -> {
                    assertEquals(r.p, Registros.huellaAudio(k, caso.bytes("audio")))
                    assertEquals(r.c, Registros.hash(caso.bytes("cifrado")))
                    fragmentos++
                }
                else -> {}
            }
        }
        assertTrue(fragmentos > 0)
    }

    @Test
    fun `kc y p con valores calculados aparte (hashlib y hmac de Python)`() {
        val k = ByteArray(32) { it.toByte() }
        assertEquals("1a1c4dbf26fa2adec890fd62e01d5d30c2b6681f53d1b142795ee02c8efe939a", Registros.compromisoK(inc, k))
        assertEquals("24ee2907aa5f8fd0d97069025e7cc9333f802776b6d174627b53d80e946c707e", Registros.huellaAudio(k, ascii("audio de prueba 1")))
    }

    @Test
    fun `HKDF con la sal de 32 ceros da lo mismo que RFC 5869 sin sal (caso A3)`() {
        val okm = Registros.hkdf32(ByteArray(22) { 0x0b }, ByteArray(0))
        assertEquals("8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d", Codificacion.hex(okm))
    }

    @Test
    fun `el mismo audio da otro p con otra K`() {
        val silencio = ByteArray(4096)
        assertNotEquals(Registros.huellaAudio(ByteArray(32) { 1 }, silencio), Registros.huellaAudio(ByteArray(32) { 2 }, silencio))
    }

    @Test
    fun `bytes rechaza los registros que el servidor no admite`() {
        val malos = listOf(
            Apertura(inc, 1, "ve", h, "grabar", h), // country_code en minúsculas
            Apertura(inc, 1, "VE", h, "grabar", "a".repeat(63)), // kc corto
            Apertura(inc, 1, "VE", h, "otro", h),
            Apertura("incidente_corto", 1, "VE", h, "grabar", h),
            Fragmento(inc, 1000000, 1, h, h, h),
            Fragmento(inc, 0, 1, h, h, h),
            Fragmento(inc, 1, 1, h, h, h, "A".repeat(207)),
            Hueco(inc, 1, 10, h, 9, "microfono"), // fin menor que hora_telefono
            Hueco(inc, 1, 10, h, 10, "otro"),
            Cierre(inc, 1, 1000000, h),
            Cierre(inc, -1, 1, h),
        )
        for (r in malos) assertThrows<ErrorFormato>(r.toString()) { Registros.bytes(r) }
    }

    @Test
    fun `prefijos iguales que shared, y el compartido no se altera`() {
        val v = Vectores.leer("prefijos.json")
        val prefijos = mapOf(
            "registro" to Prefijos.REGISTRO, "cierre" to Prefijos.CIERRE, "peticion" to Prefijos.PETICION,
            "acuse" to Prefijos.ACUSE, "evento" to Prefijos.EVENTO, "compromiso" to Prefijos.COMPROMISO,
            "recuperacion" to Prefijos.RECUPERACION,
        )
        assertEquals(prefijos.keys, v.keySet())
        for ((nombre, p) in prefijos) assertEquals(v.getString(nombre), Codificacion.hex(p), nombre)
        Prefijos.REGISTRO[0] = 0
        assertEquals('v'.code.toByte(), Prefijos.REGISTRO[0])
    }

    @Test
    fun `el cierre firma con su prefijo y los demas con el de registro`() {
        assertEquals("vigia/v1/cierre\u0000", String(Registros.prefijo(Cierre(inc, 1, 0, h)), Charsets.US_ASCII))
        for (r in listOf(Apertura(inc, 1, "VE", h, "sos", h), Fragmento(inc, 1, 1, h, h, h), Hueco(inc, 1, 1, h, 1, "microfono"))) {
            assertEquals("vigia/v1/registro\u0000", String(Registros.prefijo(r), Charsets.US_ASCII))
        }
    }

    @Test
    fun `SPKI validas y rechazadas como en shared`() {
        val v = Vectores.leer("spki.json")
        for (c in v.getJSONArray("validas").objetos()) {
            assertTrue(Spki.esP256(c.bytes("spki")))
            assertEquals(c.getString("huella"), Spki.huella(c.bytes("spki")))
            assertEquals(c.getString("b64u"), Codificacion.b64u(c.bytes("spki")))
        }
        for (c in v.getJSONArray("rechazadas").objetos()) {
            assertFalse(Spki.esP256(c.bytes("spki")), c.getString("nombre"))
            assertThrows<ErrorFormato>(c.getString("nombre")) { Spki.huella(c.bytes("spki")) }
        }
    }
}
