/**
 * 项目启动引导 hook
 *
 * 负责：
 * 1. 检查上次打开的项目并自动加载
 * 2. 初始化模板域独立历史订阅
 * 3. 项目加载后恢复模板预览图（优先磁盘缓存，降级为重新渲染）
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { readLastProjectId } from '../components/project/ProjectHome';
import { initTemplateHistorySubscription } from '../store/useTemplateHistory';
import type { SerializedEditorState } from '../../shared/persistence/editorState';
import type { PreRenderInput } from '../utils/templatePreviewRenderer';
import { showToast } from '../utils/toast';
import { log } from '../../shared/logger';

/**
 * 为缺失 imageSrc 的模板排版项恢复预览图
 * 优先从磁盘缓存读取 PNG，缓存未命中时再重新渲染
 */
async function rehydrateTemplatePreviews(): Promise<void> {
  const s = useAppStore.getState();
  // 只处理有 metadata（来自模板实例）但没有 imageSrc 的 items
  const needsPreview = s.items.filter((item) => item.metadata?.sourceInstanceId && !item.imageSrc);
  if (needsPreview.length === 0) return;

  log.engine.info('rehydrating template previews', { count: needsPreview.length });
  showToast(`正在恢复 ${needsPreview.length} 个模板预览图…`, 'info');

  try {
    // ── 步骤 1：尝试从磁盘缓存加载 ──
    const api = window.electronAPI;
    const instanceIds = needsPreview
      .map((item) => item.metadata!.sourceInstanceId!)
      .filter((id, i, arr) => arr.indexOf(id) === i); // 去重

    let diskHits = 0;
    if (api?.loadPreviewSnapshots && s.currentProjectId) {
      const LOAD_BATCH = 200;
      for (let i = 0; i < instanceIds.length; i += LOAD_BATCH) {
        const chunk = instanceIds.slice(i, i + LOAD_BATCH);
        const cached: Record<string, string> = await api.loadPreviewSnapshots(s.currentProjectId, chunk);
        const hitIds = Object.keys(cached);
        if (hitIds.length > 0) {
          diskHits += hitIds.length;
          const updatedItems = useAppStore.getState().items.map((item) => {
            const iid = item.metadata?.sourceInstanceId;
            if (iid && cached[iid]) {
              return { ...item, imageSrc: cached[iid] };
            }
            return item;
          });
          useAppStore.setState({ items: updatedItems });
        }
      }
      log.engine.info('disk cache loaded', { hits: diskHits, total: instanceIds.length });
    }

    // ── 步骤 2：缓存未命中的，重新渲染 ──
    const stillNeedsPreview = useAppStore.getState().items.filter(
      (item) => item.metadata?.sourceInstanceId && !item.imageSrc,
    );

    if (stillNeedsPreview.length === 0) {
      showToast(`${needsPreview.length} 个模板预览图已从缓存恢复`, 'success');
      log.engine.info('all previews loaded from disk cache');
      return;
    }

    showToast(
      diskHits > 0
        ? `已从缓存恢复 ${diskHits} 个，正在重新生成 ${stillNeedsPreview.length} 个…`
        : `正在重新生成 ${stillNeedsPreview.length} 个模板预览图…`,
      'info',
    );

    const { batchPreRenderInstances, bumpRenderGeneration } = await import('../utils/templatePreviewRenderer');
    const { fetchAssetMap } = await import('./useAssetMap');

    bumpRenderGeneration();
    const currentState = useAppStore.getState();
    const tplMap = new Map(currentState.templates.map((t) => [t.id, t]));
    const recordMap = new Map(currentState.dataRecords.map((r) => [r.id, r]));

    const preRenderInputs: PreRenderInput[] = [];
    for (const item of stillNeedsPreview) {
      const instanceId = item.metadata!.sourceInstanceId!;
      const inst = currentState.templateInstances.find((i) => i.id === instanceId);
      if (!inst) continue;
      const template = tplMap.get(inst.templateId);
      if (!template) continue;
      preRenderInputs.push({
        instance: inst,
        template,
        record: recordMap.get(inst.recordId),
      });
    }

    if (preRenderInputs.length === 0) {
      showToast('预览图恢复完毕', 'success');
      return;
    }

    const assetMap = await fetchAssetMap(currentState.currentProjectId);

    // 分批渲染
    const BATCH = 50;
    const allBase64: { id: string; base64: string }[] = [];
    for (let i = 0; i < preRenderInputs.length; i += BATCH) {
      const chunk = preRenderInputs.slice(i, i + BATCH);
      const { blobUrls, base64Map } = await batchPreRenderInstances(chunk, assetMap);

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

      // 收集 base64 用于磁盘缓存
      for (const [id, b64] of base64Map) {
        allBase64.push({ id, base64: b64 });
      }

      // 进度提示
      const done = Math.min(i + BATCH, preRenderInputs.length);
      if (done % 200 === 0 || done === preRenderInputs.length) {
        const pct = Math.round((done / preRenderInputs.length) * 100);
        showToast(`模板预览恢复中… ${done}/${preRenderInputs.length} (${pct}%)`, 'info');
      }
    }

    // 后台保存渲染结果到磁盘
    if (api?.savePreviewSnapshots && allBase64.length > 0) {
      const SAVE_BATCH = 100;
      for (let i = 0; i < allBase64.length; i += SAVE_BATCH) {
        const saveBatch = allBase64.slice(i, i + SAVE_BATCH);
        await api.savePreviewSnapshots(currentState.currentProjectId, saveBatch);
      }
      log.engine.info('preview snapshots saved to disk after rehydration', { count: allBase64.length });
    }

    showToast(`${preRenderInputs.length} 个模板预览图恢复完毕`, 'success');
    log.engine.info('template previews rehydrated', { fromDisk: diskHits, reRendered: preRenderInputs.length });
  } catch (err) {
    log.engine.warn('rehydrate template previews failed', { error: String(err) });
    showToast('模板预览恢复失败，使用文字信息展示', 'warning');
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
          // 后台恢复模板预览图（优先磁盘缓存）
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
