/// <reference types="vite/client" />

import type { ExcelImportResult } from '../shared/excelImport';
import type { ImportAssetResult } from '../shared/persistence/importAssetResult';
import type { LayoutJobInvokeResult } from '../shared/ipc/layoutJob';
import type { LayoutConfig, LayoutResult, Placement, PrintItem } from '../shared/types';

export {};

declare global {
  interface ElectronAPI {
    openFiles: () => Promise<string[]>;
    openExcelFile: () => Promise<string[]>;
    saveFile: (
      defaultName: string,
      filterName: string,
      extensions: string[],
    ) => Promise<string | undefined>;
    importAssets: (projectId: string, srcPaths: string[]) => Promise<ImportAssetResult[]>;
    createProject?: (projectId: string) => Promise<boolean>;
    duplicateProject?: (srcId: string, destId: string) => Promise<boolean>;
    saveProject: (projectId: string, data: object) => Promise<boolean>;
    autoSaveProject?: (projectId: string, data: object) => Promise<boolean>;
    loadProject: (projectId: string) => Promise<object | null>;
    listProjects: () => Promise<string[]>;
    listProjectSummaries?: () => Promise<
      Array<{
        id: string;
        name: string;
        updatedAt: string;
        canvasW: number;
        canvasH: number;
        placementCount: number;
        lastRunUtil: number | null;
        lastRunAt: string | null;
        fingerprint: string;
      }>
    >;
    deleteProject: (projectId: string) => Promise<boolean>;
    readAsBase64: (filePath: string) => Promise<string | null>;
    parseExcelImport: (filePath: string) => Promise<ExcelImportResult>;
    exportPdf: (options: object) => Promise<{ success: boolean; error?: string; path?: string }>;
    exportPdfHistoricalRun?: (options: {
      projectId: string;
      layoutRunId: string;
      outputPath: string;
    }) => Promise<{ success: boolean; error?: string; path?: string }>;
    isPdfAvailable: () => Promise<boolean>;
    runLayoutJob?: (payload: {
      items: PrintItem[];
      config: LayoutConfig;
      locked?: Placement[];
      projectId?: string;
    }) => Promise<LayoutJobInvokeResult>;
    cancelLayoutJob?: () => Promise<boolean>;
    listLayoutRuns?: (projectId: string) => Promise<
      Array<{
        id: string;
        created_at: string;
        duration_ms: number;
        utilization: number;
        unplaced_count: number;
        canvas_count: number;
        config_snapshot_json: string;
        placement_count?: number;
      }>
    >;
    getRunRestorePayload?: (
      projectId: string,
      runId: string,
      items: PrintItem[],
    ) => Promise<{ result: LayoutResult; config: LayoutConfig } | null>;
    onLayoutProgress?: (cb: (p: { phase: string; pct: number }) => void) => () => void;
    onAppCommand?: (cb: (payload: { id: string; payload?: unknown }) => void) => () => void;
    openProjectFolder?: (projectId: string) => Promise<boolean>;
    logError?: (...args: unknown[]) => Promise<void>;
    logWarn?: (...args: unknown[]) => Promise<void>;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
