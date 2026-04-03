/**
 * 统一视口聚焦：仅通过本模块与 applyViewFit* 写入 panOffset（计划 §1.2b）
 */
import type { StoreApi } from 'zustand';
import type { AppState } from '../store/types';

export type CanvasMmRect = { x: number; y: number; width: number; height: number };

export type FocusRectOptions = {
  mode: 'center' | 'top';
  paddingMm?: number;
  paddingPx?: number;
};

function paddingToMm(opts: FocusRectOptions, zoom: number): { px: number; mm: number } {
  const px = opts.paddingPx ?? 0;
  const mm = (opts.paddingMm ?? 0) + (px > 0 ? px / zoom : 0);
  return { px, mm };
}

/** 在已知容器像素尺寸下，将矩形（画布 mm）滚入视口 */
export function focusRectInViewport(
  get: StoreApi<AppState>['getState'],
  set: StoreApi<AppState>['setState'],
  rect: CanvasMmRect,
  opts: FocusRectOptions,
): void {
  const { zoom, viewportContainerPx, panOffset } = get();
  const { width: cw, height: ch } = viewportContainerPx;
  if (cw <= 0 || ch <= 0) return;

  const { mm: padMm } = paddingToMm(opts, zoom);

  if (opts.mode === 'top') {
    const topMm = rect.y - padMm;
    const oy = -zoom * topMm;
    set({ panOffset: { x: panOffset.x, y: oy }, viewMode: 'custom' });
    return;
  }

  const cxMm = rect.x + rect.width / 2;
  const cyMm = rect.y + rect.height / 2;
  const ox = cw / 2 - zoom * cxMm;
  const oy = ch / 2 - zoom * cyMm;
  set({ panOffset: { x: ox, y: oy }, viewMode: 'custom' });
}

export function applyFitAll(get: StoreApi<AppState>['getState'], set: StoreApi<AppState>['setState']): void {
  const { config, viewportContainerPx } = get();
  const { width: cw, height: ch } = viewportContainerPx;
  if (cw <= 0 || ch <= 0) return;
  const margin = 48;
  const canvasW = config.canvas.width;
  const canvasH = config.canvas.height;
  const z = Math.max(0.01, Math.min((cw - margin) / canvasW, (ch - margin) / canvasH));
  const ox = (cw - canvasW * z) / 2;
  const oy = (ch - canvasH * z) / 2;
  set({ zoom: z, panOffset: { x: ox, y: oy }, viewMode: 'fitAll' });
}

export function applyFitWidth(get: StoreApi<AppState>['getState'], set: StoreApi<AppState>['setState']): void {
  const { config, viewportContainerPx } = get();
  const { width: cw, height: ch } = viewportContainerPx;
  if (cw <= 0 || ch <= 0) return;
  const margin = 48;
  const canvasW = config.canvas.width;
  const canvasH = config.canvas.height;
  const z = Math.max(0.01, (cw - margin) / canvasW);
  const ox = (cw - canvasW * z) / 2;
  const oy = Math.min(margin, Math.max(0, (ch - canvasH * z) / 2));
  set({ zoom: z, panOffset: { x: ox, y: oy }, viewMode: 'fitWidth' });
}

export function applyActual100(set: StoreApi<AppState>['setState']): void {
  set({ zoom: 1, viewMode: 'actual' });
}
