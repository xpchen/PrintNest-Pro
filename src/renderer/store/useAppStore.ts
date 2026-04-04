/**
 * 全局 Zustand Store — 由 project / selection / 画布视图 / 排版任务 / UI shell / 模板 六切片组合
 * + zundo temporal middleware 提供 undo/redo
 */
import { create } from 'zustand';
import { temporal } from 'zundo';
import type { AppState } from './types';
import { createProjectSlice } from './slices/projectSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createCanvasViewSlice } from './slices/canvasViewSlice';
import { createLayoutJobSlice } from './slices/layoutJobSlice';
import { createUiShellSlice } from './slices/uiShellSlice';
import { createTemplateSlice } from './slices/templateSlice';

export const useAppStore = create<AppState>()(
  temporal(
    (...args) => ({
      ...createProjectSlice(...args),
      ...createSelectionSlice(...args),
      ...createCanvasViewSlice(...args),
      ...createLayoutJobSlice(...args),
      ...createUiShellSlice(...args),
      ...createTemplateSlice(...args),
    }),
    {
      // 只追踪业务状态，排除 UI/视图状态
      partialize: (state) => ({
        items: state.items,
        config: state.config,
        result: state.result,
        manualEdits: state.manualEdits,
        manualEditNextRevision: state.manualEditNextRevision,
        selectedIds: state.selectedIds,
        projectName: state.projectName,
      }),
      limit: 50,
    },
  ),
);

export type { AppState, AlignMode, EditorWorkMode, LeftTaskTab, SaveStatus } from './types';
export { genId, nextColor } from './itemUtils';
