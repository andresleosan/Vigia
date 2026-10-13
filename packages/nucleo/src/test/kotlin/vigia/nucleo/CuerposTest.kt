package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class CuerposTest {
    private fun texto(b: ByteArray) = String(b, Charsets.US_ASCII)

    @Test
    fun `serializacion fija sin espacios, claves en orden y meta omitido si no hay`() {
        val apertura = Sobre(byteArrayOf(1), byteArrayOf(2), ByteArray(0))
        val envoltura = EnvolturaDestino("escucha", "-", byteArrayOf(3))
        assertEquals(
            """{"envolturas":[{"destino":"-","k":"Aw","rol":"escucha"}],"r":"AQ","s":"Ag"}""",
            texto(Cuerpos.incidente(apertura, listOf(envoltura), null)),
        )
        assertEquals("""{"envolturas":[],"meta":"BA","r":"AQ","s":"Ag"}""", texto(Cuerpos.incidente(apertura, emptyList(), byteArrayOf(4))))
        assertEquals("""{"lectura":"Bg","publica":"BQ"}""", texto(Cuerpos.alta(byteArrayOf(5), byteArrayOf(6))))
        assertEquals("""{"r":"AQ","s":"Ag"}""", texto(Cuerpos.cierre(apertura)))
    }

    @Test
    fun `cuerpos del alta, la apertura y el cierre iguales que shared`() {
        val v = Vectores.leer("cuerpos.json")
        val s = v.bytes("s")
        val alta = v.getJSONObject("alta")
        assertArrayEquals(alta.texto("json"), Cuerpos.alta(alta.bytes("publica"), alta.bytes("lectura")))
        for (c in v.getJSONArray("incidentes").objetos()) {
            val envolturas = c.getJSONArray("envolturas").objetos().map { EnvolturaDestino(it.getString("rol"), it.getString("destino"), it.bytes("k")) }
            val meta = if (c.has("meta")) c.bytes("meta") else null
            assertArrayEquals(c.texto("json"), Cuerpos.incidente(Sobre(c.texto("r"), s, ByteArray(0)), envolturas, meta), c.getString("nombre"))
        }
        val cierre = v.getJSONObject("cierre")
        assertArrayEquals(cierre.texto("json"), Cuerpos.cierre(Sobre(cierre.texto("r"), s, ByteArray(0))))
    }

    @Test
    fun `una envoltura con rol o destino fuera del contrato no se escribe`() {
        val apertura = Sobre(byteArrayOf(1), byteArrayOf(2), ByteArray(0))
        for (e in listOf(EnvolturaDestino("otro", "-", ByteArray(80)), EnvolturaDestino("contacto", "a\",\"x", ByteArray(80)))) {
            assertThrows<ErrorFormato> { Cuerpos.incidente(apertura, listOf(e), null) }
        }
    }
}
