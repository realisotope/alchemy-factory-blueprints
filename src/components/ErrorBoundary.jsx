import React from 'react';
import { logError } from '../lib/errorHandler';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logError(error, `${this.props.name || 'ErrorBoundary'}`, {
      componentStack: errorInfo.componentStack,
      errorId,
      severity: 'HIGH',
    });

    this.setState({
      error,
      errorInfo,
      errorId,
    });
  }

  render() {
    if (this.state.hasError) {
      const { error, errorId } = this.state;
      const isDev = import.meta.env?.DEV || process.env.NODE_ENV === 'development';

      return (
        <div className="flex items-center justify-center min-h-screen bg-red-50 dark:bg-red-900/20">
          <div className="max-w-md w-full p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4v2m0 4v2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="text-center text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h1>

            <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
              We encountered an unexpected error. Please try refreshing the page.
            </p>

            {errorId && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 mb-4 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Error ID:</p>
                <p className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                  {errorId}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Share this ID with support if the problem persists.
                </p>
              </div>
            )}

            {isDev && error && (
              <details className="mb-4 text-xs">
                <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 overflow-auto max-h-32">
                  <p className="text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap break-words">
                    {error.toString()}
                  </p>
                </div>
              </details>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              Refresh Page
            </button>

            <button
              onClick={() => (window.location.href = '/')}
              className="w-full mt-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
