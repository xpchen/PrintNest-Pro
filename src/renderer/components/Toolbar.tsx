/**
 * 顶部工具栏
 * 导入图片（弹窗模式）| 自动排版 | 策略选择 | 画布设置 | 缩放 | 导出
 */
import React, { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PackingStrategy } from '../../shared/types';
import { showToast } from '../utils/toast';

const DEFAULT_DPI = 150;
function pxToMm(px: number, dpi: number = DEFAULT_DPI): number {
  return Math.round((px / dpi) * 25.4);
}

interface ModalPreview {
  name: string;
  src: string;
  pw: number;
  ph: number;
  mmW: number;
  mmH: number;
}

export const Toolbar: React.FC = () => {
  const {
    config, isComputing, zoom, result, activeCanvasIndex, items,
    addItem, setConfig, setCanvasSize, runAutoLayout, setZoom,
    showGrid, showRuler, showSafeMargin, snapMm,
    setShowGrid, setShowRuler, setShowSafeMargin, setSnapMm,
  } = useAppStore();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalPreviews, setModalPreviews] = useState<ModalPreview[]>([]);
  const [modalDpi, setModalDpi] = useState(DEFAULT_DPI);
  const [modalQty, setModalQty] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileRef = useRef<HTMLInputElement>(null);

  /** Open import modal */
  const openModal = useCallback(() => {
    setShowModal(true);
    setModalPreviews([]);
    setModalDpi(DEFAULT_DPI);
    setModalQty(5);
  }, []);

  /** Process files selected in modal */
  const processModalFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const previews: ModalPreview[] = [];
    let loaded = 0;
    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          previews.push({
            name: file.name,
            src,
            pw: img.naturalWidth,
            ph: img.naturalHeight,
            mmW: pxToMm(img.naturalWidth, modalDpi),
            mmH: pxToMm(img.naturalHeight, modalDpi),
          });
          if (++loaded === imageFiles.length) {
            setModalPreviews([...previews]);
          }
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  }, [modalDpi]);

  /** Recalc previews when DPI changes */
  const handleDpiChange = useCallback((dpi: number) => {
    setModalDpi(dpi);
    setModalPreviews((prev) =>
      prev.map((p) => ({
        ...p,
        mmW: pxToMm(p.pw, dpi),
        mmH: pxToMm(p.ph, dpi),
      }))
    );
  }, []);

  /** Add items from modal */
  const addFromModal = useCallback(() => {
    if (modalPreviews.length === 0) {
      showToast('请先选择图片');
      return;
    }
    for (const p of modalPreviews) {
      addItem({
        name: p.name.replace(/\.\w+$/, ''),
        width: p.mmW,
        height: p.mmH,
        quantity: modalQty,
        imageSrc: p.src,
      });
    }
    setShowModal(false);
    showToast(`已导入 ${modalPreviews.length} 个素材`);
  }, [modalPreviews, modalQty, addItem]);

  /** Import rows from Excel (内部单号 + 尺寸 cm) */
  const handleImportExcel = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.openExcelFile || !api?.parseExcelImport) {
      showToast('Excel 导入不可用（非 Electron 环境）');
      return;
    }
    const paths = await api.openExcelFile();
    if (!paths || paths.length === 0) return;

    const res = await api.parseExcelImport(paths[0]);
    if (!res) {
      showToast('解析失败');
      return;
    }
    if (res.rows.length === 0) {
      const hint = res.warnings[0] ?? '未解析到有效行';
      showToast(hint);
      return;
    }

    for (const row of res.rows) {
      addItem({
        name: row.name,
        width: row.widthMm,
        height: row.heightMm,
        quantity: row.quantity,
        imageSrc: '',
      });
    }

    setConfig({ singleCanvas: true });

    const w = res.warnings.length;
    showToast(
      w > 0
        ? `已导入 ${res.rows.length} 条（已开启单画布），另有 ${w} 条提示（见控制台）`
        : `已导入 ${res.rows.length} 条，已开启单画布模式`,
    );
    if (w > 0) {
      console.warn('[Excel 导入]', res.warnings);
    }
  }, [addItem, setConfig]);

  /** Auto layout */
  const handleLayout = useCallback(async () => {
    if (items.length === 0) {
      showToast('请先导入素材');
      return;
    }
    try {
      await runAutoLayout();
      const r = useAppStore.getState().result;
      const u = r?.unplaced.length ?? 0;
      const v = r?.validation;
      const ve = v?.issues.filter((i) => i.severity === 'error').length ?? 0;
      if (u > 0) {
        showToast(`排版完成，${u} 件未排入（可放大画布或关闭单画布）`);
      } else if (ve > 0) {
        showToast(`排版完成，校验有 ${ve} 条错误（见底栏）`);
      } else {
        showToast('排版完成');
      }
    } catch {
      showToast('排版失败，请重试');
    }
  }, [items, runAutoLayout]);

  /** Clean PNG export (2x scale, no UI chrome) */
  const handleExportPng = useCallback(() => {
    if (!result || !result.canvases[activeCanvasIndex]) {
      showToast('请先执行排版');
      return;
    }
    const cw = config.canvas.width;
    const ch = config.canvas.height;
    const scale = 2;
    const expCvs = document.createElement('canvas');
    expCvs.width = cw * scale;
    expCvs.height = ch * scale;
    const ctx = expCvs.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);

    const cur = result.canvases[activeCanvasIndex];
    for (const p of cur.placements) {
      const item = items.find((i) => i.id === p.printItemId);
      // Try to draw image from cache
      const imgEl = item?.imageSrc ? document.querySelector<HTMLImageElement>(`img[src="${item.imageSrc}"]`) : null;
      // Use a simpler approach: create and draw
      if (item?.imageSrc) {
        // Check if image is already loaded in a tmp way
        const tmpImg = new Image();
        tmpImg.src = item.imageSrc;
        if (tmpImg.complete && tmpImg.naturalWidth > 0) {
          ctx.drawImage(tmpImg, p.x, p.y, p.width, p.height);
        } else {
          ctx.fillStyle = (item?.color ?? '#888') + 'aa';
          ctx.fillRect(p.x, p.y, p.width, p.height);
        }
      } else {
        ctx.fillStyle = (item?.color ?? '#888') + 'aa';
        ctx.fillRect(p.x, p.y, p.width, p.height);
      }
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(p.x, p.y, p.width, p.height);
    }

    const link = document.createElement('a');
    link.download = `PrintNest_画布${activeCanvasIndex + 1}.png`;
    link.href = expCvs.toDataURL('image/png');
    link.click();
    showToast('PNG 已导出');
  }, [result, activeCanvasIndex, config, items]);

  /** PDF export via Electron IPC */
  const handleExportPdf = useCallback(async () => {
    if (!result || result.canvases.length === 0) {
      showToast('请先执行排版');
      return;
    }
    const api = window.electronAPI;
    if (!api?.exportPdf) {
      showToast('PDF 导出仅在桌面端可用');
      return;
    }
    const isPdfOk = await api.isPdfAvailable?.();
    if (!isPdfOk) {
      showToast('PDFKit 未安装，请运行 npm install pdfkit');
      return;
    }
    const outputPath = await api.saveFile('PrintNest_排版.pdf', 'PDF', ['pdf']);
    if (!outputPath) return;

    const canvases = result.canvases.map((c) => ({
      placements: c.placements.map((p) => {
        const item = items.find((i) => i.id === p.printItemId);
        return {
          x: p.x, y: p.y, width: p.width, height: p.height, rotated: p.rotated,
          imageBase64: item?.imageSrc || undefined,
          color: item?.color || '#ccc',
          name: item?.name || '',
        };
      }),
    }));

    const res = await api.exportPdf({
      canvasWidth: config.canvas.width,
      canvasHeight: config.canvas.height,
      canvases,
      bleed: config.globalBleed,
      showCropMarks: true,
      outputPath,
    });

    if (res.success) {
      showToast('PDF 已导出');
    } else {
      showToast('导出失败: ' + res.error);
    }
  }, [result, items, config]);

  return (
    <>
      <div className="toolbar">
        {/* Import */}
        <div className="toolbar-group">
          <button className="btn" onClick={openModal}>&#128206; 导入图片</button>
          <button className="btn" onClick={handleImportExcel} title="表头需含「内部单号」「尺寸」，尺寸格式 宽-高（厘米）">
            &#128196; 导入 Excel
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Layout control */}
        <div className="toolbar-group">
          <button
            className="btn btn-primary"
            onClick={handleLayout}
            disabled={isComputing}
          >
            {isComputing ? '排版中...' : '\u25B6 自动排版'}
          </button>
          <select
            className="select"
            value={config.strategy}
            onChange={(e) => setConfig({ strategy: e.target.value as PackingStrategy })}
          >
            <option value={PackingStrategy.BestShortSideFit}>短边优先 (BSSF)</option>
            <option value={PackingStrategy.BestLongSideFit}>长边优先 (BLSF)</option>
            <option value={PackingStrategy.BestAreaFit}>面积优先 (BAF)</option>
            <option value={PackingStrategy.BottomLeft}>左下角 (BL)</option>
          </select>
          <label
            className="toolbar-check"
            style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}
            title="开启后只使用一张画布，放不下的件计入「未排入」"
          >
            <input
              type="checkbox"
              checked={config.singleCanvas}
              onChange={(e) => setConfig({ singleCanvas: e.target.checked })}
            />
            单画布
          </label>
        </div>

        <div className="toolbar-divider" />

        {/* Canvas size */}
        <div className="toolbar-group">
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>画布:</span>
          <input
            className="input"
            type="number"
            value={config.canvas.width}
            onChange={(e) => setCanvasSize(Number(e.target.value), config.canvas.height)}
            style={{ width: 55 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>x</span>
          <input
            className="input"
            type="number"
            value={config.canvas.height}
            onChange={(e) => setCanvasSize(config.canvas.width, Number(e.target.value))}
            style={{ width: 55 }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>mm</span>
        </div>

        <div className="toolbar-divider" />

        {/* Spacing & Bleed */}
        <div className="toolbar-group">
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>间距:</span>
          <input
            className="input"
            type="number"
            style={{ width: 40 }}
            value={config.globalSpacing}
            onChange={(e) => setConfig({ globalSpacing: Number(e.target.value) })}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>出血:</span>
          <input
            className="input"
            type="number"
            style={{ width: 40 }}
            value={config.globalBleed}
            onChange={(e) => setConfig({ globalBleed: Number(e.target.value) })}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }} title="校验时要求落位与画布边至少留出此距离">
            安全边:
          </span>
          <input
            className="input"
            type="number"
            min={0}
            style={{ width: 40 }}
            value={config.edgeSafeMm ?? 0}
            onChange={(e) => setConfig({ edgeSafeMm: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group" style={{ gap: 6 }}>
          <label className="toolbar-check" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            网格
          </label>
          <label className="toolbar-check" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={showRuler} onChange={(e) => setShowRuler(e.target.checked)} />
            标尺
          </label>
          <label className="toolbar-check" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }} title="按安全边参数显示内缩虚线">
            <input type="checkbox" checked={showSafeMargin} onChange={(e) => setShowSafeMargin(e.target.checked)} />
            安全边线
          </label>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>吸附</span>
          <select
            className="select"
            style={{ minWidth: 72, padding: '4px 6px', fontSize: 12 }}
            value={snapMm}
            onChange={(e) => setSnapMm(Number(e.target.value))}
          >
            <option value={1}>1 mm</option>
            <option value={5}>5 mm</option>
            <option value={10}>10 mm</option>
            <option value={25}>25 mm</option>
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {/* Zoom */}
        <div className="toolbar-group">
          <button className="btn" onClick={() => setZoom(zoom - 0.05)}>−</button>
          <span style={{ fontSize: 12, minWidth: 36, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn" onClick={() => setZoom(zoom + 0.05)}>+</button>
        </div>

        <div className="toolbar-divider" />

        {/* Export */}
        <div className="toolbar-group">
          <button className="btn" onClick={handleExportPng}>&#128190; 导出PNG</button>
          <button className="btn" onClick={handleExportPdf}>&#128196; 导出PDF</button>
        </div>
      </div>

      {/* Import Modal */}
      {showModal && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <h3>导入图片素材</h3>

            {/* Upload area */}
            <input
              ref={modalFileRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && processModalFiles(e.target.files)}
            />
            <div
              className={`upload-area${modalPreviews.length > 0 ? ' has-file' : ''}`}
              onClick={() => modalFileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); processModalFiles(Array.from(e.dataTransfer.files)); }}
            >
              {modalPreviews.length > 0 ? (
                <div style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                  已选择 {modalPreviews.length} 个文件
                </div>
              ) : (
                <div className="upload-text">
                  点击选择图片 或 拖拽图片到此处<br /><br />
                  <strong>支持 PNG / JPG / SVG / BMP</strong>
                </div>
              )}
              {modalPreviews.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                  {modalPreviews.map((p, i) => (
                    <img
                      key={i}
                      src={p.src}
                      className="upload-preview"
                      title={`${p.name} (${p.pw}x${p.ph}px → ${p.mmW}x${p.mmH}mm)`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* DPI */}
            <div className="modal-row">
              <label>DPI</label>
              <input
                type="number"
                value={modalDpi}
                onChange={(e) => handleDpiChange(Number(e.target.value))}
                style={{ width: 80 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>(影响尺寸换算)</span>
            </div>

            {/* Quantity */}
            <div className="modal-row">
              <label>默认数量</label>
              <input
                type="number"
                value={modalQty}
                onChange={(e) => setModalQty(Number(e.target.value))}
              />
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={addFromModal}>添加到素材列表</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
