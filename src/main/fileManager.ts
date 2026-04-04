/**
 * 文件管理器 - 素材持久化存储
 *
 * 存储结构:
 *   ~/.printnest/
 *     projects/
 *       {projectId}/
 *         assets/         ← 图片素材副本
 *         project.db      ← 权威业务数据（P0+）
 *         project.json    ← 过渡保险快照（与 DB 对账，冲突以 DB 为准）
 */
import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { getAppDataProjectsRoot, getProjectDirectory, ensureProjectLayout } from './projectPaths';
import {
  loadEditorState,
  saveEditorState,
  hydrateItemImageSrcs,
  mergeImageSrcFromLegacyJson,
} from './db/repositories/editorStateRepository';
import type { SerializedEditorState } from '../shared/persistence/editorState';
import { emptyEditorState, createInitialEditorState } from '../shared/persistence/editorState';
import type { ProjectInitPayload } from '../shared/types/projectInit';
import type { ImportAssetResult } from '../shared/persistence/importAssetResult';
import { getOrOpenProjectDb, closeProjectDb } from './db/projectDb';
import { listRecentLayoutRuns } from './db/repositories/layoutRunRepository';
import { summarizeLayoutConfigFingerprint } from '../shared/layoutConfigFingerprint';
import { log } from '../shared/logger';

export { getProjectDirectory, ensureProjectLayout } from './projectPaths';

function getProjectDir(projectId: string): string {
  return getProjectDirectory(projectId);
}

/** 获取素材目录 */
function getAssetsDir(projectId: string): string {
  const dir = path.join(getProjectDir(projectId), 'assets');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB
const THUMBNAIL_MAX_EDGE = 800; // 缩略图长边 px

/** 生成缩略图，返回缩略图相对路径（相对于项目根）；失败返回 undefined */
async function generateThumbnail(
  srcPath: string,
  assetsDir: string,
  baseName: string,
): Promise<{ thumbRelPath: string; pixelWidth: number; pixelHeight: number } | undefined> {
  try {
    const img = sharp(srcPath);
    const metadata = await img.metadata();
    const w = metadata.width ?? 0;
    const h = metadata.height ?? 0;
    if (w === 0 || h === 0) return undefined;

    const thumbName = `${baseName}_thumb.png`;
    const thumbPath = path.join(assetsDir, thumbName);

    await img
      .resize({ width: THUMBNAIL_MAX_EDGE, height: THUMBNAIL_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .png({ quality: 80 })
      .toFile(thumbPath);

    return {
      thumbRelPath: `assets/${thumbName}`,
      pixelWidth: w,
      pixelHeight: h,
    };
  } catch (err) {
    log.import.warn('thumbnail generation failed', { srcPath, err });
    return undefined;
  }
}

/** 复制图片到项目素材目录，写入 assets 表，返回绝对路径与 assetId */
async function importAsset(projectId: string, srcPath: string): Promise<ImportAssetResult> {
  ensureProjectLayout(projectId);
  const assetsDir = getAssetsDir(projectId);
  const ext = path.extname(srcPath);
  const baseName = path.basename(srcPath, ext);
  const timestamp = Date.now();
  const destName = `${baseName}_${timestamp}${ext}`;
  const destPath = path.join(assetsDir, destName);

  // 大文件保护
  try {
    const stats = fs.statSync(srcPath);
    if (stats.size > MAX_FILE_BYTES) {
      throw new Error(`File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB, max 50MB)`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('too large')) throw err;
    // statSync 失败继续尝试导入
  }

  fs.copyFileSync(srcPath, destPath);
  const relativePath = path.join('assets', destName).split(path.sep).join('/');
  const assetId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 生成缩略图 + 读取图片尺寸
  const thumbBaseName = `${baseName}_${timestamp}`;
  const thumbResult = await generateThumbnail(srcPath, assetsDir, thumbBaseName);

  const db = getOrOpenProjectDb(projectId);
  if (db) {
    db.prepare(
      `INSERT INTO assets (id, managed_relative_path, pixel_width, pixel_height, imported_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(assetId, relativePath, thumbResult?.pixelWidth ?? null, thumbResult?.pixelHeight ?? null, now);
  }
  return {
    absolutePath: destPath,
    assetId,
    relativePath,
    thumbnailRelativePath: thumbResult?.thumbRelPath,
  };
}

/** 批量导入素材（受管 assets/ + DB 登记） */
async function importAssets(projectId: string, srcPaths: string[]): Promise<ImportAssetResult[]> {
  const results: ImportAssetResult[] = [];
  for (const p of srcPaths) {
    results.push(await importAsset(projectId, p));
  }
  return results;
}

function payloadToEditorState(projectId: string, data: object): SerializedEditorState {
  const d = data as Record<string, unknown>;
  return {
    projectName: (d.projectName as string) || projectId,
    config: d.config as SerializedEditorState['config'],
    items: (d.items as SerializedEditorState['items']) ?? [],
    result: (d.result as SerializedEditorState['result']) ?? null,
    layoutSourceSignature: (d.layoutSourceSignature as string) ?? null,
    manualEdits: (d.manualEdits as SerializedEditorState['manualEdits']) ?? undefined,
    dataRecords: (d.dataRecords as SerializedEditorState['dataRecords']) ?? undefined,
    templates: (d.templates as SerializedEditorState['templates']) ?? undefined,
    templateInstances: (d.templateInstances as SerializedEditorState['templateInstances']) ?? undefined,
    activeTemplateId: (d.activeTemplateId as string) ?? undefined,
  };
}

export type ProjectListSummary = {
  id: string;
  name: string;
  updatedAt: string;
  canvasW: number;
  canvasH: number;
  placementCount: number;
  lastRunUtil: number | null;
  lastRunAt: string | null;
  fingerprint: string;
};

function listProjectSummaries(): ProjectListSummary[] {
  const root = getAppDataProjectsRoot();
  if (!fs.existsSync(root)) return [];
  const names = fs.readdirSync(root);
  const out: ProjectListSummary[] = [];
  for (const id of names) {
    const dir = path.join(root, id);
    try {
      if (!fs.statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const st = loadEditorState(id);
    if (!st?.config) continue;
    let placementCount = 0;
    if (st.result) {
      for (const c of st.result.canvases) placementCount += c.placements.length;
    }
    const runs = listRecentLayoutRuns(id, 1);
    const last = runs[0];
    let updatedAt = new Date().toISOString();
    try {
      updatedAt = fs.statSync(path.join(dir, 'project.db')).mtime.toISOString();
    } catch {
      try {
        updatedAt = fs.statSync(path.join(dir, 'project.json')).mtime.toISOString();
      } catch {
        /* keep default */
      }
    }
    out.push({
      id,
      name: st.projectName,
      updatedAt,
      canvasW: st.config.canvas.width,
      canvasH: st.config.canvas.height,
      placementCount,
      lastRunUtil: last?.utilization ?? null,
      lastRunAt: last?.created_at ?? null,
      fingerprint: summarizeLayoutConfigFingerprint(st.config),
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 保存项目：写入 project.db（权威）+ project.json（阶段 1 保险快照） */
function saveProject(projectId: string, data: object): void {
  ensureProjectLayout(projectId);
  const state = payloadToEditorState(projectId, data);
  if (!state.config) {
    log.project.warn('skip save: missing config', { projectId });
    return;
  }
  saveEditorState(projectId, state, { jsonSnapshot: true });
}

/** 加载项目：优先 DB，必要时从 project.json 迁移并合并预览图 */
function loadProject(projectId: string): object | null {
  ensureProjectLayout(projectId);
  const state = loadEditorState(projectId);
  if (!state) return null;
  hydrateItemImageSrcs(projectId, state.items);
  mergeImageSrcFromLegacyJson(projectId, state.items);
  return state as object;
}

/** 列出所有项目（含仅有 DB 的新项目） */
function listProjects(): string[] {
  const dir = getAppDataProjectsRoot();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => {
    const root = path.join(dir, name);
    if (!fs.statSync(root).isDirectory()) return false;
    return (
      fs.existsSync(path.join(root, 'project.json')) ||
      fs.existsSync(path.join(root, 'project.db'))
    );
  });
}

/** 删除项目 */
function deleteProject(projectId: string): void {
  closeProjectDb(projectId);
  const dir = getProjectDir(projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** 新建项目（DB + 可选 JSON 快照）；有 payload 时从向导参数初始化，否则空项目 */
function createProject(projectId: string, initPayload?: ProjectInitPayload): void {
  ensureProjectLayout(projectId);
  const state = initPayload
    ? createInitialEditorState(projectId, initPayload)
    : emptyEditorState(projectId);
  saveEditorState(projectId, state, { jsonSnapshot: true });
}

/** 另存为：复制整个项目目录（不预先创建空目标目录，避免污染 cp） */
function duplicateProject(srcId: string, destId: string): boolean {
  try {
    closeProjectDb(srcId);
    closeProjectDb(destId);
    const root = getAppDataProjectsRoot();
    const srcRoot = path.join(root, srcId);
    const destRoot = path.join(root, destId);
    if (!fs.existsSync(srcRoot)) return false;
    if (fs.existsSync(destRoot)) fs.rmSync(destRoot, { recursive: true, force: true });
    fs.cpSync(srcRoot, destRoot, { recursive: true });
    return true;
  } catch (e) {
    log.project.error('duplicateProject failed', { srcId, destId, err: e });
    return false;
  }
}

/** 注册 IPC handlers */
export function registerFileManagerIPC(): void {
  // 导入素材文件（复制到项目目录）
  ipcMain.handle('file:importAssets', async (_event, projectId: string, srcPaths: string[]) => {
    return importAssets(projectId, srcPaths);
  });

  // 保存项目
  ipcMain.handle('file:saveProject', async (_event, projectId: string, data: object) => {
    saveProject(projectId, data);
    return true;
  });

  // 加载项目
  ipcMain.handle('file:loadProject', async (_event, projectId: string) => {
    ensureProjectLayout(projectId);
    return loadProject(projectId);
  });

  // 自动保存：DB 权威 + JSON 保险快照（渲染进程防抖后调用）
  ipcMain.handle('file:autoSaveProject', async (_event, projectId: string, data: object) => {
    saveProject(projectId, data);
    return true;
  });

  // 列出项目
  ipcMain.handle('file:listProjects', async () => {
    return listProjects();
  });

  ipcMain.handle('file:listProjectSummaries', async () => listProjectSummaries());

  // 删除项目
  ipcMain.handle('file:deleteProject', async (_event, projectId: string) => {
    deleteProject(projectId);
    return true;
  });

  ipcMain.handle('file:createProject', async (_event, projectId: string, initPayload?: ProjectInitPayload) => {
    createProject(projectId, initPayload);
    return true;
  });

  ipcMain.handle('file:duplicateProject', async (_event, srcId: string, destId: string) => {
    return duplicateProject(srcId, destId);
  });

  // 读取文件为 base64（用于渲染器显示本地图片）
  ipcMain.handle('file:readAsBase64', async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) return null;
    // 大文件保护
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_BYTES) {
      log.import.warn('readAsBase64: file too large, rejected', {
        filePath,
        sizeMB: (stats.size / 1024 / 1024).toFixed(1),
      });
      throw new Error(`File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB, max 50MB)`);
    }
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      bmp: 'image/bmp', svg: 'image/svg+xml', tiff: 'image/tiff',
      gif: 'image/gif', webp: 'image/webp',
    };
    const mime = mimeMap[ext] || 'image/png';
    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  });
}
