/**
 * Toast 通知组件 — React Portal，右下角堆叠
 *
 * 向后兼容：showToast(msg) 签名不变
 */
import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';

type ToastLevel = 'info' | 'success' | 'warning' | 'error';

interface ToastItem {
  id: number;
  message: string;
  level: ToastLevel;
}

let nextId = 0;
let addToastFn: ((msg: string, level?: ToastLevel) => void) | null = null;

/** 等待容器就绪前的缓冲队列 */
const pendingQueue: { msg: string; level?: ToastLevel }[] = [];

/** 全局调用入口（向后兼容） */
export function showToast(msg: string, level?: ToastLevel): void {
  if (addToastFn) {
    addToastFn(msg, level);
  } else {
    // 容器尚未挂载，缓冲消息
    pendingQueue.push({ msg, level });
  }
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const addToast = useCallback((message: string, level: ToastLevel = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, level }]);
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
    timersRef.current.add(timer);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    // 刷新挂载前缓冲的消息
    while (pendingQueue.length > 0) {
      const item = pendingQueue.shift()!;
      addToast(item.msg, item.level);
    }
    return () => {
      addToastFn = null;
      // 卸载时清除所有待执行的 setTimeout
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current.clear();
    };
  }, [addToast]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return ReactDOM.createPortal(
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.level}`} role="alert">
          <span className="toast__message">{t.message}</span>
          <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="关闭">
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
};
