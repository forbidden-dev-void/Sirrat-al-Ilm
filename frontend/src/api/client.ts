/**
 * API client
 * ==========
 *
 * A small, fully typed wrapper around `fetch` that owns:
 *
 *  - the bearer token (memory + localStorage so a refresh keeps you signed in)
 *  - automatic token refresh on 401 (single-flight, one retry per request)
 *  - error normalisation into `ApiError` with per-field messages for forms
 *  - authenticated binary downloads (the book PDFs)
 *
 * Every request goes to a *relative* URL (`/api/...`): Vite proxies it in
 * development and FastAPI serves it in production, so the browser only ever
 * talks to one origin.
 */

import type { ApiErrorBody } from '../types';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

const STORAGE_KEY = 'sirrat-al-ilm.session.v1';

/* --------------------------------------------------------------- token store */
interface StoredSession {
  access: string;
  refresh: string;
}

let session: StoredSession | null = readStoredSession();

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.access === 'string' && typeof parsed.refresh === 'string') {
      return { access: parsed.access, refresh: parsed.refresh };
    }
    return null;
  } catch {
    // Corrupted storage (private mode, quota) -> behave as signed out.
    return null;
  }
}

export function getAccessToken(): string | null {
  return session?.access ?? null;
}

export function setSession(tokens: StoredSession): void {
  session = tokens;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    /* ignore write failures — the session still works in memory */
  }
}

export function clearSession(): void {
  session = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------- session expiry */
type ExpiredListener = () => void;
let expiredListener: ExpiredListener | null = null;

/** Registered by AuthProvider so a dead refresh token signs the user out. */
export function onSessionExpired(listener: ExpiredListener): void {
  expiredListener = listener;
}

/* --------------------------------------------------------------------- errors */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;
  /** field name -> first validation message (used by the sign-in forms). */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.fieldErrors = {};
    for (const error of body.errors ?? []) {
      if (!(error.field in this.fieldErrors)) this.fieldErrors[error.field] = error.message;
    }
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = { detail: `${response.status} ${response.statusText}` };
  try {
    const text = await response.text();
    if (text) {
      const parsed = JSON.parse(text) as ApiErrorBody | { detail?: unknown };
      if (typeof parsed.detail === 'string') {
        body = parsed as ApiErrorBody;
      } else if (typeof (parsed as { detail?: unknown }).detail === 'object') {
        // FastAPI's default 422 shape (used if our handler is ever bypassed).
        const details = (parsed as { detail: { loc?: (string | number)[]; msg?: string }[] }).detail;
        body = {
          detail: 'Validation failed',
          errors: details.map((entry) => ({
            field: (entry.loc ?? []).filter((part) => part !== 'body').join('.'),
            message: entry.msg ?? 'Invalid value',
            type: 'value_error',
          })),
        };
      }
    }
  } catch {
    /* non-JSON body: keep the generated message */
  }
  return new ApiError(response.status, body);
}

/* ------------------------------------------------------------------ transport */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header (public endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

let refreshPromise: Promise<boolean> | null = null;

/** Exchange the stored refresh token for a new token pair. */
async function refreshTokens(): Promise<boolean> {
  if (!session?.refresh) return false;
  // De-duplicate concurrent refreshes so we never burn the token twice.
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session?.refresh ?? '' }),
      });
      if (!response.ok) return false;
      // The wire shape differs from the stored shape, so name both explicitly.
      const data = (await response.json()) as {
        tokens: { access_token: string; refresh_token: string };
      };
      setSession({
        access: data.tokens.access_token,
        refresh: data.tokens.refresh_token,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function performRequest<T>(path: string, options: RequestOptions, allowRetry: boolean): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (!options.anonymous && session?.access) {
    headers.Authorization = `Bearer ${session.access}`;
    // Some reverse proxies (the hosted preview tunnel, for instance) strip the
    // Authorization header before it reaches the API. The backend accepts the
    // same token in X-Access-Token, so the session survives either way.
    headers['X-Access-Token'] = session.access;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, { detail: 'Network error — is the API server running?' });
  }

  // One transparent refresh + retry when the access token has expired.
  if (response.status === 401 && allowRetry && !options.anonymous && session?.refresh) {
    const refreshed = await refreshTokens();
    if (refreshed) return performRequest<T>(path, options, false);
    clearSession();
    expiredListener?.();
  }

  // A 401 on the *retry* means a freshly minted token was also rejected, so
  // the session is genuinely dead. Sign out instead of letting every mounted
  // component queue up its own refresh (that loop looks like a hung page).
  if (response.status === 401 && !allowRetry && !options.anonymous) {
    clearSession();
    expiredListener?.();
  }

  if (response.status === 204) return undefined as T;

  if (!response.ok) throw await parseError(response);

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return performRequest<T>(path, options, true);
}

/* ------------------------------------------------------------- file download */
/**
 * Download a protected binary (the free book PDFs) and hand it to the browser.
 * A plain <a href> cannot be used because the endpoint needs the bearer token.
 */
export async function downloadFile(path: string, suggestedName: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: session?.access
      ? {
          Authorization: `Bearer ${session.access}`,
          'X-Access-Token': session.access,
        }
      : {},
  });
  if (!response.ok) throw await parseError(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so Safari has time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Build a query string, dropping empty values. */
export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}
