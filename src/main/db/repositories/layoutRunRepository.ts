import { getOrOpenProjectDb } from '../projectDb';
import type { CanvasResult, LayoutConfig, LayoutResult, Placement, PrintItem } from '../../../shared/types';
import { withLayoutValidation } from '../../../shared/engine';

export interface LayoutRunRow {
  id: string;
  created_at: string;
  duration_ms: number;
  utilization: number;
  unplaced_count: number;
  canvas_count: number;
  config_snapshot_json: string;
  placement_count?: number;
}

/** 列出最近排版运行记录（含 run_placements 条数，表未迁移时为 0） */
export function listRecentLayoutRuns(projectId: string, limit = 20): LayoutRunRow[] {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return [];
  try {
    return db
      .prepare(
        `SELECT lr.id, lr.created_at, lr.duration_ms, lr.utilization, lr.unplaced_count, lr.canvas_count, lr.config_snapshot_json,
                (SELECT COUNT(*) FROM run_placements rp WHERE rp.run_id = lr.id) AS placement_count
         FROM layout_runs lr ORDER BY lr.created_at DESC LIMIT ?`,
      )
      .all(limit) as LayoutRunRow[];
  } catch {
    return db
      .prepare(
        `SELECT id, created_at, duration_ms, utilization, unplaced_count, canvas_count, config_snapshot_json
         FROM layout_runs ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as LayoutRunRow[];
  }
}

type RunPlacementRow = {
  id: string;
  layout_unit_id: string | null;
  print_item_id: string;
  canvas_index: number;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  rotated: number;
  locked: number;
};

/** 从历史 run 重建 LayoutResult + 当时 config 快照，供「恢复为新草稿」 */
export function getRunRestorePayload(
  projectId: string,
  runId: string,
  items: PrintItem[],
): { result: LayoutResult; config: LayoutConfig } | null {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return null;
  const lr = db
    .prepare(`SELECT config_snapshot_json FROM layout_runs WHERE id = ?`)
    .get(runId) as { config_snapshot_json: string } | undefined;
  if (!lr) return null;
  let config: LayoutConfig;
  try {
    config = JSON.parse(lr.config_snapshot_json) as LayoutConfig;
  } catch {
    return null;
  }
  let rows: RunPlacementRow[];
  try {
    rows = db
      .prepare(
        `SELECT id, layout_unit_id, print_item_id, canvas_index, x_mm, y_mm, width_mm, height_mm, rotated, locked
         FROM run_placements WHERE run_id = ? ORDER BY canvas_index, id`,
      )
      .all(runId) as RunPlacementRow[];
  } catch {
    return null;
  }
  const byCanvas = new Map<number, Placement[]>();
  for (const r of rows) {
    const p: Placement = {
      id: r.id,
      layoutUnitId: r.layout_unit_id ?? r.id,
      printItemId: r.print_item_id,
      canvasIndex: r.canvas_index,
      x: r.x_mm,
      y: r.y_mm,
      width: r.width_mm,
      height: r.height_mm,
      rotated: Boolean(r.rotated),
      locked: Boolean(r.locked),
    };
    const list = byCanvas.get(r.canvas_index) ?? [];
    list.push(p);
    byCanvas.set(r.canvas_index, list);
  }
  const indices = [...byCanvas.keys()].sort((a, b) => a - b);
  const maxIdx = indices.length ? Math.max(...indices) : 0;
  const canvasArea = config.canvas.width * config.canvas.height;
  const canvases: CanvasResult[] = [];
  for (let i = 0; i <= maxIdx; i++) {
    const placements = byCanvas.get(i) ?? [];
    const used = placements.reduce((sum, pl) => sum + pl.width * pl.height, 0);
    canvases.push({
      index: i,
      placements,
      utilization: canvasArea > 0 ? used / canvasArea : 0,
    });
  }
  const totalUsed = canvases.reduce(
    (acc, c) => acc + c.placements.reduce((s, pl) => s + pl.width * pl.height, 0),
    0,
  );
  const totalArea = canvases.length * canvasArea;
  const base: LayoutResult = {
    canvases,
    totalUtilization: totalArea > 0 ? totalUsed / totalArea : 0,
    unplaced: [],
    elapsedMs: 0,
  };
  const result = withLayoutValidation(base, items, config);
  return { result, config };
}
