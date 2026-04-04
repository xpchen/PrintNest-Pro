import type { StateCreator } from 'zustand';
import type { LayoutResult, Placement } from '../../../shared/types';
import { executeLayoutJob, withLayoutValidation } from '../../../shared/engine';
import { buildLayoutSignature } from '../../../shared/layoutSignature';
import { applyManualEditPatch } from '../../../shared/persistence/manualEditRuntime';
import { instancesToPrintItems } from '../../../shared/template/instanceToLayoutAdapter';
import { log } from '../../../shared/logger';
import type { PreRenderInput } from '../../utils/templatePreviewRenderer';
import type { AppState, LayoutJobSlice } from '../types';

function findPlacementGlobal(s: AppState, placementId: string): Placement | undefined {
  if (!s.result) return undefined;
  for (const c of s.result.canvases) {
    const p = c.placements.find((x) => x.id === placementId);
    if (p) return p;
  }
  return undefined;
}

export const createLayoutJobSlice: StateCreator<AppState, [], [], LayoutJobSlice> = (set, get) => ({
  result: null,
  isComputing: false,
  lastLayoutRunId: null,
  layoutProgress: 0,
  exportPdfCurrentNonce: 0,
  exportPdfHistoricalNonce: 0,
  requestExportCurrentPdf: () => set((s) => ({ exportPdfCurrentNonce: s.exportPdfCurrentNonce + 1 })),
  requestExportHistoricalRunPdf: () =>
    set((s) => ({ exportPdfHistoricalNonce: s.exportPdfHistoricalNonce + 1 })),

  cancelLayoutJob: () => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    void api?.cancelLayoutJob?.();
    set({ isComputing: false, layoutProgress: 0 });
  },

  runAutoLayout: () => {
    set({ isComputing: true, layoutProgress: 0 });
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;

    const compute = async (): Promise<{ result: LayoutResult; layoutRunId?: string }> => {
      const { items, config, result: prevResult, currentProjectId } = get();
      const locked: Placement[] = [];
      if (prevResult) {
        for (const c of prevResult.canvases) {
          for (const p of c.placements) {
            if (p.locked) locked.push(p);
          }
        }
      }
      const payload = {
        items,
        config,
        locked: locked.length > 0 ? locked : undefined,
        projectId: currentProjectId,
      };
      if (api?.runLayoutJob) {
        return api.runLayoutJob(payload);
      }
      const result = executeLayoutJob({
        items,
        config,
        lockedPlacements: locked.length > 0 ? locked : undefined,
      });
      return { result };
    };

    const finish = (result: LayoutResult, layoutRunId?: string) => {
      const { items, config } = get();
      const layoutSourceSignature = buildLayoutSignature(items, config);
      set({
        result,
        isComputing: false,
        layoutProgress: 0,
        activeCanvasIndex: 0,
        selectedIds: [],
        layoutSourceSignature,
        lastLayoutRunId: layoutRunId !== undefined ? layoutRunId : get().lastLayoutRunId,
        draftSourceRunId: null,
        manualEdits: [],
        manualEditNextRevision: 1,
      });
    };

    return new Promise<void>((resolve, reject) => {
      const run = async () => {
        const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
        const stopProgress = api?.onLayoutProgress?.((p) => {
          set({ layoutProgress: p.pct });
        });
        try {
          const { result, layoutRunId } = await compute();
          finish(result, layoutRunId);
          resolve();
        } catch (e) {
          set({ isComputing: false, layoutProgress: 0 });
          reject(e);
        } finally {
          stopProgress?.();
        }
      };
      requestAnimationFrame(() => {
        void run();
      });
    });
  },

  toggleLock: (placementId) => {
    const prev = findPlacementGlobal(get(), placementId);
    set((s) => {
      if (!s.result) return s;
      const newCanvases = s.result.canvases.map((c) => ({
        ...c,
        placements: c.placements.map((p) =>
          p.id === placementId ? { ...p, locked: !p.locked } : p,
        ),
      }));
      return { result: { ...s.result, canvases: newCanvases } };
    });
    const next = findPlacementGlobal(get(), placementId);
    if (prev && next && prev.locked !== next.locked) {
      get().appendManualEdit({
        sourceRunId: get().lastLayoutRunId,
        placementId,
        op: 'lock',
        before: { locked: prev.locked },
        after: { locked: next.locked },
      });
    }
  },

  batchLock: (ids, locked) => {
    set((s) => {
      if (!s.result) return s;
      const idSet = new Set(ids);
      const newCanvases = s.result.canvases.map((c) => ({
        ...c,
        placements: c.placements.map((p) => (idSet.has(p.id) ? { ...p, locked } : p)),
      }));
      return { result: { ...s.result, canvases: newCanvases } };
    });
  },

  deleteSelected: () => {
    set((s) => {
      if (!s.result || s.selectedIds.length === 0) return s;
      const idSet = new Set(s.selectedIds);
      const canvasArea = s.config.canvas.width * s.config.canvas.height;
      const newCanvases = s.result.canvases.map((c) => {
        const newPlacements = c.placements.filter((p) => !idSet.has(p.id));
        const used = newPlacements.reduce((sum, p) => sum + p.width * p.height, 0);
        return { ...c, placements: newPlacements, utilization: canvasArea > 0 ? used / canvasArea : 0 };
      });
      const totalUsed = newCanvases.reduce(
        (acc, c) => acc + c.placements.reduce((ss, p) => ss + p.width * p.height, 0),
        0,
      );
      const totalArea = newCanvases.length * canvasArea;
      const next: LayoutResult = {
        ...s.result,
        canvases: newCanvases,
        totalUtilization: totalArea > 0 ? totalUsed / totalArea : 0,
      };
      return {
        result: withLayoutValidation(next, s.items, s.config),
        selectedIds: [],
      };
    });
  },

  updatePlacement: (placementId, patch) => {
    const prev = findPlacementGlobal(get(), placementId);
    set((s) => {
      if (!s.result) return s;
      const newCanvases = s.result.canvases.map((c) => ({
        ...c,
        placements: c.placements.map((p) => (p.id === placementId ? { ...p, ...patch } : p)),
      }));
      const next: LayoutResult = { ...s.result, canvases: newCanvases };
      return { result: withLayoutValidation(next, s.items, s.config) };
    });
    const next = findPlacementGlobal(get(), placementId);
    if (
      prev &&
      next &&
      ('x' in patch || 'y' in patch) &&
      (prev.x !== next.x || prev.y !== next.y)
    ) {
      get().appendManualEdit({
        sourceRunId: get().lastLayoutRunId,
        placementId,
        op: 'move',
        before: { x: prev.x, y: prev.y },
        after: { x: next.x, y: next.y },
        delta: { dx: next.x - prev.x, dy: next.y - prev.y },
      });
    }
    if (prev && next && 'rotated' in patch && prev.rotated !== next.rotated) {
      get().appendManualEdit({
        sourceRunId: get().lastLayoutRunId,
        placementId,
        op: 'rotate',
        before: { rotated: prev.rotated },
        after: { rotated: next.rotated },
      });
    }
  },

  alignSelected: (mode) => {
    set((s) => {
      if (!s.result || s.selectedIds.length < 2) return s;
      const canvasIdx = s.activeCanvasIndex;
      const canvas = s.result.canvases[canvasIdx];
      if (!canvas) return s;
      const idSet = new Set(s.selectedIds);
      const sel = canvas.placements.filter((p) => idSet.has(p.id) && !p.locked);
      if (sel.length < 2) return s;

      const minX = Math.min(...sel.map((p) => p.x));
      const maxX = Math.max(...sel.map((p) => p.x + p.width));
      const minY = Math.min(...sel.map((p) => p.y));
      const maxY = Math.max(...sel.map((p) => p.y + p.height));
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      const updates = new Map<string, Partial<Placement>>();
      for (const p of sel) {
        switch (mode) {
          case 'left':
            updates.set(p.id, { x: minX });
            break;
          case 'right':
            updates.set(p.id, { x: maxX - p.width });
            break;
          case 'top':
            updates.set(p.id, { y: minY });
            break;
          case 'bottom':
            updates.set(p.id, { y: maxY - p.height });
            break;
          case 'hcenter':
            updates.set(p.id, { x: midX - p.width / 2 });
            break;
          case 'vcenter':
            updates.set(p.id, { y: midY - p.height / 2 });
            break;
        }
      }

      const newCanvases = s.result.canvases.map((c, idx) => {
        if (idx !== canvasIdx) return c;
        return {
          ...c,
          placements: c.placements.map((p) => {
            const u = updates.get(p.id);
            return u ? { ...p, ...u } : p;
          }),
        };
      });

      const canvasArea = s.config.canvas.width * s.config.canvas.height;
      const canvases = newCanvases.map((c) => {
        const used = c.placements.reduce((sum, p) => sum + p.width * p.height, 0);
        return { ...c, utilization: canvasArea > 0 ? used / canvasArea : 0 };
      });
      const totalUsed = canvases.reduce(
        (acc, c) => acc + c.placements.reduce((ss, p) => ss + p.width * p.height, 0),
        0,
      );
      const totalArea = canvases.length * canvasArea;
      const next: LayoutResult = {
        ...s.result,
        canvases,
        totalUtilization: totalArea > 0 ? totalUsed / totalArea : 0,
      };
      return { result: withLayoutValidation(next, s.items, s.config) };
    });
  },

  /* ── T02: patch-driven placement actions ── */

  togglePlacementHidden: (placementId) => {
    const s = get();
    if (!s.result) return;
    const prev = findPlacementGlobal(s, placementId);
    if (!prev) {
      log.engine.warn('togglePlacementHidden: placement not found', { placementId });
      return;
    }

    const newHidden = !prev.hidden;
    const patch = {
      sourceRunId: s.lastLayoutRunId,
      placementId,
      op: 'hide' as const,
      before: { hidden: !!prev.hidden },
      after: { hidden: newHidden },
    };

    const applied = applyManualEditPatch(s.result, {
      ...patch,
      revision: s.manualEditNextRevision,
      updatedAt: new Date().toISOString(),
    });
    const validated = withLayoutValidation(applied.result, s.items, s.config);
    set({ result: validated });
    get().appendManualEdit(patch);
  },

  duplicatePlacement: (placementId) => {
    const s = get();
    if (!s.result) return;
    const prev = findPlacementGlobal(s, placementId);
    if (!prev) {
      log.engine.warn('duplicatePlacement: placement not found', { placementId });
      return;
    }

    const patch = {
      sourceRunId: s.lastLayoutRunId,
      placementId,
      op: 'duplicate' as const,
      delta: { dx: 10, dy: 10 },
    };

    const applied = applyManualEditPatch(s.result, {
      ...patch,
      revision: s.manualEditNextRevision,
      updatedAt: new Date().toISOString(),
    });
    const validated = withLayoutValidation(applied.result, s.items, s.config);
    set({ result: validated });
    get().appendManualEdit(patch);

    // 选中新复制的 placement
    const newPlacements = applied.result.canvases.flatMap((c) => c.placements);
    const origPlacements = s.result.canvases.flatMap((c) => c.placements);
    const origIds = new Set(origPlacements.map((p) => p.id));
    const newOne = newPlacements.find((p) => !origIds.has(p.id));
    if (newOne) {
      set({ selectedIds: [newOne.id] });
    }
  },

  runAutoLayoutFromInstances: async () => {
    const s = get();
    // 过滤掉 error 状态的实例
    const readyInstances = s.templateInstances.filter((i) => i.status !== 'error');
    if (readyInstances.length === 0) {
      log.engine.warn('runAutoLayoutFromInstances: no ready instances');
      return;
    }

    const printItems = instancesToPrintItems(readyInstances, s.dataRecords, {
      defaultSpacing: s.config.globalSpacing,
      defaultBleed: s.config.globalBleed,
      allowRotation: s.config.allowRotation,
      templates: s.templates,
    });

    // 先设 items（metadata 可读回退立即生效），再异步预渲染
    set({ items: printItems });

    // 预渲染模板实例位图（动态导入避免测试环境加载 OffscreenCanvas）
    const { batchPreRenderInstances, bumpRenderGeneration } = await import('../../utils/templatePreviewRenderer');
    const { fetchAssetMap } = await import('../../hooks/useAssetMap');
    bumpRenderGeneration();
    const tplMap = new Map(s.templates.map((t) => [t.id, t]));
    const recordMap = new Map(s.dataRecords.map((r) => [r.id, r]));
    const preRenderInputs: PreRenderInput[] = [];
    for (const inst of readyInstances) {
      const template = tplMap.get(inst.templateId);
      if (!template) continue;
      preRenderInputs.push({
        instance: inst,
        template,
        record: recordMap.get(inst.recordId),
      });
    }

    if (preRenderInputs.length > 0) {
      try {
        const assetMap = await fetchAssetMap(s.currentProjectId);
        const blobUrls = await batchPreRenderInstances(preRenderInputs, assetMap);

        // 将 blobUrl 写入对应 PrintItem 的 imageSrc
        if (blobUrls.size > 0) {
          const updatedItems = get().items.map((item) => {
            const instanceId = item.metadata?.sourceInstanceId;
            if (instanceId && blobUrls.has(instanceId)) {
              return { ...item, imageSrc: blobUrls.get(instanceId)! };
            }
            return item;
          });
          set({ items: updatedItems });
        }
      } catch (err) {
        log.engine.warn('pre-render failed, metadata fallback active', { error: String(err) });
      }
    }

    // 使用现有 runAutoLayout 流程
    return get().runAutoLayout();
  },
});
