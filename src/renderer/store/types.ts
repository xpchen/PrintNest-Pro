import type { PrintItem, Placement, LayoutConfig, LayoutResult, DataRecord, TemplateDefinition, TemplateInstance, TemplateElement } from '../../shared/types';
import { PackingStrategy } from '../../shared/types';
import type { ManualEditPatch } from '../../shared/persistence/manualEdits';
import type { DisplayLengthUnit } from '../utils/lengthDisplay';

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
  /** 当前草稿来源的历史 run id（恢复后设置，新排版后清除） */
  draftSourceRunId: string | null;
  setProjectName: (name: string) => void;
  hydrateFromEditorState: (payload: {
    projectName: string;
    config: LayoutConfig;
    items: PrintItem[];
    result: LayoutResult | null;
    layoutSourceSignature: string | null;
    manualEdits?: ManualEditPatch[];
    dataRecords?: DataRecord[];
    templates?: TemplateDefinition[];
    templateInstances?: TemplateInstance[];
    activeTemplateId?: string | null;
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

/** 左侧任务栏四段 */
export type LeftTaskTab = 'project' | 'resources' | 'layoutTask' | 'qaOutput';

/** 顶栏工作模式（模板/输出为壳层占位，后续接实页） */
export type EditorWorkMode = 'resources' | 'template' | 'layout' | 'output';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UiShellSlice {
  leftDockCollapsed: boolean;
  rightDockCollapsed: boolean;
  saveStatus: SaveStatus;
  toggleLeftDock: () => void;
  toggleRightDock: () => void;
  expandLeftDock: () => void;
  expandRightDock: () => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export interface CanvasViewSlice {
  activeCanvasIndex: number;
  zoom: number;
  showGrid: boolean;
  showRuler: boolean;
  showSafeMargin: boolean;
  snapMm: number;
  /** 画布与只读标签的显示单位；存储与引擎仍为 mm */
  displayUnit: DisplayLengthUnit;
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
  /** 左侧任务栏当前段 */
  sidebarTab: LeftTaskTab;
  editorWorkMode: EditorWorkMode;
  /** 画布上指针位置 mm（状态栏用，可为 null） */
  canvasPointerMm: { x: number; y: number } | null;

  setActiveCanvas: (index: number) => void;
  setZoom: (zoom: number) => void;
  setShowGrid: (v: boolean) => void;
  setShowRuler: (v: boolean) => void;
  setShowSafeMargin: (v: boolean) => void;
  setSnapMm: (mm: number) => void;
  setDisplayUnit: (unit: DisplayLengthUnit) => void;

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
  setSidebarTab: (t: LeftTaskTab) => void;
  setEditorWorkMode: (m: EditorWorkMode) => void;
  setCanvasPointerMm: (p: { x: number; y: number } | null) => void;

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

  /* ── T02: patch-driven placement actions ── */
  togglePlacementHidden: (placementId: string) => void;
  duplicatePlacement: (placementId: string) => void;

  /** 从模板实例送入排版 */
  runAutoLayoutFromInstances: () => Promise<void>;
}

export interface TemplateSlice {
  dataRecords: DataRecord[];
  templates: TemplateDefinition[];
  templateInstances: TemplateInstance[];
  /** 当前编辑的模板 id */
  currentTemplateId: string | null;
  /** 当前选中的元素 id 列表 */
  selectedElementIds: string[];
  /** 当前预览用的 DataRecord id */
  previewRecordId: string | null;

  setDataRecords: (records: DataRecord[]) => void;
  clearDataRecords: () => void;
  addTemplate: (t: TemplateDefinition) => void;
  updateTemplate: (id: string, patch: Partial<TemplateDefinition>) => void;
  removeTemplate: (id: string) => void;
  setCurrentTemplate: (id: string | null) => void;
  selectElements: (ids: string[]) => void;
  setPreviewRecordId: (id: string | null) => void;
  setTemplateInstances: (instances: TemplateInstance[]) => void;

  /** 元素 CRUD（操作当前模板的 elements） */
  addElement: (templateId: string, element: TemplateElement) => void;
  updateElement: (templateId: string, elementId: string, patch: Partial<TemplateElement>) => void;
  removeElement: (templateId: string, elementId: string) => void;
  reorderElements: (templateId: string, orderedIds: string[]) => void;

  /** 批量实例化：对当前模板 × dataRecords 调用引擎 */
  instantiateAll: () => void;
}

export type AppState = ProjectSlice & SelectionSlice & CanvasViewSlice & LayoutJobSlice & UiShellSlice & TemplateSlice;

export const defaultConfig = (): LayoutConfig => ({
  canvas: { width: 1000, height: 1500 },
  strategy: PackingStrategy.BestShortSideFit,
  allowRotation: true,
  globalSpacing: 2,
  globalBleed: 3,
  singleCanvas: false,
});
