import type { StateCreator } from 'zustand';
import type { AppState, LeftTaskTab, UiShellSlice } from '../types';
import { isDisplayLengthUnit } from '../../utils/lengthDisplay';

function migrateLeftTaskTab(raw: unknown): LeftTaskTab | undefined {
  if (raw === 'project' || raw === 'resources' || raw === 'layoutTask' || raw === 'qaOutput') return raw;
  if (raw === 'materials') return 'resources';
  if (raw === 'validation' || raw === 'run') return 'qaOutput';
  return undefined;
}

const emptyConfirmDialog = (): AppState['confirmDialog'] => ({
  open: false,
  title: '',
  message: '',
  resolve: null,
});

export const createUiShellSlice: StateCreator<AppState, [], [], UiShellSlice> = (set, get) => ({
  leftDockCollapsed: false,
  rightDockCollapsed: false,
  saveStatus: 'idle' as const,
  confirmDialog: emptyConfirmDialog(),

  toggleLeftDock: () => set((s) => ({ leftDockCollapsed: !s.leftDockCollapsed })),
  toggleRightDock: () => set((s) => ({ rightDockCollapsed: !s.rightDockCollapsed })),
  expandLeftDock: () => set({ leftDockCollapsed: false }),
  expandRightDock: () => set({ rightDockCollapsed: false }),
  setSaveStatus: (status) => set({ saveStatus: status }),

  showConfirm: (opts) =>
    new Promise<boolean>((resolve) => {
      // 如果已有未关闭的 dialog，先 dismiss 它
      const prev = get().confirmDialog;
      if (prev.open && prev.resolve) prev.resolve(false);
      set({
        confirmDialog: {
          open: true,
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel,
          danger: opts.danger,
          resolve,
        },
      });
    }),

  dismissConfirm: (confirmed) => {
    const { resolve } = get().confirmDialog;
    if (resolve) resolve(confirmed);
    set({ confirmDialog: emptyConfirmDialog() });
  },
});

export function loadUiShellFromStorage(
  projectId: string,
): Partial<
  Pick<AppState, 'leftDockCollapsed' | 'rightDockCollapsed' | 'sidebarTab' | 'editorWorkMode' | 'displayUnit'>
> {
  try {
    const raw = localStorage.getItem(`pn-ui-shell-${projectId}`);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const sidebarTab = migrateLeftTaskTab(o.sidebarTab);
    const mode = o.editorWorkMode;
    const editorWorkMode =
      mode === 'resources' || mode === 'template' || mode === 'layout' || mode === 'output' ? mode : undefined;
    const displayUnit = isDisplayLengthUnit(o.displayUnit) ? o.displayUnit : undefined;
    return {
      leftDockCollapsed: Boolean(o.leftDockCollapsed),
      rightDockCollapsed: Boolean(o.rightDockCollapsed),
      ...(sidebarTab ? { sidebarTab } : {}),
      ...(editorWorkMode ? { editorWorkMode } : {}),
      ...(displayUnit ? { displayUnit } : {}),
    };
  } catch {
    return {};
  }
}

export function persistUiShellToStorage(state: AppState): void {
  try {
    const {
      currentProjectId,
      leftDockCollapsed,
      rightDockCollapsed,
      sidebarTab,
      editorWorkMode,
      displayUnit,
    } = state;
    localStorage.setItem(
      `pn-ui-shell-${currentProjectId}`,
      JSON.stringify({ leftDockCollapsed, rightDockCollapsed, sidebarTab, editorWorkMode, displayUnit }),
    );
  } catch {
    /* ignore */
  }
}
