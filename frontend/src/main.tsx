/**
 * Application entry point
 * =======================
 *
 * Provider order matters:
 *   BrowserRouter  -> routing context for every page
 *   ToastProvider  -> notifications (used by AuthProvider and pages)
 *   AuthProvider   -> session state; nothing inside renders without it
 *
 * Error boundaries wrap the router so a rendering bug shows a friendly screen
 * instead of a blank page.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppErrorBoundary } from './components/layout/AppErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Design system: tokens first, then base, components and page layouts.
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
