import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="flex justify-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold">Er is iets misgegaan</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm text-primary underline hover:no-underline"
            >
              Pagina vernieuwen
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
