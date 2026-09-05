/**
 * Badge — small status/category pill.
 * Tones are derived from the palette (chocolate, latte, walnut, cream, success).
 */

import type { ReactNode } from 'react';

export type BadgeTone = 'chocolate' | 'latte' | 'walnut' | 'cream' | 'success' | 'warning' | 'muted';

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  title?: string;
}

export function Badge({ tone = 'cream', children, icon, title }: BadgeProps): JSX.Element {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {icon ? <span className="badge__icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

/** Maps a backend status string onto a badge tone. */
export function toneForStatus(status: string): BadgeTone {
  switch (status) {
    case 'completed':
    case 'available':
      return 'success';
    case 'in_progress':
      return 'warning';
    case 'archived':
    case 'not_started':
      return 'muted';
    case 'draft':
      return 'latte';
    default:
      return 'cream';
  }
}
