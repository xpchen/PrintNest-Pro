/**
 * 统一模板渲染协议类型 — resolveTemplateDrawables() 的输入/输出
 *
 * TemplateCanvas（SVG）、预渲染器（OffscreenCanvas）、metadata 摘要
 * 全部从此协议派生，不允许各自写解释逻辑。
 */
import type { TemplateDefinition, DataRecord, TextStyle } from './template';

/* ================================================================== */
/*  输入                                                               */
/* ================================================================== */

export interface AssetEntry {
  thumbnailSrc?: string;
  fullSrc?: string;
}

export interface ResolveDrawablesInput {
  template: TemplateDefinition;
  /** 预览用数据记录（设计模式可不传） */
  record?: DataRecord;
  /** assetId → 可用图片源 */
  assetMap: Map<string, AssetEntry>;
  previewContext?: { mode: 'design' | 'preview' };
}

/* ================================================================== */
/*  输出 — ResolvedDrawable 族                                         */
/* ================================================================== */

interface DrawableBase {
  elementId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotationDeg: number;
  hidden: boolean;
  locked: boolean;
  zIndex: number;
}

export interface ResolvedTextDrawable extends DrawableBase {
  type: 'text';
  content: string;
  style: TextStyle;
  /** 内容来源：fixed 为固定值，bound 为字段绑定已解析，missing 为缺失 */
  source: 'fixed' | 'bound' | 'missing';
}

export interface ResolvedImageDrawable extends DrawableBase {
  type: 'image';
  /** 可直接用于 <image> xlink:href 或 drawImage 的 src */
  src: string;
  fitMode: 'fill' | 'contain' | 'cover';
  /** 内容来源 */
  source: 'fixed' | 'bound' | 'fallback' | 'missing';
}

export interface ResolvedRectDrawable extends DrawableBase {
  type: 'rect';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface ResolvedBarcodeDrawable extends DrawableBase {
  type: 'barcode';
  value: string;
  format: string;
  showHumanReadable: boolean;
  /** 当前阶段 barcode 只做占位渲染 */
  placeholder: true;
  source: 'bound' | 'missing';
}

export interface ResolvedQrCodeDrawable extends DrawableBase {
  type: 'qrcode';
  value: string;
  placeholder: true;
  source: 'bound' | 'missing';
}

export type ResolvedDrawable =
  | ResolvedTextDrawable
  | ResolvedImageDrawable
  | ResolvedRectDrawable
  | ResolvedBarcodeDrawable
  | ResolvedQrCodeDrawable;
