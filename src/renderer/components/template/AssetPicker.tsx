/**
 * AssetPicker — 最小可用图片资产选择器
 *
 * 从项目资产表中列出可选图片，显示缩略图预览。
 * 用于 fixedImage.assetId 和 variableImage.fallbackAssetId 编辑。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

interface AssetOption {
  id: string;
  thumbnailSrc: string | null;
}

interface AssetPickerProps {
  value: string;
  onChange: (assetId: string) => void;
  label?: string;
}

export const AssetPicker: React.FC<AssetPickerProps> = ({ value, onChange, label = '选择图片' }) => {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadAssets = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.listProjectAssets || !projectId) return;
    setLoading(true);
    try {
      const list = await api.listProjectAssets(projectId);
      const options: AssetOption[] = [];
      for (const a of list) {
        let thumb: string | null = null;
        try {
          thumb = await api.readAssetThumbnailBase64!(projectId, a.id);
        } catch { /* ignore */ }
        options.push({ id: a.id, thumbnailSrc: thumb });
      }
      setAssets(options);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) loadAssets();
  }, [open, loadAssets]);

  const selected = assets.find((a) => a.id === value);

  return (
    <div className="asset-picker">
      <span className="tpl-inspector__label">{label}</span>

      {/* 当前选中预览 */}
      {value && selected?.thumbnailSrc && (
        <img
          src={selected.thumbnailSrc}
          alt="selected"
          className="asset-picker__preview"
        />
      )}

      <div className="asset-picker__row">
        <button
          type="button"
          className="asset-picker__btn"
          onClick={() => setOpen(!open)}
        >
          {value ? '更换' : '选择图片'}
        </button>
        {value && (
          <button
            type="button"
            className="asset-picker__btn asset-picker__btn--clear"
            onClick={() => onChange('')}
          >
            清除
          </button>
        )}
      </div>

      {/* 资产列表弹层 */}
      {open && (
        <div className="asset-picker__dropdown">
          {loading && <div className="asset-picker__loading">加载中...</div>}
          {!loading && assets.length === 0 && (
            <div className="asset-picker__empty">无可用图片资产，请先在资源面板导入</div>
          )}
          <div className="asset-picker__grid">
            {assets.map((a) => (
              <div
                key={a.id}
                className={`asset-picker__item ${a.id === value ? 'asset-picker__item--selected' : ''}`}
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                }}
              >
                {a.thumbnailSrc ? (
                  <img src={a.thumbnailSrc} alt={a.id} className="asset-picker__thumb" />
                ) : (
                  <div className="asset-picker__placeholder">?</div>
                )}
                <span className="asset-picker__id">{a.id.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
