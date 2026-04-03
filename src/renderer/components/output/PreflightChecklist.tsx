/**
 * 预飞检查清单 — 导出前状态核查
 */
import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';

interface CheckItem {
  label: string;
  ok: boolean;
  detail: string;
}

export const PreflightChecklist: React.FC = () => {
  const result = useAppStore((s) => s.result);
  const items = useAppStore((s) => s.items);
  const templateInstances = useAppStore((s) => s.templateInstances);

  const checks = useMemo<CheckItem[]>(() => {
    const list: CheckItem[] = [];

    // 1. 有排版结果
    const hasResult = result != null && result.canvases.length > 0;
    list.push({
      label: '排版结果',
      ok: hasResult,
      detail: hasResult
        ? `${result.canvases.length} 画布，利用率 ${(result.totalUtilization * 100).toFixed(1)}%`
        : '未执行排版',
    });

    // 2. 未排入素材
    const unplacedCount = result?.unplaced.length ?? 0;
    list.push({
      label: '未排入素材',
      ok: unplacedCount === 0,
      detail: unplacedCount === 0 ? '全部排入' : `${unplacedCount} 件未排入`,
    });

    // 3. 校验问题
    const errorCount =
      result?.validation?.issues.filter((i) => i.severity === 'error').length ?? 0;
    const warnCount =
      result?.validation?.issues.filter((i) => i.severity === 'warning').length ?? 0;
    list.push({
      label: '校验状态',
      ok: errorCount === 0,
      detail:
        errorCount === 0 && warnCount === 0
          ? '无问题'
          : `${errorCount} 错误, ${warnCount} 警告`,
    });

    // 4. 素材图片
    const missingImages = items.filter((i) => !i.imageSrc && !i.assetId);
    list.push({
      label: '素材图片',
      ok: missingImages.length === 0,
      detail:
        missingImages.length === 0
          ? `${items.length} 素材均有图`
          : `${missingImages.length} 素材缺图`,
    });

    // 5. 模板实例
    if (templateInstances.length > 0) {
      const errorInstances = templateInstances.filter((i) => i.status === 'error');
      list.push({
        label: '模板实例',
        ok: errorInstances.length === 0,
        detail:
          errorInstances.length === 0
            ? `${templateInstances.length} 实例就绪`
            : `${errorInstances.length} 实例有错误`,
      });
    }

    return list;
  }, [result, items, templateInstances]);

  const allOk = checks.every((c) => c.ok);

  return (
    <div className="preflight">
      <div className="preflight__header">
        <span className="preflight__title">预飞检查</span>
        <span className={`preflight__badge ${allOk ? 'preflight__badge--ok' : 'preflight__badge--warn'}`}>
          {allOk ? 'READY' : 'CHECK'}
        </span>
      </div>
      <ul className="preflight__list">
        {checks.map((c, i) => (
          <li key={i} className={`preflight__item ${c.ok ? '' : 'preflight__item--fail'}`}>
            <span className="preflight__icon">{c.ok ? 'OK' : '!!'}</span>
            <span className="preflight__label">{c.label}</span>
            <span className="preflight__detail">{c.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
