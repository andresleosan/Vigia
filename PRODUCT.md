# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

- **Persona base:** ciudadano/a común en Venezuela (después Colombia) frente a un abuso de autoridad: alcabala o retén, requisa, revisión forzada del teléfono, extorsión, retención de documentos, detención arbitraria. A menudo va al volante. Está bajo estrés agudo, usa una mano, tiene un Android de gama baja o media y datos caros e intermitentes.
- **Persona de riesgo alto (modo avanzado, opcional):** activistas, periodistas, defensores y defensoras. Aceptan más configuración (PIN de coacción, teléfono de solo escritura, código de recuperación) a cambio de más protección.
- **Contactos de confianza (máximo 3):** familia, abogado/a u organización, muchas veces en la diáspora. Reciben el aviso por Telegram o Web Push y abren la bóveda web desde un enlace privado, sin cuenta.

## Product Purpose

Vigía graba evidencia de un abuso sin llamar la atención, dice tus derechos al instante sin red y, si dejas de dar señales, avisa sola a tu gente con evidencia verificable.

Éxito: en segundos la persona sabe qué decir y qué evitar; la evidencia sale cifrada del teléfono antes de que se lo quiten; y si la detienen, sus contactos se enteran y saben qué hacer.

## Positioning

Ninguna de las herramientas revisadas (Tella, ProofMode, eyeWitness, Mobile Justice, Panic Button) combina estas tres cosas:
1. evidencia cifrada de extremo a extremo, con hash encadenado, firma por fragmento y acuse firmado por el servidor;
2. un aviso que dispara el servidor cuando la persona ya no puede tocar el teléfono (temporizador);
3. derechos por país como datos validados por abogados locales.

## Operating Context

- Encuentros de 1 a 60 min en alcabalas, en la calle o en detenciones. En Venezuela la revisión del teléfono es habitual: en 29 de 58 casos documentados obligaron a desbloquearlo y en 14 se lo llevaron fuera de la vista (DFRLab y VE sin Filtro, *Watch the Watchers*, marzo de 2026).
- En Venezuela la red está censurada e intervenida. Quedarse sin red durante el encuentro es normal, no un error.
- Superficies: app Android (modo Operate), bóveda web mínima (modo Operate/Read) que abren los contactos y página de presentación (modo Persuade) en vigiaapp.pages.dev.
- Cada país es un paquete de datos (CountryPack): primero VE, luego CO.

## Capabilities and Constraints

- El camino crítico (grabar y consultar derechos) funciona 100 % sin red ni backend.
- La evidencia se cifra en el teléfono (E2EE); el servidor solo guarda blobs opacos.
- Android primero; iOS después, con su recorte documentado.
- Anónimo por defecto: sin cuentas, email ni teléfono. Google/Firebase pospuesto.
- Transcripción en la nube (Groq) opcional y apagada por defecto. El LLM (Ollama propio) es opcional y solo reformula lo que el motor legal offline ya encontró.
- Stack fijado: Cloudflare Workers + Hono + D1 + R2; Expo + op-sqlite + FTS5. Sin Supabase ni Vercel.
- Decisiones de diseño y seguridad confirmadas: ver DESIGN.md.
- Sin decidir: custodio legal que pueda testificar; anclaje externo de sellos de tiempo; canal de distribución (Play Store y APK firmado); cómo se financia (se planteó cobrar por uso; grabar, derechos, SOS, avisos y bóveda nunca se cobran).

## Brand Commitments

- Nombre: Vigía. A nivel de sistema la app se llama "Vigía"; solo el icono del lanzador se disfraza.
- Voz: calmada, de tú, frases cortas. Nunca instiga la confrontación; prioriza la seguridad física.
- Nada político: ni colores o símbolos partidistas, ni símbolos patrios. La app debe verse inocua si un agente mira la pantalla.
- Logo: la placa de información (▭) de tinta con filete y V en blanco de señal, solo en la página de presentación (DESIGN.md, «Marca» y decisión 73).

## Evidence on Hand

- No hay usuarios, testimonios, cifras de uso ni logos de aliados. No se inventa ninguno.
- El corpus legal y las tarjetas están pendientes de validación por abogados locales: hasta entonces todo pack es borrador.
- Investigación de referencia: estado del arte de herramientas de DDHH y referencias de UI de Mobbin (resumidas en DESIGN.md).

## Product Principles

1. La seguridad física de la persona va primero.
2. Lo crítico funciona sin red y sin backend.
3. Nada en claro sale del teléfono sin una decisión consciente, y se documenta qué sale, a quién y por qué.
4. Un país es datos validados, nunca código.
5. Nada falla en silencio: cada fallo dice qué pasó, qué implica y qué hacer.
6. La evidencia es de la persona: Vigía la guarda cifrada y no puede verla ni entregarla en claro.

## Accessibility & Inclusion

- Uso con una mano y bajo estrés: objetivos táctiles de 48 dp como mínimo y 56 dp en las acciones principales.
- Contraste WCAG AA como mínimo. El texto escala con el ajuste de tamaño del sistema.
- Español llano y frases cortas.
- TalkBack funcional, sin revelar "Vigía" mientras la fachada de calculadora está activa.
- Teléfonos de gama baja: app pequeña y rápida.
