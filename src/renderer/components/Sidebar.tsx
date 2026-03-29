/**
 * 左侧素材列表
 */
import React from 'react';
import { useAppStore } from '../store/useAppStore';

export const Sidebar: React.FC = () => {
  const { items, removeItem, updateItem } = useAppStore();

  const handleEdit = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const qty = prompt('修改数量：', String(item.quantity));
    if (qty !== null && !isNaN(Number(qty))) {
      updateItem(id, { quantity: Number(qty) });
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>素材列表 ({items.length})</span>
      </div>
      <div className="sidebar-list">
        {items.length === 0 ? (
          <div className="empty-state" style={{ height: 200 }}>
            <div style={{ fontSize: 32, opacity: 0.3 }}>&#128206;</div>
            <div>点击 "导入素材" 添加</div>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="sidebar-item">
              <div
                className="sidebar-item-color"
                style={{ background: item.color }}
              />
              <div className="sidebar-item-info">
                <div className="sidebar-item-name">{item.name}</div>
                <div className="sidebar-item-meta">
                  {item.width} x {item.height} mm &middot; x{item.quantity}
                  {item.group ? ` &middot; ${item.group}` : ''}
                </div>
              </div>
              <div className="sidebar-item-actions">
                <button className="icon-btn" title="编辑" onClick={() => handleEdit(item.id)}>
                  &#9998;
                </button>
                <button className="icon-btn" title="删除" onClick={() => removeItem(item.id)}>
                  &#10005;
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
