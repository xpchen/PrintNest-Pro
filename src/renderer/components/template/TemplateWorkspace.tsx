/**
 * 模板工作区 — 三栏布局 + 底部操作栏（预览/实例化/送入排版）
 */
import React, { useCallback, useMemo, useState } from 'react';
import { TemplateList } from './TemplateList';
import { TemplateElementTree } from './TemplateElementTree';
import { TemplateCanvas } from './TemplateCanvas';
import { TemplateInspector } from './TemplateInspector';
import { useAppStore } from '../../store/useAppStore';

export const TemplateWorkspace: React.FC = () => {
  const dataRecords = useAppStore((s) => s.dataRecords);
  const templateInstances = useAppStore((s) => s.templateInstances);
  const templates = useAppStore((s) => s.templates);
  const instantiateCurrentTemplate = useAppStore((s) => s.instantiateCurrentTemplate);
  const currentTemplateId = useAppStore((s) => s.currentTemplateId);
  const runAutoLayoutFromInstances = useAppStore((s) => s.runAutoLayoutFromInstances);
  const setEditorWorkMode = useAppStore((s) => s.setEditorWorkMode);
  const showConfirm = useAppStore((s) => s.showConfirm);

  const [showInstances, setShowInstances] = useState(false);
  const [instantiating, setInstantiating] = useState(false);

  const handleInstantiate = useCallback(() => {
    setInstantiating(true);
    try {
      instantiateCurrentTemplate();
      setShowInstances(true);
    } finally {
      setInstantiating(false);
    }
  }, [instantiateCurrentTemplate]);

  const handleSendToLayout = useCallback(async () => {
    await runAutoLayoutFromInstances();
    setEditorWorkMode('layout');
  }, [runAutoLayoutFromInstances, setEditorWorkMode]);

  // 只显示当前模板的实例
  const currentInstances = useMemo(
    () => currentTemplateId ? templateInstances.filter((i) => i.templateId === currentTemplateId) : [],
    [templateInstances, currentTemplateId],
  );
  const readyCount = currentInstances.filter((i) => i.status === 'valid').length;
  const warnCount = currentInstances.filter((i) => i.status === 'warning').length;
  const errorCount = currentInstances.filter((i) => i.status === 'error').length;

  const [instanceFilter, setInstanceFilter] = useState<'all' | 'valid' | 'warning' | 'error'>('all');
  const filteredInstances = useMemo(() => {
    if (instanceFilter === 'all') return currentInstances;
    return currentInstances.filter((i) => i.status === instanceFilter);
  }, [currentInstances, instanceFilter]);

  const canInstantiate = currentTemplateId != null && dataRecords.length > 0;

  const handleClearCurrent = useCallback(async () => {
    const tid = useAppStore.getState().currentTemplateId;
    if (!tid) return;
    const count = useAppStore.getState().templateInstances.filter((i) => i.templateId === tid).length;
    const ok = await showConfirm({
      title: '清空当前模板实例',
      message: `确定要清空当前模板的 ${count} 个实例吗？此操作不可撤销。`,
      confirmLabel: '清空',
      danger: true,
    });
    if (!ok) return;
    const remaining = useAppStore.getState().templateInstances.filter((i) => i.templateId !== tid);
    useAppStore.setState({ templateInstances: remaining });
    setShowInstances(false);
  }, [showConfirm]);

  const handleClearAll = useCallback(async () => {
    const count = useAppStore.getState().templateInstances.length;
    const ok = await showConfirm({
      title: '清空全部实例',
      message: `确定要清空全部 ${count} 个实例吗？此操作不可撤销。`,
      confirmLabel: '清空全部',
      danger: true,
    });
    if (!ok) return;
    useAppStore.setState({ templateInstances: [] });
    setShowInstances(false);
  }, [showConfirm]);

  return (
    <div className="tpl-workspace">
      <aside className="tpl-workspace__left">
        <TemplateList />
        <TemplateElementTree />
      </aside>
      <main className="tpl-workspace__center">
        <TemplateCanvas />
        {/* 操作栏 */}
        <div className="tpl-action-bar">
          <div className="tpl-action-bar__info">
            {dataRecords.length > 0 ? (
              <span>{dataRecords.length} 条数据记录</span>
            ) : (
              <span className="tpl-action-bar__hint">导入 Excel 数据记录后可实例化</span>
            )}
            {templateInstances.length > 0 && (
              <span className="tpl-action-bar__stats">
                当前模板: {readyCount} 就绪
                {warnCount > 0 && <span className="tpl-action-bar__warn"> / {warnCount} 警告</span>}
                {errorCount > 0 && <span className="tpl-action-bar__error"> / {errorCount} 错误</span>}
                {templateInstances.length !== currentInstances.length && (
                  <span className="tpl-action-bar__total"> · 全部模板共 {templateInstances.length} 实例</span>
                )}
              </span>
            )}
          </div>
          <div className="tpl-action-bar__buttons">
            {templateInstances.length > 0 && (
              <button
                type="button"
                className="tpl-action-bar__btn tpl-action-bar__btn--secondary"
                onClick={() => setShowInstances(!showInstances)}
              >
                {showInstances ? '隐藏实例' : '查看实例'}
              </button>
            )}
            <button
              type="button"
              className="tpl-action-bar__btn tpl-action-bar__btn--primary"
              disabled={!canInstantiate || instantiating}
              onClick={handleInstantiate}
            >
              {instantiating ? '生成中…' : '生成标签'}
            </button>
            <button
              type="button"
              className="tpl-action-bar__btn tpl-action-bar__btn--accent"
              disabled={readyCount === 0}
              onClick={handleSendToLayout}
            >
              开始排版 ({readyCount})
            </button>
          </div>
        </div>
        {/* 实例列表面板 */}
        {showInstances && templateInstances.length > 0 && (
          <div className="tpl-instance-panel">
            <div className="tpl-instance-panel__header">
              <span className="tpl-instance-panel__title">
                实例列表 ({templateInstances.length})
              </span>
              <div className="tpl-instance-panel__filters">
                {(['all', 'valid', 'warning', 'error'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`tpl-instance-panel__filter ${instanceFilter === f ? 'tpl-instance-panel__filter--active' : ''}`}
                    onClick={() => setInstanceFilter(f)}
                  >
                    {f === 'all' ? `全部 (${templateInstances.length})`
                      : f === 'valid' ? `就绪 (${readyCount})`
                      : f === 'warning' ? `警告 (${warnCount})`
                      : `错误 (${errorCount})`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="tpl-instance-panel__btn tpl-instance-panel__btn--danger"
                onClick={handleClearCurrent}
                disabled={currentInstances.length === 0}
                title="清空当前模板实例"
              >清空当前</button>
              <button
                type="button"
                className="tpl-instance-panel__btn tpl-instance-panel__btn--danger"
                onClick={handleClearAll}
                disabled={templateInstances.length === 0}
                title="清空全部模板实例"
              >清空全部</button>
              <button
                type="button"
                className="tpl-instance-panel__close"
                onClick={() => setShowInstances(false)}
              >×</button>
            </div>
            <div className="tpl-instance-panel__list">
              {filteredInstances.map((inst) => {
                const record = dataRecords.find((r) => r.id === inst.recordId);
                const recordLabel = record
                  ? (record.fields['内部单号'] || record.fields['name'] || record.fields['sku'] || `记录 ${record.sourceRowIndex + 1}`)
                  : inst.recordId.slice(0, 12);
                const tpl = templates.find((t) => t.id === inst.templateId);
                return (
                  <div key={inst.id} className={`tpl-instance-card tpl-instance-card--${inst.status}`}>
                    <div className="tpl-instance-card__header">
                      <span className={`tpl-instance-card__status tpl-instance-card__status--${inst.status}`}>
                        {inst.status === 'valid' ? 'OK' : inst.status === 'warning' ? 'WARN' : 'ERR'}
                      </span>
                      <span className="tpl-instance-card__name">{recordLabel}</span>
                    </div>
                    <div className="tpl-instance-card__meta">
                      {tpl?.name} · {inst.resolvedWidthMm}×{inst.resolvedHeightMm}mm
                    </div>
                    {inst.validationErrors && inst.validationErrors.length > 0 && (
                      <div className="tpl-instance-card__errors">
                        {inst.validationErrors.slice(0, 3).map((err, i) => (
                          <div key={i} className="tpl-instance-card__error-item">
                            {err.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      <aside className="tpl-workspace__right">
        <TemplateInspector />
      </aside>
    </div>
  );
};
