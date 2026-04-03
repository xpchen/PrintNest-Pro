/**
 * 中央画布区域
 * 使用 HTML5 Canvas 渲染排版结果
 * 支持缩放、平移、选中、拖拽、框选、图片渲染
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Placement } from '../../shared/types';
import {
  displayUnitAbbrev,
  formatLengthMm,
  formatPairMm,
  formatRulerTickMm,
  getDisplayGeometrySteps,
} from '../utils/lengthDisplay';

// ==================== Image Cache ====================
const imageCache = new Map<string, HTMLImageElement>();

const GE = 1e-3;

/** 拖拽中：检测越界与同画布碰撞（基于起始位置 + 当前位移） */
function computeDragInvalid(
  canvas: { placements: Placement[] },
  dragOrig: { id: string; x: number; y: number }[],
  dx: number,
  dy: number,
  snap: number,
  cw: number,
  ch: number,
): Set<string> {
  const bad = new Set<string>();
  const dragIdSet = new Set(dragOrig.map((o) => o.id));
  const tent = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const o of dragOrig) {
    const p = canvas.placements.find((pp) => pp.id === o.id);
    if (!p) continue;
    const x = Math.round((o.x + dx) / snap) * snap;
    const y = Math.round((o.y + dy) / snap) * snap;
    tent.set(o.id, { x, y, w: p.width, h: p.height });
  }
  for (const [id, r] of tent) {
    if (r.x < -GE || r.y < -GE || r.x + r.w > cw + GE || r.y + r.h > ch + GE) bad.add(id);
  }
  const tids = [...tent.keys()];
  for (let i = 0; i < tids.length; i++) {
    for (let j = i + 1; j < tids.length; j++) {
      const a = tent.get(tids[i])!;
      const b = tent.get(tids[j])!;
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > GE && iy > GE) {
        bad.add(tids[i]);
        bad.add(tids[j]);
      }
    }
  }
  for (const [id, r] of tent) {
    for (const p of canvas.placements) {
      if (dragIdSet.has(p.id)) continue;
      const ix = Math.min(r.x + r.w, p.x + p.width) - Math.max(r.x, p.x);
      const iy = Math.min(r.y + r.h, p.y + p.height) - Math.max(r.y, p.y);
      if (ix > GE && iy > GE) bad.add(id);
    }
  }
  return bad;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (imageCache.has(src)) { resolve(imageCache.get(src)!); return; }
    const img = new Image();
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

export const CanvasArea: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    result, config, items, activeCanvasIndex, selectedIds, zoom, displayUnit,
    showGrid, showRuler, showSafeMargin,
    setSelectedIds, toggleLock, updatePlacement, deleteSelected,
    panOffset, setPanOffset,
  } = useAppStore();

  const [invalidDragTick, setInvalidDragTick] = useState(0);
  const dragInvalidRef = useRef<Set<string>>(new Set());

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOrigRef = useRef<{ id: string; x: number; y: number }[]>([]);

  // Box selection state
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const boxStartRef = useRef({ x: 0, y: 0 });
  const [boxEnd, setBoxEnd] = useState({ x: 0, y: 0 });

  // File drag-drop
  const [showDrop, setShowDrop] = useState(false);

  // Image load counter - incremented when images finish loading to trigger redraw
  const [imgLoadCount, setImgLoadCount] = useState(0);

  const currentCanvas = result?.canvases[activeCanvasIndex];
  const canvasW = config.canvas.width;
  const canvasH = config.canvas.height;
  const edgeSafe = config.edgeSafeMm ?? 0;

  const validationIssueIds = React.useMemo(() => {
    const s = new Set<string>();
    if (!result?.validation) return s;
    for (const i of result.validation.issues) {
      if (i.kind === 'overlap' || i.kind === 'out_of_bounds' || i.kind === 'spacing_violation') {
        i.placementIds?.forEach((id) => s.add(id));
      }
      if (i.kind === 'safe_edge') i.placementIds?.forEach((id) => s.add(id));
    }
    return s;
  }, [result?.validation]);

  /** Get item by printItemId */
  const getItem = useCallback(
    (printItemId: string) => items.find((i) => i.id === printItemId),
    [items]
  );

  /** Preload all images for current canvas, trigger redraw when done */
  useEffect(() => {
    if (!currentCanvas) return;
    const srcs = new Set<string>();
    currentCanvas.placements.forEach((p) => {
      const item = getItem(p.printItemId);
      if (item?.imageSrc && !imageCache.has(item.imageSrc)) srcs.add(item.imageSrc);
    });
    if (srcs.size === 0) return;
    let loaded = 0;
    srcs.forEach((src) => {
      loadImage(src)
        .then(() => { if (++loaded === srcs.size) setImgLoadCount((c) => c + 1); })
        .catch(() => { if (++loaded === srcs.size) setImgLoadCount((c) => c + 1); });
    });
  }, [currentCanvas, getItem]);

  /** Also preload images when items change (before layout) */
  useEffect(() => {
    const srcs = items.filter((i) => i.imageSrc && !imageCache.has(i.imageSrc)).map((i) => i.imageSrc);
    if (srcs.length === 0) return;
    let loaded = 0;
    srcs.forEach((src) => {
      loadImage(src)
        .then(() => { if (++loaded === srcs.length) setImgLoadCount((c) => c + 1); })
        .catch(() => { if (++loaded === srcs.length) setImgLoadCount((c) => c + 1); });
    });
  }, [items]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      useAppStore.getState().setViewportContainerPx(w, h);
      const vm = useAppStore.getState().viewMode;
      if (vm === 'fitAll') useAppStore.getState().applyViewFitAll();
      if (vm === 'fitWidth') useAppStore.getState().applyViewFitWidth();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Draw canvas */
  const draw = useCallback(() => {
    void imgLoadCount;
    void invalidDragTick;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const t0 =
      import.meta.env.DEV && (window as unknown as { __PN_PERF__?: boolean }).__PN_PERF__
        ? performance.now()
        : 0;

    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const z = zoom;
    const ox = panOffset.x;
    const oy = panOffset.y;
    const vw = canvas.width;
    const vh = canvas.height;
    const cullMarginMm = 48;
    const viewLeft = (-ox) / z - cullMarginMm;
    const viewTop = (-oy) / z - cullMarginMm;
    const viewRight = (vw - ox) / z + cullMarginMm;
    const viewBottom = (vh - oy) / z + cullMarginMm;
    const placementVisible = (p: Placement) =>
      p.x + p.width >= viewLeft && p.x <= viewRight && p.y + p.height >= viewTop && p.y <= viewBottom;

    /** 网格/标尺仅绘制与视口相交部分，大画布时减少 stroke 次数 */
    const gridX0 = Math.max(0, viewLeft);
    const gridX1 = Math.min(canvasW, viewRight);
    const gridY0 = Math.max(0, viewTop);
    const gridY1 = Math.min(canvasH, viewBottom);
    const rulerPadMm = 80;
    const rulerX0 = Math.max(0, viewLeft - rulerPadMm);
    const rulerX1 = Math.min(canvasW, viewRight + rulerPadMm);
    const rulerY0 = Math.max(0, viewTop - rulerPadMm);
    const rulerY1 = Math.min(canvasH, viewBottom + rulerPadMm);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(z, z);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 16 / z;
    ctx.shadowOffsetX = 5 / z;
    ctx.shadowOffsetY = 5 / z;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.shadowColor = 'transparent';

    // Grid（mm：保留 10/50；其它单位按显示步长；按视口裁剪竖线/横线）
    if (showGrid && gridX0 < gridX1 && gridY0 < gridY1) {
      if (displayUnit === 'mm') {
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.35 / z;
        const xFineStart = Math.max(10, Math.ceil((gridX0 - GE) / 10) * 10);
        for (let x = xFineStart; x < gridX1 && x < canvasW; x += 10) {
          if (x % 50 === 0) continue;
          ctx.beginPath(); ctx.moveTo(x, gridY0); ctx.lineTo(x, gridY1); ctx.stroke();
        }
        const yFineStart = Math.max(10, Math.ceil((gridY0 - GE) / 10) * 10);
        for (let y = yFineStart; y < gridY1 && y < canvasH; y += 10) {
          if (y % 50 === 0) continue;
          ctx.beginPath(); ctx.moveTo(gridX0, y); ctx.lineTo(gridX1, y); ctx.stroke();
        }
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 0.55 / z;
        const xMajorStart = Math.max(50, Math.ceil((gridX0 - GE) / 50) * 50);
        for (let x = xMajorStart; x < gridX1 && x < canvasW; x += 50) {
          ctx.beginPath(); ctx.moveTo(x, gridY0); ctx.lineTo(x, gridY1); ctx.stroke();
        }
        const yMajorStart = Math.max(50, Math.ceil((gridY0 - GE) / 50) * 50);
        for (let y = yMajorStart; y < gridY1 && y < canvasH; y += 50) {
          ctx.beginPath(); ctx.moveTo(gridX0, y); ctx.lineTo(gridX1, y); ctx.stroke();
        }
      } else {
        const { minorStepMm, majorStepMm } = getDisplayGeometrySteps(displayUnit, z, canvasW, canvasH);
        const stepsPerMajor = Math.max(1, Math.round(majorStepMm / minorStepMm + 1e-9));
        const iX0 = Math.max(1, Math.ceil((gridX0 - GE) / minorStepMm));
        const iX1 = Math.min(Math.floor((gridX1 + GE) / minorStepMm), Math.ceil(canvasW / minorStepMm));
        for (let i = iX0; i <= iX1; i++) {
          const x = i * minorStepMm;
          if (x <= 0 || x >= canvasW) continue;
          const isMajor = i % stepsPerMajor === 0;
          ctx.strokeStyle = isMajor ? '#e8e8e8' : 'rgba(0,0,0,0.06)';
          ctx.lineWidth = (isMajor ? 0.55 : 0.35) / z;
          ctx.beginPath(); ctx.moveTo(x, gridY0); ctx.lineTo(x, gridY1); ctx.stroke();
        }
        const iY0 = Math.max(1, Math.ceil((gridY0 - GE) / minorStepMm));
        const iY1 = Math.min(Math.floor((gridY1 + GE) / minorStepMm), Math.ceil(canvasH / minorStepMm));
        for (let i = iY0; i <= iY1; i++) {
          const y = i * minorStepMm;
          if (y <= 0 || y >= canvasH) continue;
          const isMajor = i % stepsPerMajor === 0;
          ctx.strokeStyle = isMajor ? '#e8e8e8' : 'rgba(0,0,0,0.06)';
          ctx.lineWidth = (isMajor ? 0.55 : 0.35) / z;
          ctx.beginPath(); ctx.moveTo(gridX0, y); ctx.lineTo(gridX1, y); ctx.stroke();
        }
      }
    }

    // 安全边（内缩区）
    if (showSafeMargin && edgeSafe > 0 && edgeSafe * 2 < canvasW && edgeSafe * 2 < canvasH) {
      ctx.save();
      ctx.setLineDash([6 / z, 4 / z]);
      ctx.strokeStyle = 'rgba(255, 107, 107, 0.45)';
      ctx.lineWidth = 1 / z;
      ctx.strokeRect(edgeSafe, edgeSafe, canvasW - 2 * edgeSafe, canvasH - 2 * edgeSafe);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Border
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1.5 / z;
    ctx.strokeRect(0, 0, canvasW, canvasH);

    // Dimension labels
    ctx.fillStyle = '#666';
    ctx.font = `${11 / z}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(formatLengthMm(canvasW, displayUnit), canvasW / 2, -6 / z);
    ctx.save();
    ctx.translate(-8 / z, canvasH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(formatLengthMm(canvasH, displayUnit), 0, 0);
    ctx.restore();
    ctx.textAlign = 'start';

    // Draw placements（视口裁剪；选中项始终绘制）
    if (currentCanvas) {
      for (const p of currentCanvas.placements) {
        const isSel = selectedIds.includes(p.id);
        if (!placementVisible(p) && !isSel) continue;
        const item = getItem(p.printItemId);
        const img = item?.imageSrc ? imageCache.get(item.imageSrc) : null;
        const warnVal = validationIssueIds.has(p.id);
        const dragBad = dragInvalidRef.current.has(p.id);

        ctx.save();
        if (dragBad) {
          ctx.fillStyle = 'rgba(255,80,80,0.22)';
          ctx.fillRect(p.x, p.y, p.width, p.height);
        } else if (warnVal) {
          ctx.fillStyle = 'rgba(255,180,80,0.12)';
          ctx.fillRect(p.x, p.y, p.width, p.height);
        }
        if (img) {
          ctx.drawImage(img, p.x, p.y, p.width, p.height);
          ctx.strokeStyle = dragBad
            ? '#ff4444'
            : warnVal
              ? '#ff9800'
              : isSel
                ? '#fff'
                : 'rgba(0,0,0,.3)';
          ctx.lineWidth = dragBad || warnVal ? 2 / z : isSel ? 2.5 / z : 0.5 / z;
          ctx.strokeRect(p.x, p.y, p.width, p.height);
          if (p.width * z > 52 && p.height * z > 36) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.font = `${Math.max(6 / z, 7)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(
              formatPairMm(p.width, p.height, displayUnit),
              p.x + p.width / 2,
              p.y + p.height - 5 / z,
            );
            ctx.textAlign = 'start';
          }
        } else {
          const color = item?.color ?? '#888';
          ctx.fillStyle = color + '88';
          ctx.fillRect(p.x, p.y, p.width, p.height);
          ctx.fillStyle = color + '33';
          ctx.fillRect(p.x + 2 / z, p.y + 2 / z, p.width - 4 / z, p.height - 4 / z);
          ctx.strokeStyle = dragBad ? '#ff4444' : warnVal ? '#ff9800' : isSel ? '#fff' : color;
          ctx.lineWidth = dragBad || warnVal ? 2 / z : isSel ? 2.5 / z : 1 / z;
          ctx.strokeRect(p.x, p.y, p.width, p.height);
        }

        // Locked overlay
        if (p.locked) {
          ctx.fillStyle = 'rgba(0,0,0,.5)';
          ctx.fillRect(p.x, p.y, p.width, p.height);
          ctx.fillStyle = '#FFD700';
          ctx.font = `bold ${14 / z}px sans-serif`;
          ctx.fillText('\u{1F512}', p.x + p.width / 2 - 7 / z, p.y + p.height / 2 + 5 / z);
        }

        // Name + 排版占用尺寸（内部 mm；与侧栏「设计尺寸」可能不同）
        if (!img && p.width * z > 30 && p.height * z > 20) {
          const fontSize = Math.max(7 / z, Math.min(10, p.width * 0.08) / z);
          const showDim = p.width * z > 52 && p.height * z > 32;
          const cy = p.y + p.height / 2;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#333';
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillText(
            item?.name ?? '',
            p.x + p.width / 2,
            cy - (showDim ? fontSize * 0.55 : 0),
          );
          if (showDim) {
            ctx.fillStyle = '#555';
            const sm = Math.max(6 / z, fontSize * 0.72);
            ctx.font = `${sm}px sans-serif`;
            ctx.fillText(
              `${formatPairMm(p.width, p.height, displayUnit)} 占用`,
              p.x + p.width / 2,
              cy + Math.max(sm, fontSize * 0.45),
            );
          }
          ctx.textAlign = 'start';
        }

        // Rotation mark
        if (p.rotated) {
          ctx.fillStyle = 'rgba(108,99,255,.85)';
          ctx.font = `bold ${7 / z}px sans-serif`;
          ctx.fillText('R', p.x + p.width - 10 / z, p.y + 10 / z);
        }

        // Selection glow
        if (isSel) {
          ctx.shadowColor = '#fff';
          ctx.shadowBlur = 8 / z;
          ctx.strokeStyle = 'rgba(255,255,255,.6)';
          ctx.lineWidth = 1.5 / z;
          ctx.strokeRect(p.x, p.y, p.width, p.height);
          ctx.shadowColor = 'transparent';
        }
        ctx.restore();
      }
    }

    // Empty hint
    if (!result) {
      ctx.fillStyle = '#888';
      ctx.font = `${16 / z}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('导入图片素材 → 点击自动排版', canvasW / 2, canvasH / 2);
      ctx.textAlign = 'start';
    }

    ctx.restore();

    // 标尺（屏幕像素坐标；mm 保留 10/50/100 档，其它单位按显示步长）
    if (showRuler) {
      ctx.save();
      ctx.strokeStyle = 'rgba(180,180,200,0.85)';
      ctx.fillStyle = 'rgba(160,160,180,0.95)';
      ctx.font = '10px sans-serif';
      ctx.lineWidth = 1;
      const tickMajor = 14;
      const tickMinor = 8;
      if (displayUnit === 'mm') {
        const mmXStart = Math.max(0, Math.floor(rulerX0 / 10) * 10);
        for (let mmPos = mmXStart; mmPos <= rulerX1 && mmPos <= canvasW; mmPos += 10) {
          const px = ox + mmPos * z;
          const major = mmPos % 100 === 0;
          ctx.beginPath();
          ctx.moveTo(px, Math.max(0, oy - 1));
          ctx.lineTo(px, oy - (major ? tickMajor : mmPos % 50 === 0 ? tickMinor + 3 : tickMinor));
          ctx.stroke();
          if (major && mmPos > 0) {
            ctx.fillText(String(mmPos), px - 8, oy - tickMajor - 2);
          }
        }
        const mmYStart = Math.max(0, Math.floor(rulerY0 / 10) * 10);
        for (let mmPos = mmYStart; mmPos <= rulerY1 && mmPos <= canvasH; mmPos += 10) {
          const py = oy + mmPos * z;
          const major = mmPos % 100 === 0;
          ctx.beginPath();
          ctx.moveTo(Math.max(0, ox - 1), py);
          ctx.lineTo(ox - (major ? tickMajor : mmPos % 50 === 0 ? tickMinor + 3 : tickMinor), py);
          ctx.stroke();
          if (major && mmPos > 0) {
            ctx.save();
            ctx.translate(ox - tickMajor - 14, py + 3);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(String(mmPos), 0, 0);
            ctx.restore();
          }
        }
      } else {
        const { minorStepMm, majorStepMm } = getDisplayGeometrySteps(displayUnit, z, canvasW, canvasH);
        const stepsPerMajor = Math.max(1, Math.round(majorStepMm / minorStepMm + 1e-9));
        const iX0 = Math.max(0, Math.ceil((rulerX0 - GE) / minorStepMm));
        const iX1 = Math.min(Math.floor((rulerX1 + GE) / minorStepMm), Math.ceil(canvasW / minorStepMm + GE));
        for (let i = iX0; i <= iX1; i++) {
          const mmPos = i * minorStepMm;
          if (mmPos > canvasW) break;
          const px = ox + mmPos * z;
          const isMajor = i > 0 && i % stepsPerMajor === 0;
          ctx.beginPath();
          ctx.moveTo(px, Math.max(0, oy - 1));
          ctx.lineTo(px, oy - (isMajor ? tickMajor : tickMinor));
          ctx.stroke();
          if (isMajor && mmPos > 0) {
            ctx.fillText(formatRulerTickMm(mmPos, displayUnit), px - 8, oy - tickMajor - 2);
          }
        }
        const iY0 = Math.max(0, Math.ceil((rulerY0 - GE) / minorStepMm));
        const iY1 = Math.min(Math.floor((rulerY1 + GE) / minorStepMm), Math.ceil(canvasH / minorStepMm + GE));
        for (let i = iY0; i <= iY1; i++) {
          const mmPos = i * minorStepMm;
          if (mmPos > canvasH) break;
          const py = oy + mmPos * z;
          const isMajor = i > 0 && i % stepsPerMajor === 0;
          ctx.beginPath();
          ctx.moveTo(Math.max(0, ox - 1), py);
          ctx.lineTo(ox - (isMajor ? tickMajor : tickMinor), py);
          ctx.stroke();
          if (isMajor && mmPos > 0) {
            ctx.save();
            ctx.translate(ox - tickMajor - 14, py + 3);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(formatRulerTickMm(mmPos, displayUnit), 0, 0);
            ctx.restore();
          }
        }
      }
      ctx.fillStyle = 'rgba(140,140,160,0.9)';
      ctx.font = '9px sans-serif';
      ctx.fillText(displayUnitAbbrev(displayUnit), Math.max(2, ox + 2), Math.max(10, oy - 2));
      ctx.restore();
    }

    // Box selection rectangle (screen space)
    if (isBoxSelecting) {
      const bx1 = boxStartRef.current.x * z + ox;
      const by1 = boxStartRef.current.y * z + oy;
      const bx2 = boxEnd.x * z + ox;
      const by2 = boxEnd.y * z + oy;
      ctx.save();
      ctx.fillStyle = 'rgba(108,99,255,0.12)';
      ctx.fillRect(bx1, by1, bx2 - bx1, by2 - by1);
      ctx.strokeStyle = 'rgba(108,99,255,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (
      import.meta.env.DEV &&
      t0 > 0 &&
      (window as unknown as { __PN_PERF__?: boolean }).__PN_PERF__
    ) {
      const dt = performance.now() - t0;
      if (dt > 16) console.debug('[perf] draw ms', dt.toFixed(1));
    }
  }, [
    currentCanvas,
    canvasW,
    canvasH,
    zoom,
    panOffset,
    selectedIds,
    getItem,
    result,
    isBoxSelecting,
    boxEnd,
    imgLoadCount,
    showGrid,
    showRuler,
    showSafeMargin,
    edgeSafe,
    validationIssueIds,
    invalidDragTick,
    displayUnit,
  ]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  /** Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
      // Undo: Cmd+Z / Ctrl+Z
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        useAppStore.temporal.getState().undo();
      }
      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        useAppStore.temporal.getState().redo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [deleteSelected]);

  /** Hit test */
  const hitTest = useCallback(
    (clientX: number, clientY: number): Placement | null => {
      const canvas = canvasRef.current;
      if (!canvas || !currentCanvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = (clientX - rect.left - panOffset.x) / zoom;
      const my = (clientY - rect.top - panOffset.y) / zoom;
      for (let i = currentCanvas.placements.length - 1; i >= 0; i--) {
        const p = currentCanvas.placements[i];
        if (mx >= p.x && mx <= p.x + p.width && my >= p.y && my <= p.y + p.height) return p;
      }
      return null;
    },
    [currentCanvas, panOffset, zoom]
  );

  /** Box select intersection */
  const boxSelect = useCallback(
    (x1: number, y1: number, x2: number, y2: number): Placement[] => {
      if (!currentCanvas) return [];
      const left = Math.min(x1, x2), right = Math.max(x1, x2);
      const top = Math.min(y1, y2), bottom = Math.max(y1, y2);
      return currentCanvas.placements.filter(
        (p) => p.x < right && p.x + p.width > left && p.y < bottom && p.y + p.height > top
      );
    },
    [currentCanvas]
  );

  /** Mouse down */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Middle button or Alt+left = pan
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        return;
      }

      if (e.button === 0) {
        const hit = hitTest(e.clientX, e.clientY);
        if (hit) {
          // Shift+click = toggle multi-select
          if (e.shiftKey) {
            const idx = selectedIds.indexOf(hit.id);
            if (idx >= 0) {
              setSelectedIds(selectedIds.filter((id) => id !== hit.id));
            } else {
              setSelectedIds([...selectedIds, hit.id]);
            }
          } else {
            if (!selectedIds.includes(hit.id)) {
              setSelectedIds([hit.id]);
            }
          }

          // Start drag if not locked
          if (!hit.locked && currentCanvas) {
            setIsDragging(true);
            dragStartRef.current = {
              x: (e.clientX - rect.left - panOffset.x) / zoom,
              y: (e.clientY - rect.top - panOffset.y) / zoom,
            };
            const currentSelectedIds = selectedIds.includes(hit.id) ? selectedIds : [hit.id];
            dragOrigRef.current = currentCanvas.placements
              .filter((p) => currentSelectedIds.includes(p.id) && !p.locked)
              .map((p) => ({ id: p.id, x: p.x, y: p.y }));
          }
        } else {
          // Empty area click = start box selection
          if (!e.shiftKey) setSelectedIds([]);
          setIsBoxSelecting(true);
          const wx = (mx - panOffset.x) / zoom;
          const wy = (my - panOffset.y) / zoom;
          boxStartRef.current = { x: wx, y: wy };
          setBoxEnd({ x: wx, y: wy });
        }
      }
    },
    [hitTest, selectedIds, setSelectedIds, panOffset, zoom, currentCanvas]
  );

  /** Mouse move */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      if (isPanning) {
        setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
        return;
      }

      if (isBoxSelecting) {
        const mx = (e.clientX - rect.left - panOffset.x) / zoom;
        const my = (e.clientY - rect.top - panOffset.y) / zoom;
        setBoxEnd({ x: mx, y: my });
        const hits = boxSelect(boxStartRef.current.x, boxStartRef.current.y, mx, my);
        setSelectedIds(hits.map((h) => h.id));
        return;
      }

      if (isDragging && dragOrigRef.current.length > 0 && currentCanvas) {
        const mx = (e.clientX - rect.left - panOffset.x) / zoom;
        const my = (e.clientY - rect.top - panOffset.y) / zoom;
        const dx = mx - dragStartRef.current.x;
        const dy = my - dragStartRef.current.y;
        const snap = useAppStore.getState().snapMm;
        for (const orig of dragOrigRef.current) {
          const p = currentCanvas.placements.find((pl) => pl.id === orig.id);
          if (!p) continue;
          const newX = Math.round((orig.x + dx) / snap) * snap;
          const newY = Math.round((orig.y + dy) / snap) * snap;
          updatePlacement(orig.id, { x: newX, y: newY });
        }
        const st = useAppStore.getState();
        const cur = st.result?.canvases[st.activeCanvasIndex];
        if (cur) {
          const bad = computeDragInvalid(cur, dragOrigRef.current, dx, dy, snap, canvasW, canvasH);
          dragInvalidRef.current = bad;
          setInvalidDragTick((t) => t + 1);
        }
        return;
      }

      if (!isPanning && !isBoxSelecting && !isDragging) {
        const mx = (e.clientX - rect.left - panOffset.x) / zoom;
        const my = (e.clientY - rect.top - panOffset.y) / zoom;
        useAppStore.getState().setCanvasPointerMm({ x: mx, y: my });
      }
    },
    [isPanning, panStart, isBoxSelecting, isDragging, panOffset, zoom, setPanOffset, boxSelect, setSelectedIds, currentCanvas, canvasW, canvasH, updatePlacement]
  );

  /** Mouse up */
  const handleMouseUp = useCallback(() => {
    if (isBoxSelecting) {
      setIsBoxSelecting(false);
      const hits = boxSelect(boxStartRef.current.x, boxStartRef.current.y, boxEnd.x, boxEnd.y);
      if (hits.length > 0) setSelectedIds(hits.map((h) => h.id));
    }
    setIsPanning(false);
    setIsDragging(false);
    dragOrigRef.current = [];
    dragInvalidRef.current = new Set();
    setInvalidDragTick((t) => t + 1);
  }, [isBoxSelecting, boxEnd, boxSelect, setSelectedIds]);

  /** Right-click = toggle lock */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        toggleLock(hit.id);
        if (!selectedIds.includes(hit.id)) setSelectedIds([hit.id]);
      }
    },
    [hitTest, toggleLock, selectedIds, setSelectedIds]
  );

  /** Scroll zoom - use native event to set passive: false */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.03 : 0.03;
      useAppStore.getState().setZoom(useAppStore.getState().zoom + delta);
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  /** File drag-drop handlers */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setShowDrop(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const container = containerRef.current;
    if (container && !container.contains(e.relatedTarget as Node)) {
      setShowDrop(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setShowDrop(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const { addItem } = useAppStore.getState();
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const mmW = Math.round((img.naturalWidth / 150) * 25.4);
          const mmH = Math.round((img.naturalHeight / 150) * 25.4);
          addItem({ name: file.name.replace(/\.\w+$/, ''), width: mmW, height: mmH, quantity: 1, imageSrc: src });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const cursor = isPanning ? 'grabbing' : isDragging ? 'move' : 'default';

  return (
    <div
      className="canvas-area"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showDrop && <div className="drop-overlay">松开鼠标导入图片</div>}

      <div className="canvas-viewport canvas-viewport--stage" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="layout-canvas"
          style={{ position: 'absolute', top: 0, left: 0, cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            useAppStore.getState().setCanvasPointerMm(null);
          }}
          onContextMenu={handleContextMenu}
        />
      </div>
    </div>
  );
};
