import { Component, type ReactNode } from "react";

export class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="container mx-auto px-4 py-16 text-center" role="alert">
          <h1 className="text-2xl font-bold mb-4">This page could not load</h1>
          <p className="text-muted-foreground mb-6">
            Please reload the page or return to the home page.
          </p>
          <a className="underline" href="/">Return to home</a>
        </main>
      );
    }
    return this.props.children;
  }
}
