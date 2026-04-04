import React, { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { buildLayoutSignature } from '../../../shared/layoutSignature';
import { DISPLAY_UNIT_OPTIONS, type DisplayLengthUnit } from '../../utils/lengthDisplay';

export const CanvasHeader: React.FC = () => {
  const {
    result, activeCanvasIndex, setActiveCanvas, setSelectedIds,
    zoom, setZoom,
    applyViewFitAll, applyViewFitWidth, applyViewActual100,
    overviewVisible, setOverviewVisible,
    items, config, layoutSourceSignature,
    runAutoLayout,
    showGrid, showRuler, showSafeMargin, snapMm,
    setShowGrid, setShowRuler, setShowSafeMargin, setSnapMm,
    displayUnit, setDisplayUnit,
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

        <div className="canvas-header__views canvas-header__views--tools" onMouseDown={(e) => e.stopPropagation()}>
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
            缩略导航
          </button>
        </div>

        <div className="canvas-header__divider" aria-hidden />

        <div className="canvas-header__views" onMouseDown={(e) => e.stopPropagation()}>
          <label className="canvas-header__check">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            网格
          </label>
          <label className="canvas-header__check">
            <input type="checkbox" checked={showRuler} onChange={(e) => setShowRuler(e.target.checked)} />
            标尺
          </label>
          <label className="canvas-header__check" title="按安全边参数显示内缩虚线">
            <input type="checkbox" checked={showSafeMargin} onChange={(e) => setShowSafeMargin(e.target.checked)} />
            安全边线
          </label>
          <label className="canvas-header__snap">
            <span className="canvas-header__snap-label">吸附</span>
            <select
              className="select select-shell select-shell--compact"
              value={snapMm}
              onChange={(e) => setSnapMm(Number(e.target.value))}
            >
              <option value={1}>1 mm</option>
              <option value={5}>5 mm</option>
              <option value={10}>10 mm</option>
              <option value={25}>25 mm</option>
            </select>
          </label>
          <label className="canvas-header__snap" title="画布与只读标签的显示单位；存储与排版仍为 mm">
            <span className="canvas-header__snap-label">单位</span>
            <select
              className="select select-shell select-shell--compact"
              value={displayUnit}
              onChange={(e) => setDisplayUnit(e.target.value as DisplayLengthUnit)}
            >
              {DISPLAY_UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
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
