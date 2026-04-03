import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PackingStrategy } from '../../../shared/types';
import { useEditorChrome } from './EditorChromeContext';

/**
 * 排版任务参数（原 ContextBar 业务区），置于左侧「排版任务」段。
 */
export const LayoutTaskPanel: React.FC = () => {
  const { config, setConfig, setCanvasSize } = useAppStore();
  const { handleLayout, isComputing } = useEditorChrome();

  return (
    <div className="layout-task-panel">
      <div className="layout-task-panel__section">
        <div className="layout-task-panel__h">策略与画布</div>
        <label className="layout-task-panel__field">
          <span className="layout-task-panel__label">策略</span>
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
        </label>
        <label className="layout-task-panel__check">
          <input
            type="checkbox"
            checked={config.singleCanvas}
            onChange={(e) => setConfig({ singleCanvas: e.target.checked })}
          />
          单画布模式
        </label>
        <div className="layout-task-panel__row">
          <span className="layout-task-panel__label">画布（mm）</span>
          <input
            className="input input-shell"
            type="number"
            value={config.canvas.width}
            onChange={(e) => setCanvasSize(Number(e.target.value), config.canvas.height)}
          />
          <span className="layout-task-panel__times">×</span>
          <input
            className="input input-shell"
            type="number"
            value={config.canvas.height}
            onChange={(e) => setCanvasSize(config.canvas.width, Number(e.target.value))}
          />
        </div>
      </div>

      <div className="layout-task-panel__section">
        <div className="layout-task-panel__h">间距与出血</div>
        <div className="layout-task-panel__row">
          <label className="layout-task-panel__field layout-task-panel__field--grow">
            <span className="layout-task-panel__label">间距</span>
            <input
              className="input input-shell"
              type="number"
              value={config.globalSpacing}
              onChange={(e) => setConfig({ globalSpacing: Number(e.target.value) })}
            />
          </label>
          <label className="layout-task-panel__field layout-task-panel__field--grow">
            <span className="layout-task-panel__label">出血</span>
            <input
              className="input input-shell"
              type="number"
              value={config.globalBleed}
              onChange={(e) => setConfig({ globalBleed: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="layout-task-panel__field">
          <span className="layout-task-panel__label" title="校验时要求落位与画布边至少留出此距离">
            安全边（mm）
          </span>
          <input
            className="input input-shell"
            type="number"
            min={0}
            value={config.edgeSafeMm ?? 0}
            onChange={(e) => setConfig({ edgeSafeMm: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <label className="layout-task-panel__check">
          <input
            type="checkbox"
            checked={config.allowRotation}
            onChange={(e) => setConfig({ allowRotation: e.target.checked })}
          />
          允许旋转
        </label>
      </div>

      <div className="layout-task-panel__footer">
        <button
          type="button"
          className="btn btn-shell"
          disabled={isComputing}
          onClick={() => void handleLayout()}
        >
          {isComputing ? '排版中…' : '运行排版（与顶栏相同）'}
        </button>
        <p className="layout-task-panel__hint">主操作仍使用顶栏「自动排版」；参数变更后若画布标黄条，请重新排版。</p>
      </div>
    </div>
  );
};
