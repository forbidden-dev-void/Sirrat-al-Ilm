/**
 * SignInPage — the gate every visitor meets first
 * ===============================================
 *
 * Client-side validation runs before the request; server errors (wrong
 * password, deactivated account, unreachable API) are mapped onto an inline
 * alert plus per-field messages.
 *
 * After a successful sign-in the owner lands on /admin, everybody else is
 * returned to the page they originally asked for.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { systemApi } from '../api/endpoints';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { validateEmail, validateRequired } from '../lib/validation';
import type { ServiceInfo } from '../types';

interface FormState {
  email: string;
  password: string;
}

type FieldErrors = Partial<Record<keyof FormState, string | null>>;

export function SignInPage(): JSX.Element {
  useDocumentTitle('Sign in');
  const { signIn, isAuthenticated, isAdmin, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedPath = (location.state as { from?: string } | null)?.from ?? '/';

  const [values, setValues] = useState<FormState>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The server tells us whether a public demo learner exists (and what its
  // credentials are), so this hint can never drift from the seeded database.
  const { data: serviceInfo } = useApi<ServiceInfo>(() => systemApi.info(), []);
  const demoAccount = serviceInfo?.demo_account ?? null;

  // Already signed in? Skip the gate.
  useEffect(() => {
    if (status === 'authenticated' && isAuthenticated) {
      navigate(isAdmin ? '/admin' : requestedPath, { replace: true });
    }
  }, [status, isAuthenticated, isAdmin, navigate, requestedPath]);

  function update(field: keyof FormState, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validate(): boolean {
    const nextErrors: FieldErrors = {
      email: validateEmail(values.email),
      password: validateRequired('Password')(values.password),
    };
    setErrors(nextErrors);
    return Object.values(nextErrors).every((message) => !message);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const user = await signIn({ email: values.email.trim(), password: values.password });
      navigate(user.role === 'admin' ? '/admin' : requestedPath, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFormError(caught.message);
        if (caught.fieldErrors.email) setErrors({ email: caught.fieldErrors.email });
      } else {
        setFormError('Unexpected error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Your shelves, books and progress are where you left them."
      footer={
        <p>
          New here? <Link to="/signup">Create a free account</Link> — it takes ten seconds and keeps
          your reading history.
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className="alert alert--error" role="alert">
            <span className="alert__icon" aria-hidden="true">!</span>
            <div>
              <p className="alert__title">Could not sign you in</p>
              <p className="alert__message">{formError}</p>
            </div>
          </div>
        ) : null}

        <TextField
          label="E-mail address"
          type="email"
          name="email"
          id="signin-email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          value={values.email}
          error={errors.email}
          onChange={(event) => update('email', event.target.value)}
          onBlur={() => setErrors((current) => ({ ...current, email: validateEmail(values.email) ?? undefined }))}
        />

        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          id="signin-password"
          autoComplete="current-password"
          placeholder="Your password"
          required
          value={values.password}
          error={errors.password}
          hint="Passwords are stored as salted PBKDF2 hashes — never in plain text."
          onChange={(event) => update('password', event.target.value)}
        />

        <div className="auth-form__row">
          <button
            type="button"
            className="link-button"
            onClick={() => setShowPassword((value) => !value)}
            aria-pressed={showPassword}
          >
            {showPassword ? 'Hide password' : 'Show password'}
          </button>
          <Link className="link-button" to="/signup">
            Need an account?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting} disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="auth-note">
          <p className="auth-note__title">Just exploring?</p>
          {demoAccount ? (
            <>
              <p className="auth-note__body">
                A demo learner account is seeded with sample progress:
                <br />
                <code>{demoAccount.email}</code> · <code>{demoAccount.password}</code>
              </p>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setValues({ email: demoAccount.email, password: demoAccount.password });
                  setErrors({});
                  setFormError(null);
                }}
              >
                Fill in the demo credentials
              </button>
            </>
          ) : (
            <p className="auth-note__body">
              Create a free account and your watched courses, books and notes stay in one place.
            </p>
          )}
          <p className="auth-note__fine">
            The owner signs in with the administrator e-mail configured on the server; admin tools
            are hidden from every other account.
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
