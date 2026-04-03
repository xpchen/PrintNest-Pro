/**
 * 项目级操作：供菜单 commandRegistry 与 Toolbar 共用
 */
import { useAppStore } from '../store/useAppStore';
import type { SerializedEditorState } from '../../shared/persistence/editorState';
import { readLastProjectId, rememberLastProjectId } from '../components/project/ProjectHome';
import { showToast } from '../utils/toast';

function randomProjectId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createAndOpenNewProject(): Promise<void> {
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
  useAppStore.getState().setCurrentProjectId(id);
  useAppStore.getState().hydrateFromEditorState(raw as SerializedEditorState);
  rememberLastProjectId(id);
  showToast('已新建项目');
}

export async function openRecentProject(): Promise<void> {
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
  useAppStore.getState().setCurrentProjectId(pick);
  useAppStore.getState().hydrateFromEditorState(raw as SerializedEditorState);
  rememberLastProjectId(pick);
}

export async function openCurrentProjectFolder(): Promise<void> {
  const api = window.electronAPI as { openProjectFolder?: (id: string) => Promise<boolean> };
  const id = useAppStore.getState().currentProjectId;
  if (!api?.openProjectFolder) {
    showToast('当前环境不支持');
    return;
  }
  const ok = await api.openProjectFolder(id);
  if (!ok) showToast('无法打开文件夹');
}
