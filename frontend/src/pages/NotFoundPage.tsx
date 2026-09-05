/**
 * NotFoundPage — friendly 404 inside the authenticated shell.
 */

import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage(): JSX.Element {
  useDocumentTitle('Page not found');

  return (
    <div className="page page--narrow notfound">
      <p className="notfound__code" aria-hidden="true">
        404
      </p>
      <h1 className="page-title">This page is not on the shelf</h1>
      <p className="page-subtitle">
        The link may be old, or the page may have been renamed. Everything else in the library is
        still where you left it.
      </p>
      <div className="page-actions">
        <Link className="btn btn--primary" to="/">
          Back to the home page
        </Link>
        <Link className="btn btn--secondary" to="/dashboard">
          My dashboard
        </Link>
        <Link className="btn btn--quiet" to="/shelves">
          Browse shelves
        </Link>
      </div>
    </div>
  );
}
