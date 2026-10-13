package vigia.nucleo

import kotlin.math.abs

/** Posición en claro (contrato, sección 5): va cifrada en `loc`; su JCV se rellena hasta 128 bytes. */
data class Posicion(val horaFix: Long, val latE6: Int, val lonE6: Int, val precisionM: Int) {
    fun bytes(): ByteArray {
        if (horaFix !in 0..Jcv.MAX || latE6 !in -90_000_000..90_000_000 ||
            lonE6 !in -180_000_000..180_000_000 || precisionM !in 0..100_000
        ) throw ErrorFormato("posición fuera de rango")
        val campos = mapOf(
            "hora_fix" to horaFix, "lat" to grados(latE6), "lon" to grados(lonE6),
            "precision_m" to precisionM.toLong(), "relleno" to "",
        )
        return Jcv.codificar(campos + ("relleno" to "0".repeat(128 - Jcv.codificar(campos).size)))
    }

    // Aritmética entera: signo solo si es negativo, parte entera sin ceros a la izquierda, punto y 6 cifras.
    private fun grados(e6: Int): String =
        (if (e6 < 0) "-" else "") + abs(e6) / 1_000_000 + "." + (abs(e6) % 1_000_000).toString().padStart(6, '0')
}
