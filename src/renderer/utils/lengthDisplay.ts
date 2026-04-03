/**
 * 显示用长度单位：内部与引擎始终 mm，仅 UI 换算与画布刻度/网格步长。
 */
export type DisplayLengthUnit = 'mm' | 'cm' | 'm' | 'ft' | 'in';

export const MM_PER_IN = 25.4;
export const MM_PER_FT = 304.8;

const UNIT_SUFFIX: Record<DisplayLengthUnit, string> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  ft: 'ft',
  in: 'in',
};

export function displayUnitAbbrev(unit: DisplayLengthUnit): string {
  return UNIT_SUFFIX[unit];
}

export function isDisplayLengthUnit(v: unknown): v is DisplayLengthUnit {
  return v === 'mm' || v === 'cm' || v === 'm' || v === 'ft' || v === 'in';
}

export function mmToUnit(valueMm: number, unit: DisplayLengthUnit): number {
  switch (unit) {
    case 'mm':
      return valueMm;
    case 'cm':
      return valueMm / 10;
    case 'm':
      return valueMm / 1000;
    case 'in':
      return valueMm / MM_PER_IN;
    case 'ft':
      return valueMm / MM_PER_FT;
    default:
      return valueMm;
  }
}

export function unitToMm(value: number, unit: DisplayLengthUnit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'm':
      return value * 1000;
    case 'in':
      return value * MM_PER_IN;
    case 'ft':
      return value * MM_PER_FT;
    default:
      return value;
  }
}

function roundDisplay(value: number, unit: DisplayLengthUnit): string {
  if (unit === 'mm') return String(Math.round(value));
  if (unit === 'cm' || unit === 'in') return String(Math.round(value * 10) / 10);
  return String(Math.round(value * 1000) / 1000);
}

/** 单值 + 单位后缀，用于标签、状态栏 */
export function formatLengthMm(valueMm: number, unit: DisplayLengthUnit): string {
  const v = mmToUnit(valueMm, unit);
  return `${roundDisplay(v, unit)} ${UNIT_SUFFIX[unit]}`;
}

/** 同一单位下 W×H，例如 `100 × 200 cm` */
export function formatPairMm(wMm: number, hMm: number, unit: DisplayLengthUnit): string {
  const uw = mmToUnit(wMm, unit);
  const uh = mmToUnit(hMm, unit);
  return `${roundDisplay(uw, unit)} × ${roundDisplay(uh, unit)} ${UNIT_SUFFIX[unit]}`;
}

/** 状态栏指针坐标：同一单位后缀 */
export function formatPointerPairMm(xMm: number, yMm: number, unit: DisplayLengthUnit): string {
  return `${formatRulerTickMm(xMm, unit)}, ${formatRulerTickMm(yMm, unit)} ${UNIT_SUFFIX[unit]}`;
}

/** 面积（输入 mm²） */
export function formatAreaMm(valueMm2: number, unit: DisplayLengthUnit): string {
  if (unit === 'mm') return `${Math.round(valueMm2)} mm²`;
  if (unit === 'cm') {
    const cm2 = valueMm2 / 100;
    return `${Math.round(cm2 * 10) / 10} cm²`;
  }
  if (unit === 'm') {
    const m2 = valueMm2 / 1_000_000;
    return `${Math.round(m2 * 1_000_000) / 1_000_000} m²`;
  }
  if (unit === 'in') {
    const in2 = valueMm2 / (MM_PER_IN * MM_PER_IN);
    return `${Math.round(in2 * 10) / 10} in²`;
  }
  const ft2 = valueMm2 / (MM_PER_FT * MM_PER_FT);
  return `${Math.round(ft2 * 1000) / 1000} ft²`;
}

/** 标尺主刻度数字（位置为距原点的 mm） */
export function formatRulerTickMm(positionMm: number, unit: DisplayLengthUnit): string {
  const v = mmToUnit(positionMm, unit);
  return roundDisplay(v, unit);
}

const STEP_POOL: Record<DisplayLengthUnit, number[]> = {
  mm: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
  cm: [10, 20, 50, 100, 200, 500, 1000, 2000],
  m: [100, 200, 500, 1000, 2000, 5000, 10000, 20000],
  in: [25.4, 50.8, 76.2, 127, 254, 508, 762, 914.4, 1524, 3048],
  ft: [304.8, 609.6, 914.4, 1524, 3048, 6096, 9144],
};

const MIN_LINE_SPACING_PX = 12;
const MAX_GRID_LINES = 700;

/**
 * 按显示单位与缩放选取网格/标尺次要步长（mm）；主步长为其整数倍，便于对齐整单位。
 */
export function getDisplayGeometrySteps(
  unit: DisplayLengthUnit,
  zoomPxPerMm: number,
  canvasWmm: number,
  canvasHmm: number,
): { minorStepMm: number; majorStepMm: number } {
  const z = Math.max(zoomPxPerMm, 1e-6);
  const pool = STEP_POOL[unit];

  let minorStepMm = pool[pool.length - 1]!;
  let found = false;
  for (const s of pool) {
    const lineCount = Math.ceil(canvasWmm / s) + Math.ceil(canvasHmm / s);
    if (s * z >= MIN_LINE_SPACING_PX && lineCount <= MAX_GRID_LINES) {
      minorStepMm = s;
      found = true;
      break;
    }
  }
  if (!found) {
    for (let i = pool.length - 1; i >= 0; i--) {
      const s = pool[i]!;
      const lineCount = Math.ceil(canvasWmm / s) + Math.ceil(canvasHmm / s);
      if (lineCount <= MAX_GRID_LINES) {
        minorStepMm = s;
        break;
      }
    }
  }

  const majorMultiples = [2, 5, 10, 20];
  let majorStepMm = minorStepMm;
  for (const m of majorMultiples) {
    const t = minorStepMm * m;
    if (t * z >= 36 && t > minorStepMm) {
      majorStepMm = t;
      break;
    }
  }
  if (majorStepMm <= minorStepMm) {
    majorStepMm = minorStepMm * 5;
  }

  return { minorStepMm, majorStepMm };
}

export const DISPLAY_UNIT_OPTIONS: { value: DisplayLengthUnit; label: string }[] = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'm', label: 'm' },
  { value: 'in', label: 'in' },
  { value: 'ft', label: 'ft' },
];
