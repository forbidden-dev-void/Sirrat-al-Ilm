/**
 * StatTile — a single dashboard metric.
 *
 * Semantic markup: the number is a <strong>, the label a <p>, and the whole
 * tile can carry an optional hint for screen readers.
 */

import type { ReactNode } from 'react';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'chocolate' | 'latte' | 'walnut' | 'cream';
}

export function StatTile({ label, value, hint, icon, tone = 'cream' }: StatTileProps): JSX.Element {
  return (
    <div className={`stat-tile stat-tile--${tone}`}>
      {icon ? (
        <span className="stat-tile__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="stat-tile__label">{label}</p>
      <p className="stat-tile__value">
        <strong>{value}</strong>
      </p>
      {hint ? <p className="stat-tile__hint">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children, columns = 4 }: { children: ReactNode; columns?: 2 | 3 | 4 }): JSX.Element {
  return <div className={`stat-grid stat-grid--${columns}`}>{children}</div>;
}
