package vigia.nucleo

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.spec.ECGenParameterSpec

/** 12-10-2026 12:00:00 UTC, en ms: la hora de las pruebas propias. */
const val HORA = 1791806400000L

/** Vectores dorados de shared (contrato, sección 18): Gradle los lee de ../shared/vectores/. */
object Vectores {
    fun leer(archivo: String): JSONObject = JSONObject(File("../shared/vectores/$archivo").readText())
}

fun JSONArray.objetos(): List<JSONObject> = List(length()) { getJSONObject(it) }

fun JSONArray.textos(): List<String> = List(length()) { getString(it) }

/** Un campo hex del vector, como bytes. */
fun JSONObject.bytes(clave: String): ByteArray = Codificacion.deHex(getString(clave))

/** Un campo de texto del vector (un JCV o un cuerpo JSON), como sus bytes ASCII. */
fun JSONObject.texto(clave: String): ByteArray = ascii(getString(clave))

fun posicionDe(c: JSONObject): Posicion =
    Posicion(c.getLong("hora_fix"), c.getInt("lat_e6"), c.getInt("lon_e6"), c.getInt("precision_m"))

/** El registro de Kotlin con los campos de un JCV de los vectores. */
fun registroDe(jcv: String): Registro {
    val c = JSONObject(jcv)
    return when (c.getString("tipo")) {
        "apertura" -> Apertura(
            c.getString("incidente"), c.getLong("hora_telefono"), c.getString("country_code"),
            c.getString("dispositivo"), c.getString("origen"), c.getString("kc"),
        )
        "fragmento" -> Fragmento(
            c.getString("incidente"), c.getInt("seq"), c.getLong("hora_telefono"), c.getString("p"), c.getString("c"),
            c.getString("prev"), if (c.has("loc")) c.getString("loc") else null,
        )
        "hueco" -> Hueco(
            c.getString("incidente"), c.getInt("seq"), c.getLong("hora_telefono"), c.getString("prev"),
            c.getLong("fin"), c.getString("motivo"),
        )
        "cierre" -> Cierre(c.getString("incidente"), c.getLong("hora_telefono"), c.getInt("ultimo_seq"), c.getString("hash_final"))
        else -> throw ErrorFormato("tipo desconocido en el vector")
    }
}

/** Un par P-256 nuevo en cada prueba: ninguna clave privada se guarda. */
fun parP256(): KeyPair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
