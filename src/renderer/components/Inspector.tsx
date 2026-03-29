/**
 * 右侧属性面板
 * 显示选中元素的详细信息，支持编辑
 */
import React from 'react';
import { useAppStore } from '../store/useAppStore';

export const Inspector: React.FC = () => {
  const { result, selectedIds, items, activeCanvasIndex, toggleLock } = useAppStore();

  // 获取选中的 placement
  const selectedPlacement = result?.canvases[activeCanvasIndex]?.placements.find(
    (p) => selectedIds.includes(p.id)
  );

  // 获取对应的 PrintItem
  const relatedItem = selectedPlacement
    ? items.find((i) => i.id === selectedPlacement.printItemId)
    : null;

  if (!selectedPlacement || !relatedItem) {
    return (
      <div className="inspector">
        <div className="inspector-title">属性面板</div>
        <div className="empty-state" style={{ height: 200 }}>
          <div style={{ fontSize: 28, opacity: 0.3 }}>&#128065;</div>
          <div style={{ fontSize: 12 }}>点击画布上的元素查看属性</div>
        </div>
      </div>
    );
  }

  return (
    <div className="inspector">
      <div className="inspector-title">属性面板</div>

      {/* 基本信息 */}
      <div className="inspector-section">
        <div className="inspector-section-title">基本信息</div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>名称</span>
          <span style={{ fontSize: 13 }}>{relatedItem.name}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>状态</span>
          <span style={{ fontSize: 13, color: selectedPlacement.locked ? 'var(--warning)' : 'var(--success)' }}>
            {selectedPlacement.locked ? '已锁定' : '未锁定'}
          </span>
        </div>
      </div>

      {/* 位置 */}
      <div className="inspector-section">
        <div className="inspector-section-title">位置</div>
        <div className="inspector-row">
          <span className="inspector-label">X</span>
          <input className="inspector-input" type="number" value={Math.round(selectedPlacement.x)} readOnly />
        </div>
        <div className="inspector-row">
          <span className="inspector-label">Y</span>
          <input className="inspector-input" type="number" value={Math.round(selectedPlacement.y)} readOnly />
        </div>
      </div>

      {/* 尺寸 */}
      <div className="inspector-section">
        <div className="inspector-section-title">尺寸</div>
        <div className="inspector-row">
          <span className="inspector-label">W</span>
          <input className="inspector-input" type="number" value={Math.round(selectedPlacement.width)} readOnly />
        </div>
        <div className="inspector-row">
          <span className="inspector-label">H</span>
          <input className="inspector-input" type="number" value={Math.round(selectedPlacement.height)} readOnly />
        </div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>旋转</span>
          <span style={{ fontSize: 13 }}>{selectedPlacement.rotated ? '90°' : '0°'}</span>
        </div>
      </div>

      {/* 参数 */}
      <div className="inspector-section">
        <div className="inspector-section-title">排版参数</div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>间距</span>
          <span style={{ fontSize: 13 }}>{relatedItem.spacing} mm</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>出血</span>
          <span style={{ fontSize: 13 }}>{relatedItem.bleed} mm</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>分组</span>
          <span style={{ fontSize: 13 }}>{relatedItem.group || '无'}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>优先级</span>
          <span style={{ fontSize: 13 }}>{relatedItem.priority}</span>
        </div>
      </div>

      {/* 操作 */}
      <div className="inspector-section">
        <div className="inspector-section-title">操作</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => toggleLock(selectedPlacement.id)}>
            {selectedPlacement.locked ? '解锁' : '锁定'}
          </button>
        </div>
      </div>
    </div>
  );
};
