import { describe, expect, it } from 'vitest';

/** 与 excelImport 内逻辑保持一致（表头匹配回归） */
function isSizeHeader(h: string): boolean {
  return h.includes('尺寸') && !h.includes('排版用');
}

describe('excelImport header rules', () => {
  it('排除「排版用尺寸」列', () => {
    expect(isSizeHeader('排版用尺寸')).toBe(false);
    expect(isSizeHeader('成品尺寸')).toBe(true);
  });
});
