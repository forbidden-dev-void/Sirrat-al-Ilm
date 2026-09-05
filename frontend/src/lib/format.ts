/**
 * Formatting helpers (pure functions — unit tested in lib/format.test.ts)
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Parse an ISO string; returns null for anything unparseable. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // SQLite-backed APIs may return naive timestamps: treat them as UTC.
  const normalised = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? `${value}Z` : value;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "5 Sep 2026" */
export function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "5 Sep 2026, 14:32" */
export function formatDateTime(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  const time = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  return `${formatDate(value)}, ${time}`;
}

/** "just now", "8 minutes ago", "3 days ago", then falls back to a date. */
export function formatRelative(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  return formatDate(value);
}

/** "Rehan Rae Essayyed" -> "RE" */
export function initials(fullName: string | null | undefined): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** 1200 -> "1.2k" */
export function compactNumber(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/** Clamp a percentage for progress bars. */
export function clampPercent(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Human label for a progress status. */
export function statusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In progress';
    case 'not_started':
      return 'Saved';
    default:
      return status.replace(/_/g, ' ');
  }
}

/** Human label for a resource type. */
export function resourceLabel(type: string): string {
  switch (type) {
    case 'video':
      return 'Video';
    case 'book':
      return 'Book';
    case 'blog':
      return 'Article';
    case 'lab':
      return 'Lab';
    case 'playlist':
      return 'Playlist';
    default:
      return type;
  }
}

/** Turn "in_progress" into "In progress" for table cells. */
export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

/** Truncate long strings for table cells (keeps words intact). */
export function truncate(value: string, max = 90): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 40 ? lastSpace : max - 1).trimEnd()}…`;
}

/** Estimate reading time from a body of text (~200 wpm). */
export function estimateReadingMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
