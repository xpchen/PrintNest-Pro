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

let _uid = 0;
function uid(): string {
  return `lu_${++_uid}_${Date.now()}`;
}

/**
 * Step 1: 数量展开
 * 将每个 PrintItem 按 quantity 展开为多个 LayoutUnit
 */
export function expandItems(items: PrintItem[], config: LayoutConfig): LayoutUnit[] {
  const units: LayoutUnit[] = [];

  for (const item of items) {
    const spacing = item.spacing || config.globalSpacing;
    const bleed = item.bleed || config.globalBleed;
    // 排版尺寸 = 原始尺寸 + 2*出血 + 间距
    const packedWidth = item.width + bleed * 2 + spacing;
    const packedHeight = item.height + bleed * 2 + spacing;

    for (let i = 0; i < item.quantity; i++) {
      units.push({
        id: uid(),
        printItemId: item.id,
        instanceIndex: i,
        packedWidth,
        packedHeight,
        originalWidth: item.width,
        originalHeight: item.height,
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
 */
export function runLayout(items: PrintItem[], config: LayoutConfig): LayoutResult {
  const startTime = performance.now();

  // 展开 & 排序
  const allUnits = expandItems(items, config);
  const sorted = sortUnits(allUnits);

  const bins: MaxRectsBin[] = [];
  const placementMap: Map<number, Placement[]> = new Map(); // canvasIndex -> placements
  const unplaced: LayoutUnit[] = [];

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

    // 已有画布都放不下 → 新开一个画布
    if (!placed) {
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
        // 单个元素比画布还大，无法放置
        unplaced.push(unit);
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
