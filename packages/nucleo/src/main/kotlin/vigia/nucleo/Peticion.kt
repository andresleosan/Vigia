package vigia.nucleo

/** Firma de las peticiones (contrato, sección 9). */
object Peticion {
    /** vigia/v1/peticion ‖ 0x00 ‖ MÉTODO ‖ 0x0A ‖ RUTA ‖ 0x0A ‖ HORA ‖ 0x0A ‖ ID_PETICION ‖ 0x0A ‖ ID_DISPOSITIVO ‖ 0x0A ‖ hex(SHA-256(cuerpo)). */
    fun cadena(metodo: String, ruta: String, hora: Long, idPeticion: String, idDispositivo: String, cuerpo: ByteArray): ByteArray =
        Prefijos.PETICION + ascii("$metodo\n$ruta\n$hora\n$idPeticion\n$idDispositivo\n${Registros.hash(cuerpo)}")

    /** Las cabeceras X-Vigia-*; en el alta (idDispositivo "registro") va sin X-Vigia-Dispositivo. */
    fun cabeceras(
        firmante: Firmante,
        idDispositivo: String,
        metodo: String,
        ruta: String,
        hora: Long,
        idPeticion: String,
        cuerpo: ByteArray,
    ): Map<String, String> {
        val firma = Codificacion.b64u(firmante.firmar(cadena(metodo, ruta, hora, idPeticion, idDispositivo, cuerpo)))
        val comunes = mapOf("X-Vigia-Hora" to hora.toString(), "X-Vigia-Peticion" to idPeticion, "X-Vigia-Firma" to firma)
        return if (idDispositivo == "registro") comunes else mapOf("X-Vigia-Dispositivo" to idDispositivo) + comunes
    }
}
