import { getOrOpenProjectDb } from '../projectDb';

export interface LayoutRunRow {
  id: string;
  created_at: string;
  duration_ms: number;
  utilization: number;
  unplaced_count: number;
  canvas_count: number;
  config_snapshot_json: string;
}

/** 列出最近排版运行记录（基础仓储能力） */
export function listRecentLayoutRuns(projectId: string, limit = 20): LayoutRunRow[] {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return [];
  return db
    .prepare(
      `SELECT id, created_at, duration_ms, utilization, unplaced_count, canvas_count, config_snapshot_json
       FROM layout_runs ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as LayoutRunRow[];
}
