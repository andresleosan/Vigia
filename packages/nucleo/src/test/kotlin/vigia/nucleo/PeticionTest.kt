package vigia.nucleo

import org.json.JSONObject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PeticionTest {
    private val firmante = FirmanteSoftware(parP256())
    private val ruta = "/v1/incidents/incidente_de_prueba_01/close"
    private val cuerpo = ascii("""{"r":"AQ","s":"Ag"}""")

    @Test
    fun `cadena con prefijo, saltos de linea y el SHA-256 del cuerpo crudo`() {
        val vacio = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" // SHA-256 de 0 bytes
        val esperada = "vigia/v1/peticion\u0000GET\n/v1/incidents/incidente_de_prueba_01\n$HORA\npeticion_de_prueba_001\ndispositivo_de_prueba1\n$vacio"
        val cadena = Peticion.cadena("GET", "/v1/incidents/incidente_de_prueba_01", HORA, "peticion_de_prueba_001", "dispositivo_de_prueba1", ByteArray(0))
        assertEquals(esperada, String(cadena, Charsets.US_ASCII))
    }

    @Test
    fun `cadena de cada peticion igual que shared`() {
        for (p in Vectores.leer("peticiones.json").getJSONArray("casos").objetos()) {
            assertEquals(p.getString("cadena"), Codificacion.hex(cadenaDe(p)), p.getString("nombre"))
        }
    }

    @Test
    fun `Kotlin verifica las firmas de peticion de shared, con la clave del dispositivo o la de lectura`() {
        val f = Vectores.leer("firmas-ts.json")
        for (p in f.getJSONArray("peticiones").objetos()) {
            val spki = Codificacion.deB64u(f.getString(p.getString("firmante")))
            assertTrue(Ecdsa.verificar(spki, cadenaDe(p), Codificacion.deB64u(p.getString("firma"))), p.getString("nombre"))
        }
    }

    private fun cadenaDe(p: JSONObject) = Peticion.cadena(
        p.getString("metodo"), p.getString("ruta"), p.getLong("hora"), p.getString("id_peticion"), p.getString("id_dispositivo"), p.bytes("cuerpo"),
    )

    @Test
    fun `cabeceras firmadas, y el alta va sin X-Vigia-Dispositivo`() {
        val alta = Peticion.cabeceras(firmante, "registro", "POST", "/v1/devices", HORA, "peticion_de_prueba_001", cuerpo)
        assertEquals(setOf("X-Vigia-Hora", "X-Vigia-Peticion", "X-Vigia-Firma"), alta.keys)
        val c = Peticion.cabeceras(firmante, "dispositivo_de_prueba1", "POST", ruta, HORA, "peticion_de_prueba_002", cuerpo)
        assertEquals("dispositivo_de_prueba1", c["X-Vigia-Dispositivo"])
        assertEquals(HORA.toString(), c["X-Vigia-Hora"])
        assertEquals("peticion_de_prueba_002", c["X-Vigia-Peticion"])
        val firma = Codificacion.deB64u(c.getValue("X-Vigia-Firma"))
        assertTrue(Ecdsa.verificar(firmante.spki, Peticion.cadena("POST", ruta, HORA, "peticion_de_prueba_002", "dispositivo_de_prueba1", cuerpo), firma))
    }

    @Test
    fun `cambiar metodo, ruta, hora, id de peticion, id de dispositivo o cuerpo invalida la firma`() {
        val firma = Codificacion.deB64u(Peticion.cabeceras(firmante, "dispositivo_de_prueba1", "POST", ruta, HORA, "peticion_de_prueba_002", cuerpo).getValue("X-Vigia-Firma"))
        val cambiadas = listOf(
            Peticion.cadena("PUT", ruta, HORA, "peticion_de_prueba_002", "dispositivo_de_prueba1", cuerpo),
            Peticion.cadena("POST", "$ruta/", HORA, "peticion_de_prueba_002", "dispositivo_de_prueba1", cuerpo),
            Peticion.cadena("POST", ruta, HORA + 1, "peticion_de_prueba_002", "dispositivo_de_prueba1", cuerpo),
            Peticion.cadena("POST", ruta, HORA, "peticion_de_prueba_003", "dispositivo_de_prueba1", cuerpo),
            Peticion.cadena("POST", ruta, HORA, "peticion_de_prueba_002", "dispositivo_de_prueba2", cuerpo),
            Peticion.cadena("POST", ruta, HORA, "peticion_de_prueba_002", "dispositivo_de_prueba1", cuerpo + byteArrayOf(0x20)),
        )
        for (cadena in cambiadas) assertFalse(Ecdsa.verificar(firmante.spki, cadena, firma))
    }
}
