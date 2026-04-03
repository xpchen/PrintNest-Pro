import React from 'react';

export type DockSide = 'left' | 'right';

export interface DockRailTab {
  id: string;
  label: string;
  short: string;
  badge?: number;
}

interface DockRailProps {
  side: DockSide;
  tabs: DockRailTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
}

export const DockRail: React.FC<DockRailProps> = ({
  side,
  tabs,
  activeId,
  onSelect,
  onToggleCollapse,
  collapsed,
}) => {
  return (
    <nav className={`dock-rail dock-rail--${side}`} aria-label={side === 'left' ? '左侧面板' : '右侧面板'}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`dock-rail__btn${activeId === t.id ? ' is-active' : ''}`}
          title={t.label}
          onClick={() => onSelect(t.id)}
        >
          <span className="dock-rail__short">{t.short}</span>
          {t.badge != null && t.badge > 0 ? <span className="dock-rail__badge">{t.badge > 99 ? '99+' : t.badge}</span> : null}
        </button>
      ))}
      <button
        type="button"
        className="dock-rail__pin"
        title={collapsed ? '展开面板' : '收起为图标栏'}
        onClick={onToggleCollapse}
      >
        {collapsed ? '»' : '«'}
      </button>
    </nav>
  );
};
