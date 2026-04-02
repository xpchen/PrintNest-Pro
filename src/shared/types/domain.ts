/**
 * 产品级领域模型（草案）
 * 与算法视图类型 PrintItem / LayoutUnit 等并存，供持久化与后续迁移对齐。
 */

export const DOMAIN_SCHEMA_VERSION = 1 as const;

/** 项目根实体 */
export interface DomainProject {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  defaultUnit: 'mm' | 'cm' | 'inch';
  defaultCanvasProfileId?: string;
}

/** 素材文件记录 */
export interface DomainAsset {
  id: string;
  projectId: string;
  sourcePath?: string;
  managedRelativePath: string;
  fileHash?: string;
  pixelWidth?: number;
  pixelHeight?: number;
  dpiX?: number;
  dpiY?: number;
  importedAt: string;
}

/** 待排物料实例（业务层） */
export interface DomainArtworkItem {
  id: string;
  projectId: string;
  assetId?: string;
  name: string;
  designWidthMm: number;
  designHeightMm: number;
  quantity: number;
  canRotate: boolean;
  priority: number;
  groupCode?: string;
  bleedMm?: number;
  spacingMm?: number;
}

/** 画布 / 材料模板 */
export interface DomainCanvasProfile {
  id: string;
  projectId: string;
  name: string;
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  sheetType: 'sheet' | 'roll';
}

/** 一次排版运行记录（与 SQLite layout_runs 对应，可扩展） */
export interface DomainLayoutRun {
  id: string;
  projectId: string;
  createdAt: string;
  durationMs: number;
  utilization: number;
  unplacedCount: number;
  canvasCount: number;
  configSnapshotJson: string;
  warningsJson?: string;
  errorsJson?: string;
}

/** 落位结果（持久化视角） */
export interface DomainPlacement {
  id: string;
  layoutRunId: string;
  artworkItemId: string;
  copyIndex: number;
  canvasIndex: number;
  xMm: number;
  yMm: number;
  rotationDeg: number;
  packedWidthMm: number;
  packedHeightMm: number;
  isLocked: boolean;
}

/** 导出配置 */
export interface DomainExportProfile {
  id: string;
  projectId: string;
  name: string;
  mode: 'preview' | 'production';
  includeCropMarks: boolean;
  includeBleed: boolean;
  safeMarginMm?: number;
}

/** Excel 导入模板 */
export interface DomainImportTemplate {
  id: string;
  projectId: string;
  name: string;
  columnMappingJson: string;
  unitDefault: 'mm' | 'cm';
  headerRowIndex: number;
  createdAt: string;
}
