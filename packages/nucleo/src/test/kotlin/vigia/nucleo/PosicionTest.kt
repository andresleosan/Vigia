package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class PosicionTest {
    private fun texto(p: Posicion) = String(p.bytes(), Charsets.US_ASCII)

    @Test
    fun `grados desde microgrados enteros y nunca -0`() {
        assertTrue(texto(Posicion(0, -1, 0, 0)).contains(""""lat":"-0.000001","lon":"0.000000""""))
        assertTrue(texto(Posicion(0, 90000000, -180000000, 0)).contains(""""lat":"90.000000","lon":"-180.000000""""))
        assertTrue(texto(Posicion(0, 10480000, -66903600, 12)).contains(""""lat":"10.480000","lon":"-66.903600","precision_m":12"""))
    }

    @Test
    fun `siempre 128 bytes, con el relleno de ceros justo`() {
        val casos = listOf(Posicion(0, 0, 0, 0), Posicion(Jcv.MAX, -90000000, -180000000, 100000), Posicion(HORA, 10480000, -66903600, 12))
        for (p in casos) {
            assertEquals(128, p.bytes().size)
            assertTrue(Regex(""""relleno":"0+"}$""").containsMatchIn(texto(p)))
        }
    }

    @Test
    fun `fuera de rango lanza ErrorFormato`() {
        val malas = listOf(
            Posicion(0, 90000001, 0, 0), Posicion(0, -90000001, 0, 0), Posicion(0, 0, 180000001, 0),
            Posicion(0, 0, -180000001, 0), Posicion(0, 0, 0, 100001), Posicion(0, 0, 0, -1), Posicion(-1, 0, 0, 0),
        )
        for (p in malas) assertThrows<ErrorFormato>(p.toString()) { p.bytes() }
    }

    @Test
    fun `posiciones y rechazos iguales que shared`() {
        val v = Vectores.leer("cifrado.json")
        for (c in v.getJSONArray("posiciones").objetos()) assertArrayEquals(c.texto("jcv"), posicionDe(c).bytes())
        for (c in v.getJSONArray("posiciones_rechazadas").objetos()) assertThrows<ErrorFormato> { posicionDe(c).bytes() }
    }
}
