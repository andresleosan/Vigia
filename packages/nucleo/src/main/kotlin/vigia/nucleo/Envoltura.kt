package vigia.nucleo

/** Envoltura de K para un rol (contrato, sección 6): enc (32 bytes) ‖ cifrado (48 bytes) = 80 bytes. */
object Envoltura {
    fun info(incidente: String, rol: String): ByteArray = ascii("vigia/v1/envoltura\u0000$incidente\u0000$rol")

    fun envolver(hpke: Hpke, publica: ByteArray, incidente: String, rol: String, k: ByteArray): ByteArray {
        if (k.size != 32) throw ErrorFormato("K debe medir 32 bytes")
        return hpke.sellar(publica, info(incidente, rol), k)
    }

    fun desenvolver(hpke: Hpke, privada: ByteArray, incidente: String, rol: String, envoltura: ByteArray): ByteArray {
        if (envoltura.size != 80) throw ErrorFormato("envoltura que no mide 80 bytes")
        return hpke.abrir(privada, envoltura.copyOfRange(0, 32), info(incidente, rol), envoltura.copyOfRange(32, 80))
    }
}
