package vigia.nucleo

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

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
