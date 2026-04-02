/**
 * 排版 IPC：主进程内 Worker 执行 + 可选写入 layout_runs（SQLite）。
 */
import { ipcMain } from 'electron';
import { Worker } from 'worker_threads';
import * as path from 'path';
import type { LayoutConfig, LayoutResult, Placement, PrintItem } from '../shared/types';
import { executeLayoutJob } from '../shared/engine/layoutJob';
import { tryRecordLayoutRun } from './db/layoutRunRecorder';

export type LayoutRunPayload = {
  items: PrintItem[];
  config: LayoutConfig;
  locked?: Placement[];
  /** 与 fileManager 项目目录一致；提供时尝试落库 layout_runs */
  projectId?: string;
};

function runLayoutInWorker(payload: LayoutRunPayload): Promise<LayoutResult> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, 'layoutWorker.js');
    const w = new Worker(workerPath, {
      workerData: {
        items: payload.items,
        config: payload.config,
        locked: payload.locked,
      },
    });
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      void w.terminate();
      fn();
    };
    w.on('message', (msg: { ok: boolean; result?: LayoutResult; error?: string }) => {
      settle(() => {
        if (msg.ok && msg.result) resolve(msg.result);
        else reject(new Error(msg.error || 'layout worker failed'));
      });
    });
    w.on('error', (err) => {
      settle(() => reject(err));
    });
  });
}

export function registerLayoutIpc(): void {
  ipcMain.handle('layout:run', async (_event, payload: LayoutRunPayload) => {
    let result: LayoutResult;
    try {
      result = await runLayoutInWorker(payload);
    } catch {
      result = executeLayoutJob({
        items: payload.items,
        config: payload.config,
        lockedPlacements: payload.locked,
      });
    }

    if (payload.projectId) {
      tryRecordLayoutRun(payload.projectId, result, payload.config);
    }

    return result;
  });
}
