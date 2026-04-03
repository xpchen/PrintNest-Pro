import React from 'react';

export type DockSide = 'left' | 'right';

export interface DockRailTab {
  id: string;
  /** 完整名称，用于 tooltip 与 aria */
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface DockRailProps {
  side: DockSide;
  tabs: DockRailTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
  /** 右侧栏仅折叠时可为 true：不触发切换，只展示图标 */
  selectionLocked?: boolean;
}

export const DockRail: React.FC<DockRailProps> = ({
  side,
  tabs,
  activeId,
  onSelect,
  onToggleCollapse,
  collapsed,
  selectionLocked,
}) => {
  return (
    <nav className={`dock-rail dock-rail--${side}`} aria-label={side === 'left' ? '左侧任务栏' : '右侧属性栏'}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`dock-rail__btn${activeId === t.id ? ' is-active' : ''}`}
          title={t.label}
          aria-label={t.label}
          aria-current={activeId === t.id ? 'true' : undefined}
          onClick={() => {
            if (!selectionLocked) onSelect(t.id);
          }}
        >
          <span className="dock-rail__icon" aria-hidden>
            {t.icon}
          </span>
          {t.badge != null && t.badge > 0 ? <span className="dock-rail__badge">{t.badge > 99 ? '99+' : t.badge}</span> : null}
        </button>
      ))}
      <button
        type="button"
        className="dock-rail__pin"
        title={collapsed ? '展开面板' : '收起为图标栏'}
        aria-label={collapsed ? '展开面板' : '收起为图标栏'}
        onClick={onToggleCollapse}
      >
        {collapsed ? '»' : '«'}
      </button>
    </nav>
  );
};
