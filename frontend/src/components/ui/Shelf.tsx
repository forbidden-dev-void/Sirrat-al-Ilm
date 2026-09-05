/**
 * Shelf — the horizontal, scrollable content row from the brief
 * =============================================================
 *
 * "YouTube video references in the form of a shelf so that everyone can click
 * and get redirected to the YouTube page."
 *
 * Features:
 *  - native horizontal scroll with snap points (touch + trackpad friendly)
 *  - arrow buttons that are disabled at the ends (the muted-border colour from
 *    the palette is used for the inactive state)
 *  - keyboard support: the strip is a scrollable region with tabIndex=0
 *  - a live "showing X of Y" label for screen readers
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ShelfProps {
  title: string;
  subtitle?: string | null;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  itemCount: number;
  id: string;
}

export function Shelf({
  title,
  subtitle,
  eyebrow,
  description,
  action,
  children,
  itemCount,
  id,
}: ShelfProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateArrows = useCallback((): void => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setAtStart(track.scrollLeft <= 4);
    setAtEnd(maxScroll <= 4 || track.scrollLeft >= maxScroll - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      track.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, itemCount]);

  const scrollBy = (direction: 1 | -1): void => {
    const track = trackRef.current;
    if (!track) return;
    const amount = Math.max(280, track.clientWidth * 0.8);
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  return (
    <section className="shelf" aria-labelledby={`${id}-title`}>
      <header className="shelf__header">
        <div className="shelf__heading">
          {eyebrow ? <p className="shelf__eyebrow">{eyebrow}</p> : null}
          <h2 className="shelf__title" id={`${id}-title`}>
            {title}
          </h2>
          {subtitle ? <p className="shelf__subtitle">{subtitle}</p> : null}
          {description ? <p className="shelf__description">{description}</p> : null}
        </div>
        <div className="shelf__controls">
          {action}
          <div className="shelf__arrows" role="group" aria-label={`Scroll ${title}`}>
            <button
              type="button"
              className="shelf-arrow"
              onClick={() => scrollBy(-1)}
              disabled={atStart}
              aria-label={`Scroll ${title} left`}
            >
              ‹
            </button>
            <button
              type="button"
              className="shelf-arrow"
              onClick={() => scrollBy(1)}
              disabled={atEnd}
              aria-label={`Scroll ${title} right`}
            >
              ›
            </button>
          </div>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {`${itemCount} item${itemCount === 1 ? '' : 's'} in this shelf. Use the arrow keys or the scroll buttons to browse.`}
      </p>

      <div
        className="shelf__track"
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-label={`${title} items`}
      >
        {children}
      </div>
    </section>
  );
}
