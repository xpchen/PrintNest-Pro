import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../utils/toast';
import { useToolbarProjectMenu } from '../../hooks/useToolbarProjectMenu';
import { useEditorChrome } from './EditorChromeContext';

export const AppTopBar: React.FC = () => {
  const projectName = useAppStore((s) => s.projectName);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
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
    requestExportHistoricalPdf,
    handleLayout,
    isComputing,
  } = useEditorChrome();

  const [exportOpen, setExportOpen] = useState(false);

  const closeExport = useCallback(() => setExportOpen(false), []);

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
      </div>

      <div className="shell-topbar__center" title={`${currentProjectId}`}>
        <span className="shell-topbar__brand">PrintNest Pro</span>
        <span className="shell-topbar__sep">/</span>
        <span className="shell-topbar__project">{projectName || '未命名项目'}</span>
      </div>

      <div className="shell-topbar__right">
        <div className="shell-topbar__group">
          <button type="button" className="btn btn-shell" onClick={() => setExportOpen((v) => !v)}>
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
                导出 PNG（当前画布）
              </button>
              <button
                type="button"
                className="shell-dropdown__item"
                onClick={() => {
                  closeExport();
                  void handleExportPdf();
                }}
              >
                导出 PDF（当前排版）
              </button>
              <button
                type="button"
                className="shell-dropdown__item"
                onClick={() => {
                  closeExport();
                  useAppStore.getState().requestExportCurrentPdf();
                }}
              >
                PDF（当前 Run · 与菜单一致）
              </button>
              <button
                type="button"
                className="shell-dropdown__item"
                onClick={() => {
                  closeExport();
                  requestExportHistoricalPdf();
                }}
              >
                PDF（最近落库 Run）
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
