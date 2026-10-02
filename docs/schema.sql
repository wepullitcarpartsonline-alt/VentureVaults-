-- Creative Studio Vault — relational sketch (SQLite / Postgres / Supabase)
-- Mirrors client/src/vault/types.ts. Originals are never stored here: only
-- metadata, summaries, preview copies and pointers to where originals live.

CREATE TABLE projects (
  id               TEXT PRIMARY KEY,
  idx              INTEGER NOT NULL,
  name             TEXT NOT NULL,
  one_liner        TEXT NOT NULL,
  category         TEXT NOT NULL,          -- Portfolio | Internal Tool | Dev Tool | ...
  area             TEXT NOT NULL,          -- Creative | Business | Nonprofit | Technology
  status           TEXT NOT NULL,          -- Idea | Exploring | Prototyping | Piloting | Active | Paused | Archived
  internal_use     BOOLEAN DEFAULT FALSE,
  readiness        INTEGER CHECK (readiness BETWEEN 1 AND 5),
  potential        INTEGER CHECK (potential BETWEEN 1 AND 5),   -- self-assessed, not evidence
  strategic        INTEGER CHECK (strategic BETWEEN 1 AND 5),
  cover            TEXT,
  what_it_is       TEXT, audience TEXT, problem TEXT,
  what_exists      TEXT,                   -- JSON array
  could_become     TEXT, decision_needed TEXT,
  opp_summary      TEXT, opp_model TEXT, opp_distribution TEXT, opp_differentiation TEXT,
  missing          TEXT,                   -- JSON array
  rec_path         TEXT NOT NULL,          -- build | validate | package | pitch | portfolio | pause | archive
  rec_confidence   TEXT NOT NULL,          -- low | medium | high
  rec_reasons      TEXT,                   -- JSON array
  rec_would_change TEXT,                   -- JSON array
  next_action      TEXT, next_why TEXT, next_done_when TEXT, next_timebox TEXT,
  orb TEXT, orb_scale REAL,
  orbit_ring INTEGER, orbit_angle REAL,   -- placement around the Vault core
  sample           BOOLEAN DEFAULT FALSE
);

CREATE TABLE sources (             -- pointers to originals
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT,                       -- folder | git | doc | chat | design | url | drive
  label TEXT, location TEXT,
  is_source_of_truth BOOLEAN,
  last_verified DATE
);

CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT,                       -- prototype | research | feedback | usage | pilot | revenue | partnership | repeat-revenue
  verification TEXT,               -- verified | claimed | assumed
  statement TEXT,
  source_id TEXT REFERENCES sources(id),
  date DATE
);

CREATE TABLE stress_checks (
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT, rating TEXT, basis TEXT, note TEXT,
  PRIMARY KEY (project_id, key)
);

CREATE TABLE risks (
  id INTEGER PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT, severity TEXT
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT, src TEXT, caption TEXT
);

CREATE TABLE reusable_assets (
  id TEXT PRIMARY KEY, name TEXT, type TEXT, note TEXT,
  orb TEXT, orbit_radius REAL, orbit_angle REAL
);
CREATE TABLE asset_projects (
  asset_id TEXT REFERENCES reusable_assets(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, project_id)
);

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  from_id TEXT, to_id TEXT,        -- project or asset id
  type TEXT,                       -- audience | technology | asset | model | style | opportunity
  label TEXT
);

CREATE TABLE decision_log (
  id INTEGER PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  date DATE, type TEXT, text TEXT
);
