/** 主进程菜单 → app:command → 渲染层 commandRegistry 使用的命令 ID */

export const AppCommand = {
  // File
  FILE_NEW_PROJECT: 'file:newProject',
  FILE_OPEN_RECENT: 'file:openRecent',
  /** 在资源管理器中打开当前 projectId 对应目录 */
  FILE_OPEN_CURRENT_PROJECT_FOLDER: 'file:openCurrentProjectFolder',
  FILE_OPEN_FOLDER: 'file:openProjectFolder',
  FILE_IMPORT_IMAGES: 'file:importImages',
  FILE_IMPORT_EXCEL: 'file:importExcel',
  FILE_EXPORT_PDF: 'file:exportPdf',
  FILE_EXPORT_RUN_PDF: 'file:exportHistoricalRunPdf',
  FILE_CLOSE_PROJECT: 'file:closeProject',
  FILE_QUIT: 'file:quit',

  // Edit
  EDIT_UNDO: 'edit:undo',
  EDIT_REDO: 'edit:redo',
  EDIT_DELETE: 'edit:delete',
  EDIT_SELECT_ALL: 'edit:selectAll',
  EDIT_DESELECT: 'edit:deselect',

  // View
  VIEW_FIT_ALL: 'view:fitAll',
  VIEW_FIT_WIDTH: 'view:fitWidth',
  VIEW_ACTUAL_100: 'view:actual100',
  VIEW_ZOOM_IN: 'view:zoomIn',
  VIEW_ZOOM_OUT: 'view:zoomOut',
  VIEW_TOGGLE_GRID: 'view:toggleGrid',
  VIEW_TOGGLE_RULER: 'view:toggleRuler',
  VIEW_TOGGLE_SAFE_MARGIN: 'view:toggleSafeMargin',
  VIEW_TOGGLE_MINIMAP: 'view:toggleMinimap',
  VIEW_TOGGLE_LEFT_PANEL: 'view:toggleLeftPanel',
  VIEW_TOGGLE_RIGHT_PANEL: 'view:toggleRightPanel',
  VIEW_TOGGLE_STATUS: 'view:toggleStatusBar',
  VIEW_SEGMENT_HEAD: 'view:segmentHead',
  VIEW_SEGMENT_MID: 'view:segmentMid',
  VIEW_SEGMENT_TAIL: 'view:segmentTail',
  VIEW_OPEN_RUN_PANEL: 'view:openRunPanel',

  // Layout
  LAYOUT_RUN: 'layout:run',
  LAYOUT_CANCEL: 'layout:cancel',
  LAYOUT_TOGGLE_SINGLE_CANVAS: 'layout:toggleSingleCanvas',

  // Run
  RUN_EXPORT_LATEST_PDF: 'run:exportLatestPdf',

  // Help
  HELP_SHORTCUTS: 'help:shortcuts',
  HELP_ABOUT: 'help:about',
} as const;

export type AppCommandId = (typeof AppCommand)[keyof typeof AppCommand];

export interface AppCommandPayload {
  id: string;
  payload?: unknown;
}
