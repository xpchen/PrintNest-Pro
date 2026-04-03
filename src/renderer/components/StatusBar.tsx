/**
 * 底部状态栏 — 利用率、校验、指针、缩放、进度
 */
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { formatPointerPairMm } from '../utils/lengthDisplay';

export const StatusBar: React.FC = () => {
  const {
    result,
    isComputing,
    layoutProgress,
    cancelLayoutJob,
    zoom,
    canvasPointerMm,
    editorWorkMode,
    displayUnit,
    saveStatus,
  } = useAppStore();

  const utilization = result?.totalUtilization ?? 0;
  const unplacedN = result?.unplaced?.length ?? 0;
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

  const pointerLabel =
    canvasPointerMm != null
      ? formatPointerPairMm(canvasPointerMm.x, canvasPointerMm.y, displayUnit)
      : '—';

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
      {result && unplacedN > 0 && (
        <div className="statusbar-item statusbar-item--warn" title="未排入画布的对象数量">
          未排入 {unplacedN}
        </div>
      )}
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
      {(editorWorkMode === 'layout' || editorWorkMode === 'resources') && (
        <>
          <div className="statusbar-item statusbar-item--mono" title="画布坐标（毫米）">
            指针 {pointerLabel}
          </div>
          <div className="statusbar-item statusbar-item--mono">缩放 {Math.round(zoom * 100)}%</div>
        </>
      )}
      {isComputing && (
        <div className="statusbar-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>排版 {Math.round(layoutProgress)}%</span>
          <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={cancelLayoutJob}>
            取消
          </button>
        </div>
      )}
      <div
        className="statusbar-item"
        style={{
          color:
            saveStatus === 'error'
              ? 'var(--danger)'
              : saveStatus === 'saving'
                ? 'var(--text-secondary)'
                : saveStatus === 'saved'
                  ? 'var(--success)'
                  : undefined,
        }}
      >
        {saveStatus === 'saving'
          ? '保存中...'
          : saveStatus === 'saved'
            ? '已保存'
            : saveStatus === 'error'
              ? '保存失败'
              : ''}
      </div>
      <div className="statusbar-item">PrintNest Pro v2</div>
    </div>
  );
};
