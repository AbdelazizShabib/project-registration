import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-white text-black p-10 overflow-auto">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Something went wrong!</h1>
          <p className="font-mono bg-slate-100 p-4 rounded mb-4">{this.state.error && this.state.error.toString()}</p>
          <pre className="font-mono bg-slate-100 p-4 rounded text-sm">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
