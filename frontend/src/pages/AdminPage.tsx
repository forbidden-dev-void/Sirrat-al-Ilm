/**
 * AdminPage — the owner-only console
 * ==================================
 *
 * Reachable ONLY by the administrator account (the e-mail configured in
 * ADMIN_EMAIL, or any account holding the admin role). The route is wrapped in
 * <RequireAdmin>, and every request is re-checked by the API, so a learner who
 * types /admin is redirected to their own dashboard and receives 403 from the
 * backend if they call an admin endpoint directly.
 *
 * Tabs: Overview · Shelves · Books · Labs · Writing · People · Site content
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { adminApi } from '../api/endpoints';
import { BookManager } from '../components/admin/BookManager';
import { DataTable, type Column } from '../components/admin/DataTable';
import { LabManager } from '../components/admin/LabManager';
import { PeopleManager } from '../components/admin/PeopleManager';
import { PostManager } from '../components/admin/PostManager';
import { ShelfManager } from '../components/admin/ShelfManager';
import { SiteContentManager } from '../components/admin/SiteContentManager';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { StatGrid, StatTile } from '../components/ui/StatTile';
import { Tabs } from '../components/ui/Tabs';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatRelative, pluralise, titleCase } from '../lib/format';
import type { AdminActivityRow, AdminStats, TopResource } from '../types';

export function AdminPage(): JSX.Element {
  useDocumentTitle('Admin console');
  const { user } = useAuth();
  const { success, error: notifyError } = useToast();
  const [tab, setTab] = useState('overview');
  const [reseeding, setReseeding] = useState(false);

  const { data: stats, loading, error, reload } = useApi<AdminStats>(() => adminApi.stats(), []);

  async function reseed(): Promise<void> {
    setReseeding(true);
    try {
      const result = await adminApi.reseed();
      const summary = result.reseeded as Record<string, unknown>;
      success('Library checked', `Books: ${String(summary.books ?? 0)} added · Posts: ${String(summary.posts ?? 0)} added`);
      reload();
    } catch (caught) {
      notifyError('Reseed failed', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setReseeding(false);
    }
  }

  if (loading && !stats) return <PageLoader label="Loading the console…" />;
  if (error && !stats) return <ErrorState message={error} onRetry={reload} />;

  const counters = stats?.counters;

  const topColumns: Column<TopResource>[] = [
    { key: 'title', header: 'Resource', render: (row) => <strong>{row.title}</strong> },
    { key: 'type', header: 'Type', render: (row) => titleCase(row.resource_type) },
    { key: 'engaged', header: 'Learners', align: 'right', render: (row) => row.engaged },
    { key: 'completed', header: 'Completed', align: 'right', render: (row) => row.completed },
  ];

  const activityColumns: Column<AdminActivityRow>[] = [
    { key: 'who', header: 'Who', render: (row) => row.user_name },
    {
      key: 'what',
      header: 'What',
      render: (row) => (
        <div className="cell-person">
          <strong>{row.title}</strong>
          <span>
            {titleCase(row.resource_type)} · {row.status === 'completed' ? 'completed' : `${row.progress_percent}%`}
          </span>
        </div>
      ),
    },
    { key: 'when', header: 'When', render: (row) => <span className="cell-muted">{formatRelative(row.at)}</span> },
  ];

  const overviewPanel = (
    <div className="admin-overview">
      <StatGrid columns={4}>
        <StatTile tone="chocolate" label="Learners" value={counters?.users ?? 0} hint={`${counters?.new_users_last_7_days ?? 0} joined this week`} />
        <StatTile tone="latte" label="Completions" value={counters?.completions ?? 0} hint={`${counters?.progress_entries ?? 0} tracked rows`} />
        <StatTile label="Book downloads" value={counters?.book_downloads ?? 0} hint={`${counters?.books ?? 0} books in the library`} />
        <StatTile label="Article views" value={counters?.post_views ?? 0} hint={`${counters?.posts ?? 0} posts, ${counters?.drafts ?? 0} drafts`} />
      </StatGrid>

      <StatGrid columns={4}>
        <StatTile label="Shelves" value={counters?.shelves ?? 0} hint={`${counters?.resources ?? 0} cards`} />
        <StatTile label="Labs" value={counters?.labs ?? 0} hint="Project listings" />
        <StatTile label="Administrators" value={counters?.admins ?? 0} hint="Accounts with the admin role" />
        <StatTile
          tone="walnut"
          label="Signed in as"
          value={<Avatar name={user?.full_name ?? ''} src={user?.avatar_url} size={28} />}
          hint={user?.email}
        />
      </StatGrid>

      <div className="admin-overview__grid">
        <section className="panel" aria-labelledby="admin-top">
          <div className="panel__head">
            <h2 className="panel__title" id="admin-top">
              Most engaged resources
            </h2>
            <Button size="sm" variant="ghost" onClick={reload}>
              Refresh
            </Button>
          </div>
          <DataTable
            rows={stats?.top_resources ?? []}
            columns={topColumns}
            rowKey={(row) => `${row.resource_type}-${row.resource_id}`}
            caption="Most engaged resources"
            emptyMessage="No progress recorded yet."
          />
        </section>

        <section className="panel" aria-labelledby="admin-activity">
          <h2 className="panel__title" id="admin-activity">
            Live activity
          </h2>
          <DataTable
            rows={stats?.recent_activity ?? []}
            columns={activityColumns}
            rowKey={(row) => row.id}
            caption="Recent learner activity"
            emptyMessage="Nothing has happened yet."
          />
        </section>
      </div>

      <section className="panel" aria-labelledby="admin-maintenance">
        <h2 className="panel__title" id="admin-maintenance">
          Maintenance
        </h2>
        <p className="panel__muted">
          Re-running the seeder only fills collections that are empty — it never overwrites or
          duplicates content you have edited.
        </p>
        <div className="panel__actions">
          <Button variant="secondary" size="sm" loading={reseeding} onClick={() => void reseed()}>
            Re-seed empty collections
          </Button>
          <a className="btn btn--ghost btn--sm" href="/api/docs" target="_blank" rel="noopener noreferrer">
            API documentation ↗
          </a>
          <Link className="btn btn--ghost btn--sm" to="/">
            View the public site
          </Link>
          <Link className="btn btn--ghost btn--sm" to="/dashboard">
            My learner dashboard
          </Link>
        </div>
        <p className="panel__muted panel__muted--small">
          {pluralise(counters?.resources ?? 0, 'shelf card')} · {pluralise(counters?.books ?? 0, 'book')} ·{' '}
          {pluralise(counters?.labs ?? 0, 'lab')} · {pluralise(counters?.posts ?? 0, 'post')} ·{' '}
          {pluralise(counters?.users ?? 0, 'account')}
        </p>
      </section>
    </div>
  );

  return (
    <div className="page admin">
      <header className="page-header admin__header">
        <div>
          <p className="section-eyebrow">Owner console</p>
          <h1 className="page-title">Administrator</h1>
          <p className="page-subtitle">
            Signed in as {user?.email}. Everything here is yours: add content, remove it, promote
            helpers, and rewrite the landing page.
          </p>
        </div>
        <div className="admin__quick">
          <Button size="sm" variant="secondary" onClick={() => setTab('shelves')}>
            + Add shelf card
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setTab('posts')}>
            + Write a post
          </Button>
          <Button size="sm" onClick={() => setTab('books')}>
            + Publish a book
          </Button>
        </div>
      </header>

      <Tabs
        ariaLabel="Admin sections"
        activeId={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Overview', panel: overviewPanel },
          {
            id: 'shelves',
            label: 'Shelves',
            badge: counters?.shelves,
            panel: <ShelfManager />,
          },
          { id: 'books', label: 'Books', badge: counters?.books, panel: <BookManager /> },
          { id: 'labs', label: 'Labs', badge: counters?.labs, panel: <LabManager /> },
          { id: 'posts', label: 'Writing', badge: counters?.posts, panel: <PostManager /> },
          { id: 'people', label: 'People', badge: counters?.users, panel: <PeopleManager /> },
          { id: 'site', label: 'Site content', panel: <SiteContentManager /> },
        ]}
      />
    </div>
  );
}
