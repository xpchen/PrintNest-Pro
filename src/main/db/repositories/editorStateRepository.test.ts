/**
 * editorStateRepository — metadata roundtrip 测试
 *
 * 直接使用 better-sqlite3 内存 DB 模拟 artwork_items 的 metadata_json 字段往返。
 * 不依赖 Electron 或完整 editorStateRepository（需要 projectPaths 等）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

let Database: typeof import('better-sqlite3').default;
let nativeAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Database = require('better-sqlite3');
  const test = new Database(':memory:');
  test.close();
  nativeAvailable = true;
} catch {
  // native module not available in pure Node
}

function createSchema(db: import('better-sqlite3').Database): void {
  db.exec(`
    CREATE TABLE artwork_items (
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
      sort_order INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT
    );
  `);
}

interface PrintItemLike {
  id: string;
  name: string;
  width: number;
  height: number;
  quantity: number;
  spacing: number;
  bleed: number;
  priority: number;
  allowRotation: boolean;
  color: string;
  assetId?: string;
  group?: string;
  metadata?: {
    templateName?: string;
    keyFields?: Record<string, string>;
    sourceTemplateId?: string;
    sourceRecordId?: string;
    sourceInstanceId?: string;
  };
}

function saveItems(db: import('better-sqlite3').Database, items: PrintItemLike[]): void {
  db.prepare('DELETE FROM artwork_items').run();
  const ins = db.prepare(
    `INSERT INTO artwork_items (
      id, asset_id, name, width_mm, height_mm, quantity, spacing, bleed, priority,
      allow_rotation, group_code, color, sort_order, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  items.forEach((it, idx) => {
    ins.run(
      it.id,
      it.assetId ?? null,
      it.name,
      it.width,
      it.height,
      it.quantity,
      it.spacing,
      it.bleed,
      it.priority,
      it.allowRotation ? 1 : 0,
      it.group ?? null,
      it.color,
      idx,
      it.metadata ? JSON.stringify(it.metadata) : null,
    );
  });
}

function loadItems(db: import('better-sqlite3').Database): PrintItemLike[] {
  const rows = db.prepare(
    `SELECT id, asset_id, name, width_mm, height_mm, quantity, spacing, bleed,
            priority, allow_rotation, group_code, color, sort_order, metadata_json
     FROM artwork_items ORDER BY sort_order`,
  ).all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    width: r.width_mm as number,
    height: r.height_mm as number,
    quantity: r.quantity as number,
    spacing: r.spacing as number,
    bleed: r.bleed as number,
    priority: r.priority as number,
    allowRotation: (r.allow_rotation as number) === 1,
    color: r.color as string,
    assetId: (r.asset_id as string) ?? undefined,
    group: (r.group_code as string) ?? undefined,
    metadata: r.metadata_json ? JSON.parse(r.metadata_json as string) : undefined,
  }));
}

describe.skipIf(!nativeAvailable)('editorStateRepository metadata roundtrip', () => {
  let db: import('better-sqlite3').Database;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('保存带 metadata 的 item → 读回 → metadata 完整', () => {
    const items: PrintItemLike[] = [
      {
        id: 'item-1',
        name: '测试标签',
        width: 50,
        height: 30,
        quantity: 2,
        spacing: 2,
        bleed: 0,
        priority: 0,
        allowRotation: true,
        color: '#ff0000',
        metadata: {
          templateName: '产品标签',
          keyFields: { '品名': '苹果', '规格': '500g' },
          sourceTemplateId: 'tpl-1',
          sourceRecordId: 'rec-1',
          sourceInstanceId: 'inst-1',
        },
      },
    ];

    saveItems(db, items);
    const loaded = loadItems(db);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].metadata).toBeDefined();
    expect(loaded[0].metadata!.templateName).toBe('产品标签');
    expect(loaded[0].metadata!.keyFields).toEqual({ '品名': '苹果', '规格': '500g' });
    expect(loaded[0].metadata!.sourceInstanceId).toBe('inst-1');
  });

  it('保存不带 metadata 的 item → 读回 → metadata 为 undefined', () => {
    const items: PrintItemLike[] = [
      {
        id: 'item-2',
        name: '普通素材',
        width: 100,
        height: 80,
        quantity: 1,
        spacing: 2,
        bleed: 3,
        priority: 0,
        allowRotation: false,
        color: '#00ff00',
      },
    ];

    saveItems(db, items);
    const loaded = loadItems(db);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].metadata).toBeUndefined();
    expect(loaded[0].name).toBe('普通素材');
  });

  it('混合有/无 metadata 的 items 批量保存/读取', () => {
    const items: PrintItemLike[] = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      name: `素材 ${i}`,
      width: 50 + i,
      height: 30 + i,
      quantity: 1,
      spacing: 2,
      bleed: 0,
      priority: 0,
      allowRotation: true,
      color: '#cccccc',
      // 偶数有 metadata
      metadata: i % 2 === 0
        ? { sourceInstanceId: `inst-${i}`, templateName: `模板 ${i}` }
        : undefined,
    }));

    saveItems(db, items);
    const loaded = loadItems(db);

    expect(loaded).toHaveLength(100);

    // 偶数有 metadata
    expect(loaded[0].metadata).toBeDefined();
    expect(loaded[0].metadata!.sourceInstanceId).toBe('inst-0');

    // 奇数无 metadata
    expect(loaded[1].metadata).toBeUndefined();

    // 最后一个偶数
    expect(loaded[98].metadata).toBeDefined();
    expect(loaded[98].metadata!.templateName).toBe('模板 98');
  });

  it('metadata 为空对象 {} 时正确往返', () => {
    const items: PrintItemLike[] = [
      {
        id: 'item-empty',
        name: '空 metadata',
        width: 50,
        height: 30,
        quantity: 1,
        spacing: 0,
        bleed: 0,
        priority: 0,
        allowRotation: true,
        color: '#000',
        metadata: {},
      },
    ];

    saveItems(db, items);
    const loaded = loadItems(db);

    expect(loaded[0].metadata).toEqual({});
  });

  it('覆盖写入不留残余', () => {
    // 第一批：3 items
    saveItems(db, [
      { id: 'a', name: 'A', width: 10, height: 10, quantity: 1, spacing: 0, bleed: 0, priority: 0, allowRotation: true, color: '#000', metadata: { sourceInstanceId: 'x' } },
      { id: 'b', name: 'B', width: 10, height: 10, quantity: 1, spacing: 0, bleed: 0, priority: 0, allowRotation: true, color: '#000' },
      { id: 'c', name: 'C', width: 10, height: 10, quantity: 1, spacing: 0, bleed: 0, priority: 0, allowRotation: true, color: '#000' },
    ]);

    // 第二批：只有 1 item
    saveItems(db, [
      { id: 'd', name: 'D', width: 20, height: 20, quantity: 1, spacing: 0, bleed: 0, priority: 0, allowRotation: true, color: '#fff' },
    ]);

    const loaded = loadItems(db);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('d');
    expect(loaded[0].metadata).toBeUndefined();
  });
});
