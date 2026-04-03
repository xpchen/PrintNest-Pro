import { describe, it, expect, beforeEach } from 'vitest';
import { MaxRectsBin, type PackingItem } from './MaxRectsEngine';
import { PackingStrategy } from '../types';

function item(id: string, w: number, h: number, allowRotation = true): PackingItem {
  return { id, width: w, height: h, allowRotation };
}

describe('MaxRectsBin', () => {
  let bin: MaxRectsBin;

  beforeEach(() => {
    bin = new MaxRectsBin(1000, 800);
  });

  // ─── 基础放置 ───

  it('放置单个 item 到空 bin', () => {
    const r = bin.insert(item('a', 200, 100), PackingStrategy.BestShortSideFit);
    expect(r).not.toBeNull();
    expect(r!.id).toBe('a');
    expect(r!.x).toBe(0);
    expect(r!.y).toBe(0);
    // 可能被旋转，但面积不变
    expect(r!.width * r!.height).toBe(200 * 100);
  });

  it('放置多个不重叠的 items', () => {
    const r1 = bin.insert(item('a', 400, 300), PackingStrategy.BestShortSideFit);
    const r2 = bin.insert(item('b', 400, 300), PackingStrategy.BestShortSideFit);
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    // 不能重叠
    const overlap =
      r1!.x < r2!.x + r2!.width &&
      r1!.x + r1!.width > r2!.x &&
      r1!.y < r2!.y + r2!.height &&
      r1!.y + r1!.height > r2!.y;
    expect(overlap).toBe(false);
  });

  it('item 恰好等于 canvas 大小', () => {
    const r = bin.insert(item('exact', 1000, 800), PackingStrategy.BestAreaFit);
    expect(r).not.toBeNull();
    expect(r!.width).toBe(1000);
    expect(r!.height).toBe(800);
    expect(bin.utilization).toBeCloseTo(1.0, 2);
  });

  it('item 大于 canvas 返回 null', () => {
    const r = bin.insert(item('too-big', 1001, 800), PackingStrategy.BestShortSideFit);
    expect(r).toBeNull();
  });

  it('item 大于 canvas 且旋转也放不下', () => {
    const r = bin.insert(item('huge', 1200, 900), PackingStrategy.BestShortSideFit);
    expect(r).toBeNull();
  });

  // ─── 旋转测试 ───

  it('只有旋转后才能放入的 item', () => {
    // bin: 1000x800, item: 900x500 不旋转可以放
    // 但先占满宽方向让只有旋转才行
    const narrow = new MaxRectsBin(500, 900);
    // item 600x400: 不旋转 600>500 放不下, 旋转后 400x600 可以
    const r = narrow.insert(item('rot', 600, 400), PackingStrategy.BestShortSideFit);
    expect(r).not.toBeNull();
    expect(r!.rotated).toBe(true);
    expect(r!.width).toBe(400);
    expect(r!.height).toBe(600);
  });

  it('allowRotation=false 禁止旋转', () => {
    const narrow = new MaxRectsBin(500, 900);
    const r = narrow.insert(item('no-rot', 600, 400, false), PackingStrategy.BestShortSideFit);
    expect(r).toBeNull();
  });

  it('正方形 item 旋转与否结果等价', () => {
    const r = bin.insert(item('sq', 200, 200, true), PackingStrategy.BestShortSideFit);
    expect(r).not.toBeNull();
    // 正方形旋转不改变尺寸
    expect(r!.width).toBe(200);
    expect(r!.height).toBe(200);
  });

  // ─── 四种策略 ───

  it('BSSF: 短边最佳匹配', () => {
    const r = bin.insert(item('bssf', 300, 200), PackingStrategy.BestShortSideFit);
    expect(r).not.toBeNull();
  });

  it('BLSF: 长边最佳匹配', () => {
    const r = bin.insert(item('blsf', 300, 200), PackingStrategy.BestLongSideFit);
    expect(r).not.toBeNull();
  });

  it('BAF: 面积最佳匹配', () => {
    const r = bin.insert(item('baf', 300, 200), PackingStrategy.BestAreaFit);
    expect(r).not.toBeNull();
  });

  it('BL: 左下角优先', () => {
    const r = bin.insert(item('bl', 300, 200), PackingStrategy.BottomLeft);
    expect(r).not.toBeNull();
    // BottomLeft 优先 y 小的位置
    expect(r!.y).toBe(0);
    expect(r!.x).toBe(0);
  });

  // ─── occupy 预占 ───

  it('occupy 预占后该区域不再可用', () => {
    // 预占整个 bin
    bin.occupy({ x: 0, y: 0, width: 1000, height: 800 });
    const r = bin.insert(item('fail', 100, 100), PackingStrategy.BestShortSideFit);
    expect(r).toBeNull();
  });

  it('occupy 部分区域后剩余空间仍可放置', () => {
    bin.occupy({ x: 0, y: 0, width: 500, height: 800 });
    const r = bin.insert(item('half', 400, 700), PackingStrategy.BestShortSideFit);
    expect(r).not.toBeNull();
    expect(r!.x).toBeGreaterThanOrEqual(500);
  });

  // ─── utilization 利用率 ───

  it('空 bin 利用率为 0', () => {
    expect(bin.utilization).toBe(0);
  });

  it('放入 item 后利用率计算正确', () => {
    bin.insert(item('a', 500, 400), PackingStrategy.BestShortSideFit);
    // 500*400 / (1000*800) = 0.25
    expect(bin.utilization).toBeCloseTo(0.25, 4);
  });

  // ─── 碎片化与连续放置 ───

  it('连续放置小 item 不会越界', () => {
    const results = [];
    for (let i = 0; i < 20; i++) {
      const r = bin.insert(item(`s${i}`, 100, 100), PackingStrategy.BestShortSideFit);
      if (r) results.push(r);
    }
    // 1000x800 bin 放 100x100 items, 最多 80 个
    expect(results.length).toBe(20);
    for (const r of results) {
      expect(r.x + r.width).toBeLessThanOrEqual(1000);
      expect(r.y + r.height).toBeLessThanOrEqual(800);
    }
  });

  it('填满 bin 后无法再放入', () => {
    // 放入 4 个 500x400 的 item，刚好填满 1000x800
    for (let i = 0; i < 4; i++) {
      bin.insert(item(`fill${i}`, 500, 400), PackingStrategy.BottomLeft);
    }
    const r = bin.insert(item('overflow', 100, 100), PackingStrategy.BestShortSideFit);
    expect(r).toBeNull();
    expect(bin.utilization).toBeCloseTo(1.0, 2);
  });

  // ─── placements getter ───

  it('placements 返回所有已放置 item', () => {
    bin.insert(item('a', 200, 100), PackingStrategy.BestShortSideFit);
    bin.insert(item('b', 300, 200), PackingStrategy.BestShortSideFit);
    const pl = bin.placements;
    expect(pl).toHaveLength(2);
    expect(pl.map((p) => p.id)).toEqual(['a', 'b']);
  });

  // ─── 极端 aspect ratio ───

  it('极端宽扁 item', () => {
    const r = bin.insert(item('wide', 999, 10), PackingStrategy.BestShortSideFit);
    expect(r).not.toBeNull();
  });

  it('极端窄高 item', () => {
    const r = bin.insert(item('tall', 10, 799), PackingStrategy.BestShortSideFit);
    expect(r).not.toBeNull();
  });

  // ─── 真实业务场景：大画布 + 多物料 ───

  it('1630x50000mm 大画布放置 cm 级物料', () => {
    const bigBin = new MaxRectsBin(1630, 50000);
    // 模拟 docs/160算不出来-1.xlsx 的物料（cm 转 mm）
    const items: PackingItem[] = [
      item('a', 600, 1800, true),  // 60x180cm
      item('b', 400, 600, true),   // 40x60cm
      item('c', 800, 1200, true),  // 80x120cm
    ];
    const results = items.map((i) => bigBin.insert(i, PackingStrategy.BestShortSideFit));
    expect(results.every((r) => r !== null)).toBe(true);
    expect(bigBin.utilization).toBeGreaterThan(0);
  });
});
