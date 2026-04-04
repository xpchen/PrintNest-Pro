/**
 * 项目自动保存 hook
 *
 * 监听 store 关键字段变化，debounce 2.5s 后调用 autoSaveProject。
 */
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../components/Toast';

export function useProjectAutoSave(): void {
  const saveTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.autoSaveProject) return;

    const flush = async () => {
      const s = useAppStore.getState();
      if (s.uiPhase === 'home') return;
      if (!s.config) return;
      useAppStore.getState().setSaveStatus('saving');
      try {
        // 剥离预览图 URL（blob: 和 data: 均为运行时资源，重启后从磁盘缓存恢复）
        const cleanItems = s.items.map((item) =>
          item.imageSrc?.startsWith('blob:') || item.imageSrc?.startsWith('data:')
            ? { ...item, imageSrc: undefined }
            : item,
        );
        await api.autoSaveProject!(s.currentProjectId, {
          projectName: s.projectName,
          items: cleanItems,
          config: s.config,
          result: s.result,
          layoutSourceSignature: s.layoutSourceSignature,
          manualEdits: s.manualEdits,
          dataRecords: s.dataRecords.length ? s.dataRecords : undefined,
          templates: s.templates.length ? s.templates : undefined,
          templateInstances: s.templateInstances.length ? s.templateInstances : undefined,
          activeTemplateId: s.currentTemplateId,
        });
        useAppStore.getState().setSaveStatus('saved');
      } catch (err) {
        useAppStore.getState().setSaveStatus('error');
        showToast('自动保存失败，请手动保存', 'error');
        window.electronAPI?.logError?.('auto-save failed', String(err));
      }
    };

    const schedule = () => {
      if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = undefined;
        flush();
      }, 2500);
    };

    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.uiPhase === 'home') return;
      if (
        state.items !== prev.items ||
        state.config !== prev.config ||
        state.result !== prev.result ||
        state.layoutSourceSignature !== prev.layoutSourceSignature ||
        state.projectName !== prev.projectName ||
        state.currentProjectId !== prev.currentProjectId ||
        state.manualEdits !== prev.manualEdits ||
        state.dataRecords !== prev.dataRecords ||
        state.templates !== prev.templates ||
        state.templateInstances !== prev.templateInstances ||
        state.currentTemplateId !== prev.currentTemplateId
      ) {
        schedule();
      }
    });

    return () => {
      unsub();
      if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
    };
  }, []);
}
