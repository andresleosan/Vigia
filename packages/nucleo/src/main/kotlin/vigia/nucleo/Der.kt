package vigia.nucleo

/** Firma ECDSA P-256: DER (SEQUENCE de dos INTEGER) a P1363 (r ‖ s, 32 bytes big-endian cada uno) y vuelta. */
object Der {
    fun aP1363(der: ByteArray): ByteArray {
        if (der.size < 8 || der[0] != 0x30.toByte() || der[1].toInt() != der.size - 2) throw ErrorFormato("DER no válido")
        val salida = ByteArray(64)
        var i = 2
        for (k in 0..1) {
            if (der[i] != 0x02.toByte()) throw ErrorFormato("DER no válido")
            var n = der[i + 1].toInt()
            var ini = i + 2
            i = ini + n
            if (n < 1 || i > der.size) throw ErrorFormato("DER no válido")
            if (n == 33 && der[ini] == 0.toByte()) { ini++; n-- } // 0x00 de signo
            if (n > 32) throw ErrorFormato("entero de más de 32 bytes")
            der.copyInto(salida, k * 32 + 32 - n, ini, ini + n) // un entero corto se rellena con ceros a la izquierda
        }
        if (i != der.size) throw ErrorFormato("DER no válido")
        return salida
    }

    fun deP1363(p1363: ByteArray): ByteArray {
        if (p1363.size != 64) throw ErrorFormato("P1363 que no mide 64 bytes")
        val r = entero(p1363.copyOfRange(0, 32))
        val s = entero(p1363.copyOfRange(32, 64))
        return byteArrayOf(0x30, (r.size + s.size).toByte()) + r + s
    }

    // INTEGER mínimo: sin ceros a la izquierda y con un 0x00 delante si el primer bit es 1.
    private fun entero(b: ByteArray): ByteArray {
        var i = 0
        while (i < b.size - 1 && b[i] == 0.toByte()) i++
        val v = b.copyOfRange(i, b.size)
        val conSigno = if (v[0] < 0) byteArrayOf(0) + v else v
        return byteArrayOf(0x02, conSigno.size.toByte()) + conSigno
    }
}
