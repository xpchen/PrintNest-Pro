/**
 * projectDb 单元测试
 *
 * 直接使用 better-sqlite3 创建临时 DB，测试 migration 和 CRUD。
 * 不依赖 Electron（绕过 projectPaths 模块）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * better-sqlite3 需要原生模块，必须通过 electron-rebuild 构建。
 * 在纯 Node 环境下（vitest）原生绑定不可用，因此这些测试标记为 skipIf。
 * 运行方式：先执行 `npm run postinstall`（electron-rebuild），然后运行测试。
 */
let Database: typeof import('better-sqlite3').default;
let nativeAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Database = require('better-sqlite3');
  // 试创建一个内存 DB 确认可用
  const test = new Database(':memory:');
  test.close();
  nativeAvailable = true;
} catch {
  // native module not available
}

// 直接复制 migration SQL（避免引入 Electron 依赖的模块）
const LAYOUT_RUNS_V1 = `
CREATE TABLE IF NOT EXISTS layout_runs (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_ms REAL NOT NULL,
  utilization REAL NOT NULL,
  unplaced_count INTEGER NOT NULL,
  canvas_count INTEGER NOT NULL,
  config_snapshot_json TEXT NOT NULL
);`;

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
);`;

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

describe.skipIf(!nativeAvailable)('projectDb migration', () => {
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printnest-test-'));
    dbPath = path.join(tmpDir, 'project.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('全新 DB migration v1-v4 全部执行', () => {
    migrate(db);
    const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number };
    expect(row.v).toBe(4);
  });

  it('migration 创建所有需要的表', () => {
    migrate(db);
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    ).all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain('layout_runs');
    expect(names).toContain('projects');
    expect(names).toContain('assets');
    expect(names).toContain('artwork_items');
    expect(names).toContain('run_placements');
    expect(names).toContain('schema_migrations');
  });

  it('projects 表包含 v3/v4 新增列', () => {
    migrate(db);
    const cols = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain('current_layout_run_id');
    expect(colNames).toContain('manual_edits_json');
  });

  it('重复 migrate 不报错（幂等）', () => {
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
    const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number };
    expect(row.v).toBe(4);
  });

  it('部分 migration 后继续', () => {
    // 只跑 v1
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
    db.exec(LAYOUT_RUNS_V1);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (1)').run();

    // 继续跑剩余的
    migrate(db);
    const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number };
    expect(row.v).toBe(4);
  });
});

describe.skipIf(!nativeAvailable)('DB CRUD operations', () => {
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printnest-test-'));
    dbPath = path.join(tmpDir, 'project.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    migrate(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('写入和读取 layout_runs', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO layout_runs (id, duration_ms, utilization, unplaced_count, canvas_count, config_snapshot_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('run-1', 150, 0.78, 2, 3, '{"canvas":{"width":1000,"height":800}}');

    const row = db.prepare('SELECT * FROM layout_runs WHERE id = ?').get('run-1') as Record<string, unknown>;
    expect(row.id).toBe('run-1');
    expect(row.duration_ms).toBe(150);
    expect(row.utilization).toBe(0.78);
    expect(row.canvas_count).toBe(3);
  });

  it('写入和读取 artwork_items', () => {
    db.prepare(
      `INSERT INTO artwork_items (id, name, width_mm, height_mm, quantity, spacing, bleed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('art-1', '测试物料', 600, 1800, 5, 2, 0);

    const row = db.prepare('SELECT * FROM artwork_items WHERE id = ?').get('art-1') as Record<string, unknown>;
    expect(row.name).toBe('测试物料');
    expect(row.width_mm).toBe(600);
    expect(row.height_mm).toBe(1800);
    expect(row.quantity).toBe(5);
  });

  it('写入和读取 run_placements', () => {
    // 先创建 layout_run
    db.prepare(
      `INSERT INTO layout_runs (id, duration_ms, utilization, unplaced_count, canvas_count, config_snapshot_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('run-2', 100, 0.5, 0, 1, '{}');

    db.prepare(
      `INSERT INTO run_placements (id, run_id, print_item_id, canvas_index, x_mm, y_mm, width_mm, height_mm, rotated, locked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('rp-1', 'run-2', 'item-1', 0, 10, 20, 600, 1800, 0, 0);

    const rows = db.prepare('SELECT * FROM run_placements WHERE run_id = ?').all('run-2') as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0].x_mm).toBe(10);
    expect(rows[0].width_mm).toBe(600);
  });

  it('写入和读取 assets', () => {
    db.prepare(
      `INSERT INTO assets (id, managed_relative_path) VALUES (?, ?)`,
    ).run('asset-1', 'assets/test_123.png');

    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get('asset-1') as Record<string, unknown>;
    expect(row.managed_relative_path).toBe('assets/test_123.png');
  });

  it('projects 表写入和读取', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO projects (id, name, created_at, updated_at, layout_config_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('proj-1', '测试项目', now, now, '{"canvas":{"width":1630,"height":50000}}');

    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get('proj-1') as Record<string, unknown>;
    expect(row.name).toBe('测试项目');
    const config = JSON.parse(row.layout_config_json as string);
    expect(config.canvas.width).toBe(1630);
  });

  it('transaction 原子性', () => {
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO artwork_items (id, name, width_mm, height_mm) VALUES (?, ?, ?, ?)`,
      ).run('tx-1', 'a', 100, 100);
      db.prepare(
        `INSERT INTO artwork_items (id, name, width_mm, height_mm) VALUES (?, ?, ?, ?)`,
      ).run('tx-2', 'b', 200, 200);
    });
    tx();

    const rows = db.prepare('SELECT * FROM artwork_items WHERE id LIKE ?').all('tx-%') as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
  });

  it('WAL 模式已启用', () => {
    const mode = db.pragma('journal_mode', { simple: true }) as string;
    expect(mode).toBe('wal');
  });
});
