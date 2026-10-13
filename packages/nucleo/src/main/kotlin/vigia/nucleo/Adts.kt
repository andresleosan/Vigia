package vigia.nucleo

/**
 * Tramas ADTS de AAC-LC (contrato de H1, sección 17): cabecera de 7 bytes sin CRC, MPEG-4,
 * `buffer_fullness` 0x7FF y un solo bloque de 1024 muestras por trama.
 */
object Adts {
    const val MUESTRAS_POR_TRAMA = 1024

    // sampling_frequency_index de ISO/IEC 14496-3: la posición es el índice (16 000 es el 8); 13 a 15 no valen en ADTS.
    private val FRECUENCIAS = intArrayOf(96_000, 88_200, 64_000, 48_000, 44_100, 32_000, 24_000, 22_050, 16_000, 12_000, 11_025, 8_000, 7_350)
    private const val MAX_PAYLOAD = 0x1FFF - 7 // frame_length tiene 13 bits e incluye la cabecera

    /** Lanza ErrorFormato si la frecuencia no está en la tabla, si los canales no van de 1 a 6 o si la trama no cabe en 13 bits. */
    fun cabecera(longitudPayload: Int, frecuencia: Int = 16_000, canales: Int = 1): ByteArray {
        val indice = FRECUENCIAS.indexOf(frecuencia)
        if (indice < 0 || canales !in 1..6 || longitudPayload !in 0..MAX_PAYLOAD) throw ErrorFormato("ADTS: cabecera imposible")
        val largo = longitudPayload + 7
        return byteArrayOf(
            0xFF.toByte(),
            0xF1.toByte(), // fin de la sincronía, MPEG-4, capa 0 y sin CRC
            (0x40 or (indice shl 2) or (canales shr 2)).toByte(), // perfil LC
            (((canales and 3) shl 6) or (largo shr 11)).toByte(),
            (largo shr 3).toByte(),
            (((largo and 7) shl 5) or 0x1F).toByte(), // buffer_fullness 0x7FF, que sigue en el byte 6
            0xFC.toByte(), // y un bloque por trama
        )
    }

    /**
     * El rango de bytes de cada trama, cabecera incluida, contiguos del byte 0 al final. Lanza ErrorFormato
     * si el flujo acaba a mitad de una trama o si una cabecera no es exactamente la que escribe `cabecera`.
     */
    fun tramas(flujo: ByteArray): List<IntRange> {
        val tramas = ArrayList<IntRange>()
        var i = 0
        while (i < flujo.size) {
            if (flujo.size - i < 7) throw ErrorFormato("ADTS: cabecera cortada")
            val b2 = flujo[i + 2].toInt() and 0xFF
            val b3 = flujo[i + 3].toInt() and 0xFF
            val largo = ((b3 and 3) shl 11) or ((flujo[i + 4].toInt() and 0xFF) shl 3) or ((flujo[i + 5].toInt() and 0xFF) shr 5)
            val indice = (b2 shr 2) and 0xF
            if (indice >= FRECUENCIAS.size || largo < 7 || largo > flujo.size - i) throw ErrorFormato("ADTS: trama cortada o imposible")
            val canales = ((b2 and 1) shl 2) or (b3 shr 6)
            if (!cabecera(largo - 7, FRECUENCIAS[indice], canales).contentEquals(flujo.copyOfRange(i, i + 7))) {
                throw ErrorFormato("ADTS: cabecera no válida")
            }
            tramas.add(i until i + largo)
            i += largo
        }
        return tramas
    }

    /**
     * Corta el flujo en fragmentos que empiezan en una trama: el fragmento k se cierra en la primera frontera de trama
     * en la que las muestras acumuladas desde el principio alcanzan k × muestrasObjetivo (sin deriva). Lo que queda
     * al final es el último fragmento, así que unidos dan el flujo exacto. Con menos de una trama por fragmento
     * habría fragmentos vacíos: lanza ErrorFormato.
     */
    fun cortar(flujo: ByteArray, muestrasObjetivo: Int): List<ByteArray> {
        if (muestrasObjetivo < MUESTRAS_POR_TRAMA) throw ErrorFormato("ADTS: objetivo de menos de una trama")
        val fragmentos = ArrayList<ByteArray>()
        var inicio = 0
        var muestras = 0L
        for (trama in tramas(flujo)) {
            muestras += MUESTRAS_POR_TRAMA
            if (muestras >= (fragmentos.size + 1L) * muestrasObjetivo) {
                fragmentos.add(flujo.copyOfRange(inicio, trama.last + 1))
                inicio = trama.last + 1
            }
        }
        if (inicio < flujo.size) fragmentos.add(flujo.copyOfRange(inicio, flujo.size))
        return fragmentos
    }
}
