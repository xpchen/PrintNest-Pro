import React, { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { PrintItem } from '../../../shared/types';
import { formatAreaMm, formatPairMm } from '../../utils/lengthDisplay';

type SortKey = 'name' | 'area' | 'qty' | 'recent';

export const AssetsPanel: React.FC = () => {
  const {
    items, removeItem, updateItem, clearItems, setSelectedIds, selectedIds, result, activeCanvasIndex,
    displayUnit,
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [filterUnplaced, setFilterUnplaced] = useState(false);
  const [filterExcelOnly, setFilterExcelOnly] = useState(false);

  const selectedItemIds = useMemo(() => {
    const set = new Set<string>();
    if (result && selectedIds.length > 0) {
      const canvas = result.canvases[activeCanvasIndex];
      if (canvas) {
        const sel = new Set(selectedIds);
        canvas.placements.forEach((p) => {
          if (sel.has(p.id)) set.add(p.printItemId);
        });
      }
    }
    return set;
  }, [result, selectedIds, activeCanvasIndex]);

  const placedQtyByItem = useMemo(() => {
    const m = new Map<string, number>();
    if (!result) return m;
    for (const c of result.canvases) {
      for (const p of c.placements) {
        m.set(p.printItemId, (m.get(p.printItemId) ?? 0) + 1);
      }
    }
    return m;
  }, [result]);

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

  const showConfirm = useAppStore((s) => s.showConfirm);

  const handleClear = useCallback(async () => {
    const confirmed = await showConfirm({
      title: '清空素材',
      message: '确定要清空所有素材吗？此操作不可撤销。',
      confirmLabel: '清空',
      danger: true,
    });
    if (confirmed) clearItems();
  }, [clearItems, showConfirm]);

  const handleItemClick = useCallback(
    (itemId: string) => {
      if (!result) return;
      const canvas = result.canvases[activeCanvasIndex];
      if (!canvas) return;
      const ids = canvas.placements.filter((p) => p.printItemId === itemId).map((p) => p.id);
      setSelectedIds(ids);
    },
    [result, activeCanvasIndex, setSelectedIds],
  );

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
          addItem({ name: file.name.replace(/\.\w+$/, ''), width: mmW, height: mmH, quantity: 1, imageSrc: src });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const filtered = useMemo(() => {
    let list = items.filter((i) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!i.name.toLowerCase().includes(q) && !(i.group || '').toLowerCase().includes(q)) return false;
      }
      if (filterExcelOnly && i.imageSrc) return false;
      if (filterUnplaced && result) {
        const pq = placedQtyByItem.get(i.id) ?? 0;
        if (pq > 0) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'zh-CN');
      if (sortKey === 'area') return b.width * b.height - a.width * a.height;
      if (sortKey === 'qty') return b.quantity - a.quantity;
      return 0;
    });
    return list;
  }, [items, search, sortKey, filterUnplaced, filterExcelOnly, result, placedQtyByItem]);

  const totalArea = useMemo(
    () => items.reduce((s, i) => s + i.width * i.height * i.quantity, 0),
    [items],
  );
  const unplacedItems = useMemo(() => {
    if (!result) return items.length;
    return items.filter((i) => (placedQtyByItem.get(i.id) ?? 0) === 0).length;
  }, [items, result, placedQtyByItem]);

  return (
    <div className="panel-assets">
      <div className="panel-assets__toolbar">
        <input
          className="input input-panel"
          placeholder="搜索名称/分组…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select select-panel" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="name">名称</option>
          <option value="area">面积</option>
          <option value="qty">数量</option>
        </select>
      </div>
      <div className="panel-assets__filters">
        <label className="panel-chip">
          <input type="checkbox" checked={filterUnplaced} onChange={(e) => setFilterUnplaced(e.target.checked)} />
          未排入
        </label>
        <label className="panel-chip">
          <input type="checkbox" checked={filterExcelOnly} onChange={(e) => setFilterExcelOnly(e.target.checked)} />
          仅 Excel（无图）
        </label>
        {items.length > 0 && (
          <button type="button" className="btn btn-tiny" onClick={handleClear}>
            清空
          </button>
        )}
      </div>

      <div className="panel-assets__list sidebar-list" onDragOver={handleDragOver} onDrop={handleDrop}>
        {items.length === 0 ? (
          <div className="empty-state" style={{ height: 200 }}>
            <div style={{ fontSize: 36, opacity: 0.25 }}>&#128444;</div>
            <div style={{ fontSize: 12 }}>
              拖拽图片到此处
              <br />
              或点击顶栏「导入图片」
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ height: 120 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>无匹配素材</div>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`sidebar-item panel-assets__card${selectedItemIds.has(item.id) ? ' selected' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              {item.imageSrc ? (
                <div className="sidebar-item-thumb" style={{ backgroundImage: `url(${item.imageSrc})` }} />
              ) : (
                <div className="sidebar-item-thumb" style={{ background: item.color, borderColor: item.color }} />
              )}
              <div className="sidebar-item-info">
                <div className="sidebar-item-name">{item.name}</div>
                <div className="sidebar-item-meta">
                  {formatPairMm(item.width, item.height, displayUnit)} · ×{item.quantity}
                  {item.group ? ` · ${item.group}` : ''}
                </div>
              </div>
              <div className="sidebar-item-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="编辑"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(item);
                  }}
                >
                  &#9998;
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                >
                  &#10005;
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel-assets__stats">
        <span>共 {items.length} 种</span>
        <span>累计面积约 {formatAreaMm(totalArea, displayUnit)}</span>
        {result && <span className={unplacedItems > 0 ? 'text-warn' : ''}>待排入 {unplacedItems}</span>}
      </div>

      {editingItem && (
        <div className="modal-bg pn-z-modal" onClick={(e) => { if (e.target === e.currentTarget) setEditingItem(null); }}>
          <div className="modal">
            <h3>编辑素材: {editingItem.name}</h3>
            {editingItem.imageSrc && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <img
                  src={editingItem.imageSrc}
                  alt=""
                  style={{ maxWidth: 160, maxHeight: 100, borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </div>
            )}
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
              <button type="button" className="btn" onClick={() => setEditingItem(null)}>取消</button>
              <button type="button" className="btn btn-primary" onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
