import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { RightDockTab } from '../../store/types';
import { DockRail } from './DockRail';
import { Inspector } from '../Inspector';
import { ProjectSummaryPanel } from '../panels/ProjectSummaryPanel';
import { CanvasSummaryPanel } from '../panels/CanvasSummaryPanel';

export const RightDock: React.FC = () => {
  const rightDockCollapsed = useAppStore((s) => s.rightDockCollapsed);
  const toggleRightDock = useAppStore((s) => s.toggleRightDock);
  const rightTab = useAppStore((s) => s.rightTab);
  const setRightTab = useAppStore((s) => s.setRightTab);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const result = useAppStore((s) => s.result);
  const activeCanvasIndex = useAppStore((s) => s.activeCanvasIndex);

  const currentCanvas = result?.canvases[activeCanvasIndex];
  const selCount = currentCanvas ? currentCanvas.placements.filter((p) => selectedIds.includes(p.id)).length : 0;

  const [peek, setPeek] = useState(false);
  const onRailEnter = useCallback(() => {
    if (rightDockCollapsed) setPeek(true);
  }, [rightDockCollapsed]);
  const onRailLeave = useCallback(() => {
    setPeek(false);
  }, []);

  const tabs = [
    { id: 'properties' as const, label: '属性', short: '性', badge: selCount > 0 ? selCount : undefined },
    { id: 'project' as const, label: '项目', short: '项', badge: undefined },
    { id: 'canvas' as const, label: '画布', short: '布', badge: undefined },
  ];

  const expanded = !rightDockCollapsed || peek;
  const showPanel = expanded;

  return (
    <aside
      className={`right-dock${rightDockCollapsed && !peek ? ' is-collapsed' : ''}${peek && rightDockCollapsed ? ' is-peek' : ''}`}
      onMouseLeave={() => {
        if (rightDockCollapsed) setPeek(false);
      }}
    >
      <div className="right-dock__inner">
        {showPanel && (
          <div className="right-dock__panel pn-z-dock-panel">
            {rightTab === 'properties' &&
              (selCount > 0 ? (
                <Inspector />
              ) : (
                <div className="inspector dock-inspector-placeholder">
                  <div className="inspector-title">概览</div>
                  <ProjectSummaryPanel />
                  <div className="dock-inspector-placeholder__sep" />
                  <CanvasSummaryPanel />
                  <div className="panel-summary__hint" style={{ padding: '12px 16px' }}>
                    选中画布上的对象后，在此查看与编辑属性。
                  </div>
                </div>
              ))}
            {rightTab === 'project' && (
              <div className="inspector">
                <div className="inspector-title">项目摘要</div>
                <ProjectSummaryPanel />
              </div>
            )}
            {rightTab === 'canvas' && (
              <div className="inspector">
                <div className="inspector-title">当前画布</div>
                <CanvasSummaryPanel />
              </div>
            )}
          </div>
        )}
        <div onMouseEnter={onRailEnter} onMouseLeave={onRailLeave}>
          <DockRail
            side="right"
            tabs={tabs}
            activeId={rightTab}
            onSelect={(id) => setRightTab(id as RightDockTab)}
            collapsed={rightDockCollapsed}
            onToggleCollapse={toggleRightDock}
          />
        </div>
      </div>
    </aside>
  );
};
