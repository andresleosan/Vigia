package vigia.nucleo

/** Una envoltura para el cuerpo de la apertura: rol, destino (un id o "-") y K envuelta (80 bytes). */
data class EnvolturaDestino(val rol: String, val destino: String, val k: ByteArray)

/** Cuerpos JSON de la API con la serialización fija de la sección 11: UTF-8 sin espacios y claves en orden de bytes. */
object Cuerpos {
    private val ROL = Regex("contacto|recuperacion|escucha")
    private val DESTINO = Regex("-|[A-Za-z0-9_-]{22}")

    // Con dos cadenas b64u, la serialización fija coincide con JCV.
    fun alta(publica: ByteArray, lectura: ByteArray): ByteArray =
        Jcv.codificar(mapOf("lectura" to Codificacion.b64u(lectura), "publica" to Codificacion.b64u(publica)))

    /** `meta` nulo se omite. Rol y destino se comprueban antes de escribirlos entre comillas. */
    fun incidente(apertura: Sobre, envolturas: List<EnvolturaDestino>, meta: ByteArray?): ByteArray {
        val lista = envolturas.joinToString(",") {
            if (!ROL.matches(it.rol) || !DESTINO.matches(it.destino)) throw ErrorFormato("envoltura con rol o destino no válidos")
            "{\"destino\":\"${it.destino}\",\"k\":\"${Codificacion.b64u(it.k)}\",\"rol\":\"${it.rol}\"}"
        }
        val conMeta = if (meta == null) "" else "\"meta\":\"${Codificacion.b64u(meta)}\","
        return ascii("{\"envolturas\":[$lista],$conMeta\"r\":\"${Codificacion.b64u(apertura.r)}\",\"s\":\"${Codificacion.b64u(apertura.s)}\"}")
    }

    fun cierre(cierre: Sobre): ByteArray =
        Jcv.codificar(mapOf("r" to Codificacion.b64u(cierre.r), "s" to Codificacion.b64u(cierre.s)))
}
