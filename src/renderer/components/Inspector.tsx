/**
 * 右侧属性面板
 * 支持单选和多选模式，属性可编辑，带锁定/删除/复制操作
 */
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../utils/toast';
import { formatLengthMm } from '../utils/lengthDisplay';

export const Inspector: React.FC = () => {
  const {
    result, selectedIds, items, activeCanvasIndex,
    toggleLock, batchLock, deleteSelected, setSelectedIds,
    updatePlacement, updateItem, duplicateItem, alignSelected,
    focusRectInCanvas,
    displayUnit,
    togglePlacementHidden,
    duplicatePlacement,
  } = useAppStore();

  const currentCanvas = result?.canvases[activeCanvasIndex];
  const selPlacements = currentCanvas
    ? currentCanvas.placements.filter((p) => selectedIds.includes(p.id))
    : [];
  const selCount = selPlacements.length;

  // Empty state
  if (selCount === 0) {
    return (
      <div className="inspector">
        <div className="inspector-title">属性面板</div>
        <div className="empty-state" style={{ height: 200 }}>
          <div style={{ fontSize: 28, opacity: 0.3 }}>&#128065;</div>
          <div style={{ fontSize: 12 }}>点击画布元素查看属性</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.8, textAlign: 'center' }}>
            操作提示:<br />
            左键 = 选中/拖拽<br />
            Shift+点击 = 多选<br />
            框选 = 批量选中<br />
            右键 = 锁定/解锁<br />
            Delete = 删除选中<br />
            Alt+拖拽 = 平移画布<br />
            滚轮 = 缩放
          </div>
        </div>
      </div>
    );
  }

  // Multi-select mode
  if (selCount > 1) {
    const lockedCount = selPlacements.filter((p) => p.locked).length;
    const unlockedCount = selCount - lockedCount;

    return (
      <div className="inspector">
        <div className="inspector-title">属性面板</div>

        <div className="inspector-section">
          <div className="inspector-section-title">多选</div>
          <div className="inspector-row">
            <span className="inspector-label" style={{ width: 50 }}>已选</span>
            <span style={{ fontSize: 13, color: 'var(--accent)' }}>{selCount} 个元素</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-label" style={{ width: 50 }}>锁定</span>
            <span style={{ fontSize: 13 }}>{lockedCount} 锁定 / {unlockedCount} 未锁定</span>
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-section-title">批量操作</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => { batchLock(selectedIds, true); showToast(`已锁定 ${selCount} 个`); }}>
              🔒 全部锁定
            </button>
            <button className="btn" onClick={() => { batchLock(selectedIds, false); showToast(`已解锁 ${selCount} 个`); }}>
              🔓 全部解锁
            </button>
            <button className="btn" onClick={() => { selPlacements.forEach((p) => togglePlacementHidden(p.id)); showToast(`已切换 ${selCount} 个隐藏状态`); }}>
              🙈 切换隐藏
            </button>
            <button className="btn btn-danger" onClick={deleteSelected}>
              🗑 删除全部 ({selCount})
            </button>
            {currentCanvas && (
              <button
                className="btn"
                onClick={() => setSelectedIds(currentCanvas.placements.map((p) => p.id))}
              >
                全选
              </button>
            )}
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-section-title">对齐（未锁定）</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => { alignSelected('left'); showToast('已左对齐'); }}>左</button>
            <button type="button" className="btn" onClick={() => { alignSelected('right'); showToast('已右对齐'); }}>右</button>
            <button type="button" className="btn" onClick={() => { alignSelected('top'); showToast('已顶对齐'); }}>顶</button>
            <button type="button" className="btn" onClick={() => { alignSelected('bottom'); showToast('已底对齐'); }}>底</button>
            <button type="button" className="btn" onClick={() => { alignSelected('hcenter'); showToast('已水平居中'); }}>水平中</button>
            <button type="button" className="btn" onClick={() => { alignSelected('vcenter'); showToast('已垂直居中'); }}>垂直中</button>
          </div>
        </div>
      </div>
    );
  }

  // Single-select mode
  const sel = selPlacements[0];
  const relatedItem = items.find((i) => i.id === sel.printItemId);

  return (
    <div className="inspector">
      <div className="inspector-title">属性面板</div>

      {/* Thumbnail */}
      {relatedItem?.imageSrc && (
        <div
          className="ins-thumb"
          style={{ backgroundImage: `url(${relatedItem.imageSrc})` }}
        />
      )}

      {/* Basic info */}
      <div className="inspector-section">
        <div className="inspector-section-title">基本信息</div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>名称</span>
          <span style={{ fontSize: 13 }}>{relatedItem?.name ?? '未知'}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>状态</span>
          <span style={{ fontSize: 13, color: sel.locked ? 'var(--warning)' : 'var(--success)' }}>
            {sel.locked ? '🔒 已锁定' : '已解锁'}
          </span>
        </div>
        {sel.hidden && (
          <div className="inspector-row">
            <span className="inspector-label" style={{ width: 50 }}>可见</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>已隐藏</span>
          </div>
        )}
      </div>

      {/* 模板来源信息 */}
      {relatedItem?.metadata && (
        <div className="inspector-section">
          <div className="inspector-section-title">模板来源</div>
          <div className="inspector-row">
            <span className="inspector-label" style={{ width: 50 }}>模板</span>
            <span style={{ fontSize: 13 }}>{relatedItem.metadata.templateName}</span>
          </div>
          {relatedItem.metadata.keyFields.map((kf) => (
            <div className="inspector-row" key={kf.label}>
              <span className="inspector-label" style={{ width: 50 }}>{kf.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{kf.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Position - editable */}
      <div className="inspector-section">
        <div className="inspector-section-title">位置</div>
        <div className="inspector-row">
          <span className="inspector-label">X</span>
          <input
            className="inspector-input"
            type="number"
            value={Math.round(sel.x)}
            onChange={(e) => updatePlacement(sel.id, { x: Number(e.target.value) })}
          />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>mm</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">Y</span>
          <input
            className="inspector-input"
            type="number"
            value={Math.round(sel.y)}
            onChange={(e) => updatePlacement(sel.id, { y: Number(e.target.value) })}
          />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>mm</span>
        </div>
      </div>

      {/* Size */}
      <div className="inspector-section">
        <div className="inspector-section-title">尺寸（画布上为排版占用，含出血/间距）</div>
        <div className="inspector-row">
          <span className="inspector-label">W</span>
          <span style={{ fontSize: 13 }}>{formatLengthMm(sel.width, displayUnit)}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">H</span>
          <span style={{ fontSize: 13 }}>{formatLengthMm(sel.height, displayUnit)}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label" style={{ width: 50 }}>旋转</span>
          <span style={{ fontSize: 13 }}>{sel.rotated ? '90°' : '0°'}</span>
        </div>
      </div>

      {/* Layout params - editable */}
      {relatedItem && (
        <div className="inspector-section">
          <div className="inspector-section-title">排版参数</div>
          <div className="inspector-row">
            <span className="inspector-label" style={{ width: 50 }}>间距</span>
            <input
              className="inspector-input"
              type="number"
              min={0}
              value={relatedItem.spacing}
              onChange={(e) => updateItem(relatedItem.id, { spacing: Number(e.target.value) })}
            />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>mm</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-label" style={{ width: 50 }}>出血</span>
            <input
              className="inspector-input"
              type="number"
              min={0}
              value={relatedItem.bleed}
              onChange={(e) => updateItem(relatedItem.id, { bleed: Number(e.target.value) })}
            />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>mm</span>
          </div>
          <div className="inspector-row">
            <span className="inspector-label" style={{ width: 50 }}>优先级</span>
            <input
              className="inspector-input"
              type="number"
              value={relatedItem.priority}
              onChange={(e) => updateItem(relatedItem.id, { priority: Number(e.target.value) })}
            />
          </div>
          <div className="inspector-row">
            <span className="inspector-label" style={{ width: 50 }}>分组</span>
            <input
              className="inspector-input"
              type="text"
              value={relatedItem.group || ''}
              placeholder="无"
              onChange={(e) => updateItem(relatedItem.id, { group: e.target.value || undefined })}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="inspector-section">
        <div className="inspector-section-title">操作</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              focusRectInCanvas(
                { x: sel.x, y: sel.y, width: sel.width, height: sel.height },
                { mode: 'center', paddingMm: 12 },
              );
              showToast('已定位到视口');
            }}
          >
            定位到画布
          </button>
          <button className="btn" onClick={() => { toggleLock(sel.id); showToast(sel.locked ? '已解锁' : '已锁定'); }}>
            {sel.locked ? '🔓 解锁' : '🔒 锁定'}
          </button>
          <button className="btn" onClick={() => { togglePlacementHidden(sel.id); showToast(sel.hidden ? '已显示' : '已隐藏'); }}>
            {sel.hidden ? '👁 显示' : '🙈 隐藏'}
          </button>
          <button className="btn" onClick={() => { duplicatePlacement(sel.id); showToast('已复制 placement'); }}>
            📋 复制
          </button>
          <button className="btn" onClick={() => { duplicateItem(sel.printItemId); showToast('已复制素材'); }}>
            📋 复制素材
          </button>
          <button className="btn btn-danger" onClick={deleteSelected}>
            🗑 删除
          </button>
        </div>
      </div>
    </div>
  );
};
