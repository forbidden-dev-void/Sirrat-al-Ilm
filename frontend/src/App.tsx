/**
 * Route table
 * ===========
 *
 *   /signin, /signup   -> public (the gate every visitor meets first)
 *   everything else    -> <RequireAuth> (the brief asks for a signed-in site)
 *   /admin             -> additionally <RequireAdmin> (owner e-mail only)
 *
 * Lazy loading keeps the first paint small: the landing page ships immediately
 * while the dashboard/admin bundles load on demand.
 */

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RequireAdmin, RequireAuth } from './components/layout/Guards';
import { PageLoader } from './components/ui/States';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';

const ShelfIndexPage = lazy(() =>
  import('./pages/ShelvesPage').then((module) => ({ default: module.ShelvesPage })),
);
const ShelfPage = lazy(() => import('./pages/ShelfPage').then((m) => ({ default: m.ShelfPage })));
const BooksPage = lazy(() => import('./pages/BooksPage').then((m) => ({ default: m.BooksPage })));
const BookDetailPage = lazy(() =>
  import('./pages/BookDetailPage').then((m) => ({ default: m.BookDetailPage })),
);
const LabsPage = lazy(() => import('./pages/LabsPage').then((m) => ({ default: m.LabsPage })));
const LabDetailPage = lazy(() =>
  import('./pages/LabDetailPage').then((m) => ({ default: m.LabDetailPage })),
);
const BlogPage = lazy(() => import('./pages/BlogPage').then((m) => ({ default: m.BlogPage })));
const PostPage = lazy(() => import('./pages/PostPage').then((m) => ({ default: m.PostPage })));
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function LazyFallback(): JSX.Element {
  return <PageLoader label="Preparing this page…" />;
}

export function App(): JSX.Element {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        {/* --- Public: the sign-in gate ---------------------------------- */}
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* --- Authenticated area ---------------------------------------- */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />

          <Route path="/shelves" element={<ShelfIndexPage />} />
          <Route path="/shelf/:slug" element={<ShelfPage />} />
          {/* Convenience alias used by footer links */}
          <Route path="/shelf" element={<Navigate to="/shelves" replace />} />

          <Route path="/books" element={<BooksPage />} />
          <Route path="/books/:slug" element={<BookDetailPage />} />

          <Route path="/labs" element={<LabsPage />} />
          <Route path="/labs/:slug" element={<LabDetailPage />} />

          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<PostPage />} />

          <Route path="/dashboard" element={<DashboardPage />} />

          {/* --- Owner only --------------------------------------------- */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
