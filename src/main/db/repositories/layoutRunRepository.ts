import { getOrOpenProjectDb } from '../projectDb';

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
