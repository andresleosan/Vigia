package vigia.nucleo

/** Último eslabón de la cadena de un incidente; el recorder lo guarda para seguirla tras un reinicio. */
data class EstadoCadena(val ultimoSeq: Int, val hashUltimo: String)

/** Crea en orden los sobres de un incidente: la apertura, los fragmentos y huecos encadenados y el cierre. */
class FabricaSobres(
    private val firmante: Firmante,
    private val incidente: String,
    private val k: ByteArray,
    estado: EstadoCadena? = null,
) {
    /** El recorder lo guarda cifrado antes de encolar cada sobre. Cambia solo con el sobre ya firmado: un fallo al firmar no adelanta la cadena. */
    var estado: EstadoCadena? = estado
        private set

    fun apertura(horaTelefono: Long, countryCode: String, origen: String): Sobre {
        check(estado == null) { "la apertura solo puede empezar la cadena" }
        val kc = Registros.compromisoK(incidente, k)
        return sellar(Apertura(incidente, horaTelefono, countryCode, Spki.huella(firmante.spki), origen, kc), 0, ByteArray(0))
    }

    /** Asigna el seq siguiente; cifra el audio con AAD `ct` y la posición, si la hay, con AAD `loc`. */
    fun fragmento(horaTelefono: Long, audio: ByteArray, posicion: Posicion? = null): Sobre {
        val e = enCurso()
        val seq = e.ultimoSeq + 1
        val ct = Cifrado.cifrar(k, Aad.de("ct", incidente, seq.toLong()), audio)
        val loc = posicion?.let { Codificacion.b64u(Cifrado.cifrar(k, Aad.de("loc", incidente, seq.toLong()), it.bytes())) }
        val r = Fragmento(incidente, seq, horaTelefono, Registros.huellaAudio(k, audio), Registros.hash(ct), e.hashUltimo, loc)
        return sellar(r, seq, ct)
    }

    fun hueco(horaTelefono: Long, fin: Long, motivo: String): Sobre {
        val e = enCurso()
        val seq = e.ultimoSeq + 1
        return sellar(Hueco(incidente, seq, horaTelefono, e.hashUltimo, fin, motivo), seq, ByteArray(0))
    }

    /** Cierra con el último seq creado; no cambia el estado. */
    fun cierre(horaTelefono: Long): Sobre {
        val e = enCurso()
        return sellar(Cierre(incidente, horaTelefono, e.ultimoSeq, e.hashUltimo), null, ByteArray(0))
    }

    private fun enCurso(): EstadoCadena = checkNotNull(estado) { "falta la apertura" }

    private fun sellar(r: Registro, seq: Int?, cifrado: ByteArray): Sobre {
        val bytes = Registros.bytes(r)
        val sobre = Sobre(bytes, firmante.firmar(Registros.prefijo(r) + bytes), cifrado)
        if (seq != null) estado = EstadoCadena(seq, Registros.hash(bytes))
        return sobre
    }
}
