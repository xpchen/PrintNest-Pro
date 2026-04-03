# PrintNest Pro UI v1.1 开发任务拆解表

## 1. 文档目标

本任务表用于把 **PrintNest Pro UI v1.1 改造蓝图** 落成可执行开发清单。目标不是继续堆业务功能，而是在尽量不破坏现有排版、Run、手工调整、DB 持久化链路的前提下，把当前版本升级为更接近产品级的桌面工作台。

本版 UI 改造聚焦四件事：

1. 顶部从“单层大工具栏”升级为“全局动作层 + 当前上下文参数层”。
2. 左右区域升级为可展开 / 可收起的 Dock 系统。
3. 画布小地图升级为更专业的 OverviewCard（鹰眼导航卡片）。
4. 右侧从“空属性面板”升级为“始终有信息价值的上下文中心”。

---

## 2. 当前基线（作为改造前提）

### 2.1 已有结构
- App 主体仍是典型五区布局：`Toolbar | Sidebar | CanvasArea | Inspector | StatusBar`
- 顶部 `Toolbar` 仍承担导入、自动排版、策略、画布设置、导出等多类职责
- 左侧 `Sidebar` 仍以素材列表为主
- 中间 `CanvasArea` 已承载画布交互、拖拽导入、layout stale banner 等能力
- 右侧 `Inspector` 已具备单选 / 多选属性编辑基础，但空态信息弱
- 底部 `StatusBar` 已混合展示利用率、校验、Run 导出、耗时、版本号等信息

### 2.2 本版改造原则
- **不重写业务排版内核**
- **不破坏 manual edits / run 历史 / DB 权威链路**
- **优先重构壳层、信息架构、视觉语义、导航体验**
- **优先通过新增壳层组件承接改造，尽量少在旧组件内持续膨胀**

---

## 3. 目标目录结构（建议）

```text
src/renderer/
  components/
    shell/
      AppTopBar.tsx
      ContextBar.tsx
      LeftDock.tsx
      RightDock.tsx
      DockRail.tsx
    canvas/
      CanvasHeader.tsx
      OverviewCard.tsx
      SegmentNavigator.tsx
    panels/
      AssetsPanel.tsx
      ValidationPanel.tsx
      RunPanel.tsx
      ProjectSummaryPanel.tsx
      CanvasSummaryPanel.tsx
    project/
      ProjectHome.tsx            // 现有，继续沿用并补风格
  store/
    uiShellSlice.ts
    useAppStore.ts               // 接入新 slice
  styles/
    tokens.css
    shell.css
    dock.css
    panel.css
    canvas.css
    status.css
```

---

## 4. 任务拆解总览

| Phase | 目标 | 结果 |
|---|---|---|
| P0 | UI 基线冻结与设计契约 | 明确尺寸、层级、命名、组件边界 |
| P1 | 双层头部与主壳体重构 | 顶部两层化，Workspace 骨架建立 |
| P2 | 左侧 Dock 与三 Tab 面板 | 素材 / 校验 / Run 成为一等工作视图 |
| P3 | 中央画布控制与 OverviewCard | 画布导航专业化，缩放/分段统一 |
| P4 | 右侧 Dock 与上下文属性中心 | 空态有价值，单选/多选更完整 |
| P5 | StatusBar 收口与视觉令牌统一 | 整体风格统一，状态条去工程味 |
| P6 | 联调、回归、验收 | 旧功能不回退，新壳层稳定可用 |

---

## 5. 详细任务表

## P0：UI 基线冻结与设计契约

| ID | 模块 | 关键文件 | 工作内容 | 输出物 | 验收标准 | Claude 执行单元 |
|---|---|---|---|---|---|---|
| P0-01 | 设计契约 | `docs/` 新增文档 | 输出《UI Shell Contract》：顶部高度、Dock 宽度、Rail 宽度、状态栏高度、颜色语义、z-index 规则、命名规范 | UI Shell Contract.md | 后续组件开发不再临时定尺寸 | 适合独立给 Claude |
| P0-02 | 组件边界 | `App.tsx`、`Toolbar.tsx`、`Sidebar.tsx`、`Inspector.tsx` | 标记哪些能力保留在旧组件，哪些迁出到新壳层组件 | 迁移清单 | 不出现“旧组件继续变更越来越大” | 适合独立给 Claude |
| P0-03 | 状态规划 | `store/types.ts`、`useAppStore.ts` | 确定 `UiShellSlice` 字段、命令入口、默认值、持久化范围 | 状态字段清单 | 状态名清晰，避免和业务态耦合 | 适合独立给 Claude |

### P0 建议新增状态

```ts
export type DockMode = 'expanded' | 'collapsed';
export type LeftTab = 'assets' | 'validation' | 'runs';
export type RightTab = 'properties' | 'project' | 'canvas';
export type FitMode = 'fitWidth' | 'fitAll' | 'custom';

export interface UiShellSlice {
  leftDockMode: DockMode;
  rightDockMode: DockMode;
  leftTab: LeftTab;
  rightTab: RightTab;
  fitMode: FitMode;
  overviewVisible: boolean;
  propertyBarVisible: boolean;
  toggleLeftDock(): void;
  toggleRightDock(): void;
  setLeftTab(tab: LeftTab): void;
  setRightTab(tab: RightTab): void;
  setFitMode(mode: FitMode): void;
  setOverviewVisible(v: boolean): void;
}
```

---

## P1：双层头部与主壳体重构

| ID | 模块 | 关键文件 | 工作内容 | 输出物 | 验收标准 | Claude 执行单元 |
|---|---|---|---|---|---|---|
| P1-01 | AppFrame 重构 | `App.tsx` | 将当前单层 `Toolbar + body + StatusBar` 重构为 `AppTopBar + ContextBar + Workspace + StatusBar` | 新版 App 结构 | 现有业务功能仍可运行 | 高优先级独立任务 |
| P1-02 | AppTopBar | `components/shell/AppTopBar.tsx` | 承接项目级动作：项目菜单、导入图片、导入 Excel、导出、帮助、自动排版入口 | 新组件 | 顶部主动作清晰 | 可独立 |
| P1-03 | ContextBar | `components/shell/ContextBar.tsx` | 承接当前项目参数：策略、单画布、宽高、间距、出血、安全边、单位等 | 新组件 | 参数区和动作区分层 | 可独立 |
| P1-04 | Toolbar 拆分迁移 | `Toolbar.tsx` | 从旧 Toolbar 抽离逻辑到新 AppTopBar / ContextBar，旧 Toolbar 逐步退役或仅保留临时桥接 | 迁移后的逻辑 | 无重复 UI 控件并存 | 需和 P1-02/P1-03 联动 |
| P1-05 | Workspace 骨架 | `components/shell/LeftDock.tsx`、`RightDock.tsx` | 建立三段式工作区：LeftDock / CenterStage / RightDock | Workspace 骨架 | 左中右三段布局稳定 | 可独立 |
| P1-06 | 命令接线 | `app:command` 相关 | 将顶部新控件与既有 `app:command` 入口对齐 | 命令映射清单 | 菜单与按钮行为一致 | 联动任务 |

### P1 交付结果
- 顶部不再是一条混合工具带
- 自动排版仍为唯一主 CTA
- 项目级动作与参数级配置显式分层
- 旧 Toolbar 不再继续承载新增职责

---

## P2：左侧 Dock 与三 Tab 面板

| ID | 模块 | 关键文件 | 工作内容 | 输出物 | 验收标准 | Claude 执行单元 |
|---|---|---|---|---|---|---|
| P2-01 | LeftDock 容器 | `components/shell/LeftDock.tsx` | 实现展开态 / 收起态 / rail 结构 | 新组件 | 左侧可收起 | 可独立 |
| P2-02 | DockRail | `components/shell/DockRail.tsx` | 实现 icon + badge + active 状态的竖向 rail | 新组件 | 收起后仍可切换 tab | 可独立 |
| P2-03 | AssetsPanel | `components/panels/AssetsPanel.tsx` | 从 Sidebar 中抽出素材列表；补搜索、筛选、排序、统计条 | 新组件 | 素材视图更像产品列表 | 高优先级 |
| P2-04 | ValidationPanel | `components/panels/ValidationPanel.tsx` | 新增错误 / 警告 / 提示分组；点击项定位画布对象 | 新组件 | 校验从底栏迁入主面板 | 可独立 |
| P2-05 | RunPanel | `components/panels/RunPanel.tsx` | 展示当前 Run 与历史 Run：时间、策略、画布数、利用率、未排入数、导出按钮 | 新组件 | Run 成为独立视图 | 高优先级 |
| P2-06 | Sidebar 退役或瘦身 | `Sidebar.tsx` | 旧 Sidebar 内容迁移完后，保留桥接或替换为 AssetsPanel 容器 | 重构后的 Sidebar | 不再与新面板重复 | 联动 |
| P2-07 | LeftDock 状态持久化 | `uiShellSlice.ts`、持久化层 | 保存左侧当前 tab、展开/收起状态 | 状态持久化 | 重启后恢复工作上下文 | 可独立 |

### P2 面板设计要求

#### AssetsPanel
- 顶部：搜索框、筛选、排序、清空
- 中部：素材卡片/行项
- 底部：统计区（总件数、总面积、未排入数）

#### ValidationPanel
- 顶部：筛选（全部 / 错误 / 警告 / 提示）
- 中部：问题列表
- 行为：点击即定位并高亮相关对象

#### RunPanel
- 当前 Run 卡片
- 历史 Run 列表
- 导出当前 Run PDF / 历史 Run PDF
- 显示耗时、利用率、未排入数

---

## P3：中央画布控制与 OverviewCard

| ID | 模块 | 关键文件 | 工作内容 | 输出物 | 验收标准 | Claude 执行单元 |
|---|---|---|---|---|---|---|
| P3-01 | CanvasHeader | `components/canvas/CanvasHeader.tsx` | 从 CanvasArea 中抽出画布级控制条：画布 tab、缩放、显示开关、利用率 | 新组件 | 画布控制集中 | 高优先级 |
| P3-02 | OverviewCard | `components/canvas/OverviewCard.tsx` | 将小地图升级为悬浮导航卡片：全卷缩略、当前 viewport、点击跳转、拖动视口 | 新组件 | 小地图更专业 | 高优先级 |
| P3-03 | SegmentNavigator | `components/canvas/SegmentNavigator.tsx` | 把分段控件并入 OverviewCard 或 CanvasHeader 下方局部区域 | 新组件 | 分段与导航统一 | 可独立 |
| P3-04 | CanvasArea 瘦身 | `CanvasArea.tsx` | 保留画布渲染、拖拽、视口控制、选择框；移出顶部控制与小地图容器 | 精简后的 CanvasArea | 单一职责更清晰 | 联动 |
| P3-05 | viewportFocus 接入 | 现有 viewportFocus 链路 | 让 ValidationPanel / RunPanel / Inspector 的定位动作统一调用 viewportFocus | 统一导航行为 | 所有定位体验一致 | 需与现有代码联调 |
| P3-06 | stale 状态重做 | `CanvasHeader.tsx`、`CanvasArea.tsx` | 将 `layout stale banner` 改为更轻量的状态胶囊/提示条 | 统一状态提示 | 不再压迫画布主区域 | 可独立 |

### P3 OverviewCard 视觉要求
- 右下角悬浮卡片
- 深色半透明底 + 细描边
- 当前视口框高亮但不过度刺眼
- 分段信息、头/中/尾快速跳转
- 悬浮显示当前 viewport 范围

### P3 交互要求
- 点击 minimap 任意区域：跳转视图
- 拖动视口框：平移
- 上一段 / 下一段：跳转段
- 双击：适应宽度或回到默认视图

---

## P4：右侧 Dock 与上下文属性中心

| ID | 模块 | 关键文件 | 工作内容 | 输出物 | 验收标准 | Claude 执行单元 |
|---|---|---|---|---|---|---|
| P4-01 | RightDock 容器 | `components/shell/RightDock.tsx` | 与左侧一致支持展开 / 收起 / rail 形态 | 新组件 | 右侧可收起 | 可独立 |
| P4-02 | ProjectSummaryPanel | `components/panels/ProjectSummaryPanel.tsx` | 无选中时展示项目摘要、当前 Run 摘要、素材统计、校验摘要 | 新组件 | 空态不再空洞 | 高优先级 |
| P4-03 | CanvasSummaryPanel | `components/panels/CanvasSummaryPanel.tsx` | 展示当前画布尺寸、利用率、边距、出血、段信息 | 新组件 | 当前画布上下文清晰 | 可独立 |
| P4-04 | Inspector 重构 | `Inspector.tsx` | 继续承接单选 / 多选编辑，但改为作为 RightDock 内的 properties pane 使用 | 重构后的 Inspector | 仍保留既有属性编辑逻辑 | 高优先级 |
| P4-05 | 空态提升 | `Inspector.tsx` 或 `ProjectSummaryPanel.tsx` | 将原“点击画布元素查看属性”升级为有价值的项目概览视图 | 新空态 | 无选中时仍有信息价值 | 可独立 |
| P4-06 | 批量动作整理 | `Inspector.tsx` | 多选态整理为动作区 + 批量字段区：锁定、删除、对齐、优先级等 | 更清晰的多选 UI | 多选操作密度更高但不乱 | 可独立 |
| P4-07 | RightDock 状态持久化 | `uiShellSlice.ts` | 保存右侧展开/收起、当前 tab | 状态持久化 | 重启后恢复 | 可独立 |

### P4 右侧内容态设计

#### 无选中态
- 项目名 / 最近保存 / 当前 Run / 素材统计 / 校验摘要 / 操作提示

#### 单选态
- 基础信息
- 位置、尺寸、旋转、锁定、优先级
- bleed / spacing / 可旋转状态
- 所属素材引用

#### 多选态
- 已选数量
- 锁定统计
- 对齐按钮
- 批量锁定 / 解锁 / 删除
- 批量优先级、批量安全边策略（如适配）

---

## P5：StatusBar 收口与视觉令牌统一

| ID | 模块 | 关键文件 | 工作内容 | 输出物 | 验收标准 | Claude 执行单元 |
|---|---|---|---|---|---|---|
| P5-01 | StatusBar 精简 | `StatusBar.tsx` | 将主操作与大段摘要迁出，只保留利用率、校验态、进度、版本等会话级状态 | 精简后的 StatusBar | 底栏不再像工程状态台 | 高优先级 |
| P5-02 | 导出入口迁移 | `RunPanel.tsx`、`StatusBar.tsx` | 把“导出此 Run PDF”主入口迁至 RunPanel，底栏可仅保留轻量入口或去除 | 更合理的导出位置 | Run 相关操作聚合 | 可独立 |
| P5-03 | tokens.css | `styles/tokens.css` | 抽离颜色、间距、圆角、阴影、尺寸为令牌 | 新样式文件 | 样式不再散落硬编码 | 高优先级 |
| P5-04 | shell.css | `styles/shell.css` | 统一顶部、Dock、Workspace、Rail 布局 | 新样式文件 | 壳层风格统一 | 可独立 |
| P5-05 | panel.css | `styles/panel.css` | 统一卡片、列表、标题、badge、空态 | 新样式文件 | 面板风格一致 | 可独立 |
| P5-06 | canvas.css | `styles/canvas.css` | 统一画布背景、边界、尺规、网格、OverviewCard | 新样式文件 | 画布更克制专业 | 可独立 |
| P5-07 | 旧 global.css 拆分 | `global.css` | 将巨型全局样式逐步拆分并建立 import 顺序 | 重构后的样式层 | 减少后续样式污染 | 联动任务 |

### P5 建议令牌

```css
:root {
  --surface-base: #181a24;
  --surface-panel: #222536;
  --surface-elevated: #2a2f44;
  --surface-canvas: #31354a;

  --text-primary: rgba(255,255,255,0.92);
  --text-secondary: rgba(255,255,255,0.62);
  --border-default: rgba(255,255,255,0.10);

  --accent-primary: #6f6dff;
  --accent-soft: rgba(111,109,255,0.18);

  --status-success: #38c172;
  --status-warning: #f5b942;
  --status-danger: #ff6b6b;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;

  --topbar-h: 48px;
  --contextbar-h: 44px;
  --statusbar-h: 28px;
  --dock-rail-w: 52px;
  --left-dock-w: 320px;
  --right-dock-w: 340px;
}
```

---

## P6：联调、回归、验收

| ID | 模块 | 关键文件 | 工作内容 | 输出物 | 验收标准 | Claude 执行单元 |
|---|---|---|---|---|---|---|
| P6-01 | 交互回归 | 全 UI | 回归导入图片、导入 Excel、自动排版、导出、手工调整、Run 历史、DB 自动保存 | 回归清单 | 旧功能无重大回退 | 必做 |
| P6-02 | 定位链路回归 | Validation / Run / Inspector / Overview | 验证所有定位动作是否统一到 viewportFocus，且跳转后视图行为一致 | 跳转回归记录 | 视图跳转无明显割裂 | 必做 |
| P6-03 | 响应与性能 | CanvasArea、OverviewCard | 检查大批量素材、长画布、切换 Dock、显示 minimap 时是否明显卡顿 | 性能记录 | 常见场景可接受 | 必做 |
| P6-04 | 状态持久化 | uiShellSlice、项目持久化 | 验证项目重开后：tab、dock 状态、overview 显示状态是否正确恢复 | 状态恢复报告 | 用户工作上下文可恢复 | 必做 |
| P6-05 | 发布验收 | 全项目 | 形成 UI v1.1 验收清单 | 验收文档 | 满足产品级壳层目标 | 必做 |

---

## 6. 建议开发顺序（最小破坏）

### 顺序 A：先壳后面板
1. `P1-01 ~ P1-05`：先把 App 外壳搭起来
2. `P2-01 ~ P2-03`：先把左侧素材面板迁过去
3. `P4-01 ~ P4-04`：再把右侧属性面板接进去
4. `P3-01 ~ P3-04`：最后把画布导航与小地图升级

**优点**：不会一上来就同时动所有组件，风险较低。

### 顺序 B：先视觉拉开差距
1. 双层头部
2. 左右可收起 Dock
3. OverviewCard
4. StatusBar 收口

**优点**：最先提升观感，适合快速出下一版演示。

---

## 7. 推荐里程碑

| 里程碑 | 内容 | 对外观感变化 |
|---|---|---|
| M1 | 双层头部 + 左右 Dock 骨架 | 已明显从工程稿变成桌面工作台 |
| M2 | 左侧三 Tab + 右侧上下文中心 | 使用逻辑开始像产品 |
| M3 | OverviewCard + CanvasHeader | 专业感显著提升 |
| M4 | StatusBar 收口 + 样式统一 | 细节完成度显著提升 |

---

## 8. 最高优先级任务（建议先做）

### T1：双层头部
这是提升产品感最直接的一刀。当前顶部职责过载，先拆分后，界面主次会立刻清晰。

### T2：左右 Dock 收起体系
这是提升工作区效率最明显的一刀。长画布、密集素材场景下价值很高。

### T3：OverviewCard
这是把“好用”进一步升级成“专业”的关键一刀。

---

## 9. Claude 执行建议

建议不要把整套 UI v1.1 一次性丢给 Claude，而是拆成以下粒度：

### 一次可交给 Claude 的合适单元
1. `App.tsx + AppTopBar + ContextBar` 壳层重构
2. `LeftDock + DockRail + AssetsPanel`
3. `ValidationPanel + RunPanel`
4. `CanvasHeader + OverviewCard + SegmentNavigator`
5. `RightDock + ProjectSummaryPanel + CanvasSummaryPanel`
6. `Inspector` 重构（只改 UI，不动核心编辑逻辑）
7. `StatusBar` 精简
8. `styles/*.css` 拆分与令牌统一
9. `uiShellSlice` 状态接入与持久化

### 不建议一次性给 Claude 的范围
- 同时改 `App.tsx + CanvasArea + Inspector + Sidebar + styles + store`
- 同时改 UI 壳层、DB 持久化、run 历史、manual edits

原因：范围过大时，最容易把现有可工作的链路破坏掉。

---

## 10. 最终验收标准

做完 UI v1.1 后，至少满足以下标准：

1. 顶部能明显看出“全局动作”和“当前参数”是两层。
2. 左右都能收起，收起后仍能高效切换面板。
3. 小地图不再像调试控件，而是专业导航器。
4. 无选中状态下，右侧仍有项目与画布信息价值。
5. 底栏不再承担主操作，不再显得杂乱。
6. 画布区、面板区、状态区的视觉语义统一。
7. 现有排版、Run、manual edits、导出、自动保存不被破坏。

---

## 11. 一句话结论

这版任务拆解的核心不是“继续加界面元素”，而是把你已经具备的底层能力，重新包装成 **真正可交付、可持续迭代的产品壳层**。先把壳收住，后续自动排版、项目系统、Run 历史、导出链路，都会更容易往产品级推进。
