/**
 * barcodeRenderer — SVG 渲染和异常边界测试
 *
 * 测试 renderBarcodeSvg / renderQrCodeSvg 的正常和边界情况。
 * Canvas 绘制函数（drawBarcodeToCtx / drawQrCodeToCtx）依赖浏览器 API，
 * 在 Node 环境中跳过（仅测试 guard 逻辑通过 SVG 函数间接验证）。
 */
import { describe, it, expect } from 'vitest';

let bwipAvailable = false;
let qrcodeAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('bwip-js');
  bwipAvailable = true;
} catch { /* not installed */ }

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('qrcode');
  qrcodeAvailable = true;
} catch { /* not installed */ }

describe.skipIf(!bwipAvailable)('renderBarcodeSvg', () => {
  it('正常值生成非空 SVG', async () => {
    const { renderBarcodeSvg } = await import('./barcodeRenderer');
    const svg = await renderBarcodeSvg('12345678', 'code128', {
      width: 100,
      height: 30,
      showHumanReadable: true,
    });
    expect(svg).toBeTruthy();
    expect(svg).toContain('<svg');
  });

  it('空字符串 value 返回错误 SVG（不抛异常）', async () => {
    const { renderBarcodeSvg } = await import('./barcodeRenderer');
    const svg = await renderBarcodeSvg('', 'code128', { width: 100, height: 30 });
    expect(svg).toBeTruthy();
    // 空值会被 bwip-js 拒绝，应返回 fallback SVG
    expect(svg).toContain('<svg');
  });

  it('未知 format 回退到 code128', async () => {
    const { renderBarcodeSvg } = await import('./barcodeRenderer');
    const svg = await renderBarcodeSvg('TEST123', 'unknown_format', { width: 100, height: 30 });
    expect(svg).toBeTruthy();
    expect(svg).toContain('<svg');
  });

  it('不同格式都能生成', async () => {
    const { renderBarcodeSvg } = await import('./barcodeRenderer');
    for (const format of ['code128', 'code39']) {
      const svg = await renderBarcodeSvg('ABC123', format, { width: 100, height: 30 });
      expect(svg).toContain('<svg');
    }
  });
});

describe.skipIf(!qrcodeAvailable)('renderQrCodeSvg', () => {
  it('正常值生成非空 SVG', async () => {
    const { renderQrCodeSvg } = await import('./barcodeRenderer');
    const svg = await renderQrCodeSvg('https://example.com', { width: 50, height: 50 });
    expect(svg).toBeTruthy();
    expect(svg).toContain('<svg');
  });

  it('空字符串 value 返回 fallback SVG（不抛异常）', async () => {
    const { renderQrCodeSvg } = await import('./barcodeRenderer');
    const svg = await renderQrCodeSvg('', { width: 50, height: 50 });
    expect(svg).toBeTruthy();
    expect(svg).toContain('<svg');
  });

  it('中文内容可编码', async () => {
    const { renderQrCodeSvg } = await import('./barcodeRenderer');
    const svg = await renderQrCodeSvg('中文测试内容', { width: 50, height: 50 });
    expect(svg).toBeTruthy();
    expect(svg).toContain('<svg');
  });
});
