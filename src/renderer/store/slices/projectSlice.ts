import type { StateCreator } from 'zustand';
import type { PrintItem } from '../../../shared/types';
import type { AppState, ProjectSlice } from '../types';
import { defaultConfig } from '../types';
import { genId, nextColor } from '../itemUtils';
import { emptyEditorState } from '../../../shared/persistence/editorState';

function initialUiPhase(): 'home' | 'editor' {
  if (typeof window === 'undefined') return 'editor';
  return window.electronAPI ? 'home' : 'editor';
}

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set) => ({
  items: [],
  config: defaultConfig(),
  projectName: 'default',
  currentProjectId: 'default',
  layoutSourceSignature: null,
  uiPhase: initialUiPhase(),

  setUiPhase: (phase) => set({ uiPhase: phase }),

  resetWorkspaceToEmpty: () => {
    const blank = emptyEditorState('default');
    set({
      ...blank,
      currentProjectId: 'default',
      projectName: 'default',
      selectedIds: [],
      activeCanvasIndex: 0,
      uiPhase: 'home',
      isComputing: false,
      layoutProgress: 0,
      lastLayoutRunId: null,
    });
  },

  setProjectName: (name) => set({ projectName: name || '未命名项目' }),

  hydrateFromEditorState: (payload) =>
    set({
      projectName: payload.projectName,
      items: payload.items,
      config: payload.config,
      result: payload.result,
      layoutSourceSignature: payload.layoutSourceSignature,
      selectedIds: [],
      activeCanvasIndex: 0,
      uiPhase: 'editor',
      lastLayoutRunId: null,
      layoutProgress: 0,
      isComputing: false,
    }),

  addItem: (partial) => {
    const item: PrintItem = {
      id: genId(),
      name: partial.name,
      width: Number(partial.width) || 0,
      height: Number(partial.height) || 0,
      quantity: Math.max(1, Math.floor(Number(partial.quantity) || 1)),
      imageSrc: partial.imageSrc,
      assetId: partial.assetId,
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
    set({
      items: [],
      result: null,
      selectedIds: [],
      layoutSourceSignature: null,
    });
  },

  setConfig: (patch) => {
    set((s) => ({ config: { ...s.config, ...patch } }));
  },

  setCanvasSize: (width, height) => {
    set((s) => ({ config: { ...s.config, canvas: { width, height } } }));
  },

  setCurrentProjectId: (id) => set({ currentProjectId: id || 'default' }),

  duplicateItem: (printItemId) => {
    set((s) => {
      const item = s.items.find((i) => i.id === printItemId);
      if (!item) return s;
      const newItem: PrintItem = {
        ...item,
        id: genId(),
        name: item.name + ' (副本)',
        color: nextColor(),
      };
      return { items: [...s.items, newItem] };
    });
  },
});
