/**
 * 排版 IPC：主进程 Worker + layout_runs / run_placements 落库 + 进度/取消。
 */
import { ipcMain, type WebContents } from 'electron';
import { Worker } from 'worker_threads';
import * as path from 'path';
import type { LayoutConfig, LayoutResult, Placement, PrintItem } from '../shared/types';
import type { LayoutJobInvokeResult, LayoutProgressPayload } from '../shared/ipc/layoutJob';
import { executeLayoutJob } from '../shared/engine/layoutJob';
import { tryRecordLayoutRun } from './db/layoutRunRecorder';
import { getRunRestorePayload, listRecentLayoutRuns } from './db/repositories/layoutRunRepository';

export type LayoutRunPayload = {
  items: PrintItem[];
  config: LayoutConfig;
  locked?: Placement[];
  /** 与项目目录一致；提供时写入 layout_runs + run_placements */
  projectId?: string;
};

export type { LayoutJobInvokeResult as LayoutRunIpcResult };

let activeLayoutWorker: Worker | null = null;

function sendProgress(contents: WebContents | undefined, payload: LayoutProgressPayload): void {
  if (!contents || contents.isDestroyed()) return;
  contents.send('layout:progress', payload);
}

function runLayoutInWorker(
  payload: LayoutRunPayload,
  contents: WebContents | undefined,
): Promise<LayoutResult> {
  return new Promise((resolve, reject) => {
    if (activeLayoutWorker) {
      void activeLayoutWorker.terminate();
      activeLayoutWorker = null;
    }
    sendProgress(contents, { phase: 'start', pct: 0 });
    const workerPath = path.join(__dirname, 'layoutWorker.js');
    const w = new Worker(workerPath, {
      workerData: {
        items: payload.items,
        config: payload.config,
        locked: payload.locked,
      },
    });
    activeLayoutWorker = w;
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (activeLayoutWorker === w) activeLayoutWorker = null;
      void w.terminate();
      fn();
    };
    w.on('message', (msg: { ok: boolean; result?: LayoutResult; error?: string }) => {
      settle(() => {
        sendProgress(contents, { phase: 'worker_done', pct: 95 });
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
  ipcMain.handle('layout:cancel', async () => {
    if (activeLayoutWorker) {
      void activeLayoutWorker.terminate();
      activeLayoutWorker = null;
      return true;
    }
    return false;
  });

  ipcMain.handle('layout:run', async (event, payload: LayoutRunPayload): Promise<LayoutJobInvokeResult> => {
    const contents = event.sender;
    let result: LayoutResult;
    try {
      result = await runLayoutInWorker(payload, contents);
    } catch {
      result = executeLayoutJob({
        items: payload.items,
        config: payload.config,
        lockedPlacements: payload.locked,
      });
    }

    let layoutRunId: string | undefined;
    if (payload.projectId) {
      const id = tryRecordLayoutRun(payload.projectId, result, payload.config);
      if (id) layoutRunId = id;
    }

    sendProgress(contents, { phase: 'complete', pct: 100 });
    return { result, layoutRunId };
  });

  ipcMain.handle('layout:listRuns', async (_event, projectId: string) => {
    return listRecentLayoutRuns(projectId, 50);
  });

  ipcMain.handle(
    'layout:getRunRestorePayload',
    async (_event, projectId: string, runId: string, items: PrintItem[]) => {
      return getRunRestorePayload(projectId, runId, items);
    },
  );
}
