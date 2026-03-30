/**
 * 全局状态管理 - Zustand Store
 */
import { create } from 'zustand';
import {
  PrintItem,
  Placement,
  LayoutConfig,
  LayoutResult,
  PackingStrategy,
} from '../../shared/types';
import { runLayout } from '../../shared/engine';

/** 随机颜色生成 */
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F0B27A', '#82E0AA', '#F1948A', '#85929E', '#73C6B6',
];
let colorIdx = 0;
export function nextColor(): string {
  return COLORS[colorIdx++ % COLORS.length];
}

/** 生成唯一 ID */
let _id = 0;
export function genId(): string {
  return `item_${++_id}_${Date.now()}`;
}

interface AppState {
  // 素材列表
  items: PrintItem[];
  // 排版配置
  config: LayoutConfig;
  // 排版结果
  result: LayoutResult | null;
  // 当前选中的画布索引
  activeCanvasIndex: number;
  // 选中的 Placement ID 列表
  selectedIds: string[];
  // 是否正在计算
  isComputing: boolean;
  // 缩放比例
  zoom: number;

  // Actions
  addItem: (item: Omit<PrintItem, 'id' | 'color' | 'priority' | 'allowRotation' | 'spacing' | 'bleed'> & Partial<PrintItem>) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<PrintItem>) => void;
  clearItems: () => void;
  setConfig: (patch: Partial<LayoutConfig>) => void;
  setCanvasSize: (width: number, height: number) => void;
  runAutoLayout: () => void;
  setActiveCanvas: (index: number) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleLock: (placementId: string) => void;
  batchLock: (ids: string[], locked: boolean) => void;
  deleteSelected: () => void;
  updatePlacement: (placementId: string, patch: Partial<Placement>) => void;
  duplicateItem: (printItemId: string) => void;
  setZoom: (zoom: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  items: [],
  config: {
    canvas: { width: 1000, height: 1500 },
    strategy: PackingStrategy.BestShortSideFit,
    allowRotation: true,
    globalSpacing: 2,
    globalBleed: 3,
  },
  result: null,
  activeCanvasIndex: 0,
  selectedIds: [],
  isComputing: false,
  zoom: 0.5,

  addItem: (partial) => {
    const item: PrintItem = {
      id: genId(),
      name: partial.name,
      width: partial.width,
      height: partial.height,
      quantity: partial.quantity,
      imageSrc: partial.imageSrc,
      group: partial.group,
      priority: partial.priority ?? 0,
      allowRotation: partial.allowRotation ?? true,
      spacing: partial.spacing ?? 0,
      bleed: partial.bleed ?? 0,
      color: partial.color ?? nextColor(),
    };
    set((s) => ({ items: [...s.items, item] }));
  },

  removeItem: (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  updateItem: (id, patch) => {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  },

  clearItems: () => {
    set({ items: [], result: null, selectedIds: [] });
  },

  setConfig: (patch) => {
    set((s) => ({ config: { ...s.config, ...patch } }));
  },

  setCanvasSize: (width, height) => {
    set((s) => ({ config: { ...s.config, canvas: { width, height } } }));
  },

  runAutoLayout: () => {
    set({ isComputing: true });
    setTimeout(() => {
      const { items, config, result: prevResult } = get();
      // 收集所有画布中的锁定元素
      const locked: Placement[] = [];
      if (prevResult) {
        for (const c of prevResult.canvases) {
          for (const p of c.placements) {
            if (p.locked) locked.push(p);
          }
        }
      }
      const result = runLayout(items, config, locked.length > 0 ? locked : undefined);
      set({ result, isComputing: false, activeCanvasIndex: 0, selectedIds: [] });
    }, 10);
  },

  setActiveCanvas: (index) => set({ activeCanvasIndex: index }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleLock: (placementId) => {
    set((s) => {
      if (!s.result) return s;
      const newCanvases = s.result.canvases.map((c) => ({
        ...c,
        placements: c.placements.map((p) =>
          p.id === placementId ? { ...p, locked: !p.locked } : p
        ),
      }));
      return { result: { ...s.result, canvases: newCanvases } };
    });
  },

  batchLock: (ids, locked) => {
    set((s) => {
      if (!s.result) return s;
      const idSet = new Set(ids);
      const newCanvases = s.result.canvases.map((c) => ({
        ...c,
        placements: c.placements.map((p) =>
          idSet.has(p.id) ? { ...p, locked } : p
        ),
      }));
      return { result: { ...s.result, canvases: newCanvases } };
    });
  },

  deleteSelected: () => {
    set((s) => {
      if (!s.result || s.selectedIds.length === 0) return s;
      const idSet = new Set(s.selectedIds);
      const canvasArea = s.config.canvas.width * s.config.canvas.height;
      const newCanvases = s.result.canvases.map((c) => {
        const newPlacements = c.placements.filter((p) => !idSet.has(p.id));
        const used = newPlacements.reduce((sum, p) => sum + p.width * p.height, 0);
        return { ...c, placements: newPlacements, utilization: canvasArea > 0 ? used / canvasArea : 0 };
      });
      const totalUsed = newCanvases.reduce((s2, c) => s2 + c.placements.reduce((ss, p) => ss + p.width * p.height, 0), 0);
      const totalArea = newCanvases.length * canvasArea;
      return {
        result: { ...s.result, canvases: newCanvases, totalUtilization: totalArea > 0 ? totalUsed / totalArea : 0 },
        selectedIds: [],
      };
    });
  },

  updatePlacement: (placementId, patch) => {
    set((s) => {
      if (!s.result) return s;
      const newCanvases = s.result.canvases.map((c) => ({
        ...c,
        placements: c.placements.map((p) =>
          p.id === placementId ? { ...p, ...patch } : p
        ),
      }));
      return { result: { ...s.result, canvases: newCanvases } };
    });
  },

  duplicateItem: (printItemId) => {
    const item = get().items.find((i) => i.id === printItemId);
    if (!item) return;
    const newItem: PrintItem = {
      ...item,
      id: genId(),
      name: item.name + ' (副本)',
      color: nextColor(),
    };
    set((s) => ({ items: [...s.items, newItem] }));
  },

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),
}));
