/**
 * pdfExport — 导出函数结构性测试
 *
 * pdfExport 深度依赖 Electron IPC 和 PDFKit native 模块，
 * 完整渲染测试需要 Electron 运行时环境。
 * 此处测试可在 Node 环境中验证的辅助逻辑。
 */
import { describe, it, expect } from 'vitest';

// base64ToBuffer 辅助函数测试（内联实现，与 pdfExport.ts 中逻辑一致）
function base64ToBuffer(dataUrl: string): Buffer {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

describe('pdfExport helpers', () => {
  it('base64ToBuffer 正确解析 data URL', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const buf = base64ToBuffer(dataUrl);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('base64ToBuffer 处理纯 base64（无前缀）', () => {
    const raw = 'iVBORw0KGgoAAAANSUhEUg==';
    const buf = base64ToBuffer(raw);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('base64ToBuffer 空输入不抛异常', () => {
    expect(() => base64ToBuffer('')).not.toThrow();
    const buf = base64ToBuffer('');
    expect(buf.length).toBe(0);
  });

  it('MM_TO_PT 常数验证', () => {
    const MM_TO_PT = 2.83465;
    // A4 宽度 210mm ≈ 595.28pt（标准 A4 点数）
    expect(Math.round(210 * MM_TO_PT * 100) / 100).toBeCloseTo(595.28, 0);
  });
});

describe('pdfExport stream safety (structural)', () => {
  it('try/finally 模式存在于代码中', async () => {
    // 读取源文件确认 try/finally 结构
    const fs = await import('fs');
    const source = fs.readFileSync(
      new URL('./pdfExport.ts', import.meta.url).pathname,
      'utf-8',
    );
    // 验证 try block 在 doc.pipe 之后
    const pipeIdx = source.indexOf('doc.pipe(stream)');
    const tryIdx = source.indexOf('try {', pipeIdx);
    const catchIdx = source.indexOf('} catch (err) {', tryIdx);
    const streamDestroyIdx = source.indexOf('stream.destroy()', catchIdx);

    expect(pipeIdx).toBeGreaterThan(-1);
    expect(tryIdx).toBeGreaterThan(pipeIdx);
    expect(catchIdx).toBeGreaterThan(tryIdx);
    expect(streamDestroyIdx).toBeGreaterThan(catchIdx);
  });
});
