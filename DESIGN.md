---
name: Vigía
description: Graba evidencia sin llamar la atención, te dice tus derechos sin red y avisa sola a tu gente si dejas de dar señales.
colors:
  blanco-senal: "#F6F7F5"
  banda-dia: "#E9ECE8"
  tinta: "#1B1E1D"
  secundario-dia: "#4A4F4C"
  contorno-dia: "#737975"
  asfalto: "#151817"
  banda-noche: "#202422"
  tinta-noche: "#ECEEEA"
  secundario-noche: "#B9BEBA"
  contorno-noche: "#8A908C"
  ambar-prevencion: "#F2A900"
  falla-dia: "#B3261E"
  falla-noche: "#F2B8B5"
typography:
  headline:
    fontFamily: "Overpass"
    fontSize: "26sp"
    fontWeight: 700
    lineHeight: "32sp"
  title:
    fontFamily: "Overpass"
    fontSize: "20sp"
    fontWeight: 600
    lineHeight: "26sp"
  body-large:
    fontFamily: "Roboto"
    fontSize: "18sp"
    fontWeight: 400
    lineHeight: "26sp"
  body:
    fontFamily: "Roboto"
    fontSize: "16sp"
    fontWeight: 400
    lineHeight: "24sp"
  label:
    fontFamily: "Overpass"
    fontSize: "15sp"
    fontWeight: 600
    lineHeight: "20sp"
  caption:
    fontFamily: "Roboto"
    fontSize: "14sp"
    fontWeight: 400
    lineHeight: "20sp"
  numeric:
    fontFamily: "Roboto"
    fontSize: "32sp"
    fontWeight: 500
    lineHeight: "40sp"
    fontFeature: "tnum"
rounded:
  placa: "4dp"
  banda: "8dp"
  boton: "12dp"
  hoja: "16dp"
spacing:
  xs: "4dp"
  sm: "8dp"
  md: "12dp"
  base: "16dp"
  lg: "24dp"
  xl: "32dp"
  xxl: "48dp"
components:
  boton-principal:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.blanco-senal}"
    typography: "{typography.label}"
    rounded: "{rounded.boton}"
    height: "64dp"
    padding: "0 24dp"
  boton-principal-noche:
    backgroundColor: "{colors.tinta-noche}"
    textColor: "{colors.asfalto}"
    typography: "{typography.label}"
    rounded: "{rounded.boton}"
    height: "64dp"
    padding: "0 24dp"
  boton-sos:
    backgroundColor: "{colors.ambar-prevencion}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.boton}"
    height: "56dp"
    padding: "0 24dp"
  banda-senal:
    backgroundColor: "{colors.banda-dia}"
    textColor: "{colors.tinta}"
    typography: "{typography.body-large}"
    rounded: "{rounded.banda}"
    padding: "16dp"
  banda-senal-noche:
    backgroundColor: "{colors.banda-noche}"
    textColor: "{colors.tinta-noche}"
    typography: "{typography.body-large}"
    rounded: "{rounded.banda}"
    padding: "16dp"
  placa-articulo:
    backgroundColor: "{colors.blanco-senal}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.placa}"
    height: "32dp"
    padding: "0 8dp"
  fila-situacion:
    textColor: "{colors.tinta}"
    typography: "{typography.body-large}"
    height: "64dp"
    padding: "0 16dp"
  chip-estado:
    backgroundColor: "{colors.banda-dia}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.placa}"
    height: "32dp"
    padding: "0 12dp"
  rombo-temporizador:
    backgroundColor: "{colors.ambar-prevencion}"
    textColor: "{colors.tinta}"
    typography: "{typography.numeric}"
    size: "112dp"
  banner-estado:
    backgroundColor: "{colors.banda-dia}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.banda}"
    padding: "12dp 16dp"
---

# Design System: Vigía

> **Estado:** F0 aprobado el 12-oct-2026, tras revisarlo con la especificación "Acompáñame": se confirmaron las decisiones 28 a 38 y se mantuvo lo vigente en los choques C1 a C7 (sección "Revisión con la especificación Acompáñame"). Los tokens son provisionales hasta que la primera construcción de F2 los confirme. F1 aprobado el 12-oct-2026: las decisiones 39 a 62 están en la sección "Decisiones de F1".
> **Formato:** las 8 primeras secciones usan los encabezados canónicos en inglés del formato DESIGN.md, porque los leen herramientas como impeccable. El resto del documento son decisiones del proyecto, en español.
> **Contexto de producto:** `PRODUCT.md`.

## Overview

**Creative North Star: "Señal clara, voz baja"**

Vigía se lee como una señal de tránsito: de un vistazo, bajo presión y sin pensar. Y habla bajo: nada en la pantalla grita, nada parpadea y nada delata a quien la usa si alguien mira por encima de su hombro. La gramática viene de la señalización vial que la gente de Venezuela y Colombia lee a diario al volante: el rectángulo informa, el círculo regula y el rombo previene. La forma lleva el significado y el color solo lo confirma.

Es una herramienta de operación (modo *Operate*). Material 3 manda en la estructura, la navegación y los controles; la identidad entra por el tema: roles de color, escala tipográfica y formas. La densidad es media-baja: una acción dominante por pantalla, abajo, al alcance del pulgar.

Rechazos confirmados:
- el lenguaje típico de las apps de seguridad: botón SOS rojo, sirenas, escudos, morado;
- su opuesto blando: el pastel de bienestar;
- cualquier lectura política: ni colores partidistas ni símbolos patrios.

**Contrato de dirección** (impeccable, *new-work*):
- **TESIS:** los derechos como señales viales, legibles en un segundo. Se rechazan el botón rojo de pánico y la estética de protesta.
- **MUNDO PROPIO:** asfalto y blanco de señal, un ámbar de prevención siempre con borde de tinta, las formas ▭ ⊘ ◇, Overpass en títulos y en las placas de artículo.
- **HISTORIA:** la persona abre la app, encuentra su situación formulada como pregunta, lee qué puede hacer, qué no pueden hacerle y qué evitar, y graba con el pulgar.
- **PRIMERA VISTA:** arriba, el chip de país y el estado; en medio, las situaciones en filas grandes; abajo, Grabar a todo el ancho, con el SOS ámbar justo encima.
- **FORMA:** señalización vial (3.ª de 7 en la lista ordenada). En la bóveda, la puesta en escena es de "rayos X" ("Ver prueba"). Semilla `3b2cfe7d`.

**Calibración:**
- antislop: ENERGY 1 / RHYTHM 2 / MOTION 1, en modo "durante" (se aplica mientras se construye).
- taste: DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / VISUAL_DENSITY 4 (perfil de confianza y accesibilidad).

**Key Characteristics:**
- La forma lleva el significado; el color lo confirma.
- Una acción dominante por pantalla, abajo.
- El ámbar se reserva para lo que exige atención, en 1 o 2 elementos por pantalla.
- Plano: la jerarquía la dan el contraste y la forma, no las sombras.
- Nada se mueve en bucle y nada delata.

## Colors

Estrategia **restringida**: neutros de carretera y un único acento. Ambos modos son de primera clase y siguen el ajuste del sistema. Escena física: una alcabala de noche con el teléfono a media luz, o un carro a pleno sol de mediodía. La primera pide el modo noche (menos luz emitida, más discreción) y la segunda el modo día (máximo contraste).

| Nombre | Día | Noche | Rol Material | Uso |
|---|---|---|---|---|
| Blanco de señal / Asfalto | `#F6F7F5` | `#151817` | `surface` | Fondo |
| Banda | `#E9ECE8` | `#202422` | `surface-container` | Bandas de tarjeta, chips, banners |
| Tinta | `#1B1E1D` | `#ECEEEA` | `on-surface` y `primary` | Texto principal; relleno del botón principal |
| Secundario | `#4A4F4C` | `#B9BEBA` | `on-surface-variant` | Horas, ayudas, metadatos |
| Contorno | `#737975` | `#8A908C` | `outline` | Bordes, placas de artículo |
| Ámbar de prevención | `#F2A900` | `#F2A900` | `tertiary` | **Solo** temporizador, SOS y banda "Cuidado" |
| Falla | `#B3261E` | `#F2B8B5` | `error` | Solo evidencia que no coincide y errores graves |

**Contrastes verificados** (WCAG 2.x, calculados el 11-oct-2026):

| Par | Día | Noche | Mínimo |
|---|---|---|---|
| Tinta sobre fondo | 15,63:1 | 15,31:1 | 4,5:1 |
| Tinta sobre banda | 14,10:1 | 13,45:1 | 4,5:1 |
| Secundario sobre fondo | 7,77:1 | 9,48:1 | 4,5:1 |
| Secundario sobre banda | 7,01:1 | 8,33:1 | 4,5:1 |
| Contorno sobre fondo | 4,14:1 | 5,49:1 | 3:1 (UI) |
| Tinta sobre ámbar | 8,36:1 | 8,36:1 | 4,5:1 |
| Ámbar como texto | ✗ | 8,89:1 | 4,5:1 |
| Falla sobre fondo | 6,08:1 | 10,47:1 | 4,5:1 |
| Botón principal (texto/relleno) | 15,63:1 | 15,31:1 | 4,5:1 |

**Reglas:**
- **El ámbar sobre fondo claro se queda en 1,87:1.** Por eso nunca va solo: siempre lleva borde de tinta de 2 dp (como la señal real) y texto de tinta encima. Solo en modo noche puede usarse como color de texto.
- El ámbar aparece en 1 o 2 elementos por pantalla como máximo. Si todo es ámbar, todo se lee como alarma.
- El rojo de falla no se usa para el SOS ni para "No están autorizados a". Además, en VE el rojo es color partidista.
- En VE casi todos los colores saturados tienen carga partidista (rojo, amarillo, naranja, azul). Por eso solo aparecen en dosis funcionales, nunca como superficie.
- **Excepción deliberada:** la fachada de calculadora usa los colores dinámicos del sistema (Material You, Android 12+, con respaldo neutro) para parecerse a la calculadora del teléfono. La paleta vial empieza al entrar.
- **Bóveda web:** los mismos valores como propiedades CSS (`--tinta`, `--banda`…), cambiados bajo `prefers-color-scheme: dark`.

## Typography

- **Overpass** (licencia SIL OFL), pesos 600 y 700, para títulos, etiquetas y placas. Es una interpretación abierta de Highway Gothic, la letra de muchas señales de carretera de América, así que la identidad sale del mismo mundo vial. Va empaquetada en el binario, unos 150 KB.
- **Roboto**, la letra del sistema Android, para todo el texto. Máxima legibilidad sin coste de descarga.

| Rol | Letra | Tamaño / interlineado | Uso |
|---|---|---|---|
| `headline` | Overpass 700 | 26/32 sp | Título de pantalla ("Me paran en una alcabala") |
| `title` | Overpass 600 | 20/26 sp | Encabezado de banda ("Puedes"), secciones |
| `body-large` | Roboto 400 | 18/26 sp | **Texto de las tarjetas de derechos** y filas de situación |
| `body` | Roboto 400 | 16/24 sp | Texto secundario, banners |
| `label` | Overpass 600 | 15/20 sp | Botones, chips, placas |
| `caption` | Roboto 400 | 14/20 sp | Horas y metadatos. **Nunca se baja de 14 sp** |
| `numeric` | Roboto 500, `tnum` | 32/40 sp | Temporizador, contadores (cifras tabulares) |

**Reglas:**
- Todo en sp, para que el texto siga el tamaño de letra del sistema. Hay que probarlo al 200 %: las filas crecen y nada se corta.
- Mayúscula solo al inicio de la frase. Nada de etiquetas en mayúsculas con espaciado ancho. La única excepción son los códigos de las placas (`CRBV 44`), que son abreviaturas.
- Las tarjetas usan frases de 12 palabras como máximo.
- **Bóveda web:** Overpass servida desde el propio Worker, recortada a latin y latin-ext en woff2, solo para títulos; el resto en `system-ui`. **Nunca Google Fonts ni CDN:** filtrarían la IP del contacto a un tercero.

## Layout

- **Margen lateral:** 16 dp. **Ritmo:** 4 / 8 / 12 / 16 / 24 / 32 / 48 dp. Hay más espacio encima de un título que debajo.
- **Una acción dominante por pantalla**, en el tercio inferior, al alcance del pulgar. Lo secundario va arriba o es texto.
- **Objetivos táctiles:** 48 × 48 dp como mínimo, 56-64 dp en las acciones principales y 8 dp entre uno y otro. Las placas de 32 dp amplían su zona táctil a 48 dp.
- **Navegación:** barra inferior de Material con 3 destinos (Inicio, Incidentes, Contactos). Ajustes va en la barra superior.
- **Sistema:** el gesto y el botón Atrás del sistema siempre funcionan. Pantalla de borde a borde con los márgenes de barras, recortes y teclado aplicados.
- **Orientación:** vertical en v1.
- **La barra inferior nunca tapa contenido:** se reserva su alto, más el margen seguro del sistema.
- **Bóveda web:**
  - una sola columna de 640 px de ancho máximo, centrada, con 16 px de margen;
  - sin scroll horizontal desde 320 px;
  - estados definidos en 320, 600 y 1024 px.

## Elevation & Depth

Plano, como una señal. La profundidad se expresa con superficies tonales (fondo → banda) y no con sombras. Solo las hojas inferiores y los diálogos llevan la sombra estándar del sistema, porque tapan contenido de verdad.

**Foco visible** (teclado, D-pad, accesibilidad): contorno de tinta de 3 dp separado 2 dp del elemento. En la web, `outline: 3px solid var(--tinta); outline-offset: 2px`. Nunca se elimina sin sustituto.

## Shapes

| Elemento | Radio | Por qué |
|---|---|---|
| Placas de artículo y chips | 4 dp | Como una placa de ruta |
| Bandas y tarjetas | 8 dp | Como el canto de una señal |
| Botones | 12 dp | Firmes, no píldora |
| Hojas inferiores | 16 dp (arriba) | Estándar de Material para lo que se superpone |

**Glifos de señal.** Son vectores geométricos simples con trazo de tinta de 2 dp: 24 dp en las bandas y 20 dp en las filas.

| Glifo | Significado | Banda |
|---|---|---|
| ▭ Rectángulo | Información | "Puedes" |
| ⊘ Círculo con diagonal | Regulación | "No están autorizados a" |
| ◇ Rombo | Prevención | "Cuidado". Lleva relleno ámbar y borde de tinta |

El resto de iconos son **Material Icons** (`@expo/vector-icons`, ya incluido en Expo), que son el vocabulario nativo de Android. Los controles nativos de Material (interruptores, deslizadores) conservan su forma de sistema.

## Components

**Botón principal (Grabar / Detener)**
- A todo el ancho, 64 dp, relleno de tinta, icono de micrófono (sin punto rojo) y etiqueta "Grabar".
- Mientras graba pasa a "Detener", que pide el PIN.
- **Estados:** pulsado (escala 0,98), deshabilitado ("Falta permiso de micrófono", con arreglo de un toque) y foco.

**Botón SOS (mantener)**
- 56 dp, relleno ámbar con borde de tinta, "Mantén para avisar".
- Al pulsarlo, un anillo se llena en 3 s. Si lo sueltas antes, no pasa nada.
- Al completarse aparece la **pantalla de cuenta atrás**: un rombo ámbar con 5 s y un botón "Cancelar" grande del mismo peso.
- Luego muestra "Avisando…" y, cuando el servidor confirma, "Alerta enviada a N contactos" con 3 vibraciones largas.
- Nunca se dispara con un solo toque. Los tiempos (3 s y 5 s) son un ajuste que se calibra en las pruebas con usuarios.

**Fila de situación**
- 64 dp: glifo de la forma, la pregunta completa ("Me piden revisar el teléfono") y un chevron.
- Las situaciones las define el pack del país activo.

**Banda de señal**
- Una banda por clase de señal, en este orden: ▭ Puedes, ⊘ No están autorizados a, ◇ Cuidado.
- Cada banda: encabezado con su glifo, de 1 a 3 frases cortas y, al final, sus placas de artículo.
- Si el pack es borrador, arriba aparece "BORRADOR: no validado" en tinta sobre banda.

**Placa de artículo**
- `CRBV 44` en Overpass, contorno de 1,5 dp, zona táctil de 48 dp.
- Al tocarla se abre una hoja inferior con el texto del artículo, su fuente oficial (Gaceta, número, fecha) y la fecha de consulta.

**Chip de estado**
- Ejemplos: país ("VE ▾", abre el selector), contactos ("2 contactos listos") y sincronización ("Sin red · 3 en cola").
- Siempre con texto e icono; nunca solo color.

**Rombo temporizador**
- 112 dp, ámbar con borde de tinta, `mm:ss` en cifras tabulares.
- Debajo: "Aviso automático en 24:10" y "Extender 30 min" (un toque, sin PIN; la tercera extensión seguida pide el PIN, decisión 50).
- Sin red: "El aviso automático se activará cuando haya conexión".

**Banner de estado**
- Dos líneas: qué pasa y qué implica, más una acción.
- Tono informativo (banda y tinta), nunca alarma.
- Ejemplo: "Sin red. Tu grabación se guarda en el teléfono."

**Calculadora (fachada)**
- Calculadora funcional con los colores dinámicos del sistema y teclas de 72 dp.
- `PIN` + `=` entra a Vigía. Un número que no es el PIN se calcula como cualquier otro, sin mensaje de error.
- `PIN de coacción` + `=` abre el señuelo (modo avanzado).
- TalkBack la anuncia como calculadora y nunca dice "Vigía".

**Teclado de PIN** (sin camuflaje)
- Teclas de todo el ancho y puntos de progreso.
- Si fallas: "PIN incorrecto." y, desde el tercer fallo, "Te quedan N intentos antes de esperar". Tras 5 fallos, espera exponencial desde 30 s, también tras reiniciar (decisión 51).
- Nunca muestra el alias ni datos de la persona.

**Fila de contacto**
- Etiqueta local ("Mamá"), tipo y estado: Pendiente (invitación vence en 31 h) / Listo · Telegram / Listo · este navegador / Revocado.
- También el último acceso a la bóveda y las acciones Probar alerta y Revocar.
- Máximo 3 contactos.

**Fila de incidente**
- Fecha y duración, más el estado de subida: "Subidos 14/14", "2 en cola", "Interrumpido 14:32" o "Cierre pendiente de confirmar".
- Marcas de SOS y de borrado programado ("Se borra del servidor el 10-nov · Deshacer").

**Hojas, diálogos y snackbars (Material)**
- Hoja inferior: detalle y confirmaciones.
- Diálogo: solo decisiones que deben interrumpir (borrar incidente).
- Snackbar: avisos pasajeros ("Contacto listo").

**Componentes de la bóveda web**
- **Encabezado de estado:** rombo ámbar con "Alerta activa desde hace 23 min · sin noticias desde 14:32", o "Alerta cancelada a las 15:10". Debajo va siempre "Esto no confirma qué pasó" y, si otro contacto ya abrió el aviso, "Otro contacto lo abrió a las 14:12", sin nombres.
- **Cronología:** tramo vertical con hitos y la hora a la izquierda, en lenguaje llano ("Alerta creada", "Aviso entregado a ti", "14 fragmentos recibidos").
- **Reproductor:** elemento `<audio>` nativo sobre los fragmentos ADTS descifrados y unidos.
- **Posiciones** (si la persona activó la ubicación): lista con hora, coordenadas y precisión ("±40 m"). La última va destacada con "Copiar" como acción principal; "Abrir en mapas" avisa antes de mandar la posición a otra app. Los huecos se dicen ("Sin posición entre 14:20 y 14:31") y nunca se dibuja un trayecto entre puntos.
- **Transcripción** (si existe): marcada como derivada ("Transcripción automática: puede tener errores; manda el audio") y escrita siempre con `textContent`, nunca con `innerHTML`.
- **Interruptor "Ver prueba"** (rayos X): bajo cada fragmento muestra, en una capa alineada, `seq`, hash corto, firma ✓, acuse con la hora del servidor y la marca "posterior a la alerta" si corresponde. En móvil alterna a pantalla completa.
- **Botones:** "Descargar paquete" (audio, registros, firmas, acuses, registro de accesos e instrucciones de verificación; con aviso previo y nombre neutro) y "Extender 7 días".
- **Guía del país:** el `contactGuide` del pack, visible también **antes** de cualquier alerta.
- **Aviso:** "Avísame por Telegram", "Avísame en este navegador" y "Probar".

## Do's and Don'ts

**Hacer:**
- Una acción dominante por pantalla, abajo.
- Que el significado lo den la forma y el texto; el color solo lo refuerza.
- Que todo estado diga qué pasó, qué implica y qué hacer.
- Tiempo siempre explícito: "aviso automático en 24:10", "activa desde hace 23 min", "la invitación vence en 31 h".
- Bloquear la interfaz al salir de la app o apagar la pantalla, **también mientras graba**; la grabación sigue detrás.
- Activar `FLAG_SECURE`: sin capturas de pantalla y sin miniatura en apps recientes.
- Probar en día y noche, con la letra al 200 %, con TalkBack y en un Android de gama baja.

**No hacer:**
- Nada de rojo alarma, sirenas, escudos, puños, banderas, ni colores partidistas o patrios como superficie.
- Ni punto rojo de grabación ni animaciones en bucle: delatan.
- No escribir "Vigía" ni "grabando" en la fachada, sus etiquetas de accesibilidad, la notificación del servicio ni los recordatorios.
- No usar el ámbar como texto sobre fondo claro, ni como superficie grande.
- Nada de terceros en la bóveda: ni fuentes externas, ni mapas incrustados, ni analítica, ni CDN.
- Nunca la raya larga (U+2014) en los textos de la interfaz.
- No inventar cifras, testimonios, logos ni contactos de organizaciones sin validar.
- No mostrar consejo legal de un pack sin validar en una build de producción.

## Pantallas y estados

Las referencias de Mobbin están en la sección Referencias. Todas son de iOS y se adaptan a Material 3.

### Configuración inicial (2 min o menos)
1. **Qué es y qué no es.** Graba, informa y avisa; no es asesoría legal ni sustituye a un abogado. Una sola pantalla.
2. **País.**
   - Dos tarjetas grandes con el nombre del país, sin banderas.
   - Preselección por MCC: "Tu teléfono está en una red de Colombia". Si no hay SIM, nada viene preseleccionado.
   - Enlace "Por qué preguntamos": "Tus derechos y a quién acudir cambian según el país. Puedes cambiarlo cuando quieras."
3. **Permisos.** Cada uno con su razón y su estado en la misma fila:
   - micrófono (obligatorio);
   - notificaciones (recomendado; sin ellas los recordatorios solo vibran);
   - excluir a la app del ahorro de batería, con guía según el fabricante;
   - ubicación (opcional: solo mientras grabas, para que tus contactos vean dónde estabas si salta un aviso; nunca en segundo plano).

   Si niegas un permiso, su fila dice qué protección pierdes ("Sin ubicación, tus contactos no sabrán dónde estabas"). Inicio nunca da todo por listo mientras falte algo crítico: micrófono, batería sin restricción o un contacto probado.
4. **PIN.** Al menos 6 dígitos: con 4, probar todos a mano lleva unas 8 h; con 6, unos 35 días. En VE se avisa: "La app se verá como una calculadora. Entra escribiendo tu PIN y =".
5. **Modo.** Base o avanzado; en VE se sugiere el avanzado. El avanzado añade:
   - el PIN de coacción, que no puede confundirse por un dedo con el real (debe diferir en al menos 2 dígitos);
   - el código de recuperación (24 caracteres en 6 grupos de 4, para escribir en papel y guardar lejos del teléfono), que se confirma reescribiendo 2 grupos. Es tu llave de dueño: desde otro teléfono permite ver tus incidentes, decir "Estoy bien" y revocar el teléfono perdido (flujo H);
   - la sugerencia de activar el aviso por falta de señales (flujo G).
6. **Primer contacto** (se puede saltar):
   - QR → el contacto escanea → elige el canal → **Probar alerta** → "✓ Ana recibió la prueba".
   - Si se salta, queda un aviso permanente: "Sin contactos, el SOS no avisa a nadie".

**Recuperar con código** (en otro teléfono; avanzado, o base si se activó en M10): en la primera pantalla, "Tengo un código de recuperación" lleva al flujo H en lugar de la configuración.

### Uso diario
| # | Pantalla | Contenido | Estados |
|---|---|---|---|
| M0 | Calculadora | Fachada funcional y entrada de PIN | Camuflaje activado o desactivado (sin camuflaje, M0 es el teclado de PIN) |
| M1 | Inicio | Chips de país, contactos y sincronización; "¿Qué está pasando?" con 4-7 situaciones; SOS; **Grabar** | Sin contactos · sin red · pack borrador · permiso revocado · batería optimizada · código de recuperación nuevo ("Código de recuperación nuevo: se activa el DD-MM. Si no lo creaste tú, anúlalo con tu PIN") |
| M2 | Grabando | Cronómetro, nivel discreto, "Respaldado hasta 14:03:12 · 2 en el teléfono", rombo temporizador, SOS, Detener (PIN) | El servidor aún no lo sabe (temporizador sin armar) · sin red · subida bloqueada · llamada u otra app con el micrófono (hueco marcado) · poco espacio ("Quedan unos 20 min") · almacenamiento lleno · extensión pendiente ("Extensión pendiente: si no llega al servidor, el aviso sale a las HH:MM") |
| M3 | Tarjeta de derechos | Título-pregunta, 3 bandas de señal, placas, Grabar visible | Pack borrador · sin tarjeta para esa situación |
| M4 | Buscar en la ley | Búsqueda FTS5 con resultados en forma de tarjeta | Sin resultados ("Prueba con otra palabra") |
| M5 | Vigía IA (opcional; después de F2, decisión 59) | Pregunta y respuesta con citas al pack | IA desactivada · sin red (cae a M4) · respuesta descartada por citar mal |
| M6 | SOS | Cuenta atrás → enviando → "Alerta enviada a N" → cancelar (PIN) | Sin red (en cola) · sin contactos · cancelada |
| M7 | Incidentes | Lista con estado de subida | Vacío ("Tus grabaciones aparecerán aquí") · en cola · interrumpido · borrado programado |
| M8 | Detalle de incidente | Base: reproductor, verificación y "Exportar paquete" (PIN). Avanzado: "Abrir con código" | Pendiente de subir · cierre pendiente de confirmar · borrado programado (Deshacer) · sin red (lo ya respaldado se escucha con conexión) |
| M9 | Contactos | Hasta 3 filas de contacto, añadir (QR o mensaje), probar, revocar | Invitación vencida · canal caído · tope alcanzado |
| M10 | Ajustes | País, modo, camuflaje, temporizador por defecto (15/30/60/120), aviso por falta de señales (apagado, 12, 24 o 48 h; pausar hasta una fecha), transcripción (Groq, después de F2), IA (después de F2), ubicación, PINs, código de recuperación, "Qué sale de tu teléfono" | Cada interruptor con su consecuencia en una línea · pausa pendiente de confirmar |
| M11 | Señuelo | Vigía "recién instalada": sin incidentes ni contactos; las tarjetas funcionan | Debe aguantar una revisión de horas sin incoherencias |

**Activar la transcripción** (M10) sigue el patrón de consentimiento de ANZ: nombra al tercero (Groq, EE. UU.), el dato ("el audio de tus grabaciones, sin cifrar"), el propósito y el plazo. Viene apagada y se puede seguir sin activarla.

### Estado de un incidente: tres ejes (decisión 28)

| Eje | Estados | Qué ve la persona |
|---|---|---|
| Incidente | Solo en el teléfono → el servidor lo sabe → cierre pendiente → cerrado | "El servidor aún no lo sabe" hasta el acuse de la apertura |
| Respaldo | En el teléfono → subiendo → respaldado hasta una hora → todo respaldado | "Respaldado hasta 14:03:12 · 2 en el teléfono". Solo cuenta lo que tiene acuse firmado |
| Aviso | Sin aviso → temporizador armado → alerta enviada → abierta por un contacto → cancelada | "Alerta enviada a 2 · 1 la abrió". Que la abran no significa que la persona esté bien |

Los ejes son independientes: un incidente puede estar cerrado, con 2 fragmentos sin respaldar y con una alerta activa a la vez. La pantalla nunca los resume en un "todo bien".

### Bóveda web (`<host-bóveda>/v/#a=…&k=…&d=…`)
| # | Estado | Contenido |
|---|---|---|
| W1 | Inactiva (primera vez y sin alertas) | "Eres contacto de confianza de ‹alias›", qué avisos puedes recibir (SOS, aviso automático y, si ‹alias› lo activó, falta de señales), elegir aviso (con iPhone, solo Telegram en F2), Probar, guía del país (para prepararse **antes**), qué queda guardado en este navegador, "Olvidar este enlace" y la recomendación de un navegador sin sincronización, guardar las direcciones cortas de los dos hosts (en WebKit, además, el aviso de que el navegador borra la clave tras 7 días sin abrir el enlace y guardar el enlace completo fuera del teléfono), "Clave guardada en 2 de 2 direcciones", "No necesitas cuenta" |
| W2 | Alerta activa | Encabezado de estado, posiciones con hora y precisión (sin mapa incrustado), cronología, reproductor, transcripción, Ver prueba, Descargar paquete, Extender 7 días, guía del país; si el SOS se hizo sin grabación, estado "SOS sin grabación": texto neutral, cronología y guía, sin reproductor ni "dejó de enviar" (decisión 42) |
| W3 | Problemas | **Caducado** ("Este enlace caducó. Pide uno nuevo a quien te lo envió") · **revocado** · **sin clave** ("Abre el enlace original completo") · **la evidencia no coincide** (falla, en rojo: "Este fragmento no coincide con lo que firmó el teléfono") · sin conexión |
| W4 | Falta de señales | Encabezado con el texto de la decisión 35 ("No recibimos señales del teléfono de ‹alias› desde el lunes a las 14:00"), cronología y guía del país. No muestra incidentes: solo se ven los que tienen SOS (decisión 22) |

## Vibraciones

| Patrón | Significado |
|---|---|
| 1 corta | Grabación iniciada o detenida |
| 2 cortas | Alerta legal (solo con la IA activada; después de F2) |
| 2 largas | El temporizador vence en 5 min |
| 3 largas | El servidor confirmó el SOS |

No hay vibración por cada fragmento: cada pocos segundos en el bolsillo delataría y gastaría batería. El estado de subida se ve en pantalla.

## Voz y textos

- **Tú, frases cortas, verbo primero.** Sin jerga legal en las bandas: los artículos van en las placas.
- **Nunca instigar.** Los derechos se presentan como opciones tranquilas ("Puedes pedir que se identifiquen"), nunca como órdenes de enfrentamiento. La seguridad física va primero ("No discutas. Manos visibles.").
- **Errores:** qué pasó, qué implica y qué hacer. Ejemplo: "Tu teléfono cerró la grabación a las 14:32. Abre Ajustes de batería para evitarlo."
- **Sin culpa y sin drama.** "Sin red. Tu grabación se guarda en el teléfono." es mejor que "¡Error de conexión!".
- **Vocabulario local** desde `copy` del pack: alcabala (VE) y retén (CO), nombres de los cuerpos de seguridad, documento de identidad.
- **Textos ocultos:** la notificación del servicio dice "Servicio activo", y los recordatorios, "Recordatorio pendiente". Ninguno nombra a Vigía ni dice "grabando".
- **Avisos neutrales** (decisión 35): describen hechos con su hora y nunca afirman detención, desaparición ni la causa. Remiten a la guía del país, que es la que dice cómo comprobar sin exponer a nadie. Textos globales de la bóveda:
  - SOS manual: "‹alias› pidió ayuda a las 14:32. Sigue la guía de abajo."
  - Temporizador vencido: "‹alias› no desactivó su aviso automático a tiempo. La última señal llegó a las 14:32. Sigue la guía de abajo."
  - Falta de señales: "No recibimos señales del teléfono de ‹alias› desde el lunes a las 14:00. Puede ser un apagón o falta de red: esto no confirma qué pasó."
  - Señal recuperada: "El teléfono de ‹alias› volvió a enviar a las 15:40. Eso no confirma que esté bien: podría tenerlo otra persona."
  - Cancelada: "‹alias› canceló la alerta a las 15:10 con su PIN" o "con su código, desde otro teléfono". Un desarme hecho sin red que llega tarde muestra las dos horas: la del teléfono y la de llegada.
  - Telegram y Web Push solo dicen "Tienes un aviso. Abre tu enlace." o "Hay novedades. Abre tu enlace."
- **Pendiente para F3:** el trato de usted o de tú en Colombia (ver Riesgos abiertos).

## Decisiones resueltas (F0)

Todas se confirmaron el 11-oct-2026; las 28 a 38, el 12-oct-2026 (sección siguiente).

| # | Tema | Decisión |
|---|---|---|
| 1 | E2EE frente a transcripción en la nube | Manda E2EE. Groq solo como opción en ajustes, apagada por defecto. Con ella, la asistencia por voz en tiempo real pasa a ser opcional. `transcription`, `legal_advice` y la ubicación dejan de ir en claro en D1 |
| 2 | Plataforma | Android primero. iOS después, con su recorte documentado |
| 3 | Identidad | Anónima: un par de claves del dispositivo. El servidor solo conoce la clave pública y un ID aleatorio; ni email, ni teléfono, ni IPs en logs. Google pospuesto. Código de recuperación solo en modo avanzado (la 48 lo abre como opción en base) |
| 4 | IA | Opcional. FTS5 y las tarjetas son la verdad. El LLM solo reformula lo recuperado, cita IDs del pack o no contesta, recibe solo texto y, si tarda, se cae al resultado offline |
| 5 | Bóveda | Solo para contactos registrados de antemano. Enlace secreto con ID de 128 bits y clave en el `#fragmento`. Página estática que descifra en el navegador. Expone lo mínimo. noindex, no-referrer y CSP sin terceros. Caduca 7 días después del último fragmento y el contacto puede ampliarla. Caducar cierra el enlace, no borra la evidencia |
| 6 | País | Manual, con un chip siempre visible. Pista por MCC, sin GPS, que solo sugiere y nunca cambia sola ni a mitad de un incidente. VE y CO van dentro de la app. En la frontera manda el territorio. Cada incidente fija su `country_code`. En las trochas, la tarjeta es solo de seguridad física |
| 7 | Fuente y validación | Texto oficial citado por artículo. Un/a abogado/a colegiado/a local firma corpus, tarjetas, contexto del prompt y guía en cada versión. En VE su identidad no va en el pack. Sin firma no hay release |
| 8 | CountryPack | Solo campos que hoy cambian el comportamiento. Un pack solo puede endurecer los valores por defecto globales |
| 9 | Persona | Base simple y un "modo riesgo alto" (avanzado) que se activa aparte |
| 10 | Disparo del SOS | Manual (mantener 3 s y cuenta atrás de 5 s) más un temporizador en el servidor (30 min por defecto) que se arma cuando el servidor se entera de la grabación. Aviso 5 min antes. Extender sin PIN; desarmar con PIN (la 50 limita extender sin PIN a 2 veces seguidas) |
| 11 | Aviso a contactos | Telegram (el servidor guarda solo el `chat_id`) y Web Push. Sin números de teléfono. Mensajes sin contenido y bot con nombre neutro |
| 12 | Coacción (9ª decisión) | Tres capas: vistazo en alcabala, desbloqueo forzado y forense. Lo que no se promete: ocultar la app ante un forense |
| 13 | Identidad en el teléfono | Solo se disfraza el icono y el nombre del lanzador. A nivel de sistema la app se llama "Vigía" (riesgo aceptado: cabecera de la notificación, ajustes, indicador del micrófono). Con el camuflaje activado, la calculadora es la pantalla de PIN |
| 14 | PIN de coacción | Solo en avanzado. Abre el señuelo, dispara el SOS en silencio y detiene la grabación de verdad. No borra nada |
| 15 | Reproducir en el teléfono | Base: sí, con el PIN. Avanzado: al cerrar el incidente el teléfono queda de solo escritura y se reproduce con el código de recuperación |
| 16 | Borrado | Candado de R2 de 30 días por objeto. Borrar oculta en el teléfono al instante; en el servidor se ejecuta cuando el fragmento más reciente del incidente cumple 30 días, nunca con un SOS activo. Hasta entonces se puede deshacer con el PIN (la 61 lo extiende a cualquier alerta activa) |
| 17 | VE frente a CO | VE: camuflaje activado y se sugiere el modo avanzado. CO: camuflaje apagado pero disponible. Todo lo demás es global |
| 18 | Censura | Rotación entre 2 y 3 hosts, DNS cifrado con varios resolvedores y sugerencia de VPN. Limitación: sin red no se arma el temporizador (la 44 fija los hosts de F2) |
| 19 | Alta de contactos | QR en persona por defecto; por mensaje (diáspora), con aviso y sugerencia de borrarlo. La invitación caduca a las 48 h. **Máximo 3 contactos** |
| 20 | Motor de grabación | AudioRecord + MediaCodec, fragmentos ADTS de 8 s (la 29 lo cambia: entre 2 y 8 s, según la medición de F2), hash, firma y cifrado en RAM. El audio en claro nunca toca el disco |
| 21 | Pantalla negra | Se quita: bloquear el teléfono ya cumple esa función con el servicio en primer plano |
| 22 | Visibilidad | Los contactos solo ven un incidente si hay SOS |
| 23 | Vibraciones | 4 patrones. Sin vibración por fragmento |
| 24 | Probar alerta | En el alta de cada contacto y desde M9 |
| 25 | Dirección visual | "Señalización vial", idea rectora "Señal clara, voz baja". La fachada usa los colores del sistema |
| 26 | Lecciones | Las 8 de la sección Seguridad |
| 27 | Anclaje externo de tiempo | Fuera de la v1 (riesgo abierto) |

## Revisión con la especificación Acompáñame (12-oct-2026)

La especificación de producto "Acompáñame" (v1.0, 11-oct-2026) llegó después del primer borrador de F0. Comparte el núcleo de Vigía: grabar, respaldar y avisar si la persona deja de dar señales, con la IA después. Pero está pensada como un servicio con custodia: cuenta con teléfono o correo, personal y abogados que acceden a la evidencia, interfaz visible, AWS o Azure y cobro por uso.

Aquí se integra lo que encaja con los innegociables de Vigía. Lo que chocaba con una decisión vigente no se aplicó, y el 12-oct-2026 se confirmó mantener lo vigente. Los códigos (DEC, SES, CAP, ALT, REC, QA, §) son los de esa especificación.

### Decisiones nuevas (confirmadas el 12-oct-2026)

| # | Tema | Decisión | Viene de |
|---|---|---|---|
| 28 | Estado honesto | Tres ejes independientes: incidente, respaldo y aviso (ver Pantallas y estados). La pantalla distingue "el servidor aún no lo sabe" de "el servidor lo sabe", y muestra "Respaldado hasta HH:MM:SS" y "cierre pendiente de confirmar". Solo cuenta como respaldado lo que tiene acuse firmado | SES-08, SES-12, CAP-09, CAP-16, §16 |
| 29 | Duración del fragmento | Cambia la 20: de 2 a 8 s. El pico técnico de F2 fija el valor más corto que, en un gama baja con 3G degradada, no haga crecer la cola. Se parte de 4 s | DEC-05 |
| 30 | Ubicación durante el incidente | Cambia el flujo A.6: con la ubicación activada, una posición por minuto mientras graba, cifrada con `K` dentro del registro firmado. Nunca en segundo plano. La bóveda da la hora y la precisión de cada punto, dice los huecos y no inventa trayectos | DEC-03, DEC-16, SES-09, §9.2 |
| 31 | Aviso por falta de señales | Opcional y apagado. Si el teléfono pasa 12, 24 o 48 h sin ninguna petición firmada, el servidor avisa a los contactos. Latido cada hora, sin ubicación; el servidor guarda solo la hora de la última señal. Se puede pausar hasta una fecha. No salta si quien tiene el teléfono lo deja encendido y con red: para eso está el temporizador (flujo G) | DEC-11, DEC-13, ALT-24 |
| 32 | Entrega de avisos | Un aviso por incidente o teléfono y por tipo, revalidado antes de disparar. Si nadie lo abre, se repite a los 10 y a los 30 min. Abrir el enlace cuenta como acuse y los demás contactos lo ven, sin nombres. Las novedades llegan a todos. Los fragmentos no mueven el temporizador. Un retraso por fallo nuestro se declara como tal (flujos B y F) | DEC-17, ALT-03, ALT-06, ALT-07, ALT-08, ALT-13, ALT-16, ALT-18 |
| 33 | Recuperar con código | Avanzado. Del código sale también una clave de firma (Ed25519). Desde otro teléfono se pueden ver los incidentes, decir "Estoy bien", revocar el teléfono perdido y programar o deshacer borrados. Revocar no borra evidencia. En base no existe: el respaldo son los contactos (flujo H). La 48 lo hace opcional también en base | DEC-18, §11, REC-01 a REC-03 |
| 34 | Exportar paquete | En M8, con el PIN, para dárselo a un/a abogado/a u organización sin necesidad de SOS (flujo I) | DEC-09 adaptado, §12.2 |
| 35 | Avisos neutrales | Los textos dicen hechos con su hora y remiten a la guía del país. Nunca afirman detención, desaparición ni la causa (ver Voz y textos) | §10.2, §10.3, DEC-19 |
| 36 | Preparación honesta | Cada permiso negado dice qué protección pierdes; Inicio no da todo por listo si falta algo crítico; aviso de poco espacio con los minutos que quedan; nunca se borra evidencia sin respaldar para hacer sitio | §5.2, CAP-15, CAP-17 |
| 37 | Métricas del piloto | Objetivos medibles para salir del piloto (ver Pruebas), con contadores agregados y teléfonos de prueba. Sin telemetría por persona | §21.4, DEC-21 |
| 38 | Reglas extra de la IA | La transcripción es dato, nunca instrucción: va delimitada en el prompt y la IA no tiene herramientas. Como mucho una alerta legal por minuto. Si algún día hay voz, solo por auriculares | IA-14, IA-16, §15 |

### Choques con lo vigente (resueltos: se mantiene lo vigente)

| # | Acompáñame | Vigía | Resolución y motivo |
|---|---|---|---|
| C1 | Personal de la empresa y abogados acceden a la evidencia (DEC-09, §4.2, §12) | E2EE: nadie del equipo puede verla (decisión 1) | Mantener E2EE. Un operador que puede leer es el primer blanco de una orden judicial o de un ataque. El abogado entra como contacto o recibe el paquete exportado (34) |
| C2 | Cuenta con teléfono o correo (REG-01, REG-03) | Anónima, con la clave del dispositivo (decisión 3) | Mantener. Un teléfono o un correo identifican a la persona ante quien obtenga la base de datos; una clave pública no |
| C3 | Interfaz visible como disuasión, sin camuflaje (DEC-10, §15.3) | VE: camuflaje por defecto. CO: visible (decisión 17) | Mantener en VE: obligaron a desbloquear el teléfono en 29 de 58 casos, y la disuasión es una hipótesis de la propia especificación. Quien quiera mostrarla puede apagar el camuflaje en Ajustes. En CO ya es visible |
| C4 | Video y audio (DEC-04) | Solo audio (decisión 20) | Audio en v1: va en el bolsillo, no obliga a levantar el teléfono (menos escalada), gasta entre 10 y 30 veces menos datos y se respalda antes. El sobre admite cualquier dato: un modo video puede evaluarse en F3 para CO, donde la Ley 1801 (art. 21, a validar) permite grabar procedimientos policiales |
| C5 | Avisos por silencio a los 10 min y a las 12 h (DEC-14, DEC-15) | Temporizador que se arma con cada grabación (decisión 10) | Mantener el temporizador. En VE quedarse sin red es normal (falsas alarmas), y un teléfono confiscado puede seguir transmitiendo, así que el silencio no llega. El aviso de largo plazo se adapta en la 31 |
| C6 | AWS o Azure (DEC-22) | Cloudflare (stack fijado) | Mantener Cloudflare. Cada componente lógico de la especificación (§18.2) tiene su pieza: Worker, D1, R2 y Cron |
| C7 | Cobro por uso (§20) | Sin modelo de ingresos (riesgo de sostenibilidad) | Grabar, derechos, SOS, avisos y bóveda no se cobran nunca: nadie en peligro debe toparse con un pago, y pagar identifica. Es una decisión de negocio que no bloquea F1 |

### Evaluado y no adoptado

- **Detener distinto de "Estoy bien"** (SES-15). El temporizador seguiría armado tras detener, lo que protege si obligan a parar la grabación, pero multiplicaría las falsas alarmas en modo base. Ese caso ya lo cubre el PIN de coacción del modo avanzado.
- **Ubicación cada hora y recorrido de 24 h** (LOC-01 a LOC-06). Exige el permiso "Permitir siempre", que Google Play solo aprueba tras una declaración aparte, y crea un historial de dónde está la persona que no queremos tener. Lo cubren la 30 (durante el incidente) y la 31 (sin ubicación).
- **Contacto de respaldo escalonado** (ALT-B). Avisar a los 3 a la vez es más rápido, y la repetición de la 32 cubre que nadie lo vea.
- **IA sin red en el teléfono** ("Gemma 4", §8.3). El camino sin red sigue siendo determinista: FTS5 y tarjetas. Un modelo local no cabe con holgura en un gama baja y no está verificado.
- **IA multimodal en tiempo real, voz pregrabada y supervisor** (DEC-23, DEC-25, DEC-26). Van en una fase posterior, la misma en la que los pone la especificación, y con las decisiones 1 y 4: audio o imagen solo salen en claro con permiso explícito.
- **Portal para personal y abogados, consentimientos y medición de consumo en el servidor** (§17, §18.2). Sin acceso al contenido no hay portal que construir, y los consentimientos viven en el teléfono.
- **Campos nuevos en el CountryPack** (vigencia, protocolos y preguntas de aclaración; §14.2, §14.3). Si una norma se deroga, se quita del pack y el validador hace fallar las tarjetas que la citan (QA-22). La persona elige su situación, así que no hay hechos que emparejar; `careful` cubre las excepciones y `validation`, la revisión. Los protocolos servirán a la IA de la fase posterior.

### Trazabilidad por sección

| Especificación | En Vigía |
|---|---|
| §1 y §3; DEC-01, DEC-06, DEC-07, DEC-20, DEC-21 | Igual: activación voluntaria, subida automática, grabación sin red, Android primero y un piloto que se supera por resultados. Las tarjetas sin red son camino crítico, así que van en F2 y no al final |
| DEC-02, DEC-08 | "Usuario" es la clave del dispositivo. La evidencia es de la persona y Vigía la custodia cifrada (PRODUCT.md, principio 6) |
| DEC-03, DEC-16, §9.2 | Decisión 30 |
| DEC-04 | C4 |
| DEC-05 | Decisión 29 |
| DEC-09, §4, §12 | C1, decisión 34 y "Quién ve qué" (sección Seguridad) |
| DEC-10, §15.3 | C3 |
| DEC-11 a DEC-13, §9 | Decisión 31 |
| DEC-14, DEC-15 | C5 |
| DEC-17, DEC-19, §10, §22 | Decisiones 32 y 35, guía del país y configuración inicial |
| DEC-18, §11 | Decisión 33 |
| DEC-22, §18 | C6 |
| DEC-23 a DEC-26, §13, §15 | Decisiones 4 y 38; el resto, en una fase posterior. Su pendiente PEN-13 ya está resuelto aquí: solo contenido validado |
| DEC-24, §14 | CountryPack, sin cambios |
| §5 | C2 y decisión 36. El primer contacto sigue siendo opcional, con aviso permanente |
| §6, §7, §8, §16 | Decisiones 28 a 30, flujos A y B y errores diseñados |
| §17 | D1 (borrador para F1) |
| §19 | Ya cubierto, más límites por dispositivo |
| §20 | C7 |
| §21 | Decisión 37 y casos añadidos en Pruebas |
| §23 | "Lo que Vigía no hace" |
| §24 | Resueltos en esta sección o en Riesgos abiertos |

### Lo que Vigía no hace

- Avisar por su cuenta a policía, fiscalía u organizaciones: solo a los contactos que eligió la persona.
- Afirmar que hubo una detención o una desaparición.
- Publicar grabaciones o ubicaciones.
- Reconocer caras, matrículas o voces.
- Dejar que su equipo vea el contenido.
- Garantizar un abogado disponible.
- Encender el micrófono sin una acción de la persona.
- Prometer que un aviso sale a la hora exacta: Android y la red pueden retrasarlo.
- Recuperar lo que nunca salió del teléfono.
- Ocultar la app ante un análisis forense (decisión 12).

## Decisiones de F1 (12-oct-2026)

Al aprobar el plan de F2 (`docs/plan/2026-10-12-plan-maestro-f2.md`) se fijaron estas decisiones. Vienen de dos revisiones de seguridad y de tres revisiones adversariales del plan. Si una decisión anterior choca con una de esta tabla, manda la de esta tabla.

| # | Tema | Decisión |
|---|---|---|
| 39 | Formatos y firmas | Cadena canónica de las peticiones (prefijo de versión, método, ruta sin query, hora, idPeticion, idDispositivo y SHA-256 del cuerpo crudo), firma P1363 y hora dentro de ±5 min; si el reloj está desfasado, se corrige con la hora del servidor sin tocar `hora_teléfono`. Bytes canónicos de `r`, con un registro de apertura firmado (que lleva el `country_code`) como origen de la cadena. Prefijos de dominio distintos para peticiones, registros, cierre, acuses y recuperación. AAD con codificación fija `"vigia/v1"‖tipo‖incidente‖seq`, también para metadatos. `info` de HPKE ligado al incidente y al rol. Acuse `{prefijo, kid, SHA-256(r), hora_servidor}`, que la app y la bóveda verifican con las claves públicas fijadas antes de borrar o contar nada. "Respaldado hasta" es el último fragmento del tramo contiguo con acuse válido. Las órdenes son idempotentes por estado (por ejemplo, "extender" lleva el plazo que vio la app). Solo cuenta como señal una petición con firma de petición de un teléfono no revocado |
| 40 | Ingesta | La clave de R2 la construye el servidor tras comprobar el dueño del incidente; escritura única; acuse solo cuando R2 y D1 confirman. Acepta fragmentos fuera de orden: comprueba `prev` si el anterior ya está y, si no encadena, lo marca como bifurcación sin borrar nada. Con el cierre guardado, un `seq` mayor se rechaza con 409. Un PUT repetido no cambia la hora de recepción ni las marcas. El límite por dispositivo cuenta después de verificar la firma, con cupos separados para órdenes, subida y lecturas. "Fragmento más reciente" se mide por la hora de recepción. Un fragmento que llega tarde no es "posterior a la alerta" si su hash ya lo fijaban antes el `prev` del siguiente o el cierre. La conciliación D1/R2 la hace un script externo de solo lectura: el Worker nunca lista |
| 41 | Cron y D1 | En lugar de "volver a leer en la misma transacción" (D1 no tiene transacciones interactivas): transiciones condicionales en batch, restricciones únicas y una tabla de entregas (pendiente, enviado, fallido) con reintentos. La cancelación solo llega a quien recibió la alerta. Sin réplicas de lectura para el temporizador ni la autorización. Consultas con índice |
| 42 | Lecturas firmadas y SOS sin grabación | El teléfono lee lo ya respaldado del servidor (M8, "Abrir con código" y "Exportar paquete") con lecturas firmadas: la copia local se sigue borrando con el acuse, y lo respaldado se escucha con red. Hay lecturas firmadas de contactos (estado, canal y último acceso) y del estado del aviso y el registro de accesos. El SOS sin grabación crea la apertura de un incidente sin audio, que no arma el temporizador, se cierra al cancelar con el PIN y continúa si se graba con la alerta activa. "Abierta" cuenta solo con un POST explícito tras descifrar |
| 43 | Bóveda | Enlace `/v/#a=<accessId>&k=<privada>&d=<huella>`: el `accessId` también va en el fragmento y las rutas de la API son constantes. Prueba de posesión `HKDF-SHA256(k, sal fija, "vigia/v1/acceso"‖accessId)` en una cabecera; el servidor guarda solo su SHA-256 y nunca la pública del contacto; el alias va firmado por el dispositivo dentro de lo cifrado para el contacto: el servidor nunca lo ve en claro. Sin prueba válida, el mismo 404 sin registro. Cabeceras en todas las respuestas. Un único service worker en `/sw/`. Durante el alta, el contacto abre los enlaces de los dos hosts y cada origen guarda su copia de la clave ("Clave guardada en 2 de 2 direcciones"). Vuelta a la bóveda por las direcciones cortas de los dos hosts, sin secretos; en WebKit, además, el aviso de los 7 días y el enlace completo fuera del teléfono; W1 recomienda un navegador sin sincronización y no invita a guardar el enlace completo en marcadores sincronizados. "Olvidar este enlace" recorre los dos orígenes. Un navegador puede ser contacto de varias personas: una entrada por `accessId` y una suscripción push compartida, que solo se da de baja cuando no queda ninguna entrada. "Copiar" es la acción principal de las posiciones; "Abrir en mapas" avisa antes |
| 44 | Hosts | Cambia la 18 para F2: solo hosts gratuitos y neutros, sin "vigia" ni "sos". `<host-api>` y `<host-bóveda>` son dos Workers en el subdominio neutro de workers.dev de una cuenta dedicada; `<host-respaldo>` es el mismo código en pages.dev, para que un bloqueo de todo workers.dev no deje sin respaldo. Los nombres reales viven fuera del repo. Sin dominios propios en F2. Un host por función (API, bóveda y respaldo) con su mapa de rutas: una ruta de otro host da 404. Sin CORS, cookies ni desafíos de bot |
| 45 | Página de presentación | Superficie nueva: `vigiaapp.pages.dev`, con el nombre, porque es lo que se promociona. Estática, sin terceros ni analítica, publicada desde `sitio/` en `main`. Nunca enlaza ni nombra un host operativo. Mientras sea prototipo avisa "Prototipo en construcción. Todavía no lo uses para protegerte." y no ofrece descarga. El camuflaje de la app sigue siendo un ajuste |
| 46 | Telegram y Web Push | `secret_token` en el webhook; código de vinculación de un solo uso; el bot nunca envía el enlace ni el host, descarta el nombre de quien escribe y borra sus avisos tras la apertura; lista de servicios push permitidos; sub de VAPID neutro; push sin carga o solo con el tipo cifrado; un canal por contacto. Los contactos con iPhone usan solo Telegram en F2 |
| 47 | Coacción con el PIN real | Con una alerta activa, el servidor rechaza las órdenes del teléfono que reducen la protección: revocar contactos, cambiar canales, apagar o pausar la falta de señales, programar borrados y crear o cambiar la clave de recuperación. La recuperación sí puede, si su clave ya tenía poderes cuando empezó la alerta |
| 48 | Código de recuperación | Detalla y amplía la 33. Crockford Base32 de 24 símbolos (120 bits), normalización (mayúsculas, espacios, O por 0, I y L por 1) y HKDF-SHA256 con sal e info fijas. También opcional en modo base, desde M10; al activarlo, el teléfono envuelve las `K` que conserva. Salvaguardas: una clave creada después de la configuración inicial no tiene poderes durante 72 h y M1 lo muestra; cambiar la pública exige la firma de la vigente |
| 49 | Teléfono revocado | Detalla el flujo H.3. Sus órdenes, lecturas y aperturas nuevas reciben la misma respuesta que una firma inválida, y sus peticiones nunca cuentan como señal. Solo se aceptan fragmentos y cierre de incidentes cuya apertura tuvo acuse antes de la revocación, marcados "recibido después de la revocación" |
| 50 | Extender sin PIN | Cambia la 10: como mucho 2 extensiones seguidas sin PIN; la tercera pide el PIN, y el PIN de coacción finge extender y dispara el SOS en silencio. Sin red, la extensión se muestra pendiente y el recordatorio local usa el plazo confirmado |
| 51 | PIN | Verificador HMAC con una clave del Keystore, contador persistente y esperas con reloj monotónico que sobreviven al reinicio. Los dos PIN cuestan lo mismo de comprobar, y en modo base hay un verificador de relleno. En la calculadora la espera se aplica sin mostrar nada |
| 52 | Android endurecido | Sin copias de seguridad; solo el lanzador exportado; sin enlaces profundos ni WebView; sin OTA ni dev client en release; sin logs propios en release; red sin texto plano y solo con CAs del sistema; lista cerrada de permisos sin ubicación en segundo plano; campos de texto sin aprendizaje del teclado ni autocompletado; portapapeles sensible; protección contra toques tapados; notificaciones en canales neutros con visibilidad secreta. Notificaciones locales y ubicación con APIs de Android desde Kotlin, porque expo-notifications y expo-location arrastran Firebase o Google Play Services; la compilación falla si entra una dependencia prohibida |
| 53 | Cola de subida | Pasa de TypeScript a Kotlin, dentro del servicio: una sola cola para todo lo firmado, con prioridad fija (apertura; SOS y cancelación; desarme y extensión; cierre; latido; fragmentos). Tras Detener, el servicio sigue hasta vaciarla, y WorkManager cubre las muertes del servicio y los reinicios. JS solo lee el estado. Motivo: el hilo JS puede pausarse con la pantalla apagada y la evidencia no saldría a tiempo |
| 54 | Ajustes | Sale el ajuste "datos móviles" en F2: apagarlo podría impedir que la evidencia salga a tiempo |
| 55 | Plataforma Cloudflare | Cuenta dedicada a Vigía, con 2FA por llave y un token de API mínimo con caducidad; `observability` y trazas desactivadas; sin Logpush ni analítica; `preview_urls` desactivadas; tope global de altas por hora sin IP, con su cota calculada; Workers Paid antes del piloto |
| 56 | Lo que guarda el servidor | La hora de la última señal solo con el aviso por falta de señales activo, borrada al apagarlo, y la fecha de fin de la pausa (el plazo cuenta desde ella). Las filas anti-reenvío se borran a los 10 min |
| 57 | Retención | Ningún borrado automático de incidentes de teléfonos inactivos en la v1 ni en el piloto. Se revisa con los datos del piloto y con un custodio legal antes del lanzamiento público |
| 58 | Variantes de prueba | Las builds de debug y de pruebas envuelven `K` también para una clave de escucha de pruebas (fuera del repo, destruida al cerrar F2) y admiten un interruptor sin `FLAG_SECURE` para las capturas; la de pruebas compila con packs en borrador y muestra la banda. Solo van a teléfonos de prueba, con grabaciones sin terceros, y nunca sirven para protegerse. La de release no lleva nada de eso; "Quién ve qué", la envoltura y el Do de `FLAG_SECURE` describen la de release |
| 59 | Lo opcional | La IA, la transcripción, M5, la alerta legal con 2 vibraciones cortas y el temporizador de trayecto quedan fuera de F2 |
| 60 | Escucha en modo base | Las lecturas firmadas usan una clave de lectura con `setUnlockedDeviceRequired`, distinta de la de firma. La envoltura local de `K` es para una pública cuya privada solo se abre con el PIN: grabar no pide el PIN; escuchar, sí, también ante un análisis del teléfono |
| 61 | Borrado | Detalla la 16. Estados programado, borrando y borrado; durante el borrado, la ingesta de ese incidente responde 409. Nunca se ejecuta con una alerta activa del incidente o del teléfono, tampoco la falta de señales |
| 62 | Distribución | La clave de firma de release se custodia fuera del repo y de EAS, con copias cifradas, antes del primer APK que salga de los teléfonos de prueba |

## Modelo de amenaza por país

> El perfil de amenaza manda sobre todo. Un fallo pone en riesgo físico y legal a una persona real.

### Venezuela (VE): Estado hostil
- **Actores:** GNB y PNB sobre todo; policías estatales y municipales, DGCIM, colectivos y personal sin identificar (en 36 de 58 casos no se identificaron).
- **Prácticas documentadas** (DFRLab y VE sin Filtro, *Watch the Watchers*, marzo de 2026, 58 reportes):
  - alcabalas informales y puntos militares en carreteras;
  - en 34 casos pidieron el teléfono y en 23 lo revisaron a la fuerza;
  - **en 29 obligaron a desbloquearlo** y **en 14 se lo llevaron fuera de la vista**;
  - revisan galería, WhatsApp, Telegram, SMS, redes sociales y la nube (Drive, iCloud, Dropbox), buscando palabras clave;
  - en 6 reportes hubo extorsión en dólares o por Zelle;
  - en aeropuertos, revisiones de 4 a 5 horas;
  - la DGCIM tiene Cellebrite UFED Touch 2.
- **Red:**
  - interceptación masiva y sin orden judicial: en 2021, alrededor del 21 % de las líneas de Movistar;
  - CANTV/Movilnet da acceso directo al Estado;
  - indicios de IMSI catchers y secuestro de WhatsApp por duplicado de SIM;
  - a julio de 2026, más de 200 dominios bloqueados, entre ellos Signal, varias VPN, Tor y los DNS públicos de Google y Cloudflare;
  - CANTV ha inyectado respuestas DNS falsas.
- **Detenciones:** un patrón de arrestos arbitrarios de corta duración (Misión de la ONU, septiembre de 2026) y desapariciones forzadas (Foro Penal: al menos 62 al 31-mar-2025).
- **Valor de la prueba:** el poder judicial está subordinado al Ejecutivo y el certificador (SUSCERTE) es del Estado. La evidencia de Vigía servirá sobre todo ante mecanismos internacionales y para la defensa.
- **Valores por defecto que endurece el pack:** camuflaje activado y modo avanzado sugerido.

### Colombia (CO): abuso policial, otro marco
- **Actores:** Policía Nacional, incluida su unidad de manejo de protestas. En algunas regiones, actores armados no estatales (a precisar en F3 con la validación local).
- **Contexto:** durante el Paro Nacional de 2021, Temblores ONG registró al menos 2.387 casos de violencia de la Fuerza Pública y 1.139 detenciones arbitrarias (28-abr a 17-may-2021). Hubo integrantes de organizaciones que salieron del país por denuncias de seguimiento.
- **Marco** (a validar en F3):
  - Ley 1801 de 2016, art. 21: "Todo procedimiento policivo podrá ser grabado";
  - Ley 527 de 1999, arts. 9-11: integridad, admisibilidad e identificación de quien origina un mensaje de datos;
  - art. 30.5: sellado de tiempo por entidades acreditadas por ONAC;
  - Ley 906 de 2004, art. 254: cadena de custodia.
- **Valores por defecto:** los globales. Camuflaje disponible pero apagado.

### Frontera VE/CO
- Manda el territorio donde estás. Cambiar de país es un toque, y la pista por MCC puede alternar cerca de la frontera, por eso solo sugiere.
- Cada incidente fija su `country_code` al empezar.
- En las **trochas** el riesgo son grupos armados, no la ley. La tarjeta (`border`) da **solo pautas de seguridad física**.

## Arquitectura

```
vigia-app/  (monorepo pnpm)
├─ packages/shared   TS puro: contratos de API, formato de sobre y cadena, verificador,
│                    tipo CountryPack y su validador. Lo usan app, Worker y bóveda.
├─ packages/packs    ve/, co/: datos JSON más el registro de validación; script de export legible.
├─ packages/mobile   Expo (build con el JS dentro) más 1 módulo nativo Kotlin "recorder".
├─ packages/boveda   página estática de la bóveda.
├─ packages/backend  Worker Hono, desplegado con nombres neutros (decisión 44):
│                    <host-api>      → ingesta, temporizador, contactos, avisos
│                    <host-bóveda>   → página de la bóveda y sus datos cifrados
│                    <host-respaldo> → el mismo código en pages.dev
│                    D1 · R2 (candado 30 d) · Cron cada minuto (solo en <host-api>) · webhook de Telegram
└─ sitio/            página de presentación (vigiaapp.pages.dev, decisión 45).
```

**Unidades del móvil** (una responsabilidad cada una):
| Unidad | Hace | No hace |
|---|---|---|
| `recorder` (Kotlin) | Servicio en primer plano de micrófono (y de ubicación, si está activada). Por cada fragmento, un sobre: AAC → hash → AES-256-GCM → registro firmado, con la posición nueva cifrada si la hay → disco (solo cifrado) | Red |
| Cola de subida (Kotlin, dentro del `recorder`; decisión 53) | Una sola cola para todo lo firmado, con prioridad fija: apertura (lo que arma el temporizador); SOS y cancelación; desarme y extensión; cierre; latido; fragmentos. Backoff exponencial con jitter de 1 s a 5 min y rotación de hosts. Borra la copia local **solo** con un acuse válido, verificado con la clave fijada. JS solo lee su estado | Cifrar |
| `LegalEngine` | FTS5 sobre el pack activo → tarjetas | Llamar a la IA |
| `PackLoader` | Valida el pack del binario y reconstruye `legal.db` si cambia la versión | Descargar packs |
| `TimerClient` | Pide armar, extender y desarmar encolando las órdenes en la cola de subida (Kotlin; decisión 53); recordatorios locales con APIs de Android desde Kotlin (decisión 52); latido cada hora por la misma cola, con WorkManager, si está activado el aviso por falta de señales | Disparar el SOS (lo hace el servidor) |
| `Lock` | Calculadora o teclado de PIN; PIN de coacción (avanzado); bloqueo al salir o al apagar la pantalla | |
| `Contacts` | Par X25519 por contacto, QR o enlace, olvido de la clave privada | Guardar números |
| `AI` (opcional; después de F2) | STT e IA a través de la API | Tocar la evidencia |
| `Recovery` (avanzado, o base si se activó en M10; decisión 48) | Deriva las claves del código; lista incidentes, "Estoy bien", revocar el teléfono, programar o deshacer borrados | Grabar |

**Bases locales:**
- `legal.db`, en claro: es ley pública.
- `vault.db`, con **SQLCipher** y clave en el Keystore: incidentes, etiquetas de contactos y, si el pico lo confirma, la cola de sobres (si no, archivos cifrados con una clave del Keystore). Si alguien extrae la memoria del teléfono en un laboratorio, no puede leerla sin el Keystore de ese teléfono.

**Formato de audio:** AAC-LC mono a 16 kHz, unos 32 kbps (unos 14 MB por hora). Se valida en el pico técnico de F2, igual que la duración del fragmento (decisión 29).

**Superficie de la API** (borrador para F1):
- **Firma de las peticiones del dispositivo:** firma ECDSA (P1363) sobre una cadena canónica: prefijo de versión, método, ruta sin query, hora, idPeticion, idDispositivo y hash del cuerpo. La hora debe estar dentro de una ventana de ±5 min (decisión 39).
- **Peticiones del dispositivo:**
  - `POST /v1/devices` (registro de la clave pública)
  - `POST /v1/incidents` (país, claves envueltas, metadatos cifrados)
  - `PUT /v1/incidents/:id/chunks/:seq` (→ acuse firmado)
  - `POST …/close`
  - `POST …/timer` (armar, extender, desarmar)
  - `POST …/sos` (disparar o cancelar)
  - `POST|DELETE …/deletion` (programar o deshacer)
  - `GET /v1/incidents/:id/chunks/:seq` (lectura firmada con la clave de lectura; decisiones 42 y 60)
  - `GET /v1/incidents/:id/status` (estado del aviso y registro de accesos)
  - `POST /v1/contacts`, `GET /v1/contacts` (estado, canal y último acceso) y `DELETE /v1/contacts/:id`
  - `POST /v1/contacts/:id/test`
  - `PUT /v1/devices/me/silence` (activar, pausar o apagar el aviso por falta de señales)
  - `POST /v1/devices/me/heartbeat` (latido; cualquier otra petición con firma de petición de un teléfono no revocado también cuenta como señal; decisiones 39 y 49)
  - `POST /v1/stt` y `POST /v1/advise` (opcionales; después de F2, decisión 59)
- **Bóveda** (rutas constantes; el `accessId` y la prueba de posesión van en cabeceras, con límite de peticiones por `accessId`; decisión 43):
  - `GET /v1/vault` (incidentes visibles y la clave envuelta para ese contacto; cada llamada con prueba válida deja una fila sin IP en el registro de accesos)
  - `GET /v1/vault/chunks/:incident/:seq`
  - `POST /v1/vault/open` (apertura explícita tras descifrar: es el acuse del aviso)
  - `POST /v1/vault/subscribe`
  - `POST /v1/vault/extend`
- **Recuperación** (firmada con la clave Ed25519 del código): `GET /v1/recovery/incidents`, `GET /v1/recovery/incidents/:id/chunks/:seq`, `POST /v1/recovery/ok` ("Estoy bien"), `POST /v1/recovery/revoke` (revocar el teléfono) y `POST|DELETE /v1/recovery/deletion`.
- **Límites por dispositivo:** cuota de almacenamiento, pruebas de alerta por día y peticiones por minuto, para que nadie llene R2 ni use el bot para molestar a terceros.
- **Telegram:** `POST /tg/<ruta-secreta>`.
- **Cron (cada minuto):** dispara los temporizadores vencidos y los avisos por falta de señales, repite los avisos que nadie abrió (a los 10 y a los 30 min) y ejecuta los borrados que tocan. Usa transiciones condicionales en batch y una tabla de entregas con reintentos, y una restricción única impide dos avisos del mismo tipo para el mismo incidente o teléfono (decisión 41).

**D1** (borrador): `devices` (con la hora de la última señal, el umbral del aviso, la fecha de fin de la pausa, la revocación y la clave pública de recuperación), `contacts`, `incidents`, `chunks`, `wrapped_keys`, `blobs` (metadatos y transcripciones cifradas), `alerts` (tipo, creación, envío por canal y primera apertura), `deliveries` (entregas con reintentos), la tabla anti-reenvío (filas de 10 min) y `vault_access_log` (sin IP). Ver la sección Seguridad para saber qué guarda y qué no.

**Ollama:** túnel privado; el Worker es el único cliente, autenticado con un token de servicio. Nada queda expuesto en público.

## Evidencia y cifrado

| Clave | Dónde vive | Para qué |
|---|---|---|
| Dispositivo (ECDSA P-256) | Keystore, no se puede exportar | Identidad ante la API y firma de cada fragmento |
| Incidente `K` (AES-256) | Memoria nativa | Cifrar fragmentos, metadatos y transcripciones |
| Contacto (X25519) | Privada solo en su QR o enlace; el teléfono guarda la pública | Que ese contacto descifre `K` |
| Recuperación (X25519 y Ed25519; avanzado, o base si se activó en M10) | Derivadas en software del código de 24 caracteres con HKDF-SHA256; el teléfono guarda la pública X25519 y el servidor, la pública Ed25519 | X25519: acceso de la persona dueña con el teléfono de solo escritura. Ed25519: firmar desde otro teléfono "Estoy bien", revocar el teléfono perdido y programar o deshacer borrados |
| Lectura (ECDSA P-256) | Keystore, con `setUnlockedDeviceRequired` | Firmar las lecturas de lo ya respaldado (decisión 60) |
| Local (X25519, base) | Privada cifrada con una clave que sale de HMAC_Keystore(PIN) | Envolver `K` en el teléfono para poder reproducir: grabar no pide el PIN; escuchar, sí (decisión 60) |
| Servidor (ECDSA P-256, con `kid`) | Secreto del Worker | Firmar los acuses (sello de tiempo); sus públicas van fijadas en la app y en la bóveda |

- **Envoltura:** `K` se envuelve con **HPKE** (RFC 9180: DHKEM-X25519, HKDF-SHA256, AES-256-GCM) para cada contacto y, si hay código de recuperación (siempre en avanzado; en base, si se activó en M10), para la clave de recuperación; al activarlo en base, el teléfono envuelve también las `K` que conserva (decisión 48). El servidor no puede fabricar una envoltura válida porque no conoce las claves públicas de los contactos.
- **Sobre de cada fragmento (todo en RAM):**
  ```
  p   = SHA-256(audio)
  ct  = AES-256-GCM(K, nonce aleatorio de 96 bits, aad = "vigia/v1"‖"ct"‖incidente‖seq)
  loc = AES-256-GCM(K, otro nonce, aad = "vigia/v1"‖"loc"‖incidente‖seq, {lat, lon, precisión_m, hora_fix})
  r   = {v, incidente, seq, hora_teléfono, p, c = SHA-256(ct), loc, prev = SHA-256(r_anterior)}
  s   = firma_dispositivo(prefijo de registro ‖ bytes canónicos de r)
  → al disco solo va ct + r + s
  ```
  La cadena empieza en un registro de apertura firmado que lleva el `country_code` del incidente (decisión 39).
  `loc` solo va si la ubicación está activada y hay una posición nueva desde el fragmento anterior; si no, se omite y la bóveda muestra el hueco.
- **Servidor:**
  1. Comprueba `s`, que `c` coincida y, si el anterior ya está, que `prev` encadene; acepta fragmentos fuera de orden y marca las bifurcaciones (decisión 40).
  2. Guarda `ct` en R2, con una clave que construye el propio servidor tras comprobar el dueño del incidente, y `r+s` en D1. Escritura única.
  3. Responde con un **acuse firmado** `{prefijo, kid, SHA-256(r), hora_servidor}` cuando R2 y D1 confirman. Ese acuse es el sello de tiempo verificable, y el teléfono lo verifica antes de borrar su copia.
  4. Lo que llega después del SOS se marca **"posterior a la alerta"**: quien tiene el teléfono confiscado también puede firmar. No se marca si su hash ya lo fijaban antes de la alerta el `prev` del siguiente o el cierre.
- **Cierre:** un registro final firmado `{último seq, hash final}`; después, un `seq` mayor se rechaza con 409. Hasta su acuse, el teléfono muestra "cierre pendiente de confirmar". Si falta, la bóveda dice "el teléfono dejó de enviar a las HH:MM", salvo en un SOS sin grabación.
- **Enlace del contacto:** `#a=<accessId>&k=<privada>&d=<huella del dispositivo>`. La huella fija la identidad del teléfono, así que un servidor comprometido no puede colar evidencia ajena.
- **Verificación en la bóveda** (código de `shared`): firmas, cadena, `c`, y `p` después de descifrar. Muestra "✓ N fragmentos, cadena íntegra, firmados por el dispositivo, recibidos entre HH:MM y HH:MM".
- **Especificación pública de verificación** y verificador abierto, para que un tribunal pueda entender el sistema.

## Flujos críticos y errores

**A. Grabar.**
1. Toque en Grabar (en VE, antes PIN + "=").
2. Arranca el servicio de micrófono, con notificación neutra y 1 vibración corta.
3. Lo primero que sale cuando hay red es la apertura del incidente, que es lo que arma el temporizador. Después, cada fragmento se guarda como sobre cifrado y la cola de subida (Kotlin) lo sube.
4. Detener pide el PIN y desarma el temporizador. Sin red, el cierre queda "pendiente de confirmar" y lo que falte se sigue subiendo.
5. Si la app muere, se pierde el fragmento en curso y el incidente queda "interrumpido a las HH:MM". Si te quitan o destruyen el teléfono, se pierde además todo lo que no se subió: por eso M2 dice "Respaldado hasta HH:MM:SS".
6. La ubicación (si se activó) se pide cada minuto mientras graba, solo con el permiso "mientras se usa". Cada fragmento lleva la posición nueva, si la hay; sin posición no se inventa ninguna.

**B. Temporizador.**
1. Se arma cuando el servidor se entera de la grabación; el reloj cuenta desde ese momento.
2. Recordatorio 5 min antes, con 2 vibraciones largas.
3. Extender (+30 min) es un toque sin PIN, como mucho 2 veces seguidas: la tercera pide el PIN, y el PIN de coacción finge extender y dispara el SOS en silencio. Sin red, la extensión se muestra pendiente y el recordatorio local usa el plazo confirmado (decisión 50). "Estoy bien" pide el PIN; con el PIN de coacción finge desarmar.
4. En modo avanzado también habrá temporizador de trayecto (después de F2; aún sin diseño).
5. Al vencer, el cron dispara el SOS.
6. Que sigan llegando fragmentos no extiende ni desarma nada: el teléfono puede tenerlo otra persona. Solo cuentan las órdenes firmadas de extender o desarmar.
7. Si el servidor se entera de un incidente que ya se cerró y desarmó con el PIN (todo ocurrió sin red), no arma nada y lo registra como "conocido después de terminar".
8. Si el cron estuvo caído, al volver dispara lo vencido y la bóveda dice "Aviso enviado con N min de retraso por un fallo nuestro". Si un desarme hecho sin red llega después de la alerta, los contactos reciben la cancelación con las dos horas.

**C. SOS manual.**
1. Mantener 3 s → cuenta atrás de 5 s → disparo. Sin red queda en cola, y cuando el servidor confirma, 3 vibraciones largas.
2. Cancelar pide el PIN real, y los contactos que recibieron la alerta reciben "la alerta se canceló".
3. Con el PIN de coacción, el teléfono muestra "cancelada" pero el SOS sigue.
4. Las claves se envuelven desde el inicio, pero **el servidor solo muestra el incidente a los contactos si hay SOS**.
5. Sin grabación, el SOS crea un incidente sin audio que no arma el temporizador. Grabar con esa alerta activa continúa el mismo incidente, y el SOS sale el primero de la cola (decisiones 42 y 53).

**D. Alta de contacto** (requiere red; máximo 3).
1. Se generan el par de claves y el `accessId`. El servidor registra el hash con caducidad de 48 h y se muestra el QR.
2. El contacto escanea → W1 → elige Telegram o Web Push → su navegador guarda la clave en IndexedDB → abre también el enlace del segundo host, que guarda su propia copia → Probar alerta (decisión 43).
3. El teléfono muestra "✓ listo" y olvida la clave privada.
4. Revocar invalida el enlace y borra su canal; los incidentes nuevos ya no se envuelven para ese contacto. Si el navegador es contacto de otras personas, la suscripción push compartida sigue: solo se da de baja cuando no queda ninguna entrada (decisión 43).

**E. Sincronización y censura.**
1. Ante errores de red, rotación entre hosts: `<host-api>` (workers.dev) → `<host-respaldo>` (pages.dev) → un segundo nombre de respaldo, con DNS cifrado de varios resolvedores (decisión 44).
2. Si todos fallan durante un rato: "No podemos llegar al servidor. Tu evidencia está segura en el teléfono. Si tu red bloquea sitios, prueba una herramienta anticensura."

**F. Entrega de avisos** (cualquier tipo; decisión 32).
1. Un aviso por incidente (o por teléfono) y por tipo. Va a todos los contactos a la vez, sin contenido.
2. Si nadie lo abre en 10 min, se repite; y otra vez a los 30 min. Después, la cronología dice "Nadie lo abrió todavía".
3. Descifrar en la bóveda cuenta como acuse (un POST explícito; pedir la página no cuenta). Los demás contactos ven "Otro contacto lo abrió a las 14:12", sin nombres. Que lo abran no significa que la persona esté bien.
4. Las novedades (cancelada, señal recuperada, "Estoy bien" desde otro teléfono) van a la cronología y, como "Hay novedades", a los contactos que recibieron la alerta (decisión 41), como mucho una vez cada 10 min. Si la entrega de la alerta a un contacto seguía pendiente, se le envía una sola vez "Tienes un aviso" con el estado final, nunca solo "Hay novedades".

**G. Aviso por falta de señales** (opcional y apagado; decisión 31).
1. Se activa en M10 con un umbral de 12, 24 o 48 h. La activación vale cuando el servidor la confirma.
2. El teléfono manda un latido cada hora (WorkManager; Android puede retrasarlo) y cualquier petición con firma de petición de un teléfono no revocado cuenta como señal. El servidor guarda solo la hora de la última y, si hay pausa, su fecha de fin (decisión 56), sin historial ni ubicación.
3. Si el aviso está activo y el teléfono no consigue red, un recordatorio local 2 h antes del umbral dice que tus contactos recibirán el aviso.
4. Al vencer, el cron avisa a los contactos (W4); esa vista caduca a los 7 días, ampliables, como el resto. Cuando vuelve una señal reciben "volvió a dar señales", que no confirma que la persona esté bien.
5. "Pausar hasta" una fecha sirve para viajes sin red. Mientras el servidor no la confirma, la pantalla dice "Pausa pendiente: si no llega al servidor, el aviso sigue activo".
6. Límite: si quien tiene el teléfono lo deja encendido y con red, este aviso no salta. Para eso está el temporizador del incidente.

**H. Recuperar con código** (avanzado, o base si se activó en M10; decisiones 33 y 48).
1. En otro teléfono, "Tengo un código de recuperación" → se escriben los 24 caracteres → se derivan las claves X25519 y Ed25519.
2. Se pueden ver los incidentes, decir "Estoy bien" (cancela una alerta activa si la clave ya tenía poderes cuando empezó; una clave creada después de la configuración inicial no tiene poderes durante 72 h, decisiones 47 y 48; los contactos lo ven como "con su código, desde otro teléfono"), revocar el teléfono perdido y programar o deshacer borrados.
3. Revocar no borra evidencia: el servidor rechaza las órdenes, lecturas y aperturas nuevas de ese teléfono, sus peticiones dejan de contar como señal y cancela los borrados pendientes que programó. Solo acepta fragmentos y cierre de incidentes ya abiertos, marcados "recibido después de la revocación" (decisión 49).
4. Quien tenga el código puede hacer lo mismo. Por eso se guarda lejos del teléfono.
5. Para grabar en el teléfono nuevo se hace la configuración normal y se vuelve a dar de alta a los contactos.

**I. Exportar paquete** (decisión 34).
1. M8 → PIN → "Exportar paquete": audio, registros, firmas, acuses e instrucciones de verificación, igual que el paquete que descarga un contacto.
2. Se genera en la caché privada de la app, sale por la hoja de compartir de Android y se borra al terminar.
3. Antes de compartir: "Quien lo reciba y la app que uses podrán verlo".

**Errores diseñados** (ninguno es silencioso):
| Situación | Respuesta |
|---|---|
| El fabricante cierra servicios (Xiaomi, Samsung…) | Paso de configuración para excluir del ahorro de batería. Si el servicio muere: "Tu teléfono cerró la grabación a las HH:MM" y guía |
| Llamada entrante u otra app que toma el micrófono | Se marca el hueco en el registro y se retoma la grabación |
| Poco espacio o almacenamiento lleno | Aviso previo con los minutos que quedan. Al llenarse se detiene limpio, se conserva lo grabado y se avisa. Nunca se borra evidencia sin respaldar para hacer sitio |
| Permiso revocado | Banner con arreglo de un toque |
| El servidor rechaza un sobre | No se borra: se marca y se reintenta. Nunca se descarta en silencio |
| Sin contactos | Aviso permanente en Inicio |
| La IA cita mal o tarda | Se descarta y se muestra el resultado offline |
| Nadie abre el aviso | Se repite a los 10 y a los 30 min; la cronología dice "Nadie lo abrió todavía" |
| El servidor o el cron estuvieron caídos | Al volver se dispara lo vencido y el retraso se declara como fallo nuestro, nunca como algo que le pasó a la persona |
| La pausa del aviso por falta de señales no llega | "Pausa pendiente: si no llega al servidor, el aviso sigue activo" |

## Interfaz CountryPack

```ts
// packages/shared/src/countryPack.ts
export type CountryCode = 'VE' | 'CO';                  // ISO 3166-1 alfa-2; crece con cada pack

export type Situation =                                 // claves de código; el texto lo pone el pack
  | 'stop' | 'search' | 'phone' | 'documents' | 'bribe' | 'detention'
  | 'border';                                           // trochas: solo pautas de seguridad física
  // 'protest' se añade cuando el pack CO la necesite (F3)

export type CopyKey = 'checkpoint' | 'securityForces' | 'idDocument'; // crece cuando la UI lo necesite

export interface CountryPack {
  code: CountryCode;
  name: string;                                         // "Venezuela"
  version: string;                                      // semver del CONTENIDO del pack
  mcc: string[];                                        // ['734'] VE, ['732'] CO → pista de país
  status: 'draft' | 'validated';
  validation?: {                                        // obligatorio si status = 'validated'
    date: string;                                       // ISO 8601
    role: string;                                       // "Abogado/a colegiado/a, práctica penal y DDHH"
    attestation: string;                                // id de la constancia firmada, guardada FUERA del repo
  };
  sources: { id: string; title: string; officialRef: string; url?: string; retrieved: string }[];
  laws: { id: string; sourceId: string; article: string; text: string }[];   // → semilla FTS5
  cards: {
    id: string;
    situation: Situation;
    title: string;                                      // la pregunta: "Me paran en una alcabala"
    can: string[];                                      // ▭ Puedes
    cannot: string[];                                   // ⊘ No están autorizados a
    careful: string[];                                  // ◇ Cuidado
    lawIds: string[];
  }[];
  promptContext: string;                                // marco legal para Vigía IA (validado)
  contactTypes: { id: string; label: string }[];        // familiar, abogado/a, organización
  contactGuide: string[];                               // qué hacer si llega la alerta (lo muestra la bóveda)
  recordingNote: string;                                // ¿es legal grabar a la autoridad?, en lenguaje llano
  threat: {
    summary: string;
    defaults: { camouflage: boolean; suggestAdvanced: boolean };  // solo pueden endurecer
  };
  copy: Partial<Record<CopyKey, string>>;               // alcabala/retén, cuerpos de seguridad, documento
}
```

> **Cambio respecto a lo aprobado en la sección 4:** la tarjeta pasa de `say` y `avoid` a `can`, `cannot` y `careful`, para encajar con las 3 bandas de señal aprobadas en la dirección visual. Se añade `border` por la decisión 6.

**Validador único** (`shared`). Corre en las pruebas, en el build y al cargar el pack en la app:
- Si es `validated`, debe existir `validation`.
- Los IDs son únicos. Cada `lawIds` existe en `laws` y cada `sourceId` existe en `sources`.
- Debe haber tarjetas al menos para `stop`, `search` y `detention`.
- Toda tarjeta, salvo `border`, tiene al menos un `lawId`.
- `threat.defaults` solo activa protecciones: los valores globales son `false` y el pack solo puede subirlos a `true`.
- **Release:** el build falla si algún pack va en `draft`.
- **Dev:** los packs en `draft` muestran "BORRADOR: no validado" en cada pantalla de derechos.

**Carga:** los packs van dentro de la app. Si cambia la versión, `PackLoader` valida y reconstruye `legal.db` (FTS5, tokenizador `unicode61 remove_diacritics 2`). Cambiar de país funciona al instante y sin red.

**Prompt de Vigía IA** = plantilla global (en el código) + `promptContext` + los artículos recuperados por FTS5.
- La plantilla fija las reglas: seguridad física primero, nunca instigar, 1 o 2 frases, citar solo los IDs recibidos.
- El Worker comprueba que las citas pertenezcan al conjunto entregado; si no, descarta la respuesta.
- No hay artículos escritos a mano en el prompt.

**Proceso de firma:**
1. Un script genera un export legible del pack: leyes, tarjetas, contexto del prompt, guía, nota de grabación y perfil de amenaza.
2. El/la abogado/a lo revisa y lo firma.
3. La constancia se guarda **fuera del repo**; en VE, sin su identidad.

Perfil que se busca en cada país: un/a abogado/a colegiado/a con práctica penal y de DDHH y, como recomendación y no como bloqueo, una organización local de seguridad digital que revise el perfil de amenaza. Los nombres de las candidatas no se escriben en este repositorio, que es público: aparecer ligadas al proyecto antes de aceptar podría perjudicarlas. Ver "Identidades de quienes participan" (sección Seguridad).

**Fuera de alcance, a propósito:** packs por OTA, sub-jurisdicciones, herencia entre packs, varios idiomas y temas visuales por país.

## Seguridad: qué sale del teléfono

| Dato | Destino | Cuándo | ¿En claro? |
|---|---|---|---|
| Fragmentos cifrados, registros firmados (con las posiciones cifradas, si activas la ubicación), metadatos cifrados | Cloudflare (R2/D1) | Siempre que hay red | No (E2EE) |
| Clave pública e ID aleatorio del dispositivo; estado del temporizador, del SOS y de cada aviso (enviado, abierto) | Cloudflare D1 | Al registrarse y al grabar | Sí, pero no identifican a nadie |
| Hora de la última señal (se sobrescribe, sin historial) y, si pausas el aviso, la fecha de fin de la pausa | Cloudflare D1 | Cada hora, aproximadamente, **solo si activas el aviso por falta de señales** | Sí, pero no identifica a nadie |
| `chat_id` de Telegram y suscripción push del contacto | D1, **cifrados en reposo** con un secreto del Worker; se borran al revocar | Alta del contacto | No en la base de datos |
| Aviso sin contenido ("alerta activa, abre tu enlace") | Telegram / servicio push | SOS y pruebas | Sin datos |
| **Audio en claro** | **Groq (EE. UU.)**, a través del Worker, sin guardarse | **Solo con la transcripción activada** | **Sí: un tercero** |
| Texto y artículos | Ollama propio, por túnel privado | Solo con la IA activada | Sí, en servidor propio |
| IP | Red de Cloudflare | Cada conexión | No se guarda en nuestros logs |
| Nombre del servidor al que te conectas (SNI) | Tu operadora | Cada conexión | Sí: por eso los hosts tienen nombres neutros (decisión 44) |
| Avisos push de tus contactos | Google, Apple o Mozilla (según su navegador) | Cuando hay un aviso | Sin contenido |
| Paquete exportado (audio, registros, firmas y acuses) | Quien tú elijas | Solo si lo exportas | Sí: lo decides tú |
| Nada | Google / Firebase | Nunca | - |

**Lo que obtendría una orden judicial o una brecha en nuestro servidor:** claves públicas, horas, país, número y tamaño de fragmentos, eventos del temporizador, del SOS y de los avisos, la hora de la última señal y la fecha de fin de la pausa (solo de quien activó ese aviso), identificadores de canal cifrados y el registro de accesos (sin IP). **Ni audio, ni texto, ni ubicación, ni alias, ni números de teléfono.** Esta tabla se muestra también en la app (M10 → "Qué sale de tu teléfono").

**Quién ve qué:**

| Dato | Persona | Contactos (máx. 3) | Equipo de Vigía | Validador/a legal |
|---|---|---|---|---|
| Audio, transcripción y posiciones | Sí (base: con el PIN y, si activó el código, también con él; avanzado: con el código) | Solo de incidentes con SOS y mientras el enlace no caduque | Nunca: van cifrados | No |
| Temporizador, avisos y hora de la última señal | Sí | Cuando hay un aviso | Sí: lo necesita para avisar | No |
| Registro de accesos a la bóveda | Sí | Sí, en el paquete | Sí | No |
| Quién es la persona | Sí | La conocen fuera de la app | No: solo una clave pública | No |
| Contenido del pack | Sí | La guía del país | Sí | Lo revisa y lo firma |

**Identidades de quienes participan.** Este repositorio es público. En él (documentos, código, issues y mensajes de commit) nunca se escriben nombres ni contactos de quienes validen, colaboren, investiguen o informen sobre Vigía (abogados, organizaciones, periodistas, personas del equipo o del piloto), salvo que la persona lo pida por escrito. Esos datos viven en un registro privado fuera del repositorio y se comparten solo por un canal cifrado. Las citas de informes públicos sí pueden ir. Quien hace commits queda visible en el historial con su cuenta y su correo, así que conviene usar el correo noreply de GitHub.

**Lecciones incorporadas de herramientas previas:**
1. **Máximo 3 contactos** (Panic Button de Amnistía): son "respondedores preparados", y limitar el número reduce cuánta gente queda expuesta si la app cae en malas manos.
2. **La guía del país en W1, antes de cualquier alerta** (el plan acordado con los contactos fue lo que más valoraron los usuarios de Panic Button).
3. **Bloqueo de la interfaz también mientras graba** (Tella no se bloquea con la grabadora abierta).
4. **Bot de Telegram con nombre neutro y mensajes sin "Vigía"**: en VE también revisan los teléfonos de los contactos.
5. **Fragmentos "posteriores a la alerta"** (ProofMode: con el teléfono confiscado, la clave de firma ya no es fiable).
6. **Registro de accesos a la bóveda** en el paquete, legible como cadena de custodia (Ley 906, art. 254; eyeWitness registra quién accede).
7. **Especificación pública de verificación y verificador abierto** (en el caso de RDC de 2018, las partes pueden exigir que se explique cómo funciona la tecnología).
8. **DNS cifrado con varios resolvedores** (en VE están bloqueados los DNS públicos de Google y de Cloudflare).

**Cabeceras de la bóveda** (en todas sus respuestas):
- `Content-Security-Policy` estricta: solo `self`, sin `unsafe-inline` ni `eval`, `frame-ancestors 'none'`, con Trusted Types.
- `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `nosniff`, COOP, CORP, Permissions-Policy y `no-store`.
- Los blobs y el JSON llevan su tipo exacto y CSP `default-src 'none'; sandbox`.
- Sin cookies y sin scripts de terceros.

## Pruebas y criterios de aceptación

**Lógica crítica con TDD** (Vitest y JUnit):
- sobre, cadena y verificador (un único formato con vectores compartidos; si la app verifica en Kotlin, lo decide el pico);
- interoperabilidad HPKE entre Kotlin y JS con vectores de prueba;
- validador de packs, con las mismas pruebas para VE y CO;
- LegalEngine con casos de prueba por pack;
- cola de subida (Kotlin) con reloj virtual (prioridad, backoff y rotación de hosts);
- cron del temporizador (D1 local);
- borrado diferido y candado de R2.

**Kotlin:**
- pruebas unitarias del corte ADTS: los fragmentos unidos tienen que dar el audio exacto;
- pruebas en **teléfonos reales de gama baja de al menos 3 fabricantes con ahorro de batería agresivo**: 30 min con la pantalla apagada, modo de reposo (Doze), llamada entrante, ubicación cada minuto y las duraciones de fragmento que fije el pico.

**E2E de la app (Maestro):** configuración inicial, grabar, SOS, coacción y señuelo, borrar y deshacer, cambio de país, exportar paquete, recuperar con código y revocar, y aviso por falta de señales.

**E2E de la bóveda (Playwright):**
- descifrar y verificar;
- detectar evidencia manipulada;
- enlaces caducados, revocados y sin clave;
- una transcripción con `<script>` se muestra como texto;
- "Ver prueba";
- de 320 px a escritorio, sin scroll horizontal.

**Revisión de seguridad** al cerrar cada fase.

**Casos añadidos desde Acompáñame** (sus códigos entre paréntesis):
- Empezar sin red: nada dice "el servidor lo sabe" hasta el acuse (QA-02).
- Red intermitente: reintentos sin duplicados ni huecos falsos (QA-03, QA-04).
- Teléfono destruido: lo que tenía acuse está en la bóveda y lo demás figura como no respaldado (QA-05).
- App cerrada a la fuerza: la cola se recupera y el hueco queda marcado (QA-06).
- Llegan fragmentos después del vencimiento: no extienden ni desarman (QA-15).
- Cierre sin red: "cierre pendiente" hasta el acuse (QA-16).
- Desarme y vencimiento casi a la vez: un único resultado; si la alerta salió, los contactos reciben la cancelación (QA-14, QA-24).
- Cron caído 10 min: al volver dispara lo vencido y declara el retraso (QA-25).
- Inicio y cierre llegan juntos más tarde: no se arma nada ni se finge vigilancia (QA-10, QA-26).
- Incidente ajeno pedido con prueba válida: 404 y fila en el registro de ese contacto; `accessId` sin prueba válida: el mismo 404, sin fila (QA-19, decisión 43).
- La IA falla: la grabación y la subida siguen (QA-20).
- Poco espacio, batería baja o sin GPS: la pantalla lo dice (QA-23).
- Aviso por falta de señales: vence, se repite si nadie lo abre y avisa cuando vuelve la señal (QA-09, QA-11, QA-12).
- Recuperar con código: "Estoy bien" y revocación; el teléfono revocado ya no puede cancelar ni borrar.

**Métricas del piloto** (decisión 37). Son objetivos iniciales que el piloto calibra:
- Arranque: la grabación empieza en menos de 2 s en el 99 % de los intentos.
- Respaldo: con 3G, "Respaldado hasta" va como mucho 2 fragmentos por detrás el 95 % del tiempo.
- Integridad: 0 fragmentos con acuse que falten en R2 y 0 duplicados.
- Avisos: del vencimiento a la entrega en Telegram, menos de 2 min en el 95 % de los casos.
- Batería: 1 h de grabación con la pantalla apagada gasta como mucho el 8 % en el gama baja de referencia.
- Falsas alarmas del aviso por falta de señales: proporción de avisos seguidos de una señal nueva en menos de 6 h. Si pasa del 10 %, se sube el umbral sugerido.

Se mide con contadores agregados en el Worker, sin ID de dispositivo, y con pruebas de campo en teléfonos del equipo. No hay telemetría por persona.

**Aceptación de F2 de punta a punta en un Android real:**
1. 2 min de grabación sin red.
2. Sincronización.
3. Se deja vencer el temporizador.
4. Llegan los avisos por Telegram y Web Push.
5. La bóveda reproduce y verifica.
6. Además se prueban: el camino de coacción, el borrado diferido, el host de respaldo con el principal bloqueado y un fragmento posterior a la alerta marcado.

**F3:** las mismas pruebas del motor, ahora para CO, sin código nuevo.

## Riesgos abiertos y preguntas para F1 y F3

- **Custodio que pueda testificar** (persona u organización). El valor judicial lo aporta el custodio, no solo el hash (eyeWitness).
- **Anclaje externo de los sellos de tiempo:** OpenTimestamps en VE (SUSCERTE es del Estado) y una entidad acreditada por ONAC en CO (Ley 527). Fuera de la v1.
- **Que Web Push llegue en VE no está verificado:** prueba de campo en F2. Telegram es el canal de respaldo.
- **Sostenibilidad:** Panic Button se retiró por falta de fondos y de soporte. Hace falta un plan de mantenimiento. Se planteó cobrar por uso; queda fijado que grabar, derechos, SOS, avisos y bóveda nunca se cobran (choque C7).
- **Riesgo aceptado (decisión 13):** el nombre "Vigía" se ve en ajustes, en la cabecera de la notificación y en el indicador del micrófono.
- **Distribución:** Play Store (declarar el servicio en primer plano de micrófono) y APK firmado. Hay que publicar la huella del certificado para que se detecten APK falsos, y custodiar la clave de firma fuera del repo (decisión 62).
- **CO:** ¿trato de tú o de usted? Se decide con la validación local en F3.
- **iOS:** recorte por documentar (disparo en segundo plano, cambio de icono con alerta y nombre fijo).
- **Pico técnico de F2:** AAC a 16 kHz en MediaCodec en gama baja; SQLCipher y FTS5 juntos en op-sqlite; WebCrypto X25519 en los navegadores de los contactos (la bóveda no usa Ed25519); duración del fragmento (2, 4 u 8 s) y consumo con la ubicación cada minuto.
- **Validadores:** reclutar y proteger a quien firme en VE.
- **Falsas alarmas del aviso por falta de señales** (apagones, viajes sin red): por eso va apagado, con umbral a elegir, pausa y recordatorio local. Se miden en el piloto.
- **Retención:** la evidencia se guarda hasta que la persona la borra. Decidido en F1 (decisión 57): ningún borrado automático de incidentes de teléfonos inactivos en la v1 ni en el piloto.
- **Límites declarados en F1:**
  - la cuenta de Cloudflare es la raíz de confianza: quien la controle puede servir una bóveda que robe las claves de los contactos. La vía independiente es el paquete descargado más el verificador abierto, y la bóveda reproducible llega antes del piloto;
  - cada host que guardó claves de contactos también es raíz de confianza: un proyecto o subdominio que sirvió la bóveda nunca se borra ni se renombra, porque otra persona podría registrar el mismo nombre; al retirarlo, sirve solo una página que borra el almacenamiento;
  - el APK publicado revela los hosts a quien lo desensamble;
  - visitar la página de presentación delata el interés ante la operadora (SNI); la app nunca se conecta a ella;
  - si workers.dev y pages.dev quedan bloqueados a la vez en VE, no hay respaldo sin un dominio propio;
  - la visita con la clave en el enlace puede quedar en el historial del navegador del contacto (se mide en F2);
  - Safari y los navegadores WebKit borran la clave del contacto tras 7 días sin abrir el enlace: quien no guardó el enlace pierde el acceso hasta que se le reinvite;
  - el paquete descargado nombra a Vigía en sus instrucciones de verificación;
  - un APK de pruebas en manos de una persona real expondría su evidencia al equipo (decisión 58);
  - con root, el PIN de modo base se puede probar por fuerza bruta contra el Keystore del teléfono: la envoltura con el PIN (decisión 60) sube el coste, no lo impide;
  - en modo base, el PIN no es una barrera criptográfica ante un forense con root para `vault.db` (incidentes, etiquetas de contactos y cola): su clave está en el Keystore sin depender del PIN (se valora `setUnlockedDeviceRequired`);
  - el señuelo deja huellas que la app no controla: tamaño de los datos en Ajustes, panel de privacidad, "Apps activas", batería y datos por app;
  - aceptar los sobres de un teléfono revocado le revela la revocación a quien lo tiene;
  - si la cola no funciona antes del primer desbloqueo, tras un reinicio nada sube hasta que la persona desbloquea el teléfono (se decide en F2).
- **Paquete exportado:** una vez fuera, su seguridad depende de la app por la que se envíe. La app lo advierte antes de compartir.

## Referencias

**Mobbin** (iOS y web; se adaptan a Material 3):
- Grabación: Apple Notes https://mobbin.com/flows/6ef47959-5bcd-4515-bd9f-13d49e698189 · Givingli https://mobbin.com/screens/2ba9b754-8a8f-4ad7-b5bb-776915983e60
- SOS: Life360 "Setting up SOS" https://mobbin.com/flows/bae08173-c753-4fbb-a50a-dd6f99ae0b9d · Oura, cuenta atrás https://mobbin.com/screens/04714b1c-e796-43a3-adf0-cfcfa226bcbc · Citizen "Live Activities" https://mobbin.com/flows/b0d51eb5-81f4-402a-810b-872a2df4be6c
- Contactos: DoorDash Dasher https://mobbin.com/flows/e92ae189-270c-454f-a88a-8a5f23cad58d · Life360 https://mobbin.com/flows/cb4a5e5d-591d-411b-aaac-d5b25e163f95 · Flighty https://mobbin.com/flows/5a3cb4a9-72c5-40eb-9ec4-d091d072dc2f
- País y permisos: Oura "Why we ask" https://mobbin.com/flows/a716ee90-005d-49b5-9e93-abfc4c2f833c · Klarna https://mobbin.com/flows/65b3934e-4537-48e8-afe6-755627983a81 · DoorDash permisos https://mobbin.com/screens/69634294-5fda-4c41-ba8d-7590705e627e
- Tarjetas: State Farm https://mobbin.com/flows/376c7451-16bb-4fd6-92e7-ab63a6deba7e · Check https://mobbin.com/screens/f3cea10b-9c23-40e2-bedd-f60719a89580 · Wysa https://mobbin.com/screens/9f571ed5-a740-4b8d-83d2-44d0da489d30
- PIN: Revolut https://mobbin.com/flows/b3c2b6da-8cb9-4312-8112-12bb74cb7ce8 · Vipps https://mobbin.com/screens/893a9846-5bae-4cc0-bc2c-76a9fff210f1
- Privacidad: Signal https://mobbin.com/screens/0a093fbf-72b7-40c7-aa15-4c1a0078bd5d · ANZ Plus https://mobbin.com/screens/199ff93e-b64a-48ca-99c9-a39624246a9a
- Sincronización: GoPro Quik https://mobbin.com/screens/d9d1710a-5585-42da-ae77-c4811a8ed7b0 · Alta (sin red) https://mobbin.com/screens/2b00c4b9-d2a6-4a6a-9d95-2aba49348be1
- Bóveda: WeTransfer https://mobbin.com/screens/bf74668e-4acf-4a77-b5d5-44dafdad1abe · NordLocker https://mobbin.com/flows/a24df14a-3212-48f5-9918-a14768c31f3e · enlace caducado https://mobbin.com/screens/dfa9ee24-160c-445b-b605-623b2f588d2b · incident.io https://mobbin.com/screens/0b441174-3405-416f-a142-dfbb383d21f9 · Amie https://mobbin.com/screens/c660e4c0-f122-428b-949d-8980d57b4527

**Estado del arte y contexto:**
- DFRLab y VE sin Filtro, *Watch the Watchers* (2026): https://dfrlab.org/wp-content/uploads/sites/3/2026/03/VSF-DFRLab-Watch-the-Watchers-v1-1.pdf
- Amnistía, *Security is community* (Panic Button): https://www.amnesty.org/es/wp-content/uploads/2021/05/ACT1021332015ENGLISH.pdf · retirada: https://www.theengineroom.org/panic-button-retiring-the-app/
- Tella: https://tella.app/features · eyeWitness: https://www.eyewitness.global/FAQS.html · ProofMode: https://proofmode.org/
- Lecciones de la RDC: https://www.justsecurity.org/76780/incorporating-digital-technology-in-the-investigation-of-international-crimes-lessons-from-the-democratic-republic-of-congo/
- WITNESS, *Ticks or It Didn't Happen*: https://lab.witness.org/wp-content/uploads/sites/29/2019/12/Ticks_or_it_didn%E2%80%99t_happen_WITNESS.pdf
- Protocolo de Berkeley (ACNUDH): https://www.ohchr.org/sites/default/files/2024-01/OHCHR_BerkeleyProtocol.pdf
- Ley 527 de 1999 (CO): https://normativa.colpensiones.gov.co/colpensiones/compilacion/docs/ley_0527_1999.htm
- Bucket locks de R2: https://developers.cloudflare.com/changelog/post/2025-03-06-r2-bucket-locks/
- Telegram, bots: https://core.telegram.org/bots · Web Push en iOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Android, trabajo periódico (puede retrasarse): https://developer.android.com/reference/androidx/work/PeriodicWorkRequest · servicios en primer plano iniciados desde segundo plano: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start · ubicación en segundo plano ("Permitir siempre"): https://developer.android.com/develop/sensors-and-location/location/permissions/background · declaración obligatoria en Google Play: https://support.google.com/googleplay/android-developer/answer/9799150
