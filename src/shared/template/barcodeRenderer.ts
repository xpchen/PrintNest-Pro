/**
 * 条码/二维码渲染工具
 *
 * 基于 bwip-js（条码）和 qrcode（二维码）。
 * Canvas 绘制直接操作像素（不经过 SVG 中间转换），确保可扫描。
 * SVG 输出供模板设计画布使用。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BwipModule = {
  toSVG: (opts: Record<string, unknown>) => string;
  toBuffer: (opts: Record<string, unknown>) => Promise<Uint8Array>;
  default?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QRCodeModule = {
  create: (text: string, opts?: Record<string, unknown>) => { modules: { data: Uint8Array; size: number } };
  toString: (text: string, opts?: Record<string, unknown>) => Promise<string>;
};

// bwip-js 条码格式映射（模板定义 → bwip-js bcid）
const FORMAT_MAP: Record<string, string> = {
  code128: 'code128',
  code39: 'code39',
  ean13: 'ean13',
  ean8: 'ean8',
  upc_a: 'upca',
  itf14: 'itf14',
};

/**
 * 生成条码 SVG 字符串（供模板设计画布使用）
 */
export async function renderBarcodeSvg(
  value: string,
  format: string,
  opts: {
    width: number;
    height: number;
    showHumanReadable?: boolean;
  },
): Promise<string> {
  try {
    const bwipjs = await import('bwip-js') as unknown as BwipModule;
    const bcid = FORMAT_MAP[format] || 'code128';
    const svg = bwipjs.toSVG({
      bcid,
      text: value,
      scale: 2,
      height: Math.max(5, opts.height * 0.6),
      includetext: opts.showHumanReadable ?? true,
      textxalign: 'center',
    });
    return svg;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'encode error';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.width} ${opts.height}">
      <rect width="100%" height="100%" fill="#fff" stroke="#e00" stroke-width="0.5"/>
      <text x="50%" y="40%" text-anchor="middle" font-size="3" fill="#c00">${format}</text>
      <text x="50%" y="65%" text-anchor="middle" font-size="2" fill="#c00">${escapeXml(msg)}</text>
    </svg>`;
  }
}

/**
 * 在 Canvas 2D 上下文中绘制条码
 * 方案：toSVG → data:image/svg+xml → Image → drawImage
 */
export async function drawBarcodeToCtx(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  value: string,
  format: string,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  scale: number,
  showHumanReadable: boolean,
): Promise<void> {
  try {
    const bwipjs = await import('bwip-js') as unknown as BwipModule;
    const bcid = FORMAT_MAP[format] || 'code128';

    // 先用一个估算高度生成 SVG，获取实际 viewBox 宽度
    const probeScale = Math.max(2, Math.round(scale));
    const probeSvg = bwipjs.toSVG({
      bcid, text: value, scale: probeScale, height: 10,
      includetext: false, textxalign: 'center',
    });
    const probeVb = probeSvg.match(/viewBox="[^"]*\s([\d.]+)\s/);
    const svgW = probeVb ? Number(probeVb[1]) : 200;

    // 按目标区域宽高比反算条码高度，使 SVG 自然比例接近目标
    // 文字区约占 viewBox 高度的 15%，条码区占 85%
    const targetRatio = dw / dh;
    const textFraction = showHumanReadable ? 0.15 : 0;
    const svgTotalH = svgW / targetRatio;
    const barH = (svgTotalH * (1 - textFraction)) / probeScale;

    const svg = bwipjs.toSVG({
      bcid,
      text: value,
      scale: probeScale,
      height: Math.max(5, Math.round(barH)),
      includetext: showHumanReadable,
      textxalign: 'center',
    });

    // SVG → data URL (with explicit width/height) → Image → drawImage
    const bmp = await svgToImageBitmap(svg, dw);

    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx, dy, dw, dh);

    // 条码填满目标区域
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bmp, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = true;
  } catch {
    drawBarcodePlaceholder(ctx, value, format, dx, dy, dw, dh, scale, showHumanReadable);
  }
}

/**
 * 将 SVG 字符串通过 HTMLImageElement 转换为可绘制的图像
 * 关键：注入 width/height 属性确保 Image 按正确分辨率渲染
 */
function svgToImageBitmap(svg: string, targetWidth: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // 解析 viewBox 获取原始宽高比
    const vbMatch = svg.match(/viewBox="([^"]+)"/);
    let svgWithSize = svg;
    if (vbMatch) {
      const parts = vbMatch[1].split(/\s+/).map(Number);
      const vbW = parts[2] || 100;
      const vbH = parts[3] || 50;
      // 按目标宽度等比计算像素尺寸（至少 3x 保证清晰）
      const renderW = Math.max(targetWidth, vbW * 3);
      const renderH = renderW * (vbH / vbW);
      // 注入 width/height 到 SVG 标签
      svgWithSize = svg.replace(
        /^<svg /,
        `<svg width="${Math.round(renderW)}" height="${Math.round(renderH)}" `,
      );
    }

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const encoded = btoa(unescape(encodeURIComponent(svgWithSize)));
    img.src = `data:image/svg+xml;base64,${encoded}`;
  });
}

/**
 * 生成二维码 SVG 字符串（供模板设计画布使用）
 */
export async function renderQrCodeSvg(
  value: string,
  opts: { width: number; height: number },
): Promise<string> {
  try {
    const QRCode = await import('qrcode') as unknown as QRCodeModule;
    const side = Math.min(opts.width, opts.height);
    const svg = await QRCode.toString(value, {
      type: 'svg',
      width: side,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    return svg;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'encode error';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.width} ${opts.height}">
      <rect width="100%" height="100%" fill="#fff" stroke="#e00" stroke-width="0.5"/>
      <text x="50%" y="50%" text-anchor="middle" font-size="3" fill="#c00">QR: ${escapeXml(msg)}</text>
    </svg>`;
  }
}

/**
 * 在 Canvas 2D 上下文中绘制二维码（直接像素绘制，不经过 SVG）
 */
export async function drawQrCodeToCtx(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  value: string,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): Promise<void> {
  try {
    const QRCode = await import('qrcode') as unknown as QRCodeModule;
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const modules = qr.modules;
    const moduleCount = modules.size;

    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx, dy, dw, dh);

    // 计算二维码绘制区域（正方形，居中，留 margin）
    const side = Math.min(dw, dh);
    const margin = side * 0.05;
    const qrSide = side - margin * 2;
    const cellSize = qrSide / moduleCount;
    const qx = dx + (dw - side) / 2 + margin;
    const qy = dy + (dh - side) / 2 + margin;

    // 逐模块绘制
    ctx.fillStyle = '#000000';
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (modules.data[row * moduleCount + col]) {
          ctx.fillRect(
            Math.round(qx + col * cellSize),
            Math.round(qy + row * cellSize),
            Math.ceil(cellSize),
            Math.ceil(cellSize),
          );
        }
      }
    }
  } catch {
    drawQrCodePlaceholder(ctx, dx, dy, dw, dh);
  }
}

/* ================================================================ */
/*  占位降级（编码失败时）                                            */
/* ================================================================ */

function drawBarcodePlaceholder(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  value: string,
  _format: string,
  dx: number, dy: number, dw: number, dh: number,
  scale: number,
  showHumanReadable: boolean,
): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#c00';
  ctx.lineWidth = 1;
  ctx.strokeRect(dx, dy, dw, dh);

  const barW = Math.max(1, 2 * scale);
  const barCount = Math.floor(dw / (barW * 2));
  ctx.fillStyle = '#333';
  for (let i = 0; i < barCount; i++) {
    const bx = dx + 4 * scale + i * barW * 2;
    if (bx + barW > dx + dw - 4 * scale) break;
    ctx.fillRect(bx, dy + 2 * scale, barW, dh * 0.6);
  }

  if (showHumanReadable && value) {
    const fs = Math.min(Math.max(dh * 0.15, 8 * scale), 14 * scale);
    ctx.font = `${fs}px monospace`;
    ctx.fillStyle = '#c00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(value.slice(0, 20), dx + dw / 2, dy + dh - 2 * scale, dw - 4 * scale);
  }
}

function drawQrCodePlaceholder(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  dx: number, dy: number, dw: number, dh: number,
): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#c00';
  ctx.lineWidth = 1;
  ctx.strokeRect(dx, dy, dw, dh);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#c00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('QR Error', dx + dw / 2, dy + dh / 2);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
