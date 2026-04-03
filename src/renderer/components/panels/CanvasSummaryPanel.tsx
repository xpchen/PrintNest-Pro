import React from 'react';
import { useAppStore } from '../../store/useAppStore';

export const CanvasSummaryPanel: React.FC = () => {
  const config = useAppStore((s) => s.config);
  const result = useAppStore((s) => s.result);
  const activeCanvasIndex = useAppStore((s) => s.activeCanvasIndex);
  const segmentSizeMm = useAppStore((s) => s.segmentSizeMm);
  const activeSegmentIndex = useAppStore((s) => s.activeSegmentIndex);

  const cur = result?.canvases[activeCanvasIndex];
  const u = cur?.utilization ?? 0;
  const canvasH = config.canvas.height;
  const seg = Math.max(100, segmentSizeMm);
  const totalSegs = Math.max(1, Math.ceil(canvasH / seg));

  return (
    <div className="panel-summary">
      <div className="panel-summary__block">
        <div className="panel-summary__h">画布尺寸</div>
        <div className="panel-summary__v">
          {config.canvas.width} × {config.canvas.height} mm
        </div>
      </div>
      <div className="panel-summary__block">
        <div className="panel-summary__h">当前画布利用率</div>
        <div className="panel-summary__v">{(u * 100).toFixed(1)}%</div>
      </div>
      <div className="panel-summary__block">
        <div className="panel-summary__h">间距 / 出血 / 安全边</div>
        <div className="panel-summary__v">
          {config.globalSpacing} / {config.globalBleed} / {config.edgeSafeMm ?? 0} mm
        </div>
      </div>
      <div className="panel-summary__block">
        <div className="panel-summary__h">分段</div>
        <div className="panel-summary__v">
          段 {activeSegmentIndex + 1} / {totalSegs}（每段 {seg} mm）
        </div>
      </div>
    </div>
  );
};
