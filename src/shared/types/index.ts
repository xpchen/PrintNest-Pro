/**
 * PrintNest Pro - 核心数据模型
 * Core Data Models for the printing auto-layout system
 */

/** 原始素材 - 用户导入的图形 */
export interface PrintItem {
  id: string;
  name: string;
  /** 原始宽度 (mm) */
  width: number;
  /** 原始高度 (mm) */
  height: number;
  /** 需要排版的数量 */
  quantity: number;
  /** 素材图片路径或 base64（UI 预览；持久化以 assetId + 受管文件为准） */
  imageSrc: string;
  /** 关联 assets 表 id（有则主进程从磁盘 hydrate 预览） */
  assetId?: string;
  /** 分组标识 */
  group?: string;
  /** 优先级 (数值越大越优先) */
  priority: number;
  /** 是否允许旋转 */
  allowRotation: boolean;
  /** 间距 (mm) */
  spacing: number;
  /** 出血 (mm) */
  bleed: number;
  /** 颜色标识 (用于画布预览) */
  color: string;
}

/** 排版单元 - 由 PrintItem 按数量展开后的单个实例 */
export interface LayoutUnit {
  id: string;
  /** 所属 PrintItem 的 id */
  printItemId: string;
  /** 展开后的实例索引 (0-based) */
  instanceIndex: number;
  /** 含间距和出血后的实际排版宽度 */
  packedWidth: number;
  /** 含间距和出血后的实际排版高度 */
  packedHeight: number;
  /** 原始宽度 */
  originalWidth: number;
  /** 原始高度 */
  originalHeight: number;
  /** 是否允许旋转 */
  allowRotation: boolean;
  /** 分组 */
  group?: string;
  /** 优先级 */
  priority: number;
  /** 颜色标识 */
  color: string;
  /** 素材图片 */
  imageSrc: string;
}

/** 放置结果 - 一个 LayoutUnit 在画布上的具体位置 */
export interface Placement {
  id: string;
  /** 对应的 LayoutUnit id */
  layoutUnitId: string;
  /** 对应的 PrintItem id */
  printItemId: string;
  /** 所在画布索引 */
  canvasIndex: number;
  /** 放置 X 坐标 (mm) */
  x: number;
  /** 放置 Y 坐标 (mm) */
  y: number;
  /** 放置宽度 */
  width: number;
  /** 放置高度 */
  height: number;
  /** 是否旋转了 90° */
  rotated: boolean;
  /** 是否锁定 (不参与重排) */
  locked: boolean;
}

/** 画布定义 */
export interface Canvas {
  /** 画布宽度 (mm) */
  width: number;
  /** 画布高度 (mm) */
  height: number;
}

/** 单个画布的排版结果 */
export interface CanvasResult {
  /** 画布索引 */
  index: number;
  /** 该画布上的所有放置 */
  placements: Placement[];
  /** 利用率 (0-1) */
  utilization: number;
}

/** 完整排版结果 */
export interface LayoutResult {
  /** 所有画布的结果 */
  canvases: CanvasResult[];
  /** 总利用率 */
  totalUtilization: number;
  /** 未排入的单元 */
  unplaced: LayoutUnit[];
  /** 排版耗时 (ms) */
  elapsedMs: number;
  /** 几何与策略校验（自动排版后写入；手动改 placement 后由 store 刷新） */
  validation?: LayoutValidationReport;
}

/** MaxRects 排版策略 */
export enum PackingStrategy {
  /** Best Short Side Fit - 短边最佳匹配 */
  BestShortSideFit = 'BSSF',
  /** Best Long Side Fit - 长边最佳匹配 */
  BestLongSideFit = 'BLSF',
  /** Best Area Fit - 面积最佳匹配 */
  BestAreaFit = 'BAF',
  /** Bottom-Left - 左下角优先 */
  BottomLeft = 'BL',
}

/** 排版配置 */
export interface LayoutConfig {
  /** 画布尺寸 */
  canvas: Canvas;
  /** 排版策略 */
  strategy: PackingStrategy;
  /** 是否允许旋转 (全局) */
  allowRotation: boolean;
  /** 全局间距 (mm) - 会被素材自身的间距覆盖 */
  globalSpacing: number;
  /** 全局出血 (mm) */
  globalBleed: number;
  /**
   * 为 true 时只使用一张画布排版，放不下则进入未排入列表（不自动新建画布）。
   * 适合「一个 Excel 表 = 一张画布」等业务场景。
   */
  singleCanvas: boolean;
  /**
   * 成品区相对画布内缩的安全边（mm），用于校验落位是否过于贴边。
   * 默认 0 表示仅校验不越出画布。
   */
  edgeSafeMm?: number;
}

/** 校验严重级别 */
export type LayoutValidationSeverity = 'error' | 'warning';

/** 校验问题类别 */
export type LayoutValidationKind =
  | 'out_of_bounds'
  | 'overlap'
  | 'spacing_violation'
  | 'safe_edge'
  | 'single_canvas_overflow'
  | 'bleed_vs_canvas'
  | 'high_utilization';

/** 单条校验/风险提示 */
export interface LayoutValidationIssue {
  severity: LayoutValidationSeverity;
  kind: LayoutValidationKind;
  message: string;
  canvasIndex: number;
  placementIds?: string[];
}

/** 排版结果校验报告 */
export interface LayoutValidationReport {
  issues: LayoutValidationIssue[];
  /** 无 error 级别问题 */
  isValid: boolean;
}

export * from './domain';
