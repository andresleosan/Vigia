package vigia.nucleo

import org.json.JSONObject
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class SobresTest {
    private val firmante = FirmanteSoftware(parP256())
    private val k = ByteArray(32) { (it + 1).toByte() }
    private val inc = "incidente_de_prueba_01"

    private fun campos(s: Sobre) = JSONObject(String(s.r, Charsets.US_ASCII))

    @Test
    fun `cuerpo del sobre igual que shared, se analiza de vuelta y los rechazados se rechazan`() {
        val v = Vectores.leer("sobres.json")
        val s = v.bytes("s")
        for (c in v.getJSONArray("casos").objetos()) {
            val sobre = Sobre(c.texto("r"), s, c.bytes("cifrado"))
            assertEquals(c.getString("cuerpo"), Codificacion.hex(sobre.cuerpo()), c.getString("nombre"))
            val vuelta = Sobre.analizar(c.bytes("cuerpo"))
            assertArrayEquals(sobre.r, vuelta.r)
            assertArrayEquals(s, vuelta.s)
            assertArrayEquals(sobre.cifrado, vuelta.cifrado)
        }
        for (c in v.getJSONArray("rechazados").objetos()) {
            assertThrows<ErrorFormato>(c.getString("nombre")) { Sobre.analizar(c.bytes("cuerpo")) }
        }
    }

    @Test
    fun `analizar rechaza len_r imposible, cuerpos cortos y de mas de 65 536 bytes`() {
        val r = ByteArray(10)
        val s = ByteArray(64)
        val bueno = Sobre(r, s, ByteArray(0)).cuerpo()
        val malos = listOf(
            ByteArray(0), ByteArray(1), bueno.copyOf(bueno.size - 1), byteArrayOf(0, 0) + s,
            byteArrayOf(-1, -1) + r + s, Sobre(r, s, ByteArray(65536 - 76 + 1)).cuerpo(),
        )
        for (m in malos) assertThrows<ErrorFormato> { Sobre.analizar(m) }
        assertEquals(65536, Sobre.analizar(Sobre(r, s, ByteArray(65536 - 76)).cuerpo()).cuerpo().size)
    }

    @Test
    fun `cada sobre deja su estado y otra fabrica sigue la cadena desde un EstadoCadena`() {
        val f = FabricaSobres(firmante, inc, k)
        val apertura = f.apertura(HORA, "VE", "grabar")
        assertEquals(EstadoCadena(0, Registros.hash(apertura.r)), f.estado)
        assertEquals(Spki.huella(firmante.spki), campos(apertura).getString("dispositivo"))
        assertEquals(Registros.compromisoK(inc, k), campos(apertura).getString("kc"))
        val uno = f.fragmento(HORA + 4000, ascii("audio uno"))
        assertEquals(EstadoCadena(1, Registros.hash(uno.r)), f.estado)

        // Tras un reinicio, el recorder crea otra fábrica con el estado que guardó.
        val g = FabricaSobres(firmante, inc, k, f.estado)
        val dos = g.hueco(HORA + 8000, HORA + 9000, "interrupcion")
        val tres = g.fragmento(HORA + 12000, ascii("audio tres"), Posicion(HORA + 11000, 10480000, -66903600, 12))
        assertEquals(EstadoCadena(3, Registros.hash(tres.r)), g.estado)
        val cierre = g.cierre(HORA + 60000)
        assertEquals(EstadoCadena(3, Registros.hash(tres.r)), g.estado)

        assertEquals(Registros.hash(apertura.r), campos(uno).getString("prev"))
        assertEquals(Registros.hash(uno.r), campos(dos).getString("prev"))
        assertEquals(2, campos(dos).getInt("seq"))
        assertEquals(Registros.hash(dos.r), campos(tres).getString("prev"))
        assertEquals(3, campos(tres).getInt("seq"))
        assertEquals(3, campos(cierre).getInt("ultimo_seq"))
        assertEquals(Registros.hash(tres.r), campos(cierre).getString("hash_final"))
        for (s in listOf(apertura, uno, dos, tres)) assertTrue(Ecdsa.verificar(firmante.spki, Prefijos.REGISTRO + s.r, s.s))
        assertTrue(Ecdsa.verificar(firmante.spki, Prefijos.CIERRE + cierre.r, cierre.s))
        assertEquals(0, apertura.cifrado.size + dos.cifrado.size + cierre.cifrado.size)
    }

    @Test
    fun `el fragmento lleva c, p y loc que se comprueban con K`() {
        val f = FabricaSobres(firmante, inc, k)
        f.apertura(HORA, "VE", "grabar")
        val posicion = Posicion(HORA, 10480000, -66903600, 12)
        val uno = f.fragmento(HORA + 4000, ascii("audio uno"), posicion)
        val c = campos(uno)
        assertEquals(Registros.hash(uno.cifrado), c.getString("c"))
        assertEquals(Registros.huellaAudio(k, ascii("audio uno")), c.getString("p"))
        assertArrayEquals(ascii("audio uno"), Cifrado.descifrar(k, Aad.de("ct", inc, 1), uno.cifrado))
        val loc = Codificacion.deB64u(c.getString("loc"))
        assertEquals(156, loc.size)
        assertArrayEquals(posicion.bytes(), Cifrado.descifrar(k, Aad.de("loc", inc, 1), loc))
        assertFalse(campos(f.fragmento(HORA + 8000, ascii("audio dos"))).has("loc"))
    }

    @Test
    fun `la apertura solo empieza la cadena, y sin apertura no hay fragmentos, huecos ni cierre`() {
        val f = FabricaSobres(firmante, inc, k)
        assertThrows<IllegalStateException> { f.fragmento(HORA, ascii("audio")) }
        assertThrows<IllegalStateException> { f.hueco(HORA, HORA, "microfono") }
        assertThrows<IllegalStateException> { f.cierre(HORA) }
        f.apertura(HORA, "VE", "sos")
        assertThrows<IllegalStateException> { f.apertura(HORA, "VE", "grabar") }
    }

    @Test
    fun `un registro invalido o un fallo al firmar no adelantan la cadena`() {
        val f = FabricaSobres(firmante, inc, k)
        f.apertura(HORA, "VE", "grabar")
        val antes = f.estado
        assertThrows<ErrorFormato> { f.hueco(HORA, HORA - 1, "microfono") }
        assertEquals(antes, f.estado)

        val sinKeystore = object : Firmante {
            override val spki = firmante.spki
            override fun firmar(mensaje: ByteArray): ByteArray = throw IllegalStateException("Keystore no disponible")
        }
        val g = FabricaSobres(sinKeystore, inc, k, EstadoCadena(4, "a".repeat(64)))
        assertThrows<IllegalStateException> { g.fragmento(HORA, ascii("audio")) }
        assertEquals(EstadoCadena(4, "a".repeat(64)), g.estado)
    }
}
