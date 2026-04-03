import { describe, expect, it } from 'vitest';
import { emptyEditorState, emptyLayoutConfig, createInitialEditorState } from './editorState';
import { PackingStrategy } from '../types';
import type { ProjectInitPayload } from '../types/projectInit';

describe('editorState', () => {
  it('emptyLayoutConfig has expected canvas size', () => {
    const c = emptyLayoutConfig();
    expect(c.canvas.width).toBe(1000);
    expect(c.canvas.height).toBe(1500);
  });

  it('emptyEditorState has no items and null result', () => {
    const s = emptyEditorState('proj_x');
    expect(s.items).toEqual([]);
    expect(s.result).toBeNull();
    expect(s.projectName).toBe('未命名项目');
  });
});

describe('createInitialEditorState', () => {
  const basePayload: ProjectInitPayload = {
    projectName: '春季订单',
    defaultUnit: 'mm',
    materialType: 'roll',
    canvasWidthMm: 1600,
    canvasHeightMm: 5000,
    globalSpacing: 3,
    globalBleed: 5,
    allowRotation: true,
    strategy: PackingStrategy.BestShortSideFit,
    singleCanvas: false,
    startMode: 'blank',
  };

  it('maps payload to config correctly', () => {
    const s = createInitialEditorState('proj_1', basePayload);
    expect(s.projectName).toBe('春季订单');
    expect(s.config.canvas.width).toBe(1600);
    expect(s.config.canvas.height).toBe(5000);
    expect(s.config.globalSpacing).toBe(3);
    expect(s.config.globalBleed).toBe(5);
    expect(s.config.allowRotation).toBe(true);
    expect(s.config.strategy).toBe(PackingStrategy.BestShortSideFit);
    expect(s.config.singleCanvas).toBe(false);
    expect(s.items).toEqual([]);
    expect(s.result).toBeNull();
  });

  it('includes edgeSafeMm when provided', () => {
    const s = createInitialEditorState('proj_2', { ...basePayload, edgeSafeMm: 10 });
    expect(s.config.edgeSafeMm).toBe(10);
  });

  it('omits edgeSafeMm when not provided', () => {
    const s = createInitialEditorState('proj_3', basePayload);
    expect(s.config.edgeSafeMm).toBeUndefined();
  });

  it('handles single sheet scenario', () => {
    const s = createInitialEditorState('proj_4', {
      ...basePayload,
      materialType: 'sheet',
      canvasWidthMm: 297,
      canvasHeightMm: 420,
      singleCanvas: true,
    });
    expect(s.config.canvas.width).toBe(297);
    expect(s.config.canvas.height).toBe(420);
    expect(s.config.singleCanvas).toBe(true);
  });

  it('uses customerName in payload without affecting projectName', () => {
    const s = createInitialEditorState('proj_5', {
      ...basePayload,
      customerName: '客户 A',
    });
    expect(s.projectName).toBe('春季订单');
  });
});
