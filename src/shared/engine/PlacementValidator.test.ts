import { describe, expect, it } from 'vitest';
import type { LayoutConfig, LayoutResult, Placement, PrintItem } from '../types';
import { PackingStrategy } from '../types';
import { buildLayoutValidationReport } from './PlacementValidator';

const baseConfig = (): LayoutConfig => ({
  canvas: { width: 500, height: 500 },
  strategy: PackingStrategy.BestShortSideFit,
  allowRotation: true,
  globalSpacing: 2,
  globalBleed: 2,
  singleCanvas: false,
});

const item = (id: string, spacing = 2): PrintItem => ({
  id,
  name: id,
  width: 50,
  height: 50,
  quantity: 1,
  imageSrc: '',
  priority: 0,
  allowRotation: true,
  spacing,
  bleed: 2,
  color: '#000',
});

function makeResult(placements: Placement[], unplacedCount = 0): LayoutResult {
  const canvasArea = 500 * 500;
  const used = placements.reduce((s, p) => s + p.width * p.height, 0);
  return {
    canvases: [
      {
        index: 0,
        placements,
        utilization: canvasArea > 0 ? used / canvasArea : 0,
      },
    ],
    totalUtilization: canvasArea > 0 ? used / canvasArea : 0,
    unplaced: Array.from({ length: unplacedCount }, (_, i) => ({
      id: `u_${i}`,
      printItemId: 'x',
      instanceIndex: i,
      packedWidth: 10,
      packedHeight: 10,
      originalWidth: 10,
      originalHeight: 10,
      allowRotation: false,
      priority: 0,
      color: '#000',
      imageSrc: '',
    })),
    elapsedMs: 1,
  };
}

const p = (
  id: string,
  printItemId: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Placement => ({
  id,
  layoutUnitId: `lu_${printItemId}_0`,
  printItemId,
  canvasIndex: 0,
  x,
  y,
  width: w,
  height: h,
  rotated: false,
  locked: false,
});

describe('buildLayoutValidationReport', () => {
  it('detects out of bounds', () => {
    const items = [item('a')];
    const result = makeResult([p('p1', 'a', 460, 0, 50, 50)]);
    const r = buildLayoutValidationReport(result, items, baseConfig());
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.kind === 'out_of_bounds')).toBe(true);
  });

  it('detects overlap', () => {
    const items = [item('a'), item('b')];
    const result = makeResult([
      p('p1', 'a', 0, 0, 50, 50),
      p('p2', 'b', 25, 25, 50, 50),
    ]);
    const r = buildLayoutValidationReport(result, items, baseConfig());
    expect(r.isValid).toBe(false);
    expect(r.issues.some((i) => i.kind === 'overlap')).toBe(true);
  });

  it('flags single canvas overflow', () => {
    const items = [item('a')];
    const result = makeResult([p('p1', 'a', 0, 0, 50, 50)], 2);
    const cfg = { ...baseConfig(), singleCanvas: true };
    const r = buildLayoutValidationReport(result, items, cfg);
    expect(r.issues.some((i) => i.kind === 'single_canvas_overflow')).toBe(true);
  });

  it('passes for separated placements', () => {
    const items = [item('a'), item('b')];
    const result = makeResult([
      p('p1', 'a', 0, 0, 50, 50),
      p('p2', 'b', 100, 0, 50, 50),
    ]);
    const r = buildLayoutValidationReport(result, items, baseConfig());
    expect(r.isValid).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });
});
