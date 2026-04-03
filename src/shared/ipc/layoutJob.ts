import type { LayoutResult } from '../types';

/** 主进程 layout:run 的返回体（与 preload 暴露一致） */
export type LayoutJobInvokeResult = {
  result: LayoutResult;
  layoutRunId?: string;
};

export type LayoutProgressPayload = {
  phase: string;
  pct: number;
};
