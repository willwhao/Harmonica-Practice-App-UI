import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recordMonitoringEvent } from '../quality/monitoring';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || '页面发生未知错误' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordMonitoringEvent({
      type: 'error',
      message: error.message || 'React 渲染错误',
      metadata: {
        componentStack: (info.componentStack ?? '').slice(0, 500),
      },
    });
  }

  reset = () => {
    recordMonitoringEvent({ type: 'recovery', message: '用户从错误边界恢复页面' });
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div role="alert" style={{ maxWidth: 360, border: '1px solid rgba(239,68,68,0.26)', background: 'rgba(127,29,29,0.35)', borderRadius: 18, padding: 20, color: '#FEE2E2', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 20, color: '#FCA5A5' }}>页面遇到问题</h1>
          <p style={{ margin: 0, color: '#FECACA', fontSize: 13, lineHeight: 1.6 }}>
            {this.state.message}。你可以尝试恢复页面；如果问题重复出现，请导出数据后反馈。
          </p>
          <button
            type="button"
            onClick={this.reset}
            style={{ marginTop: 16, width: '100%', height: 44, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#00C9B1,#0099A0)', color: '#051015', fontWeight: 800, cursor: 'pointer' }}
          >
            尝试恢复
          </button>
        </div>
      </div>
    );
  }
}
