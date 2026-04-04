/**
 * 输出中心 — 导出预设、预飞检查、画布缩略图、导出历史
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PreflightChecklist } from './PreflightChecklist';

/* ── 类型 ── */
interface ExportProfile {
  id: string;
  name: string;
  mode: string;
  includeCropMarks: boolean;
  includeBleed: boolean;
  safeMarginMm: number;
  outputFormat: string;
  namingPattern: string | null;
  createdAt: string;
}

interface ExportHistoryEntry {
  id: string;
  profileId: string | null;
  runId: string | null;
  outputPath: string;
  format: string;
  createdAt: string;
  fileSizeBytes: number | null;
  canvasCount: number | null;
  status: string;
}

function genId(): string {
  return crypto.randomUUID();
}

/* ── 导出预设面板 ── */
const ExportPresetPanel: React.FC<{
  profiles: ExportProfile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}> = ({ profiles, selectedId, onSelect, onAdd, onDelete }) => (
  <div className="oc-presets">
    <div className="oc-presets__header">
      <span className="oc-presets__title">导出预设</span>
      <button className="oc-presets__add" onClick={onAdd} title="新建预设">+</button>
    </div>
    {profiles.length === 0 ? (
      <div className="oc-presets__empty">无预设，点击 + 新建</div>
    ) : (
      <ul className="oc-presets__list">
        {profiles.map((p) => (
          <li
            key={p.id}
            className={`oc-presets__item ${selectedId === p.id ? 'oc-presets__item--active' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <span className="oc-presets__item-name">{p.name}</span>
            <span className="oc-presets__item-fmt">{p.outputFormat.toUpperCase()}</span>
            <button
              className="oc-presets__item-del"
              onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
              title="删除"
            >×</button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

/* ── 画布缩略图网格 ── */
const CanvasThumbnails: React.FC = () => {
  const result = useAppStore((s) => s.result);
  const config = useAppStore((s) => s.config);
  if (!result || result.canvases.length === 0) {
    return <div className="oc-thumbs__empty">无排版结果</div>;
  }
  const canvasW = config.canvas.width;
  const canvasH = config.canvas.height;
  const aspect = canvasH / canvasW;
  return (
    <div className="oc-thumbs">
      {result.canvases.map((c, i) => (
        <div key={i} className="oc-thumbs__card">
          <div className="oc-thumbs__preview" style={{ paddingBottom: `${aspect * 100}%` }}>
            <div className="oc-thumbs__label">画布 {i + 1}</div>
          </div>
          <div className="oc-thumbs__info">
            {canvasW}×{canvasH}mm · {c.placements.length} 件
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── 导出历史面板 ── */
const ExportHistoryPanel: React.FC<{ entries: ExportHistoryEntry[] }> = ({ entries }) => (
  <div className="oc-history">
    <div className="oc-history__title">导出历史</div>
    {entries.length === 0 ? (
      <div className="oc-history__empty">暂无导出记录</div>
    ) : (
      <ul className="oc-history__list">
        {entries.map((e) => (
          <li key={e.id} className="oc-history__item">
            <span className={`oc-history__status oc-history__status--${e.status}`}>
              {e.status === 'success' ? 'OK' : 'FAIL'}
            </span>
            <span className="oc-history__path" title={e.outputPath}>
              {e.outputPath.split('/').pop()}
            </span>
            <span className="oc-history__time">
              {new Date(e.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

/* ── 历史排版 Run 列表 ── */
interface LayoutRunRow {
  id: string;
  created_at: string;
  duration_ms: number;
  utilization: number;
  unplaced_count: number;
  canvas_count: number;
  placement_count?: number;
}

const HistoryRunPanel: React.FC<{
  runs: LayoutRunRow[];
  selectedRunId: string | null;
  onSelect: (id: string | null) => void;
}> = ({ runs, selectedRunId, onSelect }) => (
  <div className="oc-runs">
    <div className="oc-runs__title">历史排版</div>
    {runs.length === 0 ? (
      <div className="oc-runs__empty">暂无历史排版</div>
    ) : (
      <ul className="oc-runs__list">
        <li
          className={`oc-runs__item ${selectedRunId === null ? 'oc-runs__item--active' : ''}`}
          onClick={() => onSelect(null)}
        >
          <span className="oc-runs__item-label">当前结果</span>
        </li>
        {runs.map((r) => (
          <li
            key={r.id}
            className={`oc-runs__item ${selectedRunId === r.id ? 'oc-runs__item--active' : ''}`}
            onClick={() => onSelect(r.id)}
          >
            <span className="oc-runs__item-time">
              {new Date(r.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="oc-runs__item-stats">
              {r.canvas_count}版 · {r.placement_count ?? '?'}件 · {Math.round(r.utilization)}%
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

/* ── OutputCenter 主组件 ── */
export const OutputCenter: React.FC = () => {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const result = useAppStore((s) => s.result);
  const config = useAppStore((s) => s.config);

  const [profiles, setProfiles] = useState<ExportProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [history, setHistory] = useState<ExportHistoryEntry[]>([]);
  const [runs, setRuns] = useState<LayoutRunRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const api = window.electronAPI;

  // 加载预设、历史和排版 run 列表
  useEffect(() => {
    if (!currentProjectId || !api) return;
    api.listExportProfiles?.(currentProjectId).then((ps) => {
      const typed = ps as ExportProfile[];
      setProfiles(typed);
      if (typed.length > 0 && !selectedProfileId) setSelectedProfileId(typed[0].id);
    });
    api.listExportHistory?.(currentProjectId, 20).then((hs) => setHistory(hs as ExportHistoryEntry[]));
    api.listLayoutRuns?.(currentProjectId).then((rs) => setRuns((rs as LayoutRunRow[]) ?? []));
  }, [currentProjectId]);

  const handleAddProfile = useCallback(async () => {
    if (!currentProjectId || !api?.saveExportProfile) return;
    const p: ExportProfile = {
      id: genId(),
      name: `预设 ${profiles.length + 1}`,
      mode: 'production',
      includeCropMarks: true,
      includeBleed: true,
      safeMarginMm: 0,
      outputFormat: 'pdf',
      namingPattern: null,
      createdAt: new Date().toISOString(),
    };
    await api.saveExportProfile(currentProjectId, p);
    setProfiles((prev) => [p, ...prev]);
    setSelectedProfileId(p.id);
  }, [currentProjectId, profiles.length, api]);

  const showConfirm = useAppStore((s) => s.showConfirm);

  const handleDeleteProfile = useCallback(async (id: string) => {
    if (!currentProjectId || !api?.deleteExportProfile) return;
    const confirmed = await showConfirm({
      title: '删除导出预设',
      message: '确定要删除该导出预设吗？',
      confirmLabel: '删除',
      danger: true,
    });
    if (!confirmed) return;
    await api.deleteExportProfile(currentProjectId, id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (selectedProfileId === id) setSelectedProfileId(null);
  }, [currentProjectId, selectedProfileId, api, showConfirm]);

  const handleExportAll = useCallback(async () => {
    if (!api) return;

    // 历史 run 导出
    if (selectedRunId) {
      const items = useAppStore.getState().items;
      const payload = await api.getRunRestorePayload?.(currentProjectId, selectedRunId, items);
      if (!payload || !(payload as { result?: unknown }).result) return;
      const restored = payload as { result: { canvases: typeof result extends null ? never : NonNullable<typeof result>['canvases'] }; config: { canvas: { width: number; height: number } } };
      const outPath = await api.saveFile(`PrintNest-Run-${selectedRunId.slice(0, 8)}.pdf`, 'PDF', ['pdf']);
      if (!outPath) return;
      setExporting(true);
      try {
        const res = await api.exportPdf({
          canvases: restored.result.canvases,
          config: { widthMm: restored.config.canvas.width, heightMm: restored.config.canvas.height },
          outputPath: outPath,
        });
        if (currentProjectId && api.recordExportHistory) {
          const entry: ExportHistoryEntry = {
            id: genId(), profileId: selectedProfileId, runId: selectedRunId,
            outputPath: outPath, format: 'pdf', createdAt: new Date().toISOString(),
            fileSizeBytes: null, canvasCount: restored.result.canvases.length,
            status: res.success ? 'success' : 'failed',
          };
          await api.recordExportHistory(currentProjectId, entry);
          setHistory((prev) => [entry, ...prev]);
        }
      } finally {
        setExporting(false);
      }
      return;
    }

    // 当前结果导出
    if (!result || result.canvases.length === 0) return;
    const outPath = await api.saveFile('PrintNest-Output.pdf', 'PDF', ['pdf']);
    if (!outPath) return;

    setExporting(true);
    try {
      const res = await api.exportPdf({
        canvases: result.canvases,
        config: { widthMm: config.canvas.width, heightMm: config.canvas.height },
        outputPath: outPath,
      });

      if (currentProjectId && api.recordExportHistory) {
        const entry: ExportHistoryEntry = {
          id: genId(), profileId: selectedProfileId, runId: null,
          outputPath: outPath, format: 'pdf', createdAt: new Date().toISOString(),
          fileSizeBytes: null, canvasCount: result.canvases.length,
          status: res.success ? 'success' : 'failed',
        };
        await api.recordExportHistory(currentProjectId, entry);
        setHistory((prev) => [entry, ...prev]);
      }
    } finally {
      setExporting(false);
    }
  }, [api, result, config, currentProjectId, selectedProfileId, selectedRunId]);

  return (
    <div className="output-center">
      <div className="output-center__left">
        <ExportPresetPanel
          profiles={profiles}
          selectedId={selectedProfileId}
          onSelect={setSelectedProfileId}
          onAdd={handleAddProfile}
          onDelete={handleDeleteProfile}
        />
        <HistoryRunPanel
          runs={runs}
          selectedRunId={selectedRunId}
          onSelect={setSelectedRunId}
        />
        <PreflightChecklist />
      </div>
      <div className="output-center__center">
        <CanvasThumbnails />
        <div className="output-center__actions">
          <button
            className="output-center__export-btn"
            disabled={exporting || (!selectedRunId && (!result || result.canvases.length === 0))}
            onClick={handleExportAll}
          >
            {exporting ? '导出中…' : selectedRunId ? '导出历史排版 PDF' : '导出全部 PDF'}
          </button>
        </div>
      </div>
      <div className="output-center__right">
        <ExportHistoryPanel entries={history} />
      </div>
    </div>
  );
};
