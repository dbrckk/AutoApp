import React from "react";

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
};

export class ErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallbackTitle?: string;
    fallbackMessage?: string;
  },
  ErrorBoundaryState
> {
  constructor(props: {
    children: React.ReactNode;
    fallbackTitle?: string;
    fallbackMessage?: string;
  }) {
    super(props);

    this.state = {
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: undefined,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    console.error("AutoApp UI error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle || "Interface error";
    const message =
      this.props.fallbackMessage ||
      "A UI component crashed. The app is still loaded, but this section needs to be reset or reloaded.";

    return (
      <main className="app-bg min-h-screen p-4 text-white">
        <section className="mx-auto mt-10 max-w-3xl rounded-[2rem] border border-red-400/20 bg-red-500/10 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">
            AutoApp Error Boundary
          </p>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
            {title}
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-100/80">{message}</p>

          {this.state.error ? (
            <details className="mt-5 rounded-2xl border border-red-400/20 bg-black/25 p-4">
              <summary className="cursor-pointer text-sm font-black text-red-100">
                Error details
              </summary>

              <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-red-100/80">
                {String(this.state.error?.stack || this.state.error?.message)}
                {"\n\n"}
                {String(this.state.errorInfo?.componentStack || "")}
              </pre>
            </details>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={this.handleReset}
              className="min-h-11 rounded-2xl border border-white/10 bg-white px-4 text-xs font-black text-black"
            >
              Reset section
            </button>

            <button
              onClick={this.handleReload}
              className="min-h-11 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 text-xs font-black text-red-100"
            >
              Reload app
            </button>
          </div>
        </section>
      </main>
    );
  }
}
