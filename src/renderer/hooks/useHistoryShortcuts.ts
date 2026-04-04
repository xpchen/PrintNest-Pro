/**
 * Ctrl+Z / Ctrl+Shift+Z 按 editorWorkMode 路由到对应 temporal store
 *
 * - 模板模式 → useTemplateHistory
 * - 其他模式 → useAppStore.temporal
 * - 输入框 focus 时不拦截
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useTemplateHistory } from '../store/useTemplateHistory';

export function useHistoryShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const mode = useAppStore.getState().editorWorkMode;
        if (mode === 'template') {
          useTemplateHistory.getState().undo();
        } else {
          useAppStore.temporal.getState().undo();
        }
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'Z') {
        e.preventDefault();
        const mode = useAppStore.getState().editorWorkMode;
        if (mode === 'template') {
          useTemplateHistory.getState().redo();
        } else {
          useAppStore.temporal.getState().redo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
