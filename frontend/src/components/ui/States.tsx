/**
 * Loading / error / empty states
 * ==============================
 *
 * Consistent, accessible placeholders so no page ever renders blank or shows a
 * raw stack trace. Error states always offer a retry action.
 */

import type { ReactNode } from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';

export function PageLoader({ label = 'Loading…' }: { label?: string }): JSX.Element {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <Spinner size={28} />
      <p>{label}</p>
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  action,
}: ErrorStateProps): JSX.Element {
  return (
    <div className="state-card state-card--error" role="alert">
      <span className="state-card__icon" aria-hidden="true">!</span>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="state-card__actions">
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="state-card">
      {icon ? <span className="state-card__icon" aria-hidden="true">{icon}</span> : null}
      <h2>{title}</h2>
      <p>{message}</p>
      {action ? <div className="state-card__actions">{action}</div> : null}
    </div>
  );
}

/** Content-shaped skeleton used while shelves/cards load. */
export function SkeletonCard({ lines = 3 }: { lines?: number }): JSX.Element {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton--cover" />
      <div className="skeleton skeleton--title" />
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="skeleton skeleton--line" style={{ width: `${92 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function SkeletonShelf({ count = 4 }: { count?: number }): JSX.Element {
  return (
    <div className="skeleton-shelf" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
