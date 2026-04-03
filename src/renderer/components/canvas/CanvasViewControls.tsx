import React from 'react';
import { useAppStore } from '../../store/useAppStore';

export const CanvasViewControls: React.FC = () => {
  const applyViewFitAll = useAppStore((s) => s.applyViewFitAll);
  const applyViewFitWidth = useAppStore((s) => s.applyViewFitWidth);
  const applyViewActual100 = useAppStore((s) => s.applyViewActual100);
  const overviewVisible = useAppStore((s) => s.overviewVisible);
  const setOverviewVisible = useAppStore((s) => s.setOverviewVisible);

  return (
    <div className="canvas-view-controls" onMouseDown={(e) => e.stopPropagation()}>
      <button type="button" className="btn canvas-view-controls__btn" onClick={() => applyViewFitAll()}>
        全部可见
      </button>
      <button type="button" className="btn canvas-view-controls__btn" onClick={() => applyViewFitWidth()}>
        适应宽度
      </button>
      <button type="button" className="btn canvas-view-controls__btn" onClick={() => applyViewActual100()}>
        100%
      </button>
      <button
        type="button"
        className={`btn canvas-view-controls__btn${!overviewVisible ? ' is-off' : ''}`}
        onClick={() => setOverviewVisible(!overviewVisible)}
      >
        小地图
      </button>
    </div>
  );
};
