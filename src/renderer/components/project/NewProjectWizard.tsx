/**
 * 新建项目初始化向导 — 两步收集生产上下文
 *
 * Step 1: 项目名称 + 客户名 + 单位 + 材料类型 + 画布尺寸
 * Step 2: 间距/出血/旋转/策略 + 起始方式
 */
import React, { useCallback, useState } from 'react';
import { PackingStrategy } from '../../../shared/types';
import type {
  ProjectUnit,
  MaterialType,
  ProjectStartMode,
  ProjectInitPayload,
} from '../../../shared/types/projectInit';

export type NewProjectWizardProps = {
  onComplete: (payload: ProjectInitPayload) => void;
  onCancel: () => void;
};

/* ── 单位换算工具 ── */

/** 将用户输入值（按 unit）转为 mm */
function toMm(value: number, unit: ProjectUnit): number {
  if (unit === 'cm') return value * 10;
  if (unit === 'inch') return value * 25.4;
  return value;
}

/** 将 mm 转为用户显示值（按 unit） */
function fromMm(mm: number, unit: ProjectUnit): number {
  if (unit === 'cm') return mm / 10;
  if (unit === 'inch') return mm / 25.4;
  return mm;
}

function unitLabel(unit: ProjectUnit): string {
  if (unit === 'cm') return 'cm';
  if (unit === 'inch') return 'in';
  return 'mm';
}

/* ── 常用预设 ── */

type Preset = {
  label: string;
  materialType: MaterialType;
  widthMm: number;
  heightMm: number;
};

const PRESETS: Preset[] = [
  { label: '卷材 160cm', materialType: 'roll', widthMm: 1600, heightMm: 5000 },
  { label: '卷材 130cm', materialType: 'roll', widthMm: 1300, heightMm: 5000 },
  { label: 'A3 单张', materialType: 'sheet', widthMm: 297, heightMm: 420 },
  { label: 'A4 单张', materialType: 'sheet', widthMm: 210, heightMm: 297 },
  { label: '50×70cm', materialType: 'sheet', widthMm: 500, heightMm: 700 },
];

export const NewProjectWizard: React.FC<NewProjectWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [projectName, setProjectName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [defaultUnit, setDefaultUnit] = useState<ProjectUnit>('mm');
  const [materialType, setMaterialType] = useState<MaterialType>('roll');
  const [canvasWidth, setCanvasWidth] = useState(1600); // mm
  const [canvasHeight, setCanvasHeight] = useState(5000); // mm

  // Step 2 fields
  const [globalSpacing, setGlobalSpacing] = useState(2); // mm
  const [globalBleed, setGlobalBleed] = useState(3); // mm
  const [edgeSafeMm, setEdgeSafeMm] = useState(0);
  const [allowRotation, setAllowRotation] = useState(true);
  const [strategy, setStrategy] = useState<PackingStrategy>(PackingStrategy.BestShortSideFit);
  const [singleCanvas, setSingleCanvas] = useState(false);
  const [startMode, setStartMode] = useState<ProjectStartMode>('blank');

  const applyPreset = useCallback(
    (p: Preset) => {
      setMaterialType(p.materialType);
      setCanvasWidth(p.widthMm);
      setCanvasHeight(p.heightMm);
      if (p.materialType === 'roll') {
        setSingleCanvas(false);
      }
    },
    [],
  );

  const handleNext = useCallback(() => {
    setStep(2);
  }, []);

  const handleBack = useCallback(() => {
    setStep(1);
  }, []);

  const handleCreate = useCallback(() => {
    const payload: ProjectInitPayload = {
      projectName: projectName.trim() || '未命名项目',
      customerName: customerName.trim() || undefined,
      defaultUnit,
      materialType,
      canvasWidthMm: canvasWidth,
      canvasHeightMm: canvasHeight,
      globalSpacing,
      globalBleed,
      edgeSafeMm: edgeSafeMm > 0 ? edgeSafeMm : undefined,
      allowRotation,
      strategy,
      singleCanvas,
      startMode,
    };
    onComplete(payload);
  }, [
    projectName, customerName, defaultUnit, materialType,
    canvasWidth, canvasHeight, globalSpacing, globalBleed,
    edgeSafeMm, allowRotation, strategy, singleCanvas, startMode,
    onComplete,
  ]);

  /* ── 显示值：宽高按当前单位显示，内部存 mm ── */
  const displayW = Number(fromMm(canvasWidth, defaultUnit).toFixed(2));
  const displayH = Number(fromMm(canvasHeight, defaultUnit).toFixed(2));

  const setDisplayWidth = (v: number) => setCanvasWidth(toMm(v, defaultUnit));
  const setDisplayHeight = (v: number) => setCanvasHeight(toMm(v, defaultUnit));

  const uLabel = unitLabel(defaultUnit);

  const canGoNext = projectName.trim().length > 0 && canvasWidth > 0 && canvasHeight > 0;

  return (
    <div className="wizard-overlay">
      <div className="wizard-panel">
        <div className="wizard-header">
          <h2 className="wizard-title">新建项目</h2>
          <span className="wizard-step-indicator">
            步骤 {step} / 2
          </span>
        </div>

        {step === 1 ? (
          <div className="wizard-body">
            {/* 项目名称 */}
            <label className="wizard-field">
              <span className="wizard-label">项目名称 *</span>
              <input
                type="text"
                className="wizard-input"
                placeholder="例如：春季订单-A 批次"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
              />
            </label>

            {/* 客户名 */}
            <label className="wizard-field">
              <span className="wizard-label">客户 / 订单名（可选）</span>
              <input
                type="text"
                className="wizard-input"
                placeholder="可选"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>

            {/* 单位 */}
            <div className="wizard-field">
              <span className="wizard-label">单位</span>
              <div className="wizard-radio-group">
                {(['mm', 'cm', 'inch'] as ProjectUnit[]).map((u) => (
                  <label key={u} className="wizard-radio">
                    <input
                      type="radio"
                      name="unit"
                      checked={defaultUnit === u}
                      onChange={() => setDefaultUnit(u)}
                    />
                    {u === 'inch' ? 'inch' : u}
                  </label>
                ))}
              </div>
            </div>

            {/* 常用预设 */}
            <div className="wizard-field">
              <span className="wizard-label">常用预设</span>
              <div className="wizard-presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="wizard-preset-btn"
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 材料类型 */}
            <div className="wizard-field">
              <span className="wizard-label">材料类型</span>
              <div className="wizard-radio-group">
                <label className="wizard-radio">
                  <input
                    type="radio"
                    name="material"
                    checked={materialType === 'roll'}
                    onChange={() => setMaterialType('roll')}
                  />
                  卷材
                </label>
                <label className="wizard-radio">
                  <input
                    type="radio"
                    name="material"
                    checked={materialType === 'sheet'}
                    onChange={() => setMaterialType('sheet')}
                  />
                  单张
                </label>
              </div>
            </div>

            {/* 画布尺寸 */}
            <div className="wizard-field-row">
              <label className="wizard-field wizard-field--half">
                <span className="wizard-label">
                  {materialType === 'roll' ? '卷材宽度' : '宽度'} ({uLabel})
                </span>
                <input
                  type="number"
                  className="wizard-input"
                  value={displayW}
                  min={1}
                  onChange={(e) => setDisplayWidth(Number(e.target.value))}
                />
              </label>
              <label className="wizard-field wizard-field--half">
                <span className="wizard-label">
                  {materialType === 'roll' ? '初始长度' : '高度'} ({uLabel})
                </span>
                <input
                  type="number"
                  className="wizard-input"
                  value={displayH}
                  min={1}
                  onChange={(e) => setDisplayHeight(Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="wizard-body">
            {/* 间距 */}
            <div className="wizard-field-row">
              <label className="wizard-field wizard-field--half">
                <span className="wizard-label">全局间距 (mm)</span>
                <input
                  type="number"
                  className="wizard-input"
                  value={globalSpacing}
                  min={0}
                  step={0.5}
                  onChange={(e) => setGlobalSpacing(Number(e.target.value))}
                />
              </label>
              <label className="wizard-field wizard-field--half">
                <span className="wizard-label">全局出血 (mm)</span>
                <input
                  type="number"
                  className="wizard-input"
                  value={globalBleed}
                  min={0}
                  step={0.5}
                  onChange={(e) => setGlobalBleed(Number(e.target.value))}
                />
              </label>
            </div>

            {/* 安全边距 */}
            <label className="wizard-field">
              <span className="wizard-label">安全边距 (mm)</span>
              <input
                type="number"
                className="wizard-input"
                value={edgeSafeMm}
                min={0}
                step={0.5}
                onChange={(e) => setEdgeSafeMm(Number(e.target.value))}
              />
            </label>

            {/* 旋转 */}
            <div className="wizard-field">
              <label className="wizard-checkbox">
                <input
                  type="checkbox"
                  checked={allowRotation}
                  onChange={(e) => setAllowRotation(e.target.checked)}
                />
                允许旋转
              </label>
            </div>

            {/* 排版策略 */}
            <div className="wizard-field">
              <span className="wizard-label">排版策略</span>
              <select
                className="wizard-input"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as PackingStrategy)}
              >
                <option value={PackingStrategy.BestShortSideFit}>短边最佳 (BSSF)</option>
                <option value={PackingStrategy.BestLongSideFit}>长边最佳 (BLSF)</option>
                <option value={PackingStrategy.BestAreaFit}>面积最佳 (BAF)</option>
                <option value={PackingStrategy.BottomLeft}>左下优先 (BL)</option>
              </select>
            </div>

            {/* 单画布 */}
            <div className="wizard-field">
              <label className="wizard-checkbox">
                <input
                  type="checkbox"
                  checked={singleCanvas}
                  onChange={(e) => setSingleCanvas(e.target.checked)}
                />
                单画布模式（不自动新建画布）
              </label>
            </div>

            {/* 起始方式 */}
            <div className="wizard-field">
              <span className="wizard-label">起始方式</span>
              <div className="wizard-radio-group">
                <label className="wizard-radio">
                  <input
                    type="radio"
                    name="startMode"
                    checked={startMode === 'blank'}
                    onChange={() => setStartMode('blank')}
                  />
                  空白项目
                </label>
                <label className="wizard-radio">
                  <input
                    type="radio"
                    name="startMode"
                    checked={startMode === 'fromExcel'}
                    onChange={() => setStartMode('fromExcel')}
                  />
                  从 Excel/CSV 开始
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="wizard-footer">
          {step === 1 ? (
            <>
              <button type="button" className="btn" onClick={onCancel}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canGoNext}
                onClick={handleNext}
              >
                下一步
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={handleBack}>
                上一步
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCreate}>
                创建项目
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
