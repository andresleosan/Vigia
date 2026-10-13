package vigia.nucleo

/** Acuse del servidor (contrato, sección 7). */
data class Acuse(val v: Long, val kid: String, val r: String, val horaServidor: Long, val firma: String)

/** Entrada de la lista fijada de claves de acuse de un entorno. `estado`: activa, retirada o comprometida. */
data class EntradaClave(val kid: String, val spki: ByteArray, val estado: String, val desde: Long, val hasta: Long?)

object Acuses {
    private val ESQUEMA = mapOf(
        "firma" to Jcv.Cadena(Regex("[A-Za-z0-9_-]{86}")),
        "hora_servidor" to Jcv.Entero(0, Jcv.MAX),
        "kid" to Jcv.Cadena(Regex("[a-z][a-z0-9_]{0,31}")),
        "r" to Jcv.Cadena(Regex("[0-9a-f]{64}")),
        "v" to Jcv.Entero(1, 1),
    )

    /** Los bytes JCV del acuse con `firma`, tal como llegan en el cuerpo de la respuesta. */
    fun analizar(bytes: ByteArray): Acuse {
        val c = Jcv.analizar(bytes, ESQUEMA)
        return Acuse(c["v"] as Long, c["kid"] as String, c["r"] as String, c["hora_servidor"] as Long, c["firma"] as String)
    }

    /** Falso con un kid desconocido, una clave comprometida, una hora fuera de su ventana, otro `r` o una firma que no verifica. */
    fun verificar(claves: List<EntradaClave>, acuse: Acuse, rEsperado: String): Boolean {
        val e = claves.firstOrNull { it.kid == acuse.kid } ?: return false
        if (e.estado == "comprometida" || acuse.horaServidor < e.desde || (e.hasta != null && acuse.horaServidor > e.hasta)) return false
        if (acuse.r != rEsperado) return false
        val firma = try { Codificacion.deB64u(acuse.firma) } catch (e: ErrorFormato) { return false }
        val contenido = Jcv.codificar(mapOf("hora_servidor" to acuse.horaServidor, "kid" to acuse.kid, "r" to acuse.r, "v" to acuse.v))
        return Ecdsa.verificar(e.spki, Prefijos.ACUSE + contenido, firma)
    }
}
