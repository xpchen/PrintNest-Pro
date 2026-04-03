/**
 * 模板化数据域模型 — v0.3 完整版
 *
 * schema 一步到位，功能分阶段启用。
 * 主链路：DataRecord + TemplateDefinition → TemplateInstance → PrintItem → Layout
 */

/* ================================================================== */
/*  DataRecord — 导入数据行                                             */
/* ================================================================== */

/** Excel/CSV 导入后的结构化数据行 */
export interface DataRecord {
  id: string;
  /** 导入会话 id（同一次导入的 records 共享） */
  sourceSessionId?: string;
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
  createdAt: string;
  updatedAt: string;
}

/* ================================================================== */
/*  FieldBinding — 字段绑定                                            */
/* ================================================================== */

/** 字段绑定模式 */
export type FieldBindingMode = 'constant' | 'field';

/** 字段绑定配置 */
export interface FieldBinding {
  mode: FieldBindingMode;
  /** mode='field' 时绑定的 DataRecord field key */
  fieldKey?: string;
  /** 字段缺失或为空时的回退值 */
  fallbackValue?: string;
}

/* ================================================================== */
/*  TextStyle — 文本样式                                               */
/* ================================================================== */

export type TextOverflowMode = 'clip' | 'ellipsis' | 'shrink';

export interface TextStyle {
  fontFamily?: string;
  fontSizePt: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  color?: string;
  /** 最大行数（超出按 overflowMode 处理） */
  lineClamp?: number;
  overflowMode?: TextOverflowMode;
}

/* ================================================================== */
/*  BarcodeStyle — 条码样式                                            */
/* ================================================================== */

export type BarcodeFormat = 'code128' | 'code39' | 'ean13' | 'ean8' | 'upc_a' | 'itf14';

export interface BarcodeStyle {
  format: BarcodeFormat;
  /** 是否显示人类可读文本 */
  showHumanReadable?: boolean;
}

/* ================================================================== */
/*  TemplateElement — 模板元素（discriminated union）                    */
/* ================================================================== */

/** 所有元素的公共基础字段 */
export interface TemplateElementBase {
  id: string;
  /** 元素显示名 */
  name?: string;
  /** 相对于模板左上角 (mm) */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** 旋转角度（v0.3 只支持 0 / 90） */
  rotationDeg?: number;
  locked?: boolean;
  hidden?: boolean;
  /** 层级（越大越靠前） */
  zIndex: number;
}

/* ── 7 个子类型 ── */

export interface FixedImageElement extends TemplateElementBase {
  type: 'fixedImage';
  /** 图片路径或 base64 */
  fixedValue: string;
  /** 图片填充模式 */
  fitMode?: 'fill' | 'contain' | 'cover';
}

export interface VariableImageElement extends TemplateElementBase {
  type: 'variableImage';
  binding: FieldBinding;
  fitMode?: 'fill' | 'contain' | 'cover';
  /** 图片缺失时的回退图 */
  fallbackImageSrc?: string;
}

export interface FixedTextElement extends TemplateElementBase {
  type: 'fixedText';
  fixedValue: string;
  style: TextStyle;
}

export interface VariableTextElement extends TemplateElementBase {
  type: 'variableText';
  binding: FieldBinding;
  style: TextStyle;
}

export interface BarcodeElement extends TemplateElementBase {
  type: 'barcode';
  binding: FieldBinding;
  barcodeStyle: BarcodeStyle;
}

export interface QrCodeElement extends TemplateElementBase {
  type: 'qrcode';
  binding: FieldBinding;
}

export interface MarkElement extends TemplateElementBase {
  type: 'mark';
  /** 标记类型：十字线、边框、辅助线等 */
  markKind: 'crosshair' | 'border' | 'guideline';
  color?: string;
  lineWidthMm?: number;
}

/** 模板元素联合类型 */
export type TemplateElement =
  | FixedImageElement
  | VariableImageElement
  | FixedTextElement
  | VariableTextElement
  | BarcodeElement
  | QrCodeElement
  | MarkElement;

/** 元素类型字面量联合 */
export type TemplateElementType = TemplateElement['type'];

/* ================================================================== */
/*  TemplateValidationRule — 模板校验规则                                */
/* ================================================================== */

export type TemplateValidationRuleType =
  | 'required_field'
  | 'image_required'
  | 'text_not_empty'
  | 'barcode_not_empty';

export interface TemplateValidationRule {
  type: TemplateValidationRuleType;
  elementId?: string;
  fieldKey?: string;
}

/* ================================================================== */
/*  TemplateDefinition — 模板定义                                       */
/* ================================================================== */

export type TemplateStatus = 'draft' | 'active' | 'archived';

export interface TemplateDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  version: number;
  status: TemplateStatus;

  /** 画布模式（v0.3 只支持 single_piece） */
  canvasMode: 'single_piece';
  /** 模板设计尺寸 (mm) */
  widthMm: number;
  heightMm: number;

  elements: TemplateElement[];
  validationRules?: TemplateValidationRule[];

  createdAt: string;
  updatedAt: string;
}

/* ================================================================== */
/*  TemplateInstance — 模板 + 数据 = 实例                                */
/* ================================================================== */

/** 实例级校验问题 */
export interface TemplateInstanceIssue {
  id: string;
  level: 'error' | 'warning';
  code: string;
  message: string;
  elementId?: string;
  recordId?: string;
}

/** 已解析的元素值（实例渲染用） */
export interface ResolvedTemplateElement {
  id: string;
  type: TemplateElementType;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  resolvedText?: string;
  resolvedImageAssetId?: string;
  resolvedImageSrc?: string;
  resolvedBarcodeValue?: string;
}

export type TemplateInstanceStatus = 'valid' | 'warning' | 'error';

/**
 * 模板实例：一条 DataRecord 与一个 TemplateDefinition 的绑定结果。
 * 未来会生成 PrintItem 参与排版。
 */
export interface TemplateInstance {
  id: string;
  templateId: string;
  recordId: string;
  /** 实例化后的实际尺寸 (mm) */
  resolvedWidthMm: number;
  resolvedHeightMm: number;
  /** 渲染所需的完整数据 */
  renderPayload: Record<string, unknown>;
  /** 已解析的元素列表 */
  resolvedElements?: ResolvedTemplateElement[];
  /** 实例状态 */
  status: TemplateInstanceStatus;
  /** 校验问题 */
  validationErrors?: TemplateInstanceIssue[];
  /** 快照哈希（变化检测用） */
  snapshotHash?: string;
  createdAt: string;
  updatedAt: string;
}
