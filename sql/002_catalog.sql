-- ============================================
-- PARK: Catálogo Versionado
-- ============================================

CREATE TABLE IF NOT EXISTS catalog_versions (
  store_id TEXT NOT NULL,
  version INT NOT NULL,
  checksum TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, version)
);

-- Solo una versión activa por tienda
CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_active
  ON catalog_versions(store_id)
  WHERE active = TRUE;

-- Snapshot simple (puedes moverlo a storage si crece)
CREATE TABLE IF NOT EXISTS catalog_snapshots (
  store_id TEXT NOT NULL,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, version),
  FOREIGN KEY (store_id, version) REFERENCES catalog_versions(store_id, version)
);
