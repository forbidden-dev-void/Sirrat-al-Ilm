/**
 * PeopleManager — admin control over accounts.
 *
 * Lists every account with their engagement and allows role changes,
 * activation/deactivation and deletion. The owner account is rendered as locked
 * (the API refuses those changes as well, so the UI cannot lie).
 */

import { useState } from 'react';
import { ApiError } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatRelative } from '../../lib/format';
import type { AdminPersonRow } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';
import { ConfirmDialog } from '../ui/Modal';
import { ErrorState } from '../ui/States';
import { DataTable, type Column } from './DataTable';

export function PeopleManager(): JSX.Element {
  const { user: currentUser } = useAuth();
  const { success, error: notifyError } = useToast();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminPersonRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data: rows, loading, error, reload } = useApi<AdminPersonRow[]>(
    () => adminApi.people(query || undefined),
    [query],
  );

  const isOwner = (row: AdminPersonRow): boolean =>
    row.email.toLowerCase() === currentUser?.email.toLowerCase();

  async function changeRole(row: AdminPersonRow, role: 'admin' | 'user'): Promise<void> {
    setBusyId(row.id);
    try {
      await adminApi.setRole(row.id, role);
      success(
        'Role updated',
        `${row.full_name} is now ${role === 'admin' ? 'an administrator' : 'a learner'}.`,
      );
      reload();
    } catch (caught) {
      notifyError('Could not change role', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function changeActive(row: AdminPersonRow, isActive: boolean): Promise<void> {
    setBusyId(row.id);
    try {
      await adminApi.setActive(row.id, isActive);
      success('Account updated', `${row.full_name} is now ${isActive ? 'active' : 'deactivated'}.`);
      reload();
    } catch (caught) {
      notifyError('Could not update account', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await adminApi.deletePerson(pendingDelete.id);
      success('Account deleted', `${pendingDelete.full_name} was removed.`);
      setPendingDelete(null);
      reload();
    } catch (caught) {
      notifyError('Could not delete', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  }

  const columns: Column<AdminPersonRow>[] = [
    {
      key: 'person',
      header: 'Person',
      render: (row) => (
        <div className="cell-person">
          <strong>{row.full_name}</strong>
          <span>{row.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge tone={row.role === 'admin' ? 'chocolate' : 'cream'}>
          {row.role === 'admin' ? 'Administrator' : 'Learner'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.is_active ? 'success' : 'muted'}>{row.is_active ? 'Active' : 'Deactivated'}</Badge>
      ),
    },
    {
      key: 'engagement',
      header: 'Engagement',
      render: (row) => (
        <span className="cell-numbers">
          {row.progress_count} tracked · {row.completed_count} done
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (row) => <span className="cell-muted">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'last',
      header: 'Last seen',
      render: (row) => (
        <span className="cell-muted">
          {row.last_login_at ? formatRelative(row.last_login_at) : 'Never signed in'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="cell-actions">
          {isOwner(row) ? (
            <Badge tone="success">Owner · locked</Badge>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId === row.id}
                onClick={() => void changeRole(row, row.role === 'admin' ? 'user' : 'admin')}
              >
                {row.role === 'admin' ? 'Make learner' : 'Make admin'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === row.id}
                onClick={() => void changeActive(row, !row.is_active)}
              >
                {row.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busyId === row.id}
                onClick={() => setPendingDelete(row)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <section className="manager" aria-labelledby="people-title">
      <header className="manager__head">
        <div>
          <h2 className="manager__title" id="people-title">
            People
          </h2>
          <p className="manager__subtitle">
            {rows?.length ?? 0} account{(rows?.length ?? 0) === 1 ? '' : 's'}. Only the owner e-mail is
            protected; every other account can be promoted, deactivated or removed.
          </p>
        </div>
        <form
          className="manager__search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search);
          }}
        >
          <TextField
            label="Search people"
            id="people-search"
            type="search"
            placeholder="Name or e-mail…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setQuery('');
              }}
            >
              Clear
            </Button>
          ) : null}
        </form>
      </header>

      <DataTable
        rows={rows ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Registered accounts"
        loading={loading}
        emptyMessage="No accounts match that search."
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.full_name ?? 'account'}?`}
        message="Their profile and every progress row will be removed. This cannot be undone."
        confirmLabel="Delete account"
        busy={busyId === pendingDelete?.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
