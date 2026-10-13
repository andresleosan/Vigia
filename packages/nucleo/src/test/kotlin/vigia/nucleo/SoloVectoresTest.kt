package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File

class SoloVectoresTest {
    @Test
    fun `src main solo nombra cifrarConNonce y sellarConSemilla en su definicion`() {
        val codigo = File("src/main/kotlin").walk().filter { it.name.endsWith(".kt") }.joinToString("\n") { it.readText() }
        for (nombre in listOf("cifrarConNonce", "sellarConSemilla")) {
            assertEquals(1, Regex("\\b$nombre\\b").findAll(codigo).count(), nombre)
            assertTrue(codigo.contains("internal fun $nombre("), nombre)
        }
    }
}
