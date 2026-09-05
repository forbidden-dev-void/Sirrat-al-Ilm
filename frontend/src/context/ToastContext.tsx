/**
 * Toast notifications
 * ===================
 *
 * A tiny, dependency-free notification system with an ARIA live region so
 * screen readers announce successes and errors.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ToastStack } from '../components/ui/Toast';
import type { ToastKind, ToastMessage } from '../components/ui/Toast';

interface ToastContextValue {
  toasts: ToastMessage[];
  notify: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string): void => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, title: string, description?: string): void => {
      counter += 1;
      const toast: ToastMessage = {
        id: `toast-${counter}`,
        kind,
        title,
        description,
      };
      setToasts((current) => [...current.slice(-3), toast]);
      // Auto-dismiss; errors linger a little longer so they can be read.
      window.setTimeout(() => dismiss(toast.id), kind === 'error' ? 7000 : 4200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      notify,
      dismiss,
      success: (title, description) => notify('success', title, description),
      error: (title, description) => notify('error', title, description),
      info: (title, description) => notify('info', title, description),
    }),
    [toasts, notify, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
