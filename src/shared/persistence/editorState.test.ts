import { describe, expect, it } from 'vitest';
import { emptyEditorState, emptyLayoutConfig } from './editorState';

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
