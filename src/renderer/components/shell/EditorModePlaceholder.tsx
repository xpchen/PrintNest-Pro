import React from 'react';
import type { EditorWorkMode } from '../../store/types';

const copy: Record<Exclude<EditorWorkMode, 'layout' | 'resources'>, { title: string; body: string }> = {
  template: {
    title: '模板编辑台',
    body: '可变字段、条码/二维码占位、工艺线与出血等将在此配置。当前版本为壳层占位，后续版本接入模板引擎与数据源绑定。',
  },
  output: {
    title: '输出中心',
    body: '多卷拆分、PDF/PNG/TIFF 预设、命名规则与导出历史将集中于此。当前为占位页，导出仍请使用顶栏「导出」。',
  },
};

export const EditorModePlaceholder: React.FC<{ mode: 'template' | 'output' }> = ({ mode }) => {
  const { title, body } = copy[mode];
  return (
    <div className="editor-mode-placeholder">
      <div className="editor-mode-placeholder__card">
        <h1 className="editor-mode-placeholder__title">{title}</h1>
        <p className="editor-mode-placeholder__body">{body}</p>
        <p className="editor-mode-placeholder__hint">请使用顶栏「排版」返回主工作台。</p>
      </div>
    </div>
  );
};
