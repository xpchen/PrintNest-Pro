import React, { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { buildLayoutSignature } from '../../../shared/layoutSignature';

export const CanvasHeader: React.FC = () => {
  const {
    result, activeCanvasIndex, setActiveCanvas, setSelectedIds,
    zoom, setZoom,
    applyViewFitAll, applyViewFitWidth, applyViewActual100,
    overviewVisible, setOverviewVisible,
    items, config, layoutSourceSignature,
    runAutoLayout,
  } = useAppStore();

  const layoutStale =
    !!result &&
    layoutSourceSignature !== null &&
    buildLayoutSignature(items, config) !== layoutSourceSignature;

  const handleStaleClick = useCallback(() => {
    if (!layoutStale) return;
    if (window.confirm('素材或参数已变更，是否立即重新自动排版？')) {
      void runAutoLayout();
    }
  }, [layoutStale, runAutoLayout]);

  const curU = result?.canvases[activeCanvasIndex]?.utilization;

  return (
    <div className="canvas-header pn-z-canvas-header">
      {layoutStale && (
        <button type="button" className="canvas-header__stale" onClick={handleStaleClick}>
          当前视图与最新素材不一致 — 点击重新排版
        </button>
      )}

      <div className="canvas-header__row">
        {result && result.canvases.length > 0 && (
          <div className="canvas-tabs canvas-header__tabs">
            {result.canvases.map((c, idx) => (
              <button
                type="button"
                key={idx}
                className={`canvas-tab ${idx === activeCanvasIndex ? 'active' : ''}`}
                onClick={() => {
                  setActiveCanvas(idx);
                  setSelectedIds([]);
                }}
              >
                画布 {idx + 1} ({(c.utilization * 100).toFixed(1)}%)
              </button>
            ))}
          </div>
        )}

        {curU != null && (
          <span className="canvas-header__util">利用率 {(curU * 100).toFixed(1)}%</span>
        )}

        <div className="canvas-header__views" onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn-tiny" onClick={() => applyViewFitAll()}>
            全部可见
          </button>
          <button type="button" className="btn btn-tiny" onClick={() => applyViewFitWidth()}>
            适应宽度
          </button>
          <button type="button" className="btn btn-tiny" onClick={() => applyViewActual100()}>
            100%
          </button>
          <button
            type="button"
            className={`btn btn-tiny${!overviewVisible ? ' is-off' : ''}`}
            onClick={() => setOverviewVisible(!overviewVisible)}
          >
            鹰眼
          </button>
        </div>

        <div className="canvas-header__zoom" onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn-tiny" onClick={() => setZoom(zoom - 0.05)}>
            −
          </button>
          <span className="canvas-header__zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn btn-tiny" onClick={() => setZoom(zoom + 0.05)}>
            +
          </button>
        </div>
      </div>
    </div>
  );
};
