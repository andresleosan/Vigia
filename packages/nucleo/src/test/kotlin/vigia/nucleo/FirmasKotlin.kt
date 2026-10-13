package vigia.nucleo

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Escribe vectores/firmas-kotlin.json (contrato, sección 18): una cadena de registros y una petición firmadas
 * por el núcleo con una clave efímera, que se descarta al terminar. Lo verifica test/firmas-kotlin.test.ts de
 * shared. Formato: el de las claves `dispositivo`, `registros` y `peticiones` de firmas-ts.json (tarea 8), con
 * `firmante` siempre `dispositivo`.
 */
fun main(args: Array<String>) {
    val firmante = FirmanteSoftware(parP256())
    val inc = "incidente_de_prueba_01"
    val fabrica = FabricaSobres(firmante, inc, ByteArray(32) { it.toByte() })
    val sobres = listOf(
        "apertura" to fabrica.apertura(HORA, "VE", "grabar"),
        "fragmento_1" to fabrica.fragmento(HORA + 4000, ascii("audio de prueba"), Posicion(HORA + 1000, 10480000, -66903600, 12)),
        "hueco_2" to fabrica.hueco(HORA + 8000, HORA + 9000, "microfono"),
        "cierre" to fabrica.cierre(HORA + 60000),
    )
    val registros = sobres.map { (nombre, s) ->
        JSONObject().put("nombre", nombre).put("r", String(s.r, Charsets.US_ASCII)).put("s", Codificacion.hex(s.s))
    }
    val ruta = "/v1/incidents/$inc/close"
    val cuerpo = Cuerpos.cierre(sobres.last().second)
    val hora = HORA + 61000
    val firma = Peticion.cabeceras(firmante, "dispositivo_de_prueba1", "POST", ruta, hora, "peticion_de_prueba_001", cuerpo).getValue("X-Vigia-Firma")
    val peticion = JSONObject().put("nombre", "cierre").put("metodo", "POST").put("ruta", ruta).put("hora", hora)
        .put("id_peticion", "peticion_de_prueba_001").put("id_dispositivo", "dispositivo_de_prueba1")
        .put("cuerpo", Codificacion.hex(cuerpo)).put("firmante", "dispositivo").put("firma", firma)
    val json = JSONObject()
        .put("dispositivo", Codificacion.b64u(firmante.spki))
        .put("registros", JSONArray(registros))
        .put("peticiones", JSONArray(listOf(peticion)))
    File(args[0]).writeText(json.toString(2) + "\n")
}
