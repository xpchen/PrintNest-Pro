/**
 * 模板域独立 Undo/Redo 历史
 *
 * 跟踪模板编辑原语：templates, currentTemplateId。
 * selectedElementIds 包含在快照中用于恢复选区，但纯选区变化不触发入历史。
 * 不跟踪 dataRecords / templateInstances / preview cache / layout result。
 *
 * 与排版域 temporal (useAppStore.temporal) 互不干扰。
 */
import { create } from 'zustand';
import type { TemplateDefinition } from '../../shared/types';
import { useAppStore } from './useAppStore';

interface TemplateSnapshot {
  templates: TemplateDefinition[];
  currentTemplateId: string | null;
  selectedElementIds: string[];
}

interface TemplateHistoryState {
  /** 历史快照栈（不含当前状态） */
  past: TemplateSnapshot[];
  /** 重做栈 */
  future: TemplateSnapshot[];
  /** 是否正在回放（防止订阅循环） */
  _replaying: boolean;

  /** 推入当前状态快照（由外部订阅调用） */
  pushSnapshot: (snap: TemplateSnapshot) => void;
  /** 撤销 */
  undo: () => void;
  /** 重做 */
  redo: () => void;
  /** 清空历史 */
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const HISTORY_LIMIT = 50;

function takeSnapshot(): TemplateSnapshot {
  const s = useAppStore.getState();
  return {
    templates: s.templates,
    currentTemplateId: s.currentTemplateId,
    selectedElementIds: s.selectedElementIds,
  };
}

function applySnapshot(snap: TemplateSnapshot) {
  useAppStore.setState({
    templates: snap.templates,
    currentTemplateId: snap.currentTemplateId,
    selectedElementIds: snap.selectedElementIds,
  });
}

export const useTemplateHistory = create<TemplateHistoryState>((set, get) => ({
  past: [],
  future: [],
  _replaying: false,

  pushSnapshot: (snap) => {
    if (get()._replaying) return;
    set((s) => ({
      past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snap],
      future: [], // 新操作清空 redo 栈
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;

    const current = takeSnapshot();
    const prev = past[past.length - 1];

    set({ past: past.slice(0, -1), future: [current, ...get().future], _replaying: true });
    applySnapshot(prev);
    set({ _replaying: false });
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;

    const current = takeSnapshot();
    const next = future[0];

    set({ past: [...get().past, current], future: future.slice(1), _replaying: true });
    applySnapshot(next);
    set({ _replaying: false });
  },

  clear: () => set({ past: [], future: [] }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

/**
 * 初始化模板历史订阅。
 * 在 App 启动时调用一次。监听 templates / currentTemplateId 变化，
 * 每次变化时将变化前的快照推入历史栈。
 * 注意：纯 selectedElementIds 变化不触发入历史（选区不是编辑操作）。
 */
let _unsubscribe: (() => void) | null = null;

export function initTemplateHistorySubscription(): () => void {
  if (_unsubscribe) return _unsubscribe;

  let lastSnap = takeSnapshot();

  _unsubscribe = useAppStore.subscribe((state, prevState) => {
    if (useTemplateHistory.getState()._replaying) return;

    // 只在模板编辑相关字段变化时记录
    const changed =
      state.templates !== prevState.templates ||
      state.currentTemplateId !== prevState.currentTemplateId;

    if (changed) {
      useTemplateHistory.getState().pushSnapshot(lastSnap);
      lastSnap = {
        templates: state.templates,
        currentTemplateId: state.currentTemplateId,
        selectedElementIds: state.selectedElementIds,
      };
    }
  });

  return _unsubscribe;
}
