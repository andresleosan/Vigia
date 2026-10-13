package vigia.nucleo

/** AAD de AES-GCM (contrato, sección 5): `vigia/v1` ‖ 0x00 ‖ tipo ‖ 0x00 ‖ incidente ‖ 0x00 ‖ u32be(seq). */
object Aad {
    fun de(tipo: String, incidente: String, seq: Long): ByteArray =
        ascii("vigia/v1\u0000$tipo\u0000$incidente\u0000") + Codificacion.u32be(seq)
}
