# 画布视口约定（单一真相）

与「产品级 UI 改造 v1」计划 §1.2a 一致；所有小地图、分段、菜单、`focusRectInViewport` 须遵守。

## panOffset

- `panOffset.x`、`panOffset.y`：**画布坐标原点 (0,0) 在画布 HTML 元素坐标系中的像素位置**（先 `translate(panOffset)` 再 `scale(zoom)` 绘制画布 mm 内容）。
- 禁止将「视口中心在画布上的 mm 坐标」直接存进 `panOffset`；若计算中使用中心点，写入 store 前必须换算为上述定义。

## zoom

- **`zoom === 1`**：**1 画布毫米（mm）对应 1 个 CSS 像素**（逻辑像素，不乘 DPR）。
- `fitAll` / `fitWidth` 得到的标量与此一致。

## 分段与 focusRectInViewport

- **默认对齐**：`mode: 'top'` 时，将目标矩形**顶边**（减 padding）对齐到视口可见区域**顶边**（画布坐标系）。
- `mode: 'center'`：目标矩形中心对齐视口中心。

## 屏幕坐标 → 画布 mm

在容器内点 `(sx, sy)`（相对画布元素左上角）：

`mmX = (sx - panOffset.x) / zoom`  
`mmY = (sy - panOffset.y) / zoom`
