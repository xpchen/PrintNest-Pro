/**
 * 项目目录解析（与 fileManager / DB 共用，避免 editorState ↔ fileManager 循环依赖）
 */
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export function getAppDataProjectsRoot(): string {
  const dir = path.join(app.getPath('userData'), 'projects');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getProjectDirectory(projectId: string): string {
  const dir = path.join(getAppDataProjectsRoot(), projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureProjectLayout(projectId: string): void {
  const root = getProjectDirectory(projectId);
  for (const name of ['assets', 'exports', 'snapshots', 'temp']) {
    const sub = path.join(root, name);
    if (!fs.existsSync(sub)) fs.mkdirSync(sub, { recursive: true });
  }
}
