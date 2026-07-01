import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

/**
 * App-wide error boundary that wraps the route <Switch>.
 *
 * If any lazily-loaded page throws during render, this catches the error
 * and shows a recoverable fallback instead of a blank white screen. This
 * is important for a health app: a single page-level bug should never take
 * down the whole shell (navigation, sign-out, etc.).
 *
 * Deliberately minimal: it does NOT log PHI. Only the error message and
 * stack (which are code-level, not patient data) are sent to console in
 * development; nothing is transmitted anywhere.
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Never log request/response bodies or patient data here — only the
    // code-level error. Guarded to development to avoid noisy prod consoles.
    if (import.meta.env.DEV) {
      console.error("[RouteErrorBoundary] Uncaught render error:", error, info.componentStack);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
          role="alert"
          aria-live="assertive"
          data-testid="route-error-boundary"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">
              Something went wrong on this page
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              This page hit an unexpected error. Your health data is safe. Try again, or
              return to the dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={this.handleReset} data-testid="button-route-error-retry">
              <RefreshCw className="me-2 h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/";
              }}
              data-testid="button-route-error-home"
            >
              Go to dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
