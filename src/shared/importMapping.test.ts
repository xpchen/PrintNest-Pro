import { describe, expect, it } from 'vitest';
import { autoSuggestMapping } from './importMapping';
import type { ColumnProfile } from './importMapping';

function col(index: number, headerText: string, sampleValues: string[] = []): ColumnProfile {
  return { index, headerText, sampleValues };
}

describe('autoSuggestMapping', () => {
  it('matches typical Chinese headers', () => {
    const columns = [
      col(0, '内部单号'),
      col(1, '尺寸'),
      col(2, '数量'),
      col(3, '颜色'),
    ];
    const result = autoSuggestMapping(columns);
    expect(result).toContainEqual({ field: 'internalOrderNo', columnIndex: 0 });
    expect(result).toContainEqual({ field: 'sizeText', columnIndex: 1 });
    expect(result).toContainEqual({ field: 'quantity', columnIndex: 2 });
    expect(result).toContainEqual({ field: 'color', columnIndex: 3 });
  });

  it('excludes 排版用尺寸 from sizeText', () => {
    const columns = [
      col(0, '内部单号'),
      col(1, '排版用尺寸'),
      col(2, '数量'),
    ];
    const result = autoSuggestMapping(columns);
    expect(result.find((m) => m.field === 'sizeText')).toBeUndefined();
  });

  it('matches English headers', () => {
    const columns = [
      col(0, 'Order'),
      col(1, 'Size'),
      col(2, 'Qty'),
      col(3, 'Barcode'),
    ];
    const result = autoSuggestMapping(columns);
    expect(result).toContainEqual({ field: 'internalOrderNo', columnIndex: 0 });
    expect(result).toContainEqual({ field: 'sizeText', columnIndex: 1 });
    expect(result).toContainEqual({ field: 'quantity', columnIndex: 2 });
    expect(result).toContainEqual({ field: 'barcode', columnIndex: 3 });
  });

  it('does not duplicate column assignment', () => {
    const columns = [
      col(0, '单号'),
      col(1, '订单号'), // also matches internalOrderNo but should not
    ];
    const result = autoSuggestMapping(columns);
    const internalMappings = result.filter((m) => m.field === 'internalOrderNo');
    expect(internalMappings.length).toBe(1);
    expect(internalMappings[0].columnIndex).toBe(0);
  });

  it('returns empty for unrecognized headers', () => {
    const columns = [
      col(0, 'AAA'),
      col(1, 'BBB'),
    ];
    const result = autoSuggestMapping(columns);
    expect(result.length).toBe(0);
  });
});
