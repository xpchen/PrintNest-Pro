/**
 * 测试工厂函数 — 快速创建类型安全的测试数据
 */
import type {
  PrintItem,
  LayoutConfig,
  LayoutResult,
  CanvasResult,
  Placement,
  LayoutUnit,
  Canvas,
} from '../shared/types';
import { PackingStrategy } from '../shared/types';

let _seq = 0;
function nextId(prefix = 'test'): string {
  return `${prefix}-${++_seq}`;
}

/** 重置序列号（用于需要确定性 ID 的测试） */
export function resetIdSeq(): void {
  _seq = 0;
}

const COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'];

export function createPrintItem(overrides?: Partial<PrintItem>): PrintItem {
  const id = overrides?.id ?? nextId('item');
  return {
    id,
    name: `物料-${id}`,
    width: 100,
    height: 80,
    quantity: 1,
    imageSrc: '',
    priority: 0,
    allowRotation: true,
    spacing: 0,
    bleed: 0,
    color: COLORS[_seq % COLORS.length],
    ...overrides,
  };
}

export function createCanvas(overrides?: Partial<Canvas>): Canvas {
  return {
    width: 1000,
    height: 800,
    ...overrides,
  };
}

export function createLayoutConfig(overrides?: Partial<LayoutConfig>): LayoutConfig {
  return {
    canvas: createCanvas(overrides?.canvas),
    strategy: PackingStrategy.BestShortSideFit,
    allowRotation: true,
    globalSpacing: 0,
    globalBleed: 0,
    singleCanvas: false,
    ...overrides,
  };
}

export function createPlacement(overrides?: Partial<Placement>): Placement {
  return {
    id: nextId('pl'),
    layoutUnitId: nextId('lu'),
    printItemId: nextId('item'),
    canvasIndex: 0,
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    rotated: false,
    locked: false,
    ...overrides,
  };
}

export function createLayoutUnit(overrides?: Partial<LayoutUnit>): LayoutUnit {
  return {
    id: nextId('lu'),
    printItemId: nextId('item'),
    instanceIndex: 0,
    packedWidth: 100,
    packedHeight: 80,
    originalWidth: 100,
    originalHeight: 80,
    allowRotation: true,
    priority: 0,
    color: '#ccc',
    imageSrc: '',
    ...overrides,
  };
}

export function createCanvasResult(overrides?: Partial<CanvasResult>): CanvasResult {
  return {
    index: 0,
    placements: [],
    utilization: 0,
    ...overrides,
  };
}

export function createLayoutResult(overrides?: Partial<LayoutResult>): LayoutResult {
  return {
    canvases: [createCanvasResult()],
    totalUtilization: 0,
    unplaced: [],
    elapsedMs: 0,
    ...overrides,
  };
}
