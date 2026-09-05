/**
 * BookCard — a free book from the library shelf.
 */

import { Link } from 'react-router-dom';
import type { Book, ProgressEntry } from '../../types';
import { formatDate } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { CoverArt } from '../ui/CoverArt';
import { ProgressBar } from '../ui/ProgressBar';

export interface BookCardProps {
  book: Book;
  progress?: ProgressEntry | null;
  onDownload?: (book: Book) => void;
  downloading?: boolean;
  layout?: 'shelf' | 'grid';
}

export function BookCard({
  book,
  progress,
  onDownload,
  downloading = false,
  layout = 'shelf',
}: BookCardProps): JSX.Element {
  const percent = progress?.progress_percent ?? 0;
  const completed = progress?.status === 'completed';

  return (
    <article className={`card book-card book-card--${layout}${completed ? ' book-card--done' : ''}`}>
      <Link className="book-card__cover" to={`/books/${book.slug}`} aria-label={`Open ${book.title}`}>
        <CoverArt
          src={book.cover_url}
          alt={`Cover of ${book.title}`}
          fallbackLabel={book.title}
          tone="chocolate"
        />
        <span className="book-card__free">Free</span>
      </Link>

      <div className="book-card__body">
        <div className="book-card__meta">
          {book.category ? <Badge tone="latte">{book.category}</Badge> : null}
          {book.pages ? <Badge tone="cream">{book.pages} pages</Badge> : null}
          {book.published_on ? <Badge tone="cream">{formatDate(book.published_on)}</Badge> : null}
        </div>

        <h3 className="book-card__title">
          <Link to={`/books/${book.slug}`}>{book.title}</Link>
        </h3>
        {book.subtitle ? <p className="book-card__subtitle">{book.subtitle}</p> : null}
        <p className="book-card__description">{book.description}</p>
        <p className="book-card__author">by {book.author}</p>

        {progress ? (
          <ProgressBar
            value={percent}
            size="sm"
            showValue
            label={`Reading progress for ${book.title}`}
          />
        ) : null}

        <div className="book-card__actions">
          <Link className="btn btn--primary btn--sm" to={`/books/${book.slug}`}>
            {completed ? 'Read again' : 'Read'}
          </Link>
          {onDownload ? (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => onDownload(book)}
              disabled={downloading}
            >
              {downloading ? 'Preparing…' : 'Download PDF'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
