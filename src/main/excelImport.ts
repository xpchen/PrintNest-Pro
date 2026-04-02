/**
 * Excel 导入：内部单号 + 尺寸列（宽-高，单位厘米）→ mm 尺寸素材行
 */
import readXlsxFile from 'read-excel-file/node';
import * as fs from 'fs';
import { ipcMain } from 'electron';
import type { ExcelImportResult, ExcelImportRow } from '../shared/excelImport';

function cellToString(v: unknown): string {
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

/** 「排版用尺寸」等列名也含「尺寸」，需排除，否则会读到非「宽-高」格式 */
function isSizeHeader(h: string): boolean {
  return h.includes('尺寸') && !h.includes('排版用');
}

const HEADER_SCAN_MAX_ROW = 10;

type ResolvedHeader = {
  data: NonNullable<Awaited<ReturnType<typeof readXlsxFile>>[0]['data']>;
  headerRowIndex: number;
  idxInternal: number;
  idxSize: number;
  idxQty: number;
};

/**
 * 多工作表 + 前若干行扫描：找到同时含「内部单号」「尺寸」表头的那一行。
 * 避免默认只读 sheets[0]（常为 Sheet2）而漏掉 Sheet1 上的表头。
 */
function resolveHeaderRow(
  sheets: Awaited<ReturnType<typeof readXlsxFile>>,
): ResolvedHeader | null {
  for (const { data } of sheets) {
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
      return { data, headerRowIndex, idxInternal, idxSize, idxQty };
    }
  }
  return null;
}

/** 将「40-60」类字符串解析为厘米宽高；支持 en/em dash */
function parseSizeCm(raw: string): { w: number; h: number } | null {
  const s = raw.replace(/[–—]/g, '-').trim();
  const m = s.match(/^([\d.]+)\s*-\s*([\d.]+)/);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

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

  return { rows, warnings };
}

export function registerExcelImportIPC(): void {
  ipcMain.handle('file:parseExcelImport', async (_event, filePath: string) => {
    return parseExcelImportFile(filePath);
  });
}
