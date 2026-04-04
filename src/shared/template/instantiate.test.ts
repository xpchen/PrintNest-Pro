import { describe, expect, it } from 'vitest';
import { instantiateTemplate } from './instantiate';
import type { TemplateDefinition, DataRecord } from '../types/template';

function makeTemplate(elements: TemplateDefinition['elements'] = []): TemplateDefinition {
  return {
    id: 'tpl_1',
    name: 'Test',
    version: 1,
    status: 'draft',
    canvasMode: 'single_piece',
    widthMm: 100,
    heightMm: 60,
    elements,
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

describe('instantiateTemplate', () => {
  it('produces one instance per record', () => {
    const tpl = makeTemplate();
    const records = [makeRecord('r1', {}), makeRecord('r2', {})];
    const { instances } = instantiateTemplate(tpl, records);
    expect(instances.length).toBe(2);
    expect(instances[0].id).toBe('inst_tpl_1_r1');
    expect(instances[1].id).toBe('inst_tpl_1_r2');
  });

  it('lightweight instances have no resolvedElements or renderPayload', () => {
    const tpl = makeTemplate([
      { id: 'e1', type: 'fixedText', xMm: 0, yMm: 0, widthMm: 50, heightMm: 10, zIndex: 0, fixedValue: 'Hello', style: { fontSizePt: 12 } },
    ]);
    const { instances } = instantiateTemplate(tpl, [makeRecord('r1', {})]);
    expect(instances[0].status).toBe('valid');
    expect('resolvedElements' in instances[0]).toBe(false);
    expect('renderPayload' in instances[0]).toBe(false);
  });

  it('reports missing_field for variableText without value', () => {
    const tpl = makeTemplate([
      { id: 'e1', type: 'variableText', xMm: 0, yMm: 0, widthMm: 50, heightMm: 10, zIndex: 0, binding: { mode: 'field', fieldKey: 'name' }, style: { fontSizePt: 12 } },
    ]);
    const { instances, totalErrors } = instantiateTemplate(tpl, [makeRecord('r1', {})]);
    expect(totalErrors).toBe(1);
    expect(instances[0].status).toBe('error');
    expect(instances[0].validationErrors![0].code).toBe('missing_field');
  });

  it('valid when variableText field exists', () => {
    const tpl = makeTemplate([
      { id: 'e1', type: 'variableText', xMm: 0, yMm: 0, widthMm: 50, heightMm: 10, zIndex: 0, binding: { mode: 'field', fieldKey: 'name' }, style: { fontSizePt: 12 } },
    ]);
    const { instances, totalErrors } = instantiateTemplate(tpl, [makeRecord('r1', { name: 'Alice' })]);
    expect(totalErrors).toBe(0);
    expect(instances[0].status).toBe('valid');
  });

  it('valid when fallbackValue provided for missing field', () => {
    const tpl = makeTemplate([
      { id: 'e1', type: 'variableText', xMm: 0, yMm: 0, widthMm: 50, heightMm: 10, zIndex: 0, binding: { mode: 'field', fieldKey: 'name', fallbackValue: 'N/A' }, style: { fontSizePt: 12 } },
    ]);
    const { instances, totalErrors } = instantiateTemplate(tpl, [makeRecord('r1', {})]);
    expect(totalErrors).toBe(0);
    expect(instances[0].status).toBe('valid');
  });

  it('reports invalid_barcode for EAN-13 with wrong format', () => {
    const tpl = makeTemplate([
      { id: 'e1', type: 'barcode', xMm: 0, yMm: 0, widthMm: 40, heightMm: 15, zIndex: 0, binding: { mode: 'field', fieldKey: 'code' }, barcodeStyle: { format: 'ean13' } },
    ]);
    const { instances, totalWarnings } = instantiateTemplate(tpl, [makeRecord('r1', { code: '12345' })]);
    expect(totalWarnings).toBe(1);
    expect(instances[0].status).toBe('warning');
    expect(instances[0].validationErrors![0].code).toBe('invalid_barcode');
  });

  it('returns empty for empty records', () => {
    const tpl = makeTemplate();
    const { instances } = instantiateTemplate(tpl, []);
    expect(instances.length).toBe(0);
  });

  it('preserves template dimensions in instance', () => {
    const tpl = makeTemplate();
    tpl.widthMm = 200;
    tpl.heightMm = 150;
    const { instances } = instantiateTemplate(tpl, [makeRecord('r1', {})]);
    expect(instances[0].resolvedWidthMm).toBe(200);
    expect(instances[0].resolvedHeightMm).toBe(150);
  });

  it('generates snapshotHash', () => {
    const tpl = makeTemplate([
      { id: 'e1', type: 'fixedText', xMm: 0, yMm: 0, widthMm: 50, heightMm: 10, zIndex: 0, fixedValue: 'A', style: { fontSizePt: 12 } },
    ]);
    const { instances } = instantiateTemplate(tpl, [makeRecord('r1', { name: 'Alice' })]);
    expect(instances[0].snapshotHash).toBeDefined();
    expect(typeof instances[0].snapshotHash).toBe('string');
    expect(instances[0].snapshotHash!.length).toBeGreaterThan(0);
  });

  it('snapshotHash changes with different record data', () => {
    const tpl = makeTemplate([
      { id: 'e1', type: 'fixedText', xMm: 0, yMm: 0, widthMm: 50, heightMm: 10, zIndex: 0, fixedValue: 'A', style: { fontSizePt: 12 } },
    ]);
    const { instances: i1 } = instantiateTemplate(tpl, [makeRecord('r1', { name: 'Alice' })]);
    const { instances: i2 } = instantiateTemplate(tpl, [makeRecord('r1', { name: 'Bob' })]);
    expect(i1[0].snapshotHash).not.toBe(i2[0].snapshotHash);
  });

  it('snapshotHash stable for same input', () => {
    const tpl = makeTemplate();
    const rec = makeRecord('r1', { x: '1' });
    const { instances: i1 } = instantiateTemplate(tpl, [rec]);
    const { instances: i2 } = instantiateTemplate(tpl, [rec]);
    expect(i1[0].snapshotHash).toBe(i2[0].snapshotHash);
  });
});
