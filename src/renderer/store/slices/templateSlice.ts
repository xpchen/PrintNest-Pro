/**
 * Template Slice — DataRecord / TemplateDefinition / TemplateInstance 状态占位
 *
 * v0.2 阶段仅提供最小 CRUD，不接入排版流程。
 */
import type { StateCreator } from 'zustand';
import type { DataRecord, TemplateDefinition, TemplateInstance } from '../../../shared/types';
import type { AppState, TemplateSlice } from '../types';

export const createTemplateSlice: StateCreator<AppState, [], [], TemplateSlice> = (set) => ({
  dataRecords: [],
  templates: [],
  templateInstances: [],

  setDataRecords: (records) => set({ dataRecords: records }),

  addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),

  removeTemplate: (id) =>
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== id),
      // 级联清理引用该模板的实例
      templateInstances: s.templateInstances.filter((i) => i.templateId !== id),
    })),

  setTemplateInstances: (instances) => set({ templateInstances: instances }),
});
