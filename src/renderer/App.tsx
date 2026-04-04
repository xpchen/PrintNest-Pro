/**
 * PrintNest Pro — AppFrame：AppTopBar + Workspace(Docks + CenterStage) + StatusBar
 */
import React from 'react';
import { CanvasArea } from './components/CanvasArea';
import { CanvasHeader } from './components/canvas/CanvasHeader';
import { OverviewCard } from './components/canvas/OverviewCard';
import { StatusBar } from './components/StatusBar';
import { ProjectHome } from './components/project/ProjectHome';
import { EditorChromeProvider } from './components/shell/EditorChromeContext';
import { AppTopBar } from './components/shell/AppTopBar';
import { EditorModePlaceholder } from './components/shell/EditorModePlaceholder';
import { OutputCenter } from './components/output/OutputCenter';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ToastContainer } from './components/Toast';
import { TemplateWorkspace } from './components/template/TemplateWorkspace';
import { LeftDock } from './components/shell/LeftDock';
import { RightDock } from './components/shell/RightDock';
import { useAppStore } from './store/useAppStore';
import { useProjectBootstrap } from './hooks/useProjectBootstrap';
import { useAppCommandListener } from './hooks/useAppCommandListener';
import { useHistoryShortcuts } from './hooks/useHistoryShortcuts';
import { useProjectAutoSave } from './hooks/useProjectAutoSave';
import { useUiShellPersistence } from './hooks/useUiShellPersistence';
import { useGlobalKeyboard } from './hooks/useGlobalKeyboard';

export const App: React.FC = () => {
  const uiPhase = useAppStore((s) => s.uiPhase);
  const statusBarVisible = useAppStore((s) => s.statusBarVisible);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const editorWorkMode = useAppStore((s) => s.editorWorkMode);
  const overviewVisible = useAppStore((s) => s.overviewVisible);

  const showLayoutWorkbench = editorWorkMode === 'layout' || editorWorkMode === 'resources';

  useProjectBootstrap();
  useAppCommandListener();
  useHistoryShortcuts();
  useProjectAutoSave();
  useUiShellPersistence(currentProjectId, uiPhase);
  useGlobalKeyboard();

  if (uiPhase === 'home') {
    return (
      <>
        <ProjectHome onEnteredEditor={() => undefined} />
        <ToastContainer />
      </>
    );
  }

  return (
    <EditorChromeProvider>
      <div className="app-layout app-layout--v11">
        <AppTopBar />
        <div className="app-workspace">
          <LeftDock />
          <main className="center-stage">
            {showLayoutWorkbench ? (
              <>
                <CanvasHeader />
                <div className="center-stage__main-row">
                  <div className="center-stage__viewport-wrap">
                    <CanvasArea />
                  </div>
                  {overviewVisible ? (
                    <aside className="center-stage__overview-strip" aria-label="鹰眼导航">
                      <OverviewCard />
                    </aside>
                  ) : null}
                </div>
              </>
            ) : editorWorkMode === 'template' ? (
              <TemplateWorkspace />
            ) : editorWorkMode === 'output' ? (
              <OutputCenter />
            ) : (
              <EditorModePlaceholder mode={editorWorkMode} />
            )}
          </main>
          <RightDock />
        </div>
        {statusBarVisible && <StatusBar />}
        <ConfirmDialog />
        <ToastContainer />
      </div>
    </EditorChromeProvider>
  );
};
