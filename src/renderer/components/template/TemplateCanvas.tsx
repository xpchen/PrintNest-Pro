/**
 * 模板设计画布 — 显示当前模板的元素布局，支持添加元素
 */
import React, { useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { TemplateElement, FixedTextElement, FixedImageElement } from '../../../shared/types';

const CANVAS_PADDING = 20;
const PX_PER_MM = 3; // 画布缩放因子

function elementColor(type: TemplateElement['type']): string {
  switch (type) {
    case 'fixedText':
    case 'variableText':
      return '#4ECDC4';
    case 'fixedImage':
    case 'variableImage':
      return '#FF6B6B';
    case 'barcode':
      return '#45B7D1';
    case 'qrcode':
      return '#96CEB4';
    case 'mark':
      return '#DDA0DD';
  }
}

function elementLabel(el: TemplateElement): string {
  if (el.name) return el.name;
  switch (el.type) {
    case 'fixedText':
      return (el as FixedTextElement).fixedValue?.slice(0, 12) || 'Text';
    case 'variableText':
      return `{${el.binding.fieldKey || '?'}}`;
    case 'fixedImage':
      return 'Image';
    case 'variableImage':
      return `Img:{${el.binding.fieldKey || '?'}}`;
    case 'barcode':
      return `BC:{${el.binding.fieldKey || '?'}}`;
    case 'qrcode':
      return `QR:{${el.binding.fieldKey || '?'}}`;
    case 'mark':
      return el.markKind;
  }
}

function newElementId(): string {
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const TemplateCanvas: React.FC = () => {
  const currentTemplateId = useAppStore((s) => s.currentTemplateId);
  const templates = useAppStore((s) => s.templates);
  const selectedElementIds = useAppStore((s) => s.selectedElementIds);
  const selectElements = useAppStore((s) => s.selectElements);
  const addElement = useAppStore((s) => s.addElement);

  const tpl = templates.find((t) => t.id === currentTemplateId);

  const canvasW = (tpl?.widthMm ?? 100) * PX_PER_MM;
  const canvasH = (tpl?.heightMm ?? 60) * PX_PER_MM;

  const handleAddElement = useCallback(
    (type: TemplateElement['type']) => {
      if (!currentTemplateId || !tpl) return;
      const base = {
        id: newElementId(),
        xMm: 5,
        yMm: 5,
        widthMm: 30,
        heightMm: 12,
        zIndex: tpl.elements.length,
      };
      let el: TemplateElement;
      switch (type) {
        case 'fixedText':
          el = { ...base, type: 'fixedText', fixedValue: '示例文本', style: { fontSizePt: 12 } };
          break;
        case 'variableText':
          el = {
            ...base,
            type: 'variableText',
            binding: { mode: 'field' },
            style: { fontSizePt: 12 },
          };
          break;
        case 'fixedImage':
          el = { ...base, type: 'fixedImage', fixedValue: '', widthMm: 25, heightMm: 25 };
          break;
        case 'variableImage':
          el = {
            ...base,
            type: 'variableImage',
            binding: { mode: 'field' },
            widthMm: 25,
            heightMm: 25,
          };
          break;
        case 'barcode':
          el = {
            ...base,
            type: 'barcode',
            binding: { mode: 'field' },
            widthMm: 40,
            heightMm: 15,
            barcodeStyle: { format: 'code128' },
          };
          break;
        case 'qrcode':
          el = {
            ...base,
            type: 'qrcode',
            binding: { mode: 'field' },
            widthMm: 20,
            heightMm: 20,
          };
          break;
        case 'mark':
          el = {
            ...base,
            type: 'mark',
            markKind: 'crosshair',
            widthMm: 5,
            heightMm: 5,
          };
          break;
        default:
          return;
      }
      addElement(currentTemplateId, el);
    },
    [currentTemplateId, tpl, addElement],
  );

  const handleClickElement = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.metaKey || e.ctrlKey) {
        const next = selectedElementIds.includes(id)
          ? selectedElementIds.filter((x) => x !== id)
          : [...selectedElementIds, id];
        selectElements(next);
      } else {
        selectElements([id]);
      }
    },
    [selectedElementIds, selectElements],
  );

  const handleClickCanvas = useCallback(() => {
    selectElements([]);
  }, [selectElements]);

  if (!tpl) {
    return (
      <div className="tpl-canvas tpl-canvas--empty">
        <p>选择或创建模板以开始设计</p>
      </div>
    );
  }

  return (
    <div className="tpl-canvas">
      {/* 工具栏 */}
      <div className="tpl-canvas__toolbar">
        <span className="tpl-canvas__toolbar-label">添加：</span>
        {(
          [
            ['fixedText', '文本'],
            ['variableText', '变量文本'],
            ['fixedImage', '图片'],
            ['variableImage', '变量图片'],
            ['barcode', '条码'],
            ['qrcode', 'QR'],
            ['mark', '标记'],
          ] as [TemplateElement['type'], string][]
        ).map(([type, label]) => (
          <button
            key={type}
            type="button"
            className="tpl-canvas__tool-btn"
            onClick={() => handleAddElement(type)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 画布区域 */}
      <div className="tpl-canvas__viewport">
        <svg
          className="tpl-canvas__svg"
          width={canvasW + CANVAS_PADDING * 2}
          height={canvasH + CANVAS_PADDING * 2}
          onClick={handleClickCanvas}
        >
          {/* 模板背景 */}
          <rect
            x={CANVAS_PADDING}
            y={CANVAS_PADDING}
            width={canvasW}
            height={canvasH}
            fill="var(--surface-canvas, #fff)"
            stroke="var(--border)"
            strokeWidth={1}
          />

          {/* 元素 */}
          {tpl.elements
            .filter((el) => !el.hidden)
            .map((el) => {
              const x = CANVAS_PADDING + el.xMm * PX_PER_MM;
              const y = CANVAS_PADDING + el.yMm * PX_PER_MM;
              const w = el.widthMm * PX_PER_MM;
              const h = el.heightMm * PX_PER_MM;
              const selected = selectedElementIds.includes(el.id);
              const color = elementColor(el.type);

              return (
                <g key={el.id} onClick={(e) => handleClickElement(el.id, e)} style={{ cursor: 'pointer' }}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={`${color}22`}
                    stroke={selected ? 'var(--accent, #3b82f6)' : color}
                    strokeWidth={selected ? 2 : 1}
                    strokeDasharray={el.locked ? '4,2' : undefined}
                  />
                  <text
                    x={x + 3}
                    y={y + 12}
                    fontSize={10}
                    fill="var(--text-primary, #333)"
                    pointerEvents="none"
                  >
                    {elementLabel(el)}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>

      {/* 模板信息 */}
      <div className="tpl-canvas__info">
        {tpl.name} — {tpl.widthMm} x {tpl.heightMm} mm — {tpl.elements.length} 元素
      </div>
    </div>
  );
};
