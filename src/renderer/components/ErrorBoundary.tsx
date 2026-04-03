import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const api = (window as unknown as Record<string, unknown>).electronAPI as
      | { logError?: (...args: unknown[]) => void }
      | undefined;
    api?.logError?.('React render error', error.message, error.stack, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 16,
            fontFamily: 'system-ui, sans-serif',
            color: '#333',
          }}
        >
          <h2 style={{ margin: 0 }}>PrintNest Pro 遇到了一个错误</h2>
          <p style={{ color: '#666', maxWidth: 480, textAlign: 'center' }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '8px 24px',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: '#f5f5f5',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
