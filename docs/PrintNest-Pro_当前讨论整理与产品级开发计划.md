# PrintNest Pro 当前讨论整理与产品级开发计划

> 版本：v0.1  
> 形成时间：2026-04-02  
> 适用对象：项目负责人、产品经理、技术负责人、Claude/Cursor 协作开发

---

## 1. 文档目的

本文件用于整理当前围绕 **PrintNest Pro** 的讨论结论，并将其沉淀为可执行的产品级开发方向说明。目标不是继续把现有源码当作“排版 Demo”迭代，而是将其升级为一款 **可交付、可维护、可回溯、可收费** 的桌面自动排版产品。

---

## 2. 当前源码基础能力概览

根据现有源码目录，当前项目已经具备如下基础：

```text
src/main/
  excelImport.ts
  fileManager.ts
  index.ts
  pdfExport.ts
  preload.ts

src/renderer/
  App.tsx
  components/
    CanvasArea.tsx
    Inspector.tsx
    Sidebar.tsx
    StatusBar.tsx
    Toolbar.tsx
  store/
    useAppStore.ts

src/shared/
  engine/
    LayoutScheduler.ts
    MaxRectsEngine.ts
  types/
    index.ts
  layoutSignature.ts
```

### 2.1 已具备的能力

- Electron + React 桌面端基础壳
- Zustand 状态管理
- MaxRects 自动排版能力
- 基础画布编辑能力
- Excel 导入能力
- PDF 导出能力
- 多画布、拖拽、锁定等交互雏形
- 基础项目文件管理方向

### 2.2 当前适合的定位

当前项目已经不是空壳，但更准确的定位是：

**“可演示的桌面版排版原型系统 / MVP”**

而不是：

**“成熟的产品级自动排版软件”**

---

## 3. 当前源码距离产品级的核心差距

### 3.1 数据模型仍偏算法演示层

现有核心类型主要围绕：

- PrintItem
- LayoutUnit
- Placement
- Canvas
- LayoutResult

这类模型适合完成“算法能不能跑”，但不够支撑“产品能不能卖”。产品级至少需要补齐以下业务实体：

- Project
- Asset / Artwork
- ArtworkItem
- Material / CanvasProfile
- LayoutJob
- LayoutRun
- PlacementRevision
- ImportTemplate
- ExportProfile
- MachineProfile
- AuditLog

### 3.2 排版执行仍运行在 UI 逻辑层

当前排版逻辑与 `useAppStore.ts` 等前端状态逻辑耦合较深，直接带来以下问题：

- 大批量排版时 UI 容易卡顿
- 难以支持进度条 / 取消任务 / 超时控制
- 难以保存完整排版历史
- 难以扩展多算法对比和批量任务

### 3.3 锁定、局部重排、可追溯性不足

如果 `LayoutUnit` 等中间对象在每次运行时重新生成 ID，会导致：

- 锁定对象难以稳定绑定
- 局部重排结果不可靠
- 历史记录无法准确追溯

### 3.4 导出尺寸语义混乱

当前排版结果中的 placement 宽高容易混入：

- 设计尺寸
- 出血/工艺补偿尺寸
- 间距/占位尺寸

这样虽然“能导出”，但不利于真实生产，容易出现：

- 成品尺寸和工艺尺寸混淆
- 预览尺寸和生产输出尺寸不一致
- 后期接裁切标记、套准标记、设备模板时结构混乱

### 3.5 项目系统仍停留在“文件保存”层

当前 `fileManager.ts` 的方向是正确的，但还不算完整的项目系统。产品级需要进一步支持：

- 项目元数据
- 资源索引
- 自动保存
- 崩溃恢复
- 排版版本记录
- 导出记录
- schema version 管理

### 3.6 工程化底座明显不足

当前项目若要交付给真实客户使用，还缺失：

- 单元测试
- 导入导出回归测试
- 大批量性能测试
- 日志与崩溃恢复
- 自动更新
- 授权 / 激活机制
- Windows 安装包与签名能力

---

## 4. 产品化的总方向

### 4.1 总体策略

**不建议推倒重写。**

最优路线是：

> 保留 Electron + React + MaxRects 的现有基线，围绕领域模型、任务执行层、项目持久化、导入导出链路和工程化能力做系统升级。

### 4.2 产品级目标定义

建议将 v1.0 定义为：

> 面向印花、裁片、图文输出等场景的桌面自动排版软件，支持项目管理、自动排版、局部重排、手动校正、生产导出与结果追溯。

---

## 5. 产品级目标能力

### 5.1 v1.0 必须完成的主流程

1. 新建项目
2. 导入图片 / Excel
3. 选择画布、材料、工艺参数
4. 设置出血、间距、旋转规则
5. 自动排版
6. 手动调整
7. 锁定元素后局部重排
8. 导出 PDF / PNG
9. 保存项目
10. 再次打开继续编辑

### 5.2 v1.0 的产品标准

不是“能演示”，而是：

- 大批量可运行
- 项目可保存
- 排版结果可复现
- 导出结果可用于生产
- 编辑过程有合法性校验
- 出错时可以恢复和追踪

---

## 6. 建议的产品级技术架构

### 6.1 分层结构

#### 应用层
- Electron
- React
- Zustand（后续可拆分 store）

#### 领域层
- Project
- Asset
- ArtworkItem
- CanvasProfile
- LayoutConfig
- LayoutJob
- LayoutRun
- Placement
- ExportTask

#### 引擎层
- MaxRectsEngine
- LayoutScheduler
- 排序策略
- 多画布调度
- 局部重排逻辑
- 合法性校验器
- Worker 执行

#### 持久化层
- SQLite
- 项目目录资源存储
- schema migration

#### 导入导出层
- Excel 模板导入
- PDF 导出
- PNG 导出
- 后续 SVG / DXF

#### 工程支撑层
- 日志
- 崩溃恢复
- 自动更新
- 授权
- 测试体系

### 6.2 建议目录演进

```text
apps/
  desktop/
packages/
  domain/
  engine/
  persistence/
  importers/
  exporters/
  shared/
```

建议迁移方向：

- `src/shared/types` → `packages/domain`
- `src/shared/engine` → `packages/engine`
- `src/main/fileManager.ts` → `packages/persistence`
- `src/main/excelImport.ts` → `packages/importers`
- `src/main/pdfExport.ts` → `packages/exporters`

---

## 7. 产品级数据模型建议

### 7.1 核心实体

#### Project
项目主实体，包含：
- id
- name
- schemaVersion
- createdAt / updatedAt
- defaultUnit
- defaultCanvasProfileId

#### Asset
素材实体，包含：
- id
- sourcePath
- managedPath
- fileHash
- pixelWidth / pixelHeight
- dpiX / dpiY
- importedAt

#### ArtworkItem
待排物料实例，包含：
- id
- assetId
- name
- designWidth / designHeight
- quantity
- canRotate
- priority
- groupCode

#### CanvasProfile
母版/画布模板，包含：
- id
- name
- width / height
- marginTop / Right / Bottom / Left
- type（sheet / roll）

#### LayoutConfig
排版配置，包含：
- bleed
- spacingX / spacingY
- edgeSafeDistance
- allowRotate90
- singleCanvas
- sortStrategy
- algorithm

#### LayoutRun
排版运行记录，包含：
- runId
- projectId
- configSnapshot
- engineVersion
- durationMs
- utilizationRatio
- warnings / errors

#### Placement
排版落位结果，包含：
- id
- layoutRunId
- artworkItemId
- copyIndex
- canvasIndex
- x / y
- rotation
- packedWidth / packedHeight
- isLocked
- sourceRevisionId

### 7.2 尺寸模型必须拆成三层

#### 设计尺寸
原图或业务定义尺寸

#### 工艺尺寸
出血、缝边、补偿、刀缝、安全边

#### 占位尺寸
真正进入排版算法的尺寸

建议字段：

- `designWidth / designHeight`
- `bleedTop / bleedRight / bleedBottom / bleedLeft`
- `spacingX / spacingY`
- `packedWidth / packedHeight`

---

## 8. 项目系统建设建议

### 8.1 项目目录结构

```text
{project}/
  project.db
  assets/
  exports/
  snapshots/
  temp/
```

### 8.2 SQLite 表建议

- projects
- assets
- artwork_items
- canvas_profiles
- layout_jobs
- layout_runs
- placements
- exports
- import_templates
- app_settings

### 8.3 必须支持的项目能力

- 新建项目
- 打开项目
- 最近项目
- 自动保存
- 崩溃恢复
- schema migration
- 素材完整性校验

---

## 9. 排版引擎产品化建议

### 9.1 关键改造点

- 从 UI 层抽离为独立引擎模块
- 支持 Worker 执行
- 支持进度、取消、错误回传
- 保持稳定 ID
- 支持局部重排
- 增加合法性校验

### 9.2 合法性校验建议

至少包括：

- 越界校验
- 碰撞校验
- 最小间距校验
- 安全边校验
- 单画布容量校验

### 9.3 每次排版必须记录的内容

- runId
- 输入快照
- 引擎版本
- 参数版本
- 耗时
- 利用率
- 未排入列表
- 错误和警告

---

## 10. 交互层产品化建议

### 10.1 store 拆分建议

当前 `useAppStore.ts` 建议拆分为：

- projectStore
- canvasStore
- selectionStore
- layoutJobStore
- uiStore

### 10.2 画布编辑能力升级

建议补齐：

- 吸附
- 标尺 / 网格
- 安全边界显示
- 拖拽过程中的碰撞提示
- 越界提示
- 框选 / 多选
- 批量操作
- 撤销 / 重做

### 10.3 Inspector 升级

属性面板需要从“Demo 面板”升级为“编辑器面板”，支持：

- 原始尺寸
- 工艺尺寸
- 占位尺寸
- 出血
- 间距
- 旋转权限
- 优先级
- 锁定状态
- 数据来源

---

## 11. 导入导出链路建议

### 11.1 Excel 导入

当前 `excelImport.ts` 建议升级为“模板导入系统”：

- 模板管理
- 列映射
- 单位配置
- 表头识别
- 导入预览
- 错误报告

### 11.2 图片导入

建议在导入时记录：

- 实际像素尺寸
- DPI
- 文件 hash
- 重复素材识别结果
- 缺失素材提醒

### 11.3 PDF / PNG 导出

当前 `pdfExport.ts` 建议重构为正式导出链路：

- 预览输出模式
- 生产输出模式
- artwork 区 / bleed 区 / safe area 区分
- crop marks / registration marks
- 输出 profile
- 导出记录持久化

---

## 12. 工程化与发布建议

### 12.1 测试体系

至少应包含：

- 排版引擎单元测试
- Excel 导入测试
- PDF 导出回归测试
- store 测试
- 大批量性能测试

### 12.2 日志与恢复

建议加入：

- app log
- engine log
- export log
- crash dump
- 重启恢复提示

### 12.3 产品交付能力

- Windows 安装包
- 自动更新
- 版本号管理
- license / 激活
- 试用机制（如需）

---

## 13. 建议的阶段性实施路径

### 阶段 0：基线加固
- 统一规范
- 建立回归样本
- 修正明显逻辑问题
- 形成稳定基线版本

### 阶段 1：数据模型与项目系统升级
- 领域模型重构
- SQLite 项目系统
- 自动保存 / 恢复
- 资源索引建立

### 阶段 2：排版引擎产品化
- 引擎独立
- Worker 化
- 稳定 ID
- 局部重排
- 合法性校验
- 排版运行历史

### 阶段 3：交互层升级
- 画布安全交互
- Inspector 重构
- 撤销/重做
- 多选/批量操作

### 阶段 4：导入导出链路重做
- Excel 模板导入
- PDF/PNG 正式输出
- 导出记录

### 阶段 5：工程化与发布
- 测试体系
- 日志
- 安装包
- 自动更新
- 授权基础

### 阶段 6：商业增强项
- 卷材模式
- 禁排区
- 设备模板
- 多项目批处理
- 报表 / 审计
- 云同步

---

## 14. 优先级建议

### P0 必做
- 领域模型升级
- SQLite 项目系统
- 稳定 ID
- Worker 化排版
- 合法性校验
- PDF 导出重构

### P1 应做
- Excel 模板导入
- 撤销/重做
- 画布吸附和碰撞提示
- 自动保存和恢复
- 导出记录

### P2 商用增强
- 自动更新
- license
- 机器/设备模板
- 批量任务
- 日志中心

---

## 15. 首批应优先重构的文件

建议第一批优先处理：

1. `src/shared/types/index.ts`
2. `src/shared/engine/LayoutScheduler.ts`
3. `src/shared/engine/MaxRectsEngine.ts`
4. `src/renderer/store/useAppStore.ts`
5. `src/main/fileManager.ts`
6. `src/main/pdfExport.ts`
7. `src/main/excelImport.ts`

建议第二批再处理：

1. `src/renderer/components/CanvasArea.tsx`
2. `src/renderer/components/Inspector.tsx`
3. `src/renderer/components/Toolbar.tsx`
4. `src/renderer/components/StatusBar.tsx`

---

## 16. 结论

PrintNest Pro 当前已经具备明确的产品雏形和较好的技术起点。最优路线不是重写，而是在现有 Electron + React + MaxRects 基线上完成一次系统升级：

- 从算法模型升级为业务模型
- 从内存态升级为项目系统
- 从 UI 直跑升级为任务执行引擎
- 从演示导出升级为生产导出
- 从前端原型升级为可发布桌面产品

真正决定它能不能成为产品的，不是按钮多少，而是这五件事：

1. 项目能存
2. 结果能复现
3. 导出能生产
4. 编辑有校验
5. 出错能恢复

只要这五件事做稳，PrintNest Pro 就可以从当前源码，持续演进为真正可交付的自动排版软件。
