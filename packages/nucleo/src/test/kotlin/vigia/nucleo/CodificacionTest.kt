package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.util.Base64
import kotlin.random.Random

class CodificacionTest {
    @Test
    fun `hex en minusculas, ida y vuelta`() {
        val b = ByteArray(256) { it.toByte() }
        val t = Codificacion.hex(b)
        assertEquals("000102", t.take(6))
        assertEquals("fdfeff", t.takeLast(6))
        assertArrayEquals(b, Codificacion.deHex(t))
    }

    @Test
    fun `deHex rechaza longitud impar, mayusculas y caracteres de fuera`() {
        for (t in listOf("abc", "AB", "0g", "0x")) assertThrows<ErrorFormato>(t) { Codificacion.deHex(t) }
    }

    @Test
    fun `b64u coincide con el codificador url sin relleno de la JVM, ida y vuelta`() {
        // La JVM de las pruebas tiene java.util.Base64; src/main no puede usarlo (API 24).
        val azar = Random(24)
        for (n in 0..100) {
            val b = azar.nextBytes(n)
            val t = Codificacion.b64u(b)
            assertEquals(Base64.getUrlEncoder().withoutPadding().encodeToString(b), t)
            assertArrayEquals(b, Codificacion.deB64u(t))
        }
    }

    @Test
    fun `deB64u rechaza relleno, mas, barra, espacio, longitud con resto 1 y forma no canonica`() {
        for (t in listOf("AA==", "AAA=", "A+AA", "A/AA", "AA A", "A", "AAAAA", "AB", "AAB")) {
            assertThrows<ErrorFormato>(t) { Codificacion.deB64u(t) }
        }
    }

    @Test
    fun `una forma canonica vuelve igual`() {
        for (t in listOf("", "AA", "AAE", "_-8", "AQID")) assertEquals(t, Codificacion.b64u(Codificacion.deB64u(t)))
    }

    @Test
    fun `codificacion igual que shared, y los mismos rechazos`() {
        val v = Vectores.leer("codificacion.json")
        for (c in v.getJSONArray("b64u").objetos()) {
            assertEquals(c.getString("b64u"), Codificacion.b64u(c.bytes("hex")))
            assertEquals(c.getString("hex"), Codificacion.hex(Codificacion.deB64u(c.getString("b64u"))))
        }
        for (t in v.getJSONArray("b64u_rechazados").textos()) assertThrows<ErrorFormato>(t) { Codificacion.deB64u(t) }
        for (t in v.getJSONArray("hex_rechazados").textos()) assertThrows<ErrorFormato>(t) { Codificacion.deHex(t) }
        for (c in v.getJSONArray("u16be").objetos()) assertEquals(c.getString("hex"), Codificacion.hex(Codificacion.u16be(c.getInt("n"))))
        for (c in v.getJSONArray("u32be").objetos()) assertEquals(c.getString("hex"), Codificacion.hex(Codificacion.u32be(c.getLong("n"))))
    }

    @Test
    fun `u16be y u32be en sus limites`() {
        assertArrayEquals(byteArrayOf(0, 0), Codificacion.u16be(0))
        assertArrayEquals(byteArrayOf(-1, -1), Codificacion.u16be(0xffff))
        assertArrayEquals(byteArrayOf(0, 0x0f, 0x42, 0x3f), Codificacion.u32be(999999))
        assertArrayEquals(byteArrayOf(-1, -1, -1, -1), Codificacion.u32be(0xffffffffL))
        assertThrows<ErrorFormato> { Codificacion.u16be(0x10000) }
        assertThrows<ErrorFormato> { Codificacion.u16be(-1) }
        assertThrows<ErrorFormato> { Codificacion.u32be(0x100000000L) }
        assertThrows<ErrorFormato> { Codificacion.u32be(-1) }
    }
}
