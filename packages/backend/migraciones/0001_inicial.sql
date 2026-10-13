CREATE TABLE dispositivos (
  id TEXT PRIMARY KEY CHECK (length(id) = 22),
  spki BLOB NOT NULL UNIQUE CHECK (length(spki) = 91),
  spki_lectura BLOB NOT NULL CHECK (length(spki_lectura) = 91),
  huella TEXT NOT NULL UNIQUE CHECK (length(huella) = 64),
  revocado_en INTEGER,
  bytes_usados INTEGER NOT NULL DEFAULT 0 CHECK (bytes_usados >= 0),
  incidentes_usados INTEGER NOT NULL DEFAULT 0 CHECK (incidentes_usados >= 0)
) STRICT;

CREATE TABLE incidentes (
  id TEXT PRIMARY KEY CHECK (length(id) = 22),
  dispositivo TEXT NOT NULL REFERENCES dispositivos(id),
  r BLOB NOT NULL,
  s BLOB NOT NULL CHECK (length(s) = 64),
  r_hash TEXT NOT NULL UNIQUE CHECK (length(r_hash) = 64),
  acuse BLOB NOT NULL,
  meta BLOB CHECK (meta IS NULL OR length(meta) <= 4096),
  recibido INTEGER NOT NULL
) STRICT;
CREATE INDEX incidentes_dispositivo ON incidentes(dispositivo);

CREATE TABLE envolturas (
  incidente TEXT NOT NULL REFERENCES incidentes(id),
  rol TEXT NOT NULL CHECK (rol IN ('contacto', 'recuperacion', 'escucha')),
  destino TEXT NOT NULL CHECK (destino = '-' OR length(destino) = 22),
  k BLOB NOT NULL CHECK (length(k) = 80),
  PRIMARY KEY (incidente, rol, destino)
) STRICT;

CREATE TABLE fragmentos (
  incidente TEXT NOT NULL REFERENCES incidentes(id),
  seq INTEGER NOT NULL CHECK (seq BETWEEN 1 AND 999999),
  tipo TEXT NOT NULL CHECK (tipo IN ('fragmento', 'hueco')),
  r BLOB NOT NULL,
  s BLOB NOT NULL CHECK (length(s) = 64),
  r_hash TEXT NOT NULL UNIQUE CHECK (length(r_hash) = 64),
  prev TEXT NOT NULL CHECK (length(prev) = 64),
  c TEXT CHECK (c IS NULL OR length(c) = 64),
  tamano INTEGER NOT NULL CHECK (tamano >= 0),
  acuse BLOB NOT NULL,
  recibido INTEGER NOT NULL,
  bifurcacion INTEGER NOT NULL DEFAULT 0 CHECK (bifurcacion IN (0, 1)),
  tras_revocacion INTEGER NOT NULL DEFAULT 0 CHECK (tras_revocacion IN (0, 1)),
  PRIMARY KEY (incidente, seq)
) STRICT;

CREATE TABLE cierres (
  incidente TEXT PRIMARY KEY REFERENCES incidentes(id),
  ultimo_seq INTEGER NOT NULL CHECK (ultimo_seq BETWEEN 0 AND 999999),
  hash_final TEXT NOT NULL CHECK (length(hash_final) = 64),
  r BLOB NOT NULL,
  s BLOB NOT NULL CHECK (length(s) = 64),
  r_hash TEXT NOT NULL UNIQUE CHECK (length(r_hash) = 64),
  acuse BLOB NOT NULL,
  recibido INTEGER NOT NULL,
  tras_revocacion INTEGER NOT NULL DEFAULT 0 CHECK (tras_revocacion IN (0, 1))
) STRICT;

CREATE TABLE antirreenvio (
  dispositivo TEXT NOT NULL,
  id_peticion TEXT NOT NULL CHECK (length(id_peticion) = 22),
  h TEXT NOT NULL CHECK (length(h) = 64),
  estado INTEGER NOT NULL,
  cuerpo BLOB NOT NULL,
  creado INTEGER NOT NULL,
  PRIMARY KEY (dispositivo, id_peticion)
) STRICT;
CREATE INDEX antirreenvio_creado ON antirreenvio(creado);

CREATE TABLE altas_por_hora (
  hora INTEGER PRIMARY KEY,
  n INTEGER NOT NULL
) STRICT;

CREATE TABLE contadores (
  dia INTEGER NOT NULL,
  nombre TEXT NOT NULL CHECK (nombre IN ('altas', 'acuses', 'bifurcaciones', 'r2_reutilizado')),
  valor INTEGER NOT NULL,
  PRIMARY KEY (dia, nombre)
) STRICT;
