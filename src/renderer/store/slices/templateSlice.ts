/**
 * Template Slice — DataRecord / TemplateDefinition / TemplateInstance 状态管理
 *
 * v0.3：完整 CRUD + 编辑器状态（currentTemplate, selectedElements, previewRecord）。
 * 实例化引擎和排版接入在 Phase 3 接入。
 */
import type { StateCreator } from 'zustand';
import type { DataRecord, TemplateDefinition, TemplateInstance } from '../../../shared/types';
import type { AppState, TemplateSlice } from '../types';

export const createTemplateSlice: StateCreator<AppState, [], [], TemplateSlice> = (set) => ({
  dataRecords: [],
  templates: [],
  templateInstances: [],
  currentTemplateId: null,
  selectedElementIds: [],
  previewRecordId: null,

  setDataRecords: (records) => set({ dataRecords: records }),

  clearDataRecords: () => set({ dataRecords: [] }),

  addTemplate: (t) =>
    set((s) => ({
      templates: [...s.templates, t],
      // 如果是第一个模板，自动设为当前
      currentTemplateId: s.currentTemplateId ?? t.id,
    })),

  updateTemplate: (id, patch) =>
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    })),

  removeTemplate: (id) =>
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== id),
      // 级联清理引用该模板的实例
      templateInstances: s.templateInstances.filter((i) => i.templateId !== id),
      // 如果删除的是当前模板，切到第一个或 null
      currentTemplateId:
        s.currentTemplateId === id
          ? s.templates.find((t) => t.id !== id)?.id ?? null
          : s.currentTemplateId,
      selectedElementIds: s.currentTemplateId === id ? [] : s.selectedElementIds,
    })),

  setCurrentTemplate: (id) =>
    set({ currentTemplateId: id, selectedElementIds: [] }),

  selectElements: (ids) => set({ selectedElementIds: ids }),

  setPreviewRecordId: (id) => set({ previewRecordId: id }),

  setTemplateInstances: (instances) => set({ templateInstances: instances }),
});
