import React from 'react';
import { ProjectSummaryPanel } from '../panels/ProjectSummaryPanel';
import { CanvasSummaryPanel } from '../panels/CanvasSummaryPanel';

/**
 * 右侧无选区时：当前任务与画布上下文摘要（与左侧「项目」规格互补，偏运行态）。
 */
export const TaskSummaryInspector: React.FC = () => {
  return (
    <div className="inspector task-summary-inspector">
      <div className="inspector-title">当前任务</div>
      <ProjectSummaryPanel />
      <div className="task-summary-inspector__sep" />
      <div className="inspector-title inspector-title--sub">画布与参数</div>
      <CanvasSummaryPanel />
      <p className="task-summary-inspector__hint">选中画布上的对象后，在此查看与编辑属性。</p>
    </div>
  );
};
