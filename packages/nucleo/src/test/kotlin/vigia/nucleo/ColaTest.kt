package vigia.nucleo

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.security.KeyPairGenerator
import java.security.spec.ECGenParameterSpec

// DESIGN.md, Pruebas: "cola de subida (Kotlin) con reloj virtual (prioridad, backoff y rotación de hosts)".
class ColaTest {
    private class RelojFalso : Reloj {
        var mono = 0L
        var pared = MEDIODIA
        override fun monotonico() = mono
        override fun pared() = pared
    }

    private val reloj = RelojFalso()
    private var elegir: (Long, Long) -> Long = { _, maxIncluido -> maxIncluido } // con el máximo, la espera es la nominal
    private val llamadasAzar = mutableListOf<Pair<Long, Long>>()
    private val azar = Azar { min, maxIncluido -> llamadasAzar += min to maxIncluido; elegir(min, maxIncluido) }
    private val servidor = FirmanteSoftware(nuevoPar())
    private val comprometida = FirmanteSoftware(nuevoPar())
    private val claves = listOf(
        EntradaClave("prueba", servidor.spki, "activa", 0, null),
        EntradaClave("prueba_comprometida", comprometida.spki, "comprometida", 0, null),
    )
    private val hosts = listOf("api.prueba", "respaldo.prueba")
    private val cola = Cola(reloj, azar, hosts, claves)
    private var orden = 0L
    private var cargas = 0

    private fun nuevoPar() = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()

    // La cola no mira el método, la ruta ni el tipo; las órdenes de H5a aún no tienen ruta y usan la de la apertura.
    private fun encolar(prioridad: Prioridad, incidente: String = X): Elemento {
        orden++
        val (metodo, ruta, tipo) = when (prioridad) {
            Prioridad.ALTA -> Triple("POST", "/v1/devices", "application/json")
            Prioridad.FRAGMENTO -> Triple("PUT", "/v1/incidents/$incidente/chunks/$orden", "application/vnd.vigia.sobre")
            Prioridad.CIERRE -> Triple("POST", "/v1/incidents/$incidente/close", "application/json")
            else -> Triple("POST", "/v1/incidents", "application/json")
        }
        val alta = prioridad == Prioridad.ALTA
        val rHash = if (alta) null else orden.toString().padStart(64, '0')
        val e = Elemento("peticion-$orden", prioridad, orden, if (alta) null else incidente, metodo, ruta, tipo, rHash) { cargas++; ByteArray(0) }
        cola.encolar(e)
        return e
    }

    // El acuse que firmaría el Worker (contrato, sección 7).
    private fun acuse(e: Elemento, firmante: Firmante = servidor, kid: String = "prueba", r: String = e.rHash!!): Resultado.Acuse {
        val contenido = mapOf<String, Any>("hora_servidor" to reloj.pared, "kid" to kid, "r" to r, "v" to 1L)
        val firma = firmante.firmar(Prefijos.ACUSE + Jcv.codificar(contenido))
        return Resultado.Acuse(Jcv.codificar(contenido + ("firma" to Codificacion.b64u(firma))))
    }

    private fun enviar(): Elemento = cola.siguiente()!!.elemento

    private fun darAlta() {
        val alta = encolar(Prioridad.ALTA)
        assertEquals(alta, enviar())
        cola.registrar(alta, Resultado.Alta(DISPOSITIVO))
    }

    private fun abrir(incidente: String) {
        val apertura = encolar(Prioridad.APERTURA, incidente)
        assertEquals(apertura, enviar())
        cola.registrar(apertura, acuse(apertura))
    }

    @Test
    fun `sin id de dispositivo solo el alta esta lista y un alta valida guarda el id`() {
        val apertura = encolar(Prioridad.APERTURA)
        assertNull(cola.siguiente())
        assertNull(cola.proximaHora())
        assertTrue(cola.estado().sinAlta)
        val alta = encolar(Prioridad.ALTA)
        assertEquals(Pendiente(alta, "api.prueba", 0, null), cola.siguiente())
        cola.registrar(alta, Resultado.Alta("dispositivo.prueba.000")) // no casa con el patrón: cuenta como Red
        assertTrue(cola.estado().sinAlta)
        assertEquals(listOf(alta, apertura), cola.pendientes())
        assertEquals(1_000L, cola.proximaHora())
        reloj.mono = 1_000
        assertEquals(Pendiente(alta, "respaldo.prueba", 0, null), cola.siguiente())
        cola.registrar(alta, Resultado.Alta(DISPOSITIVO))
        assertFalse(cola.estado().sinAlta)
        assertEquals(listOf(apertura), cola.pendientes())
        assertEquals(apertura, enviar())
    }

    @Test
    fun `Pendiente lleva el id del dispositivo y es nulo en el alta`() {
        val alta = encolar(Prioridad.ALTA)
        assertEquals(Pendiente(alta, "api.prueba", 0, null), cola.siguiente()) // el alta firma con "registro", sin X-Vigia-Dispositivo
        cola.registrar(alta, Resultado.Alta(DISPOSITIVO))
        val apertura = encolar(Prioridad.APERTURA)
        assertEquals(Pendiente(apertura, "api.prueba", 0, DISPOSITIVO), cola.siguiente())
        cola.registrar(apertura, acuse(apertura))
        val otraAlta = encolar(Prioridad.ALTA) // otra alta, con el id ya guardado, también va sin él
        assertEquals(Pendiente(otraAlta, "api.prueba", 0, null), cola.siguiente())
    }

    @Test
    fun `cada incidente espera el acuse de su propia apertura`() {
        darAlta()
        val aperturaX = encolar(Prioridad.APERTURA, X)
        val aperturaY = encolar(Prioridad.APERTURA, Y)
        val fragmentoX = encolar(Prioridad.FRAGMENTO, X)
        val fragmentoY = encolar(Prioridad.FRAGMENTO, Y)
        val cierreY = encolar(Prioridad.CIERRE, Y)
        assertEquals(aperturaX, enviar())
        assertNull(cola.siguiente()) // ningún fragmento sale con su apertura en vuelo
        cola.registrar(aperturaX, Resultado.Interno) // solo aperturaX espera
        assertEquals(aperturaY, enviar())
        cola.registrar(aperturaY, acuse(aperturaY))
        assertEquals(cierreY, enviar())
        assertEquals(fragmentoY, enviar())
        cola.registrar(cierreY, acuse(cierreY))
        cola.registrar(fragmentoY, acuse(fragmentoY))
        assertNull(cola.siguiente()) // fragmentoX sigue esperando a aperturaX
        assertEquals(1_000L, cola.proximaHora())
        reloj.mono = 1_000
        assertEquals(aperturaX, enviar())
        cola.registrar(aperturaX, acuse(aperturaX))
        assertEquals(fragmentoX, enviar())
    }

    // Foco de revisión 2.
    @Test
    fun `con la apertura en Red y 30 fragmentos pendientes no sale ningun PUT antes de su acuse`() {
        darAlta()
        val apertura = encolar(Prioridad.APERTURA)
        val fragmentos = List(30) { encolar(Prioridad.FRAGMENTO) }
        val otraClave = FirmanteSoftware(nuevoPar())
        for (fallo in listOf(Resultado.Red, Resultado.Red, acuse(apertura, firmante = otraClave), Resultado.Red)) {
            assertEquals(apertura, enviar())
            assertNull(cola.siguiente()) // con la apertura en vuelo, ningún PUT
            cola.registrar(apertura, fallo)
            assertNull(cola.siguiente()) // ni durante la espera
            reloj.mono = cola.proximaHora()!!
        }
        assertEquals(apertura, enviar())
        cola.registrar(apertura, acuse(apertura))
        val subidos = List(30) { enviar().also { cola.registrar(it, acuse(it)) } }
        assertEquals(fragmentos, subidos)
        assertEquals(listOf<Elemento>(), cola.pendientes())
    }

    @Test
    fun `sale primero la prioridad y dentro de ella el orden de encolado`() {
        darAlta()
        abrir(X)
        val e = listOf(Prioridad.LATIDO, Prioridad.CIERRE, Prioridad.DESARME, Prioridad.SOS, Prioridad.APERTURA, Prioridad.DESARME, Prioridad.SOS)
            .map { encolar(it, if (it == Prioridad.APERTURA) Y else X) }
        val salidas = List(e.size) { enviar().also { cola.registrar(it, acuse(it)) } }
        assertEquals(listOf(e[4], e[3], e[6], e[2], e[5], e[1], e[0]), salidas)
    }

    @Test
    fun `como mucho uno en vuelo por clase, ordenes y subida`() {
        darAlta()
        abrir(X)
        val f1 = encolar(Prioridad.FRAGMENTO)
        val f2 = encolar(Prioridad.FRAGMENTO)
        val cierre = encolar(Prioridad.CIERRE)
        val latido = encolar(Prioridad.LATIDO)
        assertEquals(Pendiente(cierre, "api.prueba", 0, DISPOSITIVO), cola.siguiente())
        assertEquals(Pendiente(f1, "api.prueba", 0, DISPOSITIVO), cola.siguiente())
        assertNull(cola.siguiente()) // latido y f2 están listos, pero sus clases ya tienen uno en vuelo
        assertNull(cola.proximaHora())
        cola.registrar(f2, acuse(f2)) // f2 no está en vuelo: no cambia nada
        assertEquals(listOf(cierre, latido, f1, f2), cola.pendientes())
        cola.registrar(f1, acuse(f1))
        assertEquals(f2, enviar())
        cola.registrar(cierre, acuse(cierre))
        assertEquals(latido, enviar())
    }

    // Foco de revisión 2.
    @Test
    fun `la espera tras n fallos de red es exponencial y con n = 100 la nominal es 300 000`() {
        encolar(Prioridad.ALTA)
        val esperas = List(100) {
            cola.registrar(enviar(), Resultado.Red)
            val espera = cola.proximaHora()!! - reloj.mono
            reloj.mono += espera
            espera
        }
        // Con el azar en su máximo, la espera es la nominal: min(300 000, 1 000 * 2^min(n - 1, 9)).
        assertEquals(listOf(1_000L, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 256_000), esperas.take(9))
        assertEquals(List(91) { 300_000L }, esperas.drop(9)) // n saturado: de n = 10 a n = 100, siempre 300 000
        assertEquals(0L to 150_000L, llamadasAzar.last())
    }

    @Test
    fun `con el azar en 0 la espera es la mitad de la nominal y nunca baja de 1 000 ms`() {
        elegir = { min, _ -> min }
        encolar(Prioridad.ALTA)
        val esperas = List(11) {
            cola.registrar(enviar(), Resultado.Red)
            val espera = cola.proximaHora()!! - reloj.mono
            reloj.mono += espera
            espera
        }
        assertEquals(listOf(1_000L, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 150_000, 150_000), esperas)
    }

    @Test
    fun `con Red toda la cola espera y rota de host, y otro resultado pone el contador a 0`() {
        darAlta()
        abrir(X)
        val cierre = encolar(Prioridad.CIERRE)
        val f1 = encolar(Prioridad.FRAGMENTO)
        assertEquals(Pendiente(cierre, "api.prueba", 0, DISPOSITIVO), cola.siguiente())
        assertEquals(Pendiente(f1, "api.prueba", 0, DISPOSITIVO), cola.siguiente())
        cola.registrar(cierre, Resultado.Red) // n = 1
        cola.registrar(f1, Resultado.Red) // n = 2: 2 000 ms desde ahora
        encolar(Prioridad.FRAGMENTO)
        assertNull(cola.siguiente()) // toda la cola espera, también lo recién encolado
        assertEquals(2_000L, cola.proximaHora())
        reloj.mono = 2_000
        assertEquals(Pendiente(cierre, "api.prueba", 0, DISPOSITIVO), cola.siguiente()) // rotó dos veces: vuelve al primero
        assertEquals(Pendiente(f1, "api.prueba", 0, DISPOSITIVO), cola.siguiente())
        cola.registrar(f1, acuse(f1)) // otro resultado: el contador de red vuelve a 0
        cola.registrar(cierre, Resultado.Red) // n = 1 otra vez
        assertEquals(3_000L, cola.proximaHora())
        reloj.mono = 3_000
        assertEquals(Pendiente(cierre, "respaldo.prueba", 0, DISPOSITIVO), cola.siguiente())
    }

    @Test
    fun `Interno hace esperar solo a ese elemento, con su propio contador`() {
        darAlta()
        abrir(X)
        val f1 = encolar(Prioridad.FRAGMENTO)
        val f2 = encolar(Prioridad.FRAGMENTO)
        assertEquals(f1, enviar())
        cola.registrar(f1, Resultado.Interno) // 1 000 ms, solo f1
        assertEquals(f2, enviar()) // el resto no espera
        cola.registrar(f2, acuse(f2))
        assertNull(cola.siguiente())
        assertEquals(1_000L, cola.proximaHora())
        reloj.mono = 1_000
        assertEquals(f1, enviar())
        cola.registrar(f1, Resultado.Interno) // segundo fallo de f1: 2 000 ms
        val cierre = encolar(Prioridad.CIERRE)
        assertEquals(cierre, enviar())
        cola.registrar(cierre, Resultado.Red) // los Interno no sumaron al contador de red: n = 1
        assertEquals(2_000L, cola.proximaHora())
        reloj.mono = 2_000
        assertEquals(cierre, enviar())
        assertNull(cola.siguiente()) // f1 espera hasta 3 000
        cola.registrar(cierre, acuse(cierre))
        assertEquals(3_000L, cola.proximaHora())
    }

    @Test
    fun `Limite hace esperar solo a su clase, el Retry-After o la nominal de su contador`() {
        elegir = { min, _ -> min } // con el azar en 0: Limite no lo usa
        darAlta()
        abrir(X)
        val f1 = encolar(Prioridad.FRAGMENTO)
        assertEquals(f1, enviar())
        cola.registrar(f1, Resultado.Limite("limite", 60_000))
        val cierre = encolar(Prioridad.CIERRE)
        assertEquals(cierre, enviar()) // las órdenes no esperan
        cola.registrar(cierre, acuse(cierre))
        assertNull(cola.siguiente())
        assertEquals(60_000L, cola.proximaHora()) // el Retry-After, sin azar
        reloj.mono = 60_000
        assertEquals(f1, enviar())
        cola.registrar(f1, Resultado.Limite("limite", null)) // sin Retry-After: la nominal de la clase con n = 2
        assertEquals(62_000L, cola.proximaHora())
        assertFalse(cola.estado().cuotaAgotada)
        reloj.mono = 62_000
        assertEquals(f1, enviar())
        cola.registrar(f1, acuse(f1)) // un acuse válido de la clase pone su contador a 0
        val f2 = encolar(Prioridad.FRAGMENTO)
        assertEquals(f2, enviar())
        cola.registrar(f2, Resultado.Limite("limite", null))
        assertEquals(63_000L, cola.proximaHora()) // n = 1 otra vez
        reloj.mono = 63_000
        assertEquals(f2, enviar())
        cola.registrar(f2, Resultado.Limite("limite", 0)) // un Retry-After de 0: nunca menos de 1 000 ms
        assertEquals(64_000L, cola.proximaHora())
    }

    @Test
    fun `una cuota en la apertura no frena el cierre de otro incidente y la apertura se reintenta pasada una hora`() {
        darAlta()
        abrir(X)
        val aperturaY = encolar(Prioridad.APERTURA, Y)
        val cierreX = encolar(Prioridad.CIERRE, X)
        val latido = encolar(Prioridad.LATIDO, X)
        assertEquals(aperturaY, enviar())
        cola.registrar(aperturaY, Resultado.Limite("cuota", 3_600_000)) // TOPE_INCIDENTES o la guarda de D1
        assertTrue(cola.estado().cuotaAgotada)
        val aperturaZ = encolar(Prioridad.APERTURA, Z)
        assertEquals(cierreX, enviar()) // el resto de las órdenes sigue: el servidor nunca bloquea el cierre por cuota
        cola.registrar(cierreX, acuse(cierreX))
        assertEquals(latido, enviar())
        cola.registrar(latido, acuse(latido))
        assertNull(cola.siguiente()) // las aperturas esperan, también la recién encolada
        assertEquals(3_600_000L, cola.proximaHora())
        reloj.mono = 3_599_999
        assertNull(cola.siguiente())
        reloj.mono = 3_600_000
        assertEquals(aperturaY, enviar())
        cola.registrar(aperturaY, acuse(aperturaY))
        assertEquals(aperturaZ, enviar())
    }

    @Test
    fun `una cuota en un fragmento hace esperar a los demas fragmentos y huecos, no al cierre`() {
        darAlta()
        abrir(X)
        val f1 = encolar(Prioridad.FRAGMENTO)
        val hueco = encolar(Prioridad.FRAGMENTO) // un hueco va con la prioridad de los fragmentos
        assertEquals(f1, enviar())
        cola.registrar(f1, Resultado.Limite("cuota", 60_000)) // una hora, aunque el Retry-After sea menor
        assertTrue(cola.estado().cuotaAgotada)
        val f3 = encolar(Prioridad.FRAGMENTO)
        val cierre = encolar(Prioridad.CIERRE)
        assertEquals(cierre, enviar()) // el cierre no espera a la cuota de la subida
        cola.registrar(cierre, acuse(cierre))
        assertNull(cola.siguiente())
        assertEquals(3_600_000L, cola.proximaHora())
        reloj.mono = 3_599_999
        assertNull(cola.siguiente())
        reloj.mono = 3_600_000
        val subidos = List(3) { enviar().also { cola.registrar(it, acuse(it)) } }
        assertEquals(listOf(f1, hueco, f3), subidos)
        assertFalse(cola.estado().cuotaAgotada)
        assertEquals(listOf<Elemento>(), cola.pendientes())
    }

    @Test
    fun `cuotaAgotada se quita con un acuse valido de la prioridad que espera`() {
        darAlta()
        abrir(X)
        val aperturaY = encolar(Prioridad.APERTURA, Y)
        val f1 = encolar(Prioridad.FRAGMENTO, X)
        assertEquals(aperturaY, enviar())
        assertEquals(f1, enviar())
        cola.registrar(aperturaY, Resultado.Limite("cuota", null)) // sin Retry-After: una hora
        cola.registrar(f1, Resultado.Limite("cuota", 7_200_000)) // con más de una hora, la del servidor
        val cierre = encolar(Prioridad.CIERRE, X)
        assertEquals(cierre, enviar())
        cola.registrar(cierre, acuse(cierre)) // un acuse de otra prioridad no la quita
        assertTrue(cola.estado().cuotaAgotada)
        reloj.mono = 3_600_000
        assertEquals(aperturaY, enviar())
        cola.registrar(aperturaY, acuse(aperturaY, firmante = FirmanteSoftware(nuevoPar()))) // no verifica: cuenta como Red
        assertTrue(cola.estado().cuotaAgotada)
        reloj.mono = cola.proximaHora()!!
        assertEquals(aperturaY, enviar())
        cola.registrar(aperturaY, acuse(aperturaY))
        assertTrue(cola.estado().cuotaAgotada) // la de los fragmentos sigue
        assertEquals(7_200_000L, cola.proximaHora())
        reloj.mono = 7_200_000
        assertTrue(cola.estado().cuotaAgotada) // pasado su tiempo, sigue hasta un acuse válido de los fragmentos
        assertEquals(f1, enviar())
        cola.registrar(f1, acuse(f1))
        assertFalse(cola.estado().cuotaAgotada)
    }

    @Test
    fun `con tope_altas el alta espera solo su Retry-After o una hora si no viene, y el estado lo dice`() {
        val alta = encolar(Prioridad.ALTA)
        assertEquals(alta, enviar())
        cola.registrar(alta, Resultado.Limite("tope_altas", 1_800_000)) // el Retry-After llega hasta la siguiente hora UTC
        assertEquals(EstadoCola(sinAlta = true, topeAltas = true, cuotaAgotada = false, rechazados = 0), cola.estado())
        assertEquals(1_800_000L, cola.proximaHora()) // esperaMs, sin la hora mínima de la cuota
        reloj.mono = 1_800_000
        assertTrue(cola.estado().topeAltas) // pasado su tiempo, sigue hasta un alta válida
        assertEquals(alta, enviar())
        cola.registrar(alta, Resultado.Limite("tope_altas", null)) // sin Retry-After: una hora
        assertEquals(5_400_000L, cola.proximaHora())
        reloj.mono = 5_400_000
        assertEquals(alta, enviar())
        cola.registrar(alta, Resultado.Limite("tope_altas", 0)) // un Retry-After de 0: nunca menos de 1 000 ms
        assertEquals(5_401_000L, cola.proximaHora())
        reloj.mono = 5_401_000
        assertEquals(alta, enviar())
        cola.registrar(alta, Resultado.Alta(DISPOSITIVO))
        assertEquals(EstadoCola(sinAlta = false, topeAltas = false, cuotaAgotada = false, rechazados = 0), cola.estado())
    }

    @Test
    fun `Hora corrige el desfase y reintenta al momento una sola vez por elemento, sin tocar r`() {
        reloj.pared = MEDIODIA - DOS_HORAS // el teléfono va 2 h atrasado
        darAlta()
        val apertura = encolar(Prioridad.APERTURA)
        assertEquals(Pendiente(apertura, "api.prueba", 0, DISPOSITIVO), cola.siguiente())
        cola.registrar(apertura, Resultado.Hora(MEDIODIA))
        assertEquals(Pendiente(apertura, "api.prueba", DOS_HORAS, DISPOSITIVO), cola.siguiente()) // al momento, con el desfase
        cola.registrar(apertura, Resultado.Hora(MEDIODIA + 300_000)) // un segundo Hora seguido cuenta como Red
        assertNull(cola.siguiente())
        assertEquals(1_000L, cola.proximaHora())
        reloj.mono = 1_000
        assertEquals(Pendiente(apertura, "respaldo.prueba", DOS_HORAS, DISPOSITIVO), cola.siguiente()) // el desfase no cambió
        cola.registrar(apertura, acuse(apertura))
        reloj.pared = MEDIODIA + UN_DIA // ahora va 1 día adelantado
        val f1 = encolar(Prioridad.FRAGMENTO)
        val cierre = encolar(Prioridad.CIERRE)
        assertEquals(cierre, enviar())
        assertEquals(f1, enviar()) // los dos salen con la hora vieja
        cola.registrar(cierre, Resultado.Hora(MEDIODIA))
        cola.registrar(f1, Resultado.Hora(MEDIODIA)) // es el primer Hora de f1: no cuenta como Red
        assertEquals(Pendiente(cierre, "respaldo.prueba", -UN_DIA, DISPOSITIVO), cola.siguiente())
        assertEquals(Pendiente(f1, "respaldo.prueba", -UN_DIA, DISPOSITIVO), cola.siguiente())
        assertEquals(0, cargas) // la cola nunca carga ni toca el sobre: r conserva su hora_telefono
    }

    // Foco de revisión 2.
    @Test
    fun `un salto de 2 h en pared no cambia cuando esta listo un elemento`() {
        darAlta()
        val apertura = encolar(Prioridad.APERTURA)
        assertEquals(apertura, enviar())
        cola.registrar(apertura, Resultado.Red)
        for (salto in listOf(DOS_HORAS, -DOS_HORAS, 0)) {
            reloj.pared = MEDIODIA + salto
            assertEquals(1_000L, cola.proximaHora())
            reloj.mono = 999
            assertNull(cola.siguiente())
        }
        reloj.pared = MEDIODIA - DOS_HORAS
        reloj.mono = 1_000
        assertEquals(apertura, enviar())
        cola.registrar(apertura, Resultado.Rechazo(400, "formato"))
        reloj.pared = MEDIODIA + DOS_HORAS
        assertEquals(301_000L, cola.proximaHora())
    }

    // Foco de revisión 2.
    @Test
    fun `un rechazado se conserva, se reenvia a los 300 s y si recibe acuse libera al resto`() {
        // DESIGN.md, Errores diseñados: "El servidor rechaza un sobre": "No se borra: se marca y se reintenta. Nunca se descarta en silencio".
        darAlta()
        abrir(X)
        val f1 = encolar(Prioridad.FRAGMENTO)
        val cierre = encolar(Prioridad.CIERRE)
        assertEquals(cierre, enviar())
        assertEquals(f1, enviar())
        cola.registrar(f1, Resultado.Rechazo(409, "conflicto"))
        cola.registrar(cierre, Resultado.Rechazo(401, "firma"))
        assertEquals(listOf(f1, cierre), cola.rechazados()) // el más antiguo primero
        assertEquals(listOf(cierre, f1), cola.pendientes()) // no se borra nada
        // Un 401 firma no repite el alta (H6 decide qué hace un teléfono revocado).
        assertEquals(EstadoCola(sinAlta = false, topeAltas = false, cuotaAgotada = false, rechazados = 2), cola.estado())
        assertEquals(300_000L, cola.proximaHora())
        reloj.mono = 299_999
        assertNull(cola.siguiente())
        reloj.mono = 300_000
        assertEquals(f1, enviar()) // a los 300 s, el más antiguo
        assertNull(cola.siguiente()) // como mucho un rechazado cada 300 s, aunque las órdenes estén libres
        cola.registrar(f1, Resultado.Rechazo(409, "conflicto"))
        assertEquals(listOf(cierre, f1), cola.rechazados()) // f1 pasa a ser el rechazo más reciente
        reloj.mono = 600_000
        assertEquals(cierre, enviar())
        cola.registrar(cierre, Resultado.Red) // sigue rechazado, y su reintento empezó la ventana de nuevo
        assertEquals(900_000L, cola.proximaHora())
        reloj.mono = 900_000
        assertEquals(cierre, enviar())
        cola.registrar(cierre, acuse(cierre))
        assertEquals(f1, enviar()) // un acuse del rechazado: los demás vuelven a estar listos sin esperar
        assertEquals(listOf<Elemento>(), cola.rechazados())
        cola.registrar(f1, acuse(f1))
        assertEquals(listOf<Elemento>(), cola.pendientes())
    }

    @Test
    fun `un SOS se intenta en cuanto se encola aunque haya una espera, si hay id`() {
        val sos1 = encolar(Prioridad.SOS)
        assertNull(cola.siguiente()) // sin id de dispositivo, tampoco el SOS
        darAlta()
        assertEquals(sos1, enviar())
        cola.registrar(sos1, Resultado.Red) // toda la cola espera 1 000 ms
        assertNull(cola.siguiente())
        val sos2 = encolar(Prioridad.SOS)
        assertEquals(sos2, enviar()) // sale al momento
        cola.registrar(sos2, Resultado.Red) // tras su intento espera como el resto: n = 2
        assertNull(cola.siguiente())
        assertEquals(2_000L, cola.proximaHora())
        reloj.mono = 2_000
        assertEquals(sos1, enviar())
        cola.registrar(sos1, Resultado.Limite("limite", 60_000)) // las órdenes esperan 60 s
        val sos3 = encolar(Prioridad.SOS)
        assertEquals(sos3, enviar()) // también al momento
        val sos4 = encolar(Prioridad.SOS)
        assertNull(cola.siguiente()) // pero respeta el límite de uno en vuelo por clase
        cola.registrar(sos3, Resultado.Limite("cuota", null)) // los SOS esperan una hora
        assertEquals(sos4, enviar()) // su primer intento salta también la espera de su prioridad
        cola.registrar(sos4, acuse(sos4)) // y su acuse la quita: los demás SOS solo esperan a su clase
        assertEquals(62_000L, cola.proximaHora())
    }

    @Test
    fun `un SOS que recibe Hora en su primer intento reintenta al momento, y un segundo Hora cuenta como Red`() {
        darAlta()
        abrir(X)
        val f1 = encolar(Prioridad.FRAGMENTO)
        assertEquals(f1, enviar()) // en vuelo mientras empieza la espera de la red
        val aperturaY = encolar(Prioridad.APERTURA, Y)
        repeat(10) { // n = 10: la nominal saturada, 300 000 ms
            reloj.mono = cola.proximaHora()!!
            assertEquals(aperturaY, enviar())
            cola.registrar(aperturaY, Resultado.Red)
        }
        val ahora = reloj.mono
        assertEquals(ahora + 300_000, cola.proximaHora())
        cola.registrar(f1, Resultado.Hora(MEDIODIA + 60_000)) // f1 no es un SOS: su reintento respeta la espera de la red
        assertNull(cola.siguiente())
        val sos = encolar(Prioridad.SOS)
        assertEquals(Pendiente(sos, "api.prueba", 60_000, DISPOSITIVO), cola.siguiente()) // primer intento: salta las esperas
        cola.registrar(sos, Resultado.Hora(MEDIODIA + 120_000)) // 401 hora
        assertEquals(Pendiente(sos, "api.prueba", 120_000, DISPOSITIVO), cola.siguiente()) // el reintento también, al momento
        cola.registrar(sos, Resultado.Hora(MEDIODIA + 180_000)) // un segundo Hora seguido cuenta como Red
        assertNull(cola.siguiente()) // ya no salta las esperas
        assertEquals(ahora + 1_000, cola.proximaHora()) // n = 1: los Hora pusieron el contador de red a 0
    }

    @Test
    fun `solo un acuse que verifica con el rHash del elemento lo borra, si no cuenta como Red`() {
        darAlta()
        val apertura = encolar(Prioridad.APERTURA)
        val fragmento = encolar(Prioridad.FRAGMENTO)
        val malos = listOf(
            acuse(apertura, firmante = FirmanteSoftware(nuevoPar())), // firma de otra clave
            acuse(apertura, r = fragmento.rHash!!), // acuse de otro registro
            acuse(apertura, kid = "desconocida"),
            acuse(apertura, firmante = comprometida, kid = "prueba_comprometida"),
            Resultado.Acuse("basura".toByteArray()),
            Resultado.Alta(DISPOSITIVO), // un alta no acusa una apertura
        )
        for (malo in malos) {
            assertEquals(apertura, enviar())
            cola.registrar(apertura, malo)
            assertEquals(listOf(apertura, fragmento), cola.pendientes()) // no se borra nada
            assertNull(cola.siguiente()) // cuenta como Red: toda la cola espera
            reloj.mono = cola.proximaHora()!!
        }
        assertEquals(apertura, enviar())
        cola.registrar(apertura, acuse(apertura))
        assertEquals(fragmento, enviar()) // solo ahora sale el PUT
    }

    @Test
    fun `cada reintento conserva el idPeticion del elemento`() {
        darAlta()
        val apertura = encolar(Prioridad.APERTURA)
        val ids = mutableListOf<String>()
        for (r in listOf(Resultado.Red, Resultado.Interno, Resultado.Hora(MEDIODIA), Resultado.Limite("limite", 60_000), Resultado.Rechazo(409, "conflicto"))) {
            reloj.mono = cola.proximaHora()!!
            ids += enviar().id
            cola.registrar(apertura, r)
        }
        reloj.mono = cola.proximaHora()!!
        ids += enviar().id
        assertEquals(List(6) { apertura.id }, ids)
    }

    @Test
    fun `las esperas viven en memoria, al arrancar todo lo pendiente esta listo`() {
        val alta = encolar(Prioridad.ALTA)
        repeat(3) {
            reloj.mono = cola.proximaHora()!!
            cola.registrar(enviar(), Resultado.Red)
        }
        assertNull(cola.siguiente()) // espera 4 000 ms y apunta al segundo host
        val nueva = Cola(reloj, azar, hosts, claves) // el servicio arranca de nuevo
        nueva.encolar(alta)
        assertEquals(Pendiente(alta, "api.prueba", 0, null), nueva.siguiente())
    }

    @Test
    fun `una Cola que arranca con el id y los incidentes abiertos guardados no necesita alta ni apertura`() {
        val fragmentoX = encolar(Prioridad.FRAGMENTO, X)
        val cierreX = encolar(Prioridad.CIERRE, X)
        val fragmentoY = encolar(Prioridad.FRAGMENTO, Y)
        assertNull(cola.siguiente()) // sin lo guardado: ni id ni apertura acusada
        val nueva = Cola(reloj, azar, hosts, claves, DISPOSITIVO, setOf(X)) // lo que H3a guardó y le devuelve al arrancar
        for (e in listOf(fragmentoX, cierreX, fragmentoY)) nueva.encolar(e)
        assertFalse(nueva.estado().sinAlta)
        assertEquals(Pendiente(cierreX, "api.prueba", 0, DISPOSITIVO), nueva.siguiente())
        assertEquals(Pendiente(fragmentoX, "api.prueba", 0, DISPOSITIVO), nueva.siguiente())
        nueva.registrar(fragmentoX, acuse(fragmentoX))
        assertNull(nueva.siguiente()) // Y no está abierto: su fragmento espera el acuse de su apertura
        assertNull(nueva.proximaHora())
    }

    @Test
    fun `proximaHora es null si el tiempo no deja nada listo y ahora si ya hay algo`() {
        assertNull(cola.proximaHora())
        reloj.mono = 5_000
        val alta = encolar(Prioridad.ALTA)
        assertEquals(5_000L, cola.proximaHora())
        assertEquals(alta, enviar())
        assertNull(cola.proximaHora()) // en vuelo: lo libera registrar, no el tiempo
    }

    private companion object {
        const val MEDIODIA = 1_791_806_400_000L // 12-10-2026 12:00:00 UTC
        const val DOS_HORAS = 7_200_000L
        const val UN_DIA = 86_400_000L
        const val X = "incidente_x_0000000000"
        const val Y = "incidente_y_0000000000"
        const val Z = "incidente_z_0000000000"
        const val DISPOSITIVO = "dispositivo_prueba_000"
    }
}
