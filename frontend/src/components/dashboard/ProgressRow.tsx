/**
 * ProgressRow — one tracked item in the user dashboard.
 *
 * Shows the resource, its progress bar and the actions a learner needs:
 * resume (opens YouTube / the book), mark complete, save a note, or remove it
 * from history. It contains no admin affordances at all.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProgressEntry } from '../../types';
import { formatRelative, resourceLabel, statusLabel } from '../../lib/format';
import { Badge, toneForStatus } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CoverArt } from '../ui/CoverArt';
import { ProgressBar } from '../ui/ProgressBar';

export interface ProgressRowProps {
  entry: ProgressEntry;
  busy?: boolean;
  onComplete: (entry: ProgressEntry) => void;
  onRemove: (entry: ProgressEntry) => void;
  onSaveNotes: (entry: ProgressEntry, notes: string) => void;
  onSetPercent?: (entry: ProgressEntry, percent: number) => void;
}

/** Where should "resume" take the learner for each resource type? */
function resumeTarget(entry: ProgressEntry): { href: string; external: boolean; label: string } {
  const meta = entry.meta as {
    external_url?: string | null;
    shelf?: string | null;
    thumbnail_url?: string | null;
  };

  if (entry.resource_type === 'video' && meta.external_url) {
    return { href: meta.external_url, external: true, label: 'Watch on YouTube' };
  }
  if (entry.resource_type === 'book' && entry.resource_slug) {
    return { href: `/books/${entry.resource_slug}`, external: false, label: 'Open book' };
  }
  if (entry.resource_type === 'blog' && entry.resource_slug) {
    return { href: `/blog/${entry.resource_slug}`, external: false, label: 'Read article' };
  }
  if (entry.resource_type === 'lab' && entry.resource_slug) {
    return { href: `/labs/${entry.resource_slug}`, external: false, label: 'Open lab' };
  }
  if (entry.resource_type === 'video' && entry.resource_slug) {
    return { href: `/shelf/${entry.resource_slug}`, external: false, label: 'Open shelf' };
  }
  return { href: '/dashboard', external: false, label: 'Details' };
}

export function ProgressRow({
  entry,
  busy = false,
  onComplete,
  onRemove,
  onSaveNotes,
  onSetPercent,
}: ProgressRowProps): JSX.Element {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(entry.notes ?? '');
  const meta = entry.meta as {
    thumbnail_url?: string | null;
    cover_url?: string | null;
    channel?: string | null;
    duration_label?: string | null;
    shelf?: string | null;
    category?: string | null;
    reading_minutes?: number | null;
  };

  const target = resumeTarget(entry);
  const image = meta.thumbnail_url ?? meta.cover_url ?? null;
  const completed = entry.status === 'completed';

  return (
    <li className="progress-row">
      <div className="progress-row__media">
        <CoverArt
          src={image}
          alt=""
          fallbackLabel={entry.resource_title}
          tone={entry.resource_type === 'book' ? 'chocolate' : 'walnut'}
        />
      </div>

      <div className="progress-row__body">
        <div className="progress-row__head">
          <h3 className="progress-row__title">{entry.resource_title}</h3>
          <div className="progress-row__badges">
            <Badge tone="cream">{resourceLabel(entry.resource_type)}</Badge>
            <Badge tone={toneForStatus(entry.status)}>{statusLabel(entry.status)}</Badge>
          </div>
        </div>

        <p className="progress-row__meta">
          {meta.channel ? <span>{meta.channel}</span> : null}
          {meta.shelf ? <span>{meta.shelf}</span> : null}
          {meta.category ? <span>{meta.category}</span> : null}
          {meta.duration_label ? <span>{meta.duration_label}</span> : null}
          {meta.reading_minutes ? <span>{meta.reading_minutes} min read</span> : null}
          <span>Updated {formatRelative(entry.last_accessed_at)}</span>
        </p>

        <ProgressBar
          value={entry.progress_percent}
          size="sm"
          showValue
          label={`Progress on ${entry.resource_title}`}
          id={`progress-row-${entry.id}`}
        />

        {onSetPercent && !completed ? (
          <div className="progress-row__slider">
            <label className="sr-only" htmlFor={`slider-${entry.id}`}>
              Adjust progress for {entry.resource_title}
            </label>
            <input
              id={`slider-${entry.id}`}
              className="slider slider--sm"
              type="range"
              min={0}
              max={100}
              step={5}
              defaultValue={entry.progress_percent}
              onChange={(event) => onSetPercent(entry, Number(event.target.value))}
            />
          </div>
        ) : null}

        {editingNotes ? (
          <div className="progress-row__notes">
            <label className="sr-only" htmlFor={`notes-${entry.id}`}>
              Notes for {entry.resource_title}
            </label>
            <textarea
              id={`notes-${entry.id}`}
              className="input input--area"
              rows={3}
              value={notes}
              placeholder="What did you learn? What will you act on?"
              onChange={(event) => setNotes(event.target.value)}
            />
            <div className="progress-row__note-actions">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  onSaveNotes(entry, notes);
                  setEditingNotes(false);
                }}
              >
                Save note
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : entry.notes ? (
          <p className="progress-row__saved-note">
            <span className="progress-row__note-label">Your note</span>
            {entry.notes}
          </p>
        ) : null}

        <div className="progress-row__actions">
          {target.external ? (
            <a
              className="btn btn--primary btn--sm"
              href={target.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {target.label} ↗
            </a>
          ) : (
            <Link className="btn btn--primary btn--sm" to={target.href}>
              {target.label}
            </Link>
          )}
          <Button size="sm" variant="secondary" disabled={busy || completed} onClick={() => onComplete(entry)}>
            {completed ? 'Completed ✓' : 'Mark complete'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNotes(entry.notes ?? '');
              setEditingNotes((value) => !value);
            }}
            aria-expanded={editingNotes}
          >
            {entry.notes ? 'Edit note' : 'Add note'}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRemove(entry)}>
            Remove
          </Button>
        </div>
      </div>

      {entry.resource_type === 'video' && entry.resource_slug ? (
        <Link className="progress-row__shelf-link" to={`/shelf/${entry.resource_slug}`}>
          Shelf →
        </Link>
      ) : null}
    </li>
  );
}
