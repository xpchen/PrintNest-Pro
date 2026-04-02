/**
 * 文件管理器 - 素材持久化存储
 *
 * 存储结构:
 *   ~/.printnest/
 *     projects/
 *       {projectId}/
 *         assets/         ← 图片素材副本
 *         project.json    ← 项目数据（素材列表、排版配置等）
 */
import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/** 应用数据根目录 */
function getAppDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'projects');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 获取项目根目录（不存在则创建），供素材/DB/自动保存共用 */
export function getProjectDirectory(projectId: string): string {
  const dir = path.join(getAppDataDir(), projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 产品级目录：assets / exports / snapshots / temp */
export function ensureProjectLayout(projectId: string): void {
  const root = getProjectDirectory(projectId);
  for (const name of ['assets', 'exports', 'snapshots', 'temp']) {
    const sub = path.join(root, name);
    if (!fs.existsSync(sub)) fs.mkdirSync(sub, { recursive: true });
  }
}

function getProjectDir(projectId: string): string {
  return getProjectDirectory(projectId);
}

/** 获取素材目录 */
function getAssetsDir(projectId: string): string {
  const dir = path.join(getProjectDir(projectId), 'assets');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 复制图片到项目素材目录，返回新路径 */
function importAsset(projectId: string, srcPath: string): string {
  const assetsDir = getAssetsDir(projectId);
  const ext = path.extname(srcPath);
  const baseName = path.basename(srcPath, ext);
  const timestamp = Date.now();
  const destName = `${baseName}_${timestamp}${ext}`;
  const destPath = path.join(assetsDir, destName);

  fs.copyFileSync(srcPath, destPath);
  return destPath;
}

/** 批量导入素材 */
function importAssets(projectId: string, srcPaths: string[]): string[] {
  return srcPaths.map((p) => importAsset(projectId, p));
}

/** 保存项目数据 */
function saveProject(projectId: string, data: object): void {
  ensureProjectLayout(projectId);
  const projectDir = getProjectDir(projectId);
  const filePath = path.join(projectDir, 'project.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** 加载项目数据 */
function loadProject(projectId: string): object | null {
  const filePath = path.join(getProjectDir(projectId), 'project.json');
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/** 列出所有项目 */
function listProjects(): string[] {
  const dir = getAppDataDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => {
    const projectFile = path.join(dir, name, 'project.json');
    return fs.existsSync(projectFile);
  });
}

/** 删除项目 */
function deleteProject(projectId: string): void {
  const dir = getProjectDir(projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
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

  // 自动保存（定时器由渲染进程触发，写入 project.json）
  ipcMain.handle('file:autoSaveProject', async (_event, projectId: string, data: object) => {
    saveProject(projectId, data);
    return true;
  });

  // 列出项目
  ipcMain.handle('file:listProjects', async () => {
    return listProjects();
  });

  // 删除项目
  ipcMain.handle('file:deleteProject', async (_event, projectId: string) => {
    deleteProject(projectId);
    return true;
  });

  // 读取文件为 base64（用于渲染器显示本地图片）
  ipcMain.handle('file:readAsBase64', async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) return null;
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
