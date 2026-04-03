/**
 * 项目编辑器状态：projects 元数据 + artwork_items 结构化 + 配置/结果 JSON（P0 过渡）。
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Database } from 'better-sqlite3';
import type { SerializedEditorState } from '../../../shared/persistence/editorState';
import type { PrintItem } from '../../../shared/types';
import { getOrOpenProjectDb } from '../projectDb';
import { getProjectDirectory } from '../../projectPaths';

function readLegacyProjectJson(projectId: string): SerializedEditorState | null {
  const dir = getProjectDirectory(projectId);
  const fp = path.join(dir, 'project.json');
  if (!fs.existsSync(fp)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf-8')) as Record<string, unknown>;
    const items = (raw.items as SerializedEditorState['items']) ?? [];
    const config = raw.config as SerializedEditorState['config'];
    if (!config) return null;
    return {
      projectName: (raw.projectName as string) || projectId,
      config,
      items,
      result: (raw.result as SerializedEditorState['result']) ?? null,
      layoutSourceSignature: (raw.layoutSourceSignature as string) ?? null,
    };
  } catch {
    return null;
  }
}

function writeJsonSnapshot(projectId: string, state: SerializedEditorState): void {
  const dir = getProjectDirectory(projectId);
  const fp = path.join(dir, 'project.json');
  const legacy = {
    projectName: state.projectName,
    items: state.items,
    config: state.config,
    result: state.result,
    layoutSourceSignature: state.layoutSourceSignature,
  };
  fs.writeFileSync(fp, JSON.stringify(legacy, null, 2), 'utf-8');
}

export function loadEditorState(projectId: string): SerializedEditorState | null {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return readLegacyProjectJson(projectId);

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as
    | {
        id: string;
        name: string;
        layout_config_json: string;
        layout_result_json: string | null;
        layout_source_signature: string | null;
      }
    | undefined;

  if (!row) {
    const migrated = readLegacyProjectJson(projectId);
    if (migrated) {
      saveEditorState(projectId, migrated, { jsonSnapshot: true });
      return migrated;
    }
    return null;
  }

  const config = JSON.parse(row.layout_config_json) as SerializedEditorState['config'];
  const result = row.layout_result_json
    ? (JSON.parse(row.layout_result_json) as SerializedEditorState['result'])
    : null;

  const artRows = db
    .prepare(
      `SELECT id, asset_id, name, width_mm, height_mm, quantity, spacing, bleed, priority, allow_rotation, group_code, color, sort_order
       FROM artwork_items ORDER BY sort_order ASC, id ASC`,
    )
    .all() as Array<{
    id: string;
    asset_id: string | null;
    name: string;
    width_mm: number;
    height_mm: number;
    quantity: number;
    spacing: number;
    bleed: number;
    priority: number;
    allow_rotation: number;
    group_code: string | null;
    color: string | null;
    sort_order: number;
  }>;

  const items: SerializedEditorState['items'] = artRows.map((r) => ({
    id: r.id,
    name: r.name,
    width: r.width_mm,
    height: r.height_mm,
    quantity: r.quantity,
    spacing: r.spacing,
    bleed: r.bleed,
    priority: r.priority,
    allowRotation: Boolean(r.allow_rotation),
    group: r.group_code ?? undefined,
    color: r.color ?? '#888',
    imageSrc: '',
    assetId: r.asset_id ?? undefined,
  }));

  return {
    projectName: row.name,
    config,
    items,
    result,
    layoutSourceSignature: row.layout_source_signature,
  };
}

export type SaveEditorOptions = {
  /** 第一阶段：DB 为权威，额外写 project.json 作保险快照 */
  jsonSnapshot?: boolean;
};

export function saveEditorState(
  projectId: string,
  state: SerializedEditorState,
  options: SaveEditorOptions = { jsonSnapshot: true },
): void {
  const db = getOrOpenProjectDb(projectId);
  if (!db) {
    if (options.jsonSnapshot) writeJsonSnapshot(projectId, state);
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (id, name, schema_version, created_at, updated_at, layout_config_json, layout_result_json, layout_source_signature)
       VALUES (@id, @name, 2, @created_at, @updated_at, @cfg, @res, @sig)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         updated_at = excluded.updated_at,
         layout_config_json = excluded.layout_config_json,
         layout_result_json = excluded.layout_result_json,
         layout_source_signature = excluded.layout_source_signature`,
    ).run({
      id: projectId,
      name: state.projectName,
      created_at: now,
      updated_at: now,
      cfg: JSON.stringify(state.config),
      res: state.result ? JSON.stringify(state.result) : null,
      sig: state.layoutSourceSignature,
    });

    db.prepare('DELETE FROM artwork_items').run();
    const ins = db.prepare(
      `INSERT INTO artwork_items (
        id, asset_id, name, width_mm, height_mm, quantity, spacing, bleed, priority, allow_rotation, group_code, color, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    state.items.forEach((it, idx) => {
      ins.run(
        it.id,
        it.assetId ?? null,
        it.name,
        it.width,
        it.height,
        it.quantity,
        it.spacing,
        it.bleed,
        it.priority,
        it.allowRotation ? 1 : 0,
        it.group ?? null,
        it.color,
        idx,
      );
    });
  });

  tx();

  if (options.jsonSnapshot) {
    writeJsonSnapshot(projectId, state);
  }
}

/** 无 asset 或素材缺失时，从 project.json 快照补 imageSrc（过渡：避免纯 DB 丢预览） */
export function mergeImageSrcFromLegacyJson(projectId: string, items: PrintItem[]): void {
  const fp = path.join(getProjectDirectory(projectId), 'project.json');
  if (!fs.existsSync(fp)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf-8')) as {
      items?: Array<{ id: string; imageSrc?: string }>;
    };
    const map = new Map((raw.items ?? []).map((x) => [x.id, x.imageSrc ?? '']));
    for (const it of items) {
      if (!it.imageSrc) {
        const src = map.get(it.id);
        if (src) it.imageSrc = src;
      }
    }
  } catch {
    /* ignore corrupt json */
  }
}

/** 打开 DB 后根据 asset_id 补全 imageSrc（data URL），供渲染进程展示 */
export function hydrateItemImageSrcs(projectId: string, items: SerializedEditorState['items']): void {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return;
  const root = getProjectDirectory(projectId);
  const getAsset = db.prepare('SELECT managed_relative_path FROM assets WHERE id = ?');
  for (const it of items) {
    if (!it.assetId) continue;
    const row = getAsset.get(it.assetId) as { managed_relative_path: string } | undefined;
    if (!row) continue;
    const abs = path.join(root, row.managed_relative_path);
    if (!fs.existsSync(abs)) continue;
    const ext = path.extname(abs).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      tiff: 'image/tiff',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const mime = mimeMap[ext] || 'image/png';
    const data = fs.readFileSync(abs);
    it.imageSrc = `data:${mime};base64,${data.toString('base64')}`;
  }
}
