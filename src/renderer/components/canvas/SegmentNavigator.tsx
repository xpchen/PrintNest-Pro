import React from 'react';
import { useAppStore } from '../../store/useAppStore';

export const SegmentNavigator: React.FC = () => {
  const config = useAppStore((s) => s.config);
  const segmentSizeMm = useAppStore((s) => s.segmentSizeMm);
  const setSegmentSizeMm = useAppStore((s) => s.setSegmentSizeMm);
  const activeSegmentIndex = useAppStore((s) => s.activeSegmentIndex);
  const jumpToSegment = useAppStore((s) => s.jumpToSegment);
  const canvasH = config.canvas.height;
  const seg = Math.max(100, segmentSizeMm);
  const totalSegs = Math.max(1, Math.ceil(canvasH / seg));

  return (
    <div className="segment-navigator" onMouseDown={(e) => e.stopPropagation()}>
      <span className="segment-navigator__label">分段 mm</span>
      <input
        type="number"
        className="input segment-navigator__input"
        min={100}
        step={100}
        value={segmentSizeMm}
        onChange={(e) => setSegmentSizeMm(Number(e.target.value) || 1000)}
      />
      <button
        type="button"
        className="btn segment-navigator__btn"
        disabled={activeSegmentIndex <= 0}
        onClick={() => jumpToSegment(activeSegmentIndex - 1)}
      >
        上一段
      </button>
      <span className="segment-navigator__meta">
        {activeSegmentIndex + 1} / {totalSegs}
      </span>
      <button
        type="button"
        className="btn segment-navigator__btn"
        disabled={activeSegmentIndex >= totalSegs - 1}
        onClick={() => jumpToSegment(activeSegmentIndex + 1)}
      >
        下一段
      </button>
    </div>
  );
};
