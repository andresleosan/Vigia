package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class JcvTest {
    private val esquema = mapOf(
        "a" to Jcv.Entero(0, Jcv.MAX),
        "b" to Jcv.Cadena(Regex("[a-z]{0,8}")),
        "c" to Jcv.Cadena(Regex("x"), opcional = true),
    )

    private fun bytes(t: String) = t.toByteArray(Charsets.ISO_8859_1)
    private fun analiza(t: String) = Jcv.analizar(bytes(t), esquema)

    @Test
    fun `codificar ordena las claves por bytes y no deja espacios`() {
        val b = Jcv.codificar(mapOf("c" to "x", "b" to "uno", "a" to 7L))
        assertEquals("""{"a":7,"b":"uno","c":"x"}""", String(b, Charsets.US_ASCII))
    }

    @Test
    fun `analizar da los valores y la ida y vuelta es exacta`() {
        val t = """{"a":9007199254740991,"b":""}"""
        val v = analiza(t)
        assertEquals(mapOf("a" to 9007199254740991L, "b" to ""), v)
        assertArrayEquals(bytes(t), Jcv.codificar(v))
    }

    @Test
    fun `el opcional puede faltar o estar`() {
        assertEquals("x", analiza("""{"a":0,"b":"","c":"x"}""")["c"])
        assertFalse(analiza("""{"a":0,"b":""}""").containsKey("c"))
    }

    @Test
    fun `analizar rechaza lo que se sale de la gramatica o del esquema`() {
        val malos = listOf(
            "", "{", "{}", """{"b":"","a":0}""", """{"a":0,"a":1,"b":""}""", """{"a":0, "b":""}""",
            """{ "a":0,"b":""}""", """{"a":0,"b":"","d":1}""", """{"a":0}""", """{"a":"0","b":""}""",
            """{"a":0,"b":1}""", """{"a":0,"b":"UNO"}""", """{"a":0,"b":"u\"o"}""", """{"a":0,"b":"u o"}""",
            """{"a":01,"b":""}""", """{"a":-1,"b":""}""", """{"a":9007199254740992,"b":""}""",
            """{"a":1.0,"b":""}""", """{"a":1e3,"b":""}""", """{"a":{"x":1},"b":""}""", """{"a":[1],"b":""}""",
            """{"a":true,"b":""}""", """{"a":null,"b":""}""", """{"A":0,"b":""}""", """{"a":0,"b":"","c":"y"}""",
            """{"a":0,"b":""}x""", """{"a":0,"b":""}""" + "\n", "{\"a\":0,\"b\":\"\n\"}",
        )
        for (t in malos) assertThrows<ErrorFormato>(t) { analiza(t) }
    }

    @Test
    fun `analizar rechaza bytes que no son ASCII`() {
        val conEnie = bytes("{\"a\":0,\"b\":\"") + byteArrayOf(0xC3.toByte(), 0xB1.toByte()) + bytes("\"}")
        assertThrows<ErrorFormato> { Jcv.analizar(conEnie, esquema) }
    }

    @Test
    fun `cadenas de hasta 4096 caracteres`() {
        val largo = mapOf("b" to Jcv.Cadena(Regex("x*")))
        assertEquals("x".repeat(4096), Jcv.analizar(bytes("""{"b":"${"x".repeat(4096)}"}"""), largo)["b"])
        assertThrows<ErrorFormato> { Jcv.analizar(bytes("""{"b":"${"x".repeat(4097)}"}"""), largo) }
    }

    @Test
    fun `una entrada con 10 000 pares no agota la pila`() {
        val t = (0 until 10000).joinToString(",", "{", "}") { "\"a${it.toString().padStart(5, '0')}\":0" }
        assertThrows<ErrorFormato> { analiza(t) } // clave desconocida, tras leer todos los pares
    }

    @Test
    fun `codificar rechaza tipos, claves y cadenas fuera de la gramatica`() {
        val malos = listOf<Map<String, Any>>(
            mapOf("a" to 1), mapOf("a" to -1L), mapOf("a" to Jcv.MAX + 1), mapOf("A" to 1L),
            mapOf("a" to "ñ"), mapOf("a" to "x".repeat(4097)), mapOf("a" to 1.5),
        )
        for (m in malos) assertThrows<ErrorFormato>(m.toString()) { Jcv.codificar(m) }
    }
}
