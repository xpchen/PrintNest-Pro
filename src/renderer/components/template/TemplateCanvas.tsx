/**
 * 模板设计画布 — 基于统一渲染协议 resolveTemplateDrawables 显示真实内容
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { TemplateElement } from '../../../shared/types';
import { resolveTemplateDrawables } from '../../../shared/template/resolveDrawables';
import type { ResolvedDrawable } from '../../../shared/types/template-render';
import { useAssetMap } from '../../hooks/useAssetMap';
import { ContextMenu, type ContextMenuItem } from '../ContextMenu';
import { renderBarcodeSvg, renderQrCodeSvg } from '../../../shared/template/barcodeRenderer';

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

interface ResizeState {
  elementId: string;
  handle: 'tl' | 'tr' | 'bl' | 'br';
  startX: number;
  startY: number;
  origXMm: number;
  origYMm: number;
  origWMm: number;
  origHMm: number;
}

interface AlignGuide {
  axis: 'x' | 'y';
  pos: number; // mm
}

const MIN_SIZE_MM = 2;
const SNAP_THRESHOLD_MM = 1;

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

/** 异步条码 SVG 渲染组件 */
function AsyncBarcodeSvg({ d, x, y, w, h }: { d: Extract<ResolvedDrawable, { type: 'barcode' }>; x: number; y: number; w: number; h: number }) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const keyRef = useRef('');
  const key = `${d.value}|${d.format}|${w}|${h}`;

  useEffect(() => {
    if (key === keyRef.current) return;
    keyRef.current = key;
    if (!d.value || d.source === 'missing') { setSvgContent(null); return; }
    void renderBarcodeSvg(d.value, d.format, {
      width: w, height: h,
      showHumanReadable: d.showHumanReadable,
    }).then((svg) => { if (keyRef.current === key) setSvgContent(svg); });
  }, [key, d.value, d.format, d.showHumanReadable, d.source, w, h]);

  if (!svgContent || d.source === 'missing') {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#45B7D122" stroke="#45B7D1" strokeWidth={1} />
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={8} fill={d.source === 'missing' ? '#e53e3e' : '#45B7D1'} pointerEvents="none">
          {d.source === 'missing' ? `⚠ {${d.value}}` : '...'}
        </text>
      </g>
    );
  }

  // 使用 foreignObject 嵌入 SVG
  return (
    <foreignObject x={x} y={y} width={w} height={h}>
      <div
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </foreignObject>
  );
}

/** 异步二维码 SVG 渲染组件 */
function AsyncQrCodeSvg({ d, x, y, w, h }: { d: Extract<ResolvedDrawable, { type: 'qrcode' }>; x: number; y: number; w: number; h: number }) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const keyRef = useRef('');
  const key = `${d.value}|${w}|${h}`;

  useEffect(() => {
    if (key === keyRef.current) return;
    keyRef.current = key;
    if (!d.value || d.source === 'missing') { setSvgContent(null); return; }
    void renderQrCodeSvg(d.value, { width: w, height: h })
      .then((svg) => { if (keyRef.current === key) setSvgContent(svg); });
  }, [key, d.value, d.source, w, h]);

  if (!svgContent || d.source === 'missing') {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#96CEB422" stroke="#96CEB4" strokeWidth={1} />
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={8} fill={d.source === 'missing' ? '#e53e3e' : '#96CEB4'} pointerEvents="none">
          {d.source === 'missing' ? `⚠ QR` : '...'}
        </text>
      </g>
    );
  }

  return (
    <foreignObject x={x} y={y} width={w} height={h}>
      <div
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </foreignObject>
  );
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
      return <AsyncBarcodeSvg d={d} x={x} y={y} w={w} h={h} />;
    }

    case 'qrcode': {
      return <AsyncQrCodeSvg d={d} x={x} y={y} w={w} h={h} />;
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
  const assetMap = useAssetMap();
  const selectedElementIds = useAppStore((s) => s.selectedElementIds);
  const selectElements = useAppStore((s) => s.selectElements);
  const addElement = useAppStore((s) => s.addElement);
  const updateElement = useAppStore((s) => s.updateElement);
  const removeElement = useAppStore((s) => s.removeElement);
  const copySelectedElements = useAppStore((s) => s.copySelectedElements);
  const pasteElements = useAppStore((s) => s.pasteElements);
  const dataRecords = useAppStore((s) => s.dataRecords);
  const previewRecordId = useAppStore((s) => s.previewRecordId);
  const setPreviewRecordId = useAppStore((s) => s.setPreviewRecordId);

  const tpl = templates.find((t) => t.id === currentTemplateId);
  const previewRecord = dataRecords.find((r) => r.id === previewRecordId);
  const previewIdx = previewRecordId ? dataRecords.findIndex((r) => r.id === previewRecordId) : -1;

  const canvasW = (tpl?.widthMm ?? 100) * PX_PER_MM;
  const canvasH = (tpl?.heightMm ?? 60) * PX_PER_MM;

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; elementId?: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 统一渲染协议：从模板 + 预览记录 → drawables
  const drawables = useMemo(() => {
    if (!tpl) return [];
    return resolveTemplateDrawables({
      template: tpl,
      record: previewRecord,
      assetMap,
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
      // 生成人类可读的默认名称：类型名 + 序号
      const TYPE_NAME: Record<TemplateElement['type'], string> = {
        fixedText: '固定文本',
        variableText: '变量文本',
        fixedImage: '固定图片',
        variableImage: '变量图片',
        barcode: '条码',
        qrcode: '二维码',
        mark: '标记',
      };
      const existingCount = tpl.elements.filter((e) => e.type === type).length;
      const defaultName = `${TYPE_NAME[type]} ${existingCount + 1}`;
      const base = {
        id: newElementId(),
        name: defaultName,
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

  /** 检测元素与其他元素的对齐线 */
  const detectAlignGuides = useCallback(
    (activeId: string, xMm: number, yMm: number, wMm: number, hMm: number): AlignGuide[] => {
      if (!tpl) return [];
      const guides: AlignGuide[] = [];
      const edges = {
        left: xMm,
        centerX: xMm + wMm / 2,
        right: xMm + wMm,
        top: yMm,
        centerY: yMm + hMm / 2,
        bottom: yMm + hMm,
      };

      for (const el of tpl.elements) {
        if (el.id === activeId || el.hidden) continue;
        const otherEdges = {
          left: el.xMm,
          centerX: el.xMm + el.widthMm / 2,
          right: el.xMm + el.widthMm,
          top: el.yMm,
          centerY: el.yMm + el.heightMm / 2,
          bottom: el.yMm + el.heightMm,
        };

        for (const ax of [edges.left, edges.centerX, edges.right]) {
          for (const ox of [otherEdges.left, otherEdges.centerX, otherEdges.right]) {
            if (Math.abs(ax - ox) < SNAP_THRESHOLD_MM) {
              guides.push({ axis: 'x', pos: ox });
            }
          }
        }
        for (const ay of [edges.top, edges.centerY, edges.bottom]) {
          for (const oy of [otherEdges.top, otherEdges.centerY, otherEdges.bottom]) {
            if (Math.abs(ay - oy) < SNAP_THRESHOLD_MM) {
              guides.push({ axis: 'y', pos: oy });
            }
          }
        }
      }

      const seen = new Set<string>();
      return guides.filter((g) => {
        const key = `${g.axis}:${g.pos}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    [tpl],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!currentTemplateId) return;

      if (resizeState) {
        const dx = (e.clientX - resizeState.startX) / PX_PER_MM;
        const dy = (e.clientY - resizeState.startY) / PX_PER_MM;

        let newX = resizeState.origXMm;
        let newY = resizeState.origYMm;
        let newW = resizeState.origWMm;
        let newH = resizeState.origHMm;

        switch (resizeState.handle) {
          case 'br':
            newW = Math.max(MIN_SIZE_MM, Math.round((resizeState.origWMm + dx) * 2) / 2);
            newH = Math.max(MIN_SIZE_MM, Math.round((resizeState.origHMm + dy) * 2) / 2);
            break;
          case 'bl':
            newW = Math.max(MIN_SIZE_MM, Math.round((resizeState.origWMm - dx) * 2) / 2);
            newH = Math.max(MIN_SIZE_MM, Math.round((resizeState.origHMm + dy) * 2) / 2);
            newX = resizeState.origXMm + resizeState.origWMm - newW;
            break;
          case 'tr':
            newW = Math.max(MIN_SIZE_MM, Math.round((resizeState.origWMm + dx) * 2) / 2);
            newH = Math.max(MIN_SIZE_MM, Math.round((resizeState.origHMm - dy) * 2) / 2);
            newY = resizeState.origYMm + resizeState.origHMm - newH;
            break;
          case 'tl':
            newW = Math.max(MIN_SIZE_MM, Math.round((resizeState.origWMm - dx) * 2) / 2);
            newH = Math.max(MIN_SIZE_MM, Math.round((resizeState.origHMm - dy) * 2) / 2);
            newX = resizeState.origXMm + resizeState.origWMm - newW;
            newY = resizeState.origYMm + resizeState.origHMm - newH;
            break;
        }

        updateElement(currentTemplateId, resizeState.elementId, {
          xMm: newX,
          yMm: newY,
          widthMm: newW,
          heightMm: newH,
        });
        setAlignGuides(detectAlignGuides(resizeState.elementId, newX, newY, newW, newH));
        return;
      }

      if (dragState) {
        const dx = (e.clientX - dragState.startX) / PX_PER_MM;
        const dy = (e.clientY - dragState.startY) / PX_PER_MM;
        const newX = Math.round((dragState.origXMm + dx) * 2) / 2;
        const newY = Math.round((dragState.origYMm + dy) * 2) / 2;
        updateElement(currentTemplateId, dragState.elementId, { xMm: newX, yMm: newY });

        // 检测对齐辅助线
        const el = tpl?.elements.find((x) => x.id === dragState.elementId);
        if (el) {
          setAlignGuides(detectAlignGuides(dragState.elementId, newX, newY, el.widthMm, el.heightMm));
        }
      }
    },
    [dragState, resizeState, currentTemplateId, tpl, updateElement, detectAlignGuides],
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setResizeState(null);
    setAlignGuides([]);
  }, []);

  /** Resize 手柄 mousedown */
  const handleResizeDown = useCallback(
    (elementId: string, handle: ResizeState['handle'], e: React.MouseEvent) => {
      if (!currentTemplateId || !tpl) return;
      const el = tpl.elements.find((x) => x.id === elementId);
      if (!el || el.locked) return;
      e.stopPropagation();
      e.preventDefault();
      setResizeState({
        elementId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origXMm: el.xMm,
        origYMm: el.yMm,
        origWMm: el.widthMm,
        origHMm: el.heightMm,
      });
    },
    [currentTemplateId, tpl],
  );

  /** 右键菜单 */
  const handleContextMenu = useCallback(
    (elementId: string | undefined, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (elementId && !selectedElementIds.includes(elementId)) {
        selectElements([elementId]);
      }
      setCtxMenu({ x: e.clientX, y: e.clientY, elementId });
    },
    [selectedElementIds, selectElements],
  );

  const ctxMenuItems = useMemo((): ContextMenuItem[] => {
    const hasSelection = selectedElementIds.length > 0;
    const el = ctxMenu?.elementId ? tpl?.elements.find((e) => e.id === ctxMenu.elementId) : null;
    return [
      { id: 'copy', label: '复制', shortcut: '⌘C', disabled: !hasSelection },
      { id: 'paste', label: '粘贴', shortcut: '⌘V' },
      { id: 'sep1', label: '', separator: true },
      { id: 'lock', label: el?.locked ? '解锁' : '锁定', disabled: !hasSelection },
      { id: 'hide', label: el?.hidden ? '显示' : '隐藏', disabled: !hasSelection },
      { id: 'sep2', label: '', separator: true },
      { id: 'delete', label: '删除', shortcut: 'Del', disabled: !hasSelection, danger: true },
    ];
  }, [selectedElementIds, ctxMenu, tpl]);

  const handleCtxMenuSelect = useCallback(
    (id: string) => {
      if (!currentTemplateId) return;
      switch (id) {
        case 'copy':
          copySelectedElements();
          break;
        case 'paste':
          pasteElements();
          break;
        case 'lock':
          for (const elId of selectedElementIds) {
            const el = tpl?.elements.find((e) => e.id === elId);
            if (el) updateElement(currentTemplateId, elId, { locked: !el.locked });
          }
          break;
        case 'hide':
          for (const elId of selectedElementIds) {
            const el = tpl?.elements.find((e) => e.id === elId);
            if (el) updateElement(currentTemplateId, elId, { hidden: !el.hidden });
          }
          break;
        case 'delete':
          for (const elId of [...selectedElementIds]) {
            removeElement(currentTemplateId, elId);
          }
          break;
      }
    },
    [currentTemplateId, selectedElementIds, tpl, updateElement, removeElement, copySelectedElements, pasteElements],
  );

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
            onContextMenu={(e) => handleContextMenu(undefined, e)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: resizeState ? 'nwse-resize' : dragState ? 'grabbing' : undefined }}
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
                    onContextMenu={(e) => handleContextMenu(d.elementId, e)}
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

                    {/* 选中手柄（可 resize） */}
                    {selected && !d.locked && (
                      <>
                        {([
                          { handle: 'tl' as const, hx: x - 4, hy: y - 4, cursor: 'nwse-resize' },
                          { handle: 'tr' as const, hx: x + w - 4, hy: y - 4, cursor: 'nesw-resize' },
                          { handle: 'bl' as const, hx: x - 4, hy: y + h - 4, cursor: 'nesw-resize' },
                          { handle: 'br' as const, hx: x + w - 4, hy: y + h - 4, cursor: 'nwse-resize' },
                        ]).map(({ handle, hx, hy, cursor }) => (
                          <rect
                            key={handle}
                            x={hx}
                            y={hy}
                            width={8}
                            height={8}
                            fill="var(--accent, #3b82f6)"
                            style={{ cursor }}
                            onMouseDown={(e) => handleResizeDown(d.elementId, handle, e)}
                          />
                        ))}
                      </>
                    )}
                  </g>
                );
              })}

            {/* 对齐辅助线 */}
            {alignGuides.map((g, i) =>
              g.axis === 'x' ? (
                <line
                  key={`ag-${i}`}
                  x1={CANVAS_PADDING + g.pos * PX_PER_MM}
                  y1={0}
                  x2={CANVAS_PADDING + g.pos * PX_PER_MM}
                  y2={canvasH + CANVAS_PADDING * 2}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="3,3"
                  pointerEvents="none"
                />
              ) : (
                <line
                  key={`ag-${i}`}
                  x1={0}
                  y1={CANVAS_PADDING + g.pos * PX_PER_MM}
                  x2={canvasW + CANVAS_PADDING * 2}
                  y2={CANVAS_PADDING + g.pos * PX_PER_MM}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="3,3"
                  pointerEvents="none"
                />
              ),
            )}
          </svg>
        </div>
      </div>

      {/* 模板信息 */}
      <div className="tpl-canvas__info">
        {tpl.name} — {tpl.widthMm} x {tpl.heightMm} mm — {tpl.elements.length} 元素
      </div>

      {/* 右键菜单 */}
      {ctxMenu && (
        <ContextMenu
          items={ctxMenuItems}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onSelect={handleCtxMenuSelect}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
};
