/**
 * Unit tests for the pure formatting helpers.
 *
 * These are the functions every page leans on for dates, labels and progress
 * numbers, so a regression here shows up everywhere. Run with `npm run test`.
 */

import { describe, expect, it } from 'vitest';
import {
  clampPercent,
  compactNumber,
  estimateReadingMinutes,
  formatDate,
  formatDateTime,
  formatRelative,
  initials,
  parseDate,
  pluralise,
  resourceLabel,
  statusLabel,
  titleCase,
  truncate,
} from './format';

/* ------------------------------------------------------------------ dates */
describe('parseDate', () => {
  it('parses a full ISO timestamp', () => {
    expect(parseDate('2026-09-05T14:32:00Z')?.toISOString()).toBe('2026-09-05T14:32:00.000Z');
  });

  it('treats a naive SQLite timestamp as UTC', () => {
    expect(parseDate('2026-09-05T14:32:00')?.toISOString()).toBe('2026-09-05T14:32:00.000Z');
  });

  it('returns null for empty or nonsense input', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
  });
});

describe('formatDate / formatDateTime', () => {
  it('formats a readable day-month-year', () => {
    expect(formatDate('2026-09-05T14:32:00Z')).toBe('5 Sep 2026');
    expect(formatDate('2026-01-09T00:00:00Z')).toBe('9 Jan 2026');
  });

  it('appends a zero-padded 24h time', () => {
    expect(formatDateTime('2026-09-05T09:04:00Z')).toBe('5 Sep 2026, 09:04');
  });

  it('falls back to an em dash', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime('garbage')).toBe('—');
  });
});

describe('formatRelative', () => {
  const iso = (msAgo: number): string => new Date(Date.now() - msAgo).toISOString();
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('covers the whole ladder from seconds to weeks', () => {
    expect(formatRelative(iso(5_000))).toBe('just now');
    expect(formatRelative(iso(8 * MINUTE))).toBe('8 minutes ago');
    expect(formatRelative(iso(MINUTE))).toBe('1 minute ago');
    expect(formatRelative(iso(3 * HOUR))).toBe('3 hours ago');
    expect(formatRelative(iso(2 * DAY))).toBe('2 days ago');
    expect(formatRelative(iso(14 * DAY))).toBe('2 weeks ago');
  });

  it('falls back to an absolute date after a month', () => {
    expect(formatRelative(iso(90 * DAY))).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
  });
});

/* ----------------------------------------------------------------- labels */
describe('labels', () => {
  it('turns initials into a two-letter monogram', () => {
    expect(initials('Rehan Rae Essayyed')).toBe('RE');
    expect(initials('Aisha')).toBe('AI');
    expect(initials('  ')).toBe('?');
    expect(initials(null)).toBe('?');
  });

  it('renders progress statuses in sentence case', () => {
    expect(statusLabel('completed')).toBe('Completed');
    expect(statusLabel('in_progress')).toBe('In progress');
    expect(statusLabel('not_started')).toBe('Saved');
    expect(statusLabel('something_else')).toBe('something else');
  });

  it('renders resource types with the site vocabulary', () => {
    expect(resourceLabel('blog')).toBe('Article');
    expect(resourceLabel('video')).toBe('Video');
    expect(resourceLabel('playlist')).toBe('Playlist');
    expect(resourceLabel('podcast')).toBe('podcast');
  });

  it('title-cases snake and kebab values', () => {
    expect(titleCase('in_progress')).toBe('In progress');
    expect(titleCase('self-improvement')).toBe('Self improvement');
  });

  it('pluralises with an explicit or default plural', () => {
    expect(pluralise(1, 'book')).toBe('1 book');
    expect(pluralise(3, 'book')).toBe('3 books');
    expect(pluralise(2, 'entry', 'entries')).toBe('2 entries');
  });
});

/* ---------------------------------------------------------------- numbers */
describe('numbers', () => {
  it('compacts big counts', () => {
    expect(compactNumber(940)).toBe('940');
    expect(compactNumber(1000)).toBe('1k');
    expect(compactNumber(1250)).toBe('1.3k');
    expect(compactNumber(2_400_000)).toBe('2.4M');
  });

  it('clamps percentages into the 0–100 range', () => {
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(-20)).toBe(0);
    expect(clampPercent(42.6)).toBe(43);
    expect(clampPercent(null)).toBe(0);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it('estimates reading time at ~200 words per minute, minimum 1', () => {
    expect(estimateReadingMinutes('')).toBe(1);
    expect(estimateReadingMinutes(Array(400).fill('word').join(' '))).toBe(2);
  });
});

/* ------------------------------------------------------------ truncation */
describe('truncate', () => {
  it('leaves short strings alone', () => {
    expect(truncate('Short description', 90)).toBe('Short description');
  });

  it('cuts at a word boundary and adds an ellipsis', () => {
    const long = Array(40).fill('extraordinary').join(' ');
    const result = truncate(long, 60);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(61);
  });
});
