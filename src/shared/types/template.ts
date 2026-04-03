/**
 * 模板化数据域模型 — DataRecord / TemplateDefinition / TemplateInstance
 *
 * 这些类型为 template + data → instance → layout 链路的基础骨架。
 * v0.2 阶段仅定义类型和 store 占位，不接入排版流程。
 */

/* ------------------------------------------------------------------ */
/*  DataRecord — 导入数据行                                             */
/* ------------------------------------------------------------------ */

/** Excel/CSV 导入后的结构化数据行 */
export interface DataRecord {
  id: string;
  /** 原始表格中的行索引（0-based） */
  sourceRowIndex: number;
  /** 动态字段 key-value（列名 → 值） */
  fields: Record<string, string>;
  /** 数量 */
  qty: number;
  /** 来源文件名 */
  sourceName?: string;
  /** 来源 sheet 名 */
  sourceSheet?: string;
}

/* ------------------------------------------------------------------ */
/*  TemplateDefinition — 模板定义                                       */
/* ------------------------------------------------------------------ */

/** 模板元素类型 */
export type TemplateElementType =
  | 'fixedImage'
  | 'variableImage'
  | 'fixedText'
  | 'variableText'
  | 'barcode'
  | 'qrcode';

/** 模板中的一个元素 */
export interface TemplateElement {
  id: string;
  type: TemplateElementType;
  /** 相对于模板左上角的位置 (mm) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 固定类型的实际值（fixedImage → 图片路径，fixedText → 文本内容） */
  fixedValue?: string;
  /** 变量类型绑定的 DataRecord field key */
  fieldBinding?: string;
  /** 样式（字体、颜色、条码格式等，宽松结构） */
  style?: Record<string, unknown>;
}

/** 模板定义 */
export interface TemplateDefinition {
  id: string;
  name: string;
  /** 模板设计尺寸 (mm) */
  widthMm: number;
  heightMm: number;
  /** 模板包含的元素列表 */
  elements: TemplateElement[];
}

/* ------------------------------------------------------------------ */
/*  TemplateInstance — 模板 + 数据 = 实例                                */
/* ------------------------------------------------------------------ */

/**
 * 模板实例：一条 DataRecord 与一个 TemplateDefinition 的绑定结果。
 * 未来会生成 PrintItem 参与排版。
 */
export interface TemplateInstance {
  id: string;
  templateId: string;
  recordId: string;
  /** 实例化后的实际尺寸 (mm)，可能因数据内容微调 */
  resolvedWidthMm: number;
  resolvedHeightMm: number;
  /** 渲染所需的完整数据（变量解析后的值），宽松结构 */
  renderPayload: Record<string, unknown>;
}
