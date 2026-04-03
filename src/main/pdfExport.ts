/**
 * 印刷级 PDF 导出
 *
 * 使用 PDFKit 生成高精度 PDF，支持：
 * - 真实图片嵌入（原始分辨率）
 * - 出血线标记（crop marks）
 * - mm 单位精确定位
 * - 多画布多页导出
 */
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { LayoutConfig } from '../shared/types';
import { getOrOpenProjectDb } from './db/projectDb';
import { getProjectDirectory } from './projectPaths';
import { log } from '../shared/logger';

// PDFKit 类型（动态 require 以兼容打包）
let PDFDocument: any;
try {
  PDFDocument = require('pdfkit');
} catch {
  // PDFKit 未安装时的降级处理
  PDFDocument = null;
}

/** mm -> PDF points (1mm = 2.83465pt) */
const MM_TO_PT = 2.83465;

interface ExportPlacement {
  x: number;       // mm
  y: number;       // mm
  width: number;   // mm
  height: number;  // mm
  rotated: boolean;
  imagePath?: string;  // 本地文件路径
  imageBase64?: string; // base64 data URL
  assetId?: string;
  color: string;
  name: string;
}

interface ExportCanvas {
  placements: ExportPlacement[];
}

interface PdfExportOptions {
  canvasWidth: number;   // mm
  canvasHeight: number;  // mm
  canvases: ExportCanvas[];
  bleed: number;         // mm
  showCropMarks: boolean;
  outputPath: string;
  /** 提供时优先用受管素材路径导出（双语义之「当前编辑态」） */
  projectId?: string;
  /** 安全边距 mm，>0 时在每页绘制安全边距虚线框 */
  edgeSafeMm?: number;
}

/**
 * 绘制出血裁切标记
 */
function drawCropMarks(doc: any, canvasW: number, canvasH: number, bleed: number) {
  const markLen = 10 * MM_TO_PT;  // 10mm 长的标记线
  const offset = bleed * MM_TO_PT;
  const w = canvasW * MM_TO_PT;
  const h = canvasH * MM_TO_PT;

  doc.save();
  doc.strokeColor('#000000').lineWidth(0.25);

  // 四个角各画两条线
  const corners = [
    { x: offset, y: offset },                // 左上
    { x: offset + w, y: offset },             // 右上
    { x: offset, y: offset + h },             // 左下
    { x: offset + w, y: offset + h },         // 右下
  ];

  for (const c of corners) {
    // 水平标记
    const hDir = c.x <= offset + w / 2 ? -1 : 1;
    doc.moveTo(c.x + hDir * markLen * 0.2, c.y)
       .lineTo(c.x + hDir * markLen, c.y)
       .stroke();
    // 垂直标记
    const vDir = c.y <= offset + h / 2 ? -1 : 1;
    doc.moveTo(c.x, c.y + vDir * markLen * 0.2)
       .lineTo(c.x, c.y + vDir * markLen)
       .stroke();
  }

  doc.restore();
}

/**
 * 从 base64 data URL 中提取 Buffer
 */
function base64ToBuffer(dataUrl: string): Buffer {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

function resolveManagedAssetPath(projectId: string, assetId: string): string | undefined {
  const db = getOrOpenProjectDb(projectId);
  if (!db) return undefined;
  const row = db
    .prepare('SELECT managed_relative_path FROM assets WHERE id = ?')
    .get(assetId) as { managed_relative_path: string } | undefined;
  if (!row) return undefined;
  const abs = path.join(getProjectDirectory(projectId), row.managed_relative_path);
  return fs.existsSync(abs) ? abs : undefined;
}

/**
 * 导出 PDF
 */
async function exportPdf(options: PdfExportOptions): Promise<void> {
  if (!PDFDocument) {
    throw new Error('PDFKit 未安装。请运行: npm install pdfkit');
  }

  const { canvasWidth, canvasHeight, canvases, bleed, showCropMarks, outputPath, projectId, edgeSafeMm } = options;
  const bleedPt = bleed * MM_TO_PT;

  // 页面尺寸 = 画布尺寸 + 四边出血
  const pageW = (canvasWidth + bleed * 2) * MM_TO_PT;
  const pageH = (canvasHeight + bleed * 2) * MM_TO_PT;

  const doc = new PDFDocument({
    size: [pageW, pageH],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    autoFirstPage: false,
    info: {
      Title: 'PrintNest Pro Layout',
      Author: 'PrintNest Pro',
      Creator: 'PrintNest Pro v1.0',
    },
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  for (let ci = 0; ci < canvases.length; ci++) {
    const canvas = canvases[ci];
    doc.addPage();

    // 白色背景
    doc.rect(bleedPt, bleedPt, canvasWidth * MM_TO_PT, canvasHeight * MM_TO_PT)
       .fill('#ffffff');

    // 绘制每个元素
    for (const p of canvas.placements) {
      const px = (p.x + bleed) * MM_TO_PT;
      const py = (p.y + bleed) * MM_TO_PT;
      const pw = p.width * MM_TO_PT;
      const ph = p.height * MM_TO_PT;

      // 尝试嵌入图片
      let imageDrawn = false;

      // 解析图片源
      let imgSrc: string | Buffer | undefined;
      try {
        const managedPath =
          projectId && p.assetId ? resolveManagedAssetPath(projectId, p.assetId) : undefined;
        if (p.imagePath && fs.existsSync(p.imagePath)) {
          imgSrc = p.imagePath;
        } else if (managedPath) {
          imgSrc = managedPath;
        } else if (p.imageBase64) {
          imgSrc = base64ToBuffer(p.imageBase64);
        }
      } catch (err) {
        log.export.warn('image load failed, using fallback', { name: p.name, err });
      }

      if (imgSrc) {
        try {
          if (p.rotated) {
            // 旋转 90°：原始图片尺寸为 height x width（旋转前），
            // 需要在 placement 的 bounding box (pw x ph) 中绘制旋转后的图片
            doc.save();
            // 移到 placement 中心，旋转 90°，再偏移绘制
            doc.translate(px + pw / 2, py + ph / 2);
            doc.rotate(90);
            // 旋转后坐标系交换：绘制原图（宽=ph, 高=pw）
            doc.image(imgSrc, -ph / 2, -pw / 2, { width: ph, height: pw });
            doc.restore();
          } else {
            doc.image(imgSrc, px, py, { width: pw, height: ph });
          }
          imageDrawn = true;
        } catch (err) {
          log.export.warn('image draw failed, using fallback', { name: p.name, err });
        }
      }

      if (!imageDrawn) {
        // 色块 fallback
        doc.rect(px, py, pw, ph).fill(p.color || '#cccccc');
      }

      // 轻描边
      doc.rect(px, py, pw, ph).stroke('#cccccc');
    }

    // 出血裁切标记
    if (showCropMarks) {
      drawCropMarks(doc, canvasWidth, canvasHeight, bleed);
    }

    // 安全边距虚线框
    const safeMm = edgeSafeMm ?? 0;
    if (safeMm > 0 && safeMm * 2 < canvasWidth && safeMm * 2 < canvasHeight) {
      const safePt = safeMm * MM_TO_PT;
      doc.save();
      doc.rect(
        bleedPt + safePt,
        bleedPt + safePt,
        (canvasWidth - safeMm * 2) * MM_TO_PT,
        (canvasHeight - safeMm * 2) * MM_TO_PT,
      )
        .dash(4, { space: 3 })
        .strokeColor('#ff6600')
        .lineWidth(0.5)
        .stroke();
      doc.restore();
    }

    // 画布边界线（虚线）
    doc.save();
    doc.rect(bleedPt, bleedPt, canvasWidth * MM_TO_PT, canvasHeight * MM_TO_PT)
       .dash(3, { space: 2 })
       .strokeColor('#999999')
       .lineWidth(0.5)
       .stroke();
    doc.restore();
  }

  doc.end();

  return new Promise<void>((resolve, reject) => {
    stream.on('finish', () => {
      log.export.info('pdf exported', { pages: canvases.length, path: outputPath });
      resolve();
    });
    stream.on('error', (err) => {
      log.export.error('pdf export stream error', err);
      reject(err);
    });
  });
}

export type HistoricalPdfPayload = {
  projectId: string;
  layoutRunId: string;
  outputPath: string;
};

/** 按历史 layout_run + run_placements + artwork_items 导出（双语义：历史 run） */
async function exportPdfFromHistoricalRun(payload: HistoricalPdfPayload): Promise<void> {
  const db = getOrOpenProjectDb(payload.projectId);
  if (!db) throw new Error('无法打开项目数据库');
  const row = db
    .prepare(`SELECT config_snapshot_json FROM layout_runs WHERE id = ?`)
    .get(payload.layoutRunId) as { config_snapshot_json: string } | undefined;
  if (!row) throw new Error('未找到 layout run');
  const config = JSON.parse(row.config_snapshot_json) as LayoutConfig;

  type RP = {
    print_item_id: string;
    canvas_index: number;
    x_mm: number;
    y_mm: number;
    width_mm: number;
    height_mm: number;
    rotated: number;
  };
  let pr: RP[] = [];
  try {
    pr = db.prepare(`SELECT print_item_id, canvas_index, x_mm, y_mm, width_mm, height_mm, rotated FROM run_placements WHERE run_id = ?`).all(
      payload.layoutRunId,
    ) as RP[];
  } catch {
    throw new Error('run_placements 表不可用，请先完成数据库迁移');
  }

  const byCanvas = new Map<number, RP[]>();
  for (const r of pr) {
    const arr = byCanvas.get(r.canvas_index) ?? [];
    arr.push(r);
    byCanvas.set(r.canvas_index, arr);
  }
  const keys = [...byCanvas.keys()].sort((a, b) => a - b);
  if (keys.length === 0) {
    throw new Error('该 Run 无结构化 placements，请确认已执行数据库迁移并排过版');
  }
  const canvases: ExportCanvas[] = keys.map((k) => ({
    placements: (byCanvas.get(k) ?? []).map((r) => {
      const art = db
        .prepare(`SELECT name, color, asset_id FROM artwork_items WHERE id = ?`)
        .get(r.print_item_id) as { name: string; color: string | null; asset_id: string | null } | undefined;
      const ep: ExportPlacement = {
        x: r.x_mm,
        y: r.y_mm,
        width: r.width_mm,
        height: r.height_mm,
        rotated: Boolean(r.rotated),
        color: art?.color || '#ccc',
        name: art?.name ?? r.print_item_id,
        assetId: art?.asset_id ?? undefined,
      };
      return ep;
    }),
  }));

  await exportPdf({
    canvasWidth: config.canvas.width,
    canvasHeight: config.canvas.height,
    canvases,
    bleed: config.globalBleed,
    showCropMarks: true,
    outputPath: payload.outputPath,
    projectId: payload.projectId,
    edgeSafeMm: config.edgeSafeMm,
  });
}

/** 注册 PDF 导出 IPC */
export function registerPdfExportIPC(): void {
  ipcMain.handle('pdf:export', async (_event, options: PdfExportOptions) => {
    try {
      await exportPdf(options);
      return { success: true, path: options.outputPath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('pdf:exportHistoricalRun', async (_event, payload: HistoricalPdfPayload) => {
    try {
      await exportPdfFromHistoricalRun(payload);
      return { success: true, path: payload.outputPath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('pdf:isAvailable', async () => {
    return PDFDocument !== null;
  });
}
