import type { StateCreator } from 'zustand';
import type { LayoutResult, Placement } from '../../../shared/types';
import { executeLayoutJob, withLayoutValidation } from '../../../shared/engine';
import { buildLayoutSignature } from '../../../shared/layoutSignature';
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
});
