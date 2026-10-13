package vigia.nucleo

/** JSON canónico de Vigía (contrato, sección 3): un objeto plano, claves ordenadas y cadenas sin escapes. */
object Jcv {
    sealed interface Campo { val opcional: Boolean }
    data class Cadena(val patron: Regex, override val opcional: Boolean = false) : Campo
    data class Entero(val min: Long, val max: Long, override val opcional: Boolean = false) : Campo

    internal const val MAX = 9_007_199_254_740_991L // 2^53 - 1
    private val CLAVE = Regex("[a-z][a-z0-9_]{0,31}")
    private val CADENA = Regex("[A-Za-z0-9_.-]{0,4096}")

    // Un par y el carácter que lo sigue. Se aplica par a par con matchAt: la pila no crece con la entrada.
    private val PAR = Regex("\"([a-z][a-z0-9_]{0,31})\":(?:\"([A-Za-z0-9_.-]{0,4096})\"|(0|[1-9][0-9]{0,15}))([,}])")

    /** Valores String o Long; cualquier otro tipo, clave o valor fuera de la gramática lanza ErrorFormato. */
    fun codificar(campos: Map<String, Any>): ByteArray {
        val sb = StringBuilder("{")
        for (clave in campos.keys.sorted()) {
            if (!CLAVE.matches(clave)) throw ErrorFormato("JCV: clave no válida")
            val valor = campos.getValue(clave)
            if (sb.length > 1) sb.append(',')
            sb.append('"').append(clave).append("\":")
            when {
                valor is String && CADENA.matches(valor) -> sb.append('"').append(valor).append('"')
                valor is Long && valor in 0..MAX -> sb.append(valor)
                else -> throw ErrorFormato("JCV: valor no válido en $clave")
            }
        }
        return ascii(sb.append('}').toString())
    }

    fun analizar(bytes: ByteArray, esquema: Map<String, Campo>): Map<String, Any> {
        val t = String(bytes, Charsets.ISO_8859_1) // un carácter por byte: lo que no es ASCII no casa con nada
        if (!t.startsWith("{")) throw ErrorFormato("JCV: falta la llave")
        val campos = LinkedHashMap<String, Any>()
        var cerrado = t.startsWith("{}")
        var i = if (cerrado) 2 else 1
        var anterior = "" // menor que cualquier clave válida
        while (!cerrado) {
            val m = PAR.matchAt(t, i) ?: throw ErrorFormato("JCV: par no válido")
            val clave = m.groupValues[1]
            if (clave <= anterior) throw ErrorFormato("JCV: clave repetida o desordenada")
            campos[clave] = if (m.groups[2] != null) m.groupValues[2] else m.groupValues[3].toLong()
            anterior = clave
            cerrado = m.groupValues[4] == "}"
            i = m.range.last + 1
        }
        if (i != t.length) throw ErrorFormato("JCV: bytes de más")
        for ((clave, valor) in campos) {
            val ok = when (val campo = esquema[clave] ?: throw ErrorFormato("JCV: clave desconocida")) {
                is Cadena -> valor is String && campo.patron.matches(valor)
                is Entero -> valor is Long && valor in campo.min..campo.max
            }
            if (!ok) throw ErrorFormato("JCV: valor no válido en $clave")
        }
        for ((clave, campo) in esquema) if (!campo.opcional && clave !in campos) throw ErrorFormato("JCV: falta $clave")
        if (!codificar(campos).contentEquals(bytes)) throw ErrorFormato("JCV no canónico")
        return campos
    }
}
