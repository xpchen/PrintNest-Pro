/**
 * PrintNest Pro - 主应用组件
 * 五区布局：Toolbar | Sidebar | CanvasArea | Inspector | StatusBar
 * Electron：首启尝试恢复上次项目，否则进入轻首页；自动保存为防抖 + DB 权威。
 */
import React, { useEffect, useRef } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { CanvasArea } from './components/CanvasArea';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { ProjectHome, readLastProjectId } from './components/project/ProjectHome';
import { useAppStore } from './store/useAppStore';
import type { SerializedEditorState } from '../shared/persistence/editorState';
import { dispatchAppCommand } from './commands/commandRegistry';

export const App: React.FC = () => {
  const uiPhase = useAppStore((s) => s.uiPhase);
  const leftPanelVisible = useAppStore((s) => s.leftPanelVisible);
  const rightPanelVisible = useAppStore((s) => s.rightPanelVisible);
  const statusBarVisible = useAppStore((s) => s.statusBarVisible);
  const saveTimerRef = useRef<number | undefined>(undefined);

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

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.autoSaveProject) return;

    const flush = () => {
      const s = useAppStore.getState();
      if (s.uiPhase === 'home') return;
      if (!s.config) return;
      void api.autoSaveProject!(s.currentProjectId, {
        projectName: s.projectName,
        items: s.items,
        config: s.config,
        result: s.result,
        layoutSourceSignature: s.layoutSourceSignature,
        manualEdits: s.manualEdits,
      });
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
        state.manualEdits !== prev.manualEdits
      ) {
        schedule();
      }
    });

    return () => {
      unsub();
      if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (uiPhase === 'home') {
    return <ProjectHome onEnteredEditor={() => undefined} />;
  }

  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-body">
        {leftPanelVisible && <Sidebar />}
        <CanvasArea />
        {rightPanelVisible && <Inspector />}
      </div>
      {statusBarVisible && <StatusBar />}
    </div>
  );
};
