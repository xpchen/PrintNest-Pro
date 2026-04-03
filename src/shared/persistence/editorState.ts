/**
 * 编辑器持久化 DTO（主进程 DB ↔ 渲染进程）
 * 与 project.db 中 projects + artwork_items 行对应；LayoutResult 在 P0 仍以 JSON 过渡至 P1 拆 placements。
 */
import type { LayoutConfig, LayoutResult, PrintItem } from '../types';
import { PackingStrategy } from '../types';

export interface SerializedEditorState {
  projectName: string;
  config: LayoutConfig;
  items: PrintItem[];
  result: LayoutResult | null;
  layoutSourceSignature: string | null;
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
