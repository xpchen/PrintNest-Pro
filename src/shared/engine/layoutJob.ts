/**
 * 排版任务纯函数入口：仅依赖输入快照，不读写 UI / 文件 / 数据库。
 * Worker 与主进程同步路径均应调用此函数。
 */
import type { LayoutConfig, LayoutResult, Placement, PrintItem } from '../types';
import { runLayout } from './LayoutScheduler';

export interface LayoutJobInput {
  items: PrintItem[];
  config: LayoutConfig;
  lockedPlacements?: Placement[];
}

export function executeLayoutJob(input: LayoutJobInput): LayoutResult {
  return runLayout(input.items, input.config, input.lockedPlacements);
}
