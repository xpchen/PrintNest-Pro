import type { StateCreator } from 'zustand';
import type { AppState, SelectionSlice } from '../types';

export const createSelectionSlice: StateCreator<AppState, [], [], SelectionSlice> = (set) => ({
  selectedIds: [],
  setSelectedIds: (ids) => set({ selectedIds: ids }),
});
