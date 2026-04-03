import { describe, it, expect, beforeEach } from 'vitest';
import { expandItems, sortUnits, runLayout, makeLayoutUnitId } from './LayoutScheduler';
import { createPrintItem, createLayoutConfig, resetIdSeq } from '../../__tests__/factories';
import { PackingStrategy } from '../types';
import type { Placement } from '../types';

describe('makeLayoutUnitId', () => {
  it('生成稳定 ID', () => {
    expect(makeLayoutUnitId('item-1', 0)).toBe('lu_item-1_0');
    expect(makeLayoutUnitId('item-1', 2)).toBe('lu_item-1_2');
  });
});

describe('expandItems', () => {
  it('按 quantity 展开', () => {
    const items = [createPrintItem({ id: 'a', quantity: 3, width: 100, height: 50 })];
    const config = createLayoutConfig();
    const units = expandItems(items, config);
    expect(units).toHaveLength(3);
    expect(units.map((u) => u.instanceIndex)).toEqual([0, 1, 2]);
    expect(units.every((u) => u.printItemId === 'a')).toBe(true);
  });

  it('quantity=0 展开为 1 个', () => {
    const items = [createPrintItem({ id: 'b', quantity: 0 })];
    const units = expandItems(items, createLayoutConfig());
    expect(units).toHaveLength(1);
  });

  it('spacing + bleed 正确应用到 packedWidth/packedHeight', () => {
    const items = [createPrintItem({ width: 100, height: 80, spacing: 5, bleed: 3 })];
    const config = createLayoutConfig();
    const units = expandItems(items, config);
    // packedWidth = 100 + 2*3 + 5 = 111
    // packedHeight = 80 + 2*3 + 5 = 91
    expect(units[0].packedWidth).toBe(111);
    expect(units[0].packedHeight).toBe(91);
  });

  it('item spacing=0 不 fallback 到 globalSpacing', () => {
    const items = [createPrintItem({ spacing: 0, bleed: 0, width: 100, height: 80 })];
    const config = createLayoutConfig({ globalSpacing: 10, globalBleed: 5 });
    const units = expandItems(items, config);
    // spacing=0 是合法值，不应 fallback
    expect(units[0].packedWidth).toBe(100);
    expect(units[0].packedHeight).toBe(80);
  });

  it('item spacing=NaN fallback 到 globalSpacing', () => {
    const items = [createPrintItem({ spacing: NaN, bleed: NaN, width: 100, height: 80 })];
    const config = createLayoutConfig({ globalSpacing: 10, globalBleed: 5 });
    const units = expandItems(items, config);
    // NaN fallback → globalSpacing=10, globalBleed=5
    // packedWidth = 100 + 2*5 + 10 = 120
    expect(units[0].packedWidth).toBe(120);
  });

  it('负尺寸或零尺寸 item 被跳过', () => {
    const items = [
      createPrintItem({ id: 'neg', width: -10, height: 50 }),
      createPrintItem({ id: 'zero', width: 0, height: 50 }),
      createPrintItem({ id: 'ok', width: 100, height: 50 }),
    ];
    const units = expandItems(items, createLayoutConfig());
    expect(units).toHaveLength(1);
    expect(units[0].printItemId).toBe('ok');
  });

  it('allowRotation = item.allowRotation && config.allowRotation', () => {
    const items = [createPrintItem({ allowRotation: true })];
    const configNoRot = createLayoutConfig({ allowRotation: false });
    const units = expandItems(items, configNoRot);
    expect(units[0].allowRotation).toBe(false);
  });

  it('空 items 返回空数组', () => {
    expect(expandItems([], createLayoutConfig())).toEqual([]);
  });
});

describe('sortUnits', () => {
  it('priority 降序排序', () => {
    const units = [
      { priority: 1, packedWidth: 100, packedHeight: 100 },
      { priority: 3, packedWidth: 100, packedHeight: 100 },
      { priority: 2, packedWidth: 100, packedHeight: 100 },
    ].map((o, i) => ({
      id: `u${i}`,
      printItemId: `p${i}`,
      instanceIndex: 0,
      originalWidth: 100,
      originalHeight: 100,
      allowRotation: true,
      color: '#ccc',
      imageSrc: '',
      ...o,
    }));

    const sorted = sortUnits(units);
    expect(sorted.map((u) => u.priority)).toEqual([3, 2, 1]);
  });

  it('同 priority 按面积降序', () => {
    const units = [
      { priority: 0, packedWidth: 50, packedHeight: 50 },   // area=2500
      { priority: 0, packedWidth: 200, packedHeight: 100 },  // area=20000
      { priority: 0, packedWidth: 100, packedHeight: 100 },  // area=10000
    ].map((o, i) => ({
      id: `u${i}`,
      printItemId: `p${i}`,
      instanceIndex: 0,
      originalWidth: o.packedWidth,
      originalHeight: o.packedHeight,
      allowRotation: true,
      color: '#ccc',
      imageSrc: '',
      ...o,
    }));

    const sorted = sortUnits(units);
    const areas = sorted.map((u) => u.packedWidth * u.packedHeight);
    expect(areas).toEqual([20000, 10000, 2500]);
  });

  it('不修改原数组', () => {
    const units = [
      { priority: 1, packedWidth: 100, packedHeight: 100 },
      { priority: 2, packedWidth: 100, packedHeight: 100 },
    ].map((o, i) => ({
      id: `u${i}`,
      printItemId: `p${i}`,
      instanceIndex: 0,
      originalWidth: 100,
      originalHeight: 100,
      allowRotation: true,
      color: '#ccc',
      imageSrc: '',
      ...o,
    }));

    const original = [...units];
    sortUnits(units);
    expect(units.map((u) => u.priority)).toEqual(original.map((u) => u.priority));
  });
});

describe('runLayout', () => {
  beforeEach(() => resetIdSeq());

  it('单画布放入所有 items', () => {
    const items = [
      createPrintItem({ id: 'a', width: 200, height: 100, quantity: 2 }),
      createPrintItem({ id: 'b', width: 150, height: 100, quantity: 1 }),
    ];
    const config = createLayoutConfig({ canvas: { width: 1000, height: 800 } });
    const result = runLayout(items, config);

    expect(result.canvases.length).toBeGreaterThanOrEqual(1);
    expect(result.unplaced).toHaveLength(0);
    // 2 + 1 = 3 placements
    const totalPlacements = result.canvases.reduce((s, c) => s + c.placements.length, 0);
    expect(totalPlacements).toBe(3);
    expect(result.totalUtilization).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('多画布：溢出到第二画布', () => {
    // 200x200 canvas, 4 个 110x110 items → 每个画布最多放 1 个
    const items = [createPrintItem({ id: 'x', width: 110, height: 110, quantity: 4 })];
    const config = createLayoutConfig({ canvas: { width: 200, height: 200 }, singleCanvas: false });
    const result = runLayout(items, config);
    expect(result.canvases.length).toBe(4);
    expect(result.unplaced).toHaveLength(0);
  });

  it('singleCanvas=true: 放不下的进入 unplaced', () => {
    const items = [createPrintItem({ id: 'y', width: 110, height: 110, quantity: 4 })];
    const config = createLayoutConfig({ canvas: { width: 200, height: 200 }, singleCanvas: true });
    const result = runLayout(items, config);
    expect(result.canvases.length).toBe(1);
    expect(result.unplaced.length).toBe(3);
  });

  it('空 items 返回空结果', () => {
    const result = runLayout([], createLayoutConfig());
    expect(result.canvases).toHaveLength(0);
    expect(result.unplaced).toHaveLength(0);
    expect(result.totalUtilization).toBe(0);
  });

  it('锁定 placements 保留在原位', () => {
    const items = [
      createPrintItem({ id: 'a', width: 200, height: 100, quantity: 1 }),
      createPrintItem({ id: 'b', width: 300, height: 200, quantity: 1 }),
    ];
    const config = createLayoutConfig({ canvas: { width: 1000, height: 800 } });

    // 先排一次
    const first = runLayout(items, config);
    expect(first.unplaced).toHaveLength(0);

    // 锁定 item a 的 placement
    const lockedP = first.canvases[0].placements.find((p) => p.printItemId === 'a');
    expect(lockedP).toBeDefined();
    const locked: Placement[] = [{ ...lockedP!, locked: true }];

    // 带锁定重排
    const second = runLayout(items, config, locked);
    expect(second.unplaced).toHaveLength(0);

    // 锁定 placement 位置不变
    const lockedInResult = second.canvases[0].placements.find(
      (p) => p.layoutUnitId === lockedP!.layoutUnitId,
    );
    expect(lockedInResult).toBeDefined();
    expect(lockedInResult!.x).toBe(lockedP!.x);
    expect(lockedInResult!.y).toBe(lockedP!.y);
  });

  it('所有 placement 不越界', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      createPrintItem({ id: `i${i}`, width: 80 + i * 10, height: 60 + i * 5, quantity: 2 }),
    );
    const config = createLayoutConfig({ canvas: { width: 800, height: 600 } });
    const result = runLayout(items, config);

    for (const c of result.canvases) {
      for (const p of c.placements) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.width).toBeLessThanOrEqual(800 + 0.01);
        expect(p.y + p.height).toBeLessThanOrEqual(600 + 0.01);
      }
    }
  });

  it('所有 placement 之间不重叠', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      createPrintItem({ id: `o${i}`, width: 150, height: 100, quantity: 3 }),
    );
    const config = createLayoutConfig({ canvas: { width: 800, height: 600 } });
    const result = runLayout(items, config);

    for (const c of result.canvases) {
      const pls = c.placements;
      for (let i = 0; i < pls.length; i++) {
        for (let j = i + 1; j < pls.length; j++) {
          const a = pls[i];
          const b = pls[j];
          const overlap =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          expect(overlap, `placements ${a.id} and ${b.id} overlap`).toBe(false);
        }
      }
    }
  });

  // ─── 真实业务场景 ───

  it('大画布 1630x50000mm 多物料排版', () => {
    const items = [
      createPrintItem({ id: 'a', width: 600, height: 1800, quantity: 5 }),
      createPrintItem({ id: 'b', width: 400, height: 600, quantity: 10 }),
      createPrintItem({ id: 'c', width: 800, height: 1200, quantity: 3 }),
    ];
    const config = createLayoutConfig({
      canvas: { width: 1630, height: 50000 },
      globalSpacing: 2,  // 0.2cm = 2mm
      singleCanvas: true,
    });
    const result = runLayout(items, config);
    expect(result.unplaced).toHaveLength(0);
    expect(result.canvases).toHaveLength(1);
    expect(result.totalUtilization).toBeGreaterThan(0);
  });

  it('带间距和出血的排版', () => {
    const items = [
      createPrintItem({ id: 'sp', width: 100, height: 80, quantity: 5, spacing: 5, bleed: 3 }),
    ];
    const config = createLayoutConfig({ canvas: { width: 500, height: 400 } });
    const result = runLayout(items, config);
    expect(result.unplaced).toHaveLength(0);
    // packedWidth=111, packedHeight=91 → 500/111≈4 per row
    expect(result.canvases.length).toBeGreaterThanOrEqual(1);
  });

  it('超大 item 进入 unplaced', () => {
    const items = [createPrintItem({ id: 'huge', width: 2000, height: 2000, quantity: 1 })];
    const config = createLayoutConfig({ canvas: { width: 1000, height: 800 } });
    const result = runLayout(items, config);
    expect(result.unplaced).toHaveLength(1);
  });
});
