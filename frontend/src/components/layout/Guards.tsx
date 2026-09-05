/**
 * Route guards
 * ============
 *
 * The whole site sits behind sign-in (as requested): an anonymous visitor who
 * opens any URL is sent to /signin, and the original location is remembered so
 * they land back where they wanted after authenticating.
 *
 * `RequireAdmin` adds the owner-only layer for /admin — the user dashboard
 * never exposes admin features.
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../ui/States';

export interface GuardProps {
  children: ReactNode;
}

export function RequireAuth({ children }: GuardProps): JSX.Element {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <PageLoader label="Checking your session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: GuardProps): JSX.Element {
  const { status, isAdmin } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <PageLoader label="Checking your session…" />;
  }

  if (!isAdmin) {
    // Regular learners are sent to their own dashboard, never to /admin.
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/** Wraps a page that needs both guards (used for /admin routes). */
export function RequireOwner({ children }: GuardProps): JSX.Element {
  return (
    <RequireAuth>
      <RequireAdmin>{children}</RequireAdmin>
    </RequireAuth>
  );
}
