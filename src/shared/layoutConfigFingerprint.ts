import type { LayoutConfig } from './types';

/** 稳定短标签：同策略同画布同参则同串，用于 Run 列表区分 */
export function summarizeLayoutConfigFingerprint(cfg: LayoutConfig): string {
  const mode = cfg.singleCanvas ? '单画布' : '多画布';
  return `${cfg.canvas.width}×${cfg.canvas.height} · ${cfg.strategy} · ${mode}`;
}
