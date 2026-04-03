/**
 * ProjectSlice 单元测试
 *
 * 直接使用 zustand create() 构建独立 store 实例，不依赖 React。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import type { AppState } from '../types';
import { createProjectSlice } from './projectSlice';
import { createSelectionSlice } from './selectionSlice';
import { createCanvasViewSlice } from './canvasViewSlice';
import { createLayoutJobSlice } from './layoutJobSlice';
import { createUiShellSlice } from './uiShellSlice';
import { createTemplateSlice } from './templateSlice';
import { createLayoutConfig, createPrintItem, createLayoutResult } from '../../../__tests__/factories';

function makeStore() {
  return create<AppState>()((...args) => ({
    ...createProjectSlice(...args),
    ...createSelectionSlice(...args),
    ...createCanvasViewSlice(...args),
    ...createLayoutJobSlice(...args),
    ...createUiShellSlice(...args),
    ...createTemplateSlice(...args),
  }));
}

describe('ProjectSlice', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
  });

  // ─── addItem ───

  it('addItem 添加物料到 items 数组', () => {
    store.getState().addItem({ name: '测试物料', width: 100, height: 80, quantity: 2, imageSrc: '' });
    const items = store.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('测试物料');
    expect(items[0].width).toBe(100);
    expect(items[0].height).toBe(80);
    expect(items[0].quantity).toBe(2);
    expect(items[0].id).toBeTruthy();
  });

  it('addItem 自动生成 id 和 color', () => {
    store.getState().addItem({ name: 'a', width: 10, height: 10, quantity: 1, imageSrc: '' });
    store.getState().addItem({ name: 'b', width: 10, height: 10, quantity: 1, imageSrc: '' });
    const [a, b] = store.getState().items;
    expect(a.id).not.toBe(b.id);
    expect(a.color).toBeTruthy();
  });

  // ─── removeItem ───

  it('removeItem 移除指定物料', () => {
    store.getState().addItem({ name: 'a', width: 10, height: 10, quantity: 1, imageSrc: '' });
    store.getState().addItem({ name: 'b', width: 20, height: 20, quantity: 1, imageSrc: '' });
    const id = store.getState().items[0].id;
    store.getState().removeItem(id);
    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0].name).toBe('b');
  });

  it('removeItem 不存在的 id 不影响数组', () => {
    store.getState().addItem({ name: 'a', width: 10, height: 10, quantity: 1, imageSrc: '' });
    store.getState().removeItem('nonexistent');
    expect(store.getState().items).toHaveLength(1);
  });

  // ─── updateItem ───

  it('updateItem 更新指定字段', () => {
    store.getState().addItem({ name: 'a', width: 10, height: 10, quantity: 1, imageSrc: '' });
    const id = store.getState().items[0].id;
    store.getState().updateItem(id, { name: '改名', width: 200 });
    const item = store.getState().items[0];
    expect(item.name).toBe('改名');
    expect(item.width).toBe(200);
    expect(item.height).toBe(10); // 未修改的字段保持不变
  });

  // ─── duplicateItem ───

  it('duplicateItem 复制物料并追加 (副本) 后缀', () => {
    store.getState().addItem({ name: '原始', width: 50, height: 30, quantity: 3, imageSrc: '' });
    const origId = store.getState().items[0].id;
    store.getState().duplicateItem(origId);
    const items = store.getState().items;
    expect(items).toHaveLength(2);
    expect(items[1].name).toBe('原始 (副本)');
    expect(items[1].width).toBe(50);
    expect(items[1].id).not.toBe(origId);
  });

  // ─── clearItems ───

  it('clearItems 清空所有物料和相关状态', () => {
    store.getState().addItem({ name: 'a', width: 10, height: 10, quantity: 1, imageSrc: '' });
    store.getState().clearItems();
    expect(store.getState().items).toHaveLength(0);
    expect(store.getState().result).toBeNull();
    expect(store.getState().layoutSourceSignature).toBeNull();
  });

  // ─── setConfig ───

  it('setConfig 合并配置', () => {
    store.getState().setConfig({ globalSpacing: 10 });
    expect(store.getState().config.globalSpacing).toBe(10);
    // 其他字段保持不变
    expect(store.getState().config.strategy).toBeTruthy();
  });

  it('setCanvasSize 更新画布尺寸', () => {
    store.getState().setCanvasSize(1630, 50000);
    expect(store.getState().config.canvas.width).toBe(1630);
    expect(store.getState().config.canvas.height).toBe(50000);
  });

  // ─── hydrateFromEditorState ───

  it('hydrateFromEditorState 恢复完整状态', () => {
    const config = createLayoutConfig();
    const items = [createPrintItem({ id: 'h1' })];
    store.getState().hydrateFromEditorState({
      projectName: '恢复项目',
      config,
      items,
      result: null,
      layoutSourceSignature: 'sig-123',
      manualEdits: [
        { sourceRunId: null, placementId: 'p1', op: 'move', revision: 5, updatedAt: '' },
      ],
    });
    const s = store.getState();
    expect(s.projectName).toBe('恢复项目');
    expect(s.items).toHaveLength(1);
    expect(s.config).toEqual(config);
    expect(s.layoutSourceSignature).toBe('sig-123');
    expect(s.uiPhase).toBe('editor');
    expect(s.manualEdits).toHaveLength(1);
    expect(s.manualEditNextRevision).toBe(6); // max revision + 1
  });

  // ─── manualEdits ───

  it('appendManualEdit 追加编辑记录并自增 revision', () => {
    store.getState().appendManualEdit({
      sourceRunId: null,
      placementId: 'p1',
      op: 'move',
    });
    store.getState().appendManualEdit({
      sourceRunId: null,
      placementId: 'p2',
      op: 'lock',
    });
    const s = store.getState();
    expect(s.manualEdits).toHaveLength(2);
    expect(s.manualEdits[0].revision).toBe(1);
    expect(s.manualEdits[1].revision).toBe(2);
    expect(s.manualEditNextRevision).toBe(3);
  });

  it('clearManualEdits 清空编辑记录', () => {
    store.getState().appendManualEdit({ sourceRunId: null, placementId: 'p1', op: 'move' });
    store.getState().clearManualEdits();
    expect(store.getState().manualEdits).toHaveLength(0);
    expect(store.getState().manualEditNextRevision).toBe(1);
  });

  // ─── setProjectName ───

  it('setProjectName 设置项目名', () => {
    store.getState().setProjectName('新项目');
    expect(store.getState().projectName).toBe('新项目');
  });

  it('setProjectName 空字符串回退为默认名', () => {
    store.getState().setProjectName('');
    expect(store.getState().projectName).toBe('未命名项目');
  });
});
