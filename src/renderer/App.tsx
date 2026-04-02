/**
 * PrintNest Pro - 主应用组件
 * 五区布局：Toolbar | Sidebar | CanvasArea | Inspector | StatusBar
 */
import React, { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { CanvasArea } from './components/CanvasArea';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { useAppStore } from './store/useAppStore';

export const App: React.FC = () => {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.autoSaveProject) return;
    const tick = window.setInterval(() => {
      const s = useAppStore.getState();
      if (s.items.length === 0 && !s.result) return;
      void api.autoSaveProject!(s.currentProjectId, {
        items: s.items,
        config: s.config,
        result: s.result,
      });
    }, 45000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-body">
        <Sidebar />
        <CanvasArea />
        <Inspector />
      </div>
      <StatusBar />
    </div>
  );
};
