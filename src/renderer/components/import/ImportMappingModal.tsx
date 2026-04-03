/**
 * Excel/CSV 字段映射 Modal — Sheet 选择、列映射、实时预览、输出模式
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ParsedTable, FieldMapping, ImportFieldKey, ImportMappingConfig } from '../../../shared/importMapping';
import { autoSuggestMapping } from '../../../shared/importMapping';
import type { ExcelImportRow } from '../../../shared/excelImport';
import type { DataRecord } from '../../../shared/types';
import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../utils/toast';

export type ImportMappingModalProps = {
  tables: ParsedTable[];
  onClose: () => void;
};

const FIELD_LABELS: Record<ImportFieldKey, string> = {
  internalOrderNo: '内部单号',
  sizeText: '尺寸',
  quantity: '数量',
  sku: 'SKU',
  color: '颜色',
  barcode: '条码',
  imagePath: '图片路径',
  text1: '备注/文本',
};

const ALL_FIELDS: ImportFieldKey[] = [
  'internalOrderNo',
  'sizeText',
  'quantity',
  'sku',
  'color',
  'barcode',
  'imagePath',
  'text1',
];

type OutputMode = 'layout' | 'dataRecord';

function newRecordId(): string {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const ImportMappingModal: React.FC<ImportMappingModalProps> = ({
  tables,
  onClose,
}) => {
  const addItem = useAppStore((s) => s.addItem);
  const setConfig = useAppStore((s) => s.setConfig);
  const setDataRecords = useAppStore((s) => s.setDataRecords);
  const dataRecords = useAppStore((s) => s.dataRecords);

  const [selectedTableIdx, setSelectedTableIdx] = useState(0);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [sizeUnit, setSizeUnit] = useState<'cm' | 'mm'>('cm');
  const [outputMode, setOutputMode] = useState<OutputMode>('layout');

  const table = tables[selectedTableIdx] ?? null;

  // 切换 table 时自动匹配
  useEffect(() => {
    if (!table) return;
    const suggested = autoSuggestMapping(table.columns);
    setMappings(suggested);
  }, [table]);

  const updateMapping = useCallback(
    (field: ImportFieldKey, columnIndex: number) => {
      setMappings((prev) => {
        const without = prev.filter((m) => m.field !== field);
        if (columnIndex < 0) return without;
        return [...without, { field, columnIndex }];
      });
    },
    [],
  );

  // 预览前 5 行映射结果
  const preview = useMemo(() => {
    if (!table) return [];
    const rows = table.dataRows.slice(0, 5);
    return rows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const m of mappings) {
        mapped[m.field] = row[m.columnIndex] ?? '';
      }
      return mapped;
    });
  }, [table, mappings]);

  const handleConfirm = useCallback(async () => {
    if (!table) return;

    if (outputMode === 'layout') {
      // 走旧模式：mapTableToImportRows → addItem
      const api = window.electronAPI;
      const config: ImportMappingConfig = { mappings, sizeUnit };

      if (api?.mapTableToImportRows) {
        const res = await api.mapTableToImportRows(table, config);
        const rows = res.rows as ExcelImportRow[];
        for (const row of rows) {
          addItem({
            name: row.name,
            width: row.widthMm,
            height: row.heightMm,
            quantity: row.quantity,
            imageSrc: '',
          });
        }
        setConfig({ singleCanvas: true });
        showToast(
          res.warnings.length > 0
            ? `已导入 ${rows.length} 条（布局素材），${res.warnings.length} 条提示`
            : `已导入 ${rows.length} 条布局素材`,
        );
        if (res.warnings.length > 0) console.warn('[映射导入]', res.warnings);
      } else {
        showToast('映射导入不可用');
      }
    } else {
      // 数据记录模式：直接构造 DataRecord[]
      const now = new Date().toISOString();
      const sessionId = `sess_${Date.now().toString(36)}`;
      const records: DataRecord[] = table.dataRows.map((row, idx) => {
        const fields: Record<string, string> = {};
        for (const col of table.columns) {
          fields[col.headerText] = row[col.index] ?? '';
        }
        // 从映射找数量
        const qtyMapping = mappings.find((m) => m.field === 'quantity');
        const qtyStr = qtyMapping ? (row[qtyMapping.columnIndex] ?? '1') : '1';
        const qty = Math.max(1, Math.floor(Number(qtyStr) || 1));

        return {
          id: newRecordId(),
          sourceSessionId: sessionId,
          sourceRowIndex: idx,
          fields,
          qty,
          sourceName: table.sheetName,
          createdAt: now,
          updatedAt: now,
        };
      });

      setDataRecords([...dataRecords, ...records]);
      showToast(`已导入 ${records.length} 条数据记录`);
    }

    onClose();
  }, [table, mappings, sizeUnit, outputMode, addItem, setConfig, setDataRecords, dataRecords, onClose]);

  if (!table) {
    return (
      <div className="wizard-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="wizard-panel">
          <div className="wizard-header">
            <h2 className="wizard-title">字段映射</h2>
          </div>
          <div className="wizard-body">
            <p>未找到有效工作表</p>
          </div>
          <div className="wizard-footer">
            <button type="button" className="btn" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wizard-panel" style={{ width: 'min(680px, 96vw)' }}>
        <div className="wizard-header">
          <h2 className="wizard-title">字段映射</h2>
          <span className="wizard-step-indicator">{table.sheetName}</span>
        </div>

        <div className="wizard-body">
          {/* Sheet 选择 */}
          {tables.length > 1 && (
            <div className="wizard-field">
              <span className="wizard-label">工作表</span>
              <select
                className="wizard-input"
                value={selectedTableIdx}
                onChange={(e) => setSelectedTableIdx(Number(e.target.value))}
              >
                {tables.map((t, i) => (
                  <option key={i} value={i}>
                    {t.sheetName} ({t.dataRows.length} 行)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 列映射 */}
          <div className="wizard-field">
            <span className="wizard-label">列映射</span>
            <div className="mapping-table">
              {ALL_FIELDS.map((field) => {
                const current = mappings.find((m) => m.field === field);
                return (
                  <div key={field} className="mapping-row">
                    <span className="mapping-row__label">{FIELD_LABELS[field]}</span>
                    <select
                      className="wizard-input mapping-row__select"
                      value={current?.columnIndex ?? -1}
                      onChange={(e) => updateMapping(field, Number(e.target.value))}
                    >
                      <option value={-1}>-- 不映射 --</option>
                      {table.columns.map((col) => (
                        <option key={col.index} value={col.index}>
                          {col.headerText || `列 ${col.index + 1}`}
                          {col.sampleValues[0] ? ` (${col.sampleValues[0].slice(0, 15)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 尺寸单位 */}
          <div className="wizard-field">
            <span className="wizard-label">尺寸单位</span>
            <div className="wizard-radio-group">
              <label className="wizard-radio">
                <input
                  type="radio"
                  checked={sizeUnit === 'cm'}
                  onChange={() => setSizeUnit('cm')}
                />
                cm
              </label>
              <label className="wizard-radio">
                <input
                  type="radio"
                  checked={sizeUnit === 'mm'}
                  onChange={() => setSizeUnit('mm')}
                />
                mm
              </label>
            </div>
          </div>

          {/* 输出模式 */}
          <div className="wizard-field">
            <span className="wizard-label">输出模式</span>
            <div className="wizard-radio-group">
              <label className="wizard-radio">
                <input
                  type="radio"
                  name="outputMode"
                  checked={outputMode === 'layout'}
                  onChange={() => setOutputMode('layout')}
                />
                布局素材（旧行为）
              </label>
              <label className="wizard-radio">
                <input
                  type="radio"
                  name="outputMode"
                  checked={outputMode === 'dataRecord'}
                  onChange={() => setOutputMode('dataRecord')}
                />
                数据记录（模板流程）
              </label>
            </div>
          </div>

          {/* 预览 */}
          {preview.length > 0 && (
            <div className="wizard-field">
              <span className="wizard-label">映射预览（前 5 行）</span>
              <div className="mapping-preview">
                <table className="mapping-preview__table">
                  <thead>
                    <tr>
                      {mappings.map((m) => (
                        <th key={m.field}>{FIELD_LABELS[m.field]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {mappings.map((m) => (
                          <td key={m.field}>{row[m.field]?.slice(0, 20) || '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="wizard-footer">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleConfirm()}
          >
            确认导入 ({table.dataRows.length} 行)
          </button>
        </div>
      </div>
    </div>
  );
};
