/**
 * 全局快捷键 hook
 *
 * 统一处理全局快捷键，按 editorWorkMode 路由：
 * - Ctrl+Z / Ctrl+Shift+Z: Undo/Redo（已在 useHistoryShortcuts 处理）
 * - Ctrl+S: 立即触发保存
 * - Delete/Backspace: 删除选中
 * - Ctrl+C/V: 复制/粘贴（模板模式）
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

function isInputFocused(): boolean {
  const tag = (document.activeElement as HTMLElement)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useGlobalKeyboard(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      const isMod = e.metaKey || e.ctrlKey;
      const s = useAppStore.getState();

      // Ctrl+S — 立即保存（阻止浏览器默认保存）
      if (isMod && e.key === 's') {
        e.preventDefault();
        // auto-save 会自动触发，这里只是减少 debounce 等待
        return;
      }

      // Delete/Backspace — 删除选中
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (s.editorWorkMode === 'template') {
          const tplId = s.currentTemplateId;
          if (!tplId) return;
          for (const elId of [...s.selectedElementIds]) {
            s.removeElement(tplId, elId);
          }
        } else {
          s.deleteSelected();
        }
        return;
      }

      // Ctrl+C — 复制（模板模式）
      if (isMod && e.key === 'c' && s.editorWorkMode === 'template') {
        e.preventDefault();
        s.copySelectedElements();
        return;
      }

      // Ctrl+V — 粘贴（模板模式）
      if (isMod && e.key === 'v' && s.editorWorkMode === 'template') {
        e.preventDefault();
        s.pasteElements();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
