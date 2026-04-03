/**
 * 模板实例化引擎
 *
 * TemplateDefinition + DataRecord[] → TemplateInstance[]
 * 每条 DataRecord × 模板 → 1 个 TemplateInstance。
 */
import type {
  TemplateDefinition,
  DataRecord,
  TemplateInstance,
  TemplateInstanceIssue,
  TemplateElement,
  ResolvedTemplateElement,
  TemplateInstanceStatus,
} from '../types/template';

function issueId(): string {
  return `iss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function resolveElement(
  el: TemplateElement,
  record: DataRecord,
  issues: TemplateInstanceIssue[],
): ResolvedTemplateElement {
  const base: ResolvedTemplateElement = {
    id: el.id,
    type: el.type,
    xMm: el.xMm,
    yMm: el.yMm,
    widthMm: el.widthMm,
    heightMm: el.heightMm,
  };

  switch (el.type) {
    case 'fixedText':
      base.resolvedText = el.fixedValue;
      break;

    case 'variableText': {
      const key = el.binding.fieldKey;
      if (!key) {
        base.resolvedText = el.binding.fallbackValue ?? '';
      } else {
        const val = record.fields[key];
        if (val === undefined || val === '') {
          if (el.binding.fallbackValue !== undefined) {
            base.resolvedText = el.binding.fallbackValue;
          } else {
            base.resolvedText = '';
            issues.push({
              id: issueId(),
              level: 'error',
              code: 'missing_field',
              message: `字段 "${key}" 缺失`,
              elementId: el.id,
              recordId: record.id,
            });
          }
        } else {
          base.resolvedText = val;
        }
      }
      break;
    }

    case 'fixedImage':
      base.resolvedImageSrc = el.fixedValue;
      break;

    case 'variableImage': {
      const key = el.binding.fieldKey;
      if (!key) {
        base.resolvedImageSrc = el.fallbackImageSrc ?? '';
      } else {
        const val = record.fields[key];
        if (val === undefined || val === '') {
          if (el.fallbackImageSrc) {
            base.resolvedImageSrc = el.fallbackImageSrc;
          } else {
            base.resolvedImageSrc = '';
            issues.push({
              id: issueId(),
              level: 'error',
              code: 'missing_field',
              message: `图片字段 "${key}" 缺失`,
              elementId: el.id,
              recordId: record.id,
            });
          }
        } else {
          base.resolvedImageSrc = val;
        }
      }
      break;
    }

    case 'barcode': {
      const key = el.binding.fieldKey;
      if (!key) {
        base.resolvedBarcodeValue = el.binding.fallbackValue ?? '';
      } else {
        const val = record.fields[key];
        if (val === undefined || val === '') {
          base.resolvedBarcodeValue = '';
          issues.push({
            id: issueId(),
            level: 'error',
            code: 'missing_field',
            message: `条码字段 "${key}" 缺失`,
            elementId: el.id,
            recordId: record.id,
          });
        } else {
          // 基础格式校验
          if (el.barcodeStyle.format === 'ean13' && !/^\d{13}$/.test(val)) {
            issues.push({
              id: issueId(),
              level: 'warning',
              code: 'invalid_barcode',
              message: `EAN-13 需要 13 位数字，当前值: "${val}"`,
              elementId: el.id,
              recordId: record.id,
            });
          }
          base.resolvedBarcodeValue = val;
        }
      }
      break;
    }

    case 'qrcode': {
      const key = el.binding.fieldKey;
      if (!key) {
        base.resolvedBarcodeValue = el.binding.fallbackValue ?? '';
      } else {
        const val = record.fields[key];
        if (val === undefined || val === '') {
          base.resolvedBarcodeValue = '';
          issues.push({
            id: issueId(),
            level: 'error',
            code: 'missing_field',
            message: `二维码字段 "${key}" 缺失`,
            elementId: el.id,
            recordId: record.id,
          });
        } else {
          base.resolvedBarcodeValue = val;
        }
      }
      break;
    }

    case 'mark':
      // marks 不需要数据绑定
      break;
  }

  return base;
}

export interface InstantiationResult {
  instances: TemplateInstance[];
  totalErrors: number;
  totalWarnings: number;
}

/**
 * 实例化模板：每条 DataRecord 生成一个 TemplateInstance。
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
    const resolvedElements: ResolvedTemplateElement[] = [];

    for (const el of template.elements) {
      resolvedElements.push(resolveElement(el, record, issues));
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
      renderPayload: {
        templateName: template.name,
        recordFields: record.fields,
      },
      resolvedElements,
      status,
      validationErrors: issues.length > 0 ? issues : undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { instances, totalErrors, totalWarnings };
}
