import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { EditorWorkMode } from '../../store/types';
import { showToast } from '../../utils/toast';
import { useToolbarProjectMenu } from '../../hooks/useToolbarProjectMenu';
import { useEditorChrome } from './EditorChromeContext';

const WORK_MODES: { id: EditorWorkMode; label: string }[] = [
  { id: 'resources', label: '资源' },
  { id: 'template', label: '模板' },
  { id: 'layout', label: '排版' },
  { id: 'output', label: '输出' },
];

export const AppTopBar: React.FC = () => {
  const projectName = useAppStore((s) => s.projectName);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const editorWorkMode = useAppStore((s) => s.editorWorkMode);
  const setEditorWorkMode = useAppStore((s) => s.setEditorWorkMode);

  const {
    projectMenuOpen,
    setProjectMenuOpen,
    projectMenuRef,
    handleProjectNew,
    handleProjectOpenRecent,
    handleProjectSaveAs,
    handleProjectClose,
  } = useToolbarProjectMenu();

  const {
    openImportModal,
    handleImportExcel,
    handleExportPng,
    handleExportPdf,
    handleLayout,
    isComputing,
  } = useEditorChrome();

  const [exportOpen, setExportOpen] = useState(false);

  const closeExport = useCallback(() => setExportOpen(false), []);

  const onWorkMode = useCallback(
    (id: EditorWorkMode) => {
      if (id === 'template' || id === 'output') {
        setEditorWorkMode(id);
        return;
      }
      setEditorWorkMode(id);
      if (id === 'resources') {
        showToast('资源与数据请在左侧「资源与数据」中管理；画布区与排版不变。');
      }
    },
    [setEditorWorkMode],
  );

  return (
    <header className="shell-topbar">
      <div className="shell-topbar__left">
        <div className="shell-topbar__group shell-project-menu" ref={projectMenuRef}>
          <button type="button" className="btn btn-shell" onClick={() => setProjectMenuOpen((v) => !v)}>
            项目 ▾
          </button>
          {projectMenuOpen && (
            <div className="shell-dropdown pn-z-dropdown">
              <button type="button" className="shell-dropdown__item" onClick={() => void handleProjectNew()}>
                新建
              </button>
              <button type="button" className="shell-dropdown__item" onClick={() => void handleProjectOpenRecent()}>
                打开最近
              </button>
              <button type="button" className="shell-dropdown__item" onClick={() => void handleProjectSaveAs()}>
                另存为
              </button>
              <button type="button" className="shell-dropdown__item" onClick={handleProjectClose}>
                关闭（回首页）
              </button>
            </div>
          )}
        </div>
        <span className="shell-topbar__save" title="项目变更将自动写入本地">
          自动保存已开启
        </span>
        <span className="shell-topbar__project-inline" title={currentProjectId}>
          {projectName || '未命名项目'}
        </span>
      </div>

      <div className="shell-topbar__center">
        <div className="shell-segmented" role="tablist" aria-label="工作模式">
          {WORK_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={editorWorkMode === m.id}
              className={`shell-segmented__btn${editorWorkMode === m.id ? ' is-active' : ''}`}
              onClick={() => onWorkMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="shell-topbar__right">
        <button type="button" className="btn btn-shell" onClick={openImportModal}>
          导入图片
        </button>
        <button
          type="button"
          className="btn btn-shell"
          onClick={() => void handleImportExcel()}
          title="表头需含「内部单号」「尺寸」，尺寸格式 宽-高（厘米）"
        >
          导入 Excel
        </button>
        <div className="shell-topbar__group">
          <button type="button" className="btn btn-shell btn-shell--secondary" onClick={() => setExportOpen((v) => !v)}>
            导出 ▾
          </button>
          {exportOpen && (
            <div className="shell-dropdown shell-dropdown--align-right pn-z-dropdown">
              <button
                type="button"
                className="shell-dropdown__item"
                onClick={() => {
                  closeExport();
                  handleExportPng();
                }}
              >
                导出 PNG
              </button>
              <button
                type="button"
                className="shell-dropdown__item"
                onClick={() => {
                  closeExport();
                  void handleExportPdf();
                }}
              >
                导出 PDF
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-shell btn-shell--cta"
          onClick={() => void handleLayout()}
          disabled={isComputing}
        >
          {isComputing ? '排版中…' : '自动排版'}
        </button>
        <button
          type="button"
          className="btn btn-shell"
          onClick={() => showToast('快捷键：Ctrl+L 排版 · Ctrl+0 适配整张 · Ctrl+1 适应宽度')}
        >
          帮助
        </button>
      </div>
    </header>
  );
};
