import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Catches render-time errors in the routed page tree and shows a recoverable
 * fallback instead of a blank white screen. App.tsx wraps the route switch in
 * this. (Recovered Replit export referenced it but dropped the component file.)
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Log for diagnostics; never log PHI.
    console.error("[RouteErrorBoundary] render error:", error?.message, info);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            maxWidth: 560,
            margin: "4rem auto",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            color: "#0f172a",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
            Something went wrong on this page.
          </h2>
          <p style={{ color: "#475569", marginBottom: "1.5rem" }}>
            Please try reloading. If it keeps happening, contact support.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: 8,
              border: "none",
              background: "#0891b2",
              color: "white",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
