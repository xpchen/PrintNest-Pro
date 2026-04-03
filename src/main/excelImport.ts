/**
 * Excel 导入 — 读取层 + 映射层 + 兼容组合入口
 *
 * 架构：
 *   readExcelSheets(filePath)          → ParsedTable[]       (读取层：纯 IO)
 *   mapTableToImportRows(table, cfg?)  → { rows, warnings }  (映射层：纯逻辑)
 *   parseExcelImportFile(filePath)     → ExcelImportResult    (组合入口，保持旧签名)
 *
 * CSV 接入只需产出 ParsedTable，映射层可直接复用。
 */
import readXlsxFile from 'read-excel-file/node';
import * as fs from 'fs';
import { ipcMain } from 'electron';
import type { ExcelImportResult, ExcelImportRow } from '../shared/excelImport';
import type { ParsedTable, ImportMappingConfig, ColumnProfile } from '../shared/importMapping';
import { log } from '../shared/logger';

/* ══════════════════════════════════════════════════════════
 *  工具函数
 * ══════════════════════════════════════════════════════════ */

export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Number.isInteger(v) ? String(v) : String(v);
  }
  if (typeof v === 'boolean') return '';
  if (typeof v === 'string') return v.trim();
  if (v instanceof Date) return '';
  return String(v).trim();
}

function findColIndex(headers: string[], predicate: (h: string) => boolean): number {
  for (let i = 0; i < headers.length; i++) {
    if (predicate(headers[i])) return i;
  }
  return -1;
}

/** 「排版用尺寸」等列名也含「尺寸」，需排除 */
function isSizeHeader(h: string): boolean {
  return h.includes('尺寸') && !h.includes('排版用');
}

/** 将「40-60」类字符串解析为厘米宽高；支持 en/em dash */
export function parseSizeCm(raw: string): { w: number; h: number } | null {
  const s = raw.replace(/[–—]/g, '-').trim();
  const m = s.match(/^([\d.]+)\s*-\s*([\d.]+)/);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

const HEADER_SCAN_MAX_ROW = 10;

type ResolvedHeader = {
  sheetIndex: number;
  sheetName: string;
  data: unknown[][];
  headerRowIndex: number;
  idxInternal: number;
  idxSize: number;
  idxQty: number;
};

/**
 * 多工作表 + 前若干行扫描：找到同时含「内部单号」「尺寸」表头的那一行。
 */
function resolveHeaderRow(
  sheets: Awaited<ReturnType<typeof readXlsxFile>>,
): ResolvedHeader | null {
  for (let si = 0; si < sheets.length; si++) {
    const { sheet: name, data } = sheets[si];
    if (!data.length) continue;
    const maxR = Math.min(HEADER_SCAN_MAX_ROW, data.length);
    for (let headerRowIndex = 0; headerRowIndex < maxR; headerRowIndex++) {
      const headerRow = data[headerRowIndex] ?? [];
      const headers = headerRow.map((c) => cellToString(c));
      const idxInternal = findColIndex(
        headers,
        (h) => h.includes('内部单号') || h.includes('内单号'),
      );
      const idxSize = findColIndex(headers, (h) => isSizeHeader(h));
      if (idxInternal < 0 || idxSize < 0) continue;

      const idxQty = findColIndex(
        headers,
        (h) => h.includes('数量') || h.includes('件数'),
      );
      return { sheetIndex: si, sheetName: name, data, headerRowIndex, idxInternal, idxSize, idxQty };
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════
 *  读取层 — readExcelSheets
 * ══════════════════════════════════════════════════════════ */

/**
 * 读取 Excel 文件，将每个 sheet 转为 ParsedTable（表头以下为 dataRows）。
 * 若未在前 HEADER_SCAN_MAX_ROW 行找到表头，则该 sheet 不产出。
 */
export async function readExcelSheets(filePath: string): Promise<ParsedTable[]> {
  const sheets = await readXlsxFile(filePath);
  const tables: ParsedTable[] = [];

  for (const { sheet: name, data } of sheets) {
    if (!data.length) continue;
    const maxR = Math.min(HEADER_SCAN_MAX_ROW, data.length);

    for (let hri = 0; hri < maxR; hri++) {
      const headerRow = data[hri] ?? [];
      const headers = headerRow.map((c) => cellToString(c));
      // 只要有至少 2 列非空文本，就视为表头
      const nonEmpty = headers.filter((h) => h.length > 0);
      if (nonEmpty.length < 2) continue;

      const SAMPLE_COUNT = 3;
      const columns: ColumnProfile[] = headers.map((headerText, index) => {
        const sampleValues: string[] = [];
        for (let r = hri + 1; r < Math.min(hri + 1 + SAMPLE_COUNT, data.length); r++) {
          sampleValues.push(cellToString(data[r]?.[index]));
        }
        return { index, headerText, sampleValues };
      });

      const dataRows: string[][] = [];
      for (let r = hri + 1; r < data.length; r++) {
        const row = data[r];
        if (!row) continue;
        dataRows.push(row.map((c) => cellToString(c)));
      }

      tables.push({
        sheetName: name,
        headerRowIndex: hri,
        columns,
        dataRows,
      });
      break; // 每个 sheet 最多产出一张表
    }
  }

  log.import.info('readExcelSheets done', { filePath, tableCount: tables.length });
  return tables;
}

/* ══════════════════════════════════════════════════════════
 *  映射层 — mapTableToImportRows
 * ══════════════════════════════════════════════════════════ */

/**
 * 根据 ImportMappingConfig 将 ParsedTable 映射为 ExcelImportRow[]。
 * 无 mapping 或映射不含 sizeText+internalOrderNo 时返回空 rows + warning。
 */
export function mapTableToImportRows(
  table: ParsedTable,
  config: ImportMappingConfig,
): { rows: ExcelImportRow[]; warnings: string[] } {
  const rows: ExcelImportRow[] = [];
  const warnings: string[] = [];

  const findMapping = (field: string) =>
    config.mappings.find((m) => m.field === field);

  const nameMapping = findMapping('internalOrderNo');
  const sizeMapping = findMapping('sizeText');
  const qtyMapping = findMapping('quantity');

  if (!nameMapping && !sizeMapping) {
    warnings.push('映射配置中缺少 internalOrderNo 和 sizeText 字段');
    return { rows, warnings };
  }

  const sizeUnit = config.sizeUnit ?? 'cm';
  const toMm = sizeUnit === 'cm' ? 10 : 1;

  for (let r = 0; r < table.dataRows.length; r++) {
    const dataRow = table.dataRows[r];
    const rowNum = table.headerRowIndex + 2 + r; // 1-based Excel 行号

    const name = nameMapping ? (dataRow[nameMapping.columnIndex] ?? '').trim() : '';
    const sizeStr = sizeMapping ? (dataRow[sizeMapping.columnIndex] ?? '').trim() : '';

    if (!name && !sizeStr) continue;

    if (!name) {
      warnings.push(`第 ${rowNum} 行: 缺少内部单号`);
      continue;
    }
    if (!sizeStr) {
      warnings.push(`第 ${rowNum} 行 (${name}): 缺少尺寸`);
      continue;
    }

    const parsed = parseSizeCm(sizeStr);
    if (!parsed) {
      warnings.push(`第 ${rowNum} 行 (${name}): 尺寸格式无效 (${sizeStr})`);
      continue;
    }

    let quantity = 1;
    if (qtyMapping) {
      const qv = dataRow[qtyMapping.columnIndex] ?? '';
      const n = parseFloat(qv);
      if (Number.isFinite(n) && n > 0) {
        quantity = Math.max(1, Math.floor(n));
      }
    }

    rows.push({
      name,
      widthMm: parsed.w * toMm,
      heightMm: parsed.h * toMm,
      quantity,
    });
  }

  if (rows.length === 0 && warnings.length === 0) {
    warnings.push('没有数据行');
  }

  log.import.info('mapTableToImportRows done', { rows: rows.length, warnings: warnings.length });
  return { rows, warnings };
}

/* ══════════════════════════════════════════════════════════
 *  组合入口 — parseExcelImportFile（保持旧签名兼容）
 * ══════════════════════════════════════════════════════════ */

/**
 * 兼容入口：读取 Excel → 自动识别表头 → 固定列逻辑解析 → ExcelImportResult。
 * 若未来提供 ImportMappingConfig，可改走 readExcelSheets + mapTableToImportRows。
 */
export async function parseExcelImportFile(filePath: string): Promise<ExcelImportResult> {
  const warnings: string[] = [];
  const rows: ExcelImportRow[] = [];

  if (!filePath || !fs.existsSync(filePath)) {
    return { rows: [], warnings: ['文件不存在'] };
  }

  let sheets: Awaited<ReturnType<typeof readXlsxFile>>;
  try {
    sheets = await readXlsxFile(filePath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], warnings: [`读取 Excel 失败: ${msg}`] };
  }

  if (!sheets.length) {
    return { rows: [], warnings: ['表格为空'] };
  }

  const resolved = resolveHeaderRow(sheets);
  if (!resolved) {
    warnings.push(
      '未找到表头：请在任一工作表前若干行提供含「内部单号」与「尺寸」的列名（「排版用尺寸」不算尺寸列）',
    );
    return { rows: [], warnings };
  }

  const { data, headerRowIndex, idxInternal, idxSize, idxQty } = resolved;

  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const name = cellToString(row[idxInternal]);
    const sizeStr = cellToString(row[idxSize]);

    if (!name && !sizeStr) continue;

    if (!name) {
      warnings.push(`第 ${r + 1} 行: 缺少内部单号`);
      continue;
    }
    if (!sizeStr) {
      warnings.push(`第 ${r + 1} 行 (${name}): 缺少尺寸`);
      continue;
    }

    const parsed = parseSizeCm(sizeStr);
    if (!parsed) {
      warnings.push(`第 ${r + 1} 行 (${name}): 尺寸格式无效 (${sizeStr})`);
      continue;
    }

    let quantity = 1;
    if (idxQty >= 0) {
      const qv = row[idxQty];
      let n: number;
      if (typeof qv === 'number' && Number.isFinite(qv)) {
        n = qv;
      } else {
        n = parseFloat(cellToString(qv));
      }
      if (Number.isFinite(n) && n > 0) {
        quantity = Math.max(1, Math.floor(n));
      }
    }

    rows.push({
      name,
      widthMm: parsed.w * 10,
      heightMm: parsed.h * 10,
      quantity,
    });
  }

  if (rows.length === 0 && warnings.length === 0) {
    warnings.push('没有数据行');
  }

  log.import.info('excel parsed', { rows: rows.length, warnings: warnings.length, filePath });
  return { rows, warnings };
}

export function registerExcelImportIPC(): void {
  ipcMain.handle('file:parseExcelImport', async (_event, filePath: string) => {
    return parseExcelImportFile(filePath);
  });
}
