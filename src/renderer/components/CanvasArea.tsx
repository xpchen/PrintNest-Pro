/**
 * 中央画布区域
 * 使用 HTML5 Canvas 渲染排版结果
 * 支持缩放、平移、选中、拖拽、框选、图片渲染
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Placement } from '../../shared/types';
import { buildLayoutSignature } from '../../shared/layoutSignature';

// ==================== Image Cache ====================
const imageCache = new Map<string, HTMLImageElement>();

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
    result, config, items, activeCanvasIndex, selectedIds, zoom, layoutSourceSignature,
    setActiveCanvas, setSelectedIds, toggleLock, updatePlacement, deleteSelected,
  } = useAppStore();

  const layoutStale =
    !!result &&
    layoutSourceSignature !== null &&
    buildLayoutSignature(items, config) !== layoutSourceSignature;

  const [offset, setOffset] = useState({ x: 30, y: 10 });
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

  /** Draw canvas */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const z = zoom, ox = offset.x, oy = offset.y;

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

    // Grid (50mm)
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5 / z;
    for (let x = 50; x < canvasW; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke();
    }
    for (let y = 50; y < canvasH; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasW, y); ctx.stroke();
    }

    // Border
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1.5 / z;
    ctx.strokeRect(0, 0, canvasW, canvasH);

    // Dimension labels
    ctx.fillStyle = '#666';
    ctx.font = `${11 / z}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${canvasW} mm`, canvasW / 2, -6 / z);
    ctx.save();
    ctx.translate(-8 / z, canvasH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${canvasH} mm`, 0, 0);
    ctx.restore();
    ctx.textAlign = 'start';

    // Draw placements
    if (currentCanvas) {
      for (const p of currentCanvas.placements) {
        const isSel = selectedIds.includes(p.id);
        const item = getItem(p.printItemId);
        const img = item?.imageSrc ? imageCache.get(item.imageSrc) : null;

        ctx.save();
        if (img) {
          ctx.drawImage(img, p.x, p.y, p.width, p.height);
          ctx.strokeStyle = isSel ? '#fff' : 'rgba(0,0,0,.3)';
          ctx.lineWidth = isSel ? 2.5 / z : 0.5 / z;
          ctx.strokeRect(p.x, p.y, p.width, p.height);
          if (p.width * z > 52 && p.height * z > 36) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.font = `${Math.max(6 / z, 7)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(
              `${Math.round(p.width)}×${Math.round(p.height)}`,
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
          ctx.strokeStyle = isSel ? '#fff' : color;
          ctx.lineWidth = isSel ? 2.5 / z : 1 / z;
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

        // Name + 排版占用尺寸（mm，含出血/间距；与侧栏「设计尺寸」可能不同）
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
              `${Math.round(p.width)}×${Math.round(p.height)} mm 占用`,
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
  }, [currentCanvas, canvasW, canvasH, zoom, offset, selectedIds, getItem, result, isBoxSelecting, boxEnd, imgLoadCount]);

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
      const mx = (clientX - rect.left - offset.x) / zoom;
      const my = (clientY - rect.top - offset.y) / zoom;
      for (let i = currentCanvas.placements.length - 1; i >= 0; i--) {
        const p = currentCanvas.placements[i];
        if (mx >= p.x && mx <= p.x + p.width && my >= p.y && my <= p.y + p.height) return p;
      }
      return null;
    },
    [currentCanvas, offset, zoom]
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
        setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
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
              x: (e.clientX - rect.left - offset.x) / zoom,
              y: (e.clientY - rect.top - offset.y) / zoom,
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
          const wx = (mx - offset.x) / zoom;
          const wy = (my - offset.y) / zoom;
          boxStartRef.current = { x: wx, y: wy };
          setBoxEnd({ x: wx, y: wy });
        }
      }
    },
    [hitTest, selectedIds, setSelectedIds, offset, zoom, currentCanvas]
  );

  /** Mouse move */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      if (isBoxSelecting) {
        const mx = (e.clientX - rect.left - offset.x) / zoom;
        const my = (e.clientY - rect.top - offset.y) / zoom;
        setBoxEnd({ x: mx, y: my });
        const hits = boxSelect(boxStartRef.current.x, boxStartRef.current.y, mx, my);
        setSelectedIds(hits.map((h) => h.id));
        return;
      }

      if (isDragging && dragOrigRef.current.length > 0 && currentCanvas) {
        const mx = (e.clientX - rect.left - offset.x) / zoom;
        const my = (e.clientY - rect.top - offset.y) / zoom;
        const dx = mx - dragStartRef.current.x;
        const dy = my - dragStartRef.current.y;
        for (const orig of dragOrigRef.current) {
          const newX = Math.max(0, Math.min(canvasW - (currentCanvas.placements.find((p) => p.id === orig.id)?.width ?? 0),
            Math.round((orig.x + dx) / 5) * 5));
          const newY = Math.max(0, Math.min(canvasH - (currentCanvas.placements.find((p) => p.id === orig.id)?.height ?? 0),
            Math.round((orig.y + dy) / 5) * 5));
          updatePlacement(orig.id, { x: newX, y: newY });
        }
      }
    },
    [isPanning, panStart, isBoxSelecting, isDragging, offset, zoom, boxSelect, setSelectedIds, currentCanvas, canvasW, canvasH, updatePlacement]
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
          addItem({ name: file.name.replace(/\.\w+$/, ''), width: mmW, height: mmH, quantity: 5, imageSrc: src });
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

      {layoutStale && (
        <div className="layout-stale-banner">
          素材列表或画布设置已变更，与当前画布不一致。请重新点击「自动排版」后再查看尺寸。
        </div>
      )}

      {/* Canvas Tabs */}
      {result && result.canvases.length > 0 && (
        <div className="canvas-tabs">
          {result.canvases.map((c, idx) => (
            <div
              key={idx}
              className={`canvas-tab ${idx === activeCanvasIndex ? 'active' : ''}`}
              onClick={() => { setActiveCanvas(idx); setSelectedIds([]); }}
            >
              画布 {idx + 1} ({(c.utilization * 100).toFixed(1)}%)
            </div>
          ))}
        </div>
      )}

      {/* Canvas Viewport */}
      <div className="canvas-viewport" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="layout-canvas"
          style={{ position: 'absolute', top: 0, left: 0, cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        />
      </div>
    </div>
  );
};
