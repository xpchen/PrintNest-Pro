/**
 * 全局 Zustand Store — 由 project / selection / 画布视图 / 排版任务 四切片组合（第 6 周拆分）
 */
import { create } from 'zustand';
import type { AppState } from './types';
import { createProjectSlice } from './slices/projectSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createCanvasViewSlice } from './slices/canvasViewSlice';
import { createLayoutJobSlice } from './slices/layoutJobSlice';

export const useAppStore = create<AppState>()((...args) => ({
  ...createProjectSlice(...args),
  ...createSelectionSlice(...args),
  ...createCanvasViewSlice(...args),
  ...createLayoutJobSlice(...args),
}));

export type { AppState, AlignMode } from './types';
export { genId, nextColor } from './itemUtils';
