import type { PrintItem, Placement, LayoutConfig, LayoutResult } from '../../shared/types';
import { PackingStrategy } from '../../shared/types';

export interface ProjectSlice {
  items: PrintItem[];
  config: LayoutConfig;
  currentProjectId: string;
  layoutSourceSignature: string | null;
  addItem: (
    item: Omit<PrintItem, 'id' | 'color' | 'priority' | 'allowRotation' | 'spacing' | 'bleed'> & Partial<PrintItem>,
  ) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<PrintItem>) => void;
  clearItems: () => void;
  setConfig: (patch: Partial<LayoutConfig>) => void;
  setCanvasSize: (width: number, height: number) => void;
  setCurrentProjectId: (id: string) => void;
  duplicateItem: (printItemId: string) => void;
}

export interface SelectionSlice {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
}

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter';

export interface CanvasViewSlice {
  activeCanvasIndex: number;
  zoom: number;
  showGrid: boolean;
  showRuler: boolean;
  showSafeMargin: boolean;
  snapMm: number;
  setActiveCanvas: (index: number) => void;
  setZoom: (zoom: number) => void;
  setShowGrid: (v: boolean) => void;
  setShowRuler: (v: boolean) => void;
  setShowSafeMargin: (v: boolean) => void;
  setSnapMm: (mm: number) => void;
}

export interface LayoutJobSlice {
  result: LayoutResult | null;
  isComputing: boolean;
  runAutoLayout: () => Promise<void>;
  toggleLock: (placementId: string) => void;
  batchLock: (ids: string[], locked: boolean) => void;
  deleteSelected: () => void;
  updatePlacement: (placementId: string, patch: Partial<Placement>) => void;
  alignSelected: (mode: AlignMode) => void;
}

export type AppState = ProjectSlice & SelectionSlice & CanvasViewSlice & LayoutJobSlice;

export const defaultConfig = (): LayoutConfig => ({
  canvas: { width: 1000, height: 1500 },
  strategy: PackingStrategy.BestShortSideFit,
  allowRotation: true,
  globalSpacing: 2,
  globalBleed: 3,
  singleCanvas: false,
});
