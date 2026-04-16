
import React, { ReactNode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };
  
  // Explicitly defined to ensure props are recognized
  public props: Readonly<ErrorBoundaryProps>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || String(this.state.error || 'Unknown Error');
      
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 max-w-lg w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">出错了 (Something went wrong)</h1>
            <p className="text-slate-600 mb-4">应用程序发生崩溃，错误信息如下：</p>
            <pre className="bg-slate-100 p-4 rounded-lg overflow-auto border border-slate-300 text-xs font-mono text-red-500 mb-6 max-h-40 whitespace-pre-wrap break-all">
              {errorMsg}
            </pre>
            <div className="flex gap-4">
              <button 
                onClick={() => { localStorage.clear(); window.location.href = window.location.pathname; }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                重置并刷新
              </button>
              <button 
                 onClick={() => window.location.reload()}
                 className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors border border-slate-200"
              >
                尝试刷新
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error("Failed to find root element");
}
