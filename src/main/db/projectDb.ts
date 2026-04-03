import Database from 'better-sqlite3';
import * as path from 'path';
import { getProjectDirectory, ensureProjectLayout } from '../projectPaths';

const dbCache = new Map<string, Database.Database>();

const LAYOUT_RUNS_V1 = `
CREATE TABLE IF NOT EXISTS layout_runs (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_ms REAL NOT NULL,
  utilization REAL NOT NULL,
  unplaced_count INTEGER NOT NULL,
  canvas_count INTEGER NOT NULL,
  config_snapshot_json TEXT NOT NULL
);
`;

const PROJECTS_ASSETS_ARTWORK_V2 = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  layout_config_json TEXT NOT NULL,
  layout_result_json TEXT,
  layout_source_signature TEXT
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY NOT NULL,
  managed_relative_path TEXT NOT NULL,
  file_hash TEXT,
  pixel_width INTEGER,
  pixel_height INTEGER,
  dpi_x REAL,
  dpi_y REAL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS artwork_items (
  id TEXT PRIMARY KEY NOT NULL,
  asset_id TEXT,
  name TEXT NOT NULL,
  width_mm REAL NOT NULL,
  height_mm REAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  spacing REAL NOT NULL DEFAULT 0,
  bleed REAL NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  allow_rotation INTEGER NOT NULL DEFAULT 1,
  group_code TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
`;

function migrate(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null } | undefined;
  const v = row?.v ?? 0;
  if (v < 1) {
    db.exec(LAYOUT_RUNS_V1);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (1)').run();
  }
  if (v < 2) {
    db.exec(PROJECTS_ASSETS_ARTWORK_V2);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (2)').run();
  }
  if (v < 3) {
    db.exec(`
CREATE TABLE IF NOT EXISTS run_placements (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  layout_unit_id TEXT,
  print_item_id TEXT NOT NULL,
  canvas_index INTEGER NOT NULL,
  x_mm REAL NOT NULL,
  y_mm REAL NOT NULL,
  width_mm REAL NOT NULL,
  height_mm REAL NOT NULL,
  rotated INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_run_placements_run_id ON run_placements(run_id);
`);
    const cols = db.prepare(`PRAGMA table_info(layout_runs)`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'manual_edits_json')) {
      db.exec(`ALTER TABLE layout_runs ADD COLUMN manual_edits_json TEXT`);
    }
    const pcols = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{ name: string }>;
    if (!pcols.some((c) => c.name === 'current_layout_run_id')) {
      db.exec(`ALTER TABLE projects ADD COLUMN current_layout_run_id TEXT`);
    }
    db.prepare('INSERT INTO schema_migrations (version) VALUES (3)').run();
  }
  if (v < 4) {
    const pcols4 = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{ name: string }>;
    if (!pcols4.some((c) => c.name === 'manual_edits_json')) {
      db.exec(`ALTER TABLE projects ADD COLUMN manual_edits_json TEXT`);
    }
    db.prepare('INSERT INTO schema_migrations (version) VALUES (4)').run();
  }
}

/**
 * 打开项目目录下的 project.db（带简单 migration）。失败时返回 null（例如原生模块未就绪）。
 */
export function getOrOpenProjectDb(projectId: string): Database.Database | null {
  try {
    if (dbCache.has(projectId)) {
      return dbCache.get(projectId)!;
    }
    ensureProjectLayout(projectId);
    const root = getProjectDirectory(projectId);
    const dbPath = path.join(root, 'project.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    dbCache.set(projectId, db);
    return db;
  } catch {
    return null;
  }
}

export function closeProjectDb(projectId: string): void {
  const db = dbCache.get(projectId);
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    dbCache.delete(projectId);
  }
}
