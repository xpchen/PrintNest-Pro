/**
 * 右键上下文菜单 — React Portal，视口边缘自动调整
 */
import React, { useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';

export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  shortcut?: string;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, x, y, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 视口边缘调整
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      el.style.left = `${window.innerWidth - rect.width - 4}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${window.innerHeight - rect.height - 4}px`;
    }
  }, [x, y]);

  // ESC / 外部点击关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick, true);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick, true);
    };
  }, [onClose]);

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled || item.separator) return;
      onSelect(item.id);
      onClose();
    },
    [onSelect, onClose],
  );

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item) =>
        item.separator ? (
          <div key={item.id} className="context-menu__separator" role="separator" />
        ) : (
          <button
            key={item.id}
            className={`context-menu__item${item.disabled ? ' context-menu__item--disabled' : ''}${item.danger ? ' context-menu__item--danger' : ''}`}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => handleItemClick(item)}
          >
            <span className="context-menu__label">{item.label}</span>
            {item.shortcut && (
              <span className="context-menu__shortcut">{item.shortcut}</span>
            )}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
};
