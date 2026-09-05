/**
 * LabsPage — every lab (Item) in the workshop.
 */

import { useMemo, useState } from 'react';
import { contentApi } from '../api/endpoints';
import { LabCard } from '../components/content/LabCard';
import { SelectField, TextField } from '../components/ui/Field';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { pluralise } from '../lib/format';
import type { Lab } from '../types';

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'available', label: 'Available' },
  { value: 'in_progress', label: 'In progress' },
];

export function LabsPage(): JSX.Element {
  useDocumentTitle('Labs');
  const { data, loading, error, reload } = useApi<Lab[]>(() => contentApi.labs(), []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const categories = useMemo(() => {
    const found = new Set<string>();
    (data ?? []).forEach((lab) => lab.category && found.add(lab.category));
    return [
      { value: '', label: 'All categories' },
      ...Array.from(found)
        .sort()
        .map((value) => ({ value, label: value })),
    ];
  }, [data]);

  const [category, setCategory] = useState('');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data ?? []).filter((lab) => {
      if (status && lab.availability_status !== status) return false;
      if (category && lab.category !== category) return false;
      if (!needle) return true;
      return [lab.title, lab.summary ?? '', lab.description, lab.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [data, search, status, category]);

  if (loading) return <PageLoader label="Opening the workshop…" />;
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />;

  return (
    <div className="page">
      <header className="page-header">
        <p className="section-eyebrow">Labs</p>
        <h1 className="page-title">Things I build while learning</h1>
        <p className="page-subtitle">
          {pluralise(data.length, 'lab')}. Each one has a gallery, the reasoning behind it, and what
          is still unfinished — including the parts that did not work.
        </p>
      </header>

      <div className="filter-bar" role="search">
        <TextField
          label="Search labs"
          id="lab-search"
          type="search"
          placeholder="Title, tag or stack…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Category"
          id="lab-category"
          options={categories}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <SelectField
          label="Status"
          id="lab-status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        />
        <p className="filter-bar__count" aria-live="polite">
          {pluralise(visible.length, 'lab')}
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No labs match"
          message="Try clearing the filters to see the whole workshop."
          action={
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setSearch('');
                setStatus('');
                setCategory('');
              }}
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="grid grid--3">
          {visible.map((lab) => (
            <LabCard key={lab.id} lab={lab} layout="grid" />
          ))}
        </div>
      )}
    </div>
  );
}
