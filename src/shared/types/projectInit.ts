/**
 * 新建项目初始化向导 payload
 *
 * 用户在向导中填写生产上下文参数，创建项目时注入初始状态。
 */
import { PackingStrategy } from './index';

/** 显示/输入单位（存储与引擎仍以 mm 为准） */
export type ProjectUnit = 'mm' | 'cm' | 'inch';

/** 材料类型 */
export type MaterialType = 'sheet' | 'roll';

/** 起始方式（v0.3 只支持两种） */
export type ProjectStartMode = 'blank' | 'fromExcel';

export interface ProjectInitPayload {
  projectName: string;
  customerName?: string;
  defaultUnit: ProjectUnit;
  materialType: MaterialType;
  /** 画布/材料宽度 (mm) */
  canvasWidthMm: number;
  /** 画布/材料高度 (mm)；卷材模式可设为较大默认值 */
  canvasHeightMm: number;
  /** 全局间距 (mm) */
  globalSpacing: number;
  /** 全局出血 (mm) */
  globalBleed: number;
  /** 安全边距 (mm) */
  edgeSafeMm?: number;
  /** 是否允许旋转 */
  allowRotation: boolean;
  /** 排版策略 */
  strategy: PackingStrategy;
  /** 是否单画布模式 */
  singleCanvas: boolean;
  /** 起始方式 */
  startMode: ProjectStartMode;
}
