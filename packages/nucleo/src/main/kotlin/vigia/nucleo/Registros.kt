package vigia.nucleo

import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/** Registro `r` (contrato, sección 4). `campos()` da las claves de su JCV, con los enteros como Long. */
sealed interface Registro { fun campos(): Map<String, Any> }

data class Apertura(
    val incidente: String,
    val horaTelefono: Long,
    val countryCode: String,
    val dispositivo: String,
    val origen: String,
    val kc: String,
) : Registro {
    override fun campos(): Map<String, Any> = mapOf(
        "v" to 1L, "tipo" to "apertura", "incidente" to incidente, "seq" to 0L, "hora_telefono" to horaTelefono,
        "country_code" to countryCode, "dispositivo" to dispositivo, "origen" to origen, "kc" to kc,
    )
}

data class Fragmento(
    val incidente: String,
    val seq: Int,
    val horaTelefono: Long,
    val p: String,
    val c: String,
    val prev: String,
    val loc: String? = null,
) : Registro {
    override fun campos(): Map<String, Any> = mapOf(
        "v" to 1L, "tipo" to "fragmento", "incidente" to incidente, "seq" to seq.toLong(), "hora_telefono" to horaTelefono,
        "p" to p, "c" to c, "prev" to prev,
    ) + (if (loc == null) emptyMap() else mapOf("loc" to loc))
}

data class Hueco(
    val incidente: String,
    val seq: Int,
    val horaTelefono: Long,
    val prev: String,
    val fin: Long,
    val motivo: String,
) : Registro {
    override fun campos(): Map<String, Any> = mapOf(
        "v" to 1L, "tipo" to "hueco", "incidente" to incidente, "seq" to seq.toLong(), "hora_telefono" to horaTelefono,
        "prev" to prev, "fin" to fin, "motivo" to motivo,
    )
}

data class Cierre(val incidente: String, val horaTelefono: Long, val ultimoSeq: Int, val hashFinal: String) : Registro {
    override fun campos(): Map<String, Any> = mapOf(
        "v" to 1L, "tipo" to "cierre", "incidente" to incidente, "hora_telefono" to horaTelefono,
        "ultimo_seq" to ultimoSeq.toLong(), "hash_final" to hashFinal,
    )
}

object Registros {
    private val HEX64 = Jcv.Cadena(Regex("[0-9a-f]{64}"))
    private val SEQ = Jcv.Entero(1, 999_999)
    private fun comunes(tipo: String): Map<String, Jcv.Campo> = mapOf(
        "v" to Jcv.Entero(1, 1),
        "tipo" to Jcv.Cadena(Regex(tipo)),
        "incidente" to Jcv.Cadena(Regex("[A-Za-z0-9_-]{22}")),
        "hora_telefono" to Jcv.Entero(0, Jcv.MAX),
    )
    private val APERTURA = comunes("apertura") + mapOf(
        "seq" to Jcv.Entero(0, 0), "country_code" to Jcv.Cadena(Regex("[A-Z]{2}")), "dispositivo" to HEX64,
        "origen" to Jcv.Cadena(Regex("grabar|sos")), "kc" to HEX64,
    )
    private val FRAGMENTO = comunes("fragmento") + mapOf(
        "seq" to SEQ, "p" to HEX64, "c" to HEX64, "prev" to HEX64,
        "loc" to Jcv.Cadena(Regex("[A-Za-z0-9_-]{208}"), opcional = true),
    )
    private val HUECO = comunes("hueco") + mapOf(
        "seq" to SEQ, "prev" to HEX64, "fin" to Jcv.Entero(0, Jcv.MAX), "motivo" to Jcv.Cadena(Regex("microfono|interrupcion")),
    )
    private val CIERRE = comunes("cierre") + mapOf("ultimo_seq" to Jcv.Entero(0, 999_999), "hash_final" to HEX64)

    /** JCV del registro, comprobado con el esquema de su tipo: nunca se firma un registro que el servidor rechazaría. */
    fun bytes(r: Registro): ByteArray {
        val b = Jcv.codificar(r.campos())
        Jcv.analizar(b, when (r) { is Apertura -> APERTURA; is Fragmento -> FRAGMENTO; is Hueco -> HUECO; is Cierre -> CIERRE })
        if (r is Hueco && r.fin < r.horaTelefono) throw ErrorFormato("hueco que acaba antes de empezar")
        return b
    }

    fun hash(bytes: ByteArray): String = Codificacion.hex(MessageDigest.getInstance("SHA-256").digest(bytes))

    fun prefijo(r: Registro): ByteArray = if (r is Cierre) Prefijos.CIERRE else Prefijos.REGISTRO

    /** kc = hex(SHA-256(vigia/v1/compromiso ‖ 0x00 ‖ incidente ‖ 0x00 ‖ K)). */
    fun compromisoK(incidente: String, k: ByteArray): String =
        hash(Prefijos.COMPROMISO + ascii("$incidente\u0000") + k)

    /** p = hex(HMAC-SHA-256(Kp, audio)), con Kp = HKDF-SHA256(K, 32 ceros, "vigia/v1/p", 32). */
    fun huellaAudio(k: ByteArray, audio: ByteArray): String =
        Codificacion.hex(hmac(hkdf32(k, ascii("vigia/v1/p")), audio))

    // ponytail: HKDF de un solo bloque (32 bytes), lo único que pide la sección 5.
    internal fun hkdf32(ikm: ByteArray, info: ByteArray): ByteArray =
        hmac(hmac(ByteArray(32), ikm), info + byteArrayOf(1))

    // La sal son 32 ceros (la de RFC 5869 por defecto) porque SecretKeySpec no admite una clave vacía.
    private fun hmac(clave: ByteArray, datos: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run { init(SecretKeySpec(clave, "HmacSHA256")); doFinal(datos) }
}
