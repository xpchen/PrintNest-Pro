# 排版测试样本

- `sample-10-items.json`：少量物料 + 含 `spacing:0` / `bleed:0` 行，用于校验与全局回退逻辑。
- `sample-single-canvas.json`：单画布 + 多件，用于「未排入」列表与提示。

使用方式：在单元测试或脚本中读取 JSON，构造 `PrintItem[]` 与 `LayoutConfig` 后调用 `runLayout`（或 `executeLayoutJob`）。
