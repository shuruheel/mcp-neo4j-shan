/**
 * SQLite DDL for the knowledge graph.
 * Executed once when the database is first opened.
 */
export const SCHEMA_DDL = `
-- Single table for all node types (Entity, Event, Concept, Source, etc.)
CREATE TABLE IF NOT EXISTS nodes (
  name        TEXT PRIMARY KEY,
  node_type   TEXT NOT NULL,
  sub_type    TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  statement   TEXT,
  content     TEXT,
  confidence  REAL,
  properties  TEXT NOT NULL DEFAULT '{}',
  search_text TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS edges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  from_node     TEXT NOT NULL REFERENCES nodes(name) ON DELETE CASCADE,
  to_node       TEXT NOT NULL REFERENCES nodes(name) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  confidence    REAL,
  weight        REAL DEFAULT 0.5,
  context       TEXT,
  properties    TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(from_node, to_node, relation_type)
);

CREATE TABLE IF NOT EXISTS aliases (
  alias          TEXT NOT NULL,
  canonical_name TEXT NOT NULL REFERENCES nodes(name) ON DELETE CASCADE,
  match_score    REAL DEFAULT 1.0,
  PRIMARY KEY (alias, canonical_name)
);

CREATE TABLE IF NOT EXISTS observations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  node_name  TEXT NOT NULL REFERENCES nodes(name) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- FTS5 full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
  name,
  search_text,
  content='nodes',
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
  INSERT INTO nodes_fts(rowid, name, search_text) VALUES (new.rowid, new.name, new.search_text);
END;

CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, name, search_text) VALUES('delete', old.rowid, old.name, old.search_text);
END;

CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, name, search_text) VALUES('delete', old.rowid, old.name, old.search_text);
  INSERT INTO nodes_fts(rowid, name, search_text) VALUES (new.rowid, new.name, new.search_text);
END;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_sub_type ON nodes(node_type, sub_type);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_node);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_node);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(relation_type);
CREATE INDEX IF NOT EXISTS idx_aliases_alias ON aliases(alias);
CREATE INDEX IF NOT EXISTS idx_observations_node ON observations(node_name);
`;
