import { randomUUID } from 'crypto';
import type { LayoutConfig, LayoutResult } from '../../shared/types';
import { getOrOpenProjectDb } from './projectDb';

export function tryRecordLayoutRun(
  projectId: string,
  result: LayoutResult,
  config: LayoutConfig,
): void {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return;

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
}
