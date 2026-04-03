import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

const MW = 200;
const MH = 132;

export const OverviewCard: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const overviewVisible = useAppStore((s) => s.overviewVisible);
  const config = useAppStore((s) => s.config);
  const result = useAppStore((s) => s.result);
  const activeCanvasIndex = useAppStore((s) => s.activeCanvasIndex);
  const zoom = useAppStore((s) => s.zoom);
  const panOffset = useAppStore((s) => s.panOffset);
  const viewportContainerPx = useAppStore((s) => s.viewportContainerPx);
  const focusRectInCanvas = useAppStore((s) => s.focusRectInCanvas);
  const applyViewFitWidth = useAppStore((s) => s.applyViewFitWidth);
  const segmentSizeMm = useAppStore((s) => s.segmentSizeMm);
  const setSegmentSizeMm = useAppStore((s) => s.setSegmentSizeMm);
  const activeSegmentIndex = useAppStore((s) => s.activeSegmentIndex);
  const jumpToSegment = useAppStore((s) => s.jumpToSegment);
  const jumpViewHead = useAppStore((s) => s.jumpViewHead);
  const jumpViewMid = useAppStore((s) => s.jumpViewMid);
  const jumpViewTail = useAppStore((s) => s.jumpViewTail);

  const canvasW = config.canvas.width;
  const canvasH = config.canvas.height;
  const cur = result?.canvases[activeCanvasIndex];
  const seg = Math.max(100, segmentSizeMm);
  const totalSegs = Math.max(1, Math.ceil(canvasH / seg));

  const lastClickRef = useRef(0);

  const draw = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = MW;
    c.height = MH;
    ctx.fillStyle = 'rgba(24,26,36,0.92)';
    ctx.fillRect(0, 0, MW, MH);
    const scale = Math.min(MW / canvasW, MH / canvasH) * 0.88;
    const ox = (MW - canvasW * scale) / 2;
    const oy = (MH - canvasH * scale) / 2;
    ctx.fillStyle = 'rgba(42,47,68,0.95)';
    ctx.fillRect(ox, oy, canvasW * scale, canvasH * scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.strokeRect(ox, oy, canvasW * scale, canvasH * scale);

    const y0 = activeSegmentIndex * seg;
    if (y0 < canvasH) {
      ctx.fillStyle = 'rgba(111,109,255,0.12)';
      ctx.fillRect(ox, oy + y0 * scale, canvasW * scale, Math.min(seg, canvasH - y0) * scale);
    }

    if (cur) {
      ctx.fillStyle = 'rgba(111,109,255,0.22)';
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
      ctx.strokeStyle = 'rgba(111,109,255,0.95)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + vl * scale, oy + vt * scale, vwMm * scale, vhMm * scale);
    }
  }, [canvasW, canvasH, cur, zoom, panOffset, viewportContainerPx, activeSegmentIndex, seg]);

  useEffect(() => {
    draw();
  }, [draw]);

  const [hoverMm, setHoverMm] = useState<string | null>(null);

  const onCanvasClick = (e: React.MouseEvent) => {
    const c = ref.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scale = Math.min(MW / canvasW, MH / canvasH) * 0.88;
    const boxOx = (MW - canvasW * scale) / 2;
    const boxOy = (MH - canvasH * scale) / 2;
    const cxMm = (mx - boxOx) / scale;
    const cyMm = (my - boxOy) / scale;
    if (cxMm < 0 || cyMm < 0 || cxMm > canvasW || cyMm > canvasH) return;

    const now = performance.now();
    if (now - lastClickRef.current < 320) {
      applyViewFitWidth();
      lastClickRef.current = 0;
      return;
    }
    lastClickRef.current = now;
    focusRectInCanvas(
      { x: cxMm - 80, y: cyMm - 80, width: 160, height: 160 },
      { mode: 'center', paddingMm: 4 },
    );
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const c = ref.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scale = Math.min(MW / canvasW, MH / canvasH) * 0.88;
    const boxOx = (MW - canvasW * scale) / 2;
    const boxOy = (MH - canvasH * scale) / 2;
    const cxMm = (mx - boxOx) / scale;
    const cyMm = (my - boxOy) / scale;
    if (cxMm < 0 || cyMm < 0 || cxMm > canvasW || cyMm > canvasH) {
      setHoverMm(null);
      return;
    }
    setHoverMm(`视口中心约 ${cxMm.toFixed(0)}, ${cyMm.toFixed(0)} mm`);
  };

  if (!overviewVisible) return null;

  return (
    <div className="overview-card pn-z-overview" title={hoverMm ?? undefined}>
      <div className="overview-card__canvas-wrap">
        <canvas
          ref={ref}
          width={MW}
          height={MH}
          onMouseDown={(e) => {
            e.stopPropagation();
            onCanvasClick(e);
          }}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHoverMm(null)}
        />
      </div>
      <div className="overview-card__seg" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="btn btn-tiny" onClick={() => jumpViewHead()}>
          头
        </button>
        <button type="button" className="btn btn-tiny" onClick={() => jumpViewMid()}>
          中
        </button>
        <button type="button" className="btn btn-tiny" onClick={() => jumpViewTail()}>
          尾
        </button>
        <button
          type="button"
          className="btn btn-tiny"
          disabled={activeSegmentIndex <= 0}
          onClick={() => jumpToSegment(activeSegmentIndex - 1)}
        >
          上段
        </button>
        <button
          type="button"
          className="btn btn-tiny"
          disabled={activeSegmentIndex >= totalSegs - 1}
          onClick={() => jumpToSegment(activeSegmentIndex + 1)}
        >
          下段
        </button>
        <span className="overview-card__seg-meta">{activeSegmentIndex + 1}/{totalSegs}</span>
        <input
          type="number"
          className="input overview-card__seg-input"
          min={100}
          step={100}
          value={segmentSizeMm}
          onChange={(e) => setSegmentSizeMm(Number(e.target.value) || 1000)}
          title="分段 mm"
        />
      </div>
      <div className="overview-card__hint">双击画布：适应宽度 · 单击：跳转</div>
    </div>
  );
};
