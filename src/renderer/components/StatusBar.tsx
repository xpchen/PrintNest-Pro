/**
 * 底部状态栏
 * 显示利用率 | 画布数量 | 素材等
 */
import React, { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../utils/toast';

export const StatusBar: React.FC = () => {
  const {
    result,
    config,
    items,
    isComputing,
    layoutProgress,
    cancelLayoutJob,
    lastLayoutRunId,
    currentProjectId,
  } = useAppStore();

  const handleExportHistoricalPdf = useCallback(async () => {
    const api = window.electronAPI;
    if (!lastLayoutRunId || !api?.exportPdfHistoricalRun || !api?.saveFile) return;
    const isPdfOk = await api.isPdfAvailable?.();
    if (!isPdfOk) {
      showToast('PDFKit 未安装');
      return;
    }
    const outputPath = await api.saveFile('PrintNest_历史排版.pdf', 'PDF', ['pdf']);
    if (!outputPath) return;
    const res = await api.exportPdfHistoricalRun({
      projectId: currentProjectId,
      layoutRunId: lastLayoutRunId,
      outputPath,
    });
    showToast(res.success ? '历史 Run PDF 已导出' : `导出失败: ${res.error ?? ''}`);
  }, [currentProjectId, lastLayoutRunId]);

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
      {isComputing && (
        <div className="statusbar-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>排版 {Math.round(layoutProgress)}%</span>
          <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={cancelLayoutJob}>
            取消
          </button>
        </div>
      )}
      {!isComputing && lastLayoutRunId && (
        <div className="statusbar-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }} title="当前会话最近一次落库的排版运行">
            run: {lastLayoutRunId.slice(0, 8)}…
          </span>
          <button
            type="button"
            className="btn"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={() => void handleExportHistoricalPdf()}
          >
            导出此 Run PDF
          </button>
        </div>
      )}
      {elapsed > 0 && (
        <div className="statusbar-item">
          耗时: {elapsed.toFixed(0)}ms
        </div>
      )}
      <div className="statusbar-item">PrintNest Pro v1.0</div>
    </div>
  );
};
