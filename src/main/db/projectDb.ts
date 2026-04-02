import Database from 'better-sqlite3';
import * as path from 'path';
import { getProjectDirectory, ensureProjectLayout } from '../fileManager';

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

function migrate(db: Database.Database): void {
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
