/**
 * Template Slice — DataRecord / TemplateDefinition / TemplateInstance 状态管理
 *
 * v0.3：完整 CRUD + 编辑器状态（currentTemplate, selectedElements, previewRecord）。
 * 实例化引擎和排版接入在 Phase 3 接入。
 */
import type { StateCreator } from 'zustand';
import type { DataRecord, TemplateDefinition, TemplateInstance } from '../../../shared/types';
import type { AppState, TemplateSlice } from '../types';
import { instantiateTemplate } from '../../../shared/template/instantiate';

export const createTemplateSlice: StateCreator<AppState, [], [], TemplateSlice> = (set, get) => ({
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

  addElement: (templateId, element) =>
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === templateId
          ? { ...t, elements: [...t.elements, element], updatedAt: new Date().toISOString() }
          : t,
      ),
    })),

  updateElement: (templateId, elementId, patch) =>
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === templateId
          ? {
              ...t,
              elements: t.elements.map((el) =>
                el.id === elementId ? ({ ...el, ...patch } as typeof el) : el,
              ),
              updatedAt: new Date().toISOString(),
            }
          : t,
      ),
    })),

  removeElement: (templateId, elementId) =>
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === templateId
          ? {
              ...t,
              elements: t.elements.filter((el) => el.id !== elementId),
              updatedAt: new Date().toISOString(),
            }
          : t,
      ),
      selectedElementIds: s.selectedElementIds.filter((id) => id !== elementId),
    })),

  reorderElements: (templateId, orderedIds) =>
    set((s) => ({
      templates: s.templates.map((t) => {
        if (t.id !== templateId) return t;
        const map = new Map(t.elements.map((el) => [el.id, el]));
        const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean) as typeof t.elements;
        // 未在 orderedIds 中的元素追加到末尾
        for (const el of t.elements) {
          if (!orderedIds.includes(el.id)) reordered.push(el);
        }
        return { ...t, elements: reordered, updatedAt: new Date().toISOString() };
      }),
    })),

  instantiateAll: () => {
    const s = get();
    const allInstances: TemplateInstance[] = [];
    for (const tpl of s.templates) {
      const { instances } = instantiateTemplate(tpl, s.dataRecords);
      allInstances.push(...instances);
    }
    set({ templateInstances: allInstances });
  },
});
