import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { DockRail } from './DockRail';
import { AssetsPanel } from '../panels/AssetsPanel';
import { ValidationPanel } from '../panels/ValidationPanel';
import { RunPanel } from '../RunPanel';

export const LeftDock: React.FC = () => {
  const sidebarTab = useAppStore((s) => s.sidebarTab);
  const setSidebarTab = useAppStore((s) => s.setSidebarTab);
  const leftDockCollapsed = useAppStore((s) => s.leftDockCollapsed);
  const toggleLeftDock = useAppStore((s) => s.toggleLeftDock);
  const validationIssues = useAppStore((s) => s.result?.validation?.issues ?? []);

  const [peek, setPeek] = useState(false);

  const onRailEnter = useCallback(() => {
    if (leftDockCollapsed) setPeek(true);
  }, [leftDockCollapsed]);
  const onRailLeave = useCallback(() => {
    setPeek(false);
  }, []);

  const tabs = [
    { id: 'materials' as const, label: '素材', short: '素', badge: undefined as number | undefined },
    { id: 'validation' as const, label: '校验', short: '校', badge: validationIssues.length || undefined },
    { id: 'run' as const, label: 'Run', short: 'R', badge: undefined },
  ];

  const expanded = !leftDockCollapsed || peek;
  const showPanel = expanded;

  return (
    <aside
      className={`left-dock${leftDockCollapsed && !peek ? ' is-collapsed' : ''}${peek && leftDockCollapsed ? ' is-peek' : ''}`}
      onMouseLeave={() => {
        if (leftDockCollapsed) setPeek(false);
      }}
    >
      <div className="left-dock__inner">
        <div onMouseEnter={onRailEnter} onMouseLeave={onRailLeave}>
          <DockRail
            side="left"
            tabs={tabs}
            activeId={sidebarTab}
            onSelect={(id) => setSidebarTab(id as 'materials' | 'validation' | 'run')}
            collapsed={leftDockCollapsed}
            onToggleCollapse={toggleLeftDock}
          />
        </div>
        {showPanel && (
          <div className="left-dock__panel pn-z-dock-panel">
            {sidebarTab === 'materials' && <AssetsPanel />}
            {sidebarTab === 'validation' && <ValidationPanel />}
            {sidebarTab === 'run' && (
              <div className="left-dock__run">
                <RunPanel />
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
