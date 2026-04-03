/**
 * 轻量项目首页：新建 / 打开最近 / 删除 / 进入编辑器
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { SerializedEditorState } from '../../../shared/persistence/editorState';

const LAST_KEY = 'printnest:lastProjectId';

export type ProjectHomeProps = {
  onEnteredEditor: () => void;
};

function randomProjectId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const ProjectHome: React.FC<ProjectHomeProps> = ({ onEnteredEditor }) => {
  const [ids, setIds] = useState<string[]>([]);
  const hydrateFromEditorState = useAppStore((s) => s.hydrateFromEditorState);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);

  const refreshList = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.listProjects) return;
    const list = await api.listProjects();
    setIds(list);
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

  const handleNew = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.createProject) return;
    const id = randomProjectId();
    await api.createProject(id);
    await openProject(id);
    void refreshList();
  }, [openProject, refreshList]);

  const handleOpenLast = useCallback(async () => {
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_KEY);
    } catch {
      /* ignore */
    }
    if (last && ids.includes(last)) {
      await openProject(last);
      return;
    }
    if (ids.length > 0) await openProject(ids[0]);
  }, [ids, openProject]);

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
        {ids.length === 0 ? (
          <p className="project-home-empty">暂无项目，请先新建</p>
        ) : (
          <ul className="project-home-list">
            {ids.map((id) => (
              <li key={id} className="project-home-row">
                <button type="button" className="project-home-open" onClick={() => void openProject(id)}>
                  {id}
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
