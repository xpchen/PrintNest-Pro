/**
 * 手工编辑 patch 模型（计划阶段四）：绑定 sourceRunId，非整份 result 快照。
 */
export type ManualEditOp = 'move' | 'rotate' | 'lock' | 'hide' | 'duplicate';

export interface ManualEditPatch {
  sourceRunId: string | null;
  placementId: string;
  op: ManualEditOp;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  delta?: { dx?: number; dy?: number };
  updatedAt: string;
  revision: number;
}
