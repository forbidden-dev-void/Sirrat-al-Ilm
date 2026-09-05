/**
 * CoverArt — image with a designed fallback
 * =========================================
 *
 * Covers/thumbnails come either from the backend's generated SVG artwork or
 * from img.youtube.com. If a thumbnail fails to load (offline, removed video),
 * we fall back to a palette gradient with the item's initials instead of
 * showing a broken-image icon.
 */

import { useEffect, useState } from 'react';
import { initials } from '../../lib/format';

export interface CoverArtProps {
  src: string | null | undefined;
  alt: string;
  fallbackLabel?: string;
  tone?: 'chocolate' | 'walnut' | 'latte' | 'cream';
  className?: string;
  eager?: boolean;
}

export function CoverArt({
  src,
  alt,
  fallbackLabel,
  tone = 'walnut',
  className,
  eager = false,
}: CoverArtProps): JSX.Element {
  const [failed, setFailed] = useState(false);

  // Reset the error state whenever a new source is supplied.
  useEffect(() => setFailed(false), [src]);

  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div
        className={`cover cover--fallback cover--${tone} ${className ?? ''}`.trim()}
        role="img"
        aria-label={alt}
      >
        <span className="cover__initials" aria-hidden="true">
          {initials(fallbackLabel ?? alt)}
        </span>
      </div>
    );
  }

  return (
    <img
      className={`cover ${className ?? ''}`.trim()}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
