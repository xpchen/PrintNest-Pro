import type { PrintItem, Placement, LayoutConfig, LayoutResult } from '../../shared/types';
import { PackingStrategy } from '../../shared/types';
import type { ManualEditPatch } from '../../shared/persistence/manualEdits';

export interface ProjectSlice {
  items: PrintItem[];
  config: LayoutConfig;
  /** 手工编辑 patch 序列 */
  manualEdits: ManualEditPatch[];
  manualEditNextRevision: number;
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
    manualEdits?: ManualEditPatch[];
  }) => void;
  appendManualEdit: (patch: Omit<ManualEditPatch, 'revision' | 'updatedAt'>) => void;
  clearManualEdits: () => void;
  /** 将历史 run 恢复为当前可编辑草稿（清空 manual_edits） */
  restoreRunAsNewDraft: (payload: {
    result: LayoutResult;
    config: LayoutConfig;
    layoutRunId: string;
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

export type CanvasViewMode = 'fitAll' | 'fitWidth' | 'actual' | 'custom';

export type RightDockTab = 'properties' | 'project' | 'canvas';

export interface UiShellSlice {
  leftDockCollapsed: boolean;
  rightDockCollapsed: boolean;
  rightTab: RightDockTab;
  toggleLeftDock: () => void;
  toggleRightDock: () => void;
  setRightTab: (tab: RightDockTab) => void;
  expandLeftDock: () => void;
  expandRightDock: () => void;
}

export interface CanvasViewSlice {
  activeCanvasIndex: number;
  zoom: number;
  showGrid: boolean;
  showRuler: boolean;
  showSafeMargin: boolean;
  snapMm: number;
  viewMode: CanvasViewMode;
  /** 画布原点 (0,0) 在视图像素中的位置；见 viewportContract.md */
  panOffset: { x: number; y: number };
  overviewVisible: boolean;
  segmentSizeMm: number;
  activeSegmentIndex: number;
  viewportContainerPx: { width: number; height: number };

  statusBarVisible: boolean;

  importModalNonce: number;
  excelImportNonce: number;
  runPanelVisible: boolean;
  /** 左侧栏当前 Tab */
  sidebarTab: 'materials' | 'validation' | 'run';

  setActiveCanvas: (index: number) => void;
  setZoom: (zoom: number) => void;
  setShowGrid: (v: boolean) => void;
  setShowRuler: (v: boolean) => void;
  setShowSafeMargin: (v: boolean) => void;
  setSnapMm: (mm: number) => void;

  setPanOffset: (p: { x: number; y: number }) => void;
  setViewportContainerPx: (width: number, height: number) => void;
  setOverviewVisible: (v: boolean) => void;
  setSegmentSizeMm: (mm: number) => void;
  setActiveSegmentIndex: (i: number) => void;

  applyViewFitAll: () => void;
  applyViewFitWidth: () => void;
  applyViewActual100: () => void;

  toggleStatusBar: () => void;
  toggleRunPanel: () => void;
  setRunPanelVisible: (v: boolean) => void;
  setSidebarTab: (t: 'materials' | 'validation' | 'run') => void;

  requestImportImages: () => void;
  requestImportExcel: () => void;

  focusRectInCanvas: (
    rect: { x: number; y: number; width: number; height: number },
    opts: { mode: 'center' | 'top'; paddingMm?: number; paddingPx?: number },
  ) => void;

  jumpViewHead: () => void;
  jumpViewMid: () => void;
  jumpViewTail: () => void;
  jumpToSegment: (index: number) => void;
}

export interface LayoutJobSlice {
  result: LayoutResult | null;
  isComputing: boolean;
  /** 最近一次主进程落库的 layout_run id */
  lastLayoutRunId: string | null;
  /** 0–100，会话态不入自动保存 */
  layoutProgress: number;
  /** 菜单/命令触发 PDF 导出（Toolbar 监听 nonce） */
  exportPdfCurrentNonce: number;
  exportPdfHistoricalNonce: number;
  requestExportCurrentPdf: () => void;
  requestExportHistoricalRunPdf: () => void;

  runAutoLayout: () => Promise<void>;
  cancelLayoutJob: () => void;
  toggleLock: (placementId: string) => void;
  batchLock: (ids: string[], locked: boolean) => void;
  deleteSelected: () => void;
  updatePlacement: (placementId: string, patch: Partial<Placement>) => void;
  alignSelected: (mode: AlignMode) => void;
}

export type AppState = ProjectSlice & SelectionSlice & CanvasViewSlice & LayoutJobSlice & UiShellSlice;

export const defaultConfig = (): LayoutConfig => ({
  canvas: { width: 1000, height: 1500 },
  strategy: PackingStrategy.BestShortSideFit,
  allowRotation: true,
  globalSpacing: 2,
  globalBleed: 3,
  singleCanvas: false,
});
