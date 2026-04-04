/**
 * 项目启动引导 hook
 *
 * 负责：
 * 1. 检查上次打开的项目并自动加载
 * 2. 初始化模板域独立历史订阅
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { readLastProjectId } from '../components/project/ProjectHome';
import { initTemplateHistorySubscription } from '../store/useTemplateHistory';
import type { SerializedEditorState } from '../../shared/persistence/editorState';

export function useProjectBootstrap(): void {
  // 项目加载
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.loadProject || !api?.listProjects) {
      useAppStore.getState().setUiPhase('editor');
      return;
    }
    let cancelled = false;
    void (async () => {
      const list = await api.listProjects();
      const last = readLastProjectId();
      if (last && list.includes(last)) {
        const raw = await api.loadProject(last);
        if (cancelled) return;
        if (raw) {
          useAppStore.getState().setCurrentProjectId(last);
          useAppStore.getState().hydrateFromEditorState(raw as SerializedEditorState);
          return;
        }
      }
      if (!cancelled) useAppStore.getState().setUiPhase('home');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 模板历史订阅初始化
  useEffect(() => {
    const unsub = initTemplateHistorySubscription();
    return () => unsub();
  }, []);
}
