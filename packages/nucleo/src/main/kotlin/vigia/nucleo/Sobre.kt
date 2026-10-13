package vigia.nucleo

/** Sobre binario (contrato, sección 10): u16be(len(r)) ‖ r ‖ s (64 bytes) ‖ cifrado (vacío salvo en un fragmento). */
class Sobre(val r: ByteArray, val s: ByteArray, val cifrado: ByteArray) {
    fun cuerpo(): ByteArray = Codificacion.u16be(r.size) + r + s + cifrado

    companion object {
        /** Tamaño máximo del cuerpo (contrato, sección 10); se recalcula tras el pico (H0b). */
        const val MAX_CUERPO = 65_536

        fun analizar(cuerpo: ByteArray): Sobre {
            if (cuerpo.size < 2 || cuerpo.size > MAX_CUERPO) throw ErrorFormato("sobre de tamaño imposible")
            val n = (cuerpo[0].toInt() and 0xff) shl 8 or (cuerpo[1].toInt() and 0xff)
            if (n == 0 || 2 + n + 64 > cuerpo.size) throw ErrorFormato("sobre con len_r imposible")
            return Sobre(cuerpo.copyOfRange(2, 2 + n), cuerpo.copyOfRange(2 + n, 2 + n + 64), cuerpo.copyOfRange(2 + n + 64, cuerpo.size))
        }
    }
}
