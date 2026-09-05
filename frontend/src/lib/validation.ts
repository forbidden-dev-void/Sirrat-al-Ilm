/**
 * Client-side validation
 * ======================
 *
 * Mirrors the server rules (Pydantic + password policy) so users get instant
 * feedback; the API still validates everything a second time.
 *
 * Every validator returns ``null`` when the value is acceptable, or a readable
 * message. That makes them composable in form state.
 */

export type Validator = (value: string) => string | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_PATTERN = /^(https?:\/\/|mailto:|\/)[^\s]+$/i;

export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'E-mail is required';
  if (trimmed.length > 254) return 'E-mail is too long';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid e-mail address';
  return null;
}

export function validateFullName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Full name is required';
  if (trimmed.length < 2) return 'Please enter at least 2 characters';
  if (trimmed.length > 120) return 'Please keep it under 120 characters';
  if (!/^[\p{L}\p{M}'\-. ]+$/u.test(trimmed)) return 'Letters, spaces, hyphens and apostrophes only';
  return null;
}

/** Same policy as `app.core.security.password_policy_violation`. */
export function validatePassword(value: string): string | null {
  if (!value) return 'Password is required';
  if (value.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!/[A-Za-z]/.test(value)) return 'Include at least one letter';
  if (!/\d/.test(value)) return 'Include at least one number';
  if (value.length > 128) return 'Passwords are limited to 128 characters';
  return null;
}

export function validateConfirmPassword(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Please confirm your password';
  if (password !== confirmation) return 'Passwords do not match';
  return null;
}

export function validateRequired(label: string): Validator {
  return (value: string) => (value.trim() ? null : `${label} is required`);
}

export function validateMaxLength(max: number): Validator {
  return (value: string) => (value.length <= max ? null : `Keep this under ${max} characters`);
}

export function validateSlug(value: string): string | null {
  if (!value.trim()) return null; // the server generates one when omitted
  if (!SLUG_PATTERN.test(value.trim())) return 'Lowercase letters, numbers and single dashes only';
  return null;
}

export function validateUrl(value: string): string | null {
  if (!value.trim()) return null;
  if (!URL_PATTERN.test(value.trim())) return 'Enter a full URL (https://…) or a /relative path';
  return null;
}

export function validatePositiveInt(value: string): string | null {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim())) return 'Whole numbers only';
  return null;
}

/** Password strength 0–4 for the meter on the sign-up form. */
export function passwordStrength(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (value.length >= 14) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(4, score);
}

export const strengthLabels = ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent'] as const;

/** Validate a whole record of values and return the first error per field. */
export function validateAll<T extends Record<string, string>>(
  values: T,
  rules: { [K in keyof T]?: Validator[] },
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  (Object.keys(rules) as (keyof T)[]).forEach((field) => {
    const validators = rules[field] ?? [];
    for (const validate of validators) {
      const message = validate(values[field] ?? '');
      if (message) {
        errors[field] = message;
        break;
      }
    }
  });
  return errors;
}
