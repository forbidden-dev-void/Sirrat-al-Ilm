/**
 * ShelvesPage — index of every YouTube shelf.
 */

import { Link } from 'react-router-dom';
import { contentApi } from '../api/endpoints';
import { CoverArt } from '../components/ui/CoverArt';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { pluralise } from '../lib/format';
import type { Shelf } from '../types';

const KIND_LABEL: Record<string, string> = {
  wisdom: 'Religion & self-improvement',
  programming: 'Programming courses',
  tech: 'Tools & deep work',
  life: 'Life updates',
  books: 'Books',
};

export function ShelvesPage(): JSX.Element {
  useDocumentTitle('Shelves');
  const { data, loading, error, reload } = useApi<Shelf[]>(() => contentApi.shelves(), []);

  if (loading) return <PageLoader label="Loading shelves…" />;
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />;

  return (
    <div className="page">
      <header className="page-header">
        <p className="section-eyebrow">Curated paths</p>
        <h1 className="page-title">Every shelf, in one place</h1>
        <p className="page-subtitle">
          {pluralise(data.reduce((total, shelf) => total + shelf.resources.length, 0), 'video', 'videos')}{' '}
          across {pluralise(data.length, 'shelf', 'shelves')}. Open a card to watch it on YouTube,
          then mark it complete so your dashboard keeps track.
        </p>
      </header>

      <div className="grid grid--2">
        {data.map((shelf) => (
          <article key={shelf.id} className="panel shelf-panel">
            <div className="shelf-panel__media">
              <CoverArt
                src={shelf.cover_image}
                alt=""
                fallbackLabel={shelf.title}
                tone={shelf.accent === 'latte' ? 'latte' : shelf.accent === 'cream' ? 'cream' : 'chocolate'}
              />
            </div>
            <div className="shelf-panel__body">
              <p className="section-eyebrow">{KIND_LABEL[shelf.kind] ?? shelf.kind}</p>
              <h2 className="shelf-panel__title">
                <Link to={`/shelf/${shelf.slug}`}>{shelf.title}</Link>
              </h2>
              {shelf.subtitle ? <p className="shelf-panel__subtitle">{shelf.subtitle}</p> : null}
              <p className="shelf-panel__description">{shelf.description}</p>
              <p className="shelf-panel__meta">
                {pluralise(shelf.resources.length, 'resource', 'resources')}
              </p>
              <Link className="btn btn--primary btn--sm" to={`/shelf/${shelf.slug}`}>
                Open shelf →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
