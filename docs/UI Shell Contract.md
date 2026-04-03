# PrintNest Pro — UI Shell Contract (v1.1)

本契约约束壳层尺寸、叠层与命名，实现时以 CSS 变量为准；与 [PrintNest_Pro_UI_v1.1_开发任务拆解表](PrintNest_Pro_UI_v1.1_开发任务拆解表.md) 一致。

## 尺寸

| 令牌 | 值 | 说明 |
|------|-----|------|
| `--shell-topbar-h` | 48px | AppTopBar |
| `--shell-contextbar-h` | 44px | ContextBar |
| `--shell-statusbar-h` | 28px | StatusBar |
| `--dock-rail-w` | 52px | Dock 收起态 / 竖向 rail |
| `--dock-left-expanded-w` | 320px | 左侧 Dock 展开总宽 |
| `--dock-right-expanded-w` | 340px | 右侧 Dock 展开总宽 |

## z-index 栈（从低到高）

1. `0` — Workspace / 画布底
2. `10` — Dock 展开面板（非浮层）
3. `40` — Dock rail 悬停临时浮层面板
4. `50` — OverviewCard（鹰眼）
5. `100` — 顶栏 / 上下文栏下拉菜单
6. `200` — 模态框遮罩与对话框

## 圆角（选定一套，与 tokens.css 一致）

- 控件 / 输入：`--radius-sm` 6px  
- 面板内容：`--radius-md` 10px  
- 悬浮卡片（OverviewCard）：`--radius-lg` 14px（鹰眼卡片可用 8px 视觉特例在 `canvas.css` 覆盖）

## 命名

- 壳层组件目录：`components/shell/`、`components/panels/`、`components/canvas/`
- Store：`uiShellSlice` 字段为壳层唯一来源；视图缩放等与画布强相关字段保留在 `CanvasViewSlice`

## 迁移边界（摘要）

- **保留业务逻辑**：`Toolbar.tsx` 内导入/导出/排版流程迁至 `EditorChromeProvider`；`Toolbar` 不再作为顶栏入口。
- **Sidebar**：素材/校验/Run 迁至 `LeftDock` + `panels/*`；`Sidebar.tsx` 可删或作薄 re-export。
- **Inspector**：仅承载单选/多选属性编辑；空态摘要由 `ProjectSummaryPanel` / `CanvasSummaryPanel` 承担。
