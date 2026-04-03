import type { StateCreator } from 'zustand';
import type { PrintItem } from '../../../shared/types';
import type { AppState, ProjectSlice } from '../types';
import { defaultConfig } from '../types';
import { genId, nextColor } from '../itemUtils';

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set) => ({
  items: [],
  config: defaultConfig(),
  currentProjectId: 'default',
  layoutSourceSignature: null,

  addItem: (partial) => {
    const item: PrintItem = {
      id: genId(),
      name: partial.name,
      width: Number(partial.width) || 0,
      height: Number(partial.height) || 0,
      quantity: Math.max(1, Math.floor(Number(partial.quantity) || 1)),
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
