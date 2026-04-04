/**
 * 模板设计画布 — 基于统一渲染协议 resolveTemplateDrawables 显示真实内容
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { TemplateElement } from '../../../shared/types';
import { resolveTemplateDrawables } from '../../../shared/template/resolveDrawables';
import type { ResolvedDrawable } from '../../../shared/types/template-render';

const CANVAS_PADDING = 20;
const PX_PER_MM = 3;

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

/** SVG 文本对齐映射 */
function svgTextAnchor(align?: 'left' | 'center' | 'right'): 'start' | 'middle' | 'end' {
  if (align === 'center') return 'middle';
  if (align === 'right') return 'end';
  return 'start';
}

/** 根据对齐计算文本 x 偏移 */
function textXOffset(align: string | undefined, w: number): number {
  if (align === 'center') return w / 2;
  if (align === 'right') return w - 3;
  return 3;
}

function DrawableRenderer({ d, px }: { d: ResolvedDrawable; px: number }) {
  const x = CANVAS_PADDING + d.x * px;
  const y = CANVAS_PADDING + d.y * px;
  const w = d.w * px;
  const h = d.h * px;

  switch (d.type) {
    case 'text': {
      const fontSize = Math.max(8, Math.min(d.style.fontSizePt * (px / 3), h * 0.8));
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="#4ECDC422" stroke="none" />
          <text
            x={x + textXOffset(d.style.align, w)}
            y={y + h / 2}
            dominantBaseline="central"
            textAnchor={svgTextAnchor(d.style.align)}
            fontSize={fontSize}
            fontWeight={d.style.fontWeight || 'normal'}
            fill={d.source === 'missing' ? '#e53e3e' : (d.style.color || 'var(--text-primary, #333)')}
            pointerEvents="none"
            clipPath={`inset(0 0 0 0)`}
          >
            {d.content.length > 30 ? d.content.slice(0, 28) + '…' : d.content}
          </text>
        </g>
      );
    }

    case 'image': {
      if (d.src) {
        return (
          <g>
            <rect x={x} y={y} width={w} height={h} fill="#FF6B6B11" stroke="none" />
            <image
              href={d.src}
              x={x + 1}
              y={y + 1}
              width={w - 2}
              height={h - 2}
              preserveAspectRatio={d.fitMode === 'fill' ? 'none' : d.fitMode === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
            />
          </g>
        );
      }
      // missing image placeholder
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="#FF6B6B22" stroke="#FF6B6B" strokeWidth={1} strokeDasharray="4,2" />
          <text x={x + w / 2} y={y + h / 2} dominantBaseline="central" textAnchor="middle" fontSize={10} fill="#FF6B6B" pointerEvents="none">
            {d.source === 'missing' ? '⚠ 无图片' : 'Image'}
          </text>
        </g>
      );
    }

    case 'barcode': {
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="#45B7D122" stroke="#45B7D1" strokeWidth={1} />
          {/* 条码竖线占位 */}
          {Array.from({ length: Math.min(12, Math.floor(w / 4)) }, (_, i) => (
            <rect
              key={i}
              x={x + 4 + i * (w - 8) / 12}
              y={y + 3}
              width={Math.max(1, (w - 8) / 24)}
              height={d.showHumanReadable ? h - 14 : h - 6}
              fill="#45B7D1"
            />
          ))}
          {d.showHumanReadable && (
            <text x={x + w / 2} y={y + h - 3} textAnchor="middle" fontSize={8} fill={d.source === 'missing' ? '#e53e3e' : '#45B7D1'} pointerEvents="none">
              {d.value.length > 16 ? d.value.slice(0, 14) + '…' : d.value}
            </text>
          )}
        </g>
      );
    }

    case 'qrcode': {
      const cellSize = Math.min(w, h) / 8;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="#96CEB422" stroke="#96CEB4" strokeWidth={1} />
          {/* QR 占位图案 */}
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={x + 3 + c * cellSize}
                y={y + 3 + r * cellSize}
                width={cellSize * 0.8}
                height={cellSize * 0.8}
                fill="#96CEB4"
              />
            )),
          )}
          <text x={x + w / 2} y={y + h - 4} textAnchor="middle" fontSize={7} fill={d.source === 'missing' ? '#e53e3e' : '#96CEB4'} pointerEvents="none">
            QR
          </text>
        </g>
      );
    }

    case 'rect': {
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={d.fill || 'none'}
          stroke={d.stroke || '#DDA0DD'}
          strokeWidth={(d.strokeWidth ?? 0.25) * px}
        />
      );
    }
  }
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

  // 统一渲染协议：从模板 + 预览记录 → drawables
  const drawables = useMemo(() => {
    if (!tpl) return [];
    return resolveTemplateDrawables({
      template: tpl,
      record: previewRecord,
      assetMap: new Map(), // TODO: 接入资产管线后填充
      previewContext: { mode: previewRecord ? 'preview' : 'design' },
    });
  }, [tpl, previewRecord]);

  // elementId → drawable 查找（选中高亮用）
  const drawableMap = useMemo(() => {
    const m = new Map<string, ResolvedDrawable>();
    for (const d of drawables) m.set(d.elementId, d);
    return m;
  }, [drawables]);

  const handleAddElement = useCallback(
    (type: TemplateElement['type']) => {
      if (!currentTemplateId || !tpl) return;
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
          el = { ...base, type: 'variableText', binding: { mode: 'field' }, style: { fontSizePt: 12 } };
          break;
        case 'fixedImage':
          el = { ...base, type: 'fixedImage', assetId: '', widthMm: 25, heightMm: 25 };
          break;
        case 'variableImage':
          el = { ...base, type: 'variableImage', binding: { mode: 'field' }, widthMm: 25, heightMm: 25 };
          break;
        case 'barcode':
          el = { ...base, type: 'barcode', binding: { mode: 'field' }, widthMm: 40, heightMm: 15, barcodeStyle: { format: 'code128' } };
          break;
        case 'qrcode':
          el = { ...base, type: 'qrcode', binding: { mode: 'field' }, widthMm: 20, heightMm: 20 };
          break;
        case 'mark':
          el = { ...base, type: 'mark', markKind: 'crosshair', widthMm: 5, heightMm: 5 };
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

  const handleMouseDown = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (!currentTemplateId || !tpl) return;
      const el = tpl.elements.find((x) => x.id === id);
      if (!el || el.locked) return;
      e.stopPropagation();
      e.preventDefault();
      if (!selectedElementIds.includes(id)) {
        selectElements([id]);
      }
      setDragState({ elementId: id, startX: e.clientX, startY: e.clientY, origXMm: el.xMm, origYMm: el.yMm });
    },
    [currentTemplateId, tpl, selectedElementIds, selectElements],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !currentTemplateId) return;
      const dx = (e.clientX - dragState.startX) / PX_PER_MM;
      const dy = (e.clientY - dragState.startY) / PX_PER_MM;
      const newX = Math.round((dragState.origXMm + dx) * 2) / 2;
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
            {previewRecord ? `${previewIdx + 1} / ${dataRecords.length}` : '未选择'}
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

            {/* 元素渲染：基于统一协议层 */}
            {drawables
              .filter((d) => !d.hidden)
              .map((d) => {
                const selected = selectedElementIds.includes(d.elementId);
                const x = CANVAS_PADDING + d.x * PX_PER_MM;
                const y = CANVAS_PADDING + d.y * PX_PER_MM;
                const w = d.w * PX_PER_MM;
                const h = d.h * PX_PER_MM;

                return (
                  <g
                    key={d.elementId}
                    onClick={(e) => handleClickElement(d.elementId, e)}
                    onMouseDown={(e) => handleMouseDown(d.elementId, e)}
                    style={{ cursor: d.locked ? 'not-allowed' : 'grab' }}
                  >
                    {/* 真实内容渲染 */}
                    <DrawableRenderer d={d} px={PX_PER_MM} />

                    {/* 选中边框 */}
                    {selected && (
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill="none"
                        stroke="var(--accent, #3b82f6)"
                        strokeWidth={2}
                        strokeDasharray={d.locked ? '4,2' : undefined}
                      />
                    )}

                    {/* 选中手柄 */}
                    {selected && !d.locked && (
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
