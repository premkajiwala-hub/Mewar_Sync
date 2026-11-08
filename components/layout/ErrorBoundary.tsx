import React from 'react';

interface State {
  hasError: boolean;
}

/** Last-resort boundary: shows a recoverable message instead of a blank screen. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.error(error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div role="alert" className="ms-glass max-w-md rounded-[22px] p-6 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-muted">Your saved records are safe. Reload the page to continue.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-11 items-center rounded-xl bg-indigo px-5 text-sm font-medium text-white transition-colors hover:bg-[#2c4877]"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
