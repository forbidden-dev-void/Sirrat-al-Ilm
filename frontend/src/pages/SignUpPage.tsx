/**
 * SignUpPage — create a free account
 * ==================================
 *
 * Fields: full name, e-mail, password (+ confirmation) with live validation,
 * a strength meter and inline server error mapping (duplicate e-mail -> the
 * email field, weak password -> the password field).
 */

import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { CheckboxField, TextField } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  passwordStrength,
  strengthLabels,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validatePassword,
} from '../lib/validation';

interface FormState {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  agreed: boolean;
}

type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'confirm' | 'agreed', string | null>>;

const EMPTY: FormState = { fullName: '', email: '', password: '', confirm: '', agreed: false };

export function SignUpPage(): JSX.Element {
  useDocumentTitle('Create account');
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => passwordStrength(values.password), [values.password]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validate(): boolean {
    const nextErrors: FieldErrors = {
      fullName: validateFullName(values.fullName),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
      confirm: validateConfirmPassword(values.password, values.confirm),
      agreed: values.agreed ? null : 'Please accept to continue',
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
      const user = await signUp({
        full_name: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        // Map known server complaints onto the right field.
        if (caught.status === 409) setErrors({ email: caught.message });
        else if (caught.fieldErrors.password) setErrors({ password: caught.fieldErrors.password });
        else if (caught.fieldErrors.email) setErrors({ email: caught.fieldErrors.email });
        else setFormError(caught.message);
      } else {
        setFormError('Unexpected error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free, no card, no ads. Your progress on videos and books is saved as you go."
      footer={
        <p>
          Already have an account? <Link to="/signin">Sign in instead</Link>.
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className="alert alert--error" role="alert">
            <span className="alert__icon" aria-hidden="true">!</span>
            <div>
              <p className="alert__title">Could not create the account</p>
              <p className="alert__message">{formError}</p>
            </div>
          </div>
        ) : null}

        <TextField
          label="Full name"
          id="signup-name"
          name="full_name"
          autoComplete="name"
          placeholder="e.g. Aisha Rahman"
          required
          value={values.fullName}
          error={errors.fullName}
          onChange={(event) => update('fullName', event.target.value)}
          onBlur={() =>
            setErrors((current) => ({ ...current, fullName: validateFullName(values.fullName) ?? undefined }))
          }
        />

        <TextField
          label="E-mail address"
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          value={values.email}
          error={errors.email}
          onChange={(event) => update('email', event.target.value)}
          onBlur={() =>
            setErrors((current) => ({ ...current, email: validateEmail(values.email) ?? undefined }))
          }
        />

        <TextField
          label="Password"
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters, with a number"
          required
          value={values.password}
          error={errors.password}
          onChange={(event) => update('password', event.target.value)}
          onBlur={() =>
            setErrors((current) => ({ ...current, password: validatePassword(values.password) ?? undefined }))
          }
        />

        <div className="strength" aria-hidden={values.password.length === 0}>
          <div className="strength__bars" role="presentation">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={`strength__bar${index < strength ? ` strength__bar--${strength}` : ''}`}
              />
            ))}
          </div>
          <p className="strength__label">
            {values.password ? `Password strength: ${strengthLabels[strength]}` : 'Choose a password'}
          </p>
        </div>

        <TextField
          label="Confirm password"
          id="signup-confirm"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          required
          value={values.confirm}
          error={errors.confirm}
          onChange={(event) => update('confirm', event.target.value)}
          onBlur={() =>
            setErrors((current) => ({
              ...current,
              confirm: validateConfirmPassword(values.password, values.confirm) ?? undefined,
            }))
          }
        />

        <div className="auth-form__consent">
          <CheckboxField
            label="I understand this library is free and my progress is stored against my account."
            checked={values.agreed}
            onChange={(event) => update('agreed', event.target.checked)}
          />
          {errors.agreed ? (
            <p className="field__error" role="alert">
              {errors.agreed}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting} disabled={submitting}>
          {submitting ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
