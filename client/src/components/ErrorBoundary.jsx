import React from 'react';

/**
 * Production Error Boundary — catches rendering errors in the component tree
 * and shows a user-friendly fallback instead of crashing the whole app.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    // In production you'd send this to Sentry / LogRocket / etc.
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800 p-8">
          <div className="max-w-md text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-500 mb-6 text-sm">
              The whiteboard encountered an unexpected error. Your work is
              saved — reload to continue.
            </p>
            {this.state.errorMessage && (
              <pre className="text-xs bg-gray-100 border border-gray-200 rounded-lg p-3 text-left mb-6 overflow-auto max-h-32 text-red-600">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              Reload StudyBoard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
