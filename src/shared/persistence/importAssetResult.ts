/** 主进程 importAssets 返回：磁盘绝对路径 + DB 中 assets.id + 相对项目根路径 */
export interface ImportAssetResult {
  absolutePath: string;
  assetId: string;
  relativePath: string;
  /** 缩略图相对路径（长边 800px），可能为 undefined（生成失败时） */
  thumbnailRelativePath?: string;
}
