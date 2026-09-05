/**
 * Toast stack — transient feedback with an ARIA live region.
 */

import type { ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

export interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastKind, ReactNode> = {
  success: <span aria-hidden="true">✓</span>,
  error: <span aria-hidden="true">!</span>,
  info: <span aria-hidden="true">i</span>,
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps): JSX.Element {
  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {/* polite for success/info, assertive for errors */}
      <div aria-live="polite" aria-atomic="false" className="sr-only">
        {toasts.filter((toast) => toast.kind !== 'error').map((toast) => (
          <p key={toast.id}>{toast.title}</p>
        ))}
      </div>
      <div aria-live="assertive" aria-atomic="false" className="sr-only">
        {toasts.filter((toast) => toast.kind === 'error').map((toast) => (
          <p key={toast.id}>{toast.title}</p>
        ))}
      </div>

      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`} role="presentation">
          <span className={`toast__icon toast__icon--${toast.kind}`}>{ICONS[toast.kind]}</span>
          <div className="toast__content">
            <p className="toast__title">{toast.title}</p>
            {toast.description ? <p className="toast__description">{toast.description}</p> : null}
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => onDismiss(toast.id)}
            aria-label={`Dismiss notification: ${toast.title}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
