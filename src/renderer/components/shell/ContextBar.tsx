import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PackingStrategy } from '../../../shared/types';

export const ContextBar: React.FC = () => {
  const {
    config, setConfig, setCanvasSize,
    showGrid, showRuler, showSafeMargin, snapMm,
    setShowGrid, setShowRuler, setShowSafeMargin, setSnapMm,
  } = useAppStore();

  return (
    <div className="shell-contextbar">
      <div className="shell-contextbar__group">
        <span className="shell-contextbar__label">策略</span>
        <select
          className="select select-shell"
          value={config.strategy}
          onChange={(e) => setConfig({ strategy: e.target.value as PackingStrategy })}
        >
          <option value={PackingStrategy.BestShortSideFit}>短边优先 (BSSF)</option>
          <option value={PackingStrategy.BestLongSideFit}>长边优先 (BLSF)</option>
          <option value={PackingStrategy.BestAreaFit}>面积优先 (BAF)</option>
          <option value={PackingStrategy.BottomLeft}>左下角 (BL)</option>
        </select>
      </div>

      <div className="shell-contextbar__divider" />

      <label className="shell-contextbar__check">
        <input
          type="checkbox"
          checked={config.singleCanvas}
          onChange={(e) => setConfig({ singleCanvas: e.target.checked })}
        />
        单画布
      </label>

      <div className="shell-contextbar__divider" />

      <div className="shell-contextbar__group">
        <span className="shell-contextbar__label">画布 mm</span>
        <input
          className="input input-shell"
          type="number"
          value={config.canvas.width}
          onChange={(e) => setCanvasSize(Number(e.target.value), config.canvas.height)}
        />
        <span className="shell-contextbar__muted">×</span>
        <input
          className="input input-shell"
          type="number"
          value={config.canvas.height}
          onChange={(e) => setCanvasSize(config.canvas.width, Number(e.target.value))}
        />
      </div>

      <div className="shell-contextbar__divider" />

      <div className="shell-contextbar__group">
        <span className="shell-contextbar__label">间距</span>
        <input
          className="input input-shell"
          type="number"
          value={config.globalSpacing}
          onChange={(e) => setConfig({ globalSpacing: Number(e.target.value) })}
        />
        <span className="shell-contextbar__label">出血</span>
        <input
          className="input input-shell"
          type="number"
          value={config.globalBleed}
          onChange={(e) => setConfig({ globalBleed: Number(e.target.value) })}
        />
        <span className="shell-contextbar__label" title="校验时要求落位与画布边至少留出此距离">
          安全边
        </span>
        <input
          className="input input-shell"
          type="number"
          min={0}
          value={config.edgeSafeMm ?? 0}
          onChange={(e) => setConfig({ edgeSafeMm: Math.max(0, Number(e.target.value) || 0) })}
        />
      </div>

      <div className="shell-contextbar__divider" />

      <label className="shell-contextbar__check">
        <input
          type="checkbox"
          checked={config.allowRotation}
          onChange={(e) => setConfig({ allowRotation: e.target.checked })}
        />
        允许旋转
      </label>

      <div className="shell-contextbar__divider" />

      <label className="shell-contextbar__check">
        <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
        网格
      </label>
      <label className="shell-contextbar__check">
        <input type="checkbox" checked={showRuler} onChange={(e) => setShowRuler(e.target.checked)} />
        标尺
      </label>
      <label className="shell-contextbar__check" title="按安全边参数显示内缩虚线">
        <input type="checkbox" checked={showSafeMargin} onChange={(e) => setShowSafeMargin(e.target.checked)} />
        安全边线
      </label>

      <div className="shell-contextbar__group">
        <span className="shell-contextbar__label">吸附</span>
        <select
          className="select select-shell"
          value={snapMm}
          onChange={(e) => setSnapMm(Number(e.target.value))}
        >
          <option value={1}>1 mm</option>
          <option value={5}>5 mm</option>
          <option value={10}>10 mm</option>
          <option value={25}>25 mm</option>
        </select>
      </div>
    </div>
  );
};
