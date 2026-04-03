/**
 * 模板工作区 — 三栏布局：左(模板列表+元素树) / 中(画布) / 右(属性面板)
 */
import React from 'react';
import { TemplateList } from './TemplateList';
import { TemplateElementTree } from './TemplateElementTree';
import { TemplateCanvas } from './TemplateCanvas';
import { TemplateInspector } from './TemplateInspector';

export const TemplateWorkspace: React.FC = () => {
  return (
    <div className="tpl-workspace">
      <aside className="tpl-workspace__left">
        <TemplateList />
        <TemplateElementTree />
      </aside>
      <main className="tpl-workspace__center">
        <TemplateCanvas />
      </main>
      <aside className="tpl-workspace__right">
        <TemplateInspector />
      </aside>
    </div>
  );
};
