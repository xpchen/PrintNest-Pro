/**
 * 顶部工具栏
 * 导入图片素材 | 自动排版 | 策略选择 | 画布设置 | 缩放 | 导出
 */
import React, { useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PackingStrategy } from '../../shared/types';

const DEFAULT_DPI = 150;
function pxToMm(px: number, dpi: number = DEFAULT_DPI): number {
  return Math.round((px / dpi) * 25.4);
}

export const Toolbar: React.FC = () => {
  const {
    config, isComputing, zoom,
    addItem, setConfig, setCanvasSize, runAutoLayout, setZoom,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 处理图片文件导入 */
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const src = e.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const mmW = pxToMm(img.naturalWidth);
            const mmH = pxToMm(img.naturalHeight);
            addItem({
              name: file.name.replace(/\.\w+$/, ''),
              width: mmW,
              height: mmH,
              quantity: 5,
              imageSrc: src,
            });
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
      });
  }, [addItem]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** 导出 PNG */
  const handleExportPng = useCallback(() => {
    const canvas = document.querySelector('.layout-canvas') as HTMLCanvasElement;
    if (!canvas) return alert('请先执行排版');
    const link = document.createElement('a');
    link.download = 'layout.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  return (
    <div className="toolbar">
      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* 导入 */}
      <div className="toolbar-group">
        <button className="btn" onClick={handleImportClick}>&#128206; 导入图片</button>
      </div>

      <div className="toolbar-divider" />

      {/* 排版控制 */}
      <div className="toolbar-group">
        <button
          className="btn btn-primary"
          onClick={runAutoLayout}
          disabled={isComputing}
        >
          {isComputing ? '排版中...' : '&#9654; 自动排版'}
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
      </div>

      <div className="toolbar-divider" />

      {/* 画布设置 */}
      <div className="toolbar-group">
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>画布:</span>
        <input
          className="input"
          type="number"
          value={config.canvas.width}
          onChange={(e) => setCanvasSize(Number(e.target.value), config.canvas.height)}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>x</span>
        <input
          className="input"
          type="number"
          value={config.canvas.height}
          onChange={(e) => setCanvasSize(config.canvas.width, Number(e.target.value))}
        />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>mm</span>
      </div>

      <div className="toolbar-divider" />

      {/* 全局参数 */}
      <div className="toolbar-group">
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>间距:</span>
        <input
          className="input"
          type="number"
          style={{ width: 50 }}
          value={config.globalSpacing}
          onChange={(e) => setConfig({ globalSpacing: Number(e.target.value) })}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>出血:</span>
        <input
          className="input"
          type="number"
          style={{ width: 50 }}
          value={config.globalBleed}
          onChange={(e) => setConfig({ globalBleed: Number(e.target.value) })}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* 缩放 */}
      <div className="toolbar-group">
        <button className="btn" onClick={() => setZoom(zoom - 0.1)}>-</button>
        <span style={{ fontSize: 12, minWidth: 40, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="btn" onClick={() => setZoom(zoom + 0.1)}>+</button>
      </div>

      <div className="toolbar-divider" />

      {/* 导出 */}
      <div className="toolbar-group">
        <button className="btn" onClick={handleExportPng}>&#128190; 导出 PNG</button>
      </div>
    </div>
  );
};
