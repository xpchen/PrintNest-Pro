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
    onLayoutProgress?: (cb: (p: { phase: string; pct: number }) => void) => () => void;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
