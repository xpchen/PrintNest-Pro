/**
 * 统一日志服务 — 封装 electron-log，支持 main/renderer 双进程。
 *
 * 分域日志：app / engine / db / export / import / ipc
 * 日志级别：error / warn / info / debug
 * 文件输出：{userData}/logs/printnest-{date}.log，自动轮转 7 天
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface ScopedLogger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

type LogScope = 'app' | 'engine' | 'db' | 'export' | 'import' | 'ipc' | 'project';

let electronLog: typeof import('electron-log') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronLog = require('electron-log');
} catch {
  // electron-log 不可用时（如纯 node 测试环境）回退到 console
}

function initElectronLog(): void {
  if (!electronLog) return;
  const log = electronLog.default ?? electronLog;

  // 文件轮转：最多保留 7 天
  if (log.transports?.file) {
    log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB per file
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
  }

  // 控制台格式
  if (log.transports?.console) {
    log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';
  }
}

initElectronLog();

function getLogFn(level: LogLevel): (...args: unknown[]) => void {
  if (electronLog) {
    const log = electronLog.default ?? electronLog;
    return log[level] ?? console[level];
  }
  return console[level] ?? console.log;
}

function createScopedLogger(scope: LogScope): ScopedLogger {
  const prefix = `[${scope}]`;
  return {
    error: (...args: unknown[]) => getLogFn('error')(prefix, ...args),
    warn: (...args: unknown[]) => getLogFn('warn')(prefix, ...args),
    info: (...args: unknown[]) => getLogFn('info')(prefix, ...args),
    debug: (...args: unknown[]) => getLogFn('debug')(prefix, ...args),
  };
}

/** 预创建各域日志实例 */
export const log = {
  app: createScopedLogger('app'),
  engine: createScopedLogger('engine'),
  db: createScopedLogger('db'),
  export: createScopedLogger('export'),
  import: createScopedLogger('import'),
  ipc: createScopedLogger('ipc'),
  project: createScopedLogger('project'),
};
