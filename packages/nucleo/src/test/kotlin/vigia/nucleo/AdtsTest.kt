package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.ByteArrayOutputStream

class AdtsTest {
    // Flujo sintético: cada trama con la cabecera de Adts y un payload de largo y contenido distintos.
    private fun flujo(tramas: Int): ByteArray {
        val salida = ByteArrayOutputStream()
        for (i in 0 until tramas) {
            val payload = ByteArray(50 + (i * 37) % 300) { (i + it).toByte() }
            salida.write(Adts.cabecera(payload.size))
            salida.write(payload)
        }
        return salida.toByteArray()
    }

    private fun tramasPorFragmento(fragmentos: List<ByteArray>) = fragmentos.map { Adts.tramas(it).size }

    private fun largo(c: ByteArray) =
        ((c[3].toInt() and 3) shl 11) or ((c[4].toInt() and 0xFF) shl 3) or ((c[5].toInt() and 0xFF) shr 5)

    @Test
    fun `la cabecera es la que escribe el muxer adts de ffmpeg`() {
        // ffmpeg 6.1.1 (-c:a aac -f adts): 16 kHz mono, trama de 11 bytes (el silencio de abajo); 44,1 kHz estéreo,
        // primera trama de un seno a 128k (345 bytes); 48 kHz estéreo, la mayor de 2 s de ruido blanco a 320k (889 bytes).
        assertEquals("fff16040017ffc", Codificacion.hex(Adts.cabecera(4)))
        assertEquals("fff150802b3ffc", Codificacion.hex(Adts.cabecera(338, 44_100, 2)))
        assertEquals("fff14c806f3ffc", Codificacion.hex(Adts.cabecera(882, 48_000, 2)))
    }

    @Test
    fun `frame_length incluye los 7 bytes de la cabecera`() {
        for (payload in listOf(0, 1, 100, 2_041, 8_184)) {
            val c = Adts.cabecera(payload)
            assertEquals(7, c.size)
            assertEquals(payload + 7, largo(c), "payload $payload")
        }
    }

    @Test
    fun `cabecera rechaza una frecuencia fuera de la tabla, canales imposibles y una trama de mas de 13 bits`() {
        assertThrows<ErrorFormato> { Adts.cabecera(100, 15_999) }
        assertThrows<ErrorFormato> { Adts.cabecera(100, 16_000, 0) }
        assertThrows<ErrorFormato> { Adts.cabecera(100, 16_000, 7) }
        assertThrows<ErrorFormato> { Adts.cabecera(-1) }
        assertThrows<ErrorFormato> { Adts.cabecera(8_185) }
        assertThrows<ErrorFormato> { Adts.cabecera(Int.MAX_VALUE) }
    }

    @Test
    fun `tramas da el rango de cada trama, cabecera incluida, contiguos hasta el final`() {
        assertEquals(listOf(0 until 57, 57 until 151, 151 until 282), Adts.tramas(flujo(3)))
        assertEquals(emptyList<IntRange>(), Adts.tramas(ByteArray(0)))
    }

    @Test
    fun `un flujo real de ffmpeg se lee trama a trama`() {
        // 5 tramas de silencio: ffmpeg 6.1.1 con -f lavfi -i anullsrc=r=16000:cl=mono -t 0.25
        // -c:a aac -b:a 32k -fflags +bitexact -flags:a +bitexact -f adts
        val silencio = Codificacion.deHex("fff16040017ffc01182007".repeat(5))
        assertEquals(List(5) { 11 * it until 11 * it + 11 }, Adts.tramas(silencio))
        assertEquals(listOf(2, 2, 1), tramasPorFragmento(Adts.cortar(silencio, 2_048)))
    }

    @Test
    fun `125 tramas con 64 000 muestras dan 63 y 62`() {
        assertEquals(listOf(63, 62), tramasPorFragmento(Adts.cortar(flujo(125), 64_000)))
    }

    @Test
    fun `sin deriva, cada corte se cuenta desde el principio del flujo`() {
        // Si la cuenta empezara de cero en cada fragmento saldrían 63, 63, 63 y 61.
        assertEquals(listOf(63, 62, 63, 62), tramasPorFragmento(Adts.cortar(flujo(250), 64_000)))
    }

    @Test
    fun `lo que queda al final es el ultimo fragmento`() {
        assertEquals(listOf(63, 37), tramasPorFragmento(Adts.cortar(flujo(100), 64_000)))
        assertEquals(emptyList<ByteArray>(), Adts.cortar(ByteArray(0), 64_000))
    }

    @Test
    fun `los fragmentos unidos dan el flujo exacto y cada uno empieza en una trama`() {
        // DESIGN.md, Pruebas: "pruebas unitarias del corte ADTS: los fragmentos unidos tienen que dar el audio exacto".
        val f = flujo(250)
        val inicios = Adts.tramas(f).map { it.first }.toSet()
        for (objetivo in listOf(1_024, 32_000, 64_000, 128_000, 1_000_000)) {
            val fragmentos = Adts.cortar(f, objetivo)
            assertArrayEquals(f, fragmentos.fold(ByteArray(0)) { a, b -> a + b }, "objetivo $objetivo")
            var desde = 0
            for (fragmento in fragmentos) {
                assertTrue(desde in inicios, "objetivo $objetivo: fragmento en el byte $desde")
                desde += fragmento.size
            }
        }
        assertEquals(250, Adts.cortar(f, 1_024).size)
    }

    @Test
    fun `cortar rechaza un objetivo de menos de una trama`() {
        assertThrows<ErrorFormato> { Adts.cortar(flujo(3), 1_023) }
    }

    @Test
    fun `un flujo corrupto se rechaza`() {
        val bueno = flujo(3) // la primera cabecera es ff f1 60 40 07 3f fc (trama de 57 bytes)
        fun con(vararg cambios: Pair<Int, Int>) = bueno.copyOf().also { b -> for ((i, v) in cambios) b[i] = v.toByte() }
        val malos = mapOf(
            "cortado a mitad de trama" to bueno.copyOf(bueno.size - 1),
            "cabecera cortada al final" to bueno + bueno.copyOf(3),
            "byte de más entre tramas" to bueno.copyOf(57) + byteArrayOf(0) + bueno.copyOfRange(57, bueno.size),
            "sin palabra de sincronía" to con(0 to 0xFE),
            "MPEG-2" to con(1 to 0xF9),
            "capa distinta de 0" to con(1 to 0xF3),
            "con CRC" to con(1 to 0xF0),
            "perfil Main" to con(2 to 0x20),
            "frecuencia reservada" to con(2 to 0x74),
            "sin configuración de canales" to con(3 to 0x00),
            "frame_length 0" to con(4 to 0x00, 5 to 0x1F),
            "frame_length menor que la cabecera" to con(4 to 0x00, 5 to 0xDF),
            "buffer_fullness distinto de 0x7FF" to con(6 to 0xF8),
            "dos bloques en la trama" to con(6 to 0xFD),
        )
        for ((caso, datos) in malos) assertThrows<ErrorFormato>(caso) { Adts.tramas(datos) }
    }
}
