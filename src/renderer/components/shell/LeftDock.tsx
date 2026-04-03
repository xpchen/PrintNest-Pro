import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { LeftTaskTab } from '../../store/types';
import { DockRail } from './DockRail';
import { AssetsPanel } from '../panels/AssetsPanel';
import { ValidationPanel } from '../panels/ValidationPanel';
import { RunPanel } from '../RunPanel';
import { ProjectSummaryPanel } from '../panels/ProjectSummaryPanel';
import { LayoutTaskPanel } from './LayoutTaskPanel';
import { useDockPeek } from './useDockPeek';
import { useEditorChrome } from './EditorChromeContext';
import { IconLayoutTask, IconProject, IconQaOutput, IconResources } from './ShellDockIcons';
import { formatPairMm } from '../../utils/lengthDisplay';

const SECTION_TITLES: Record<LeftTaskTab, string> = {
  project: '项目',
  resources: '资源与数据',
  layoutTask: '排版任务',
  qaOutput: '校验与输出',
};

export const LeftDock: React.FC = () => {
  const sidebarTab = useAppStore((s) => s.sidebarTab);
  const setSidebarTab = useAppStore((s) => s.setSidebarTab);
  const leftDockCollapsed = useAppStore((s) => s.leftDockCollapsed);
  const toggleLeftDock = useAppStore((s) => s.toggleLeftDock);
  const validationIssues = useAppStore((s) => s.result?.validation?.issues ?? []);
  const config = useAppStore((s) => s.config);
  const displayUnit = useAppStore((s) => s.displayUnit);

  const { handleImportExcel } = useEditorChrome();
  const { peek, dockPointerHandlers } = useDockPeek(leftDockCollapsed);

  const tabs = [
    { id: 'project' as const, label: '项目', icon: <IconProject />, badge: undefined as number | undefined },
    { id: 'resources' as const, label: '资源与数据', icon: <IconResources />, badge: undefined },
    { id: 'layoutTask' as const, label: '排版任务', icon: <IconLayoutTask />, badge: undefined },
    {
      id: 'qaOutput' as const,
      label: '校验与输出',
      icon: <IconQaOutput />,
      badge: validationIssues.length || undefined,
    },
  ];

  const expanded = !leftDockCollapsed || peek;
  const showPanel = expanded;

  return (
    <aside
      className={`left-dock${leftDockCollapsed && !peek ? ' is-collapsed' : ''}${peek && leftDockCollapsed ? ' is-peek' : ''}`}
      {...dockPointerHandlers}
    >
      <div className="left-dock__inner">
        <DockRail
          side="left"
          tabs={tabs}
          activeId={sidebarTab}
          onSelect={(id) => setSidebarTab(id as LeftTaskTab)}
          collapsed={leftDockCollapsed}
          onToggleCollapse={toggleLeftDock}
        />
        {showPanel && (
          <div className="left-dock__panel pn-z-dock-panel">
            <div className="left-dock__panel-head">{SECTION_TITLES[sidebarTab]}</div>
            <div className="left-dock__panel-body">
              {sidebarTab === 'project' && (
                <>
                  <ProjectSummaryPanel />
                  <div className="left-dock__subblock">
                    <div className="left-dock__subh">画布规格</div>
                    <div className="left-dock__subv mono">
                      {formatPairMm(config.canvas.width, config.canvas.height, displayUnit)}
                    </div>
                  </div>
                </>
              )}
              {sidebarTab === 'resources' && (
                <>
                  <div className="left-dock__data-strip">
                    <span className="left-dock__data-label">数据源</span>
                    <button type="button" className="btn btn-shell btn-shell--sm" onClick={() => void handleImportExcel()}>
                      导入 Excel
                    </button>
                  </div>
                  <p className="left-dock__data-hint">表头需含「内部单号」「尺寸」；字段映射与多源数据在后续版本扩展。</p>
                  <AssetsPanel />
                </>
              )}
              {sidebarTab === 'layoutTask' && <LayoutTaskPanel />}
              {sidebarTab === 'qaOutput' && (
                <div className="left-dock__qa">
                  <div className="left-dock__subh">校验</div>
                  <ValidationPanel />
                  <div className="left-dock__subh left-dock__subh--spaced">Run 与历史</div>
                  <div className="left-dock__run">
                    <RunPanel />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
