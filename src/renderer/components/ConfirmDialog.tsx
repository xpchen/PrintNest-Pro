import React, { useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAppStore } from '../store/useAppStore';

export const ConfirmDialog: React.FC = () => {
  const { open, title, message, confirmLabel, danger } = useAppStore((s) => s.confirmDialog);
  const dismiss = useAppStore((s) => s.dismissConfirm);

  const handleConfirm = useCallback(() => dismiss(true), [dismiss]);
  const handleCancel = useCallback(() => dismiss(false), [dismiss]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        handleConfirm();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, handleCancel, handleConfirm]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="confirm-dialog__overlay" onMouseDown={handleCancel}>
      <div className="confirm-dialog__card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="confirm-dialog__title">{title}</div>
        <div className="confirm-dialog__message">{message}</div>
        <div className="confirm-dialog__actions">
          <button type="button" className="btn confirm-dialog__btn--cancel" onClick={handleCancel}>
            取消
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'confirm-dialog__btn--danger' : 'btn-primary'}`}
            onClick={handleConfirm}
            autoFocus
          >
            {confirmLabel || '确认'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
