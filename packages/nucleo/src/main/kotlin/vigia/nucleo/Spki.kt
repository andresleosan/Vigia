package vigia.nucleo

/** Pública P-256 del contrato (sección 2): SPKI DER sin comprimir de 91 bytes. */
object Spki {
    private const val PREFIJO = "3059301306072a8648ce3d020106082a8648ce3d03010703420004"

    /** Longitud y prefijo; que el punto esté en la curva lo comprueba quien la importa (Ecdsa). */
    fun esP256(spki: ByteArray): Boolean = spki.size == 91 && Codificacion.hex(spki).startsWith(PREFIJO)

    /** hex(SHA-256(SPKI)): el `dispositivo` de la apertura y el `d` del enlace del contacto. */
    fun huella(spki: ByteArray): String {
        if (!esP256(spki)) throw ErrorFormato("SPKI que no es P-256 de 91 bytes")
        return Registros.hash(spki)
    }
}
