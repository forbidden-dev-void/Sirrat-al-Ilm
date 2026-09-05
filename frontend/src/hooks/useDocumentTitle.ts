/**
 * useDocumentTitle — keeps <title> in sync with the current page.
 * The app name is appended so every tab reads "Page · Sirrat al-Ilm".
 */

import { useEffect } from 'react';

const APP_NAME = 'Sirrat al-Ilm';

export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
