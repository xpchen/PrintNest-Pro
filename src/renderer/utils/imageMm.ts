/** 导入图片弹窗：像素 + DPI → mm（与 Toolbar 导入逻辑共用） */
export const DEFAULT_IMPORT_DPI = 150;

export function pxToMm(px: number, dpi: number = DEFAULT_IMPORT_DPI): number {
  return Math.round((px / dpi) * 25.4);
}
