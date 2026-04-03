import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PEEK_CLOSE_DELAY_MS = 280;

/**
 * 收起态 Dock：鼠标进入整块区域打开 peek；离开整块区域后延迟关闭，
 * 避免从 rail 移到浮层面板时误触发关闭或闪烁。
 */
export function useDockPeek(collapsed: boolean): {
  peek: boolean;
  dockPointerHandlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
} {
  const [peek, setPeek] = useState(false);
  const closeTimerRef = useRef<number | undefined>(undefined);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (!collapsed) {
      setPeek(false);
      cancelScheduledClose();
    }
  }, [collapsed, cancelScheduledClose]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  const dockPointerHandlers = useMemo(
    () => ({
      onMouseEnter: () => {
        cancelScheduledClose();
        if (collapsed) setPeek(true);
      },
      onMouseLeave: () => {
        if (!collapsed) return;
        cancelScheduledClose();
        closeTimerRef.current = window.setTimeout(() => {
          closeTimerRef.current = undefined;
          setPeek(false);
        }, PEEK_CLOSE_DELAY_MS);
      },
    }),
    [collapsed, cancelScheduledClose],
  );

  return { peek, dockPointerHandlers };
}
