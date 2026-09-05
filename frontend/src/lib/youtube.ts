/**
 * YouTube helpers (pure functions — unit tested in lib/youtube.test.ts)
 * =====================================================================
 *
 * Shelf cards link out to YouTube. Storing the *video id* rather than only the
 * URL lets the backend build a thumbnail (`youTubeThumbnailUrl`) and lets the
 * admin form accept any of the URL shapes people actually paste: watch links,
 * youtu.be short links, playlist links, embeds, Shorts and live URLs.
 */

const ID_PATTERNS: RegExp[] = [
  /(?:youtube\.com\/watch\?[^#]*v=)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
  /(?:youtube\.com\/embed\/)([\w-]{11})/,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  /(?:youtube\.com\/live\/)([\w-]{11})/,
];

/**
 * Extract the 11-character video id from any common YouTube URL shape.
 * Returns null when the string is empty or is not a recognisable YouTube link
 * (the caller then keeps whatever the admin typed instead of guessing).
 */
export function parseYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  for (const pattern of ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  // A bare 11-character id is accepted too — admins paste those as often as URLs.
  return /^[\w-]{11}$/.test(trimmed) ? trimmed : null;
}

/** Canonical watch URL for a video id (used when a card has no explicit URL). */
export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * High-quality thumbnail URL served by YouTube's image CDN.
 * `hqdefault` always exists for a published video, unlike `maxresdefault`.
 */
export function youTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
