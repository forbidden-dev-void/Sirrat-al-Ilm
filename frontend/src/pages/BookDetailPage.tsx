/**
 * BookDetailPage — one book: cover, contents, reading progress, download
 * ======================================================================
 *
 * The learner can:
 *   - download the generated PDF (counts towards the admin analytics)
 *   - drag a slider to record how far they got (saved as progress)
 *   - mark the book as read
 *   - keep private notes attached to the book
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi } from '../api/endpoints';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CoverArt } from '../components/ui/CoverArt';
import { TextAreaField } from '../components/ui/Field';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useProgressLibrary } from '../hooks/useProgress';
import { formatDate, pluralise } from '../lib/format';
import { renderMarkdown } from '../lib/markdown';
import type { Book } from '../types';

export function BookDetailPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data, loading, error, reload } = useApi<Book>(() => contentApi.book(slug), [slug]);
  const progress = useProgressLibrary();
  const { success, error: notifyError } = useToast();

  const [percent, setPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [downloading, setDownloading] = useState(false);

  const entry = data ? progress.forBook(data) : null;

  // Sync local slider/notes with the stored entry once it loads.
  useEffect(() => {
    setPercent(entry?.progress_percent ?? 0);
    setNotes(entry?.notes ?? '');
  }, [entry?.id, entry?.progress_percent, entry?.notes]);

  useDocumentTitle(data?.title ?? 'Book');

  async function handleDownload(book: Book): Promise<void> {
    setDownloading(true);
    try {
      await contentApi.downloadBook(book.slug);
      success('Download started', `${book.title}.pdf saved to your device.`);
      void progress.setPercent('book', book.id, Math.max(percent, 25));
    } catch (caught) {
      notifyError('Download failed', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <PageLoader label="Opening the book…" />;
  if (error || !data) {
    return (
      <ErrorState
        title="Book unavailable"
        message={error ?? 'This book could not be loaded.'}
        onRetry={reload}
        action={
          <Link className="btn btn--secondary btn--sm" to="/books">
            Back to the library
          </Link>
        }
      />
    );
  }

  const book = data;

  return (
    <div className="page book-detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/books">Books</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{book.title}</span>
      </nav>

      <header className="book-detail__header">
        <div className="book-detail__cover">
          <CoverArt
            src={book.cover_url}
            alt={`Cover of ${book.title}`}
            fallbackLabel={book.title}
            tone="chocolate"
          />
        </div>

        <div className="book-detail__intro">
          <div className="book-detail__badges">
            {book.category ? <Badge tone="latte">{book.category}</Badge> : null}
            <Badge tone={book.is_free ? 'success' : 'cream'}>{book.is_free ? 'Free' : 'Paid'}</Badge>
            {book.language ? <Badge tone="cream">{book.language}</Badge> : null}
            {book.pages ? <Badge tone="cream">{book.pages} pages</Badge> : null}
            {book.edition ? <Badge tone="cream">{book.edition}</Badge> : null}
            {book.published_on ? <Badge tone="cream">{formatDate(book.published_on)}</Badge> : null}
          </div>

          <h1 className="page-title">{book.title}</h1>
          {book.subtitle ? <p className="book-detail__subtitle">{book.subtitle}</p> : null}
          <p className="book-detail__author">
            by {book.author} · {pluralise(book.download_count, 'download')}
          </p>

          {book.tags.length ? (
            <ul className="chip-row chip-row--wrap">
              {book.tags.map((tag) => (
                <li key={tag} className="chip">
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="book-detail__actions">
            <Button size="lg" loading={downloading} onClick={() => void handleDownload(book)}>
              {downloading ? 'Preparing PDF…' : 'Download the PDF'}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setPercent(100);
                void progress.markComplete('book', book.id);
              }}
            >
              {entry?.status === 'completed' ? 'Read again ✓' : 'Mark as read'}
            </Button>
          </div>
        </div>
      </header>

      <div className="book-detail__body">
        <section className="panel" aria-labelledby="book-about-title">
          <h2 className="panel__title" id="book-about-title">
            About this book
          </h2>
          <div className="prose">{renderMarkdown(book.description)}</div>
        </section>

        <section className="panel" aria-labelledby="book-toc-title">
          <h2 className="panel__title" id="book-toc-title">
            Contents
          </h2>
          {book.table_of_contents.length ? (
            <ol className="toc">
              {book.table_of_contents.map((item) => (
                <li key={`${item.chapter}-${item.title}`}>
                  <span className="toc__chapter">{item.chapter}</span>
                  <span className="toc__title">{item.title}</span>
                  {item.pages ? <span className="toc__pages">{item.pages}</span> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="panel__muted">Contents will be published with the next edition.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="book-progress-title">
          <h2 className="panel__title" id="book-progress-title">
            Your reading progress
          </h2>
          <ProgressBar value={percent} showValue label="Reading progress" id="book-progress" />

          <label className="slider-field" htmlFor="book-slider">
            <span>How far have you got?</span>
            <input
              id="book-slider"
              className="slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              onChange={(event) => setPercent(Number(event.target.value))}
              onMouseUp={() => void progress.setPercent('book', book.id, percent)}
              onTouchEnd={() => void progress.setPercent('book', book.id, percent)}
              onKeyUp={() => void progress.setPercent('book', book.id, percent)}
            />
          </label>

          <TextAreaField
            label="My notes"
            id="book-notes"
            rows={4}
            placeholder="What stood out? What will you act on?"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            hint="Notes are private to your account."
          />
          <div className="panel__actions">
            <Button
              variant="secondary"
              size="sm"
              disabled={!entry}
              onClick={() => entry && void progress.saveNotes(entry, notes)}
            >
              Save notes
            </Button>
            {percent > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPercent(0);
                  void progress.setPercent('book', book.id, 0);
                }}
              >
                Reset progress
              </Button>
            ) : null}
          </div>
        </section>
      </div>

      <div className="page-actions">
        <Link className="btn btn--secondary" to="/books">
          ← Back to the library
        </Link>
        <Link className="btn btn--quiet" to="/dashboard?tab=books">
          My reading list
        </Link>
      </div>
    </div>
  );
}
