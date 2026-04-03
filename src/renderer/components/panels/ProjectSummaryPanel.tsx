import React from 'react';
import { useAppStore } from '../../store/useAppStore';

export const ProjectSummaryPanel: React.FC = () => {
  const projectName = useAppStore((s) => s.projectName);
  const items = useAppStore((s) => s.items);
  const result = useAppStore((s) => s.result);
  const lastLayoutRunId = useAppStore((s) => s.lastLayoutRunId);
  const val = result?.validation;

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const errN = val?.issues.filter((i) => i.severity === 'error').length ?? 0;
  const warnN = val ? val.issues.length - errN : 0;

  return (
    <div className="panel-summary">
      <div className="panel-summary__block">
        <div className="panel-summary__h">项目</div>
        <div className="panel-summary__v">{projectName}</div>
        <div className="panel-summary__hint">最近保存由自动保存与 DB 维护</div>
      </div>
      <div className="panel-summary__block">
        <div className="panel-summary__h">素材</div>
        <div className="panel-summary__v">
          {items.length} 种 / {totalQty} 件
        </div>
      </div>
      <div className="panel-summary__block">
        <div className="panel-summary__h">当前 Run</div>
        <div className="panel-summary__v mono">{lastLayoutRunId ? `${lastLayoutRunId.slice(0, 8)}…` : '—'}</div>
      </div>
      <div className="panel-summary__block">
        <div className="panel-summary__h">校验摘要</div>
        <div className="panel-summary__v">
          {val
            ? errN > 0 || warnN > 0
              ? `${errN} 错误 · ${warnN} 提示`
              : '通过'
            : '无排版结果'}
        </div>
      </div>
      <div className="panel-summary__hint panel-summary__block">
        在左侧「素材 / 校验 / Run」与中间画布之间切换；选中对象后在「属性」Tab 编辑。
      </div>
    </div>
  );
};
