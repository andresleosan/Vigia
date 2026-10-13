package vigia.nucleo

import kotlin.math.max
import kotlin.math.min

/** Prioridad fija de la cola (decisión 53): este orden es la prioridad. */
enum class Prioridad { ALTA, APERTURA, SOS, DESARME, CIERRE, LATIDO, FRAGMENTO }

/** En Android, `monotonico` es elapsedRealtime y `pared`, currentTimeMillis. */
interface Reloj {
    fun monotonico(): Long
    fun pared(): Long
}

fun interface Azar {
    fun entre(min: Long, maxIncluido: Long): Long
}

/** Un envío firmado de la cola. `id` es su idPeticion, el mismo en cada reintento; dos elementos son iguales si tienen el mismo id. */
class Elemento(
    val id: String,
    val prioridad: Prioridad,
    val orden: Long,
    val incidente: String?,
    val metodo: String,
    val ruta: String,
    val tipoContenido: String,
    val rHash: String?,
    val cargar: () -> ByteArray,
) {
    override fun equals(other: Any?) = other is Elemento && other.id == id
    override fun hashCode() = id.hashCode()
}

/** La respuesta del servidor, ya clasificada por el adaptador HTTP (H3a). */
sealed interface Resultado {
    data class Alta(val dispositivo: String) : Resultado
    class Acuse(val bytes: ByteArray) : Resultado
    data class Hora(val horaServidor: Long) : Resultado
    data class Limite(val codigo: String, val esperaMs: Long?) : Resultado
    data object Interno : Resultado
    data class Rechazo(val estado: Int, val codigo: String) : Resultado
    data object Red : Resultado
}

data class EstadoCola(val sinAlta: Boolean, val topeAltas: Boolean, val cuotaAgotada: Boolean, val rechazados: Int)

/** Lo que envía el adaptador HTTP. `dispositivo` es el id de `X-Vigia-Dispositivo`: nulo solo en el alta, que firma con `registro`. */
data class Pendiente(val elemento: Elemento, val host: String, val desfaseMs: Long, val dispositivo: String?)

/**
 * Cola de subida con las reglas del contrato de H1 (sección 17). Solo borra un elemento con un acuse que
 * verifica con las claves fijadas o con un alta válida (ACU-02). Todas las esperas usan `reloj.monotonico()`
 * y viven en memoria: al arrancar, todo lo pendiente está listo. El id de dispositivo y los incidentes con la
 * apertura acusada los guarda H3a, que se los devuelve al arrancar (`dispositivo` y `abiertos`).
 */
class Cola(
    private val reloj: Reloj,
    private val azar: Azar,
    private val hosts: List<String>,
    private val claves: List<EntradaClave>,
    private var dispositivo: String? = null,
    abiertos: Set<String> = emptySet(),
) {
    private class Estado(val e: Elemento) {
        var enVuelo = false
        var urgente = e.prioridad == Prioridad.SOS // salta las esperas en su primer intento y en el reintento tras Hora
        var fallos = 0 // contador y espera propios: solo Interno
        var hasta = 0L
        var rechazadoEn: Long? = null
        var horaReintentada = false
    }

    /** Espera de una prioridad por `cuota` o `tope_altas`: el estado la muestra hasta un acuse válido (o un alta) de esa prioridad. */
    private class EsperaLarga(val codigo: String, val hasta: Long)

    private val elementos = LinkedHashMap<String, Estado>()
    private val abiertos = HashSet(abiertos) // incidentes con la apertura acusada
    private var desfase = 0L
    private var host = 0
    private var fallosRed = 0
    private var redHasta = 0L
    private val enVueloClase = IntArray(2)
    private val fallosClase = IntArray(2)
    private val claseHasta = LongArray(2)
    private val esperasLargas = HashMap<Prioridad, EsperaLarga>()
    private var proximoRechazado = 0L

    init {
        require(hosts.isNotEmpty())
    }

    fun encolar(e: Elemento) {
        elementos.getOrPut(e.id) { Estado(e) }
    }

    fun siguiente(): Pendiente? {
        val ahora = reloj.monotonico()
        val antiguo = rechazadoMasAntiguo()
        val est = elementos.values
            .filter { val t = listoEn(it, antiguo); t != null && t <= ahora }
            .minWithOrNull(POR_PRIORIDAD) ?: return null
        est.enVuelo = true
        enVueloClase[clase(est.e)]++
        if (est.rechazadoEn != null) proximoRechazado = ahora + REINTENTO_RECHAZADO
        return Pendiente(est.e, hosts[host], desfase, if (est.e.prioridad == Prioridad.ALTA) null else dispositivo)
    }

    fun registrar(e: Elemento, resultado: Resultado) {
        val est = elementos[e.id]?.takeIf { it.enVuelo } ?: return // solo lo que entregó siguiente()
        val ahora = reloj.monotonico()
        val c = clase(e)
        est.enVuelo = false
        enVueloClase[c]--
        val efectivo = when {
            resultado is Resultado.Acuse && !acuseValido(e, resultado.bytes) -> Resultado.Red
            resultado is Resultado.Alta && (e.prioridad != Prioridad.ALTA || !PATRON_ID.matches(resultado.dispositivo)) -> Resultado.Red
            resultado is Resultado.Hora && est.horaReintentada -> Resultado.Red // un segundo Hora seguido
            else -> resultado
        }
        est.horaReintentada = efectivo is Resultado.Hora
        est.urgente = est.urgente && efectivo is Resultado.Hora // un segundo Hora seguido ya es Red: la quita
        if (efectivo != Resultado.Red) fallosRed = 0
        when (efectivo) {
            Resultado.Red -> {
                fallosRed = min(fallosRed + 1, SATURACION)
                redHasta = ahora + espera(fallosRed)
                host = (host + 1) % hosts.size
            }
            is Resultado.Acuse -> {
                borrar(est)
                if (e.prioridad == Prioridad.APERTURA && e.incidente != null) abiertos.add(e.incidente)
                fallosClase[c] = 0
                esperasLargas.remove(e.prioridad)
            }
            is Resultado.Alta -> {
                borrar(est)
                dispositivo = efectivo.dispositivo
                esperasLargas.remove(e.prioridad)
            }
            is Resultado.Hora -> desfase = efectivo.horaServidor - reloj.pared() // sin espera propia: respeta las que ya corren, salvo el SOS (regla 4)
            is Resultado.Limite -> when (efectivo.codigo) {
                // No son pasajeros: solo espera su prioridad, así que una apertura sin cuota no frena un cierre.
                "cuota" -> esperasLargas[e.prioridad] = EsperaLarga("cuota", ahora + max(UNA_HORA, efectivo.esperaMs ?: 0))
                // El servidor lo cuenta hasta la hora UTC siguiente y sin id no hay apertura ni SOS: solo su Retry-After.
                "tope_altas" -> esperasLargas[e.prioridad] = EsperaLarga("tope_altas", ahora + max(MIN_ESPERA, efectivo.esperaMs ?: UNA_HORA))
                else -> { // limite: el cupo por minuto, que el servidor cuenta por clase
                    fallosClase[c] = min(fallosClase[c] + 1, SATURACION)
                    claseHasta[c] = ahora + max(MIN_ESPERA, efectivo.esperaMs ?: nominal(fallosClase[c]))
                }
            }
            Resultado.Interno -> {
                est.fallos = min(est.fallos + 1, SATURACION)
                est.hasta = ahora + espera(est.fallos)
            }
            is Resultado.Rechazo -> {
                est.rechazadoEn = ahora
                proximoRechazado = ahora + REINTENTO_RECHAZADO
            }
        }
    }

    fun proximaHora(): Long? {
        val antiguo = rechazadoMasAntiguo()
        val t = elementos.values.mapNotNull { listoEn(it, antiguo) }.minOrNull() ?: return null
        return max(t, reloj.monotonico())
    }

    fun pendientes(): List<Elemento> = elementos.values.sortedWith(POR_PRIORIDAD).map { it.e }

    fun rechazados(): List<Elemento> = elementos.values.filter { it.rechazadoEn != null }.sortedWith(POR_RECHAZO).map { it.e }

    fun estado(): EstadoCola = EstadoCola(
        dispositivo == null,
        esperasLargas.values.any { it.codigo == "tope_altas" },
        esperasLargas.values.any { it.codigo == "cuota" },
        elementos.values.count { it.rechazadoEn != null },
    )

    /** Desde cuándo (monotónico) está listo, o null si lo bloquea algo que el tiempo no cambia. */
    private fun listoEn(est: Estado, antiguo: Estado?): Long? {
        val e = est.e
        val c = clase(e)
        return when {
            est.enVuelo -> null
            dispositivo == null && e.prioridad != Prioridad.ALTA -> null
            e.prioridad in TRAS_APERTURA && e.incidente !in abiertos -> null
            enVueloClase[c] >= EN_VUELO_POR_CLASE -> null
            est.rechazadoEn != null && est !== antiguo -> null
            else -> maxOf(
                est.hasta,
                if (est.urgente) 0 else maxOf(redHasta, claseHasta[c], esperasLargas[e.prioridad]?.hasta ?: 0),
                if (est.rechazadoEn != null) proximoRechazado else 0,
            )
        }
    }

    private fun borrar(est: Estado) {
        elementos.remove(est.e.id)
        // Si un rechazado recibe acuse, los demás rechazados vuelven a estar listos.
        if (est.rechazadoEn != null) for (otro in elementos.values) otro.rechazadoEn = null
    }

    private fun acuseValido(e: Elemento, bytes: ByteArray): Boolean {
        val rHash = e.rHash ?: return false
        return try {
            Acuses.verificar(claves, Acuses.analizar(bytes), rHash)
        } catch (x: ErrorFormato) {
            false
        }
    }

    private fun rechazadoMasAntiguo() = elementos.values.filter { it.rechazadoEn != null }.minWithOrNull(POR_RECHAZO)

    private fun clase(e: Elemento) = if (e.prioridad == Prioridad.FRAGMENTO) SUBIDA else ORDENES

    private fun nominal(n: Int): Long = min(MAX_ESPERA, 1_000L shl min(n - 1, 9))

    private fun espera(n: Int): Long {
        val nominal = nominal(n)
        return max(MIN_ESPERA, nominal / 2 + azar.entre(0, nominal / 2))
    }

    private companion object {
        const val ORDENES = 0 // de ALTA a LATIDO
        const val SUBIDA = 1 // FRAGMENTO: fragmentos y huecos
        const val EN_VUELO_POR_CLASE = 1 // si P7 (H0b) pide dos en la subida, se cambia el código (contrato, regla 3)
        const val SATURACION = 10 // n saturado: desde 10 la nominal ya es la máxima
        const val MIN_ESPERA = 1_000L
        const val MAX_ESPERA = 300_000L
        const val REINTENTO_RECHAZADO = 300_000L
        const val UNA_HORA = 3_600_000L
        val PATRON_ID = Regex("[A-Za-z0-9_-]{22}")
        val TRAS_APERTURA = setOf(Prioridad.FRAGMENTO, Prioridad.CIERRE) // y desde H5a las órdenes del incidente
        val POR_PRIORIDAD = compareBy<Estado>({ it.e.prioridad }, { it.e.orden })
        val POR_RECHAZO = compareBy<Estado>({ it.rechazadoEn }, { it.e.orden })
    }
}
