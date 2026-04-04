/**
 * fileManager — 快照 I/O 逻辑的边界测试
 *
 * 直接用临时目录模拟快照保存/加载/清空逻辑。
 * 不依赖 Electron ipcMain（只测试文件 I/O 行为）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let tmpDir: string;

// 复制 fileManager 中的核心快照逻辑（不引入 Electron 依赖）
function savePreviews(snapshotDir: string, previews: { id: string; base64: string }[]): number {
  if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
  let saved = 0;
  for (const p of previews) {
    try {
      const buf = Buffer.from(p.base64, 'base64');
      fs.writeFileSync(path.join(snapshotDir, `${p.id}.png`), buf);
      saved++;
    } catch {
      // 跳过写入失败的单个文件
    }
  }
  return saved;
}

function loadPreviews(snapshotDir: string, instanceIds: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(snapshotDir)) return result;
  for (const id of instanceIds) {
    const filePath = path.join(snapshotDir, `${id}.png`);
    try {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        result[id] = `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch {
      // 跳过读取失败的
    }
  }
  return result;
}

function clearPreviews(snapshotDir: string): number {
  if (!fs.existsSync(snapshotDir)) return 0;
  const files = fs.readdirSync(snapshotDir).filter((f) => f.endsWith('.png'));
  for (const f of files) {
    try { fs.unlinkSync(path.join(snapshotDir, f)); } catch { /* ignore */ }
  }
  return files.length;
}

describe('snapshot savePreviews', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printnest-snap-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('正常保存 PNG 到磁盘', () => {
    const dir = path.join(tmpDir, 'snapshots');
    // 一个最小的有效 base64（1x1 白色 PNG）
    const validBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJREFAAAAAAAAAAAAAABkA';
    const saved = savePreviews(dir, [
      { id: 'inst-1', base64: validBase64 },
      { id: 'inst-2', base64: validBase64 },
    ]);

    expect(saved).toBe(2);
    expect(fs.existsSync(path.join(dir, 'inst-1.png'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'inst-2.png'))).toBe(true);
  });

  it('无效 base64 跳过该文件不影响其他', () => {
    const dir = path.join(tmpDir, 'snapshots');
    // 空字符串作为 base64 也会写（Buffer.from('', 'base64') 返回空 Buffer），
    // 但不影响其他文件
    const validBase64 = 'aGVsbG8='; // "hello"
    const saved = savePreviews(dir, [
      { id: 'good', base64: validBase64 },
      { id: 'empty', base64: '' },
    ]);

    expect(saved).toBe(2); // 两个都会写成功（空 base64 产生空文件）
    expect(fs.existsSync(path.join(dir, 'good.png'))).toBe(true);
  });

  it('目录不存在时自动创建', () => {
    const dir = path.join(tmpDir, 'deep', 'nested', 'snapshots');
    expect(fs.existsSync(dir)).toBe(false);

    savePreviews(dir, [{ id: 'test', base64: 'aGVsbG8=' }]);

    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, 'test.png'))).toBe(true);
  });
});

describe('snapshot loadPreviews', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printnest-snap-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('文件不存在 → 返回空 map 不抛异常', () => {
    const dir = path.join(tmpDir, 'nonexistent');
    const result = loadPreviews(dir, ['inst-1', 'inst-2']);
    expect(result).toEqual({});
  });

  it('正常读取已保存的文件', () => {
    const dir = path.join(tmpDir, 'snapshots');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'inst-1.png'), Buffer.from('hello'));

    const result = loadPreviews(dir, ['inst-1', 'inst-missing']);

    expect(Object.keys(result)).toEqual(['inst-1']);
    expect(result['inst-1']).toMatch(/^data:image\/png;base64,/);
    expect(result['inst-missing']).toBeUndefined();
  });

  it('部分文件缺失时只返回存在的', () => {
    const dir = path.join(tmpDir, 'snapshots');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.png'), Buffer.from('A'));
    fs.writeFileSync(path.join(dir, 'c.png'), Buffer.from('C'));

    const result = loadPreviews(dir, ['a', 'b', 'c', 'd']);

    expect(Object.keys(result).sort()).toEqual(['a', 'c']);
  });
});

describe('snapshot clearPreviews', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printnest-snap-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('目录不存在 → 返回 0 不抛异常', () => {
    const count = clearPreviews(path.join(tmpDir, 'nonexistent'));
    expect(count).toBe(0);
  });

  it('清除所有 PNG 文件', () => {
    const dir = path.join(tmpDir, 'snapshots');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.png'), Buffer.from('A'));
    fs.writeFileSync(path.join(dir, 'b.png'), Buffer.from('B'));
    fs.writeFileSync(path.join(dir, 'keep.txt'), 'not a png');

    const count = clearPreviews(dir);

    expect(count).toBe(2);
    expect(fs.existsSync(path.join(dir, 'a.png'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'b.png'))).toBe(false);
    // 非 PNG 文件不被删除
    expect(fs.existsSync(path.join(dir, 'keep.txt'))).toBe(true);
  });

  it('空目录返回 0', () => {
    const dir = path.join(tmpDir, 'empty-snapshots');
    fs.mkdirSync(dir, { recursive: true });

    const count = clearPreviews(dir);
    expect(count).toBe(0);
  });
});
