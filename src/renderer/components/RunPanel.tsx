/**
 * 左侧 Run 工作台：列出 layout_runs，支持恢复为新草稿与配置指纹展示。
 */
import React, { useCallback, useEffect, useState } from 'react';
import type { LayoutConfig, LayoutResult } from '../../shared/types';
import { summarizeLayoutConfigFingerprint } from '../../shared/layoutConfigFingerprint';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../utils/toast';

function fingerprintFromSnapshot(json: string): string {
  try {
    return summarizeLayoutConfigFingerprint(JSON.parse(json) as LayoutConfig);
  } catch {
    return '—';
  }
}

export const RunPanel: React.FC = () => {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const items = useAppStore((s) => s.items);
  const restoreRunAsNewDraft = useAppStore((s) => s.restoreRunAsNewDraft);
  const lastLayoutRunId = useAppStore((s) => s.lastLayoutRunId);

  const [runs, setRuns] = useState<
    Array<{
      id: string;
      created_at: string;
      duration_ms: number;
      utilization: number;
      unplaced_count: number;
      canvas_count: number;
      config_snapshot_json: string;
      placement_count?: number;
    }>
  >([]);

  const refresh = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.listLayoutRuns) {
      setRuns([]);
      return;
    }
    const list = await api.listLayoutRuns(currentProjectId);
    setRuns(list);
  }, [currentProjectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exportRunPdf = useCallback(
    async (runId: string) => {
      const api = window.electronAPI;
      if (!api?.exportPdfHistoricalRun || !api?.saveFile) {
        showToast('导出不可用');
        return;
      }
      const isPdfOk = await api.isPdfAvailable?.();
      if (!isPdfOk) {
        showToast('PDFKit 未安装');
        return;
      }
      const outputPath = await api.saveFile(`PrintNest_run_${runId.slice(0, 8)}.pdf`, 'PDF', ['pdf']);
      if (!outputPath) return;
      const res = await api.exportPdfHistoricalRun({
        projectId: currentProjectId,
        layoutRunId: runId,
        outputPath,
      });
      showToast(res.success ? 'PDF 已导出' : `导出失败: ${res.error ?? ''}`);
    },
    [currentProjectId],
  );

  const restore = useCallback(
    async (runId: string) => {
      if (
        !window.confirm(
          '将所选 run 恢复为新的当前草稿：会替换当前排版结果与配置快照，并清空手工编辑记录。未自动保存的修改仍可通过自动保存/历史文件找回。确定继续？',
        )
      ) {
        return;
      }
      const api = window.electronAPI;
      if (!api?.getRunRestorePayload) {
        showToast('当前环境不支持恢复 run');
        return;
      }
      const payload = await api.getRunRestorePayload(currentProjectId, runId, items);
      if (!payload) {
        showToast('无法读取该 run（可能缺少 run_placements）');
        return;
      }
      restoreRunAsNewDraft({
        result: payload.result as LayoutResult,
        config: payload.config as LayoutConfig,
        layoutRunId: runId,
      });
      showToast('已恢复为新草稿');
      void refresh();
    },
    [currentProjectId, items, refresh, restoreRunAsNewDraft],
  );

  if (!window.electronAPI?.listLayoutRuns) {
    return (
      <div className="run-panel run-panel--empty">
        <p className="run-panel__hint">Run 列表仅在桌面端可用。</p>
      </div>
    );
  }

  return (
    <div className="run-panel">
      <div className="run-panel__toolbar">
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => void refresh()}>
          刷新
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: 12 }}
          onClick={() => useAppStore.getState().requestExportCurrentPdf()}
        >
          导出当前排版 PDF
        </button>
      </div>
      {runs.length === 0 ? (
        <p className="run-panel__hint">暂无排版记录，请先执行自动排版。</p>
      ) : (
        <ul className="run-panel__list">
          {runs.map((r) => (
            <li key={r.id} className="run-panel__item">
              <div className="run-panel__title">
                <code className="run-panel__id">{r.id.slice(0, 8)}…</code>
                {r.id === lastLayoutRunId && <span className="run-panel__badge">当前会话</span>}
              </div>
              <div className="run-panel__meta">
                {(r.utilization * 100).toFixed(1)}% 利用 · {r.placement_count ?? '—'} 落位 · {r.canvas_count}{' '}
                画布 · {Math.round(r.duration_ms)} ms
              </div>
              <div className="run-panel__fp" title={r.config_snapshot_json}>
                {fingerprintFromSnapshot(r.config_snapshot_json)}
              </div>
              <div className="run-panel__time">{r.created_at.replace('T', ' ').slice(0, 19)}</div>
              <div className="run-panel__actions">
                <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => void exportRunPdf(r.id)}>
                  导出此 Run PDF
                </button>
                <button type="button" className="btn btn-primary run-panel__restore" onClick={() => void restore(r.id)}>
                  恢复为新草稿
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
