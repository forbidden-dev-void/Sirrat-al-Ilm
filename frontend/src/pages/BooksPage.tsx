/**
 * BooksPage — the free library shelf.
 */

import { useMemo, useState } from 'react';
import { contentApi } from '../api/endpoints';
import { BookCard } from '../components/content/BookCard';
import { SelectField, TextField } from '../components/ui/Field';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useProgressLibrary } from '../hooks/useProgress';
import { pluralise } from '../lib/format';
import type { Book } from '../types';

const SORT_OPTIONS = [
  { value: 'curated', label: 'Curated order' },
  { value: 'title', label: 'Title (A—Z)' },
  { value: 'newest', label: 'Newest first' },
  { value: 'progress', label: 'My progress' },
];

export function BooksPage(): JSX.Element {
  useDocumentTitle('Books');
  const { success, error: notifyError } = useToast();
  const { data, loading, error, reload } = useApi<Book[]>(() => contentApi.books(), []);
  const progress = useProgressLibrary();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('curated');

  const categories = useMemo(() => {
    const found = new Set<string>();
    (data ?? []).forEach((book) => book.category && found.add(book.category));
    return [
      { value: '', label: 'All categories' },
      ...Array.from(found)
        .sort()
        .map((value) => ({ value, label: value })),
    ];
  }, [data]);

  const visible = useMemo(() => {
    const list = [...(data ?? [])];
    const needle = search.trim().toLowerCase();

    if (category) {
      const filtered = list.filter((book) => book.category === category);
      list.length = 0;
      list.push(...filtered);
    }
    if (needle) {
      const filtered = list.filter((book) =>
        [book.title, book.subtitle ?? '', book.description, book.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
      list.length = 0;
      list.push(...filtered);
    }

    switch (sort) {
      case 'title':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'newest':
        list.sort((a, b) => (b.published_on ?? '').localeCompare(a.published_on ?? ''));
        break;
      case 'progress':
        list.sort(
          (a, b) =>
            (progress.forBook(b)?.progress_percent ?? 0) - (progress.forBook(a)?.progress_percent ?? 0),
        );
        break;
      default:
        list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return list;
  }, [data, search, category, sort, progress]);

  async function handleDownload(book: Book): Promise<void> {
    try {
      await contentApi.downloadBook(book.slug);
      success('Download started', `${book.title}.pdf is on its way.`);
      void progress.setPercent('book', book.id, Math.max(progress.forBook(book)?.progress_percent ?? 0, 25));
    } catch (caught) {
      notifyError('Download failed', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  if (loading) return <PageLoader label="Opening the library…" />;
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />;

  return (
    <div className="page">
      <header className="page-header">
        <p className="section-eyebrow">The library</p>
        <h1 className="page-title">Books written by me — free for everyone</h1>
        <p className="page-subtitle">
          {pluralise(data.length, 'book')}, no paywall and no e-mail funnel. Download the PDF, read
          it on your phone, or print it and give it away.
        </p>
      </header>

      <div className="filter-bar" role="search">
        <TextField
          label="Search books"
          id="book-search"
          type="search"
          placeholder="Title, topic or tag…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Category"
          id="book-category"
          options={categories}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <SelectField
          label="Sort by"
          id="book-sort"
          options={SORT_OPTIONS}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        />
        <p className="filter-bar__count" aria-live="polite">
          {pluralise(visible.length, 'book')}
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No books match"
          message="Try a different search term or clear the category filter."
          action={
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setSearch('');
                setCategory('');
              }}
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="grid grid--3">
          {visible.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              layout="grid"
              progress={progress.forBook(book)}
              onDownload={(target) => void handleDownload(target)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
