/**
 * 模板实例 → PrintItem 适配器
 *
 * 将 TemplateInstance[] 转为 PrintItem[]，供现有排版引擎使用。
 * v0.3 不引入 RenderableUnit 中间层，直接映射。
 */
import type { PrintItem, PrintItemMetadata } from '../types';
import type { TemplateInstance, TemplateDefinition, DataRecord } from '../types/template';

export interface AdapterOptions {
  defaultSpacing: number;
  defaultBleed: number;
  allowRotation: boolean;
  /** 模板定义列表（用于填充 metadata.templateName） */
  templates?: TemplateDefinition[];
  /**
   * 模板实例生成的 PrintItem 是否允许旋转（默认 false）。
   * 模板标签有内容方向性，通常不应被引擎自动旋转。
   * 与全局 allowRotation 不同，此选项仅控制模板来源的 item。
   */
  allowInstanceRotation?: boolean;
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

/**
 * 候选名称字段：中文常见 + 英文常见。
 * 动态匹配，避免对特定数据 schema 的硬编码假设。
 */
const NAME_CANDIDATE_KEYS = [
  'name', 'sku', 'id', 'code', 'title',
  '内部单号', '名称', '品名', '编号', 'SKU',
];

/**
 * 关键字段展示优先级：先匹配这些 key，再按数据顺序补齐。
 */
const KEY_PRIORITY_KEYS = [
  'name', 'sku', 'id', 'title', 'code',
  '内部单号', '品名', '规格', '名称', '编号',
];

/** 从 record.fields 中按候选 key 列表取第一个非空值 */
function pickFirstFieldValue(record: DataRecord | undefined, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const k of keys) {
    const v = record.fields[k];
    if (v) return v;
  }
  return undefined;
}

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
  const tplMap = new Map((options.templates ?? []).map((t) => [t.id, t]));

  return instances.map((inst, idx) => {
    const record = recordMap.get(inst.recordId);
    const tpl = tplMap.get(inst.templateId);
    const qty = record?.qty ?? 1;
    // 动态提取名称：优先使用第一个非空字段值，不再依赖硬编码字段名
    const name = pickFirstFieldValue(record, NAME_CANDIDATE_KEYS) ?? `实例 ${idx + 1}`;

    // 提取关键字段（最多 3 个）：优先级键 + 其余字段
    const keyFields: PrintItemMetadata['keyFields'] = [];
    if (record) {
      const allKeys = Object.keys(record.fields);
      const priorityHits = KEY_PRIORITY_KEYS.filter((k) => allKeys.includes(k));
      const rest = allKeys.filter((k) => !KEY_PRIORITY_KEYS.includes(k));
      const ordered = [...priorityHits, ...rest];
      for (const k of ordered.slice(0, 3)) {
        const v = record.fields[k];
        if (v) keyFields.push({ label: k, value: v });
      }
    }

    const metadata: PrintItemMetadata = {
      templateName: tpl?.name ?? inst.templateId,
      keyFields,
      sourceTemplateId: inst.templateId,
      sourceRecordId: inst.recordId,
      sourceInstanceId: inst.id,
    };

    return {
      id: `pi_${inst.id}`,
      name,
      width: inst.resolvedWidthMm,
      height: inst.resolvedHeightMm,
      quantity: qty,
      imageSrc: '',
      priority: 0,
      allowRotation: options.allowInstanceRotation ?? false,
      spacing: options.defaultSpacing,
      bleed: options.defaultBleed,
      color: COLORS[idx % COLORS.length],
      metadata,
    };
  });
}
