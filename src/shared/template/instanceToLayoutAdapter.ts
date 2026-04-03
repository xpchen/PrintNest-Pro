/**
 * 模板实例 → PrintItem 适配器
 *
 * 将 TemplateInstance[] 转为 PrintItem[]，供现有排版引擎使用。
 * v0.3 不引入 RenderableUnit 中间层，直接映射。
 */
import type { PrintItem } from '../types';
import type { TemplateInstance, DataRecord } from '../types/template';

export interface AdapterOptions {
  defaultSpacing: number;
  defaultBleed: number;
  allowRotation: boolean;
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

/**
 * 将 ready 的模板实例转为 PrintItem[]。
 * 每个实例按对应 DataRecord 的 qty 设定 quantity。
 */
export function instancesToPrintItems(
  instances: TemplateInstance[],
  records: DataRecord[],
  options: AdapterOptions,
): PrintItem[] {
  const recordMap = new Map(records.map((r) => [r.id, r]));

  return instances.map((inst, idx) => {
    const record = recordMap.get(inst.recordId);
    const qty = record?.qty ?? 1;
    const name =
      (record?.fields?.['内部单号'] ??
        record?.fields?.['name'] ??
        record?.fields?.['sku'] ??
        `实例 ${idx + 1}`);

    return {
      id: `pi_${inst.id}`,
      name,
      width: inst.resolvedWidthMm,
      height: inst.resolvedHeightMm,
      quantity: qty,
      imageSrc: '',
      priority: 0,
      allowRotation: options.allowRotation,
      spacing: options.defaultSpacing,
      bleed: options.defaultBleed,
      color: COLORS[idx % COLORS.length],
    };
  });
}
