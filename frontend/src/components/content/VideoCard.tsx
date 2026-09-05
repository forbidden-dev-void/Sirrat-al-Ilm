/**
 * VideoCard — one card inside a YouTube shelf
 * ===========================================
 *
 * Clicking the card (title, thumbnail or the Watch button) opens the original
 * YouTube page in a new tab *and* records progress for the signed-in learner,
 * which is what makes the dashboard's "continue watching" list possible.
 */

import { Link } from 'react-router-dom';
import type { ProgressEntry, ShelfResource } from '../../types';
import { Badge, toneForStatus } from '../ui/Badge';
import { CoverArt } from '../ui/CoverArt';
import { ProgressBar } from '../ui/ProgressBar';

export interface VideoCardProps {
  resource: ShelfResource;
  progress?: ProgressEntry | null;
  onOpen: (resource: ShelfResource) => void;
  onComplete: (resource: ShelfResource) => void;
  onUndo: (entry: ProgressEntry) => void;
  shelfSlug?: string;
}

export function VideoCard({
  resource,
  progress,
  onOpen,
  onComplete,
  onUndo,
  shelfSlug,
}: VideoCardProps): JSX.Element {
  const completed = progress?.status === 'completed';
  const percent = progress?.progress_percent ?? 0;
  const url = resource.external_url ?? '#';

  return (
    <article className={`card video-card${completed ? ' video-card--done' : ''}`}>
      <div className="video-card__media">
        <a
          className="video-card__link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpen(resource)}
          aria-label={`${resource.title} — opens YouTube in a new tab`}
        >
          <CoverArt
            src={resource.thumbnail_url}
            alt={`Thumbnail for ${resource.title}`}
            fallbackLabel={resource.title}
            tone="walnut"
          />
          <span className="video-card__play" aria-hidden="true">
            ▶
          </span>
        </a>
        {resource.duration_label ? (
          <span className="video-card__duration">{resource.duration_label}</span>
        ) : null}
        {completed ? (
          <span className="video-card__done-badge" title="Completed">
            ✓
          </span>
        ) : null}
      </div>

      <div className="video-card__body">
        <div className="video-card__meta">
          {resource.level ? <Badge tone="cream">{resource.level}</Badge> : null}
          {resource.resource_type === 'playlist' ? <Badge tone="latte">Playlist</Badge> : null}
          {resource.language ? <Badge tone="cream">{resource.language}</Badge> : null}
        </div>

        <h3 className="video-card__title">
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => onOpen(resource)}>
            {resource.title}
          </a>
        </h3>

        {resource.channel ? <p className="video-card__channel">{resource.channel}</p> : null}
        <p className="video-card__description">{resource.description}</p>

        {progress ? (
          <div className="video-card__progress">
            <ProgressBar value={percent} size="sm" label={`Progress on ${resource.title}`} />
            <span className="video-card__status">
              <Badge tone={toneForStatus(progress.status)}>
                {completed ? 'Completed' : `${percent}% watched`}
              </Badge>
            </span>
          </div>
        ) : null}

        <div className="video-card__actions">
          <a
            className="btn btn--primary btn--sm"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpen(resource)}
          >
            Watch on YouTube
          </a>
          {completed && progress ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onUndo(progress)}>
              Undo
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => onComplete(resource)}
            >
              Mark complete
            </button>
          )}
          {shelfSlug ? (
            <Link className="btn btn--quiet btn--sm" to={`/shelf/${shelfSlug}`}>
              Shelf
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
