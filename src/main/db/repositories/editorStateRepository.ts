/**
 * 项目编辑器状态：projects 元数据 + artwork_items 结构化 + 配置/结果 JSON（P0 过渡）。
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Database } from 'better-sqlite3';
import type { SerializedEditorState } from '../../../shared/persistence/editorState';
import type { PrintItem, DataRecord, TemplateDefinition, TemplateInstance } from '../../../shared/types';
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
      manualEdits: (raw.manualEdits as SerializedEditorState['manualEdits']) ?? undefined,
    };
  } catch {
    return null;
  }
}

function writeJsonSnapshot(projectId: string, state: SerializedEditorState): void {
  const dir = getProjectDirectory(projectId);
  const fp = path.join(dir, 'project.json');
  const legacy: Record<string, unknown> = {
    projectName: state.projectName,
    items: state.items,
    config: state.config,
    result: state.result,
    layoutSourceSignature: state.layoutSourceSignature,
    manualEdits: state.manualEdits,
  };
  if (state.dataRecords?.length) legacy.dataRecords = state.dataRecords;
  if (state.templates?.length) legacy.templates = state.templates;
  if (state.templateInstances?.length) legacy.templateInstances = state.templateInstances;
  if (state.activeTemplateId) legacy.activeTemplateId = state.activeTemplateId;
  fs.writeFileSync(fp, JSON.stringify(legacy, null, 2), 'utf-8');
}

/* ================================================================== */
/*  模板域 load/save helpers                                           */
/* ================================================================== */

function tableExists(db: Database, name: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name) as { 1: number } | undefined;
  return !!row;
}

function loadDataRecords(db: Database): DataRecord[] {
  if (!tableExists(db, 'data_records')) return [];
  const rows = db.prepare('SELECT * FROM data_records ORDER BY source_row_index ASC').all() as Array<{
    id: string;
    source_session_id: string | null;
    source_row_index: number;
    fields_json: string;
    qty: number;
    source_name: string | null;
    source_sheet: string | null;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    sourceSessionId: r.source_session_id ?? undefined,
    sourceRowIndex: r.source_row_index,
    fields: JSON.parse(r.fields_json) as Record<string, string>,
    qty: r.qty,
    sourceName: r.source_name ?? undefined,
    sourceSheet: r.source_sheet ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function loadTemplateDefinitions(db: Database): TemplateDefinition[] {
  if (!tableExists(db, 'template_definitions')) return [];
  const rows = db.prepare('SELECT * FROM template_definitions ORDER BY created_at ASC').all() as Array<{
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    version: number;
    status: string;
    canvas_mode: string;
    width_mm: number;
    height_mm: number;
    elements_json: string;
    validation_rules_json: string | null;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    category: r.category ?? undefined,
    version: r.version,
    status: r.status as TemplateDefinition['status'],
    canvasMode: r.canvas_mode as TemplateDefinition['canvasMode'],
    widthMm: r.width_mm,
    heightMm: r.height_mm,
    elements: JSON.parse(r.elements_json),
    validationRules: r.validation_rules_json ? JSON.parse(r.validation_rules_json) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function loadTemplateInstances(db: Database): TemplateInstance[] {
  if (!tableExists(db, 'template_instances')) return [];
  const rows = db.prepare('SELECT * FROM template_instances ORDER BY created_at ASC').all() as Array<{
    id: string;
    template_id: string;
    record_id: string;
    resolved_width_mm: number;
    resolved_height_mm: number;
    render_payload_json: string;
    status: string;
    validation_errors_json: string | null;
    resolved_elements_json: string | null;
    snapshot_hash: string | null;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    templateId: r.template_id,
    recordId: r.record_id,
    resolvedWidthMm: r.resolved_width_mm,
    resolvedHeightMm: r.resolved_height_mm,
    renderPayload: JSON.parse(r.render_payload_json),
    status: r.status as TemplateInstance['status'],
    validationErrors: r.validation_errors_json ? JSON.parse(r.validation_errors_json) : undefined,
    resolvedElements: r.resolved_elements_json ? JSON.parse(r.resolved_elements_json) : undefined,
    snapshotHash: r.snapshot_hash ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function saveDataRecords(db: Database, records: DataRecord[]): void {
  db.prepare('DELETE FROM data_records').run();
  const ins = db.prepare(
    `INSERT OR REPLACE INTO data_records (id, source_session_id, source_row_index, fields_json, qty, source_name, source_sheet, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of records) {
    ins.run(
      r.id,
      r.sourceSessionId ?? null,
      r.sourceRowIndex,
      JSON.stringify(r.fields),
      r.qty,
      r.sourceName ?? null,
      r.sourceSheet ?? null,
      r.createdAt,
      r.updatedAt,
    );
  }
}

function saveTemplateDefinitions(db: Database, templates: TemplateDefinition[]): void {
  db.prepare('DELETE FROM template_definitions').run();
  const ins = db.prepare(
    `INSERT OR REPLACE INTO template_definitions (id, name, description, category, version, status, canvas_mode, width_mm, height_mm, elements_json, validation_rules_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const t of templates) {
    ins.run(
      t.id,
      t.name,
      t.description ?? null,
      t.category ?? null,
      t.version,
      t.status,
      t.canvasMode,
      t.widthMm,
      t.heightMm,
      JSON.stringify(t.elements),
      t.validationRules ? JSON.stringify(t.validationRules) : null,
      t.createdAt,
      t.updatedAt,
    );
  }
}

function saveTemplateInstances(db: Database, instances: TemplateInstance[]): void {
  db.prepare('DELETE FROM template_instances').run();
  const ins = db.prepare(
    `INSERT OR REPLACE INTO template_instances (id, template_id, record_id, resolved_width_mm, resolved_height_mm, render_payload_json, status, validation_errors_json, resolved_elements_json, snapshot_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const i of instances) {
    ins.run(
      i.id,
      i.templateId,
      i.recordId,
      i.resolvedWidthMm,
      i.resolvedHeightMm,
      JSON.stringify(i.renderPayload),
      i.status,
      i.validationErrors ? JSON.stringify(i.validationErrors) : null,
      i.resolvedElements ? JSON.stringify(i.resolvedElements) : null,
      i.snapshotHash ?? null,
      i.createdAt,
      i.updatedAt,
    );
  }
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
        manual_edits_json: string | null;
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

  let manualEdits: SerializedEditorState['manualEdits'];
  if (row.manual_edits_json) {
    try {
      manualEdits = JSON.parse(row.manual_edits_json) as SerializedEditorState['manualEdits'];
    } catch {
      manualEdits = undefined;
    }
  }

  // ── 模板域：data_records ──
  const dataRecords = loadDataRecords(db);
  // ── 模板域：template_definitions ──
  const templates = loadTemplateDefinitions(db);
  // ── 模板域：template_instances ──
  const templateInstances = loadTemplateInstances(db);

  return {
    projectName: row.name,
    config,
    items,
    result,
    layoutSourceSignature: row.layout_source_signature,
    manualEdits,
    dataRecords: dataRecords.length ? dataRecords : undefined,
    templates: templates.length ? templates : undefined,
    templateInstances: templateInstances.length ? templateInstances : undefined,
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
    const meJson = state.manualEdits?.length ? JSON.stringify(state.manualEdits) : null;
    db.prepare(
      `INSERT INTO projects (id, name, schema_version, created_at, updated_at, layout_config_json, layout_result_json, layout_source_signature, manual_edits_json)
       VALUES (@id, @name, 2, @created_at, @updated_at, @cfg, @res, @sig, @me)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         updated_at = excluded.updated_at,
         layout_config_json = excluded.layout_config_json,
         layout_result_json = excluded.layout_result_json,
         layout_source_signature = excluded.layout_source_signature,
         manual_edits_json = excluded.manual_edits_json`,
    ).run({
      id: projectId,
      name: state.projectName,
      created_at: now,
      updated_at: now,
      cfg: JSON.stringify(state.config),
      res: state.result ? JSON.stringify(state.result) : null,
      sig: state.layoutSourceSignature,
      me: meJson,
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

    // ── 模板域持久化 ──
    if (state.dataRecords) {
      saveDataRecords(db, state.dataRecords);
    }
    if (state.templates) {
      saveTemplateDefinitions(db, state.templates);
    }
    if (state.templateInstances) {
      saveTemplateInstances(db, state.templateInstances);
    }
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
