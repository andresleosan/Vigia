package vigia.nucleo

/** Lo que no cumple un formato del contrato de H1. */
class ErrorFormato(mensaje: String) : Exception(mensaje)

/** hex, b64u y enteros big-endian (contrato, sección 1), a mano: java.util.Base64 no está en la API 24. */
object Codificacion {
    private const val HEX = "0123456789abcdef"
    private const val B64U = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

    fun hex(b: ByteArray): String {
        val sb = StringBuilder(b.size * 2)
        for (x in b) sb.append(HEX[(x.toInt() shr 4) and 15]).append(HEX[x.toInt() and 15])
        return sb.toString()
    }

    /** Solo minúsculas y longitud par. */
    fun deHex(t: String): ByteArray {
        if (t.length % 2 != 0) throw ErrorFormato("hex de longitud impar")
        return ByteArray(t.length / 2) { (cifraHex(t[2 * it]) shl 4 or cifraHex(t[2 * it + 1])).toByte() }
    }

    private fun cifraHex(c: Char): Int =
        HEX.indexOf(c).also { if (it < 0) throw ErrorFormato("carácter fuera de hex") }

    fun b64u(b: ByteArray): String {
        val sb = StringBuilder((b.size * 8 + 5) / 6)
        var acc = 0
        var bits = 0
        for (x in b) {
            acc = (acc shl 8 or (x.toInt() and 0xff)) and 0x1fff
            bits += 8
            while (bits >= 6) {
                bits -= 6
                sb.append(B64U[(acc shr bits) and 63])
            }
        }
        if (bits > 0) sb.append(B64U[(acc shl (6 - bits)) and 63])
        return sb.toString()
    }

    /** Rechaza el relleno, los caracteres de fuera, la longitud con resto 1 y los bits sobrantes distintos de 0. */
    fun deB64u(t: String): ByteArray {
        if (t.length % 4 == 1) throw ErrorFormato("b64u de longitud imposible")
        val salida = ByteArray(t.length * 6 / 8)
        var acc = 0
        var bits = 0
        var j = 0
        for (c in t) {
            val v = B64U.indexOf(c)
            if (v < 0) throw ErrorFormato("carácter fuera de b64u")
            acc = (acc shl 6 or v) and 0xfff
            bits += 6
            if (bits >= 8) {
                bits -= 8
                salida[j++] = (acc shr bits).toByte()
            }
        }
        if (acc and ((1 shl bits) - 1) != 0) throw ErrorFormato("b64u no canónico")
        return salida
    }

    fun u16be(n: Int): ByteArray {
        if (n !in 0..0xffff) throw ErrorFormato("u16be fuera de rango")
        return byteArrayOf((n shr 8).toByte(), n.toByte())
    }

    fun u32be(n: Long): ByteArray {
        if (n !in 0..0xffffffffL) throw ErrorFormato("u32be fuera de rango")
        return byteArrayOf((n shr 24).toByte(), (n shr 16).toByte(), (n shr 8).toByte(), n.toByte())
    }
}

/** Los textos de los prefijos, de `info` y de los ids son ASCII. */
internal fun ascii(t: String): ByteArray = t.toByteArray(Charsets.US_ASCII)
