/**
 * Layout Scheduler - 排版调度器
 * 负责：数量展开 → 尺寸预处理 → 规则排序 → 多画布排版 → 结果汇总
 */

import {
  PrintItem,
  LayoutUnit,
  Placement,
  LayoutConfig,
  LayoutResult,
  CanvasResult,
} from '../types';
import { MaxRectsBin, PackingItem } from './MaxRectsEngine';

/** 稳定 LayoutUnit ID：与 printItemId + 展开序号绑定，锁定重排可正确排除已锁单元 */
export function makeLayoutUnitId(printItemId: string, instanceIndex: number): string {
  return `lu_${printItemId}_${instanceIndex}`;
}

/** 间距/出血：0 为合法值；仅非有限数回退到全局 */
function resolveSpacingBleed(value: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Step 1: 数量展开
 * 将每个 PrintItem 按 quantity 展开为多个 LayoutUnit
 */
export function expandItems(items: PrintItem[], config: LayoutConfig): LayoutUnit[] {
  const units: LayoutUnit[] = [];

  for (const item of items) {
    const spacing = resolveSpacingBleed(item.spacing, config.globalSpacing);
    const bleed = resolveSpacingBleed(item.bleed, config.globalBleed);
    const ow = Number(item.width);
    const oh = Number(item.height);
    if (!Number.isFinite(ow) || !Number.isFinite(oh) || ow <= 0 || oh <= 0) {
      continue;
    }
    const q = Math.max(1, Math.floor(Number(item.quantity) || 1));
    // 排版尺寸 = 原始尺寸 + 2*出血 + 间距
    const packedWidth = ow + bleed * 2 + spacing;
    const packedHeight = oh + bleed * 2 + spacing;

    for (let i = 0; i < q; i++) {
      units.push({
        id: makeLayoutUnitId(item.id, i),
        printItemId: item.id,
        instanceIndex: i,
        packedWidth,
        packedHeight,
        originalWidth: ow,
        originalHeight: oh,
        allowRotation: item.allowRotation && config.allowRotation,
        group: item.group,
        priority: item.priority,
        color: item.color,
        imageSrc: item.imageSrc,
      });
    }
  }

  return units;
}

/**
 * Step 2: 规则排序
 * 按优先级降序，同优先级按面积降序（大块先排，利用率更高）
 */
export function sortUnits(units: LayoutUnit[]): LayoutUnit[] {
  return [...units].sort((a, b) => {
    // 优先级降序
    if (b.priority !== a.priority) return b.priority - a.priority;
    // 面积降序
    const areaA = a.packedWidth * a.packedHeight;
    const areaB = b.packedWidth * b.packedHeight;
    return areaB - areaA;
  });
}

/**
 * Step 3: 多画布排版
 * 一个画布放不下自动溢出到下一个
 * lockedPlacements: 锁定元素保留在原位，仅重排未锁定元素
 */
export function runLayout(
  items: PrintItem[],
  config: LayoutConfig,
  lockedPlacements?: Placement[],
): LayoutResult {
  const startTime = performance.now();

  // 收集锁定元素涉及的 printItemId+instanceIndex，避免重复展开
  const lockedSet = new Set<string>();
  if (lockedPlacements) {
    lockedPlacements.forEach((p) => lockedSet.add(p.layoutUnitId));
  }

  // 展开 & 排序（排除已锁定的 unit）
  const allUnits = expandItems(items, config);
  const unlockedUnits = lockedPlacements
    ? allUnits.filter((u) => !lockedSet.has(u.id))
    : allUnits;
  const sorted = sortUnits(unlockedUnits);

  const bins: MaxRectsBin[] = [];
  const placementMap: Map<number, Placement[]> = new Map();
  const unplaced: LayoutUnit[] = [];

  // 如果有锁定元素，先按画布索引分组，创建对应的 bin 并预占位置
  if (lockedPlacements && lockedPlacements.length > 0) {
    // 找到需要的最大画布索引
    const maxIdx = Math.max(...lockedPlacements.map((p) => p.canvasIndex));
    for (let i = 0; i <= maxIdx; i++) {
      bins.push(new MaxRectsBin(config.canvas.width, config.canvas.height));
      placementMap.set(i, []);
    }
    // 预占锁定元素的位置
    for (const lp of lockedPlacements) {
      const bin = bins[lp.canvasIndex];
      if (bin) {
        bin.occupy({ x: lp.x, y: lp.y, width: lp.width, height: lp.height });
        placementMap.get(lp.canvasIndex)!.push({ ...lp });
      }
    }
  }

  for (const unit of sorted) {
    let placed = false;

    // 尝试放入已有画布
    for (let i = 0; i < bins.length; i++) {
      const result = bins[i].insert(
        {
          id: unit.id,
          width: unit.packedWidth,
          height: unit.packedHeight,
          allowRotation: unit.allowRotation,
        } as PackingItem,
        config.strategy
      );

      if (result) {
        const placements = placementMap.get(i) || [];
        placements.push({
          id: `p_${result.id}`,
          layoutUnitId: unit.id,
          printItemId: unit.printItemId,
          canvasIndex: i,
          x: result.x,
          y: result.y,
          width: result.width,
          height: result.height,
          rotated: result.rotated,
          locked: false,
        });
        placementMap.set(i, placements);
        placed = true;
        break;
      }
    }

    // 已有画布都放不下 → 新开一个画布（单画布模式下不新开，记入未排入）
    if (!placed) {
      if (config.singleCanvas && bins.length >= 1) {
        unplaced.push(unit);
      } else {
        const newBin = new MaxRectsBin(config.canvas.width, config.canvas.height);
        const result = newBin.insert(
          {
            id: unit.id,
            width: unit.packedWidth,
            height: unit.packedHeight,
            allowRotation: unit.allowRotation,
          } as PackingItem,
          config.strategy
        );

        if (result) {
          const idx = bins.length;
          bins.push(newBin);
          placementMap.set(idx, [
            {
              id: `p_${result.id}`,
              layoutUnitId: unit.id,
              printItemId: unit.printItemId,
              canvasIndex: idx,
              x: result.x,
              y: result.y,
              width: result.width,
              height: result.height,
              rotated: result.rotated,
              locked: false,
            },
          ]);
        } else {
          unplaced.push(unit);
        }
      }
    }
  }

  // 汇总结果
  const canvasArea = config.canvas.width * config.canvas.height;
  const canvases: CanvasResult[] = bins.map((bin, idx) => ({
    index: idx,
    placements: placementMap.get(idx) || [],
    utilization: bin.utilization,
  }));

  const totalUsedArea = canvases.reduce(
    (sum, c) => sum + c.placements.reduce((s, p) => s + p.width * p.height, 0),
    0
  );
  const totalCanvasArea = canvases.length * canvasArea;

  return {
    canvases,
    totalUtilization: totalCanvasArea > 0 ? totalUsedArea / totalCanvasArea : 0,
    unplaced,
    elapsedMs: performance.now() - startTime,
  };
}
