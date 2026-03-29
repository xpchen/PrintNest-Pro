/**
 * 底部状态栏
 * 显示利用率 | 画布数量 | 总面积
 */
import React from 'react';
import { useAppStore } from '../store/useAppStore';

export const StatusBar: React.FC = () => {
  const { result, config, items } = useAppStore();

  const canvasCount = result?.canvases.length ?? 0;
  const utilization = result?.totalUtilization ?? 0;
  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const unplacedCount = result?.unplaced.length ?? 0;
  const elapsed = result?.elapsedMs ?? 0;

  return (
    <div className="statusbar">
      <div className="statusbar-item">
        <div className="statusbar-dot" style={{
          background: utilization > 0.7 ? 'var(--success)' : utilization > 0 ? 'var(--warning)' : 'var(--text-secondary)',
        }} />
        利用率: {(utilization * 100).toFixed(1)}%
      </div>
      <div className="statusbar-item">
        画布: {canvasCount} 个 ({config.canvas.width} x {config.canvas.height} mm)
      </div>
      <div className="statusbar-item">
        素材: {totalItemCount} 件
        {unplacedCount > 0 && (
          <span style={{ color: 'var(--danger)' }}> ({unplacedCount} 未排入)</span>
        )}
      </div>
      <div style={{ flex: 1 }} />
      {elapsed > 0 && (
        <div className="statusbar-item">
          耗时: {elapsed.toFixed(0)}ms
        </div>
      )}
      <div className="statusbar-item">PrintNest Pro v1.0</div>
    </div>
  );
};
