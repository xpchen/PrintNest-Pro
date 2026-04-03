/**
 * 主进程 app:command → Store / 服务（计划：业务命令统一入口）
 */
import { AppCommand } from '../../shared/commands/appCommands';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../utils/toast';
import {
  createAndOpenNewProject,
  openCurrentProjectFolder,
  openRecentProject,
} from '../services/projectActions';

export function dispatchAppCommand(id: string, _payload?: unknown): void {
  const get = useAppStore.getState;

  switch (id) {
    case AppCommand.FILE_NEW_PROJECT:
      void createAndOpenNewProject();
      break;
    case AppCommand.FILE_OPEN_RECENT:
      void openRecentProject();
      break;
    case AppCommand.FILE_OPEN_CURRENT_PROJECT_FOLDER:
      void openCurrentProjectFolder();
      break;
    case AppCommand.FILE_IMPORT_IMAGES:
      get().requestImportImages();
      break;
    case AppCommand.FILE_IMPORT_EXCEL:
      get().requestImportExcel();
      break;
    case AppCommand.FILE_EXPORT_PDF:
      get().requestExportCurrentPdf();
      break;
    case AppCommand.FILE_EXPORT_RUN_PDF:
      get().requestExportHistoricalRunPdf();
      break;
    case AppCommand.FILE_CLOSE_PROJECT:
      get().resetWorkspaceToEmpty();
      showToast('已关闭项目');
      break;
    case AppCommand.FILE_QUIT:
      break;

    case AppCommand.EDIT_DELETE:
      get().deleteSelected();
      break;
    case AppCommand.EDIT_SELECT_ALL: {
      const r = get().result;
      const idx = get().activeCanvasIndex;
      if (!r?.canvases[idx]) break;
      get().setSelectedIds(r.canvases[idx].placements.map((p) => p.id));
      break;
    }
    case AppCommand.EDIT_DESELECT:
      get().setSelectedIds([]);
      break;

    case AppCommand.VIEW_FIT_ALL:
      get().applyViewFitAll();
      break;
    case AppCommand.VIEW_FIT_WIDTH:
      get().applyViewFitWidth();
      break;
    case AppCommand.VIEW_ACTUAL_100:
      get().applyViewActual100();
      break;
    case AppCommand.VIEW_ZOOM_IN:
      get().setZoom(get().zoom * 1.12);
      break;
    case AppCommand.VIEW_ZOOM_OUT:
      get().setZoom(get().zoom / 1.12);
      break;
    case AppCommand.VIEW_TOGGLE_GRID:
      get().setShowGrid(!get().showGrid);
      break;
    case AppCommand.VIEW_TOGGLE_RULER:
      get().setShowRuler(!get().showRuler);
      break;
    case AppCommand.VIEW_TOGGLE_SAFE_MARGIN:
      get().setShowSafeMargin(!get().showSafeMargin);
      break;
    case AppCommand.VIEW_TOGGLE_MINIMAP:
      get().setOverviewVisible(!get().overviewVisible);
      break;
    case AppCommand.VIEW_TOGGLE_LEFT_PANEL:
      get().toggleLeftDock();
      break;
    case AppCommand.VIEW_TOGGLE_RIGHT_PANEL:
      get().toggleRightDock();
      break;
    case AppCommand.VIEW_TOGGLE_STATUS:
      get().toggleStatusBar();
      break;
    case AppCommand.VIEW_SEGMENT_HEAD:
      get().jumpViewHead();
      break;
    case AppCommand.VIEW_SEGMENT_MID:
      get().jumpViewMid();
      break;
    case AppCommand.VIEW_SEGMENT_TAIL:
      get().jumpViewTail();
      break;
    case AppCommand.VIEW_OPEN_RUN_PANEL:
      get().setRunPanelVisible(true);
      get().setSidebarTab('run');
      get().expandLeftDock();
      showToast('已切换到左侧「Run」');
      break;

    case AppCommand.LAYOUT_RUN:
      void get().runAutoLayout();
      break;
    case AppCommand.LAYOUT_CANCEL:
      get().cancelLayoutJob();
      break;
    case AppCommand.LAYOUT_TOGGLE_SINGLE_CANVAS:
      get().setConfig({ singleCanvas: !get().config.singleCanvas });
      break;

    case AppCommand.RUN_EXPORT_LATEST_PDF:
      get().requestExportHistoricalRunPdf();
      break;

    case AppCommand.HELP_SHORTCUTS:
      showToast('快捷键：Ctrl+L 排版 · Ctrl+0 适配整张 · Ctrl+1 适配宽度 · Ctrl+2 100%');
      break;
    case AppCommand.HELP_ABOUT:
      showToast('PrintNest Pro — 印智排版系统');
      break;

    default:
      console.warn('[commandRegistry] unknown command', id);
  }
}
