/**
 * 右栏：属性/样式/绑定面板
 */
import React, { useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { TemplateElement } from '../../../shared/types';

export const TemplateInspector: React.FC = () => {
  const currentTemplateId = useAppStore((s) => s.currentTemplateId);
  const templates = useAppStore((s) => s.templates);
  const selectedElementIds = useAppStore((s) => s.selectedElementIds);
  const updateElement = useAppStore((s) => s.updateElement);
  const updateTemplate = useAppStore((s) => s.updateTemplate);
  const dataRecords = useAppStore((s) => s.dataRecords);

  const tpl = templates.find((t) => t.id === currentTemplateId);
  const selectedElement =
    selectedElementIds.length === 1
      ? tpl?.elements.find((el) => el.id === selectedElementIds[0])
      : null;

  // 从 dataRecords 提取可用字段 keys
  const fieldKeys = useMemo(() => {
    if (!dataRecords.length) return [];
    const keys = new Set<string>();
    for (const r of dataRecords) {
      for (const k of Object.keys(r.fields)) keys.add(k);
    }
    return Array.from(keys);
  }, [dataRecords]);

  const handleUpdateElement = useCallback(
    (patch: Partial<TemplateElement>) => {
      if (!currentTemplateId || !selectedElement) return;
      updateElement(currentTemplateId, selectedElement.id, patch);
    },
    [currentTemplateId, selectedElement, updateElement],
  );

  const handleUpdateTemplateName = useCallback(
    (name: string) => {
      if (!currentTemplateId) return;
      updateTemplate(currentTemplateId, { name });
    },
    [currentTemplateId, updateTemplate],
  );

  const handleUpdateTemplateSize = useCallback(
    (field: 'widthMm' | 'heightMm', value: number) => {
      if (!currentTemplateId) return;
      updateTemplate(currentTemplateId, { [field]: value });
    },
    [currentTemplateId, updateTemplate],
  );

  if (!tpl) {
    return (
      <div className="tpl-inspector tpl-inspector--empty">
        <p>选择模板查看属性</p>
      </div>
    );
  }

  return (
    <div className="tpl-inspector">
      {/* 模板属性 */}
      <div className="tpl-inspector__section">
        <div className="tpl-inspector__section-title">模板属性</div>
        <label className="tpl-inspector__field">
          <span className="tpl-inspector__label">名称</span>
          <input
            type="text"
            className="tpl-inspector__input"
            value={tpl.name}
            onChange={(e) => handleUpdateTemplateName(e.target.value)}
          />
        </label>
        <div className="tpl-inspector__field-row">
          <label className="tpl-inspector__field tpl-inspector__field--half">
            <span className="tpl-inspector__label">宽 (mm)</span>
            <input
              type="number"
              className="tpl-inspector__input"
              value={tpl.widthMm}
              min={1}
              onChange={(e) => handleUpdateTemplateSize('widthMm', Number(e.target.value))}
            />
          </label>
          <label className="tpl-inspector__field tpl-inspector__field--half">
            <span className="tpl-inspector__label">高 (mm)</span>
            <input
              type="number"
              className="tpl-inspector__input"
              value={tpl.heightMm}
              min={1}
              onChange={(e) => handleUpdateTemplateSize('heightMm', Number(e.target.value))}
            />
          </label>
        </div>
        <div className="tpl-inspector__meta">
          状态: {tpl.status} | 版本: {tpl.version} | 元素: {tpl.elements.length}
        </div>
      </div>

      {/* 元素属性 */}
      {selectedElement ? (
        <div className="tpl-inspector__section">
          <div className="tpl-inspector__section-title">
            元素: {selectedElement.name || selectedElement.type}
          </div>

          {/* 基础位置 */}
          <label className="tpl-inspector__field">
            <span className="tpl-inspector__label">名称</span>
            <input
              type="text"
              className="tpl-inspector__input"
              value={selectedElement.name || ''}
              onChange={(e) => handleUpdateElement({ name: e.target.value })}
            />
          </label>
          <div className="tpl-inspector__field-row">
            <label className="tpl-inspector__field tpl-inspector__field--half">
              <span className="tpl-inspector__label">X (mm)</span>
              <input
                type="number"
                className="tpl-inspector__input"
                value={selectedElement.xMm}
                step={0.5}
                onChange={(e) => handleUpdateElement({ xMm: Number(e.target.value) })}
              />
            </label>
            <label className="tpl-inspector__field tpl-inspector__field--half">
              <span className="tpl-inspector__label">Y (mm)</span>
              <input
                type="number"
                className="tpl-inspector__input"
                value={selectedElement.yMm}
                step={0.5}
                onChange={(e) => handleUpdateElement({ yMm: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="tpl-inspector__field-row">
            <label className="tpl-inspector__field tpl-inspector__field--half">
              <span className="tpl-inspector__label">宽 (mm)</span>
              <input
                type="number"
                className="tpl-inspector__input"
                value={selectedElement.widthMm}
                min={1}
                step={0.5}
                onChange={(e) => handleUpdateElement({ widthMm: Number(e.target.value) })}
              />
            </label>
            <label className="tpl-inspector__field tpl-inspector__field--half">
              <span className="tpl-inspector__label">高 (mm)</span>
              <input
                type="number"
                className="tpl-inspector__input"
                value={selectedElement.heightMm}
                min={1}
                step={0.5}
                onChange={(e) => handleUpdateElement({ heightMm: Number(e.target.value) })}
              />
            </label>
          </div>

          {/* 固定文本值 */}
          {selectedElement.type === 'fixedText' && (
            <label className="tpl-inspector__field">
              <span className="tpl-inspector__label">文本内容</span>
              <input
                type="text"
                className="tpl-inspector__input"
                value={selectedElement.fixedValue}
                onChange={(e) => handleUpdateElement({ fixedValue: e.target.value } as Partial<TemplateElement>)}
              />
            </label>
          )}

          {/* 变量绑定 */}
          {('binding' in selectedElement && selectedElement.binding) && (
            <div className="tpl-inspector__binding">
              <div className="tpl-inspector__label">字段绑定</div>
              <select
                className="tpl-inspector__input"
                value={selectedElement.binding.fieldKey || ''}
                onChange={(e) => {
                  const fieldKey = e.target.value || undefined;
                  handleUpdateElement({
                    binding: { ...selectedElement.binding, fieldKey },
                  } as Partial<TemplateElement>);
                }}
              >
                <option value="">-- 选择字段 --</option>
                {fieldKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              {fieldKeys.length === 0 && (
                <span className="tpl-inspector__hint">导入数据记录后可选择字段</span>
              )}
            </div>
          )}

          {/* zIndex */}
          <label className="tpl-inspector__field">
            <span className="tpl-inspector__label">层级 (zIndex)</span>
            <input
              type="number"
              className="tpl-inspector__input"
              value={selectedElement.zIndex}
              onChange={(e) => handleUpdateElement({ zIndex: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : selectedElementIds.length > 1 ? (
        <div className="tpl-inspector__section">
          <div className="tpl-inspector__section-title">多选 ({selectedElementIds.length} 元素)</div>
          <p className="tpl-inspector__hint">选择单个元素以编辑属性</p>
        </div>
      ) : (
        <div className="tpl-inspector__section">
          <div className="tpl-inspector__section-title">元素属性</div>
          <p className="tpl-inspector__hint">在画布或元素树中选择元素</p>
        </div>
      )}
    </div>
  );
};
