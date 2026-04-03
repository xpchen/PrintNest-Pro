/**
 * excelImport 映射层单元测试
 *
 * 测试 mapTableToImportRows + parseSizeCm 的纯逻辑，不涉及文件 IO。
 */
import { describe, it, expect } from 'vitest';
import { mapTableToImportRows, parseSizeCm } from './excelImport';
import type { ParsedTable, ImportMappingConfig } from '../shared/importMapping';

/* ── helpers ── */

function makeTable(overrides?: Partial<ParsedTable>): ParsedTable {
  return {
    sheetName: 'Sheet1',
    headerRowIndex: 0,
    columns: [
      { index: 0, headerText: '内部单号', sampleValues: ['A001'] },
      { index: 1, headerText: '尺寸', sampleValues: ['40-60'] },
      { index: 2, headerText: '数量', sampleValues: ['3'] },
    ],
    dataRows: [
      ['A001', '40-60', '3'],
      ['A002', '50-80', '1'],
    ],
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<ImportMappingConfig>): ImportMappingConfig {
  return {
    mappings: [
      { field: 'internalOrderNo', columnIndex: 0 },
      { field: 'sizeText', columnIndex: 1 },
      { field: 'quantity', columnIndex: 2 },
    ],
    ...overrides,
  };
}

/* ── parseSizeCm ── */

describe('parseSizeCm', () => {
  it('正常 "40-60" → { w: 40, h: 60 }', () => {
    expect(parseSizeCm('40-60')).toEqual({ w: 40, h: 60 });
  });

  it('带空格 "40 - 60"', () => {
    expect(parseSizeCm('40 - 60')).toEqual({ w: 40, h: 60 });
  });

  it('em dash "40—60"', () => {
    expect(parseSizeCm('40—60')).toEqual({ w: 40, h: 60 });
  });

  it('en dash "40–60"', () => {
    expect(parseSizeCm('40–60')).toEqual({ w: 40, h: 60 });
  });

  it('小数 "40.5-60.2"', () => {
    expect(parseSizeCm('40.5-60.2')).toEqual({ w: 40.5, h: 60.2 });
  });

  it('无效格式返回 null', () => {
    expect(parseSizeCm('abc')).toBeNull();
    expect(parseSizeCm('')).toBeNull();
    expect(parseSizeCm('40')).toBeNull();
  });

  it('零值返回 null', () => {
    expect(parseSizeCm('0-60')).toBeNull();
    expect(parseSizeCm('40-0')).toBeNull();
  });
});

/* ── mapTableToImportRows ── */

describe('mapTableToImportRows', () => {
  it('正常映射产出正确行', () => {
    const { rows, warnings } = mapTableToImportRows(makeTable(), makeConfig());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'A001', widthMm: 400, heightMm: 600, quantity: 3 });
    expect(rows[1]).toEqual({ name: 'A002', widthMm: 500, heightMm: 800, quantity: 1 });
    expect(warnings).toHaveLength(0);
  });

  it('sizeUnit=mm 不做 ×10 转换', () => {
    const { rows } = mapTableToImportRows(makeTable(), makeConfig({ sizeUnit: 'mm' }));
    expect(rows[0].widthMm).toBe(40);
    expect(rows[0].heightMm).toBe(60);
  });

  it('缺少 internalOrderNo 和 sizeText 映射时返回 warning', () => {
    const { rows, warnings } = mapTableToImportRows(
      makeTable(),
      { mappings: [{ field: 'quantity', columnIndex: 2 }] },
    );
    expect(rows).toHaveLength(0);
    expect(warnings[0]).toContain('缺少');
  });

  it('缺少名称的行产生 warning', () => {
    const table = makeTable({
      dataRows: [['', '40-60', '1']],
    });
    const { rows, warnings } = mapTableToImportRows(table, makeConfig());
    expect(rows).toHaveLength(0);
    expect(warnings[0]).toContain('缺少内部单号');
  });

  it('缺少尺寸的行产生 warning', () => {
    const table = makeTable({
      dataRows: [['A001', '', '1']],
    });
    const { rows, warnings } = mapTableToImportRows(table, makeConfig());
    expect(rows).toHaveLength(0);
    expect(warnings[0]).toContain('缺少尺寸');
  });

  it('无效尺寸格式产生 warning', () => {
    const table = makeTable({
      dataRows: [['A001', 'invalid', '1']],
    });
    const { rows, warnings } = mapTableToImportRows(table, makeConfig());
    expect(rows).toHaveLength(0);
    expect(warnings[0]).toContain('尺寸格式无效');
  });

  it('数量缺失时默认为 1', () => {
    const config = makeConfig({
      mappings: [
        { field: 'internalOrderNo', columnIndex: 0 },
        { field: 'sizeText', columnIndex: 1 },
        // no quantity mapping
      ],
    });
    const { rows } = mapTableToImportRows(makeTable(), config);
    expect(rows[0].quantity).toBe(1);
  });

  it('空表返回 "没有数据行" warning', () => {
    const table = makeTable({ dataRows: [] });
    const { rows, warnings } = mapTableToImportRows(table, makeConfig());
    expect(rows).toHaveLength(0);
    expect(warnings).toContain('没有数据行');
  });

  it('跳过名称和尺寸都为空的行', () => {
    const table = makeTable({
      dataRows: [
        ['', '', ''],
        ['A001', '40-60', '2'],
      ],
    });
    const { rows } = mapTableToImportRows(table, makeConfig());
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('A001');
  });

  it('非法数量当作 1', () => {
    const table = makeTable({
      dataRows: [['A001', '40-60', 'abc']],
    });
    const { rows } = mapTableToImportRows(table, makeConfig());
    expect(rows[0].quantity).toBe(1);
  });
});
