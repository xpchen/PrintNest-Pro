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

/* ══════════════════════════════════════════════════════════
 *  启发式自动匹配
 * ══════════════════════════════════════════════════════════ */

type MatchRule = { field: ImportFieldKey; patterns: string[] };

const MATCH_RULES: MatchRule[] = [
  { field: 'internalOrderNo', patterns: ['单号', '内部单号', '内单号', '订单号', 'order', 'sku', '编号'] },
  { field: 'sizeText', patterns: ['尺寸', '大小', 'size', '规格'] },
  { field: 'quantity', patterns: ['数量', '件数', '份数', 'qty', 'quantity', '个数'] },
  { field: 'color', patterns: ['颜色', 'color', '色号'] },
  { field: 'barcode', patterns: ['条码', 'barcode', '编码'] },
  { field: 'imagePath', patterns: ['图片', '图路径', 'image', 'photo', '素材'] },
  { field: 'text1', patterns: ['备注', '文本', 'text', 'remark', '说明'] },
];

/**
 * 基于列表头文本启发式匹配 ImportFieldKey。
 * 返回最佳匹配的 FieldMapping[]。
 */
export function autoSuggestMapping(columns: ColumnProfile[]): FieldMapping[] {
  const used = new Set<ImportFieldKey>();
  const result: FieldMapping[] = [];

  for (const rule of MATCH_RULES) {
    if (used.has(rule.field)) continue;
    for (const col of columns) {
      const h = col.headerText.toLowerCase();
      const matched = rule.patterns.some((p) => h.includes(p.toLowerCase()));
      if (matched && !result.some((r) => r.columnIndex === col.index)) {
        result.push({ field: rule.field, columnIndex: col.index });
        used.add(rule.field);
        break;
      }
    }
  }

  // 排版用尺寸不应匹配到 sizeText
  const sizeMapping = result.find((m) => m.field === 'sizeText');
  if (sizeMapping) {
    const col = columns[sizeMapping.columnIndex];
    if (col?.headerText.includes('排版用')) {
      const idx = result.indexOf(sizeMapping);
      result.splice(idx, 1);
    }
  }

  return result;
}
