package vigia.nucleo

import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** AES-256-GCM (contrato, sección 5): cifrado = nonce (12 bytes) ‖ texto cifrado ‖ etiqueta (16 bytes). */
object Cifrado {
    private val azar = SecureRandom()

    /** El nonce sale siempre de SecureRandom: con la misma K, un nonce repetido rompe GCM. */
    fun cifrar(k: ByteArray, aad: ByteArray, claro: ByteArray): ByteArray =
        conNonce(ByteArray(12).also { azar.nextBytes(it) }, k, aad, claro)

    fun descifrar(k: ByteArray, aad: ByteArray, cifrado: ByteArray): ByteArray {
        if (cifrado.size < 28) throw ErrorFormato("cifrado más corto que nonce y etiqueta")
        return aes(Cipher.DECRYPT_MODE, k, cifrado.copyOfRange(0, 12), aad).doFinal(cifrado, 12, cifrado.size - 12)
    }

    /** Solo para los vectores, que fijan el nonce. Una prueba falla si src/main la llama. */
    internal fun cifrarConNonce(nonce: ByteArray, k: ByteArray, aad: ByteArray, claro: ByteArray): ByteArray =
        conNonce(nonce, k, aad, claro)

    private fun conNonce(nonce: ByteArray, k: ByteArray, aad: ByteArray, claro: ByteArray): ByteArray =
        nonce + aes(Cipher.ENCRYPT_MODE, k, nonce, aad).doFinal(claro)

    private fun aes(modo: Int, k: ByteArray, nonce: ByteArray, aad: ByteArray): Cipher {
        if (k.size != 32) throw ErrorFormato("K debe medir 32 bytes") // SecretKeySpec aceptaría AES-128 en silencio
        return Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(modo, SecretKeySpec(k, "AES"), GCMParameterSpec(128, nonce))
            updateAAD(aad)
        }
    }
}
