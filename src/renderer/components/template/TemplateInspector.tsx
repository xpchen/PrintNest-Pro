/**
 * 右栏：属性/样式/绑定面板
 */
import React, { useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AssetPicker } from './AssetPicker';
import type {
  TemplateElement,
  FixedTextElement,
  FixedImageElement,
  VariableTextElement,
  VariableImageElement,
  BarcodeElement,
  BarcodeFormat,
} from '../../../shared/types';

export const TemplateInspector: React.FC = () => {
  const currentTemplateId = useAppStore((s) => s.currentTemplateId);
  const templates = useAppStore((s) => s.templates);
  const selectedElementIds = useAppStore((s) => s.selectedElementIds);
  const updateElement = useAppStore((s) => s.updateElement);
  const updateTemplate = useAppStore((s) => s.updateTemplate);
  const dataRecords = useAppStore((s) => s.dataRecords);
  const previewRecordId = useAppStore((s) => s.previewRecordId);

  const tpl = templates.find((t) => t.id === currentTemplateId);
  const selectedElement =
    selectedElementIds.length === 1
      ? tpl?.elements.find((el) => el.id === selectedElementIds[0])
      : null;
  const previewRecord = dataRecords.find((r) => r.id === previewRecordId);

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

          {/* ── fixedText: 内容 + 样式 ── */}
          {selectedElement.type === 'fixedText' && (() => {
            const el = selectedElement as FixedTextElement;
            return (
              <>
                <label className="tpl-inspector__field">
                  <span className="tpl-inspector__label">文本内容</span>
                  <input
                    type="text"
                    className="tpl-inspector__input"
                    value={el.fixedValue}
                    onChange={(e) => handleUpdateElement({ fixedValue: e.target.value } as Partial<TemplateElement>)}
                  />
                </label>
                <div className="tpl-inspector__field-row">
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">字号 (pt)</span>
                    <input
                      type="number"
                      className="tpl-inspector__input"
                      value={el.style.fontSizePt}
                      min={1}
                      onChange={(e) => handleUpdateElement({ style: { ...el.style, fontSizePt: Number(e.target.value) } } as Partial<TemplateElement>)}
                    />
                  </label>
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">粗细</span>
                    <select
                      className="tpl-inspector__input"
                      value={el.style.fontWeight || 'normal'}
                      onChange={(e) => handleUpdateElement({ style: { ...el.style, fontWeight: e.target.value as 'normal' | 'bold' } } as Partial<TemplateElement>)}
                    >
                      <option value="normal">常规</option>
                      <option value="bold">粗体</option>
                    </select>
                  </label>
                </div>
                <div className="tpl-inspector__field-row">
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">对齐</span>
                    <select
                      className="tpl-inspector__input"
                      value={el.style.align || 'left'}
                      onChange={(e) => handleUpdateElement({ style: { ...el.style, align: e.target.value as 'left' | 'center' | 'right' } } as Partial<TemplateElement>)}
                    >
                      <option value="left">左</option>
                      <option value="center">居中</option>
                      <option value="right">右</option>
                    </select>
                  </label>
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">颜色</span>
                    <input
                      type="color"
                      className="tpl-inspector__input tpl-inspector__input--color"
                      value={el.style.color || '#000000'}
                      onChange={(e) => handleUpdateElement({ style: { ...el.style, color: e.target.value } } as Partial<TemplateElement>)}
                    />
                  </label>
                </div>
              </>
            );
          })()}

          {/* ── variableText: 绑定 + 样式 + 预览值 ── */}
          {selectedElement.type === 'variableText' && (() => {
            const el = selectedElement as VariableTextElement;
            const previewValue = previewRecord && el.binding.fieldKey
              ? previewRecord.fields[el.binding.fieldKey]
              : undefined;
            return (
              <>
                <div className="tpl-inspector__binding">
                  <span className="tpl-inspector__label">字段绑定</span>
                  <select
                    className="tpl-inspector__input"
                    value={el.binding.fieldKey || ''}
                    onChange={(e) => handleUpdateElement({ binding: { ...el.binding, fieldKey: e.target.value || undefined } } as Partial<TemplateElement>)}
                  >
                    <option value="">-- 选择字段 --</option>
                    {fieldKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  {fieldKeys.length === 0 && (
                    <span className="tpl-inspector__hint">导入数据记录后可选择字段</span>
                  )}
                </div>
                {previewRecord && (
                  <div className="tpl-inspector__preview-value">
                    <span className="tpl-inspector__label">预览值</span>
                    <span className={`tpl-inspector__preview-text ${previewValue === undefined ? 'tpl-inspector__preview-text--missing' : ''}`}>
                      {previewValue !== undefined ? previewValue : '⚠ 字段缺失'}
                    </span>
                  </div>
                )}
                <div className="tpl-inspector__field-row">
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">字号 (pt)</span>
                    <input
                      type="number"
                      className="tpl-inspector__input"
                      value={el.style.fontSizePt}
                      min={1}
                      onChange={(e) => handleUpdateElement({ style: { ...el.style, fontSizePt: Number(e.target.value) } } as Partial<TemplateElement>)}
                    />
                  </label>
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">粗细</span>
                    <select
                      className="tpl-inspector__input"
                      value={el.style.fontWeight || 'normal'}
                      onChange={(e) => handleUpdateElement({ style: { ...el.style, fontWeight: e.target.value as 'normal' | 'bold' } } as Partial<TemplateElement>)}
                    >
                      <option value="normal">常规</option>
                      <option value="bold">粗体</option>
                    </select>
                  </label>
                </div>
                <div className="tpl-inspector__field-row">
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">对齐</span>
                    <select
                      className="tpl-inspector__input"
                      value={el.style.align || 'left'}
                      onChange={(e) => handleUpdateElement({ style: { ...el.style, align: e.target.value as 'left' | 'center' | 'right' } } as Partial<TemplateElement>)}
                    >
                      <option value="left">左</option>
                      <option value="center">居中</option>
                      <option value="right">右</option>
                    </select>
                  </label>
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">颜色</span>
                    <input
                      type="color"
                      className="tpl-inspector__input tpl-inspector__input--color"
                      value={el.style.color || '#000000'}
                      onChange={(e) => handleUpdateElement({ style: { ...el.style, color: e.target.value } } as Partial<TemplateElement>)}
                    />
                  </label>
                </div>
              </>
            );
          })()}

          {/* ── fixedImage: assetId 选择器 + fitMode ── */}
          {selectedElement.type === 'fixedImage' && (() => {
            const el = selectedElement as FixedImageElement;
            return (
              <>
                <AssetPicker
                  label="图片资产"
                  value={el.assetId}
                  onChange={(assetId) => handleUpdateElement({ assetId } as Partial<TemplateElement>)}
                />
                <label className="tpl-inspector__field">
                  <span className="tpl-inspector__label">填充模式</span>
                  <select
                    className="tpl-inspector__input"
                    value={el.fitMode || 'contain'}
                    onChange={(e) => handleUpdateElement({ fitMode: e.target.value as 'fill' | 'contain' | 'cover' } as Partial<TemplateElement>)}
                  >
                    <option value="contain">适应 (contain)</option>
                    <option value="cover">裁切 (cover)</option>
                    <option value="fill">拉伸 (fill)</option>
                  </select>
                </label>
              </>
            );
          })()}

          {/* ── variableImage: 绑定 + fitMode + fallback ── */}
          {selectedElement.type === 'variableImage' && (() => {
            const el = selectedElement as VariableImageElement;
            const previewValue = previewRecord && el.binding.fieldKey
              ? previewRecord.fields[el.binding.fieldKey]
              : undefined;
            return (
              <>
                <div className="tpl-inspector__binding">
                  <span className="tpl-inspector__label">字段绑定</span>
                  <select
                    className="tpl-inspector__input"
                    value={el.binding.fieldKey || ''}
                    onChange={(e) => handleUpdateElement({ binding: { ...el.binding, fieldKey: e.target.value || undefined } } as Partial<TemplateElement>)}
                  >
                    <option value="">-- 选择字段 --</option>
                    {fieldKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                {previewRecord && (
                  <div className="tpl-inspector__preview-value">
                    <span className="tpl-inspector__label">预览值</span>
                    <span className={`tpl-inspector__preview-text ${previewValue === undefined ? 'tpl-inspector__preview-text--missing' : ''}`}>
                      {previewValue !== undefined ? previewValue : '⚠ 字段缺失'}
                    </span>
                  </div>
                )}
                <label className="tpl-inspector__field">
                  <span className="tpl-inspector__label">填充模式</span>
                  <select
                    className="tpl-inspector__input"
                    value={el.fitMode || 'contain'}
                    onChange={(e) => handleUpdateElement({ fitMode: e.target.value as 'fill' | 'contain' | 'cover' } as Partial<TemplateElement>)}
                  >
                    <option value="contain">适应 (contain)</option>
                    <option value="cover">裁切 (cover)</option>
                    <option value="fill">拉伸 (fill)</option>
                  </select>
                </label>
                <AssetPicker
                  label="回退图片"
                  value={el.fallbackAssetId || ''}
                  onChange={(assetId) => handleUpdateElement({ fallbackAssetId: assetId || undefined } as Partial<TemplateElement>)}
                />
              </>
            );
          })()}

          {/* ── barcode: format + showHumanReadable + 绑定 ── */}
          {selectedElement.type === 'barcode' && (() => {
            const el = selectedElement as BarcodeElement;
            const previewValue = previewRecord && el.binding.fieldKey
              ? previewRecord.fields[el.binding.fieldKey]
              : undefined;
            return (
              <>
                <div className="tpl-inspector__binding">
                  <span className="tpl-inspector__label">字段绑定</span>
                  <select
                    className="tpl-inspector__input"
                    value={el.binding.fieldKey || ''}
                    onChange={(e) => handleUpdateElement({ binding: { ...el.binding, fieldKey: e.target.value || undefined } } as Partial<TemplateElement>)}
                  >
                    <option value="">-- 选择字段 --</option>
                    {fieldKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                {previewRecord && el.binding.fieldKey && (
                  <div className="tpl-inspector__preview-value">
                    <span className="tpl-inspector__label">预览值</span>
                    <span className={`tpl-inspector__preview-text ${previewValue === undefined ? 'tpl-inspector__preview-text--missing' : ''}`}>
                      {previewValue !== undefined ? previewValue : '⚠ 字段缺失'}
                    </span>
                  </div>
                )}
                <div className="tpl-inspector__field-row">
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">条码格式</span>
                    <select
                      className="tpl-inspector__input"
                      value={el.barcodeStyle.format}
                      onChange={(e) => handleUpdateElement({ barcodeStyle: { ...el.barcodeStyle, format: e.target.value as BarcodeFormat } } as Partial<TemplateElement>)}
                    >
                      <option value="code128">Code 128</option>
                      <option value="code39">Code 39</option>
                      <option value="ean13">EAN-13</option>
                      <option value="ean8">EAN-8</option>
                      <option value="upc_a">UPC-A</option>
                      <option value="itf14">ITF-14</option>
                    </select>
                  </label>
                  <label className="tpl-inspector__field tpl-inspector__field--half">
                    <span className="tpl-inspector__label">显示文本</span>
                    <input
                      type="checkbox"
                      checked={el.barcodeStyle.showHumanReadable ?? true}
                      onChange={(e) => handleUpdateElement({ barcodeStyle: { ...el.barcodeStyle, showHumanReadable: e.target.checked } } as Partial<TemplateElement>)}
                      style={{ width: 'auto', accentColor: 'var(--accent)' }}
                    />
                  </label>
                </div>
              </>
            );
          })()}

          {/* ── qrcode: 绑定 ── */}
          {selectedElement.type === 'qrcode' && (() => {
            const el = selectedElement;
            const previewValue = previewRecord && el.binding.fieldKey
              ? previewRecord.fields[el.binding.fieldKey]
              : undefined;
            return (
              <>
                <div className="tpl-inspector__binding">
                  <span className="tpl-inspector__label">字段绑定</span>
                  <select
                    className="tpl-inspector__input"
                    value={el.binding.fieldKey || ''}
                    onChange={(e) => handleUpdateElement({ binding: { ...el.binding, fieldKey: e.target.value || undefined } } as Partial<TemplateElement>)}
                  >
                    <option value="">-- 选择字段 --</option>
                    {fieldKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                {previewRecord && el.binding.fieldKey && (
                  <div className="tpl-inspector__preview-value">
                    <span className="tpl-inspector__label">预览值</span>
                    <span className={`tpl-inspector__preview-text ${previewValue === undefined ? 'tpl-inspector__preview-text--missing' : ''}`}>
                      {previewValue !== undefined ? previewValue : '⚠ 字段缺失'}
                    </span>
                  </div>
                )}
              </>
            );
          })()}

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
