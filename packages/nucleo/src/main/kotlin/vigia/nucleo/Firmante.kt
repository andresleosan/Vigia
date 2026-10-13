package vigia.nucleo

import java.security.KeyPair
import java.security.Signature

/** Firma con la clave del dispositivo (en Android, el Keystore, H3a): ECDSA P-256 con SHA-256, en P1363 de 64 bytes. */
interface Firmante {
    val spki: ByteArray
    fun firmar(mensaje: ByteArray): ByteArray
}

/** Firmante con un par de la JVM, para las pruebas y los vectores. */
class FirmanteSoftware(private val par: KeyPair) : Firmante {
    override val spki: ByteArray get() = par.public.encoded

    override fun firmar(mensaje: ByteArray): ByteArray =
        Der.aP1363(Signature.getInstance("SHA256withECDSA").run { initSign(par.private); update(mensaje); sign() })
}
