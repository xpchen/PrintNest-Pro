/**
 * 排版结果合法性校验：越界、碰撞、最小间距、安全边、单画布溢出与参数风险提示。
 */
import type {
  LayoutConfig,
  LayoutResult,
  LayoutValidationIssue,
  LayoutValidationReport,
  Placement,
  PrintItem,
} from '../types';

const EPS = 1e-4;

function itemById(items: PrintItem[], id: string): PrintItem | undefined {
  return items.find((i) => i.id === id);
}

function minPairSpacing(a: PrintItem | undefined, b: PrintItem | undefined, global: number): number {
  const sa = a != null && Number.isFinite(a.spacing) ? a.spacing : global;
  const sb = b != null && Number.isFinite(b.spacing) ? b.spacing : global;
  return Math.max(0, global, sa, sb);
}

/** 轴对齐矩形是否面积相交（含贴边不算相交，与 EPS 容差） */
function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  const ix = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
  const iy = Math.min(ay + ah, by + bh) - Math.max(ay, by);
  return ix > EPS && iy > EPS;
}

/** 膨胀后的矩形是否面积相交（用于最小间距：外边之间至少 minGap） */
function inflatedOverlap(
  p: Placement,
  q: Placement,
  padP: number,
  padQ: number,
): boolean {
  return rectsOverlap(
    p.x - padP,
    p.y - padP,
    p.width + 2 * padP,
    p.height + 2 * padP,
    q.x - padQ,
    q.y - padQ,
    q.width + 2 * padQ,
    q.height + 2 * padQ,
  );
}

function checkBoundsAndSafeEdge(
  p: Placement,
  cw: number,
  ch: number,
  edgeSafe: number,
  canvasIndex: number,
  issues: LayoutValidationIssue[],
): void {
  if (p.x < -EPS || p.y < -EPS || p.x + p.width > cw + EPS || p.y + p.height > ch + EPS) {
    issues.push({
      severity: 'error',
      kind: 'out_of_bounds',
      message: `落位超出画布: ${p.id}`,
      canvasIndex,
      placementIds: [p.id],
    });
  }
  if (edgeSafe > EPS) {
    if (
      p.x < edgeSafe - EPS ||
      p.y < edgeSafe - EPS ||
      p.x + p.width > cw - edgeSafe + EPS ||
      p.y + p.height > ch - edgeSafe + EPS
    ) {
      issues.push({
        severity: 'warning',
        kind: 'safe_edge',
        message: `未满足安全边 ≥ ${edgeSafe}mm: ${p.id}`,
        canvasIndex,
        placementIds: [p.id],
      });
    }
  }
}

/**
 * 对当前排版结果做完整校验并合并参数风险提示。
 */
export function buildLayoutValidationReport(
  result: LayoutResult,
  items: PrintItem[],
  config: LayoutConfig,
): LayoutValidationReport {
  const issues: LayoutValidationIssue[] = [];
  const cw = config.canvas.width;
  const ch = config.canvas.height;
  const edgeSafe = config.edgeSafeMm ?? 0;

  for (const canvas of result.canvases) {
    const list = canvas.placements;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      checkBoundsAndSafeEdge(p, cw, ch, edgeSafe, canvas.index, issues);

      const ip = itemById(items, p.printItemId);
      for (let j = i + 1; j < list.length; j++) {
        const q = list[j];
        const iq = itemById(items, q.printItemId);

        const overlapping = rectsOverlap(p.x, p.y, p.width, p.height, q.x, q.y, q.width, q.height);
        if (overlapping) {
          issues.push({
            severity: 'error',
            kind: 'overlap',
            message: `元素碰撞: ${p.id} 与 ${q.id}`,
            canvasIndex: canvas.index,
            placementIds: [p.id, q.id],
          });
        } else {
          const gapNeed = minPairSpacing(ip, iq, config.globalSpacing);
          if (gapNeed > EPS) {
            const padP = gapNeed / 2;
            const padQ = gapNeed / 2;
            if (inflatedOverlap(p, q, padP, padQ)) {
              issues.push({
                severity: 'warning',
                kind: 'spacing_violation',
                message: `间距可能不足（要求约 ≥ ${gapNeed.toFixed(2)}mm）: ${p.id} / ${q.id}`,
                canvasIndex: canvas.index,
                placementIds: [p.id, q.id],
              });
            }
          }
        }
      }
    }
  }

  if (config.singleCanvas && result.unplaced.length > 0) {
    issues.push({
      severity: 'error',
      kind: 'single_canvas_overflow',
      message: `单画布模式下仍有 ${result.unplaced.length} 件未排入`,
      canvasIndex: 0,
    });
  }

  const canvasArea = cw * ch;
  if (canvasArea > 0 && config.globalBleed * 2 >= Math.min(cw, ch) - EPS) {
    issues.push({
      severity: 'warning',
      kind: 'bleed_vs_canvas',
      message: '全局出血相对画布尺寸偏大，请确认工艺参数',
      canvasIndex: 0,
    });
  }

  if (result.totalUtilization >= 0.95 && result.canvases.length > 0) {
    issues.push({
      severity: 'warning',
      kind: 'high_utilization',
      message: '利用率很高，留给裁切/套准的余量可能不足',
      canvasIndex: 0,
    });
  }

  // hidden 对象统计
  const hiddenIds: string[] = [];
  for (const canvas of result.canvases) {
    for (const p of canvas.placements) {
      if (p.hidden) hiddenIds.push(p.id);
    }
  }
  if (hiddenIds.length > 0) {
    issues.push({
      severity: 'warning',
      kind: 'hidden_count',
      message: `${hiddenIds.length} 个元素已隐藏，不会参与导出`,
      canvasIndex: 0,
      placementIds: hiddenIds,
    });
  }

  // 缺失 printItemId 引用检测
  const itemIds = new Set(items.map((i) => i.id));
  for (const canvas of result.canvases) {
    for (const p of canvas.placements) {
      if (!itemIds.has(p.printItemId)) {
        issues.push({
          severity: 'warning',
          kind: 'missing_item_ref',
          message: `落位 ${p.id} 引用的素材 ${p.printItemId} 不存在`,
          canvasIndex: canvas.index,
          placementIds: [p.id],
        });
      }
    }
  }

  const errors = issues.filter((x) => x.severity === 'error');
  return {
    issues,
    isValid: errors.length === 0,
  };
}

/** 在已有结果上刷新校验（手动编辑 placement 后调用） */
export function withLayoutValidation(
  result: LayoutResult,
  items: PrintItem[],
  config: LayoutConfig,
): LayoutResult {
  return {
    ...result,
    validation: buildLayoutValidationReport(result, items, config),
  };
}
