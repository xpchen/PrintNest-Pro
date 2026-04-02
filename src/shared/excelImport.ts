/**
 * Excel 尺寸导入 — 与主进程解析结果一致的数据结构
 */

export interface ExcelImportRow {
  name: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
}

export interface ExcelImportResult {
  rows: ExcelImportRow[];
  warnings: string[];
}
