/**
 * Unit tests for client-side validation.
 *
 * These rules mirror the API (Pydantic models + the password policy in
 * `app/core/security.py`). If the two drift apart, users get a green form and
 * a 422 from the server, so the tests pin the exact behaviour.
 */

import { describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  passwordStrength,
  strengthLabels,
  validateAll,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateMaxLength,
  validatePassword,
  validatePositiveInt,
  validateRequired,
  validateSlug,
  validateUrl,
} from './validation';

describe('validateEmail', () => {
  it('accepts ordinary addresses and trims whitespace', () => {
    expect(validateEmail('learner@example.com')).toBeNull();
    expect(validateEmail('  rehan.rae+library@example.co.uk  ')).toBeNull();
  });

  it('rejects the shapes users actually mistype', () => {
    expect(validateEmail('')).toBe('E-mail is required');
    expect(validateEmail('plainaddress')).toMatch(/valid e-mail/i);
    expect(validateEmail('a@b')).toMatch(/valid e-mail/i);
    expect(validateEmail('two words@example.com')).toMatch(/valid e-mail/i);
  });
});

describe('validateFullName', () => {
  it('accepts letters, spaces, hyphens and apostrophes in any script', () => {
    expect(validateFullName('Rehan Rae Essayyed')).toBeNull();
    expect(validateFullName("Nour al-Din")).toBeNull();
    expect(validateFullName('عائشة أحمد')).toBeNull();
  });

  it('rejects empty, tiny and symbol-laden values', () => {
    expect(validateFullName('   ')).toBe('Full name is required');
    expect(validateFullName('A')).toMatch(/at least 2 characters/);
    expect(validateFullName('h4cker!!')).toMatch(/Letters, spaces/);
    expect(validateFullName('x'.repeat(121))).toMatch(/under 120/);
  });
});

describe('validatePassword', () => {
  it(`enforces the ${MIN_PASSWORD_LENGTH}-character, letter + number policy`, () => {
    expect(validatePassword('Lantern42')).toBeNull();
    expect(validatePassword('')).toBe('Password is required');
    expect(validatePassword('short1')).toMatch(/at least/);
    expect(validatePassword('alllettersonly')).toBe('Include at least one number');
    expect(validatePassword('12345678')).toBe('Include at least one letter');
    expect(validatePassword(`Aa1${'x'.repeat(130)}`)).toMatch(/128 characters/);
  });

  it('checks the confirmation matches', () => {
    expect(validateConfirmPassword('Lantern42', 'Lantern42')).toBeNull();
    expect(validateConfirmPassword('Lantern42', '')).toMatch(/confirm/i);
    expect(validateConfirmPassword('Lantern42', 'lantern42')).toBe('Passwords do not match');
  });
});

describe('passwordStrength', () => {
  it('scores 0–4 and always has a matching label', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBeLessThanOrEqual(1);
    expect(passwordStrength('Lantern42')).toBeGreaterThanOrEqual(3);
    expect(passwordStrength('Lantern!42-Long')).toBe(4);

    for (let score = 0; score <= 4; score += 1) {
      expect(typeof strengthLabels[score]).toBe('string');
    }
  });
});

describe('composable validators', () => {
  it('validateRequired reports the field label', () => {
    expect(validateRequired('Title')('Seerah')).toBeNull();
    expect(validateRequired('Title')('   ')).toBe('Title is required');
  });

  it('validateMaxLength reports the limit', () => {
    expect(validateMaxLength(10)('ten chars!')).toBeNull();
    expect(validateMaxLength(10)('eleven char')).toBe('Keep this under 10 characters');
  });

  it('validateSlug allows an empty value (the server generates one)', () => {
    expect(validateSlug('')).toBeNull();
    expect(validateSlug('seerah-2026')).toBeNull();
    expect(validateSlug('Seerah Series')).toMatch(/Lowercase/);
  });

  it('validateUrl accepts absolute, relative and mailto links', () => {
    expect(validateUrl('https://youtube.com/watch?v=abc12345678')).toBeNull();
    expect(validateUrl('/books/seerah')).toBeNull();
    expect(validateUrl('mailto:hello@example.com')).toBeNull();
    expect(validateUrl('')).toBeNull();
    expect(validateUrl('youtube dot com')).toMatch(/full URL/);
  });

  it('validatePositiveInt accepts whole numbers only', () => {
    expect(validatePositiveInt('12')).toBeNull();
    expect(validatePositiveInt('')).toBeNull();
    expect(validatePositiveInt('-3')).toBe('Whole numbers only');
    expect(validatePositiveInt('1.5')).toBe('Whole numbers only');
  });
});

describe('validateAll', () => {
  it('returns the first failing message per field and nothing else', () => {
    const errors = validateAll(
      { title: '', slug: 'Bad Slug' },
      { title: [validateRequired('Title')], slug: [validateSlug] },
    );

    expect(errors).toEqual({ title: 'Title is required', slug: 'Lowercase letters, numbers and single dashes only' });
    expect(validateAll({ title: 'Seerah' }, { title: [validateRequired('Title')] })).toEqual({});
  });
});
