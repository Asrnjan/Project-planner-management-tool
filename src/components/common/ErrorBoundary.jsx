import { isStaleReleaseError, reloadForNewRelease } from "../../lib/staleRelease";
import { Component } from "react";

// Keeps one broken screen from blanking the whole app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // A newer release replaced this page's code: reload instead of erroring.
    if (isStaleReleaseError(error) && reloadForNewRelease()) return;
    console.error("Screen crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    if (isStaleReleaseError(this.state.error)) {
      return (
        <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Loading the latest version of the app...</p>
          <p className="mt-1">A new version was released while this page was open.</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={() => window.location.reload()}
          >
            Reload now
          </button>
        </div>
      );
    }

    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-base font-semibold text-red-900">This screen hit a problem</h2>
        <p className="mt-1 text-sm text-red-800">
          Your data is safe. Try again, or go back to the dashboard.
        </p>
        <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-xs text-red-700">
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }
}
