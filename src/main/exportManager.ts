/**
 * 导出管理器 — export_profiles + export_history CRUD
 */
import { ipcMain } from 'electron';
import { getOrOpenProjectDb } from './db/projectDb';
import { log } from '../shared/logger';

export interface ExportProfile {
  id: string;
  name: string;
  mode: string;
  includeCropMarks: boolean;
  includeBleed: boolean;
  safeMarginMm: number;
  outputFormat: string;
  namingPattern: string | null;
  createdAt: string;
}

export interface ExportHistoryEntry {
  id: string;
  profileId: string | null;
  runId: string | null;
  outputPath: string;
  format: string;
  createdAt: string;
  fileSizeBytes: number | null;
  canvasCount: number | null;
  status: string;
}

function listProfiles(projectId: string): ExportProfile[] {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return [];
  const rows = db
    .prepare('SELECT * FROM export_profiles ORDER BY created_at DESC')
    .all() as Array<{
    id: string;
    name: string;
    mode: string;
    include_crop_marks: number;
    include_bleed: number;
    safe_margin_mm: number;
    output_format: string;
    naming_pattern: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    mode: r.mode,
    includeCropMarks: Boolean(r.include_crop_marks),
    includeBleed: Boolean(r.include_bleed),
    safeMarginMm: r.safe_margin_mm,
    outputFormat: r.output_format,
    namingPattern: r.naming_pattern,
    createdAt: r.created_at,
  }));
}

function saveProfile(projectId: string, profile: ExportProfile): void {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return;
  db.prepare(
    `INSERT INTO export_profiles (id, name, mode, include_crop_marks, include_bleed, safe_margin_mm, output_format, naming_pattern, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       mode = excluded.mode,
       include_crop_marks = excluded.include_crop_marks,
       include_bleed = excluded.include_bleed,
       safe_margin_mm = excluded.safe_margin_mm,
       output_format = excluded.output_format,
       naming_pattern = excluded.naming_pattern`,
  ).run(
    profile.id,
    profile.name,
    profile.mode,
    profile.includeCropMarks ? 1 : 0,
    profile.includeBleed ? 1 : 0,
    profile.safeMarginMm,
    profile.outputFormat,
    profile.namingPattern,
    profile.createdAt,
  );
}

function deleteProfile(projectId: string, profileId: string): void {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return;
  db.prepare('DELETE FROM export_profiles WHERE id = ?').run(profileId);
}

function listHistory(projectId: string, limit = 20): ExportHistoryEntry[] {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return [];
  const rows = db
    .prepare('SELECT * FROM export_history ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<{
    id: string;
    profile_id: string | null;
    run_id: string | null;
    output_path: string;
    format: string;
    created_at: string;
    file_size_bytes: number | null;
    canvas_count: number | null;
    status: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    runId: r.run_id,
    outputPath: r.output_path,
    format: r.format,
    createdAt: r.created_at,
    fileSizeBytes: r.file_size_bytes,
    canvasCount: r.canvas_count,
    status: r.status,
  }));
}

function recordHistory(projectId: string, entry: ExportHistoryEntry): void {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return;
  db.prepare(
    `INSERT INTO export_history (id, profile_id, run_id, output_path, format, created_at, file_size_bytes, canvas_count, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.profileId,
    entry.runId,
    entry.outputPath,
    entry.format,
    entry.createdAt,
    entry.fileSizeBytes,
    entry.canvasCount,
    entry.status,
  );
}

export function registerExportManagerIPC(): void {
  ipcMain.handle('export:listProfiles', async (_e, projectId: string) => {
    return listProfiles(projectId);
  });

  ipcMain.handle('export:saveProfile', async (_e, projectId: string, profile: ExportProfile) => {
    saveProfile(projectId, profile);
    return true;
  });

  ipcMain.handle('export:deleteProfile', async (_e, projectId: string, profileId: string) => {
    deleteProfile(projectId, profileId);
    return true;
  });

  ipcMain.handle('export:listHistory', async (_e, projectId: string, limit?: number) => {
    return listHistory(projectId, limit);
  });

  ipcMain.handle('export:recordHistory', async (_e, projectId: string, entry: ExportHistoryEntry) => {
    recordHistory(projectId, entry);
    return true;
  });
}
