import React, { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { LayoutValidationIssue } from '../../../shared/types';

type SevFilter = 'all' | 'error' | 'warning';

export const ValidationPanel: React.FC = () => {
  const { result, setActiveCanvas, setSelectedIds, focusRectInCanvas } = useAppStore();
  const [sev, setSev] = useState<SevFilter>('all');

  const issues = result?.validation?.issues ?? [];

  const filtered = useMemo(() => {
    if (sev === 'all') return issues;
    if (sev === 'error') return issues.filter((i) => i.severity === 'error');
    return issues.filter((i) => i.severity !== 'error');
  }, [issues, sev]);

  const jumpToValidationIssue = useCallback(
    (issue: LayoutValidationIssue) => {
      if (!result) return;
      setActiveCanvas(issue.canvasIndex);
      const canvas = result.canvases[issue.canvasIndex];
      if (!canvas) return;
      const ids = issue.placementIds ?? [];
      setSelectedIds(ids);
      if (ids.length === 0) return;
      const placements = canvas.placements.filter((p) => ids.includes(p.id));
      if (placements.length === 0) return;
      const minX = Math.min(...placements.map((p) => p.x));
      const minY = Math.min(...placements.map((p) => p.y));
      const maxX = Math.max(...placements.map((p) => p.x + p.width));
      const maxY = Math.max(...placements.map((p) => p.y + p.height));
      focusRectInCanvas(
        { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        { mode: 'center', paddingMm: 8 },
      );
    },
    [result, setActiveCanvas, setSelectedIds, focusRectInCanvas],
  );

  const errN = issues.filter((i) => i.severity === 'error').length;
  const warnN = issues.length - errN;

  return (
    <div className="panel-validation">
      <div className="panel-validation__filters">
        <button type="button" className={`panel-tab${sev === 'all' ? ' active' : ''}`} onClick={() => setSev('all')}>
          全部 ({issues.length})
        </button>
        <button type="button" className={`panel-tab${sev === 'error' ? ' active' : ''}`} onClick={() => setSev('error')}>
          错误 ({errN})
        </button>
        <button type="button" className={`panel-tab${sev === 'warning' ? ' active' : ''}`} onClick={() => setSev('warning')}>
          提示 ({warnN})
        </button>
      </div>
      <div className="sidebar-list sidebar-list--validation">
        {!result?.validation || issues.length === 0 ? (
          <div className="empty-state" style={{ height: 160 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>暂无校验问题</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ height: 120 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>该分类下无条目</div>
          </div>
        ) : (
          <ul className="validation-issue-list">
            {filtered.map((issue, idx) => (
              <li key={`${issue.kind}-${idx}`}>
                <button type="button" className="validation-issue-row" onClick={() => jumpToValidationIssue(issue)}>
                  <span className={`validation-issue-sev validation-issue-sev--${issue.severity}`}>
                    {issue.severity === 'error' ? '错误' : '提示'}
                  </span>
                  <span className="validation-issue-msg">{issue.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
