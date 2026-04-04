/**
 * useAssetMap — 构建 assetId → { thumbnailSrc, fullSrc } 映射
 *
 * 从主进程查询项目资产表，按需加载缩略图 base64。
 * 提供给 resolveTemplateDrawables() 的 assetMap 参数。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { AssetEntry } from '../../shared/types/template-render';

interface AssetRecord {
  id: string;
  managedRelativePath: string;
  pixelWidth: number | null;
  pixelHeight: number | null;
}

/**
 * 返回一个 Map<assetId, AssetEntry> 供模板渲染协议层使用。
 * 自动在项目切换 / 资产变化时刷新。
 */
export function useAssetMap(): Map<string, AssetEntry> {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [assetMap, setAssetMap] = useState<Map<string, AssetEntry>>(new Map());
  const loadingRef = useRef(new Set<string>());

  // 加载资产列表
  const refresh = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.listProjectAssets || !projectId) {
      setAssetMap(new Map());
      return;
    }

    try {
      const records: AssetRecord[] = await api.listProjectAssets(projectId);
      const newMap = new Map<string, AssetEntry>();

      // 先建立空条目
      for (const r of records) {
        newMap.set(r.id, { thumbnailSrc: undefined, fullSrc: undefined });
      }
      setAssetMap(newMap);

      // 异步加载缩略图
      for (const r of records) {
        if (loadingRef.current.has(r.id)) continue;
        loadingRef.current.add(r.id);

        api.readAssetThumbnailBase64!(projectId, r.id).then((base64: string | null) => {
          loadingRef.current.delete(r.id);
          if (base64) {
            setAssetMap((prev) => {
              const next = new Map(prev);
              next.set(r.id, { ...next.get(r.id), thumbnailSrc: base64 });
              return next;
            });
          }
        }).catch(() => {
          loadingRef.current.delete(r.id);
        });
      }
    } catch (err) {
      console.warn('useAssetMap: failed to load assets', err);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return assetMap;
}

/**
 * 命令式版本：不用 hook，直接异步获取 assetMap。
 * 适合在非组件上下文中使用。
 * @param signal 可选 AbortSignal，项目切换时可中止加载
 */
export async function fetchAssetMap(
  projectId: string,
  signal?: AbortSignal,
): Promise<Map<string, AssetEntry>> {
  const api = window.electronAPI;
  if (!api?.listProjectAssets) return new Map();
  if (signal?.aborted) return new Map();

  const records: AssetRecord[] = await api.listProjectAssets(projectId);
  const map = new Map<string, AssetEntry>();

  if (signal?.aborted) return new Map();

  await Promise.all(
    records.map(async (r) => {
      if (signal?.aborted) return;
      try {
        const base64 = await api.readAssetThumbnailBase64!(projectId, r.id);
        if (signal?.aborted) return;
        map.set(r.id, { thumbnailSrc: base64 ?? undefined, fullSrc: undefined });
      } catch {
        map.set(r.id, { thumbnailSrc: undefined, fullSrc: undefined });
      }
    }),
  );

  return map;
}
