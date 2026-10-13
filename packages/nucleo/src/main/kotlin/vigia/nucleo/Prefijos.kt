package vigia.nucleo

/** Prefijos de dominio de las firmas (contrato, sección 4). Cada lectura da una copia: nadie puede alterar el compartido. */
object Prefijos {
    val REGISTRO: ByteArray get() = ascii("vigia/v1/registro\u0000")
    val CIERRE: ByteArray get() = ascii("vigia/v1/cierre\u0000")
    val PETICION: ByteArray get() = ascii("vigia/v1/peticion\u0000")
    val ACUSE: ByteArray get() = ascii("vigia/v1/acuse\u0000")
    val EVENTO: ByteArray get() = ascii("vigia/v1/evento\u0000")
    val COMPROMISO: ByteArray get() = ascii("vigia/v1/compromiso\u0000")
    val RECUPERACION: ByteArray get() = ascii("vigia/v1/recuperacion\u0000")
}
