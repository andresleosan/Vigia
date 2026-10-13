package vigia.nucleo

import java.math.BigInteger
import java.security.GeneralSecurityException
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec

/** Verificación ECDSA P-256 con SHA-256 de una firma P1363 (contrato, sección 4). Acepta `s` alto. */
object Ecdsa {
    private val N = BigInteger("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551", 16)

    /** Antes de llamar a la librería rechaza la SPKI que no es P-256 de 91 bytes y la firma que no es admisible. */
    fun verificar(spki: ByteArray, mensaje: ByteArray, firma: ByteArray): Boolean {
        if (!Spki.esP256(spki) || !admisible(firma)) return false
        return try {
            val publica = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(spki))
            Signature.getInstance("SHA256withECDSA").run { initVerify(publica); update(mensaje); verify(Der.deP1363(firma)) }
        } catch (e: GeneralSecurityException) {
            false // un punto fuera de la curva: la librería no acepta la clave
        }
    }

    /** La comprobación previa de la sección 4: 64 bytes, y r y s entre 1 y n - 1. No depende de lo que rechace el proveedor. */
    internal fun admisible(firma: ByteArray): Boolean {
        if (firma.size != 64) return false
        val r = BigInteger(1, firma.copyOfRange(0, 32))
        val s = BigInteger(1, firma.copyOfRange(32, 64))
        return r.signum() > 0 && s.signum() > 0 && r < N && s < N
    }
}
