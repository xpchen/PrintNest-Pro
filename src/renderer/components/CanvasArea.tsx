/**
 * 中央画布区域
 * 使用 HTML5 Canvas 渲染排版结果
 * 支持缩放、平移、选中、拖拽
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Placement } from '../../shared/types';

/** 将 mm 转换为 canvas 像素 (1mm ≈ 3px at zoom=1) */
const MM_TO_PX = 1;

export const CanvasArea: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    result, config, items, activeCanvasIndex, selectedIds, zoom,
    setActiveCanvas, setSelectedIds, toggleLock,
  } = useAppStore();

  // 平移偏移
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const currentCanvas = result?.canvases[activeCanvasIndex];
  const canvasW = config.canvas.width * MM_TO_PX;
  const canvasH = config.canvas.height * MM_TO_PX;

  /** 根据 PrintItem ID 查找颜色 */
  const getColor = useCallback(
    (printItemId: string): string => {
      return items.find((i) => i.id === printItemId)?.color ?? '#888';
    },
    [items]
  );

  /** 绘制函数 */
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
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // 画布背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 画布边框
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(0, 0, canvasW, canvasH);

    // 网格线 (每50mm)
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 0.5 / zoom;
    const gridStep = 50 * MM_TO_PX;
    for (let x = gridStep; x < canvasW; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
    }
    for (let y = gridStep; y < canvasH; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();
    }

    // 绘制放置的矩形
    if (currentCanvas) {
      for (const p of currentCanvas.placements) {
        const color = getColor(p.printItemId);
        const isSelected = selectedIds.includes(p.id);
        const px = p.x * MM_TO_PX;
        const py = p.y * MM_TO_PX;
        const pw = p.width * MM_TO_PX;
        const ph = p.height * MM_TO_PX;

        // 填充
        ctx.fillStyle = color + '88'; // 半透明
        ctx.fillRect(px, py, pw, ph);

        // 边框
        ctx.strokeStyle = isSelected ? '#fff' : color;
        ctx.lineWidth = isSelected ? 3 / zoom : 1.5 / zoom;
        ctx.strokeRect(px, py, pw, ph);

        // 锁定标记
        if (p.locked) {
          ctx.fillStyle = '#FFD700';
          ctx.font = `${14 / zoom}px sans-serif`;
          ctx.fillText('🔒', px + 4 / zoom, py + 16 / zoom);
        }

        // 尺寸标注
        ctx.fillStyle = '#333';
        ctx.font = `${10 / zoom}px sans-serif`;
        const label = `${Math.round(p.width)}x${Math.round(p.height)}`;
        ctx.fillText(label, px + pw / 2 - ctx.measureText(label).width / 2, py + ph / 2 + 4 / zoom);

        // 旋转标记
        if (p.rotated) {
          ctx.fillStyle = '#666';
          ctx.font = `${9 / zoom}px sans-serif`;
          ctx.fillText('R', px + 4 / zoom, py + ph - 6 / zoom);
        }
      }
    }

    ctx.restore();
  }, [currentCanvas, canvasW, canvasH, zoom, offset, selectedIds, getColor]);

  /** 渲染循环 */
  useEffect(() => {
    draw();
  }, [draw]);

  /** 窗口 resize */
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  /** 查找点击位置下的 Placement */
  const hitTest = useCallback(
    (clientX: number, clientY: number): Placement | null => {
      const canvas = canvasRef.current;
      if (!canvas || !currentCanvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = (clientX - rect.left - offset.x) / zoom;
      const my = (clientY - rect.top - offset.y) / zoom;

      // 逆序遍历（后绘制的在上层）
      for (let i = currentCanvas.placements.length - 1; i >= 0; i--) {
        const p = currentCanvas.placements[i];
        const px = p.x * MM_TO_PX;
        const py = p.y * MM_TO_PX;
        const pw = p.width * MM_TO_PX;
        const ph = p.height * MM_TO_PX;
        if (mx >= px && mx <= px + pw && my >= py && my <= py + ph) {
          return p;
        }
      }
      return null;
    },
    [currentCanvas, offset, zoom]
  );

  /** 鼠标按下 */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // 中键或 Alt+左键：平移
        setIsPanning(true);
        setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        return;
      }

      if (e.button === 0) {
        const hit = hitTest(e.clientX, e.clientY);
        if (hit) {
          if (e.shiftKey) {
            // Shift 多选
            setSelectedIds(
              selectedIds.includes(hit.id)
                ? selectedIds.filter((id) => id !== hit.id)
                : [...selectedIds, hit.id]
            );
          } else {
            setSelectedIds([hit.id]);
          }
        } else {
          setSelectedIds([]);
        }
      }
    },
    [hitTest, selectedIds, setSelectedIds, offset]
  );

  /** 鼠标移动 */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
    },
    [isPanning, panStart]
  );

  /** 鼠标释放 */
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  /** 右键菜单 - 锁定/解锁 */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        toggleLock(hit.id);
        setSelectedIds([hit.id]);
      }
    },
    [hitTest, toggleLock, setSelectedIds]
  );

  /** 滚轮缩放 */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      useAppStore.getState().setZoom(zoom + delta);
    },
    [zoom]
  );

  return (
    <div className="canvas-area">
      {/* 画布 Tab */}
      {result && result.canvases.length > 0 && (
        <div className="canvas-tabs">
          {result.canvases.map((c, idx) => (
            <div
              key={idx}
              className={`canvas-tab ${idx === activeCanvasIndex ? 'active' : ''}`}
              onClick={() => setActiveCanvas(idx)}
            >
              画布 {idx + 1} ({(c.utilization * 100).toFixed(1)}%)
            </div>
          ))}
        </div>
      )}

      {/* 画布视口 */}
      <div className="canvas-viewport" ref={containerRef}>
        {!result ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#9998;</div>
            <div>添加素材后点击 "自动排版"</div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="layout-canvas"
            style={{ width: '100%', height: '100%', cursor: isPanning ? 'grabbing' : 'default' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
          />
        )}
      </div>
    </div>
  );
};
