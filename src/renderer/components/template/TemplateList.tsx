/**
 * 左栏上部：模板列表 CRUD
 */
import React, { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { TemplateDefinition } from '../../../shared/types';

function newTemplateId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const TemplateList: React.FC = () => {
  const templates = useAppStore((s) => s.templates);
  const currentTemplateId = useAppStore((s) => s.currentTemplateId);
  const addTemplate = useAppStore((s) => s.addTemplate);
  const removeTemplate = useAppStore((s) => s.removeTemplate);
  const setCurrentTemplate = useAppStore((s) => s.setCurrentTemplate);

  const handleAdd = useCallback(() => {
    const now = new Date().toISOString();
    const t: TemplateDefinition = {
      id: newTemplateId(),
      name: `模板 ${templates.length + 1}`,
      version: 1,
      status: 'draft',
      canvasMode: 'single_piece',
      widthMm: 100,
      heightMm: 60,
      elements: [],
      createdAt: now,
      updatedAt: now,
    };
    addTemplate(t);
  }, [templates.length, addTemplate]);

  const handleDelete = useCallback(
    (id: string) => {
      removeTemplate(id);
    },
    [removeTemplate],
  );

  return (
    <div className="tpl-list">
      <div className="tpl-list__header">
        <span className="tpl-list__title">模板</span>
        <button type="button" className="tpl-list__add-btn" onClick={handleAdd} title="新建模板">
          +
        </button>
      </div>
      {templates.length === 0 ? (
        <div className="tpl-list__empty">
          <p>暂无模板</p>
          <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleAdd}>
            新建模板
          </button>
        </div>
      ) : (
        <ul className="tpl-list__items">
          {templates.map((t) => (
            <li
              key={t.id}
              className={`tpl-list__item ${t.id === currentTemplateId ? 'tpl-list__item--active' : ''}`}
            >
              <button
                type="button"
                className="tpl-list__item-btn"
                onClick={() => setCurrentTemplate(t.id)}
              >
                <span className="tpl-list__item-name">{t.name}</span>
                <span className="tpl-list__item-size">
                  {t.widthMm} x {t.heightMm} mm
                </span>
              </button>
              <button
                type="button"
                className="tpl-list__delete-btn"
                title="删除"
                onClick={() => handleDelete(t.id)}
              >
                x
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
