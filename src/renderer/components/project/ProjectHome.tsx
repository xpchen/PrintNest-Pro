/**
 * 轻量项目首页：新建 / 打开最近 / 删除 / 进入编辑器（摘要卡片 + 打开项目目录）
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { SerializedEditorState } from '../../../shared/persistence/editorState';
import { showToast } from '../../utils/toast';

const LAST_KEY = 'printnest:lastProjectId';

export type ProjectHomeProps = {
  onEnteredEditor: () => void;
};

type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  canvasW: number;
  canvasH: number;
  placementCount: number;
  lastRunUtil: number | null;
  lastRunAt: string | null;
  fingerprint: string;
};

function randomProjectId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const ProjectHome: React.FC<ProjectHomeProps> = ({ onEnteredEditor }) => {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [idFallback, setIdFallback] = useState<string[]>([]);
  const hydrateFromEditorState = useAppStore((s) => s.hydrateFromEditorState);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);

  const refreshList = useCallback(async () => {
    const api = window.electronAPI;
    if (api?.listProjectSummaries) {
      const list = await api.listProjectSummaries();
      setSummaries(list);
      setIdFallback([]);
      return;
    }
    if (api?.listProjects) {
      const list = await api.listProjects();
      setIdFallback(list);
      setSummaries([]);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const openProject = useCallback(
    async (projectId: string) => {
      const api = window.electronAPI;
      if (!api?.loadProject) return;
      const raw = await api.loadProject(projectId);
      if (!raw) return;
      const data = raw as SerializedEditorState;
      setCurrentProjectId(projectId);
      hydrateFromEditorState(data);
      try {
        localStorage.setItem(LAST_KEY, projectId);
      } catch {
        /* ignore */
      }
      onEnteredEditor();
    },
    [hydrateFromEditorState, setCurrentProjectId, onEnteredEditor],
  );

  const openProjectFolder = useCallback(async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const api = window.electronAPI;
    if (!api?.openProjectFolder) {
      showToast('当前环境无法打开文件夹');
      return;
    }
    const ok = await api.openProjectFolder(projectId);
    if (!ok) showToast('打开文件夹失败');
  }, []);

  const handleNew = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.createProject) return;
    const id = randomProjectId();
    await api.createProject(id);
    await openProject(id);
    void refreshList();
  }, [openProject, refreshList]);

  const allIds = summaries.length > 0 ? summaries.map((s) => s.id) : idFallback;

  const handleOpenLast = useCallback(async () => {
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_KEY);
    } catch {
      /* ignore */
    }
    if (last && allIds.includes(last)) {
      await openProject(last);
      return;
    }
    if (allIds.length > 0) await openProject(allIds[0]);
  }, [allIds, openProject]);

  const handleDelete = useCallback(
    async (projectId: string) => {
      const api = window.electronAPI;
      if (!api?.deleteProject) return;
      if (!window.confirm(`确定删除项目「${projectId}」？此操作不可恢复。`)) return;
      await api.deleteProject(projectId);
      try {
        if (localStorage.getItem(LAST_KEY) === projectId) localStorage.removeItem(LAST_KEY);
      } catch {
        /* ignore */
      }
      void refreshList();
    },
    [refreshList],
  );

  const hasList = summaries.length > 0 || idFallback.length > 0;

  return (
    <div className="project-home">
      <div className="project-home-card">
        <h1 className="project-home-title">PrintNest Pro</h1>
        <p className="project-home-sub">选择或新建项目以开始排版</p>
        <div className="project-home-actions">
          <button type="button" className="btn btn-primary" onClick={() => void handleNew()}>
            新建项目
          </button>
          <button type="button" className="btn" onClick={() => void handleOpenLast()}>
            打开最近
          </button>
        </div>
        <h2 className="project-home-list-title">最近项目</h2>
        {!hasList ? (
          <p className="project-home-empty">暂无项目，请先新建</p>
        ) : summaries.length > 0 ? (
          <ul className="project-home-cards">
            {summaries.map((s) => (
              <li key={s.id} className="project-home-card-item">
                <button type="button" className="project-home-card-main" onClick={() => void openProject(s.id)}>
                  <span className="project-home-card-name">{s.name}</span>
                  <span className="project-home-card-id">{s.id}</span>
                  <span className="project-home-card-meta">
                    画布 {s.canvasW}×{s.canvasH} mm · 落位 {s.placementCount}
                    {s.lastRunUtil != null && (
                      <> · 最近 run {(s.lastRunUtil * 100).toFixed(1)}%</>
                    )}
                  </span>
                  <span className="project-home-card-fp">{s.fingerprint}</span>
                  <span className="project-home-card-time">
                    更新 {s.updatedAt.replace('T', ' ').slice(0, 19)}
                  </span>
                </button>
                <div className="project-home-card-actions">
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={(e) => void openProjectFolder(e, s.id)}
                  >
                    打开目录
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-ghost"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => void handleDelete(s.id)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="project-home-list">
            {idFallback.map((id) => (
              <li key={id} className="project-home-row">
                <button type="button" className="project-home-open" onClick={() => void openProject(id)}>
                  {id}
                </button>
                <button type="button" className="btn" style={{ fontSize: 11 }} onClick={(e) => void openProjectFolder(e, id)}>
                  目录
                </button>
                <button type="button" className="btn btn-danger-ghost" onClick={() => void handleDelete(id)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export function readLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function rememberLastProjectId(projectId: string): void {
  try {
    localStorage.setItem(LAST_KEY, projectId);
  } catch {
    /* ignore */
  }
}
