import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { SerializedEditorState } from '../../shared/persistence/editorState';
import { readLastProjectId, rememberLastProjectId } from '../components/project/ProjectHome';
import { showToast } from '../utils/toast';

function randomProjectId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useToolbarProjectMenu() {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const hydrateFromEditorState = useAppStore((s) => s.hydrateFromEditorState);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const resetWorkspaceToEmpty = useAppStore((s) => s.resetWorkspaceToEmpty);
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [projectMenuOpen]);

  const handleProjectNew = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.createProject || !api.loadProject) {
      showToast('仅桌面端支持项目管理');
      return;
    }
    const id = randomProjectId();
    await api.createProject(id);
    const raw = await api.loadProject(id);
    if (!raw) {
      showToast('创建项目失败');
      return;
    }
    setCurrentProjectId(id);
    hydrateFromEditorState(raw as SerializedEditorState);
    rememberLastProjectId(id);
    setProjectMenuOpen(false);
    showToast('已新建项目');
  }, [hydrateFromEditorState, setCurrentProjectId]);

  const handleProjectOpenRecent = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.listProjects || !api.loadProject) return;
    const list = await api.listProjects();
    const last = readLastProjectId();
    const pick = last && list.includes(last) ? last : list[0];
    if (!pick) {
      showToast('暂无项目');
      return;
    }
    const raw = await api.loadProject(pick);
    if (!raw) {
      showToast('打开失败');
      return;
    }
    setCurrentProjectId(pick);
    hydrateFromEditorState(raw as SerializedEditorState);
    rememberLastProjectId(pick);
    setProjectMenuOpen(false);
  }, [hydrateFromEditorState, setCurrentProjectId]);

  const handleProjectSaveAs = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.duplicateProject || !api.loadProject) {
      showToast('另存为仅在桌面端可用');
      return;
    }
    const dest = window.prompt('新项目目录 ID（仅字母数字下划线）', `${currentProjectId}_copy`);
    if (!dest || !dest.trim()) return;
    const destId = dest.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const ok = await api.duplicateProject(currentProjectId, destId);
    if (!ok) {
      showToast('另存为失败');
      return;
    }
    const raw = await api.loadProject(destId);
    if (!raw) {
      showToast('打开副本失败');
      return;
    }
    setCurrentProjectId(destId);
    hydrateFromEditorState(raw as SerializedEditorState);
    rememberLastProjectId(destId);
    setProjectMenuOpen(false);
    showToast('已另存为并切换到新项目');
  }, [currentProjectId, hydrateFromEditorState, setCurrentProjectId]);

  const handleProjectClose = useCallback(() => {
    resetWorkspaceToEmpty();
    setProjectMenuOpen(false);
    showToast('已关闭项目');
  }, [resetWorkspaceToEmpty]);

  return {
    projectMenuOpen,
    setProjectMenuOpen,
    projectMenuRef,
    handleProjectNew,
    handleProjectOpenRecent,
    handleProjectSaveAs,
    handleProjectClose,
  };
}
