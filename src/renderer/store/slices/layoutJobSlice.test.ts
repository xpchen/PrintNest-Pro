/**
 * LayoutJobSlice 单元测试
 *
 * 测试排版结果状态的增删改操作（toggleLock, deleteSelected, updatePlacement, alignSelected）
 * runAutoLayout 因依赖 requestAnimationFrame + electronAPI，不在此测试（需 integration test）
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
import {
  createPrintItem,
  createLayoutConfig,
  createLayoutResult,
  createCanvasResult,
  createPlacement,
} from '../../../__tests__/factories';

function makeStore(overrides?: Partial<AppState>) {
  const store = create<AppState>()((...args) => ({
    ...createProjectSlice(...args),
    ...createSelectionSlice(...args),
    ...createCanvasViewSlice(...args),
    ...createLayoutJobSlice(...args),
    ...createUiShellSlice(...args),
    ...createTemplateSlice(...args),
  }));
  if (overrides) store.setState(overrides);
  return store;
}

/** 创建一个带有结果的 store */
function makeStoreWithResult() {
  const p1 = createPlacement({ id: 'p1', printItemId: 'item1', x: 0, y: 0, width: 200, height: 100, locked: false });
  const p2 = createPlacement({ id: 'p2', printItemId: 'item2', x: 300, y: 0, width: 150, height: 80, locked: false });
  const p3 = createPlacement({ id: 'p3', printItemId: 'item1', x: 0, y: 200, width: 200, height: 100, locked: true });

  const result = createLayoutResult({
    canvases: [
      createCanvasResult({
        index: 0,
        placements: [p1, p2, p3],
        utilization: 0.3,
      }),
    ],
    totalUtilization: 0.3,
  });

  const items = [
    createPrintItem({ id: 'item1', width: 200, height: 100 }),
    createPrintItem({ id: 'item2', width: 150, height: 80 }),
  ];

  const config = createLayoutConfig({ canvas: { width: 1000, height: 800 } });

  return makeStore({ result, items, config });
}

describe('LayoutJobSlice', () => {
  // ─── toggleLock ───

  describe('toggleLock', () => {
    it('切换 placement 的锁定状态', () => {
      const store = makeStoreWithResult();
      expect(store.getState().result!.canvases[0].placements[0].locked).toBe(false);

      store.getState().toggleLock('p1');
      expect(store.getState().result!.canvases[0].placements[0].locked).toBe(true);

      store.getState().toggleLock('p1');
      expect(store.getState().result!.canvases[0].placements[0].locked).toBe(false);
    });

    it('记录 manualEdit', () => {
      const store = makeStoreWithResult();
      store.getState().toggleLock('p1');
      const edits = store.getState().manualEdits;
      expect(edits).toHaveLength(1);
      expect(edits[0].op).toBe('lock');
      expect(edits[0].placementId).toBe('p1');
    });

    it('result 为 null 时不报错', () => {
      const store = makeStore({ result: null });
      expect(() => store.getState().toggleLock('p1')).not.toThrow();
    });
  });

  // ─── batchLock ───

  describe('batchLock', () => {
    it('批量锁定多个 placement', () => {
      const store = makeStoreWithResult();
      store.getState().batchLock(['p1', 'p2'], true);
      const pls = store.getState().result!.canvases[0].placements;
      expect(pls.find((p) => p.id === 'p1')!.locked).toBe(true);
      expect(pls.find((p) => p.id === 'p2')!.locked).toBe(true);
    });

    it('批量解锁', () => {
      const store = makeStoreWithResult();
      store.getState().batchLock(['p3'], false);
      expect(store.getState().result!.canvases[0].placements[2].locked).toBe(false);
    });
  });

  // ─── deleteSelected ───

  describe('deleteSelected', () => {
    it('删除选中的 placements', () => {
      const store = makeStoreWithResult();
      store.setState({ selectedIds: ['p1', 'p2'] });
      store.getState().deleteSelected();
      const pls = store.getState().result!.canvases[0].placements;
      expect(pls).toHaveLength(1);
      expect(pls[0].id).toBe('p3');
    });

    it('删除后清空 selectedIds', () => {
      const store = makeStoreWithResult();
      store.setState({ selectedIds: ['p1'] });
      store.getState().deleteSelected();
      expect(store.getState().selectedIds).toEqual([]);
    });

    it('删除后利用率重新计算', () => {
      const store = makeStoreWithResult();
      const beforeUtil = store.getState().result!.totalUtilization;
      store.setState({ selectedIds: ['p1'] });
      store.getState().deleteSelected();
      const afterUtil = store.getState().result!.totalUtilization;
      expect(afterUtil).toBeLessThan(beforeUtil);
    });

    it('selectedIds 为空时不操作', () => {
      const store = makeStoreWithResult();
      store.setState({ selectedIds: [] });
      store.getState().deleteSelected();
      expect(store.getState().result!.canvases[0].placements).toHaveLength(3);
    });

    it('删除后触发 validation', () => {
      const store = makeStoreWithResult();
      store.setState({ selectedIds: ['p1'] });
      store.getState().deleteSelected();
      // validation 应该存在（由 withLayoutValidation 生成）
      expect(store.getState().result!.validation).toBeDefined();
    });
  });

  // ─── updatePlacement ───

  describe('updatePlacement', () => {
    it('更新 placement 位置', () => {
      const store = makeStoreWithResult();
      store.getState().updatePlacement('p1', { x: 50, y: 30 });
      const p = store.getState().result!.canvases[0].placements[0];
      expect(p.x).toBe(50);
      expect(p.y).toBe(30);
    });

    it('移动后记录 move manualEdit', () => {
      const store = makeStoreWithResult();
      store.getState().updatePlacement('p1', { x: 50, y: 30 });
      const edits = store.getState().manualEdits;
      expect(edits.length).toBeGreaterThanOrEqual(1);
      const moveEdit = edits.find((e) => e.op === 'move');
      expect(moveEdit).toBeDefined();
      expect(moveEdit!.placementId).toBe('p1');
    });

    it('旋转后记录 rotate manualEdit', () => {
      const store = makeStoreWithResult();
      store.getState().updatePlacement('p1', { rotated: true });
      const edits = store.getState().manualEdits;
      const rotateEdit = edits.find((e) => e.op === 'rotate');
      expect(rotateEdit).toBeDefined();
    });

    it('更新后触发 validation', () => {
      const store = makeStoreWithResult();
      store.getState().updatePlacement('p1', { x: 999 });
      expect(store.getState().result!.validation).toBeDefined();
    });
  });

  // ─── alignSelected ───

  describe('alignSelected', () => {
    let store: ReturnType<typeof makeStore>;

    beforeEach(() => {
      store = makeStoreWithResult();
      // p1: x=0, w=200; p2: x=300, w=150 → 选中这两个
      store.setState({ selectedIds: ['p1', 'p2'], activeCanvasIndex: 0 });
    });

    it('left 对齐', () => {
      store.getState().alignSelected('left');
      const pls = store.getState().result!.canvases[0].placements;
      const p1 = pls.find((p) => p.id === 'p1')!;
      const p2 = pls.find((p) => p.id === 'p2')!;
      expect(p1.x).toBe(p2.x);
      expect(p1.x).toBe(0); // minX = 0
    });

    it('right 对齐', () => {
      store.getState().alignSelected('right');
      const pls = store.getState().result!.canvases[0].placements;
      const p1 = pls.find((p) => p.id === 'p1')!;
      const p2 = pls.find((p) => p.id === 'p2')!;
      // maxX = 300+150 = 450
      expect(p1.x + p1.width).toBe(450);
      expect(p2.x + p2.width).toBe(450);
    });

    it('top 对齐', () => {
      store.getState().alignSelected('top');
      const pls = store.getState().result!.canvases[0].placements;
      const p1 = pls.find((p) => p.id === 'p1')!;
      const p2 = pls.find((p) => p.id === 'p2')!;
      expect(p1.y).toBe(0);
      expect(p2.y).toBe(0);
    });

    it('locked placement 不参与对齐', () => {
      // p3 is locked, 选中 p1 和 p3
      store.setState({ selectedIds: ['p1', 'p3'] });
      store.getState().alignSelected('left');
      // p3 仍在原位
      const p3 = store.getState().result!.canvases[0].placements.find((p) => p.id === 'p3')!;
      expect(p3.x).toBe(0);
      expect(p3.y).toBe(200);
    });

    it('少于 2 个可对齐 placement 不操作', () => {
      store.setState({ selectedIds: ['p1'] });
      const before = store.getState().result!.canvases[0].placements[0].x;
      store.getState().alignSelected('left');
      expect(store.getState().result!.canvases[0].placements[0].x).toBe(before);
    });
  });
});
