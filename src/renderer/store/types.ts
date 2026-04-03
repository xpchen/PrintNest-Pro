import type { PrintItem, Placement, LayoutConfig, LayoutResult } from '../../shared/types';
import { PackingStrategy } from '../../shared/types';

export interface ProjectSlice {
  items: PrintItem[];
  config: LayoutConfig;
  /** 显示用项目名（与目录 id 可不同） */
  projectName: string;
  currentProjectId: string;
  layoutSourceSignature: string | null;
  setProjectName: (name: string) => void;
  hydrateFromEditorState: (payload: {
    projectName: string;
    config: LayoutConfig;
    items: PrintItem[];
    result: LayoutResult | null;
    layoutSourceSignature: string | null;
  }) => void;
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
  /** Electron：首页与编辑器壳切换 */
  uiPhase: 'home' | 'editor';
  setUiPhase: (phase: 'home' | 'editor') => void;
  resetWorkspaceToEmpty: () => void;
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
  /** 最近一次主进程落库的 layout_run id */
  lastLayoutRunId: string | null;
  /** 0–100，会话态不入自动保存 */
  layoutProgress: number;
  runAutoLayout: () => Promise<void>;
  cancelLayoutJob: () => void;
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
