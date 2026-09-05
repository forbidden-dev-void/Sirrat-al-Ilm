/**
 * AppErrorBoundary
 * ================
 *
 * Catches render-time crashes anywhere in the tree and shows a calm recovery
 * screen instead of a blank page. Errors are logged to the console (and could be
 * forwarded to a monitoring service by replacing the body of componentDidCatch).
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Sirrat al-Ilm crashed while rendering:', error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash-screen">
        <div className="crash-screen__card">
          <span className="crash-screen__mark" aria-hidden="true">
            س
          </span>
          <h1>This page lost its place</h1>
          <p>
            An unexpected error interrupted the page. Your progress is saved on the server — reload
            and pick up where you left off.
          </p>
          <pre className="crash-screen__detail">{error.message}</pre>
          <div className="crash-screen__actions">
            <button type="button" className="btn btn--primary" onClick={this.handleReload}>
              Back to the library
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => window.location.reload()}>
              Reload this page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
