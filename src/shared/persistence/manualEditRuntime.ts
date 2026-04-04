/**
 * ManualEdit Runtime — 纯函数 patch 应用引擎
 *
 * 将 ManualEditPatch 应用到 LayoutResult，产生新 result。
 * 所有函数均为纯函数，不修改输入对象。
 */
import type { LayoutResult, CanvasResult, Placement } from '../types';
import type { ManualEditPatch, ManualEditOp } from './manualEdits';
import { log } from '../logger';

/* ------------------------------------------------------------------ */
/*  公开类型                                                           */
/* ------------------------------------------------------------------ */

export interface ApplyWarning {
  patchIndex: number;
  placementId: string;
  message: string;
}

export interface ApplyResult {
  result: LayoutResult;
  warnings: ApplyWarning[];
}

export type IdGenerator = () => string;

const defaultIdGen: IdGenerator = () => crypto.randomUUID();

/* ------------------------------------------------------------------ */
/*  内部工具                                                           */
/* ------------------------------------------------------------------ */

interface FindResult {
  canvasIdx: number;
  placement: Placement;
}

function findPlacement(canvases: CanvasResult[], placementId: string): FindResult | null {
  for (let ci = 0; ci < canvases.length; ci++) {
    const p = canvases[ci].placements.find((pl) => pl.id === placementId);
    if (p) return { canvasIdx: ci, placement: p };
  }
  return null;
}

/** 浅克隆 canvases，替换目标 placement */
function replaceInCanvases(
  canvases: CanvasResult[],
  targetCanvasIdx: number,
  targetId: string,
  updater: (p: Placement) => Placement,
): CanvasResult[] {
  return canvases.map((c, ci) => {
    if (ci !== targetCanvasIdx) return c;
    return {
      ...c,
      placements: c.placements.map((p) => (p.id === targetId ? updater(p) : p)),
    };
  });
}

/** 浅克隆 canvases，在目标 canvas 追加新 placement */
function appendToCanvas(
  canvases: CanvasResult[],
  targetCanvasIdx: number,
  newPlacement: Placement,
): CanvasResult[] {
  return canvases.map((c, ci) => {
    if (ci !== targetCanvasIdx) return c;
    return { ...c, placements: [...c.placements, newPlacement] };
  });
}

function wrapResult(result: LayoutResult, canvases: CanvasResult[]): LayoutResult {
  return { ...result, canvases, validation: undefined };
}

/* ------------------------------------------------------------------ */
/*  Op handlers                                                        */
/* ------------------------------------------------------------------ */

function handleMove(
  result: LayoutResult,
  patch: ManualEditPatch,
  found: FindResult,
): LayoutResult {
  const { placement, canvasIdx } = found;

  // after 绝对值优先；否则用 delta 叠加
  const afterX = patch.after?.x;
  const afterY = patch.after?.y;
  const newX = typeof afterX === 'number' ? afterX : placement.x + (patch.delta?.dx ?? 0);
  const newY = typeof afterY === 'number' ? afterY : placement.y + (patch.delta?.dy ?? 0);

  const canvases = replaceInCanvases(result.canvases, canvasIdx, placement.id, (p) => ({
    ...p,
    x: newX,
    y: newY,
  }));
  return wrapResult(result, canvases);
}

function handleRotate(
  result: LayoutResult,
  patch: ManualEditPatch,
  found: FindResult,
): LayoutResult {
  const { placement, canvasIdx } = found;

  const afterRotated = patch.after?.rotated;
  const newRotated = typeof afterRotated === 'boolean' ? afterRotated : !placement.rotated;
  const changed = newRotated !== placement.rotated;

  const canvases = replaceInCanvases(result.canvases, canvasIdx, placement.id, (p) => ({
    ...p,
    rotated: newRotated,
    // rotated 状态实际变化时交换 width/height
    width: changed ? p.height : p.width,
    height: changed ? p.width : p.height,
  }));
  return wrapResult(result, canvases);
}

function handleLock(
  result: LayoutResult,
  patch: ManualEditPatch,
  found: FindResult,
): LayoutResult {
  const { placement, canvasIdx } = found;

  const afterLocked = patch.after?.locked;
  const newLocked = typeof afterLocked === 'boolean' ? afterLocked : !placement.locked;

  const canvases = replaceInCanvases(result.canvases, canvasIdx, placement.id, (p) => ({
    ...p,
    locked: newLocked,
  }));
  return wrapResult(result, canvases);
}

function handleHide(
  result: LayoutResult,
  patch: ManualEditPatch,
  found: FindResult,
): LayoutResult {
  const { placement, canvasIdx } = found;

  const afterHidden = patch.after?.hidden;
  const newHidden = typeof afterHidden === 'boolean' ? afterHidden : true;

  const canvases = replaceInCanvases(result.canvases, canvasIdx, placement.id, (p) => ({
    ...p,
    hidden: newHidden,
  }));
  return wrapResult(result, canvases);
}

function handleDuplicate(
  result: LayoutResult,
  patch: ManualEditPatch,
  found: FindResult,
  idGen: IdGenerator,
): LayoutResult {
  const { placement, canvasIdx } = found;

  const clone: Placement = {
    ...placement,
    id: idGen(),
    locked: false,
    hidden: false,
    x: placement.x + (patch.delta?.dx ?? 0),
    y: placement.y + (patch.delta?.dy ?? 0),
  };

  const canvases = appendToCanvas(result.canvases, canvasIdx, clone);
  return wrapResult(result, canvases);
}

/* ------------------------------------------------------------------ */
/*  Op dispatch table                                                  */
/* ------------------------------------------------------------------ */

type OpHandler = (
  result: LayoutResult,
  patch: ManualEditPatch,
  found: FindResult,
  idGen: IdGenerator,
) => LayoutResult;

const handlers: Record<ManualEditOp, OpHandler> = {
  move: (r, p, f) => handleMove(r, p, f),
  rotate: (r, p, f) => handleRotate(r, p, f),
  lock: (r, p, f) => handleLock(r, p, f),
  hide: (r, p, f) => handleHide(r, p, f),
  duplicate: (r, p, f, id) => handleDuplicate(r, p, f, id),
};

/* ------------------------------------------------------------------ */
/*  公开 API                                                           */
/* ------------------------------------------------------------------ */

/**
 * 将单个 ManualEditPatch 应用到 LayoutResult。
 * 若 placementId 不存在，不抛异常，收集 warning。
 */
export function applyManualEditPatch(
  result: LayoutResult,
  patch: ManualEditPatch,
  idGen: IdGenerator = defaultIdGen,
  patchIndex = 0,
): ApplyResult {
  const found = findPlacement(result.canvases, patch.placementId);

  if (!found) {
    log.engine.warn('manualEdit: placementId not found, skipping', {
      placementId: patch.placementId,
      op: patch.op,
    });
    return {
      result,
      warnings: [
        {
          patchIndex,
          placementId: patch.placementId,
          message: `placement "${patch.placementId}" not found, skipped op "${patch.op}"`,
        },
      ],
    };
  }

  const handler = handlers[patch.op];
  if (!handler) {
    log.engine.warn('manualEdit: unknown op, skipping', { op: patch.op });
    return {
      result,
      warnings: [
        {
          patchIndex,
          placementId: patch.placementId,
          message: `unknown op "${patch.op}"`,
        },
      ],
    };
  }

  return { result: handler(result, patch, found, idGen), warnings: [] };
}

/**
 * 顺序应用多个 patch，逐个 threading result + 累积 warnings。
 */
export function applyManualEditPatches(
  result: LayoutResult,
  patches: ManualEditPatch[],
  idGen: IdGenerator = defaultIdGen,
): ApplyResult {
  let current = result;
  const warnings: ApplyWarning[] = [];

  for (let i = 0; i < patches.length; i++) {
    const applied = applyManualEditPatch(current, patches[i], idGen, i);
    current = applied.result;
    warnings.push(...applied.warnings);
  }

  return { result: current, warnings };
}
