/**
 * resolveTemplateDrawables — 统一模板渲染协议层
 *
 * 纯函数，不依赖 DOM/React。
 * TemplateCanvas、预渲染器、metadata 摘要全部从此函数派生。
 */
import type { TemplateElement } from '../types/template';
import type {
  ResolveDrawablesInput,
  ResolvedDrawable,
  ResolvedTextDrawable,
  ResolvedImageDrawable,
  ResolvedRectDrawable,
  ResolvedBarcodeDrawable,
  ResolvedQrCodeDrawable,
} from '../types/template-render';

function baseFields(el: TemplateElement) {
  return {
    elementId: el.id,
    x: el.xMm,
    y: el.yMm,
    w: el.widthMm,
    h: el.heightMm,
    rotationDeg: el.rotationDeg ?? 0,
    hidden: el.hidden ?? false,
    locked: el.locked ?? false,
    zIndex: el.zIndex,
  };
}

function resolveOne(
  el: TemplateElement,
  input: ResolveDrawablesInput,
): ResolvedDrawable {
  const base = baseFields(el);
  const fields = input.record?.fields;

  switch (el.type) {
    case 'fixedText': {
      return {
        ...base,
        type: 'text',
        content: el.fixedValue,
        style: el.style,
        source: 'fixed',
      } satisfies ResolvedTextDrawable;
    }

    case 'variableText': {
      const key = el.binding.fieldKey;
      let content: string;
      let source: ResolvedTextDrawable['source'];

      if (!key || !fields) {
        content = el.binding.fallbackValue ?? `{${key || '?'}}`;
        source = key && fields ? 'missing' : 'fixed';
      } else {
        const val = fields[key];
        if (val !== undefined && val !== '') {
          content = val;
          source = 'bound';
        } else if (el.binding.fallbackValue !== undefined) {
          content = el.binding.fallbackValue;
          source = 'bound';
        } else {
          content = `⚠ {${key}}`;
          source = 'missing';
        }
      }

      return {
        ...base,
        type: 'text',
        content,
        style: el.style,
        source,
      } satisfies ResolvedTextDrawable;
    }

    case 'fixedImage': {
      const asset = input.assetMap.get(el.assetId);
      const src = asset?.thumbnailSrc || asset?.fullSrc || '';
      return {
        ...base,
        type: 'image',
        src,
        fitMode: el.fitMode || 'contain',
        source: src ? 'fixed' : 'missing',
      } satisfies ResolvedImageDrawable;
    }

    case 'variableImage': {
      const key = el.binding.fieldKey;
      let src = '';
      let source: ResolvedImageDrawable['source'] = 'missing';

      if (key && fields) {
        const val = fields[key];
        if (val) {
          // val 可能是 assetId 或外部路径
          const asset = input.assetMap.get(val);
          src = asset?.thumbnailSrc || asset?.fullSrc || val;
          source = 'bound';
        }
      }

      if (!src && el.fallbackAssetId) {
        const fb = input.assetMap.get(el.fallbackAssetId);
        src = fb?.thumbnailSrc || fb?.fullSrc || '';
        if (src) source = 'fallback';
      }

      return {
        ...base,
        type: 'image',
        src,
        fitMode: el.fitMode || 'contain',
        source,
      } satisfies ResolvedImageDrawable;
    }

    case 'barcode': {
      const key = el.binding.fieldKey;
      let value = '';
      let source: ResolvedBarcodeDrawable['source'] = 'missing';

      if (key && fields) {
        const val = fields[key];
        if (val !== undefined && val !== '') {
          value = val;
          source = 'bound';
        }
      }
      if (!value) {
        value = el.binding.fallbackValue || `{${key || '?'}}`;
      }

      return {
        ...base,
        type: 'barcode',
        value,
        format: el.barcodeStyle.format,
        showHumanReadable: el.barcodeStyle.showHumanReadable ?? true,
        placeholder: true,
        source,
      } satisfies ResolvedBarcodeDrawable;
    }

    case 'qrcode': {
      const key = el.binding.fieldKey;
      let value = '';
      let source: ResolvedQrCodeDrawable['source'] = 'missing';

      if (key && fields) {
        const val = fields[key];
        if (val !== undefined && val !== '') {
          value = val;
          source = 'bound';
        }
      }
      if (!value) {
        value = el.binding.fallbackValue || `{${key || '?'}}`;
      }

      return {
        ...base,
        type: 'qrcode',
        value,
        placeholder: true,
        source,
      } satisfies ResolvedQrCodeDrawable;
    }

    case 'mark': {
      return {
        ...base,
        type: 'rect',
        fill: el.markKind === 'border' ? undefined : `${el.color || '#DDA0DD'}22`,
        stroke: el.color || '#DDA0DD',
        strokeWidth: el.lineWidthMm ?? 0.25,
      } satisfies ResolvedRectDrawable;
    }
  }
}

/**
 * 将模板定义解析为统一渲染指令列表。
 *
 * 返回按 zIndex 升序排列的 drawables（越大越靠前）。
 */
export function resolveTemplateDrawables(
  input: ResolveDrawablesInput,
): ResolvedDrawable[] {
  const drawables = input.template.elements.map((el) => resolveOne(el, input));
  drawables.sort((a, b) => a.zIndex - b.zIndex);
  return drawables;
}
