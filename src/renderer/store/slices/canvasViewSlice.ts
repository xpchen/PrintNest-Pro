import type { StateCreator } from 'zustand';
import type { AppState, CanvasViewSlice, CanvasViewMode } from '../types';
import {
  applyActual100,
  applyFitAll,
  applyFitWidth,
  focusRectInViewport,
} from '../../utils/viewportFocus';

export const createCanvasViewSlice: StateCreator<AppState, [], [], CanvasViewSlice> = (set, get) => ({
  activeCanvasIndex: 0,
  zoom: 0.5,
  showGrid: true,
  showRuler: true,
  showSafeMargin: true,
  snapMm: 5,

  viewMode: 'custom' as CanvasViewMode,
  panOffset: { x: 30, y: 10 },
  overviewVisible: true,
  segmentSizeMm: 1000,
  activeSegmentIndex: 0,
  viewportContainerPx: { width: 0, height: 0 },

  statusBarVisible: true,

  importModalNonce: 0,
  excelImportNonce: 0,
  runPanelVisible: false,
  sidebarTab: 'materials',

  setActiveCanvas: (index) => set({ activeCanvasIndex: index }),

  setZoom: (zoom) => set({ zoom: Math.max(0.02, Math.min(8, zoom)), viewMode: 'custom' }),

  setShowGrid: (v) => set({ showGrid: v }),
  setShowRuler: (v) => set({ showRuler: v }),
  setShowSafeMargin: (v) => set({ showSafeMargin: v }),
  setSnapMm: (mm) => set({ snapMm: Math.max(1, Math.min(50, mm)) }),

  setPanOffset: (p) => set({ panOffset: p, viewMode: 'custom' }),

  setViewportContainerPx: (width, height) => set({ viewportContainerPx: { width, height } }),

  setOverviewVisible: (v) => set({ overviewVisible: v }),

  setSegmentSizeMm: (mm) => set({ segmentSizeMm: Math.max(100, mm) }),

  setActiveSegmentIndex: (i) => set({ activeSegmentIndex: Math.max(0, i) }),

  applyViewFitAll: () => applyFitAll(get, set),
  applyViewFitWidth: () => applyFitWidth(get, set),
  applyViewActual100: () => applyActual100(set),

  toggleStatusBar: () => set((s) => ({ statusBarVisible: !s.statusBarVisible })),
  toggleRunPanel: () => set((s) => ({ runPanelVisible: !s.runPanelVisible })),
  setRunPanelVisible: (v) => set({ runPanelVisible: v }),
  setSidebarTab: (t) => set({ sidebarTab: t }),

  requestImportImages: () => set((s) => ({ importModalNonce: s.importModalNonce + 1 })),
  requestImportExcel: () => set((s) => ({ excelImportNonce: s.excelImportNonce + 1 })),

  focusRectInCanvas: (rect, opts) => focusRectInViewport(get, set, rect, opts),

  jumpViewHead: () => {
    const s = get();
    set({ panOffset: { x: s.panOffset.x, y: 0 }, viewMode: 'custom', activeSegmentIndex: 0 });
  },

  jumpViewMid: () => {
    const s = get();
    const { config } = s;
    const z = s.zoom;
    const ch = s.viewportContainerPx.height;
    const canvasH = config.canvas.height;
    const oy = ch / 2 - (z * canvasH) / 2;
    set({ panOffset: { x: s.panOffset.x, y: oy }, viewMode: 'custom' });
  },

  jumpViewTail: () => {
    const s = get();
    const z = s.zoom;
    const ch = s.viewportContainerPx.height;
    const canvasH = s.config.canvas.height;
    const oy = ch - z * canvasH;
    set({ panOffset: { x: s.panOffset.x, y: oy }, viewMode: 'custom' });
  },

  jumpToSegment: (index) => {
    const s = get();
    const canvasW = s.config.canvas.width;
    const canvasH = s.config.canvas.height;
    const seg = s.segmentSizeMm;
    const y0 = index * seg;
    if (y0 >= canvasH) return;
    focusRectInViewport(
      get,
      set,
      { x: 0, y: y0, width: canvasW, height: Math.min(seg, canvasH - y0) },
      { mode: 'top', paddingMm: 4 },
    );
    set({ activeSegmentIndex: index });
  },
});
