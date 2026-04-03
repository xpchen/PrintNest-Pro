import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { DockRail } from './DockRail';
import { Inspector } from '../Inspector';
import { TaskSummaryInspector } from './TaskSummaryInspector';
import { IconProperties } from './ShellDockIcons';

/**
 * 右侧属性栏：不收起态悬停自动展开（避免鼠标移向窗口右缘时面板误弹出），仅点击轨上「展开」打开。
 */
export const RightDock: React.FC = () => {
  const rightDockCollapsed = useAppStore((s) => s.rightDockCollapsed);
  const toggleRightDock = useAppStore((s) => s.toggleRightDock);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const result = useAppStore((s) => s.result);
  const activeCanvasIndex = useAppStore((s) => s.activeCanvasIndex);

  const currentCanvas = result?.canvases[activeCanvasIndex];
  const selCount = currentCanvas ? currentCanvas.placements.filter((p) => selectedIds.includes(p.id)).length : 0;

  const showPanel = !rightDockCollapsed;

  const tabs = [{ id: 'properties', label: '属性', icon: <IconProperties />, badge: selCount > 0 ? selCount : undefined }];

  return (
    <aside className={`right-dock${rightDockCollapsed ? ' is-collapsed' : ''}`}>
      <div className="right-dock__inner">
        {showPanel && (
          <div className="right-dock__panel pn-z-dock-panel">
            <div className="right-dock__panel-head">属性</div>
            {selCount > 0 ? <Inspector /> : <TaskSummaryInspector />}
          </div>
        )}
        <DockRail
          side="right"
          tabs={tabs}
          activeId="properties"
          onSelect={() => undefined}
          collapsed={rightDockCollapsed}
          onToggleCollapse={toggleRightDock}
          selectionLocked
        />
      </div>
    </aside>
  );
};
