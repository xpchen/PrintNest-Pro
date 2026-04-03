import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import type { LayoutConfig, LayoutResult } from '../../shared/types';
import { getOrOpenProjectDb } from './projectDb';

function saveRunPlacements(db: Database.Database, runId: string, result: LayoutResult): void {
  const ins = db.prepare(
    `INSERT INTO run_placements (
      id, run_id, layout_unit_id, print_item_id, canvas_index,
      x_mm, y_mm, width_mm, height_mm, rotated, locked
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (let ci = 0; ci < result.canvases.length; ci++) {
      for (const p of result.canvases[ci].placements) {
        ins.run(
          p.id,
          runId,
          p.layoutUnitId,
          p.printItemId,
          ci,
          p.x,
          p.y,
          p.width,
          p.height,
          p.rotated ? 1 : 0,
          p.locked ? 1 : 0,
        );
      }
    }
  });
  tx();
}

/** 写入 layout_runs + run_placements，并更新 projects.current_layout_run_id（若已有 projects 行） */
export function tryRecordLayoutRun(
  projectId: string,
  result: LayoutResult,
  config: LayoutConfig,
): string | null {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return null;

  const id = randomUUID();
  const unplacedCount = result.unplaced?.length ?? 0;
  const canvasCount = result.canvases?.length ?? 0;
  const configJson = JSON.stringify(config);

  db.prepare(
    `INSERT INTO layout_runs (
      id, duration_ms, utilization, unplaced_count, canvas_count, config_snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    result.elapsedMs,
    result.totalUtilization,
    unplacedCount,
    canvasCount,
    configJson,
  );

  saveRunPlacements(db, id, result);

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE projects SET current_layout_run_id = ?, updated_at = ? WHERE id = ?`,
  ).run(id, now, projectId);

  return id;
}
