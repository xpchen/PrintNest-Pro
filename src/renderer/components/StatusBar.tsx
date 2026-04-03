/**
 * 底部状态栏
 * 显示利用率 | 画布数量 | 素材等
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
  const val = result?.validation;
  const errN = val?.issues.filter((i) => i.severity === 'error').length ?? 0;
  const warnN = val?.issues.filter((i) => i.severity === 'warning').length ?? 0;
  const valTitle =
    val && val.issues.length > 0
      ? val.issues
          .slice(0, 12)
          .map((i) => `[${i.severity === 'error' ? '错误' : '提示'}] ${i.message}`)
          .join('\n')
      : '';

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
      {result && val && (errN > 0 || warnN > 0) && (
        <div
          className="statusbar-item"
          title={valTitle}
          style={{ cursor: valTitle ? 'help' : undefined }}
        >
          校验:
          {errN > 0 && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>{errN} 错误</span>}
          {warnN > 0 && (
            <span style={{ color: 'var(--warning)', marginLeft: errN > 0 ? 8 : 4 }}>{warnN} 提示</span>
          )}
        </div>
      )}
      {result && val && val.isValid && errN === 0 && warnN === 0 && (
        <div className="statusbar-item" style={{ color: 'var(--success)' }}>
          校验通过
        </div>
      )}
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
