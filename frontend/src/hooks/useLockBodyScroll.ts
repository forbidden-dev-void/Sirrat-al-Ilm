/**
 * useLockBodyScroll — freezes background scrolling while a modal/lightbox is
 * open and restores the previous value on unmount.
 */

import { useEffect } from 'react';

export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}
