-- Esquema de la base de datos de Slumen (PostgreSQL 13+).
-- Las funciones lo aplican solas al conectarse; este archivo es para revisarlo o ejecutarlo a mano.
CREATE TABLE IF NOT EXISTS usuarios (
  id                BIGSERIAL PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  nombre            TEXT,
  celular           TEXT,
  pais              TEXT,
  idioma            TEXT NOT NULL DEFAULT 'es',
  acepta_novedades  BOOLEAN NOT NULL DEFAULT false,
  acepta_datos_en   TIMESTAMPTZ,
  creado            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_acceso     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS enlaces_acceso (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  acepta      BOOLEAN NOT NULL DEFAULT false,
  expira      TIMESTAMPTZ NOT NULL,
  usado       TIMESTAMPTZ,
  creado      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enlaces_email_idx ON enlaces_acceso (email, creado);

CREATE TABLE IF NOT EXISTS sesiones (
  id_hash     TEXT PRIMARY KEY,
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira      TIMESTAMPTZ NOT NULL,
  agente      TEXT
);
CREATE INDEX IF NOT EXISTS sesiones_usuario_idx ON sesiones (usuario_id);

CREATE TABLE IF NOT EXISTS pedidos (
  ref               TEXT PRIMARY KEY,
  usuario_id        BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  email             TEXT NOT NULL,
  nombre            TEXT NOT NULL,
  celular           TEXT,
  pasarela          TEXT NOT NULL,
  moneda            TEXT NOT NULL,
  total             BIGINT NOT NULL,
  items             JSONB NOT NULL,
  lineas            JSONB NOT NULL,
  idioma            TEXT NOT NULL DEFAULT 'es',
  acepta_novedades  BOOLEAN NOT NULL DEFAULT false,
  estado            TEXT NOT NULL DEFAULT 'creado',
  transaccion       TEXT,
  nota              TEXT,
  pago              JSONB,
  creado            TIMESTAMPTZ NOT NULL DEFAULT now(),
  pagado            TIMESTAMPTZ,
  entregado         TIMESTAMPTZ,
  actualizado       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedidos_usuario_idx ON pedidos (usuario_id, creado DESC);
CREATE INDEX IF NOT EXISTS pedidos_email_idx ON pedidos (email);
CREATE INDEX IF NOT EXISTS pedidos_estado_idx ON pedidos (estado);

CREATE TABLE IF NOT EXISTS accesos (
  usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  producto    TEXT NOT NULL,
  pedido_ref  TEXT REFERENCES pedidos(ref) ON DELETE SET NULL,
  otorgado    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_uso  TIMESTAMPTZ,
  PRIMARY KEY (usuario_id, producto)
);

-- Archivos de los productos pagados (HTML e imágenes). Se cargan con scripts/subir-productos.mjs
-- para que los productos no tengan que estar en el repositorio público.
CREATE TABLE IF NOT EXISTS archivos_producto (
  producto    TEXT NOT NULL,
  ruta        TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  contenido   BYTEA NOT NULL,
  actualizado TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (producto, ruta)
);
