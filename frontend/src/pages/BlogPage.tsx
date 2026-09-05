/**
 * BlogPage — religion, tech, life updates, programming and book notes.
 */

import { useMemo, useState } from 'react';
import { contentApi } from '../api/endpoints';
import { PostCard } from '../components/content/PostCard';
import { TextField } from '../components/ui/Field';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useApi } from '../hooks/useApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { pluralise, titleCase } from '../lib/format';
import type { BlogCategory, PostSummary } from '../types';

const CATEGORIES: (BlogCategory | '')[] = ['', 'religion', 'tech', 'life', 'programming', 'books'];

export function BlogPage(): JSX.Element {
  useDocumentTitle('Blog');
  const [category, setCategory] = useState<BlogCategory | ''>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data, loading, error, reload } = useApi<PostSummary[]>(
    () => contentApi.posts({ category, search: debouncedSearch || undefined, limit: 60 }),
    [category, debouncedSearch],
  );

  const posts = data ?? [];
  const featured = useMemo(() => posts.find((post) => post.is_featured) ?? posts[0], [posts]);
  const rest = useMemo(() => posts.filter((post) => post !== featured), [posts, featured]);

  if (loading) return <PageLoader label="Loading articles…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="page">
      <header className="page-header">
        <p className="section-eyebrow">Writing</p>
        <h1 className="page-title">The blog</h1>
        <p className="page-subtitle">
          Long-form notes on deen, technology, life and learning to code — the same things the
          shelves cover, in words you can keep.
        </p>
      </header>

      <SegmentedControl
        ariaLabel="Filter articles by category"
        value={category || 'all'}
        onChange={(id) => setCategory(id === 'all' ? '' : (id as BlogCategory))}
        options={CATEGORIES.map((value) => ({
          id: value || 'all',
          label: value ? titleCase(value) : 'Everything',
        }))}
      />

      <div className="filter-bar filter-bar--single">
        <TextField
          label="Search articles"
          id="post-search"
          type="search"
          placeholder="Title or keyword…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <p className="filter-bar__count" aria-live="polite">
          {pluralise(posts.length, 'article')}
        </p>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="Nothing published here yet"
          message="Try another category, or clear the search box."
          action={
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setSearch('');
                setCategory('');
              }}
            >
              Reset
            </button>
          }
        />
      ) : (
        <>
          {featured && !debouncedSearch ? (
            <section className="featured-post" aria-labelledby="featured-title">
              <h2 className="sr-only" id="featured-title">
                Featured article
              </h2>
              <PostCard post={featured} layout="list" />
            </section>
          ) : null}

          <div className="grid grid--3">
            {(debouncedSearch ? posts : rest).map((post) => (
              <PostCard key={post.id} post={post} layout="grid" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
