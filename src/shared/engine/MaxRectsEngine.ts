/**
 * MaxRects Bin Packing Algorithm
 * 基于 MaxRects 的矩形装箱算法实现
 *
 * 核心思想：维护一组"最大空闲矩形"，每次放入新矩形时，
 * 从空闲矩形中找到最优位置，然后分割受影响的空闲矩形，
 * 并移除被完全包含的冗余矩形。
 */

import { PackingStrategy } from '../types';

/** 矩形定义 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 待放置的矩形 */
export interface PackingItem {
  id: string;
  width: number;
  height: number;
  allowRotation: boolean;
}

/** 放置结果 */
export interface PackingResult {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
}

/**
 * MaxRects 单画布装箱器
 */
export class MaxRectsBin {
  private binWidth: number;
  private binHeight: number;
  private freeRects: Rect[];
  private usedRects: PackingResult[];

  constructor(width: number, height: number) {
    this.binWidth = width;
    this.binHeight = height;
    this.freeRects = [{ x: 0, y: 0, width, height }];
    this.usedRects = [];
  }

  get placements(): PackingResult[] {
    return [...this.usedRects];
  }

  /** 计算利用率 */
  get utilization(): number {
    const usedArea = this.usedRects.reduce((sum, r) => sum + r.width * r.height, 0);
    return usedArea / (this.binWidth * this.binHeight);
  }

  /**
   * 尝试放置一个矩形
   * @returns 放置结果，null 表示放不下
   */
  insert(item: PackingItem, strategy: PackingStrategy): PackingResult | null {
    const result = this.findBestPosition(item.width, item.height, item.allowRotation, strategy);
    if (!result) return null;

    const placement: PackingResult = {
      id: item.id,
      ...result,
    };

    // 分割所有与新放置矩形重叠的空闲矩形
    this.splitFreeRects(result);
    // 移除被完全包含的冗余空闲矩形
    this.pruneFreeRects();

    this.usedRects.push(placement);
    return placement;
  }

  /**
   * 根据策略找到最佳放置位置
   */
  private findBestPosition(
    width: number,
    height: number,
    allowRotation: boolean,
    strategy: PackingStrategy
  ): { x: number; y: number; width: number; height: number; rotated: boolean } | null {
    let bestScore1 = Infinity;
    let bestScore2 = Infinity;
    let bestResult: { x: number; y: number; width: number; height: number; rotated: boolean } | null = null;

    for (const freeRect of this.freeRects) {
      // 尝试不旋转
      if (width <= freeRect.width && height <= freeRect.height) {
        const { score1, score2 } = this.score(freeRect, width, height, strategy);
        if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
          bestScore1 = score1;
          bestScore2 = score2;
          bestResult = { x: freeRect.x, y: freeRect.y, width, height, rotated: false };
        }
      }

      // 尝试旋转90°
      if (allowRotation && height <= freeRect.width && width <= freeRect.height) {
        const { score1, score2 } = this.score(freeRect, height, width, strategy);
        if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
          bestScore1 = score1;
          bestScore2 = score2;
          bestResult = { x: freeRect.x, y: freeRect.y, width: height, height: width, rotated: true };
        }
      }
    }

    return bestResult;
  }

  /**
   * 根据不同策略计算得分（越小越好）
   */
  private score(
    freeRect: Rect,
    width: number,
    height: number,
    strategy: PackingStrategy
  ): { score1: number; score2: number } {
    switch (strategy) {
      case PackingStrategy.BestShortSideFit: {
        const leftoverH = Math.abs(freeRect.width - width);
        const leftoverV = Math.abs(freeRect.height - height);
        return { score1: Math.min(leftoverH, leftoverV), score2: Math.max(leftoverH, leftoverV) };
      }
      case PackingStrategy.BestLongSideFit: {
        const leftoverH = Math.abs(freeRect.width - width);
        const leftoverV = Math.abs(freeRect.height - height);
        return { score1: Math.max(leftoverH, leftoverV), score2: Math.min(leftoverH, leftoverV) };
      }
      case PackingStrategy.BestAreaFit: {
        const areaFit = freeRect.width * freeRect.height - width * height;
        const shortSide = Math.min(Math.abs(freeRect.width - width), Math.abs(freeRect.height - height));
        return { score1: areaFit, score2: shortSide };
      }
      case PackingStrategy.BottomLeft: {
        return { score1: freeRect.y + height, score2: freeRect.x };
      }
      default:
        return { score1: 0, score2: 0 };
    }
  }

  /**
   * 分割与新放置矩形重叠的空闲矩形
   */
  private splitFreeRects(placed: { x: number; y: number; width: number; height: number }) {
    const newFreeRects: Rect[] = [];

    for (let i = this.freeRects.length - 1; i >= 0; i--) {
      const free = this.freeRects[i];

      // 不重叠则跳过
      if (
        placed.x >= free.x + free.width ||
        placed.x + placed.width <= free.x ||
        placed.y >= free.y + free.height ||
        placed.y + placed.height <= free.y
      ) {
        continue;
      }

      // 从四个方向分割出新的空闲矩形
      // 左侧
      if (placed.x > free.x) {
        newFreeRects.push({
          x: free.x,
          y: free.y,
          width: placed.x - free.x,
          height: free.height,
        });
      }
      // 右侧
      if (placed.x + placed.width < free.x + free.width) {
        newFreeRects.push({
          x: placed.x + placed.width,
          y: free.y,
          width: free.x + free.width - (placed.x + placed.width),
          height: free.height,
        });
      }
      // 上方
      if (placed.y > free.y) {
        newFreeRects.push({
          x: free.x,
          y: free.y,
          width: free.width,
          height: placed.y - free.y,
        });
      }
      // 下方
      if (placed.y + placed.height < free.y + free.height) {
        newFreeRects.push({
          x: free.x,
          y: placed.y + placed.height,
          width: free.width,
          height: free.y + free.height - (placed.y + placed.height),
        });
      }

      // 移除被分割的原空闲矩形
      this.freeRects.splice(i, 1);
    }

    this.freeRects.push(...newFreeRects);
  }

  /**
   * 移除被其他空闲矩形完全包含的冗余矩形
   */
  private pruneFreeRects() {
    for (let i = this.freeRects.length - 1; i >= 0; i--) {
      for (let j = this.freeRects.length - 1; j >= 0; j--) {
        if (i === j) continue;
        if (this.isContainedIn(this.freeRects[i], this.freeRects[j])) {
          this.freeRects.splice(i, 1);
          break;
        }
      }
    }
  }

  /** 判断 a 是否完全被 b 包含 */
  private isContainedIn(a: Rect, b: Rect): boolean {
    return a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
  }
}
