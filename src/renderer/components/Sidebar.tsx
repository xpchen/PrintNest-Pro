/**
 * 左侧素材列表
 * 显示图片缩略图，支持编辑弹窗修改全部参数、删除、清空
 */
import React, { useCallback, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PrintItem } from '../../shared/types';

export const Sidebar: React.FC = () => {
  const { items, removeItem, updateItem, clearItems, setSelectedIds, selectedIds, result, activeCanvasIndex } = useAppStore();

  /** Determine which printItemIds are selected on canvas */
  const selectedItemIds = new Set<string>();
  if (result && selectedIds.length > 0) {
    const canvas = result.canvases[activeCanvasIndex];
    if (canvas) {
      const selSet = new Set(selectedIds);
      canvas.placements.forEach((p) => { if (selSet.has(p.id)) selectedItemIds.add(p.printItemId); });
    }
  }

  // Edit modal state
  const [editingItem, setEditingItem] = useState<PrintItem | null>(null);
  const [editForm, setEditForm] = useState({
    quantity: 1, spacing: 0, bleed: 0, group: '', priority: 0, allowRotation: true,
  });

  const openEditModal = useCallback((item: PrintItem) => {
    setEditingItem(item);
    setEditForm({
      quantity: item.quantity,
      spacing: item.spacing,
      bleed: item.bleed,
      group: item.group || '',
      priority: item.priority,
      allowRotation: item.allowRotation,
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingItem) return;
    updateItem(editingItem.id, {
      quantity: editForm.quantity,
      spacing: editForm.spacing,
      bleed: editForm.bleed,
      group: editForm.group || undefined,
      priority: editForm.priority,
      allowRotation: editForm.allowRotation,
    });
    setEditingItem(null);
  }, [editingItem, editForm, updateItem]);

  const handleClear = useCallback(() => {
    if (confirm('清空所有素材？')) clearItems();
  }, [clearItems]);

  /** Click sidebar item → highlight its instances on canvas */
  const handleItemClick = useCallback((itemId: string) => {
    if (!result) return;
    const canvas = result.canvases[activeCanvasIndex];
    if (!canvas) return;
    const ids = canvas.placements.filter((p) => p.printItemId === itemId).map((p) => p.id);
    setSelectedIds(ids);
  }, [result, activeCanvasIndex, setSelectedIds]);

  /** Drag-drop on sidebar */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const { addItem } = useAppStore.getState();
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const mmW = Math.round((img.naturalWidth / 150) * 25.4);
          const mmH = Math.round((img.naturalHeight / 150) * 25.4);
          addItem({ name: file.name.replace(/\.\w+$/, ''), width: mmW, height: mmH, quantity: 5, imageSrc: src });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>素材列表 ({items.length})</span>
        {items.length > 0 && (
          <button className="icon-btn" style={{ fontSize: 11 }} onClick={handleClear}>
            清空
          </button>
        )}
      </div>
      <div className="sidebar-list" onDragOver={handleDragOver} onDrop={handleDrop}>
        {items.length === 0 ? (
          <div className="empty-state" style={{ height: 200 }}>
            <div style={{ fontSize: 36, opacity: 0.25 }}>&#128444;</div>
            <div style={{ fontSize: 12 }}>
              拖拽图片到此处<br />或点击 "导入图片"
            </div>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`sidebar-item${selectedItemIds.has(item.id) ? ' selected' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              {item.imageSrc ? (
                <div
                  className="sidebar-item-thumb"
                  style={{ backgroundImage: `url(${item.imageSrc})` }}
                />
              ) : (
                <div
                  className="sidebar-item-thumb"
                  style={{ background: item.color, borderColor: item.color }}
                />
              )}
              <div className="sidebar-item-info">
                <div className="sidebar-item-name">{item.name}</div>
                <div className="sidebar-item-meta">
                  {item.width}x{item.height}mm &middot; x{item.quantity}
                  {item.group ? ` \u00b7 ${item.group}` : ''}
                </div>
              </div>
              <div className="sidebar-item-actions">
                <button
                  className="icon-btn"
                  title="编辑"
                  onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                >
                  &#9998;
                </button>
                <button
                  className="icon-btn"
                  title="删除"
                  onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                >
                  &#10005;
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setEditingItem(null); }}>
          <div className="modal">
            <h3>编辑素材: {editingItem.name}</h3>

            {editingItem.imageSrc && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <img
                  src={editingItem.imageSrc}
                  style={{ maxWidth: 160, maxHeight: 100, borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </div>
            )}

            <div className="modal-row">
              <label>尺寸</label>
              <span style={{ fontSize: 13 }}>{editingItem.width} x {editingItem.height} mm</span>
            </div>

            <div className="modal-row">
              <label>数量</label>
              <input
                type="number"
                min={1}
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: Math.max(1, Number(e.target.value)) })}
              />
            </div>

            <div className="modal-row">
              <label>间距 (mm)</label>
              <input
                type="number"
                min={0}
                value={editForm.spacing}
                onChange={(e) => setEditForm({ ...editForm, spacing: Number(e.target.value) })}
              />
            </div>

            <div className="modal-row">
              <label>出血 (mm)</label>
              <input
                type="number"
                min={0}
                value={editForm.bleed}
                onChange={(e) => setEditForm({ ...editForm, bleed: Number(e.target.value) })}
              />
            </div>

            <div className="modal-row">
              <label>分组</label>
              <input
                type="text"
                value={editForm.group}
                placeholder="可选"
                onChange={(e) => setEditForm({ ...editForm, group: e.target.value })}
              />
            </div>

            <div className="modal-row">
              <label>优先级</label>
              <input
                type="number"
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: Number(e.target.value) })}
              />
            </div>

            <div className="modal-row">
              <label>允许旋转</label>
              <input
                type="checkbox"
                checked={editForm.allowRotation}
                onChange={(e) => setEditForm({ ...editForm, allowRotation: e.target.checked })}
                style={{ width: 'auto', accentColor: 'var(--accent)' }}
              />
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setEditingItem(null)}>取消</button>
              <button className="btn btn-primary" onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
