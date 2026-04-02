-- PrintNest Pro SQLite 草案（v1）
-- 与产品文档对齐；当前实现已启用 layout_runs，其余表供后续周次落地。

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  default_unit TEXT NOT NULL DEFAULT 'mm',
  default_canvas_profile_id TEXT
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_path TEXT,
  managed_relative_path TEXT NOT NULL,
  file_hash TEXT,
  pixel_width INTEGER,
  pixel_height INTEGER,
  dpi_x REAL,
  dpi_y REAL,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artwork_items (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id),
  name TEXT NOT NULL,
  design_width_mm REAL NOT NULL,
  design_height_mm REAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  can_rotate INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  group_code TEXT,
  bleed_mm REAL,
  spacing_mm REAL
);

CREATE TABLE IF NOT EXISTS canvas_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  width_mm REAL NOT NULL,
  height_mm REAL NOT NULL,
  margin_top_mm REAL NOT NULL DEFAULT 0,
  margin_right_mm REAL NOT NULL DEFAULT 0,
  margin_bottom_mm REAL NOT NULL DEFAULT 0,
  margin_left_mm REAL NOT NULL DEFAULT 0,
  sheet_type TEXT NOT NULL DEFAULT 'sheet'
);

CREATE TABLE IF NOT EXISTS layout_runs (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_ms REAL NOT NULL,
  utilization REAL NOT NULL,
  unplaced_count INTEGER NOT NULL,
  canvas_count INTEGER NOT NULL,
  config_snapshot_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS placements (
  id TEXT PRIMARY KEY NOT NULL,
  layout_run_id TEXT NOT NULL REFERENCES layout_runs(id) ON DELETE CASCADE,
  artwork_item_id TEXT NOT NULL,
  copy_index INTEGER NOT NULL,
  canvas_index INTEGER NOT NULL,
  x_mm REAL NOT NULL,
  y_mm REAL NOT NULL,
  rotation_deg REAL NOT NULL DEFAULT 0,
  packed_width_mm REAL NOT NULL,
  packed_height_mm REAL NOT NULL,
  is_locked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  format TEXT NOT NULL,
  output_relative_path TEXT,
  profile_json TEXT
);

CREATE TABLE IF NOT EXISTS import_templates (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  column_mapping_json TEXT NOT NULL,
  unit_default TEXT NOT NULL DEFAULT 'mm',
  header_row_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_artwork_project ON artwork_items(project_id);
CREATE INDEX IF NOT EXISTS idx_layout_runs_created ON layout_runs(created_at);
