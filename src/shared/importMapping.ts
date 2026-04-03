/**
 * Tabular Import Abstraction — 表格导入抽象层
 *
 * 将 Excel/CSV 导入统一为 ParsedTable → FieldMapping → ImportRow 流程。
 * 当前由 Excel reader 产出 ParsedTable；未来 CSV reader 产出同结构即可复用映射层。
 */

/* ── 字段键 ── */

/** 导入字段语义键 */
export type ImportFieldKey =
  | 'internalOrderNo'
  | 'sizeText'
  | 'quantity'
  | 'sku'
  | 'color'
  | 'text1'
  | 'barcode'
  | 'imagePath';

/* ── 读取层产出 ── */

/** 单列画像 */
export interface ColumnProfile {
  /** 列索引（0-based） */
  index: number;
  /** 表头文本 */
  headerText: string;
  /** 前几行的样本值 */
  sampleValues: string[];
}

/** 读取层产出的结构化表格 */
export interface ParsedTable {
  sheetName: string;
  headerRowIndex: number;
  columns: ColumnProfile[];
  /** headerRow 之后的原始数据行（string[][] 以便映射层与格式无关） */
  dataRows: string[][];
}

/* ── 映射层配置 ── */

/** 单条字段映射 */
export interface FieldMapping {
  field: ImportFieldKey;
  columnIndex: number;
}

/** 导入映射配置 */
export interface ImportMappingConfig {
  mappings: FieldMapping[];
  /** 尺寸单位，默认 cm */
  sizeUnit?: 'cm' | 'mm';
  /** 尺寸格式，默认 W-H */
  sizeFormat?: 'WxH' | 'W-H';
}
