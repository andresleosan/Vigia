package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class AadTest {
    @Test
    fun `codificacion fija de la AAD`() {
        // "vigia/v1" 00 "ct" 00 "incidente_de_prueba_01" 00 00000001
        val esperada = "76696769612f763100" + "637400" + "696e636964656e74655f64655f7072756562615f303100" + "00000001"
        assertEquals(esperada, Codificacion.hex(Aad.de("ct", "incidente_de_prueba_01", 1)))
        assertThrows<ErrorFormato> { Aad.de("ct", "incidente_de_prueba_01", -1) }
    }

    @Test
    fun `cada AAD igual que shared`() {
        val v = Vectores.leer("cifrado.json")
        for (c in v.getJSONArray("aad").objetos()) {
            assertEquals(c.getString("aad"), Codificacion.hex(Aad.de(c.getString("tipo"), v.getString("incidente"), c.getLong("seq"))))
        }
    }
}
