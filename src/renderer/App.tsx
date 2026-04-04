/**
 * PrintNest Pro — AppFrame：AppTopBar + Workspace(Docks + CenterStage) + StatusBar
 */
import React, { useEffect, useRef } from 'react';
import { CanvasArea } from './components/CanvasArea';
import { CanvasHeader } from './components/canvas/CanvasHeader';
import { OverviewCard } from './components/canvas/OverviewCard';
import { StatusBar } from './components/StatusBar';
import { ProjectHome, readLastProjectId } from './components/project/ProjectHome';
import { EditorChromeProvider } from './components/shell/EditorChromeContext';
import { AppTopBar } from './components/shell/AppTopBar';
import { EditorModePlaceholder } from './components/shell/EditorModePlaceholder';
import { OutputCenter } from './components/output/OutputCenter';
import { ConfirmDialog } from './components/ConfirmDialog';
import { TemplateWorkspace } from './components/template/TemplateWorkspace';
import { LeftDock } from './components/shell/LeftDock';
import { RightDock } from './components/shell/RightDock';
import { useAppStore } from './store/useAppStore';
import type { SerializedEditorState } from '../shared/persistence/editorState';
import { dispatchAppCommand } from './commands/commandRegistry';
import { loadUiShellFromStorage, persistUiShellToStorage } from './store/slices/uiShellSlice';
import { initTemplateHistorySubscription, useTemplateHistory } from './store/useTemplateHistory';

export const App: React.FC = () => {
  const uiPhase = useAppStore((s) => s.uiPhase);
  const statusBarVisible = useAppStore((s) => s.statusBarVisible);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const editorWorkMode = useAppStore((s) => s.editorWorkMode);
  const overviewVisible = useAppStore((s) => s.overviewVisible);
  const saveTimerRef = useRef<number | undefined>(undefined);

  const showLayoutWorkbench = editorWorkMode === 'layout' || editorWorkMode === 'resources';

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.loadProject || !api?.listProjects) {
      useAppStore.getState().setUiPhase('editor');
      return;
    }
    let cancelled = false;
    void (async () => {
      const list = await api.listProjects();
      const last = readLastProjectId();
      if (last && list.includes(last)) {
        const raw = await api.loadProject(last);
        if (cancelled) return;
        if (raw) {
          useAppStore.getState().setCurrentProjectId(last);
          useAppStore.getState().hydrateFromEditorState(raw as SerializedEditorState);
          return;
        }
      }
      if (!cancelled) useAppStore.getState().setUiPhase('home');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    const off = api?.onAppCommand?.((msg) => {
      dispatchAppCommand(msg.id, msg.payload);
    });
    return () => {
      off?.();
    };
  }, []);

  // 初始化模板域独立历史
  useEffect(() => {
    const unsub = initTemplateHistorySubscription();
    return () => unsub();
  }, []);

  // Ctrl+Z / Ctrl+Shift+Z 按 editorWorkMode 路由
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 输入框中不拦截
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const mode = useAppStore.getState().editorWorkMode;
        if (mode === 'template') {
          useTemplateHistory.getState().undo();
        } else {
          useAppStore.temporal.getState().undo();
        }
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'Z') {
        e.preventDefault();
        const mode = useAppStore.getState().editorWorkMode;
        if (mode === 'template') {
          useTemplateHistory.getState().redo();
        } else {
          useAppStore.temporal.getState().redo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.autoSaveProject) return;

    const flush = async () => {
      const s = useAppStore.getState();
      if (s.uiPhase === 'home') return;
      if (!s.config) return;
      useAppStore.getState().setSaveStatus('saving');
      try {
        await api.autoSaveProject!(s.currentProjectId, {
          projectName: s.projectName,
          items: s.items,
          config: s.config,
          result: s.result,
          layoutSourceSignature: s.layoutSourceSignature,
          manualEdits: s.manualEdits,
          dataRecords: s.dataRecords.length ? s.dataRecords : undefined,
          templates: s.templates.length ? s.templates : undefined,
          templateInstances: s.templateInstances.length ? s.templateInstances : undefined,
          activeTemplateId: s.currentTemplateId,
        });
        useAppStore.getState().setSaveStatus('saved');
      } catch (err) {
        useAppStore.getState().setSaveStatus('error');
        window.electronAPI?.logError?.('auto-save failed', String(err));
      }
    };

    const schedule = () => {
      if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = undefined;
        flush();
      }, 2500);
    };

    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.uiPhase === 'home') return;
      if (
        state.items !== prev.items ||
        state.config !== prev.config ||
        state.result !== prev.result ||
        state.layoutSourceSignature !== prev.layoutSourceSignature ||
        state.projectName !== prev.projectName ||
        state.currentProjectId !== prev.currentProjectId ||
        state.manualEdits !== prev.manualEdits ||
        state.dataRecords !== prev.dataRecords ||
        state.templates !== prev.templates ||
        state.templateInstances !== prev.templateInstances ||
        state.currentTemplateId !== prev.currentTemplateId
      ) {
        schedule();
      }
    });

    return () => {
      unsub();
      if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (uiPhase !== 'editor') return;
    const patch = loadUiShellFromStorage(currentProjectId);
    if (Object.keys(patch).length > 0) {
      useAppStore.setState(patch);
    }
  }, [currentProjectId, uiPhase]);

  useEffect(() => {
    let t: number | undefined;
    return useAppStore.subscribe((state) => {
      if (state.uiPhase !== 'editor') return;
      if (t !== undefined) window.clearTimeout(t);
      t = window.setTimeout(() => {
        t = undefined;
        persistUiShellToStorage(state);
      }, 400);
    });
  }, []);

  if (uiPhase === 'home') {
    return <ProjectHome onEnteredEditor={() => undefined} />;
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
      </div>
    </EditorChromeProvider>
  );
};
