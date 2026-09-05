/**
 * Authentication context
 * ======================
 *
 * Single source of truth for "who is signed in". React Context is enough here
 * (the brief allows Context or Zustand) and avoids an extra dependency.
 *
 * Behaviour
 * ---------
 *  - On mount, an existing localStorage session is validated against
 *    `GET /api/auth/me`; an expired access token is refreshed transparently by
 *    the API client.
 *  - `signIn` returns the user so the router can decide where to send them
 *    (admin -> /admin, learner -> /).
 *  - `signOut` clears tokens *and* the cached user.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, clearSession, getAccessToken, onSessionExpired, setSession } from '../api/client';
import { authApi } from '../api/endpoints';
import type { LoginPayload, SignupPayload, User } from '../types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signIn: (payload: LoginPayload) => Promise<User>;
  signUp: (payload: SignupPayload) => Promise<User>;
  signOut: () => void;
  /** Re-read the profile from the API (used after profile updates). */
  reloadUser: () => Promise<void>;
  /** Push a locally-updated profile into state without a round trip. */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function storeSession(user: User, accessToken: string, refreshToken: string): void {
  setSession({ access: accessToken, refresh: refreshToken });
  void user; // kept for symmetry/readability at call sites
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (getAccessToken() ? 'loading' : 'anonymous'));

  /** Validate a persisted token on first paint. */
  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      if (!getAccessToken()) {
        setStatus('anonymous');
        return;
      }
      try {
        const profile = await authApi.me();
        if (cancelled) return;
        setUserState(profile);
        setStatus('authenticated');
      } catch (error) {
        if (cancelled) return;
        // The client already cleared the session if the refresh token died.
        if (error instanceof ApiError && error.status === 403) {
          // Deactivated account: keep them signed out with a reason.
          clearSession();
        }
        setUserState(null);
        setStatus('anonymous');
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // A failed refresh anywhere in the app signs the user out globally.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUserState(null);
        setStatus('anonymous');
      }),
    [],
  );

  const signIn = useCallback(async (payload: LoginPayload): Promise<User> => {
    const response = await authApi.login(payload);
    storeSession(response.user, response.tokens.access_token, response.tokens.refresh_token);
    setUserState(response.user);
    setStatus('authenticated');
    return response.user;
  }, []);

  const signUp = useCallback(async (payload: SignupPayload): Promise<User> => {
    const response = await authApi.signup(payload);
    storeSession(response.user, response.tokens.access_token, response.tokens.refresh_token);
    setUserState(response.user);
    setStatus('authenticated');
    return response.user;
  }, []);

  const signOut = useCallback((): void => {
    clearSession();
    setUserState(null);
    setStatus('anonymous');
  }, []);

  const reloadUser = useCallback(async (): Promise<void> => {
    try {
      const profile = await authApi.me();
      setUserState(profile);
      setStatus('authenticated');
    } catch {
      clearSession();
      setUserState(null);
      setStatus('anonymous');
    }
  }, []);

  const setUser = useCallback((next: User): void => {
    setUserState(next);
    setStatus('authenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAdmin: user?.role === 'admin',
      isAuthenticated: status === 'authenticated' && user !== null,
      signIn,
      signUp,
      signOut,
      reloadUser,
      setUser,
    }),
    [user, status, signIn, signUp, signOut, reloadUser, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth state. Throws when used outside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
