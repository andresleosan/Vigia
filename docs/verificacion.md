# Verificación de un paquete de Vigía

Este documento es la especificación pública de los formatos de Vigía y de cómo se verifica un paquete de evidencia. Está escrito para que cualquiera (un tribunal, un perito, una organización de derechos humanos) pueda comprobar un paquete con sus propias herramientas, sin leer ni ejecutar el código de Vigía. El verificador de referencia (`packages/shared`, CLI `verificar`) sigue este documento; si alguna vez no coinciden, manda este documento y la diferencia es un error del código.

Para verificar hacen falta:

- **el paquete**, un archivo ZIP (sección 11);
- **la lista fijada de claves del servidor** (sección 7), sacada de este repositorio público. Nunca se toma del paquete ni de quien lo envía;
- **la zona horaria** (IANA, por ejemplo `America/Caracas`) en la que se escriben las horas de los mensajes;
- opcional, **la huella del teléfono** (`d` en el enlace del contacto). Sin ella, el paquete afirma su propia identidad y el verificador lo avisa;
- opcional, **la clave del incidente `K`**. Sin ella se comprueba todo menos el audio en claro.

## 1. Codificación básica

- `hex`: minúsculas, 2 caracteres por byte.
- `b64u`: base64url sin relleno (RFC 4648, sección 5). Al decodificar se rechazan el relleno `=`, cualquier carácter fuera del alfabeto `A-Z a-z 0-9 - _`, una longitud con resto 1 al dividir por 4 y la forma no canónica (bits sobrantes del último carácter distintos de 0). Regla equivalente: `b64u(decodificar(t)) == t`.
- Enteros en texto: decimal ASCII, sin signo y sin ceros a la izquierda (salvo `0`), de 0 a 2^53 - 1.
- Horas: milisegundos desde 1970-01-01T00:00:00Z, enteros.
- `u16be(n)` y `u32be(n)`: enteros sin signo en big-endian de 2 y 4 bytes.
- `‖` es la concatenación de bytes; `0x00` y `0x0A` son bytes sueltos. Las cadenas de los prefijos y de `info` son ASCII.

## 2. Identificadores y claves públicas

- `id`: b64u de 16 bytes aleatorios, 22 caracteres con el patrón `^[A-Za-z0-9_-]{22}$`. Son cadenas opacas: nunca se decodifican.
- Pública P-256 del teléfono: siempre la SPKI DER sin comprimir de exactamente 91 bytes, `3059301306072a8648ce3d020106082a8648ce3d03010703420004` ‖ X ‖ Y (32 bytes cada coordenada), con el punto en la curva. Otra longitud u otro prefijo: no es una pública válida. En b64u mide 122 caracteres.
- `huella` del teléfono: `hex(SHA-256(SPKI de 91 bytes))`, 64 caracteres. Es el `d` del enlace del contacto; los mensajes muestran sus 16 primeros caracteres, salvo `sin_huella`, que la muestra entera.
- Pública X25519 (envolturas): los 32 bytes crudos de RFC 7748.

## 3. JSON canónico de Vigía (JCV)

Todo lo que se firma, y los JSON del paquete, usan JCV, un subconjunto estricto de RFC 8785 (JCS):

- un objeto plano: `{`, pares `"clave":valor` separados por `,`, `}`, sin espacios ni saltos de línea;
- claves con el patrón `^[a-z][a-z0-9_]{0,31}$`, sin repetir y ordenadas por sus bytes;
- valores: una cadena entre comillas de 0 a 4096 caracteres de `[A-Za-z0-9_.-]` (nunca hace falta escapar nada) o un entero de 0 a 2^53 - 1 en decimal sin ceros a la izquierda;
- solo bytes ASCII; un JCV nunca contiene `0x0A`.

Analizar es estricto y cada tipo de objeto tiene su esquema: se rechaza cualquier byte fuera de la gramática, una clave repetida, desordenada, desconocida o que falte, y un valor que no casa con su tipo o su patrón. Comprobación final obligatoria: volver a codificar lo analizado da exactamente los mismos bytes.

## 4. Registros

Cada incidente es una cadena de registros `r` firmados por el teléfono. Claves comunes:

| Clave | Tipo | Regla |
|---|---|---|
| `v` | entero | 1 |
| `tipo` | cadena | `apertura`, `fragmento`, `hueco` o `cierre` |
| `incidente` | cadena | `id` |
| `hora_telefono` | entero | reloj del teléfono en ms, sin corregir: en un fragmento, su primera muestra; en un hueco, su inicio; en la apertura y el cierre, cuando se crean |

Claves propias de cada tipo:

| Tipo | Claves propias |
|---|---|
| `apertura` | `seq` = 0; `country_code` (`^[A-Z]{2}$`); `dispositivo` (la huella, hex de 64); `origen` (`grabar` o `sos`, el SOS sin grabación); `kc` (hex de 64, sección 5) |
| `fragmento` | `seq` (1 a 999 999); `p` (hex de 64, sección 5); `c` (hex de 64: SHA-256 del cifrado); `prev` (hex de 64); `loc` opcional (b64u de 208 caracteres: la posición cifrada) |
| `hueco` | `seq` (1 a 999 999); `prev`; `fin` (ms, mayor o igual que `hora_telefono`); `motivo` (`microfono` o `interrupcion`) |
| `cierre` | `ultimo_seq` (0 a 999 999); `hash_final` (hex de 64). Sin `seq` ni `prev` |

En las tablas, "hex de 64" es `^[0-9a-f]{64}$`, "ms" un entero de 0 a 2^53 - 1 e `id` el patrón de la sección 2; `loc` casa con `^[A-Za-z0-9_-]{208}$`. Una clave de otro tipo, que falta o que sobra hace que el registro no se analice.

- `bytes(r)` = JCV(r) y `hash(r)` = SHA-256(`bytes(r)`).
- Cadena: el `prev` de `seq` 1 es `hex(hash(apertura))`; el de `seq` n > 1, `hex(hash(r[n-1]))`. Fragmentos y huecos comparten la numeración.
- `hash_final` = `hex(hash(r[ultimo_seq]))`; con `ultimo_seq` = 0 es el de la apertura (un SOS sin grabación cancelado).
- Firma del teléfono `s`: ECDSA P-256 con SHA-256 en formato P1363 (64 bytes, `r ‖ s` de 32 bytes big-endian cada uno), sobre `prefijo ‖ bytes(r)`, con el prefijo `vigia/v1/registro` ‖ 0x00 en la apertura, el fragmento y el hueco, y `vigia/v1/cierre` ‖ 0x00 en el cierre.
- Se acepta `s` alto, sin normalizar. Antes de verificar se rechaza una firma que no mide 64 bytes y un `r` o un `s` igual a 0 o mayor o igual que el orden de la curva, n = `ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551`.
- Prefijos de dominio reservados (todos terminan en 0x00): `vigia/v1/registro`, `vigia/v1/cierre`, `vigia/v1/peticion`, `vigia/v1/acuse`, `vigia/v1/evento`, `vigia/v1/compromiso` y `vigia/v1/recuperacion`. Una firma hecha para un dominio nunca verifica en otro.

## 5. Cifrado, `kc`, `p` y posición

- `K`: 32 bytes aleatorios, una por incidente.
- `aad(tipo, incidente, seq)` = `vigia/v1` ‖ 0x00 ‖ tipo ‖ 0x00 ‖ incidente ‖ 0x00 ‖ `u32be(seq)`, con tipo `ct` (audio de un fragmento), `loc` (su posición) o `meta` (metadatos del incidente, `seq` 0).
- `cifrado` = nonce (12 bytes aleatorios) ‖ AES-256-GCM(K, nonce, aad, claro), es decir, el texto cifrado seguido de la etiqueta de 16 bytes.
- `kc` = `hex(SHA-256(vigia/v1/compromiso ‖ 0x00 ‖ incidente ‖ 0x00 ‖ K))`. Liga `K` al incidente firmado: con la clave en la mano se comprueba `kc` antes de descifrar nada.
- `p` = `hex(HMAC-SHA-256(Kp, audio en claro))`, con `Kp` = HKDF-SHA256(ikm = K, sal = 32 bytes a 0, info = los 10 bytes ASCII `vigia/v1/p`, 32 bytes). Así el mismo audio no da el mismo `p` en dos incidentes.
- Posición en claro (va cifrada en `loc`, con la AAD `loc`): JCV `{"hora_fix":ms,"lat":"…","lon":"…","precision_m":n,"relleno":"0…0"}` de exactamente 128 bytes, con `relleno` (`^0*$`) de los ceros justos; `loc` mide siempre 12 + 128 + 16 = 156 bytes (208 caracteres).
  - `lat` y `lon` se escriben desde microgrados enteros con aritmética entera: signo solo si es negativo, parte entera sin ceros a la izquierda, `.` y 6 cifras; el cero es `0.000000`, nunca `-0.000000`. Patrones `^-?(0|[1-9][0-9]?)[.][0-9]{6}$` (`lat`, de -90 a 90) y `^-?(0|[1-9][0-9]{0,2})[.][0-9]{6}$` (`lon`, de -180 a 180); `precision_m` de 0 a 100 000.
- `meta` en claro: blob opaco de hasta 4096 bytes; su contenido lo fija una versión posterior.

## 6. Envoltura de `K` (HPKE)

- RFC 9180, modo base, suite KEM 0x0020 (DHKEM X25519 con HKDF-SHA256), KDF 0x0001 (HKDF-SHA256) y AEAD 0x0002 (AES-256-GCM). Un solo `Seal` por contexto y AAD vacía.
- `info` = `vigia/v1/envoltura` ‖ 0x00 ‖ incidente ‖ 0x00 ‖ rol, con rol `contacto`, `recuperacion` o `escucha` (la clave de escucha de las versiones de pruebas).
- `envoltura` = `enc` (32 bytes) ‖ cifrado de `K` (48 bytes) = 80 bytes.

## 7. Acuse del servidor y claves fijadas

El acuse es el sello de tiempo del servidor: prueba cuándo recibió cada registro.

- Contenido (JCV): `{"hora_servidor":ms,"kid":"…","r":"<hex(hash(r))>","v":1}`, con `kid` de `^[a-z][a-z0-9_]{0,31}$` y `r` el hash del registro acusado.
- Firma: ECDSA P-256, P1363, sobre `vigia/v1/acuse` ‖ 0x00 ‖ JCV(contenido).
- Transporte y archivo: el mismo objeto con una quinta clave, `"firma":"<b64u de los 64 bytes>"` (86 caracteres), también en JCV, es decir, con las claves `firma`, `hora_servidor`, `kid`, `r`, `v` en ese orden.
- Lista fijada de claves de un entorno: un archivo con una entrada JCV por línea (JCV ‖ 0x0A), `{"desde":ms,"estado":"activa|retirada|comprometida","hasta":ms,"kid":"…","spki":"<b64u de 122>","v":1}`, con `hasta` opcional (y nunca menor que `desde`), la `spki` una pública P-256 de 91 bytes y sin dos entradas con el mismo `kid`. La de producción se publica en `docs/claves-acuse/` de este repositorio y va compilada en el verificador de referencia; mientras no haya servidor de producción está vacía. La lista de desarrollo nunca se mezcla con la de producción.
- Verificar un acuse frente al registro esperado: analizarlo con el esquema completo; `r` debe ser `hex(hash(r))` del registro esperado; buscar la entrada por `kid` (un `kid` desconocido no verifica); quitar `firma`, recodificar y verificar la firma con la `spki` de la entrada; la entrada no debe estar `comprometida`, y debe cumplirse `desde ≤ hora_servidor ≤ hasta` (si hay `hasta`). En el verificador, un acuse cuyo `r` es el esperado y cuya firma verifica con una clave `comprometida` da `acuse_no_fiable`; cualquier otro acuse que no verifica da `sin_acuse`.
- Rotación: la clave nueva entra como `activa` en la app, en la bóveda y en `docs/claves-acuse/` antes de que el servidor firme con ella; la anterior pasa a `retirada`, con su `hasta`, y nunca se quita de la lista.
- Compromiso: la clave se marca `comprometida` en una versión nueva de la app, de la bóveda y de `docs/claves-acuse/`, y nunca se borra; desde entonces sus acuses no cuentan. `desde` y `hasta` son un control de coherencia, no una defensa ante quien roba la clave.

## 8. Eventos del servidor

Hechos del servidor que un paquete necesita probar (la alerta, su cancelación, la revocación del teléfono y los accesos), firmados con la clave del acuse en el momento en que ocurren.

- Contenido (JCV): `{"destino":id o "-","dispositivo":huella,"evento":"…","hora_servidor":ms,"incidente":id o "-","kid":"…","v":1}`, con `destino` opcional y `evento` de `^[a-z_]{1,32}$`. `"-"` en `incidente` es un hecho del teléfono, no de un incidente concreto.
- Firma: P1363 sobre `vigia/v1/evento` ‖ 0x00 ‖ JCV(contenido); viaja con la clave `firma`, como el acuse.
- Nombres: `alerta`, `cancelacion`, `revocacion` y `acceso`.
- Un evento vale si su `kid` está en la lista fijada, la firma verifica, la clave no está `comprometida` y `desde ≤ hora_servidor ≤ hasta`.

## 9. Firma de las peticiones a la API

No interviene en la verificación de un paquete; se documenta para quien implemente un cliente.

- Cabeceras: `X-Vigia-Dispositivo` (id del dispositivo; no va en el alta), `X-Vigia-Hora` (ms del reloj del teléfono corregido con el desfase), `X-Vigia-Peticion` (id de la petición, el mismo en todos los reintentos) y `X-Vigia-Firma` (b64u de la firma P1363).
- Cadena firmada: `vigia/v1/peticion` ‖ 0x00 ‖ MÉTODO ‖ 0x0A ‖ RUTA ‖ 0x0A ‖ HORA ‖ 0x0A ‖ ID_PETICION ‖ 0x0A ‖ ID_DISPOSITIVO ‖ 0x0A ‖ `hex(SHA-256(cuerpo crudo))`. RUTA son los bytes del path tal como viajan, sin query; en el alta, ID_DISPOSITIVO es el literal `registro`; el cuerpo vacío se resume como el SHA-256 de 0 bytes.
- Firma la clave del dispositivo el alta, las escrituras y las órdenes, y la clave de lectura las lecturas.
- El servidor rechaza una hora a más de 300 000 ms de la suya con `401 hora` y la cabecera `X-Vigia-Hora-Servidor`.

## 10. Sobre binario

- `Content-Type: application/vnd.vigia.sobre`, exacto y sin parámetros.
- Cuerpo: `u16be(len(bytes(r)))` ‖ `bytes(r)` ‖ `s` (64 bytes) ‖ cifrado (vacío en la apertura, el hueco y el cierre), de 65 536 bytes como mucho.

## 11. Paquete (ZIP)

### Contenido

| Ruta | Contenido |
|---|---|
| `LEEME.txt` | Instrucciones de verificación: el texto fijo de abajo |
| `incidente.json` | JCV `{"incidente":id,"spki":"<b64u de la SPKI de 91 bytes>","v":1}` |
| `registros/000000.r` y `.s` | `bytes(r)` y la firma (64 bytes) de la apertura |
| `registros/NNNNNN.r` y `.s` | Cada fragmento o hueco, con `seq` en 6 cifras |
| `registros/cierre.r` y `.s` | El cierre, si existe |
| `cifrados/NNNNNN.bin` | El cifrado de cada fragmento |
| `acuses/000000.json`, `acuses/NNNNNN.json` y `acuses/cierre.json` | Los bytes del acuse de cada registro |
| `eventos.txt` | Opcional: los eventos del servidor de este incidente y del teléfono (`incidente` `-`), uno por línea (JCV ‖ 0x0A), en orden de `hora_servidor` |
| `envolturas/<rol>-<n>.json` | Opcional: JCV `{"k":"<b64u de la envoltura de 80 bytes>","rol":"…"}`, con n = 1, 2… por rol y sin `destino` |

Los nombres admitidos son exactamente los de esta expresión regular; cualquier otro nombre (rutas absolutas, `..`, `claves-acuse.json`) invalida el paquete:

```text
^(?:LEEME\.txt|incidente\.json|registros\/(?:[0-9]{6}|cierre)\.[rs]|cifrados\/[0-9]{6}\.bin|acuses\/(?:[0-9]{6}|cierre)\.json|eventos\.txt|envolturas\/(?:contacto|recuperacion|escucha)-[1-9][0-9]*\.json)$
```

El paquete nunca lleva la clave privada que descifra, ni las claves del acuse: el verificador solo usa su lista fijada.

### Orden

Primero los grupos en el orden de la tabla (`LEEME.txt`, `incidente.json`, `registros/`, `cifrados/`, `acuses/`, `eventos.txt`, `envolturas/`) y, dentro de cada grupo, por los bytes del nombre. Así `registros/000000.r` va antes que `registros/000000.s`, y `registros/cierre.r` después de todos los numerados.

### Formato ZIP

ZIP (APPNOTE de PKWARE) sin compresión, sin cifrado y sin ZIP64, con todos los enteros en little-endian y con estos campos fijos: versión 10, flags 0 (sin descriptor de datos), método 0, hora 0 y fecha `0x0021` (1980-01-01 00:00), sin campos extra ni comentarios (tampoco el del archivo) y atributos 0. El CRC-32 es el habitual de ZIP (polinomio reflejado `0xEDB88320`, valor inicial y final `0xFFFFFFFF`). Como mucho 65 535 archivos.

El archivo es, en este orden y sin nada entre medias:

1. Por cada archivo, su cabecera local seguida de sus datos tal cual:

   | Bytes | Campo | Valor |
   |---|---|---|
   | 4 | firma | `50 4b 03 04` |
   | 2 | versión necesaria | 10 |
   | 2 | flags | 0 |
   | 2 | método | 0 |
   | 2 | hora | 0 |
   | 2 | fecha | `0x0021` |
   | 4 | CRC-32 de los datos | |
   | 4 | tamaño comprimido | el de los datos |
   | 4 | tamaño sin comprimir | el de los datos |
   | 2 | largo del nombre | |
   | 2 | largo del campo extra | 0 |
   | n | nombre | ASCII |

2. El directorio central: por cada archivo, en el mismo orden:

   | Bytes | Campo | Valor |
   |---|---|---|
   | 4 | firma | `50 4b 01 02` |
   | 2 | versión con la que se hizo | 10 |
   | 2 | versión necesaria | 10 |
   | 2 | flags | 0 |
   | 2 | método | 0 |
   | 2 | hora | 0 |
   | 2 | fecha | `0x0021` |
   | 4 | CRC-32 | el de la cabecera local |
   | 4 | tamaño comprimido | el de la cabecera local |
   | 4 | tamaño sin comprimir | el de la cabecera local |
   | 2 | largo del nombre | |
   | 2 | largo del campo extra | 0 |
   | 2 | largo del comentario | 0 |
   | 2 | disco de inicio | 0 |
   | 2 | atributos internos | 0 |
   | 4 | atributos externos | 0 |
   | 4 | desplazamiento de la cabecera local | desde el byte 0 |
   | n | nombre | el de la cabecera local |

3. El final del directorio central (EOCD), una sola vez y al final del archivo:

   | Bytes | Campo | Valor |
   |---|---|---|
   | 4 | firma | `50 4b 05 06` |
   | 2 | número de este disco | 0 |
   | 2 | disco del directorio central | 0 |
   | 2 | entradas en este disco | número de archivos |
   | 2 | entradas en total | número de archivos |
   | 4 | tamaño del directorio central | |
   | 4 | desplazamiento del directorio central | justo después de los datos del último archivo |
   | 2 | largo del comentario | 0 |

**Lectura estricta.** Se recorren las cabeceras locales desde el byte 0, una detrás de otra, para obtener los nombres y los datos; los nombres deben estar en la lista admitida, sin repetirse y en el orden de arriba; y escribir esos mismos archivos con los campos de arriba debe dar exactamente los mismos bytes que el paquete. Así cada cabecera local es idéntica a su entrada central (nombre, método 0, bit 3 a cero, CRC y tamaños), no hay nada entre entradas ni después del EOCD, y no hay campos extra, comentarios ni cifrado. Cualquier otra cosa: el paquete no es válido. La regla es tan estricta para que dos herramientas nunca lean contenidos distintos del mismo archivo.

### `LEEME.txt`

Su contenido es siempre este texto, en UTF-8 y con un salto de línea final (969 bytes):

```text
Paquete de evidencia de Vigía

Este archivo contiene la evidencia de un incidente grabado con Vigía:
los registros firmados por el teléfono (registros/), el audio cifrado
(cifrados/) y los acuses de recibo firmados por el servidor (acuses/).

Para comprobar que nadie lo ha alterado:

1. Consigue el verificador en el repositorio público de Vigía. Nunca
   uses un verificador que venga dentro de un paquete ni uno que te
   envíe la misma persona que te envió el paquete.
2. Sigue docs/verificacion.md de ese repositorio: explica cada
   comprobación para que cualquiera pueda repetirla con otras
   herramientas.
3. Usa las claves del servidor publicadas en ese repositorio. El
   paquete no trae claves, y una clave que venga con él no vale.
4. Compara la huella del teléfono que muestra el verificador con la
   del enlace que recibiste.

Este texto es siempre el mismo. Si no coincide con el que publica
docs/verificacion.md, no sigas sus instrucciones.
```

Su SHA-256 es `86bed4d46a3eaf0646e4f07de08e1bb8287543871b604449ec0322e0c96c9dcd`.

## 12. Algoritmo de verificación

Definiciones que usan los pasos:

- Un registro `seq` está **presente** si existe `registros/NNNNNN.r`.
- Un registro presente es **fiable** si su JCV se analiza, es de tipo `fragmento` o `hueco` con el `seq` de su nombre y el `incidente` del paquete, y tiene `.s` con una firma válida y un acuse válido (sección 7). La apertura es fiable si pasa el paso 4. La **hora** de un registro fiable es la `hora_servidor` de su acuse.
- En los pasos 7 a 9, un registro que no es fiable cuenta como si faltara: su vecino recibe `sin_comprobar`, nunca `cadena_rota`. Un fallo solo de su `.bin` (falta, `no_coincide` o `ilegible`) no le quita esa condición: su `r` lo firmó el teléfono y lo acusó el servidor, así que sigue sirviendo para los enlaces, el cierre y las marcas, aunque el fragmento no cuente.

Cada hallazgo es un **fallo** o un **aviso** (sección 13). Un fallo impide el ✓ de su registro y el estado `integro`; un aviso se muestra con el resultado.

1. **ZIP.** Lectura estricta (sección 11). Si falla: `paquete_invalido`, y se para.
2. **`LEEME.txt`.** Si falta o su SHA-256 no es el de la sección 11: `leeme_alterado`.
3. **Incidente e identidad.** `incidente.json` debe ser el JCV de la sección 11 y su `spki`, una pública P-256 de 91 bytes (sección 2); si no, `paquete_invalido`, y se para. La huella es `hex(SHA-256(spki))`. Con `d`: si es distinta, `huella_distinta`, y se para. Sin `d`: `sin_huella`, con la huella entera, porque compararla a ojo solo vale con sus 64 caracteres (16 son 64 bits, al alcance de un Estado); lo seguro es pasar `d` al verificador.
4. **Apertura.** Deben estar `registros/000000.r` y `registros/000000.s`; el JCV debe ser una apertura (`seq` 0) del `incidente` del paquete, con `dispositivo` igual a la huella, y su firma debe verificar con `vigia/v1/registro`. Si no: `apertura_invalida`, y se para. Después, `acuses/000000.json` debe estar y ser un acuse válido de la apertura (sección 7); si no, `acuse_no_fiable` (su `r` es el esperado y su firma verifica con una clave `comprometida`) o `sin_acuse` (cualquier otro caso, también si falta), con `{reg}` = `Apertura`, y se para. Así un acuse que no vale (una lista de claves equivocada o una clave comprometida) nunca se presenta como una apertura que el teléfono no firmó. Con `K`: si `kc` no coincide, `clave_incorrecta`, y se sigue como si no hubiera `K` (no se descifra nada).
5. **Eventos.** Cada línea de `eventos.txt` (JCV ‖ 0x0A; un trozo final sin 0x0A es una línea que no vale) debe ser un evento válido (sección 8) con `dispositivo` igual a la huella e `incidente` igual al del paquete o `-`. Si no: `evento_invalido` con su número de línea (desde 1), y no cuenta. `T_alerta` es la menor `hora_servidor` de los eventos `alerta` válidos, y `T_rev`, la de los `revocacion` válidos. El orden de las líneas no se comprueba: cada línea vale por sí misma. `eventos.txt` no va firmado en conjunto: quien arma el paquete puede quitar líneas, y sin un evento no hay marca (paso 9). Un paquete sin alerta ni revocación no prueba que no las hubiera; el verificador de referencia lo recuerda al final (sección 15).
6. **Registros de `seq` 1 a M**, con M el mayor entre el `ultimo_seq` de `registros/cierre.r` (si su JCV se analiza como un cierre) y el mayor `seq` presente. Para cada `seq`:
   - Si no está presente: `falta`. Los que faltan seguidos forman un solo hallazgo, `faltan`, del primero al último del tramo.
   - Si está presente, se aplican estas comprobaciones en orden y solo se informa de la primera que falla:
     1. el JCV se analiza con el esquema de un registro (sección 4); si no, `registro_invalido`;
     2. es de tipo `fragmento` o `hueco`, su `seq` es el del nombre y su `incidente`, el del paquete; si no, `ajeno`;
     3. están `registros/NNNNNN.s`, `acuses/NNNNNN.json` y, en un fragmento, `cifrados/NNNNNN.bin`; si no, un `falta_archivo` por cada archivo que falta;
     4. la firma verifica con `vigia/v1/registro`; si no, `firma_invalida`;
     5. el acuse es válido para `hash(r)`; si su `r` es el esperado y su firma verifica con una clave `comprometida`, `acuse_no_fiable`, y si no, `sin_acuse`;
     6. en un hueco, el aviso `hueco` con su inicio (`hora_telefono`) y su `fin`, y no hay más comprobaciones;
     7. en un fragmento, `c` debe ser el SHA-256 del `.bin`; si no, `no_coincide`;
     8. con `K` (y `kc` correcto): se descifra el `.bin` con `aad('ct', incidente, seq)` y, si hay `loc`, el b64u decodificado de `loc` con `aad('loc', incidente, seq)`; si alguno no descifra, `ilegible`; si `p` no es el de la sección 5 para el audio descifrado, `no_coincide`. Si todo cuadra, ese audio es el del fragmento.
   - Un hueco que trae `cifrados/NNNNNN.bin`: además, `sobra` para ese archivo.
   - Sin `K` (si no se dio ninguna clave): un solo `audio_sin_comprobar`, si hay algún fragmento que pasa las comprobaciones 1 y 2.
   - Un archivo `registros/NNNNNN.s`, `acuses/NNNNNN.json`, `cifrados/NNNNNN.bin`, `registros/cierre.s` o `acuses/cierre.json` sin su `.r`, y `cifrados/000000.bin`: `sobra`.
7. **Enlaces.** Regla de atribución: cuando dos registros fiables se contradicen, el hallazgo es para el de hora posterior; el de hora anterior no recibe hallazgo por esa contradicción y sigue contando; con la misma hora, para los dos. Para cada registro fiable n ≥ 1, en orden:
   - si n-1 falta o no es fiable: `sin_comprobar` en n;
   - si no, y `r[n].prev` no es `hex(hash(r[n-1]))`: con n = 1, `cadena_rota` en 1 (la apertura siempre llegó antes); con n > 1, `cadena_rota` en n si su hora es mayor o igual que la de n-1, y `enlace_contradicho` en n-1 si la hora de n-1 es mayor o igual que la de n.
8. **Cierre.** Si existe `registros/cierre.r`: su JCV debe ser un cierre del incidente del paquete, `registros/cierre.s` debe estar y su firma debe verificar con `vigia/v1/cierre`; si no, `cierre_invalido`. Después, `acuses/cierre.json` debe estar y ser un acuse válido del cierre; si no, `acuse_no_fiable` o `sin_acuse` (como en el paso 4), con `{reg}` = `Cierre`. En los dos casos el cierre no cuenta. Si pasa las dos comprobaciones, el cierre es **válido**; con `Tc` la hora de su acuse y U su `ultimo_seq` (la apertura siempre cuenta como recibida antes que el cierre):
   - cada registro fiable con `seq` mayor que U: si su hora es mayor o igual que `Tc`, `despues_del_cierre` en ese registro; si es menor o igual, el cierre lo contradice;
   - el registro U: si falta o no es fiable, `cierre_sin_comprobar`; si su hash no es `hash_final`: con U = 0 (la apertura), el cierre la contradice, sin comparar horas; con U > 0, el cierre lo contradice si `Tc` es mayor o igual que la hora de U, y `enlace_contradicho` en U si la hora de U es mayor o igual que `Tc`;
   - si el cierre contradice algún registro: un solo `cierre_contradice`, y el cierre no cuenta.
   - Si no hay un cierre que cuente y la apertura es de origen `grabar` o hay algún fragmento o hueco que pasa las comprobaciones 1 y 2 del paso 6: `sin_cierre`, con la mayor hora entre los registros fiables y el cierre válido, aunque no cuente. Con origen `sos` y nada más no se dice nada: es un SOS sin grabación.
9. **Marcas** (avisos). Con `T_alerta`: un registro fiable n (la apertura incluida) cuya hora es posterior a `T_alerta` lleva `posterior_alerta`, salvo que (a) exista m > n con hora no posterior a `T_alerta` y los registros n+1 a m sean fiables y encadenen (`r[j].prev = hex(hash(r[j-1]))` para j de n+1 a m), o (b) el cierre cuente, `Tc` no sea posterior a `T_alerta`, n ≤ U y los registros n a U sean fiables, encadenen y `hash(r[U])` sea `hash_final`. Un cierre válido con `Tc` posterior a `T_alerta` también la lleva. Con `T_rev`, la misma regla da `tras_revocacion`. Así, un registro cuyo contenido ya fijaba antes de la alerta un registro posterior, aunque sea de forma transitiva por la cadena, no se marca.
10. **Resultado.**
    - Un fragmento **cuenta** si pasa las comprobaciones 1 y 2 del paso 6 y no tiene ningún fallo suyo (de los pasos 6 a 8); `sin_comprobar`, `posterior_alerta` y `tras_revocacion` no lo excluyen. `sobra` es de un archivo, no de un registro. El audio que se entrega es solo el de los fragmentos que cuentan y tienen `p` comprobado, por `seq`.
    - `estado`: `fallido` si hay algún fallo; si no, `incompleto` si hay `falta`, `faltan`, `cierre_sin_comprobar` o no hay un cierre que cuente; si no, `integro`.
    - Resumen: con `fallido`, `con_fallos`; sin fallos y sin ningún fragmento que cuente (aunque haya huecos), `solo_apertura`, con la hora del acuse de la apertura; con `integro`, `ok`; con `incompleto`, `ok_incompleto`. `{intervalo}` va de la menor a la mayor hora de los fragmentos que cuentan; con un solo fragmento, `ok` y `ok_incompleto` van en singular y con su hora (sección 13).
    - Después del resumen se listan todos los hallazgos: primero los generales (pasos 2 a 6, en ese orden), luego los de cada registro por orden de `seq` (y, dentro de un `seq`, en el orden de los pasos) y al final los del cierre.

## 13. Mensajes

Lista cerrada, en español. `{reg}` es `Registro {seq}`, `Apertura` o `Cierre`, según de qué registro es el hallazgo. `{huella}` son los 16 primeros caracteres de la huella; en `sin_huella`, la huella entera, en 8 grupos de 8 caracteres separados por espacios. `{n}` es un número de fragmentos o, en `evento_invalido`, el número de línea; `{f}`, el número de fallos; `{archivo}`, la ruta dentro del paquete. `{motivo}`: `microfono` se escribe "otra app usó el micrófono" e `interrupcion`, "la grabación se interrumpió".

Con un solo fragmento que cuenta (n = 1), `ok` y `ok_incompleto` van en singular y con `{hora}`, la del acuse de ese fragmento: "✓ 1 fragmento, cadena íntegra, firmado por el dispositivo {huella}, recibido a las {hora}" y "✓ 1 fragmento firmado por el dispositivo {huella}, recibido a las {hora}; el paquete no está completo: mira los avisos".

| Clave | Tipo | Texto |
|---|---|---|
| `ok` | resumen | ✓ {n} fragmentos, cadena íntegra, firmados por el dispositivo {huella}, recibidos {intervalo} |
| `ok_incompleto` | resumen | ✓ {n} fragmentos firmados por el dispositivo {huella}, recibidos {intervalo}; el paquete no está completo: mira los avisos |
| `solo_apertura` | resumen | ✓ Apertura firmada por el dispositivo {huella}, recibida a las {hora}; el paquete no trae fragmentos |
| `con_fallos` | resumen | ✗ Hay fallos ({f}); lo que falla no cuenta. Fragmentos que verifican: {n} |
| `paquete_invalido` | fallo | El archivo no es un paquete de Vigía válido |
| `huella_distinta` | fallo | El paquete no es del teléfono del enlace |
| `apertura_invalida` | fallo | La apertura falta, no es de este paquete o no la firmó el teléfono: la cadena no tiene origen |
| `registro_invalido` | fallo | {reg}: formato que esta versión del verificador no reconoce |
| `ajeno` | fallo | {reg}: es de otro incidente o no corresponde a su lugar en el paquete |
| `falta_archivo` | fallo | {reg}: le falta {archivo} |
| `sobra` | fallo | {archivo}: no corresponde a ningún registro |
| `firma_invalida` | fallo | {reg}: no lo firmó el teléfono |
| `no_coincide` | fallo | Fragmento {seq}: no coincide con lo que firmó el teléfono |
| `ilegible` | fallo | Fragmento {seq}: lo firmó el teléfono, pero no se puede descifrar |
| `cadena_rota` | fallo | {reg}: no sigue al anterior |
| `enlace_contradicho` | fallo | {reg}: contradice lo que el servidor recibió antes |
| `cierre_invalido` | fallo | El cierre no está firmado por el teléfono o no es de este incidente |
| `cierre_contradice` | fallo | El cierre contradice registros que el servidor recibió antes que él: el cierre no cuenta |
| `despues_del_cierre` | fallo | {reg}: llegó después del cierre |
| `sin_acuse` | fallo | {reg}: sin acuse válido del servidor |
| `acuse_no_fiable` | fallo | {reg}: el acuse lo firmó una clave del servidor marcada como comprometida |
| `evento_invalido` | fallo | Evento {n}: no lo firmó el servidor o no es de este incidente |
| `sin_huella` | aviso | Aviso: la identidad del teléfono ({huella}) la afirma el propio paquete; compárala entera con la del enlace |
| `leeme_alterado` | aviso | LEEME.txt no es el texto oficial: no sigas sus instrucciones; usa docs/verificacion.md del repositorio público |
| `falta` | aviso | Fragmento {seq}: no está en el paquete |
| `faltan` | aviso | Fragmentos {seq} a {hasta}: no están en el paquete |
| `sin_comprobar` | aviso | {reg}: falta el anterior y su enlace no se puede comprobar |
| `hueco` | aviso | Hueco {intervalo} según el reloj del teléfono ({motivo}) |
| `cierre_sin_comprobar` | aviso | El cierre no se puede comprobar: falta el registro {seq} |
| `sin_cierre` | aviso | El teléfono dejó de enviar a las {hora} |
| `audio_sin_comprobar` | aviso | Audio sin comprobar: falta la clave para descifrar |
| `clave_incorrecta` | aviso | La clave no abre este incidente: el audio no se puede comprobar |
| `posterior_alerta` | aviso | {reg}: llegó después de la alerta; pudo enviarlo otra persona |
| `tras_revocacion` | aviso | {reg}: llegó después de revocar el teléfono |

## 14. Horas en los mensajes

En la zona horaria elegida, con las horas truncadas al minuto:

- `{hora}`: `HH:MM del DD-MM-AAAA (UTC±hh:mm)`, por ejemplo `10:05 del 12-10-2026 (UTC-04:00)`. El desfase se escribe con `+` o `-`.
- `{intervalo}`: `entre HH:MM y HH:MM del DD-MM-AAAA (UTC±hh:mm)` si las dos horas caen el mismo día; si no, `entre HH:MM del DD-MM-AAAA y HH:MM del DD-MM-AAAA (UTC±hh:mm)`. Si las dos horas tienen distinto desfase (un cambio de horario), cada una lleva el suyo: `entre HH:MM del DD-MM-AAAA (UTC±hh:mm) y HH:MM del DD-MM-AAAA (UTC±hh:mm)`.
- Las horas del reloj del teléfono (el hueco) usan el mismo formato, y el mensaje lo dice.
- Toda hora de 0 a 2^53 - 1 tiene texto, también más allá del año 275 760, con el calendario gregoriano proléptico.
- La bóveda puede abreviar a `HH:MM` cuando todo cae en el mismo día en la zona del contacto.

## 15. Verificador de referencia

Desde un clon de este repositorio, con sus dependencias instaladas (la orden corre en `packages/shared`: mejor rutas absolutas):

```sh
pnpm --filter @vigia/shared verificar <paquete.zip> --zona America/Caracas --claves <lista de claves> --huella <d del enlace> --clave-incidente < archivo-con-K-en-b64u
```

- `--claves <archivo>` toma la lista fijada de un archivo (sección 7); `--entorno produccion`, la compilada en el verificador. El verificador dice cuál usó.
- `--clave-incidente` lee `K` en b64u de la entrada estándar; `--clave-escucha` lee la privada X25519 de escucha (32 bytes en b64u) y abre con ella `envolturas/escucha-<n>.json`. Una clave nunca va como argumento de la orden, para que no quede en el historial ni en la lista de procesos.
- `--audio <archivo>` guarda el audio de los fragmentos que cuentan, en orden de `seq`. Es audio en claro: el archivo se crea con permisos 0600 (solo lo lee su dueño) y nunca pisa uno que ya exista.
- Si el paquete no trae eventos de alerta ni de revocación, lo recuerda en una línea al final: eso no prueba que no los hubiera (sección 12, paso 5).
- Sale con 0 si el paquete no tiene fallos, con 1 si los tiene y con 2 si la orden está mal escrita.
