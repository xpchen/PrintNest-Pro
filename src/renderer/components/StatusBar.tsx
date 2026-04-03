/**
 * 底部状态栏 — v1.1 轻量：利用率、校验态、进度、版本
 */
import React from 'react';
import { useAppStore } from '../store/useAppStore';

export const StatusBar: React.FC = () => {
  const { result, isComputing, layoutProgress, cancelLayoutJob } = useAppStore();

  const utilization = result?.totalUtilization ?? 0;
  const val = result?.validation;
  const errN = val?.issues.filter((i) => i.severity === 'error').length ?? 0;
  const warnN = val?.issues.filter((i) => i.severity !== 'error').length ?? 0;
  const valTitle =
    val && val.issues.length > 0
      ? val.issues
          .slice(0, 12)
          .map((i) => `[${i.severity === 'error' ? '错误' : '提示'}] ${i.message}`)
          .join('\n')
      : '';

  return (
    <div className="statusbar statusbar--v11">
      <div className="statusbar-item">
        <div
          className="statusbar-dot"
          style={{
            background:
              utilization > 0.7 ? 'var(--success)' : utilization > 0 ? 'var(--warning)' : 'var(--text-secondary)',
          }}
        />
        利用率 {(utilization * 100).toFixed(1)}%
      </div>
      {result && val && (errN > 0 || warnN > 0) && (
        <div className="statusbar-item" title={valTitle} style={{ cursor: valTitle ? 'help' : undefined }}>
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
      {isComputing && (
        <div className="statusbar-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>排版 {Math.round(layoutProgress)}%</span>
          <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={cancelLayoutJob}>
            取消
          </button>
        </div>
      )}
      <div className="statusbar-item">PrintNest Pro v1.1</div>
    </div>
  );
};
