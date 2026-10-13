package vigia.nucleo

import org.bouncycastle.crypto.hpke.HPKE
import org.bouncycastle.crypto.hpke.HPKEContextWithEncapsulation

/** HPKE de RFC 9180 en modo base con la suite 0x0020/0x0001/0x0002, un solo Seal y AAD vacía (contrato, sección 6). */
interface Hpke {
    /** enc ‖ cifrado; `publica` son los 32 bytes crudos de X25519. */
    fun sellar(publica: ByteArray, info: ByteArray, claro: ByteArray): ByteArray
    fun abrir(privada: ByteArray, enc: ByteArray, info: ByteArray, cifrado: ByteArray): ByteArray
}

/** HPKE con BouncyCastle 1.86, la librería provisional del pico (H0b la confirma). */
class HpkeBouncyCastle : Hpke {
    // internal: las pruebas derivan de él las claves de las semillas de los vectores.
    internal val suite = HPKE(HPKE.mode_base, HPKE.kem_X25519_SHA256, HPKE.kdf_HKDF_SHA256, HPKE.aead_AES_GCM256)

    /** La efímera es aleatoria en cada llamada. */
    override fun sellar(publica: ByteArray, info: ByteArray, claro: ByteArray): ByteArray =
        sellarCon(suite.setupBaseS(suite.deserializePublicKey(publica), info), claro)

    override fun abrir(privada: ByteArray, enc: ByteArray, info: ByteArray, cifrado: ByteArray): ByteArray =
        suite.setupBaseR(enc, suite.deserializePrivateKey(privada, null), info).open(ByteArray(0), cifrado)

    /** Solo para los vectores, que fijan la efímera con una semilla. Una prueba falla si src/main la llama. */
    internal fun sellarConSemilla(semilla: ByteArray, publica: ByteArray, info: ByteArray, claro: ByteArray): ByteArray =
        sellarCon(suite.setupBaseS(suite.deserializePublicKey(publica), info, suite.deriveKeyPair(semilla)), claro)

    private fun sellarCon(contexto: HPKEContextWithEncapsulation, claro: ByteArray): ByteArray =
        contexto.encapsulation + contexto.seal(ByteArray(0), claro)
}
