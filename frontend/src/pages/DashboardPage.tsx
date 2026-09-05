/**
 * DashboardPage — the learner's private view
 * ==========================================
 *
 * What it does (and deliberately does NOT do):
 *   ✔  route the learner back into content ("continue watching/reading")
 *   ✔  track progress on watched courses, read books, articles and labs
 *   ✔  keep private notes per resource
 *   ✔  edit profile + password (Settings)
 *   ✘  no content management, no analytics, no user management — those live in
 *      /admin and are only reachable by the owner account.
 *
 * The active tab is stored in the URL (?tab=books) so links are shareable and
 * the browser back button behaves.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { progressApi } from '../api/endpoints';
import { ProgressRow } from '../components/dashboard/ProgressRow';
import { SettingsPanel } from '../components/dashboard/SettingsPanel';
import { Avatar } from '../components/ui/Avatar';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StatGrid, StatTile } from '../components/ui/StatTile';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useProgressLibrary } from '../hooks/useProgress';
import { formatRelative, pluralise } from '../lib/format';
import type { ProgressDashboard, ProgressEntry, TrackedResourceType } from '../types';

type TabId = 'overview' | 'courses' | 'books' | 'articles' | 'labs' | 'saved' | 'settings';

const TAB_FOR_TYPE: Record<string, TrackedResourceType> = {
  courses: 'video',
  books: 'book',
  articles: 'blog',
  labs: 'lab',
};

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'not_started', label: 'Saved' },
];

export function DashboardPage(): JSX.Element {
  useDocumentTitle('My dashboard');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabId | null) ?? 'overview';
  const [statusFilter, setStatusFilter] = useState('all');

  const library = useProgressLibrary();
  const { data: summary, loading: summaryLoading, error: summaryError, reload: reloadSummary } =
    useApi<ProgressDashboard>(() => progressApi.dashboard(), []);

  const allEntries = useMemo<ProgressEntry[]>(() => Object.values(library.entries), [library.entries]);

  const entriesForTab = useMemo<ProgressEntry[]>(() => {
    const type = TAB_FOR_TYPE[tab];
    if (!type) return [];
    return allEntries
      .filter((entry) => entry.resource_type === type)
      .filter((entry) => statusFilter === 'all' || entry.status === statusFilter)
      .sort((a, b) => b.last_accessed_at.localeCompare(a.last_accessed_at));
  }, [allEntries, tab, statusFilter]);

  const savedEntries = useMemo(
    () =>
      allEntries
        .filter((entry) => entry.status === 'not_started' || (entry.notes ?? '').trim().length > 0)
        .sort((a, b) => b.last_accessed_at.localeCompare(a.last_accessed_at)),
    [allEntries],
  );

  /** Every mutation refreshes both the row cache and the aggregate summary. */
  const reloadLibrary = library.reload;
  const afterMutation = useCallback(() => {
    reloadLibrary();
    reloadSummary();
  }, [reloadLibrary, reloadSummary]);

  function setTab(next: string): void {
    const search = new URLSearchParams(params);
    if (next === 'overview') search.delete('tab');
    else search.set('tab', next);
    setParams(search, { replace: true });
    setStatusFilter('all');
  }

  if (library.loading && summaryLoading) return <PageLoader label="Loading your dashboard…" />;
  if (library.error) return <ErrorState message={library.error} onRetry={library.reload} />;

  const firstName = user?.full_name.split(' ')[0] ?? 'there';
  const totals = summary?.totals;

  function renderEntryList(entries: ProgressEntry[], emptyTitle: string, emptyMessage: string): JSX.Element {
    if (entries.length === 0) {
      return <EmptyState title={emptyTitle} message={emptyMessage} />;
    }
    return (
      <ul className="progress-list">
        {entries.map((entry) => (
          <ProgressRow
            key={entry.id}
            entry={entry}
            busy={library.busyKey === `${entry.resource_type}:${entry.resource_id}`}
            onComplete={(target) => {
              void library.markComplete(target.resource_type as TrackedResourceType, target.resource_id);
              afterMutation();
            }}
            onRemove={(target) => {
              void library.remove(target);
              afterMutation();
            }}
            onSaveNotes={(target, notes) => {
              void library.saveNotes(target, notes);
              afterMutation();
            }}
            onSetPercent={(target, percent) => {
              void library.setPercent(target.resource_type as TrackedResourceType, target.resource_id, percent);
            }}
          />
        ))}
      </ul>
    );
  }

  const overviewPanel = (
    <div className="dashboard-overview">
      <StatGrid columns={4}>
        <StatTile
          tone="chocolate"
          label="Items tracked"
          value={totals?.tracked ?? allEntries.length}
          hint="Videos, books, articles and labs you opened"
        />
        <StatTile
          tone="latte"
          label="Completed"
          value={totals?.completed ?? 0}
          hint={`${totals?.completion_rate ?? 0}% of everything you started`}
        />
        <StatTile label="In progress" value={totals?.in_progress ?? 0} hint="Pick one up today" />
        <StatTile
          label="Last activity"
          value={
            summary?.recent_activity?.[0]
              ? formatRelative(summary.recent_activity[0].last_accessed_at)
              : '—'
          }
          hint={summary?.recent_activity?.[0]?.resource_title}
        />
      </StatGrid>

      {summaryError ? (
        <ErrorState title="Stats unavailable" message={summaryError} onRetry={reloadSummary} />
      ) : (
        <section className="panel" aria-labelledby="dash-paths">
          <h2 className="panel__title" id="dash-paths">
            Your learning paths
          </h2>
          <div className="path-grid">
            {(summary?.by_type ?? []).map((stat) => (
              <div key={stat.key} className="path-card">
                <div className="path-card__head">
                  <h3>{stat.label}</h3>
                  <span className="path-card__count">
                    {stat.completed}/{stat.available}
                  </span>
                </div>
                <ProgressBar value={stat.percent} size="sm" label={stat.label} id={`path-${stat.key}`} />
                <p className="path-card__hint">
                  {stat.started > stat.completed
                    ? `${stat.started - stat.completed} still in progress`
                    : stat.completed > 0
                      ? 'Everything you started is finished'
                      : 'Nothing started yet'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="dash-continue">
        <div className="panel__head">
          <h2 className="panel__title" id="dash-continue">
            Continue where you left off
          </h2>
          <Link className="btn btn--quiet btn--sm" to="/shelves">
            Browse shelves →
          </Link>
        </div>
        {summary && summary.continue_learning.length > 0
          ? renderEntryList(summary.continue_learning, '', '')
          : renderEntryList(
              [],
              'Nothing in progress',
              'Open a video from a shelf or start a book — it will appear here with your progress.',
            )}
      </section>

      <section className="panel" aria-labelledby="dash-activity">
        <h2 className="panel__title" id="dash-activity">
          Recent activity
        </h2>
        {summary && summary.recent_activity.length > 0 ? (
          <ul className="activity-list">
            {summary.recent_activity.map((entry) => (
              <li key={entry.id}>
                <span className="activity-list__dot" aria-hidden="true" />
                <span className="activity-list__title">{entry.resource_title}</span>
                <span className="activity-list__meta">
                  {entry.status === 'completed' ? 'completed' : `${entry.progress_percent}%`} ·{' '}
                  {formatRelative(entry.last_accessed_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel__muted">No activity yet.</p>
        )}
      </section>
    </div>
  );

  const typePanel = (title: string, emptyMessage: string): JSX.Element => (
    <div className="dashboard-type">
      <div className="filter-bar filter-bar--single">
        <SegmentedControl
          ariaLabel={`Filter ${title} by status`}
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS.map((option) => ({
            id: option.id,
            label: option.label,
            count:
              option.id === 'all'
                ? allEntries.filter((entry) => entry.resource_type === TAB_FOR_TYPE[tab]).length
                : allEntries.filter(
                    (entry) =>
                      entry.resource_type === TAB_FOR_TYPE[tab] && entry.status === option.id,
                  ).length,
          }))}
        />
        <p className="filter-bar__count" aria-live="polite">
          {pluralise(entriesForTab.length, 'item')}
        </p>
      </div>
      {renderEntryList(entriesForTab, `No ${title} yet`, emptyMessage)}
    </div>
  );

  return (
    <div className="page dashboard">
      <header className="page-header dashboard__header">
        <Avatar name={user?.full_name ?? 'Learner'} src={user?.avatar_url} size={56} />
        <div>
          <p className="section-eyebrow">Your library</p>
          <h1 className="page-title">Assalamu alaikum, {firstName}</h1>
          <p className="page-subtitle">
            {totals && totals.tracked > 0
              ? `${pluralise(totals.tracked, 'item')} tracked · ${pluralise(totals.completed, 'completion')} · ${totals.completion_rate}% finished`
              : 'Nothing tracked yet — open a shelf and start where you are.'}
          </p>
        </div>
      </header>

      <Tabs
        ariaLabel="Dashboard sections"
        activeId={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Overview', panel: overviewPanel },
          {
            id: 'courses',
            label: 'Courses',
            badge: allEntries.filter((entry) => entry.resource_type === 'video').length,
            panel: typePanel(
              'courses',
              'Watch something from the programming or wisdom shelf and it will be tracked here.',
            ),
          },
          {
            id: 'books',
            label: 'Books',
            badge: allEntries.filter((entry) => entry.resource_type === 'book').length,
            panel: typePanel('books', 'Open a book from the library to start tracking it.'),
          },
          {
            id: 'articles',
            label: 'Articles',
            badge: allEntries.filter((entry) => entry.resource_type === 'blog').length,
            panel: typePanel('articles', 'Reading a blog post records it here automatically.'),
          },
          {
            id: 'labs',
            label: 'Labs',
            badge: allEntries.filter((entry) => entry.resource_type === 'lab').length,
            panel: typePanel('labs', 'Opening a lab records it here.'),
          },
          {
            id: 'saved',
            label: 'Saved & notes',
            badge: savedEntries.length,
            panel: renderEntryList(
              savedEntries,
              'Nothing saved',
              'Items you opened but did not start, plus anything with a note, live here.',
            ),
          },
          { id: 'settings', label: 'Settings', panel: <SettingsPanel /> },
        ]}
      />
    </div>
  );
}
