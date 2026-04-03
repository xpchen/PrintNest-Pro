import { describe, expect, it } from 'vitest';
import { instancesToPrintItems } from './instanceToLayoutAdapter';
import type { TemplateInstance, DataRecord } from '../types/template';

function makeInstance(id: string, recordId: string): TemplateInstance {
  return {
    id,
    templateId: 'tpl_1',
    recordId,
    resolvedWidthMm: 100,
    resolvedHeightMm: 60,
    renderPayload: {},
    status: 'valid',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeRecord(id: string, fields: Record<string, string>, qty = 1): DataRecord {
  return {
    id,
    sourceRowIndex: 0,
    fields,
    qty,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('instancesToPrintItems', () => {
  const opts = { defaultSpacing: 2, defaultBleed: 3, allowRotation: true };

  it('maps instances to PrintItems with correct dimensions', () => {
    const instances = [makeInstance('i1', 'r1')];
    const records = [makeRecord('r1', { '内部单号': 'A001' }, 5)];
    const items = instancesToPrintItems(instances, records, opts);

    expect(items.length).toBe(1);
    expect(items[0].width).toBe(100);
    expect(items[0].height).toBe(60);
    expect(items[0].quantity).toBe(5);
    expect(items[0].name).toBe('A001');
    expect(items[0].spacing).toBe(2);
    expect(items[0].bleed).toBe(3);
  });

  it('defaults qty to 1 if record not found', () => {
    const instances = [makeInstance('i1', 'missing')];
    const items = instancesToPrintItems(instances, [], opts);
    expect(items[0].quantity).toBe(1);
  });

  it('uses name fallback from different field keys', () => {
    const instances = [makeInstance('i1', 'r1')];
    const records = [makeRecord('r1', { sku: 'SKU-123' })];
    const items = instancesToPrintItems(instances, records, opts);
    expect(items[0].name).toBe('SKU-123');
  });

  it('handles multiple instances', () => {
    const instances = [makeInstance('i1', 'r1'), makeInstance('i2', 'r2')];
    const records = [makeRecord('r1', {}, 2), makeRecord('r2', {}, 3)];
    const items = instancesToPrintItems(instances, records, opts);
    expect(items.length).toBe(2);
    expect(items[0].quantity).toBe(2);
    expect(items[1].quantity).toBe(3);
  });
});
