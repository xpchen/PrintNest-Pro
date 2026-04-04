import { describe, expect, it } from 'vitest';
import { resolveTemplateDrawables } from './resolveDrawables';
import type { TemplateDefinition, DataRecord } from '../types/template';
import type { ResolveDrawablesInput, AssetEntry } from '../types/template-render';

function makeTpl(elements: TemplateDefinition['elements'] = []): TemplateDefinition {
  return {
    id: 'tpl_1', name: 'Test', version: 1, status: 'draft',
    canvasMode: 'single_piece', widthMm: 100, heightMm: 60,
    elements, createdAt: '', updatedAt: '',
  };
}

function makeRecord(fields: Record<string, string>): DataRecord {
  return { id: 'r1', sourceRowIndex: 0, fields, qty: 1, createdAt: '', updatedAt: '' };
}

function makeInput(
  tpl: TemplateDefinition,
  record?: DataRecord,
  assets?: [string, AssetEntry][],
): ResolveDrawablesInput {
  return {
    template: tpl,
    record,
    assetMap: new Map(assets ?? []),
  };
}

describe('resolveTemplateDrawables', () => {
  it('resolves fixedText', () => {
    const tpl = makeTpl([
      { id: 'e1', type: 'fixedText', xMm: 5, yMm: 10, widthMm: 50, heightMm: 12, zIndex: 0, fixedValue: 'Hello', style: { fontSizePt: 14 } },
    ]);
    const drawables = resolveTemplateDrawables(makeInput(tpl));
    expect(drawables).toHaveLength(1);
    expect(drawables[0].type).toBe('text');
    if (drawables[0].type === 'text') {
      expect(drawables[0].content).toBe('Hello');
      expect(drawables[0].source).toBe('fixed');
      expect(drawables[0].style.fontSizePt).toBe(14);
    }
  });

  it('resolves variableText with record', () => {
    const tpl = makeTpl([
      { id: 'e1', type: 'variableText', xMm: 0, yMm: 0, widthMm: 50, heightMm: 10, zIndex: 0, binding: { mode: 'field', fieldKey: 'name' }, style: { fontSizePt: 12 } },
    ]);
    const record = makeRecord({ name: 'Alice' });
    const drawables = resolveTemplateDrawables(makeInput(tpl, record));
    expect(drawables[0].type).toBe('text');
    if (drawables[0].type === 'text') {
      expect(drawables[0].content).toBe('Alice');
      expect(drawables[0].source).toBe('bound');
    }
  });

  it('variableText missing field shows warning', () => {
    const tpl = makeTpl([
      { id: 'e1', type: 'variableText', xMm: 0, yMm: 0, widthMm: 50, heightMm: 10, zIndex: 0, binding: { mode: 'field', fieldKey: 'name' }, style: { fontSizePt: 12 } },
    ]);
    const record = makeRecord({});
    const drawables = resolveTemplateDrawables(makeInput(tpl, record));
    if (drawables[0].type === 'text') {
      expect(drawables[0].source).toBe('missing');
      expect(drawables[0].content).toContain('name');
    }
  });

  it('resolves fixedImage with asset', () => {
    const tpl = makeTpl([
      { id: 'e1', type: 'fixedImage', xMm: 0, yMm: 0, widthMm: 25, heightMm: 25, zIndex: 0, assetId: 'a1' },
    ]);
    const drawables = resolveTemplateDrawables(
      makeInput(tpl, undefined, [['a1', { thumbnailSrc: 'thumb://a1.png' }]]),
    );
    expect(drawables[0].type).toBe('image');
    if (drawables[0].type === 'image') {
      expect(drawables[0].src).toBe('thumb://a1.png');
      expect(drawables[0].source).toBe('fixed');
    }
  });

  it('fixedImage missing asset → source missing', () => {
    const tpl = makeTpl([
      { id: 'e1', type: 'fixedImage', xMm: 0, yMm: 0, widthMm: 25, heightMm: 25, zIndex: 0, assetId: 'nonexistent' },
    ]);
    const drawables = resolveTemplateDrawables(makeInput(tpl));
    if (drawables[0].type === 'image') {
      expect(drawables[0].src).toBe('');
      expect(drawables[0].source).toBe('missing');
    }
  });

  it('resolves barcode as placeholder', () => {
    const tpl = makeTpl([
      { id: 'e1', type: 'barcode', xMm: 0, yMm: 0, widthMm: 40, heightMm: 15, zIndex: 0, binding: { mode: 'field', fieldKey: 'code' }, barcodeStyle: { format: 'code128' } },
    ]);
    const record = makeRecord({ code: '123456' });
    const drawables = resolveTemplateDrawables(makeInput(tpl, record));
    expect(drawables[0].type).toBe('barcode');
    if (drawables[0].type === 'barcode') {
      expect(drawables[0].value).toBe('123456');
      expect(drawables[0].placeholder).toBe(true);
      expect(drawables[0].format).toBe('code128');
    }
  });

  it('resolves qrcode as placeholder', () => {
    const tpl = makeTpl([
      { id: 'e1', type: 'qrcode', xMm: 0, yMm: 0, widthMm: 20, heightMm: 20, zIndex: 0, binding: { mode: 'field', fieldKey: 'url' } },
    ]);
    const record = makeRecord({ url: 'https://example.com' });
    const drawables = resolveTemplateDrawables(makeInput(tpl, record));
    expect(drawables[0].type).toBe('qrcode');
    if (drawables[0].type === 'qrcode') {
      expect(drawables[0].value).toBe('https://example.com');
    }
  });

  it('resolves mark as rect', () => {
    const tpl = makeTpl([
      { id: 'e1', type: 'mark', xMm: 0, yMm: 0, widthMm: 5, heightMm: 5, zIndex: 0, markKind: 'crosshair', color: '#FF0000' },
    ]);
    const drawables = resolveTemplateDrawables(makeInput(tpl));
    expect(drawables[0].type).toBe('rect');
    if (drawables[0].type === 'rect') {
      expect(drawables[0].stroke).toBe('#FF0000');
    }
  });

  it('sorts by zIndex', () => {
    const tpl = makeTpl([
      { id: 'e2', type: 'fixedText', xMm: 0, yMm: 0, widthMm: 10, heightMm: 10, zIndex: 5, fixedValue: 'B', style: { fontSizePt: 12 } },
      { id: 'e1', type: 'fixedText', xMm: 0, yMm: 0, widthMm: 10, heightMm: 10, zIndex: 1, fixedValue: 'A', style: { fontSizePt: 12 } },
    ]);
    const drawables = resolveTemplateDrawables(makeInput(tpl));
    expect(drawables[0].elementId).toBe('e1');
    expect(drawables[1].elementId).toBe('e2');
  });

  it('variableImage uses fallbackAssetId when field missing', () => {
    const tpl = makeTpl([
      { id: 'e1', type: 'variableImage', xMm: 0, yMm: 0, widthMm: 25, heightMm: 25, zIndex: 0, binding: { mode: 'field', fieldKey: 'img' }, fallbackAssetId: 'fb1' },
    ]);
    const record = makeRecord({});
    const drawables = resolveTemplateDrawables(
      makeInput(tpl, record, [['fb1', { thumbnailSrc: 'thumb://fb.png' }]]),
    );
    if (drawables[0].type === 'image') {
      expect(drawables[0].src).toBe('thumb://fb.png');
      expect(drawables[0].source).toBe('fallback');
    }
  });
});
