import type { StateCreator } from 'zustand';
import type { AppState, CanvasViewSlice } from '../types';

export const createCanvasViewSlice: StateCreator<AppState, [], [], CanvasViewSlice> = (set) => ({
  activeCanvasIndex: 0,
  zoom: 0.5,
  showGrid: true,
  showRuler: true,
  showSafeMargin: true,
  snapMm: 5,

  setActiveCanvas: (index) => set({ activeCanvasIndex: index }),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),

  setShowGrid: (v) => set({ showGrid: v }),
  setShowRuler: (v) => set({ showRuler: v }),
  setShowSafeMargin: (v) => set({ showSafeMargin: v }),
  setSnapMm: (mm) => set({ snapMm: Math.max(1, Math.min(50, mm)) }),
});
