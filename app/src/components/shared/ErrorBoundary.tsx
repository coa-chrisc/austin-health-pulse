import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

export function ErrorFallback() {
  return (
    <div
      role="alert"
      className="flex items-center justify-center min-h-[50vh] bg-page"
    >
      <div className="text-center max-w-md p-8">
        <span
          className="material-symbols-outlined text-negative text-5xl mb-4 block"
          aria-hidden="true"
        >
          error
        </span>
        <h2 className="text-xl font-semibold text-ink mb-2">
          Something went wrong loading this view
        </h2>
        <p className="text-muted mb-6">
          Try reloading the page. If the problem continues, return to the home
          page.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-control bg-primary text-on-brand text-sm font-semibold hover:brightness-110 active:scale-[0.97] transition"
          >
            Reload
          </button>
          <a
            href="#/"
            className="text-primary text-sm font-semibold hover:underline"
          >
            Go to home page
          </a>
        </div>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("View crashed:", error, info.componentStack);
  }

  render() {
    return this.state.error ? <ErrorFallback /> : this.props.children;
  }
}
