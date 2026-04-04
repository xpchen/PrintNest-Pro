/**
 * 模板实例化引擎 — v0.5 轻量版
 *
 * TemplateDefinition + DataRecord[] → TemplateInstance[]
 *
 * 只做校验 + 生成轻量索引。不再生成 resolvedElements 或 renderPayload。
 * 需要预览/排版/导出时，统一通过 resolveTemplateDrawables() 现算。
 */
import type {
  TemplateDefinition,
  DataRecord,
  TemplateInstance,
  TemplateInstanceIssue,
  TemplateElement,
  TemplateInstanceStatus,
} from '../types/template';

function issueId(): string {
  return `iss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 生成实例快照哈希：模板版本 + 模板元素摘要 + 记录字段摘要。
 * 用于增量失效判断 — hash 不同说明需要重新计算。
 */
function computeSnapshotHash(template: TemplateDefinition, record: DataRecord): string {
  // 轻量摘要：模板版本 + 元素 id/type 列表 + 记录字段排序 JSON
  const tplDigest = `v${template.version}:${template.widthMm}x${template.heightMm}:${template.elements.map((e) => `${e.id}:${e.type}`).join(',')}`;
  const fieldKeys = Object.keys(record.fields).sort();
  const fieldDigest = fieldKeys.map((k) => `${k}=${record.fields[k] ?? ''}`).join('|');
  // 简单 hash（djb2 变体）
  const raw = `${tplDigest}||${fieldDigest}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * 校验单个元素在给定记录下是否有数据问题。
 * 只生成 issues，不解析内容（内容解析由 resolveTemplateDrawables 负责）。
 */
function validateElement(
  el: TemplateElement,
  record: DataRecord,
  issues: TemplateInstanceIssue[],
): void {
  switch (el.type) {
    case 'fixedText':
    case 'fixedImage':
    case 'mark':
      // 固定内容元素无需校验字段
      break;

    case 'variableText': {
      const key = el.binding.fieldKey;
      if (key) {
        const val = record.fields[key];
        if ((val === undefined || val === '') && el.binding.fallbackValue === undefined) {
          issues.push({
            id: issueId(),
            level: 'error',
            code: 'missing_field',
            message: `字段 "${key}" 缺失`,
            elementId: el.id,
            recordId: record.id,
          });
        }
      }
      break;
    }

    case 'variableImage': {
      const key = el.binding.fieldKey;
      if (key) {
        const val = record.fields[key];
        if ((val === undefined || val === '') && !el.fallbackAssetId) {
          issues.push({
            id: issueId(),
            level: 'error',
            code: 'missing_field',
            message: `图片字段 "${key}" 缺失`,
            elementId: el.id,
            recordId: record.id,
          });
        }
      }
      break;
    }

    case 'barcode': {
      const key = el.binding.fieldKey;
      if (key) {
        const val = record.fields[key];
        if (val === undefined || val === '') {
          issues.push({
            id: issueId(),
            level: 'error',
            code: 'missing_field',
            message: `条码字段 "${key}" 缺失`,
            elementId: el.id,
            recordId: record.id,
          });
        } else if (el.barcodeStyle.format === 'ean13' && !/^\d{13}$/.test(val)) {
          issues.push({
            id: issueId(),
            level: 'warning',
            code: 'invalid_barcode',
            message: `EAN-13 需要 13 位数字，当前值: "${val}"`,
            elementId: el.id,
            recordId: record.id,
          });
        }
      }
      break;
    }

    case 'qrcode': {
      const key = el.binding.fieldKey;
      if (key) {
        const val = record.fields[key];
        if (val === undefined || val === '') {
          issues.push({
            id: issueId(),
            level: 'error',
            code: 'missing_field',
            message: `二维码字段 "${key}" 缺失`,
            elementId: el.id,
            recordId: record.id,
          });
        }
      }
      break;
    }
  }
}

export interface InstantiationResult {
  instances: TemplateInstance[];
  totalErrors: number;
  totalWarnings: number;
}

/**
 * 实例化模板：每条 DataRecord 生成一个轻量 TemplateInstance。
 * 只做校验，不解析内容。
 */
export function instantiateTemplate(
  template: TemplateDefinition,
  records: DataRecord[],
): InstantiationResult {
  const instances: TemplateInstance[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const record of records) {
    const issues: TemplateInstanceIssue[] = [];

    for (const el of template.elements) {
      validateElement(el, record, issues);
    }

    const errors = issues.filter((i) => i.level === 'error').length;
    const warnings = issues.filter((i) => i.level === 'warning').length;
    totalErrors += errors;
    totalWarnings += warnings;

    let status: TemplateInstanceStatus = 'valid';
    if (errors > 0) status = 'error';
    else if (warnings > 0) status = 'warning';

    const now = new Date().toISOString();
    instances.push({
      id: `inst_${template.id}_${record.id}`,
      templateId: template.id,
      recordId: record.id,
      resolvedWidthMm: template.widthMm,
      resolvedHeightMm: template.heightMm,
      status,
      validationErrors: issues.length > 0 ? issues : undefined,
      snapshotHash: computeSnapshotHash(template, record),
      createdAt: now,
      updatedAt: now,
    });
  }

  return { instances, totalErrors, totalWarnings };
}
