/// <reference types="vite/client" />

import type { ExcelImportResult } from '../shared/excelImport';
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
    importAssets: (projectId: string, srcPaths: string[]) => Promise<string[]>;
    saveProject: (projectId: string, data: object) => Promise<boolean>;
    autoSaveProject?: (projectId: string, data: object) => Promise<boolean>;
    loadProject: (projectId: string) => Promise<object | null>;
    listProjects: () => Promise<string[]>;
    deleteProject: (projectId: string) => Promise<boolean>;
    readAsBase64: (filePath: string) => Promise<string | null>;
    parseExcelImport: (filePath: string) => Promise<ExcelImportResult>;
    exportPdf: (options: object) => Promise<{ success: boolean; error?: string; path?: string }>;
    isPdfAvailable: () => Promise<boolean>;
    runLayoutJob?: (payload: {
      items: PrintItem[];
      config: LayoutConfig;
      locked?: Placement[];
      projectId?: string;
    }) => Promise<LayoutResult>;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
