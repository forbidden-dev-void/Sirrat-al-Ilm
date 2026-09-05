/**
 * ShelfPage — one shelf in full (e.g. /shelf/programming)
 * =======================================================
 *
 * Adds the things a long shelf needs: search, level filter, "hide completed",
 * and a progress summary so the learner can see how far through the path they
 * are. Cards open YouTube in a new tab and record progress.
 */

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi } from '../api/endpoints';
import { VideoCard } from '../components/content/VideoCard';
import { CheckboxField, SelectField, TextField } from '../components/ui/Field';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useProgressLibrary } from '../hooks/useProgress';
import { pluralise } from '../lib/format';
import type { Shelf, ShelfResource } from '../types';

const LEVEL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advanced', label: 'Advanced' },
  { value: 'All levels', label: 'Any level (mixed)' },
];

export function ShelfPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data, loading, error, reload } = useApi<Shelf>(() => contentApi.shelf(slug), [slug]);
  const progress = useProgressLibrary();

  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);

  const filtered = useMemo<ShelfResource[]>(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.resources.filter((resource) => {
      const entry = progress.forVideo(resource);
      if (hideCompleted && entry?.status === 'completed') return false;
      if (level && (resource.level ?? '') !== level) return false;
      if (!needle) return true;
      return [resource.title, resource.description, resource.channel ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [data, search, level, hideCompleted, progress]);

  useDocumentTitle(data?.title ?? 'Shelf');

  if (loading) return <PageLoader label="Loading the shelf…" />;
  if (error || !data) {
    return (
      <ErrorState
        title="Shelf unavailable"
        message={error ?? 'This shelf could not be loaded.'}
        onRetry={reload}
        action={
          <Link className="btn btn--secondary btn--sm" to="/shelves">
            All shelves
          </Link>
        }
      />
    );
  }

  const completedCount = data.resources.filter(
    (resource) => progress.forVideo(resource)?.status === 'completed',
  ).length;
  const percent = data.resources.length
    ? Math.round((completedCount / data.resources.length) * 100)
    : 0;

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/shelves">Shelves</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{data.title}</span>
      </nav>

      <header className="page-header">
        <p className="section-eyebrow">{data.kind === 'programming' ? 'Programming course' : 'Reference shelf'}</p>
        <h1 className="page-title">{data.title}</h1>
        {data.subtitle ? <p className="page-subtitle">{data.subtitle}</p> : null}
        <p className="page-description">{data.description}</p>
      </header>

      <section className="panel progress-panel" aria-label="Your progress on this shelf">
        <div className="progress-panel__text">
          <p className="progress-panel__headline">
            {completedCount} of {data.resources.length} completed
          </p>
          <p className="progress-panel__hint">
            {percent === 100
              ? 'Masha’Allah — you finished this shelf. Time to teach it to someone.'
              : 'Mark a card complete and it will show on your dashboard.'}
          </p>
        </div>
        <ProgressBar value={percent} showValue label="Shelf completion" id="shelf-progress" />
      </section>

      <div className="filter-bar" role="search">
        <TextField
          label="Search this shelf"
          id="shelf-search"
          type="search"
          placeholder="Title, topic or channel…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Level"
          id="shelf-level"
          options={LEVEL_OPTIONS}
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        />
        <CheckboxField
          label="Hide completed"
          description="Only show what is left to watch"
          checked={hideCompleted}
          onChange={(event) => setHideCompleted(event.target.checked)}
        />
        <p className="filter-bar__count" aria-live="polite">
          {pluralise(filtered.length, 'result')}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing matches those filters"
          message="Try clearing the search box or showing completed items again."
          action={
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setSearch('');
                setLevel('');
                setHideCompleted(false);
              }}
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="grid grid--3">
          {filtered.map((resource) => (
            <VideoCard
              key={resource.id}
              resource={resource}
              progress={progress.forVideo(resource)}
              onOpen={(target) => void progress.markVideoOpened(target)}
              onComplete={(target) => void progress.markComplete('video', target.id)}
              onUndo={(entry) => void progress.undo(entry)}
            />
          ))}
        </div>
      )}

      <div className="page-actions">
        <Link className="btn btn--secondary" to="/dashboard">
          View my dashboard
        </Link>
        <Link className="btn btn--quiet" to="/shelves">
          Other shelves
        </Link>
      </div>
    </div>
  );
}
