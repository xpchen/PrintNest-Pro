/**
 * UI Shell 持久化 hook
 *
 * 负责：
 * 1. 项目切换时从 localStorage 恢复 UI 偏好（侧栏、面板、模式等）
 * 2. UI 状态变化时 debounce 写入 localStorage
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { loadUiShellFromStorage, persistUiShellToStorage } from '../store/slices/uiShellSlice';

export function useUiShellPersistence(
  currentProjectId: string,
  uiPhase: string,
): void {
  // 恢复 UI 偏好
  useEffect(() => {
    if (uiPhase !== 'editor') return;
    const patch = loadUiShellFromStorage(currentProjectId);
    if (Object.keys(patch).length > 0) {
      useAppStore.setState(patch);
    }
  }, [currentProjectId, uiPhase]);

  // 持久化 UI 状态
  useEffect(() => {
    let t: number | undefined;
    return useAppStore.subscribe((state) => {
      if (state.uiPhase !== 'editor') return;
      if (t !== undefined) window.clearTimeout(t);
      t = window.setTimeout(() => {
        t = undefined;
        persistUiShellToStorage(state);
      }, 400);
    });
  }, []);
}
