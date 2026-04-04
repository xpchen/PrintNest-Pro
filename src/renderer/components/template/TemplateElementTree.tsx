/**
 * 左栏下部：元素层级树 — 选中/锁定/隐藏/删除/拖拽排序
 */
import React, { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { TemplateElement } from '../../../shared/types';

const TYPE_LABEL: Record<TemplateElement['type'], string> = {
  fixedImage: '固定图',
  variableImage: '变量图',
  fixedText: '固定文本',
  variableText: '变量文本',
  barcode: '条码',
  qrcode: '二维码',
  mark: '标记',
};

export const TemplateElementTree: React.FC = () => {
  const currentTemplateId = useAppStore((s) => s.currentTemplateId);
  const templates = useAppStore((s) => s.templates);
  const selectedElementIds = useAppStore((s) => s.selectedElementIds);
  const selectElements = useAppStore((s) => s.selectElements);
  const updateElement = useAppStore((s) => s.updateElement);
  const removeElement = useAppStore((s) => s.removeElement);
  const reorderElements = useAppStore((s) => s.reorderElements);

  const currentTemplate = templates.find((t) => t.id === currentTemplateId);
  const elements = currentTemplate?.elements ?? [];
  // 显示顺序：反转（顶部=前景）
  const displayElements = [...elements].reverse();

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const handleSelect = useCallback(
    (id: string, multi: boolean) => {
      if (multi) {
        const next = selectedElementIds.includes(id)
          ? selectedElementIds.filter((x) => x !== id)
          : [...selectedElementIds, id];
        selectElements(next);
      } else {
        selectElements([id]);
      }
    },
    [selectedElementIds, selectElements],
  );

  const toggleLock = useCallback(
    (el: TemplateElement) => {
      if (!currentTemplateId) return;
      updateElement(currentTemplateId, el.id, { locked: !el.locked });
    },
    [currentTemplateId, updateElement],
  );

  const toggleHidden = useCallback(
    (el: TemplateElement) => {
      if (!currentTemplateId) return;
      updateElement(currentTemplateId, el.id, { hidden: !el.hidden });
    },
    [currentTemplateId, updateElement],
  );

  const showConfirm = useAppStore((s) => s.showConfirm);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!currentTemplateId) return;
      const confirmed = await showConfirm({
        title: '删除元素',
        message: '确定要删除该元素吗？此操作不可撤销。',
        confirmLabel: '删除',
        danger: true,
      });
      if (!confirmed) return;
      removeElement(currentTemplateId, id);
    },
    [currentTemplateId, removeElement, showConfirm],
  );

  // ── 拖拽排序 ──
  const handleDragStart = useCallback((idx: number, e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIdx(idx);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropIdx(null);
  }, []);

  const handleDrop = useCallback(
    (targetIdx: number, e: React.DragEvent) => {
      e.preventDefault();
      setDropIdx(null);
      setDragIdx(null);
      if (dragIdx == null || dragIdx === targetIdx || !currentTemplateId) return;

      // displayElements 是 reversed，转回原始顺序
      const reordered = [...displayElements];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(targetIdx, 0, moved);
      // 反转回原始存储顺序
      const newOrder = [...reordered].reverse().map((el) => el.id);
      reorderElements(currentTemplateId, newOrder);
    },
    [dragIdx, displayElements, currentTemplateId, reorderElements],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  if (!currentTemplate) {
    return <div className="tpl-tree tpl-tree--empty">选择模板后显示元素</div>;
  }

  return (
    <div className="tpl-tree">
      <div className="tpl-tree__header">
        <span className="tpl-tree__title">元素 ({elements.length})</span>
      </div>
      {elements.length === 0 ? (
        <div className="tpl-tree__empty-hint">暂无元素，在画布中添加</div>
      ) : (
        <ul className="tpl-tree__list">
          {displayElements.map((el, idx) => {
            const selected = selectedElementIds.includes(el.id);
            const isDropTarget = dropIdx === idx && dragIdx !== idx;
            return (
              <li
                key={el.id}
                className={`tpl-tree__item ${selected ? 'tpl-tree__item--selected' : ''} ${el.hidden ? 'tpl-tree__item--hidden' : ''} ${isDropTarget ? 'tpl-tree__item--drop-target' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(idx, e)}
                onDragOver={(e) => handleDragOver(idx, e)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(idx, e)}
                onDragEnd={handleDragEnd}
                style={{ opacity: dragIdx === idx ? 0.4 : undefined }}
              >
                <button
                  type="button"
                  className="tpl-tree__item-main"
                  onClick={(e) => handleSelect(el.id, e.metaKey || e.ctrlKey)}
                >
                  <span className="tpl-tree__item-type">{TYPE_LABEL[el.type]}</span>
                  <span className="tpl-tree__item-name">{el.name || el.id.slice(0, 8)}</span>
                </button>
                <div className="tpl-tree__item-actions">
                  <button
                    type="button"
                    className={`tpl-tree__action-btn ${el.locked ? 'tpl-tree__action-btn--on' : ''}`}
                    title={el.locked ? '解锁' : '锁定'}
                    onClick={() => toggleLock(el)}
                  >
                    {el.locked ? 'L' : 'U'}
                  </button>
                  <button
                    type="button"
                    className={`tpl-tree__action-btn ${el.hidden ? 'tpl-tree__action-btn--on' : ''}`}
                    title={el.hidden ? '显示' : '隐藏'}
                    onClick={() => toggleHidden(el)}
                  >
                    {el.hidden ? 'H' : 'V'}
                  </button>
                  <button
                    type="button"
                    className="tpl-tree__action-btn tpl-tree__action-btn--delete"
                    title="删除"
                    onClick={() => handleDelete(el.id)}
                  >
                    x
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
