/**
 * SegmentedControl — a group of filter buttons.
 *
 * Used where a Tabs component would be wrong (there is no panel to show): the
 * category filter on the blog, the "all / in progress / completed" filters on
 * the dashboard, etc. Implemented as a radiogroup so keyboard users get the
 * expected arrow-key behaviour and screen readers announce the selection.
 */

import { useRef, type KeyboardEvent } from 'react';

export interface SegmentOption {
  id: string;
  label: string;
  count?: number;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: SegmentedControlProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, options.findIndex((option) => option.id === value));

  function focusIndex(index: number): void {
    const node = containerRef.current?.querySelectorAll<HTMLButtonElement>('button')[index];
    node?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const last = options.length - 1;
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = activeIndex === last ? 0 : activeIndex + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = activeIndex === 0 ? last : activeIndex - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(options[next].id);
    focusIndex(next);
  }

  return (
    <div
      className={`segmented segmented--${size}`}
      role="radiogroup"
      aria-label={ariaLabel}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => {
        const selected = index === activeIndex;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={`segmented__item${selected ? ' segmented__item--active' : ''}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
            {option.count !== undefined ? <span className="segmented__count">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
