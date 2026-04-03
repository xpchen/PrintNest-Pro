/**
 * 编辑器顶栏所需：导入弹窗、Excel、导出 PDF、自动排版等（原 Toolbar 内逻辑）
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PackingStrategy } from '../../../shared/types';
import type { ImportAssetResult } from '../../../shared/persistence/importAssetResult';
import { showToast } from '../../utils/toast';
import { DEFAULT_IMPORT_DPI, pxToMm } from '../../utils/imageMm';

export interface ModalPreview {
  name: string;
  src: string;
  pw: number;
  ph: number;
  mmW: number;
  mmH: number;
  localPath?: string;
}

export interface EditorChromeContextValue {
  openImportModal: () => void;
  handleImportExcel: () => Promise<void>;
  handleExportPng: () => void;
  handleExportPdf: () => Promise<void>;
  requestExportHistoricalPdf: () => void;
  handleLayout: () => Promise<void>;
  itemsLength: number;
  isComputing: boolean;
}

const EditorChromeContext = createContext<EditorChromeContextValue | null>(null);

export function useEditorChrome(): EditorChromeContextValue {
  const v = useContext(EditorChromeContext);
  if (!v) throw new Error('useEditorChrome must be used within EditorChromeProvider');
  return v;
}

export const EditorChromeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    config, isComputing, result, activeCanvasIndex, items,
    addItem, setConfig, runAutoLayout,
    currentProjectId,
  } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [modalPreviews, setModalPreviews] = useState<ModalPreview[]>([]);
  const [modalDpi, setModalDpi] = useState(DEFAULT_IMPORT_DPI);
  const [modalQty, setModalQty] = useState(5);
  const modalFileRef = useRef<HTMLInputElement>(null);

  const openModal = useCallback(() => {
    setShowModal(true);
    setModalPreviews([]);
    setModalDpi(DEFAULT_IMPORT_DPI);
    setModalQty(5);
  }, []);

  const processModalFiles = useCallback(
    (files: FileList | File[]) => {
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
    },
    [modalDpi],
  );

  const handleDpiChange = useCallback((dpi: number) => {
    setModalDpi(dpi);
    setModalPreviews((prev) =>
      prev.map((p) => ({
        ...p,
        mmW: pxToMm(p.pw, dpi),
        mmH: pxToMm(p.ph, dpi),
      })),
    );
  }, []);

  const addFromModal = useCallback(async () => {
    if (modalPreviews.length === 0) {
      showToast('请先选择图片');
      return;
    }
    const api = window.electronAPI;
    const paths = modalPreviews.map((p) => p.localPath).filter(Boolean) as string[];
    let imported: ImportAssetResult[] = [];
    if (api?.importAssets && paths.length > 0) {
      imported = await api.importAssets(currentProjectId, paths);
    }
    let ip = 0;
    for (const p of modalPreviews) {
      const baseName = p.name.replace(/\.\w+$/, '');
      if (p.localPath && imported[ip]) {
        const r = imported[ip++];
        addItem({
          name: baseName,
          width: p.mmW,
          height: p.mmH,
          quantity: modalQty,
          imageSrc: p.src,
          assetId: r.assetId,
        });
      } else {
        addItem({
          name: baseName,
          width: p.mmW,
          height: p.mmH,
          quantity: modalQty,
          imageSrc: p.src,
        });
      }
    }
    setShowModal(false);
    showToast(`已导入 ${modalPreviews.length} 个素材`);
  }, [modalPreviews, modalQty, addItem, currentProjectId]);

  const openModalPicker = useCallback(async () => {
    const api = window.electronAPI;
    if (api?.openFiles && api?.readAsBase64) {
      const filePaths = await api.openFiles();
      if (!filePaths || filePaths.length === 0) return;
      const previews: ModalPreview[] = [];
      for (const fp of filePaths) {
        const b64 = await api.readAsBase64(fp);
        if (!b64) continue;
        const name = fp.replace(/^.*[/\\]/, '');
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = b64;
        });
        if (img.naturalWidth > 0) {
          previews.push({
            name,
            src: b64,
            pw: img.naturalWidth,
            ph: img.naturalHeight,
            mmW: pxToMm(img.naturalWidth, modalDpi),
            mmH: pxToMm(img.naturalHeight, modalDpi),
            localPath: fp,
          });
        }
      }
      setModalPreviews(previews);
      return;
    }
    modalFileRef.current?.click();
  }, [modalDpi]);

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
      if (item?.imageSrc) {
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
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          rotated: p.rotated,
          imageBase64: item?.imageSrc || undefined,
          assetId: item?.assetId,
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
      projectId: currentProjectId,
    });

    if (res.success) {
      showToast('PDF 已导出');
    } else {
      showToast('导出失败: ' + res.error);
    }
  }, [result, items, config, currentProjectId]);

  const requestExportHistoricalPdf = useCallback(() => {
    useAppStore.getState().requestExportHistoricalRunPdf();
  }, []);

  const importModalNonce = useAppStore((s) => s.importModalNonce);
  const excelImportNonce = useAppStore((s) => s.excelImportNonce);
  const exportPdfCurrentNonce = useAppStore((s) => s.exportPdfCurrentNonce);
  const exportPdfHistoricalNonce = useAppStore((s) => s.exportPdfHistoricalNonce);

  useEffect(() => {
    if (importModalNonce > 0) openModal();
  }, [importModalNonce, openModal]);

  useEffect(() => {
    if (excelImportNonce > 0) void handleImportExcel();
  }, [excelImportNonce, handleImportExcel]);

  const exportPdfRef = useRef(handleExportPdf);
  exportPdfRef.current = handleExportPdf;
  useEffect(() => {
    if (exportPdfCurrentNonce > 0) void exportPdfRef.current();
  }, [exportPdfCurrentNonce]);

  useEffect(() => {
    if (exportPdfHistoricalNonce <= 0) return;
    void (async () => {
      const api = window.electronAPI;
      const st = useAppStore.getState();
      if (!st.lastLayoutRunId || !api?.exportPdfHistoricalRun || !api?.saveFile) {
        showToast('无可用历史 Run 或导出不可用');
        return;
      }
      const isPdfOk = await api.isPdfAvailable?.();
      if (!isPdfOk) {
        showToast('PDFKit 未安装');
        return;
      }
      const outputPath = await api.saveFile('PrintNest_历史排版.pdf', 'PDF', ['pdf']);
      if (!outputPath) return;
      const res = await api.exportPdfHistoricalRun({
        projectId: st.currentProjectId,
        layoutRunId: st.lastLayoutRunId,
        outputPath,
      });
      showToast(res.success ? '历史 Run PDF 已导出' : `导出失败: ${res.error ?? ''}`);
    })();
  }, [exportPdfHistoricalNonce]);

  const value = useMemo<EditorChromeContextValue>(
    () => ({
      openImportModal: openModal,
      handleImportExcel,
      handleExportPng,
      handleExportPdf,
      requestExportHistoricalPdf,
      handleLayout,
      itemsLength: items.length,
      isComputing,
    }),
    [
      openModal,
      handleImportExcel,
      handleExportPng,
      handleExportPdf,
      requestExportHistoricalPdf,
      handleLayout,
      items.length,
      isComputing,
    ],
  );

  return (
    <EditorChromeContext.Provider value={value}>
      {children}
      {showModal && (
        <div
          className="modal-bg pn-z-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="modal">
            <h3>导入图片素材</h3>
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
              onClick={() => void openModalPicker()}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                processModalFiles(Array.from(e.dataTransfer.files));
              }}
            >
              {modalPreviews.length > 0 ? (
                <div style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                  已选择 {modalPreviews.length} 个文件
                </div>
              ) : (
                <div className="upload-text">
                  点击选择图片 或 拖拽图片到此处
                  <br />
                  <br />
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
            <div className="modal-row">
              <label>默认数量</label>
              <input
                type="number"
                value={modalQty}
                onChange={(e) => setModalQty(Number(e.target.value))}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void addFromModal()}>
                添加到素材列表
              </button>
            </div>
          </div>
        </div>
      )}
    </EditorChromeContext.Provider>
  );
};
