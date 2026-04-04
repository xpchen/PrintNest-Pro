/**
 * 项目启动引导 hook
 *
 * 负责：
 * 1. 检查上次打开的项目并自动加载
 * 2. 初始化模板域独立历史订阅
 * 3. 项目加载后重新生成模板预览位图（blob URL 不持久化）
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { readLastProjectId } from '../components/project/ProjectHome';
import { initTemplateHistorySubscription } from '../store/useTemplateHistory';
import type { SerializedEditorState } from '../../shared/persistence/editorState';
import type { PreRenderInput } from '../utils/templatePreviewRenderer';
import { log } from '../../shared/logger';

/**
 * 为缺失 imageSrc 的模板排版项重新生成预览位图
 */
async function rehydrateTemplatePreviews(): Promise<void> {
  const s = useAppStore.getState();
  // 只处理有 metadata（来自模板实例）但没有 imageSrc 的 items
  const needsPreview = s.items.filter((item) => item.metadata?.sourceInstanceId && !item.imageSrc);
  if (needsPreview.length === 0) return;

  log.engine.info('rehydrating template previews', { count: needsPreview.length });

  try {
    const { batchPreRenderInstances, bumpRenderGeneration } = await import('../utils/templatePreviewRenderer');
    const { fetchAssetMap } = await import('./useAssetMap');

    bumpRenderGeneration();
    const tplMap = new Map(s.templates.map((t) => [t.id, t]));
    const recordMap = new Map(s.dataRecords.map((r) => [r.id, r]));

    const preRenderInputs: PreRenderInput[] = [];
    for (const item of needsPreview) {
      const instanceId = item.metadata!.sourceInstanceId!;
      const inst = s.templateInstances.find((i) => i.id === instanceId);
      if (!inst) continue;
      const template = tplMap.get(inst.templateId);
      if (!template) continue;
      preRenderInputs.push({
        instance: inst,
        template,
        record: recordMap.get(inst.recordId),
      });
    }

    if (preRenderInputs.length === 0) return;

    const { showToast } = await import('../utils/toast');
    showToast(`正在恢复 ${preRenderInputs.length} 个模板预览图…`, 'info');

    const assetMap = await fetchAssetMap(s.currentProjectId);

    // 分批渲染
    const BATCH = 50;
    for (let i = 0; i < preRenderInputs.length; i += BATCH) {
      const chunk = preRenderInputs.slice(i, i + BATCH);
      const blobUrls = await batchPreRenderInstances(chunk, assetMap);

      if (blobUrls.size > 0) {
        const updatedItems = useAppStore.getState().items.map((item) => {
          const iid = item.metadata?.sourceInstanceId;
          if (iid && blobUrls.has(iid)) {
            return { ...item, imageSrc: blobUrls.get(iid)! };
          }
          return item;
        });
        useAppStore.setState({ items: updatedItems });
      }

      // 每 500 个更新一次进度提示
      const done = Math.min(i + BATCH, preRenderInputs.length);
      if (done % 500 === 0 || done === preRenderInputs.length) {
        const pct = Math.round((done / preRenderInputs.length) * 100);
        showToast(`模板预览恢复中… ${done}/${preRenderInputs.length} (${pct}%)`, 'info');
      }
    }
    showToast(`${preRenderInputs.length} 个模板预览图恢复完毕`, 'success');
    log.engine.info('template previews rehydrated', { total: preRenderInputs.length });
  } catch (err) {
    log.engine.warn('rehydrate template previews failed', { error: String(err) });
  }
}

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
          // 后台重新生成模板预览位图（blob URL 不持久化）
          void rehydrateTemplatePreviews();
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
