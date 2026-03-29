/**
 * PrintNest Pro - 主应用组件
 * 五区布局：Toolbar | Sidebar | CanvasArea | Inspector | StatusBar
 */
import React from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { CanvasArea } from './components/CanvasArea';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';

export const App: React.FC = () => {
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
