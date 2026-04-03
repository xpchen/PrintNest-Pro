import { describe, expect, it } from 'vitest';
import type { LayoutJobInvokeResult } from './layoutJob';
import type { LayoutResult } from '../types';

describe('layoutJob IPC types', () => {
  it('accepts result + optional layoutRunId', () => {
    const r: LayoutJobInvokeResult = {
      result: { canvases: [], totalUtilization: 0, unplaced: [], elapsedMs: 0 } as LayoutResult,
      layoutRunId: 'abc',
    };
    expect(r.layoutRunId).toBe('abc');
  });
});
