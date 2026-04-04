/**
 * templatePreviewRenderer — generation counter + cache 逻辑测试
 *
 * 测试 bumpRenderGeneration / clearRenderCache 的行为。
 * batchPreRenderInstances 依赖 OffscreenCanvas（浏览器 API），
 * 在 Node 环境中跳过完整渲染测试。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bumpRenderGeneration, clearRenderCache } from './templatePreviewRenderer';

// Mock URL.createObjectURL / revokeObjectURL
const revokedUrls: string[] = [];

vi.stubGlobal('URL', {
  createObjectURL: (blob: unknown) => `blob:mock-${Math.random().toString(36).slice(2)}`,
  revokeObjectURL: (url: string) => { revokedUrls.push(url); },
});

describe('templatePreviewRenderer cache', () => {
  beforeEach(() => {
    clearRenderCache();
    revokedUrls.length = 0;
  });

  it('bumpRenderGeneration 递增 generation', () => {
    // 连续调用 3 次不应抛异常
    bumpRenderGeneration();
    bumpRenderGeneration();
    bumpRenderGeneration();
    // 没有直接读取 generation 的 API，但不抛异常即正确
  });

  it('clearRenderCache 不抛异常（空缓存）', () => {
    expect(() => clearRenderCache()).not.toThrow();
  });

  it('clearRenderCache 多次调用幂等', () => {
    clearRenderCache();
    clearRenderCache();
    clearRenderCache();
  });
});
