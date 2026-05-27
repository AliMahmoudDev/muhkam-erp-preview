import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const entry = { msg: "[ErrorBoundary] Uncaught React error", error: error.message, stack: info.componentStack };
    if (typeof window !== "undefined") {
      fetch("/api/health/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
        keepalive: true,
      }).catch(() => {});
    }
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div dir="rtl" className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8 text-center">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-bold text-red-400">حدث خطأ غير متوقع</h2>
          <p className="text-sm text-zinc-400 max-w-md">
            {this.state.error?.message ?? "يرجى إعادة المحاولة. إذا استمرت المشكلة، تواصل مع الدعم الفني."}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-md bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
