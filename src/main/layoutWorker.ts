/**
 * Node worker_threads 入口：在独立线程中执行排版，避免阻塞主进程事件循环。
 */
import { parentPort, workerData } from 'worker_threads';
import type { LayoutConfig, Placement, PrintItem } from '../shared/types';
import { executeLayoutJob } from '../shared/engine/layoutJob';

type WorkerPayload = {
  items: PrintItem[];
  config: LayoutConfig;
  locked?: Placement[];
};

function main(): void {
  const data = workerData as WorkerPayload;
  try {
    const result = executeLayoutJob({
      items: data.items,
      config: data.config,
      lockedPlacements: data.locked,
    });
    parentPort?.postMessage({ ok: true as const, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    parentPort?.postMessage({ ok: false as const, error: message });
  }
}

main();
