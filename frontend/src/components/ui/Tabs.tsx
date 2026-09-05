/**
 * Tabs — accessible tablist used by the dashboard and the admin console.
 *
 * Implements the WAI-ARIA tabs pattern: roving tabindex, Arrow/Home/End keys,
 * aria-selected and aria-controls wiring.
 */

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
  panel: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

export function Tabs({ items, activeId, onChange, ariaLabel, className }: TabsProps): JSX.Element {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));

  function focusTab(index: number): void {
    const node = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab-index="${index}"]`,
    );
    node?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const lastIndex = items.length - 1;
    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = activeIndex === lastIndex ? 0 : activeIndex + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = activeIndex === 0 ? lastIndex : activeIndex - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(items[nextIndex].id);
    focusTab(nextIndex);
  }

  return (
    <div className={className}>
      <div
        className="tabs"
        role="tablist"
        aria-label={ariaLabel}
        ref={listRef}
        onKeyDown={handleKeyDown}
      >
        {items.map((item, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              data-tab-index={index}
              className={`tab${selected ? ' tab--active' : ''}`}
              onClick={() => {
                onChange(item.id);
                focusTab(index);
              }}
            >
              {item.icon ? <span className="tab__icon" aria-hidden="true">{item.icon}</span> : null}
              <span>{item.label}</span>
              {item.badge !== undefined ? <span className="tab__badge">{item.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {items.map((item, index) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={index !== activeIndex}
          tabIndex={0}
          className="tab-panel"
        >
          {index === activeIndex ? item.panel : null}
        </div>
      ))}
    </div>
  );
}
