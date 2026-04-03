/**
 * 模板设计画布 — 显示当前模板的元素布局，支持添加/选中/拖动元素
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
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

function elementLabel(el: TemplateElement, previewFields?: Record<string, string>): string {
  // 预览模式下，变量类型显示解析后的值
  if (previewFields && 'binding' in el && el.binding?.fieldKey) {
    const val = previewFields[el.binding.fieldKey];
    if (val) return val.slice(0, 20);
    return `⚠ ${el.binding.fieldKey}`;
  }
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

interface DragState {
  elementId: string;
  startX: number;
  startY: number;
  origXMm: number;
  origYMm: number;
}

export const TemplateCanvas: React.FC = () => {
  const currentTemplateId = useAppStore((s) => s.currentTemplateId);
  const templates = useAppStore((s) => s.templates);
  const selectedElementIds = useAppStore((s) => s.selectedElementIds);
  const selectElements = useAppStore((s) => s.selectElements);
  const addElement = useAppStore((s) => s.addElement);
  const updateElement = useAppStore((s) => s.updateElement);
  const dataRecords = useAppStore((s) => s.dataRecords);
  const previewRecordId = useAppStore((s) => s.previewRecordId);
  const setPreviewRecordId = useAppStore((s) => s.setPreviewRecordId);

  const tpl = templates.find((t) => t.id === currentTemplateId);
  const previewRecord = dataRecords.find((r) => r.id === previewRecordId);
  const previewIdx = previewRecordId ? dataRecords.findIndex((r) => r.id === previewRecordId) : -1;

  const canvasW = (tpl?.widthMm ?? 100) * PX_PER_MM;
  const canvasH = (tpl?.heightMm ?? 60) * PX_PER_MM;

  const [dragState, setDragState] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleAddElement = useCallback(
    (type: TemplateElement['type']) => {
      if (!currentTemplateId || !tpl) return;
      // 新元素自动错位，避免完全重叠
      const offset = (tpl.elements.length % 10) * 8;
      const base = {
        id: newElementId(),
        xMm: 5 + offset,
        yMm: 5 + offset,
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

  // ── 拖动逻辑 ──
  const handleMouseDown = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (!currentTemplateId || !tpl) return;
      const el = tpl.elements.find((x) => x.id === id);
      if (!el || el.locked) return;
      e.stopPropagation();
      e.preventDefault();
      // 选中
      if (!selectedElementIds.includes(id)) {
        selectElements([id]);
      }
      setDragState({
        elementId: id,
        startX: e.clientX,
        startY: e.clientY,
        origXMm: el.xMm,
        origYMm: el.yMm,
      });
    },
    [currentTemplateId, tpl, selectedElementIds, selectElements],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !currentTemplateId) return;
      const dx = (e.clientX - dragState.startX) / PX_PER_MM;
      const dy = (e.clientY - dragState.startY) / PX_PER_MM;
      const newX = Math.round((dragState.origXMm + dx) * 2) / 2; // snap to 0.5mm
      const newY = Math.round((dragState.origYMm + dy) * 2) / 2;
      updateElement(currentTemplateId, dragState.elementId, { xMm: newX, yMm: newY });
    },
    [dragState, currentTemplateId, updateElement],
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  if (!tpl) {
    return (
      <div className="tpl-canvas tpl-canvas--empty">
        <p>选择或创建模板以开始设计</p>
      </div>
    );
  }

  return (
    <div className="tpl-canvas">
      {/* 预览记录选择器 */}
      {dataRecords.length > 0 && (
        <div className="tpl-canvas__preview-bar">
          <span className="tpl-canvas__preview-label">预览记录：</span>
          <button
            type="button"
            className="tpl-canvas__preview-btn"
            disabled={previewIdx <= 0}
            onClick={() => setPreviewRecordId(dataRecords[Math.max(0, previewIdx - 1)].id)}
          >
            ◀
          </button>
          <span className="tpl-canvas__preview-idx">
            {previewRecord
              ? `${previewIdx + 1} / ${dataRecords.length}`
              : '未选择'}
          </span>
          <button
            type="button"
            className="tpl-canvas__preview-btn"
            disabled={previewIdx >= dataRecords.length - 1}
            onClick={() => setPreviewRecordId(dataRecords[Math.min(dataRecords.length - 1, previewIdx + 1)].id)}
          >
            ▶
          </button>
          {previewRecord && (
            <span className="tpl-canvas__preview-name">
              {previewRecord.fields['内部单号'] || previewRecord.fields['name'] || `行 ${previewRecord.sourceRowIndex + 1}`}
            </span>
          )}
          {previewRecordId && (
            <button
              type="button"
              className="tpl-canvas__preview-btn tpl-canvas__preview-btn--clear"
              onClick={() => setPreviewRecordId(null)}
            >
              清除
            </button>
          )}
        </div>
      )}

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
        <div className="tpl-canvas__viewport-inner">
          <svg
            ref={svgRef}
            className="tpl-canvas__svg"
            width={canvasW + CANVAS_PADDING * 2}
            height={canvasH + CANVAS_PADDING * 2}
            onClick={handleClickCanvas}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: dragState ? 'grabbing' : undefined }}
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
                  <g
                    key={el.id}
                    onClick={(e) => handleClickElement(el.id, e)}
                    onMouseDown={(e) => handleMouseDown(el.id, e)}
                    style={{ cursor: el.locked ? 'not-allowed' : 'grab' }}
                  >
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
                      {elementLabel(el, previewRecord?.fields)}
                    </text>
                    {/* 选中手柄 */}
                    {selected && !el.locked && (
                      <>
                        <rect x={x - 3} y={y - 3} width={6} height={6} fill="var(--accent, #3b82f6)" />
                        <rect x={x + w - 3} y={y - 3} width={6} height={6} fill="var(--accent, #3b82f6)" />
                        <rect x={x - 3} y={y + h - 3} width={6} height={6} fill="var(--accent, #3b82f6)" />
                        <rect x={x + w - 3} y={y + h - 3} width={6} height={6} fill="var(--accent, #3b82f6)" />
                      </>
                    )}
                  </g>
                );
              })}
          </svg>
        </div>
      </div>

      {/* 模板信息 */}
      <div className="tpl-canvas__info">
        {tpl.name} — {tpl.widthMm} x {tpl.heightMm} mm — {tpl.elements.length} 元素
      </div>
    </div>
  );
};
