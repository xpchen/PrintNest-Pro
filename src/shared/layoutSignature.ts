/**
 * 用于判断「当前排版结果」是否与「素材列表 + 排版配置」仍一致
 */
import type { LayoutConfig, PrintItem } from './types';

export function buildLayoutSignature(items: PrintItem[], config: LayoutConfig): string {
  const itemPart = [...items]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((i) =>
      [
        i.id,
        Number(i.width) || 0,
        Number(i.height) || 0,
        i.quantity,
        i.spacing ?? '',
        i.bleed ?? '',
        i.priority,
        i.allowRotation ? 1 : 0,
      ].join(':'),
    )
    .join('|');
  const cfg = [
    config.canvas.width,
    config.canvas.height,
    config.strategy,
    config.globalSpacing,
    config.globalBleed,
    config.allowRotation ? 1 : 0,
    config.singleCanvas ? 1 : 0,
  ].join(':');
  return `${cfg}#${itemPart}`;
}
