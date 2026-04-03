import type { StateCreator } from 'zustand';
import type { AppState } from '../types';
import type { UiShellSlice, RightDockTab } from '../types';

export const createUiShellSlice: StateCreator<AppState, [], [], UiShellSlice> = (set, get) => ({
  leftDockCollapsed: false,
  rightDockCollapsed: false,
  rightTab: 'properties',

  toggleLeftDock: () => set((s) => ({ leftDockCollapsed: !s.leftDockCollapsed })),
  toggleRightDock: () => set((s) => ({ rightDockCollapsed: !s.rightDockCollapsed })),
  setRightTab: (tab: RightDockTab) => set({ rightTab: tab }),
  expandLeftDock: () => set({ leftDockCollapsed: false }),
  expandRightDock: () => set({ rightDockCollapsed: false }),
});

export function loadUiShellFromStorage(projectId: string): Partial<Pick<AppState, 'leftDockCollapsed' | 'rightDockCollapsed' | 'rightTab' | 'sidebarTab'>> {
  try {
    const raw = localStorage.getItem(`pn-ui-shell-${projectId}`);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const rightTab = o.rightTab as RightDockTab | undefined;
    const sidebarTab = o.sidebarTab as 'materials' | 'validation' | 'run' | undefined;
    return {
      leftDockCollapsed: Boolean(o.leftDockCollapsed),
      rightDockCollapsed: Boolean(o.rightDockCollapsed),
      ...(rightTab === 'properties' || rightTab === 'project' || rightTab === 'canvas' ? { rightTab } : {}),
      ...(sidebarTab === 'materials' || sidebarTab === 'validation' || sidebarTab === 'run' ? { sidebarTab } : {}),
    };
  } catch {
    return {};
  }
}

export function persistUiShellToStorage(state: AppState): void {
  try {
    const { currentProjectId, leftDockCollapsed, rightDockCollapsed, rightTab, sidebarTab } = state;
    localStorage.setItem(
      `pn-ui-shell-${currentProjectId}`,
      JSON.stringify({ leftDockCollapsed, rightDockCollapsed, rightTab, sidebarTab }),
    );
  } catch {
    /* ignore */
  }
}
