/**
 * 编辑器持久化 DTO（主进程 DB ↔ 渲染进程）
 * 与 project.db 中 projects + artwork_items 行对应；LayoutResult 在 P0 仍以 JSON 过渡至 P1 拆 placements。
 */
import type { LayoutConfig, LayoutResult, PrintItem, DataRecord, TemplateDefinition, TemplateInstance } from '../types';
import { PackingStrategy } from '../types';
import type { ProjectInitPayload } from '../types/projectInit';
import type { ManualEditPatch } from './manualEdits';

export interface SerializedEditorState {
  projectName: string;
  config: LayoutConfig;
  items: PrintItem[];
  result: LayoutResult | null;
  layoutSourceSignature: string | null;
  /** 手工编辑 patch 序列（与 lastLayoutRunId 语义配合） */
  manualEdits?: ManualEditPatch[];
  /** 模板域：数据记录 */
  dataRecords?: DataRecord[];
  /** 模板域：模板定义 */
  templates?: TemplateDefinition[];
  /** 模板域：模板实例 */
  templateInstances?: TemplateInstance[];
  /** 当前编辑的模板 id */
  activeTemplateId?: string | null;
}

export function emptyLayoutConfig(): LayoutConfig {
  return {
    canvas: { width: 1000, height: 1500 },
    strategy: PackingStrategy.BestShortSideFit,
    allowRotation: true,
    globalSpacing: 2,
    globalBleed: 3,
    singleCanvas: false,
  };
}

export function emptyEditorState(projectId: string): SerializedEditorState {
  return {
    projectName: '未命名项目',
    config: emptyLayoutConfig(),
    items: [],
    result: null,
    layoutSourceSignature: null,
  };
}

/**
 * 从向导 payload 生成初始 EditorState（替代 emptyEditorState 用于新建向导）。
 */
export function createInitialEditorState(
  _projectId: string,
  payload: ProjectInitPayload,
): SerializedEditorState {
  const config: LayoutConfig = {
    canvas: {
      width: payload.canvasWidthMm,
      height: payload.canvasHeightMm,
    },
    strategy: payload.strategy,
    allowRotation: payload.allowRotation,
    globalSpacing: payload.globalSpacing,
    globalBleed: payload.globalBleed,
    singleCanvas: payload.singleCanvas,
    edgeSafeMm: payload.edgeSafeMm,
  };

  return {
    projectName: payload.projectName,
    config,
    items: [],
    result: null,
    layoutSourceSignature: null,
  };
}
