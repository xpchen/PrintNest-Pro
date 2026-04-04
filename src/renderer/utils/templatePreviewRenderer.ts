/**
 * 模板预渲染器 — 基于 OffscreenCanvas + resolveTemplateDrawables()
 *
 * 为排版画布批量生成模板实例的预览位图（Blob URL）。
 * 缓存策略：generation counter + instanceId → Blob URL
 */
import { resolveTemplateDrawables } from '../../shared/template/resolveDrawables';
import type { ResolveDrawablesInput, ResolvedDrawable, AssetEntry } from '../../shared/types/template-render';
import type { TemplateDefinition, DataRecord, TemplateInstance } from '../../shared/types/template';

/* ================================================================ */
/*  缓存                                                             */
/* ================================================================ */

let currentGeneration = 0;

interface CacheEntry {
  generation: number;
  blobUrl: string;
}

const cache = new Map<string, CacheEntry>();

/** 递增 generation，使所有缓存过期 */
export function bumpRenderGeneration(): void {
  currentGeneration++;
}

/** 清除所有缓存并释放 Blob URL */
export function clearRenderCache(): void {
  for (const entry of cache.values()) {
    URL.revokeObjectURL(entry.blobUrl);
  }
  cache.clear();
}

/* ================================================================ */
/*  单实例渲染                                                       */
/* ================================================================ */

const PREVIEW_SCALE = 2; // 2x for retina

/**
 * 将 ResolvedDrawable[] 绘制到 OffscreenCanvas 上。
 * 坐标单位为 mm，用 scale 转换为 px。
 */
async function drawDrawables(
  drawables: ResolvedDrawable[],
  widthMm: number,
  heightMm: number,
  scale: number,
): Promise<Blob | null> {
  const w = Math.round(widthMm * scale);
  const h = Math.round(heightMm * scale);
  if (w <= 0 || h <= 0) return null;

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 白色背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // 加载图片的辅助函数
  const imgCache = new Map<string, ImageBitmap>();
  async function loadImg(src: string): Promise<ImageBitmap | null> {
    if (!src) return null;
    if (imgCache.has(src)) return imgCache.get(src)!;
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      const bmp = await createImageBitmap(blob);
      imgCache.set(src, bmp);
      return bmp;
    } catch {
      return null;
    }
  }

  // 预加载所有图片
  const imgSrcs = drawables
    .filter((d): d is Extract<ResolvedDrawable, { type: 'image' }> => d.type === 'image' && !!d.src)
    .map((d) => d.src);
  await Promise.all(imgSrcs.map((src) => loadImg(src)));

  // 按 zIndex 顺序绘制
  for (const d of drawables) {
    if (d.hidden) continue;

    const dx = d.x * scale;
    const dy = d.y * scale;
    const dw = d.w * scale;
    const dh = d.h * scale;

    ctx.save();

    // 旋转处理
    if (d.rotationDeg) {
      ctx.translate(dx + dw / 2, dy + dh / 2);
      ctx.rotate((d.rotationDeg * Math.PI) / 180);
      ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
    }

    switch (d.type) {
      case 'text': {
        const fontSize = (d.style.fontSizePt || 12) * scale * 0.35; // pt → mm → px (rough)
        const weight = d.style.fontWeight || 'normal';
        ctx.font = `${weight} ${fontSize}px sans-serif`;
        ctx.fillStyle = d.style.color || '#000000';

        // 文本对齐
        const align = d.style.align || 'left';
        let textX = dx;
        if (align === 'center') {
          ctx.textAlign = 'center';
          textX = dx + dw / 2;
        } else if (align === 'right') {
          ctx.textAlign = 'right';
          textX = dx + dw;
        } else {
          ctx.textAlign = 'left';
          textX = dx + 2 * scale;
        }

        ctx.textBaseline = 'middle';
        const textY = dy + dh / 2;

        // 裁剪到元素边界
        ctx.beginPath();
        ctx.rect(dx, dy, dw, dh);
        ctx.clip();
        ctx.fillText(d.content, textX, textY, dw);
        break;
      }

      case 'image': {
        const bmp = imgCache.get(d.src);
        if (bmp) {
          // fitMode 处理
          if (d.fitMode === 'fill') {
            ctx.drawImage(bmp, dx, dy, dw, dh);
          } else if (d.fitMode === 'cover') {
            const srcRatio = bmp.width / bmp.height;
            const dstRatio = dw / dh;
            let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
            if (srcRatio > dstRatio) {
              sw = bmp.height * dstRatio;
              sx = (bmp.width - sw) / 2;
            } else {
              sh = bmp.width / dstRatio;
              sy = (bmp.height - sh) / 2;
            }
            ctx.drawImage(bmp, sx, sy, sw, sh, dx, dy, dw, dh);
          } else {
            // contain
            const srcRatio = bmp.width / bmp.height;
            const dstRatio = dw / dh;
            let iw: number, ih: number;
            if (srcRatio > dstRatio) {
              iw = dw;
              ih = dw / srcRatio;
            } else {
              ih = dh;
              iw = dh * srcRatio;
            }
            const ix = dx + (dw - iw) / 2;
            const iy = dy + (dh - ih) / 2;
            ctx.drawImage(bmp, ix, iy, iw, ih);
          }
        } else {
          // 缺图占位
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(dx, dy, dw, dh);
          ctx.strokeStyle = '#ccc';
          ctx.lineWidth = 1;
          ctx.strokeRect(dx, dy, dw, dh);
        }
        break;
      }

      case 'barcode': {
        // 占位渲染：带边框的条码区域
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx, dy, dw, dh);

        // 条码条纹示意
        const barW = Math.max(1, 2 * scale);
        const barCount = Math.floor(dw / (barW * 2));
        ctx.fillStyle = '#333';
        for (let i = 0; i < barCount; i++) {
          const bx = dx + 4 * scale + i * barW * 2;
          if (bx + barW > dx + dw - 4 * scale) break;
          const bh = dh * 0.6;
          ctx.fillRect(bx, dy + 2 * scale, barW, bh);
        }

        // 底部文字
        if (d.showHumanReadable && d.value) {
          const fs = Math.min(fontSize(dh * 0.2, scale), 14 * scale);
          ctx.font = `${fs}px monospace`;
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(d.value.slice(0, 20), dx + dw / 2, dy + dh - 2 * scale, dw - 4 * scale);
        }
        break;
      }

      case 'qrcode': {
        // 占位渲染：QR 码方块示意
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx, dy, dw, dh);

        const side = Math.min(dw, dh);
        const qx = dx + (dw - side) / 2;
        const qy = dy + (dh - side) / 2;
        const cellSize = side / 7;

        // 简化 QR 定位角
        ctx.fillStyle = '#333';
        // 左上
        ctx.fillRect(qx, qy, cellSize * 3, cellSize * 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(qx + cellSize * 0.5, qy + cellSize * 0.5, cellSize * 2, cellSize * 2);
        ctx.fillStyle = '#333';
        ctx.fillRect(qx + cellSize, qy + cellSize, cellSize, cellSize);
        // 右上
        ctx.fillStyle = '#333';
        ctx.fillRect(qx + side - cellSize * 3, qy, cellSize * 3, cellSize * 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(qx + side - cellSize * 2.5, qy + cellSize * 0.5, cellSize * 2, cellSize * 2);
        ctx.fillStyle = '#333';
        ctx.fillRect(qx + side - cellSize * 2, qy + cellSize, cellSize, cellSize);
        // 左下
        ctx.fillStyle = '#333';
        ctx.fillRect(qx, qy + side - cellSize * 3, cellSize * 3, cellSize * 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(qx + cellSize * 0.5, qy + side - cellSize * 2.5, cellSize * 2, cellSize * 2);
        ctx.fillStyle = '#333';
        ctx.fillRect(qx + cellSize, qy + side - cellSize * 2, cellSize, cellSize);
        break;
      }

      case 'rect': {
        if (d.fill) {
          ctx.fillStyle = d.fill;
          ctx.fillRect(dx, dy, dw, dh);
        }
        if (d.stroke) {
          ctx.strokeStyle = d.stroke;
          ctx.lineWidth = (d.strokeWidth || 0.25) * scale;
          ctx.strokeRect(dx, dy, dw, dh);
        }
        break;
      }
    }

    ctx.restore();
  }

  // 关闭 ImageBitmap
  for (const bmp of imgCache.values()) bmp.close();

  return canvas.convertToBlob({ type: 'image/png' });
}

function fontSize(target: number, scale: number): number {
  return Math.max(target, 8 * scale);
}

/* ================================================================ */
/*  批量渲染                                                         */
/* ================================================================ */

export interface PreRenderInput {
  instance: TemplateInstance;
  template: TemplateDefinition;
  record?: DataRecord;
}

/**
 * 批量渲染模板实例预览图。
 * 返回 Map<instanceId, blobUrl>。
 * 已有有效缓存的实例会跳过渲染。
 */
export async function batchPreRenderInstances(
  inputs: PreRenderInput[],
  assetMap: Map<string, AssetEntry>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const gen = currentGeneration;

  const toRender: PreRenderInput[] = [];

  for (const input of inputs) {
    const cached = cache.get(input.instance.id);
    if (cached && cached.generation === gen) {
      result.set(input.instance.id, cached.blobUrl);
    } else {
      // 清除过期缓存
      if (cached) {
        URL.revokeObjectURL(cached.blobUrl);
        cache.delete(input.instance.id);
      }
      toRender.push(input);
    }
  }

  // 并行渲染（限制并发避免内存暴涨）
  const CONCURRENCY = 4;
  for (let i = 0; i < toRender.length; i += CONCURRENCY) {
    const batch = toRender.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (input) => {
      const resolveInput: ResolveDrawablesInput = {
        template: input.template,
        record: input.record,
        assetMap,
        previewContext: { mode: 'preview' },
      };
      const drawables = resolveTemplateDrawables(resolveInput);

      const blob = await drawDrawables(
        drawables,
        input.template.widthMm,
        input.template.heightMm,
        PREVIEW_SCALE,
      );

      if (blob) {
        const url = URL.createObjectURL(blob);
        cache.set(input.instance.id, { generation: gen, blobUrl: url });
        result.set(input.instance.id, url);
      }
    });
    await Promise.all(promises);
  }

  return result;
}
