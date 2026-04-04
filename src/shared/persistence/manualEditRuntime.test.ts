/**
 * ManualEdit Runtime 单元测试
 */
import { describe, it, expect } from 'vitest';
import { applyManualEditPatch, applyManualEditPatches } from './manualEditRuntime';
import type { ApplyResult } from './manualEditRuntime';
import type { LayoutResult, Placement, CanvasResult } from '../types';
import type { ManualEditPatch, ManualEditOp } from './manualEdits';

/* ------------------------------------------------------------------ */
/*  工厂函数                                                           */
/* ------------------------------------------------------------------ */

function makePlacement(overrides?: Partial<Placement>): Placement {
  return {
    id: 'p1',
    layoutUnitId: 'lu1',
    printItemId: 'pi1',
    canvasIndex: 0,
    x: 100,
    y: 200,
    width: 60,
    height: 40,
    rotated: false,
    locked: false,
    ...overrides,
  };
}

function makeResult(placements: Placement[]): LayoutResult {
  const byCanvas = new Map<number, Placement[]>();
  for (const p of placements) {
    const arr = byCanvas.get(p.canvasIndex) ?? [];
    arr.push(p);
    byCanvas.set(p.canvasIndex, arr);
  }
  const canvases: CanvasResult[] = [...byCanvas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([idx, pls]) => ({ index: idx, placements: pls, utilization: 0.5 }));

  return {
    canvases,
    totalUtilization: 0.5,
    unplaced: [],
    elapsedMs: 100,
  };
}

function makePatch(
  overrides: Partial<ManualEditPatch> & { placementId: string; op: ManualEditOp },
): ManualEditPatch {
  return {
    sourceRunId: null,
    before: undefined,
    after: undefined,
    delta: undefined,
    updatedAt: new Date().toISOString(),
    revision: 1,
    ...overrides,
  };
}

let counter = 0;
const testIdGen = () => `dup_${++counter}`;

function getPlacement(res: ApplyResult, id: string): Placement | undefined {
  for (const c of res.result.canvases) {
    const found = c.placements.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('applyManualEditPatch', () => {
  describe('move', () => {
    it('applies delta.dx/dy to placement', () => {
      const result = makeResult([makePlacement()]);
      const patch = makePatch({ placementId: 'p1', op: 'move', delta: { dx: 10, dy: -5 } });

      const applied = applyManualEditPatch(result, patch);

      const p = getPlacement(applied, 'p1')!;
      expect(p.x).toBe(110);
      expect(p.y).toBe(195);
      expect(applied.warnings).toHaveLength(0);
    });

    it('prefers after.x/y over delta when both present', () => {
      const result = makeResult([makePlacement()]);
      const patch = makePatch({
        placementId: 'p1',
        op: 'move',
        after: { x: 300, y: 400 },
        delta: { dx: 10, dy: 10 },
      });

      const applied = applyManualEditPatch(result, patch);

      const p = getPlacement(applied, 'p1')!;
      expect(p.x).toBe(300);
      expect(p.y).toBe(400);
    });

    it('handles missing delta gracefully (defaults to 0)', () => {
      const result = makeResult([makePlacement()]);
      const patch = makePatch({ placementId: 'p1', op: 'move' });

      const applied = applyManualEditPatch(result, patch);

      const p = getPlacement(applied, 'p1')!;
      expect(p.x).toBe(100);
      expect(p.y).toBe(200);
    });
  });

  describe('rotate', () => {
    it('toggles rotated and swaps width/height', () => {
      const result = makeResult([makePlacement({ rotated: false, width: 60, height: 40 })]);
      const patch = makePatch({ placementId: 'p1', op: 'rotate' });

      const applied = applyManualEditPatch(result, patch);

      const p = getPlacement(applied, 'p1')!;
      expect(p.rotated).toBe(true);
      expect(p.width).toBe(40);
      expect(p.height).toBe(60);
    });

    it('uses after.rotated directly when provided', () => {
      const result = makeResult([makePlacement({ rotated: false })]);
      const patch = makePatch({ placementId: 'p1', op: 'rotate', after: { rotated: true } });

      const applied = applyManualEditPatch(result, patch);

      const p = getPlacement(applied, 'p1')!;
      expect(p.rotated).toBe(true);
      expect(p.width).toBe(40); // swapped
    });

    it('does not swap dimensions if rotated state unchanged', () => {
      const result = makeResult([makePlacement({ rotated: true, width: 60, height: 40 })]);
      const patch = makePatch({ placementId: 'p1', op: 'rotate', after: { rotated: true } });

      const applied = applyManualEditPatch(result, patch);

      const p = getPlacement(applied, 'p1')!;
      expect(p.rotated).toBe(true);
      expect(p.width).toBe(60); // unchanged
      expect(p.height).toBe(40);
    });
  });

  describe('lock', () => {
    it('toggles locked when no after provided', () => {
      const result = makeResult([makePlacement({ locked: false })]);
      const patch = makePatch({ placementId: 'p1', op: 'lock' });

      const applied = applyManualEditPatch(result, patch);

      expect(getPlacement(applied, 'p1')!.locked).toBe(true);
    });

    it('sets locked to after.locked when provided', () => {
      const result = makeResult([makePlacement({ locked: true })]);
      const patch = makePatch({ placementId: 'p1', op: 'lock', after: { locked: false } });

      const applied = applyManualEditPatch(result, patch);

      expect(getPlacement(applied, 'p1')!.locked).toBe(false);
    });
  });

  describe('hide', () => {
    it('sets hidden to true by default', () => {
      const result = makeResult([makePlacement()]);
      const patch = makePatch({ placementId: 'p1', op: 'hide' });

      const applied = applyManualEditPatch(result, patch);

      expect(getPlacement(applied, 'p1')!.hidden).toBe(true);
    });

    it('uses after.hidden when provided (including false for unhide)', () => {
      const result = makeResult([makePlacement({ hidden: true })]);
      const patch = makePatch({ placementId: 'p1', op: 'hide', after: { hidden: false } });

      const applied = applyManualEditPatch(result, patch);

      expect(getPlacement(applied, 'p1')!.hidden).toBe(false);
    });
  });

  describe('duplicate', () => {
    it('clones placement with new id and preserves geometry', () => {
      counter = 0;
      const result = makeResult([makePlacement({ printItemId: 'pi-x' })]);
      const patch = makePatch({ placementId: 'p1', op: 'duplicate' });

      const applied = applyManualEditPatch(result, patch, testIdGen);

      const original = getPlacement(applied, 'p1')!;
      const clone = getPlacement(applied, 'dup_1')!;

      expect(clone).toBeDefined();
      expect(clone.printItemId).toBe('pi-x');
      expect(clone.width).toBe(original.width);
      expect(clone.height).toBe(original.height);
      expect(clone.canvasIndex).toBe(original.canvasIndex);
    });

    it('applies delta offset to clone', () => {
      counter = 0;
      const result = makeResult([makePlacement({ x: 100, y: 200 })]);
      const patch = makePatch({ placementId: 'p1', op: 'duplicate', delta: { dx: 20, dy: 30 } });

      const applied = applyManualEditPatch(result, patch, testIdGen);

      const clone = getPlacement(applied, 'dup_1')!;
      expect(clone.x).toBe(120);
      expect(clone.y).toBe(230);

      // original unchanged
      const orig = getPlacement(applied, 'p1')!;
      expect(orig.x).toBe(100);
      expect(orig.y).toBe(200);
    });

    it('duplicate is unlocked and visible', () => {
      counter = 0;
      const result = makeResult([makePlacement({ locked: true, hidden: true })]);
      const patch = makePatch({ placementId: 'p1', op: 'duplicate' });

      const applied = applyManualEditPatch(result, patch, testIdGen);

      const clone = getPlacement(applied, 'dup_1')!;
      expect(clone.locked).toBe(false);
      expect(clone.hidden).toBe(false);
    });
  });

  describe('missing placementId', () => {
    it('returns unchanged result and collects warning', () => {
      const result = makeResult([makePlacement()]);
      const patch = makePatch({ placementId: 'nonexistent', op: 'move', delta: { dx: 10 } });

      const applied = applyManualEditPatch(result, patch, testIdGen, 0);

      // result unchanged (same reference)
      expect(applied.result).toBe(result);
      expect(applied.warnings).toHaveLength(1);
      expect(applied.warnings[0].placementId).toBe('nonexistent');
      expect(applied.warnings[0].patchIndex).toBe(0);
    });
  });

  describe('immutability', () => {
    it('does not mutate the original result', () => {
      const original = makeResult([makePlacement({ x: 100, y: 200 })]);
      const origJSON = JSON.stringify(original);

      const patch = makePatch({ placementId: 'p1', op: 'move', delta: { dx: 50, dy: 50 } });
      applyManualEditPatch(original, patch);

      expect(JSON.stringify(original)).toBe(origJSON);
    });
  });
});

describe('applyManualEditPatches', () => {
  it('applies multiple patches sequentially', () => {
    counter = 0;
    const result = makeResult([
      makePlacement({ id: 'p1', x: 0, y: 0 }),
      makePlacement({ id: 'p2', x: 100, y: 100 }),
    ]);

    const patches = [
      makePatch({ placementId: 'p1', op: 'move', delta: { dx: 10, dy: 20 }, revision: 1 }),
      makePatch({ placementId: 'p2', op: 'lock', after: { locked: true }, revision: 2 }),
      makePatch({ placementId: 'p1', op: 'rotate', revision: 3 }),
    ];

    const applied = applyManualEditPatches(result, patches, testIdGen);

    const p1 = getPlacement(applied, 'p1')!;
    expect(p1.x).toBe(10);
    expect(p1.y).toBe(20);
    expect(p1.rotated).toBe(true);

    const p2 = getPlacement(applied, 'p2')!;
    expect(p2.locked).toBe(true);

    expect(applied.warnings).toHaveLength(0);
  });

  it('accumulates warnings from all patches', () => {
    const result = makeResult([makePlacement()]);

    const patches = [
      makePatch({ placementId: 'missing1', op: 'move', revision: 1 }),
      makePatch({ placementId: 'p1', op: 'lock', revision: 2 }),
      makePatch({ placementId: 'missing2', op: 'hide', revision: 3 }),
    ];

    const applied = applyManualEditPatches(result, patches);

    expect(applied.warnings).toHaveLength(2);
    expect(applied.warnings[0].patchIndex).toBe(0);
    expect(applied.warnings[1].patchIndex).toBe(2);
  });

  it('returns unchanged result for empty patch array', () => {
    const result = makeResult([makePlacement()]);
    const applied = applyManualEditPatches(result, []);

    expect(applied.result).toBe(result);
    expect(applied.warnings).toHaveLength(0);
  });
});
