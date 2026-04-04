/**
 * 主进程 AppCommand 监听 hook
 *
 * 将 electronAPI.onAppCommand 事件分发到 commandRegistry。
 */
import { useEffect } from 'react';
import { dispatchAppCommand } from '../commands/commandRegistry';

export function useAppCommandListener(): void {
  useEffect(() => {
    const api = window.electronAPI;
    const off = api?.onAppCommand?.((msg) => {
      dispatchAppCommand(msg.id, msg.payload);
    });
    return () => {
      off?.();
    };
  }, []);
}
