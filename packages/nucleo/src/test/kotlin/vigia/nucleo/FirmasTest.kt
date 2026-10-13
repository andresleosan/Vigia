package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.math.BigInteger
import java.security.Signature

class FirmasTest {
    private val n = BigInteger("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551", 16)
    private val firmante = FirmanteSoftware(parP256())
    private val mensaje = ascii("mensaje de prueba")

    // 32 bytes big-endian, con ceros a la izquierda.
    private fun a32(x: BigInteger): ByteArray {
        val b = x.toByteArray()
        return if (b.size > 32) b.copyOfRange(b.size - 32, b.size) else ByteArray(32 - b.size) + b
    }

    @Test
    fun `DER con r de 31 bytes y s de 33 con el 0x00 de signo, ida y vuelta`() {
        val r = ByteArray(31) { 0x11 }
        val s = byteArrayOf(-128) + ByteArray(31) { 0x22 }
        val der = byteArrayOf(0x30, 68, 0x02, 31) + r + byteArrayOf(0x02, 33, 0) + s
        assertArrayEquals(byteArrayOf(0) + r + s, Der.aP1363(der))
        assertArrayEquals(der, Der.deP1363(Der.aP1363(der)))
        val alReves = byteArrayOf(0x30, 68, 0x02, 33, 0) + s + byteArrayOf(0x02, 31) + r
        assertArrayEquals(s + byteArrayOf(0) + r, Der.aP1363(alReves))
    }

    @Test
    fun `DER mal formado lanza ErrorFormato`() {
        val r = ByteArray(32) { 0x11 }
        val bueno = byteArrayOf(0x30, 68, 0x02, 32) + r + byteArrayOf(0x02, 32) + r
        val malos = listOf(
            byteArrayOf(0x31) + bueno.copyOfRange(1, bueno.size), // no es SEQUENCE
            bueno.copyOf().also { it[1] = 67 }, // longitud que no cuadra
            bueno + byteArrayOf(0), // bytes de más
            byteArrayOf(0x30, 70, 0x02, 33, 1) + r + byteArrayOf(0x02, 33, 0) + r, // 33 bytes sin el 0x00 de signo
            byteArrayOf(0x30, 72, 0x02, 34, 0, 0) + r + byteArrayOf(0x02, 34, 0, 0) + r, // 34 bytes
        )
        for (d in malos) assertThrows<ErrorFormato> { Der.aP1363(d) }
        assertThrows<ErrorFormato> { Der.deP1363(ByteArray(63)) }
    }

    @Test
    fun `una firma propia verifica y (r, n - s) tambien, sin normalizar`() {
        val firma = firmante.firmar(mensaje)
        assertEquals(64, firma.size)
        assertTrue(Spki.esP256(firmante.spki))
        assertTrue(Ecdsa.verificar(firmante.spki, mensaje, firma))
        val r = BigInteger(1, firma.copyOfRange(0, 32))
        val s = BigInteger(1, firma.copyOfRange(32, 64))
        assertTrue(Ecdsa.verificar(firmante.spki, mensaje, a32(r) + a32(n - s)))
        assertFalse(Ecdsa.verificar(firmante.spki, ascii("otro mensaje"), firma))
    }

    @Test
    fun `firmas de 63 o 65 bytes y r o s iguales a 0 o mayores o iguales que n no verifican`() {
        val firma = firmante.firmar(mensaje)
        val r = BigInteger(1, firma.copyOfRange(0, 32))
        val s = BigInteger(1, firma.copyOfRange(32, 64))
        assertFalse(Ecdsa.verificar(firmante.spki, mensaje, firma.copyOf(63)))
        assertFalse(Ecdsa.verificar(firmante.spki, mensaje, firma + byteArrayOf(0)))
        val fuera = listOf(BigInteger.ZERO to s, r to BigInteger.ZERO, n to s, r to n, n + BigInteger.ONE to s, r to n + BigInteger.ONE)
        for ((rr, ss) in fuera) assertFalse(Ecdsa.verificar(firmante.spki, mensaje, a32(rr) + a32(ss)))
        // La comprobación previa, sin la librería: el SunEC de la JVM también rechaza esas firmas, y en Android el proveedor es otro.
        assertFalse(Ecdsa.admisible(firma.copyOf(63)))
        assertFalse(Ecdsa.admisible(firma + byteArrayOf(0)))
        for ((rr, ss) in fuera) assertFalse(Ecdsa.admisible(a32(rr) + a32(ss)))
        assertTrue(Ecdsa.admisible(a32(n - BigInteger.ONE) + a32(BigInteger.ONE)))
    }

    @Test
    fun `una firma DER de la JVM con un entero de 31 bytes o menos se convierte bien`() {
        // Pasa en 1 de cada 256 firmas: se firma hasta encontrar una. DER: 30 len 02 lenR r 02 lenS s.
        val par = parP256()
        val jca = Signature.getInstance("SHA256withECDSA").apply { initSign(par.private) }
        val der = generateSequence { jca.update(mensaje); jca.sign() }.take(20000).first { it[3] < 32 || it[5 + it[3]] < 32 }
        assertTrue(Ecdsa.verificar(par.public.encoded, mensaje, Der.aP1363(der)))
    }

    @Test
    fun `una SPKI que no es P-256 de 91 bytes o con el punto fuera de la curva no verifica`() {
        val firma = firmante.firmar(mensaje)
        assertFalse(Ecdsa.verificar(firmante.spki.copyOf(90), mensaje, firma))
        val fueraDeLaCurva = firmante.spki.copyOf().also { it.fill(1, 27, 91) }
        assertFalse(Ecdsa.verificar(fueraDeLaCurva, mensaje, firma))
    }

    @Test
    fun `DER y P1363 iguales que shared en los casos de la seccion 18`() {
        for (c in Vectores.leer("der.json").getJSONArray("casos").objetos()) {
            assertEquals(c.getString("p1363"), Codificacion.hex(Der.aP1363(c.bytes("der"))), c.getString("nombre"))
            assertEquals(c.getString("der"), Codificacion.hex(Der.deP1363(c.bytes("p1363"))), c.getString("nombre"))
        }
    }

    @Test
    fun `cada caso de ECDSA de shared da en Kotlin el mismo resultado`() {
        val e = Vectores.leer("firmas-ts.json").getJSONObject("ecdsa")
        val spki = Codificacion.deB64u(e.getString("spki"))
        for (c in e.getJSONArray("casos").objetos()) {
            assertEquals(c.getBoolean("valida"), Ecdsa.verificar(spki, e.bytes("mensaje"), c.bytes("firma")), c.getString("nombre"))
        }
    }

    @Test
    fun `Kotlin verifica las firmas de registro de shared, y una firma de registro no vale como cierre`() {
        val f = Vectores.leer("firmas-ts.json")
        val dispositivo = Codificacion.deB64u(f.getString("dispositivo"))
        for (c in f.getJSONArray("registros").objetos()) {
            val r = registroDe(c.getString("r"))
            assertTrue(Ecdsa.verificar(dispositivo, Registros.prefijo(r) + c.texto("r"), c.bytes("s")), c.getString("nombre"))
            val otro = if (r is Cierre) Prefijos.REGISTRO else Prefijos.CIERRE
            assertFalse(Ecdsa.verificar(dispositivo, otro + c.texto("r"), c.bytes("s")), c.getString("nombre"))
        }
    }
}
