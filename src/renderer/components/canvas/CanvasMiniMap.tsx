import React, { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';

const MW = 168;
const MH = 120;

export const CanvasMiniMap: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const overviewVisible = useAppStore((s) => s.overviewVisible);
  const config = useAppStore((s) => s.config);
  const result = useAppStore((s) => s.result);
  const activeCanvasIndex = useAppStore((s) => s.activeCanvasIndex);
  const zoom = useAppStore((s) => s.zoom);
  const panOffset = useAppStore((s) => s.panOffset);
  const viewportContainerPx = useAppStore((s) => s.viewportContainerPx);
  const focusRectInCanvas = useAppStore((s) => s.focusRectInCanvas);

  const canvasW = config.canvas.width;
  const canvasH = config.canvas.height;
  const cur = result?.canvases[activeCanvasIndex];

  const draw = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = MW;
    c.height = MH;
    ctx.fillStyle = 'var(--bg-primary, #1a1a22)';
    ctx.fillRect(0, 0, MW, MH);
    const scale = Math.min(MW / canvasW, MH / canvasH) * 0.9;
    const ox = (MW - canvasW * scale) / 2;
    const oy = (MH - canvasH * scale) / 2;
    ctx.fillStyle = 'var(--bg-tertiary, #2a2a35)';
    ctx.fillRect(ox, oy, canvasW * scale, canvasH * scale);
    ctx.strokeStyle = 'var(--border, #555)';
    ctx.strokeRect(ox, oy, canvasW * scale, canvasH * scale);
    if (cur) {
      ctx.fillStyle = 'rgba(108,99,255,0.28)';
      for (const p of cur.placements) {
        ctx.fillRect(
          ox + p.x * scale,
          oy + p.y * scale,
          Math.max(1, p.width * scale),
          Math.max(1, p.height * scale),
        );
      }
    }
    const { width: vw, height: vh } = viewportContainerPx;
    if (vw > 0 && vh > 0 && zoom > 0) {
      const vl = -panOffset.x / zoom;
      const vt = -panOffset.y / zoom;
      const vwMm = vw / zoom;
      const vhMm = vh / zoom;
      ctx.strokeStyle = 'rgba(255, 200, 80, 0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + vl * scale, oy + vt * scale, vwMm * scale, vhMm * scale);
    }
  }, [canvasW, canvasH, cur, zoom, panOffset, viewportContainerPx]);

  useEffect(() => {
    draw();
  }, [draw]);

  const onPointerDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const c = ref.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scale = Math.min(MW / canvasW, MH / canvasH) * 0.9;
    const boxOx = (MW - canvasW * scale) / 2;
    const boxOy = (MH - canvasH * scale) / 2;
    const cxMm = (mx - boxOx) / scale;
    const cyMm = (my - boxOy) / scale;
    if (cxMm < 0 || cyMm < 0 || cxMm > canvasW || cyMm > canvasH) return;
    const tClick = performance.now();
    focusRectInCanvas(
      { x: cxMm - 80, y: cyMm - 80, width: 160, height: 160 },
      { mode: 'center', paddingMm: 4 },
    );
    if (import.meta.env.DEV && (window as unknown as { __PN_PERF__?: boolean }).__PN_PERF__) {
      requestAnimationFrame(() => {
        const dt = performance.now() - tClick;
        if (dt > 100) console.debug('[perf] minimap click→frame ms', dt.toFixed(1));
      });
    }
  };

  if (!overviewVisible) return null;
  return (
    <div className="canvas-minimap">
      <canvas ref={ref} width={MW} height={MH} onMouseDown={onPointerDown} />
    </div>
  );
};
