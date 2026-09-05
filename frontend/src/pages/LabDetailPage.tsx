/**
 * LabDetailPage — the "Product/Service detail page" from the brief
 * ================================================================
 *
 * Image gallery placeholder grid + full description + tags + status, with a
 * simple keyboard-accessible lightbox for the gallery.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { contentApi } from '../api/endpoints';
import { Badge, toneForStatus } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CoverArt } from '../components/ui/CoverArt';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { formatDate, titleCase } from '../lib/format';
import { renderMarkdown } from '../lib/markdown';
import type { Lab } from '../types';

export function LabDetailPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data, loading, error, reload } = useApi<Lab>(() => contentApi.lab(slug), [slug]);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useDocumentTitle(data?.title ?? 'Lab');
  useLockBodyScroll(lightbox !== null);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  // Escape closes the lightbox.
  useEffect(() => {
    if (lightbox === null) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowRight' && data) {
        setLightbox((current) => ((current ?? 0) + 1) % Math.max(1, data.gallery.length));
      }
      if (event.key === 'ArrowLeft' && data) {
        setLightbox(
          (current) => (((current ?? 0) - 1 + data.gallery.length) % Math.max(1, data.gallery.length)),
        );
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, data, closeLightbox]);

  if (loading) return <PageLoader label="Opening the lab…" />;
  if (error || !data) {
    return (
      <ErrorState
        title="Lab unavailable"
        message={error ?? 'This lab could not be loaded.'}
        onRetry={reload}
        action={
          <Link className="btn btn--secondary btn--sm" to="/labs">
            Back to all labs
          </Link>
        }
      />
    );
  }

  const lab = data;
  const activeImage = lightbox !== null ? lab.gallery[lightbox] : null;

  return (
    <div className="page lab-detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/labs">Labs</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{lab.title}</span>
      </nav>

      <header className="page-header">
        <div className="lab-detail__badges">
          {lab.category ? <Badge tone="latte">{lab.category}</Badge> : null}
          <Badge tone={toneForStatus(lab.availability_status)}>
            {titleCase(lab.availability_status)}
          </Badge>
          <Badge tone="cream">Updated {formatDate(lab.updated_at)}</Badge>
        </div>
        <h1 className="page-title">{lab.title}</h1>
        {lab.summary ? <p className="page-subtitle">{lab.summary}</p> : null}
      </header>

      {/* --------------------------------------------------- image gallery */}
      <section className="section" aria-labelledby="gallery-title">
        <div className="section__header">
          <h2 className="section-title" id="gallery-title">
            Gallery
          </h2>
          <p className="section-subtitle">
            {lab.gallery.length
              ? `${lab.gallery.length} placeholder ${lab.gallery.length === 1 ? 'image' : 'images'} — click to enlarge.`
              : 'Screenshots will be added soon.'}
          </p>
        </div>

        {lab.gallery.length ? (
          <ul className="gallery">
            {lab.gallery.map((image, index) => (
              <li key={`${image.url}-${index}`}>
                <button
                  type="button"
                  className="gallery__item"
                  onClick={() => setLightbox(index)}
                  aria-label={`Enlarge image ${index + 1}: ${image.caption ?? lab.title}`}
                >
                  <CoverArt src={image.url} alt={image.alt ?? image.caption ?? lab.title} eager={index < 2} />
                  {image.caption ? <span className="gallery__caption">{image.caption}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel__muted">No images yet.</p>
        )}
      </section>

      {/* ------------------------------------------------------ description */}
      <div className="lab-detail__columns">
        <section className="panel prose" aria-labelledby="description-title">
          <h2 className="panel__title" id="description-title">
            Description
          </h2>
          {renderMarkdown(lab.description)}
        </section>

        <aside className="panel lab-detail__aside">
          <h2 className="panel__title">Details</h2>
          <dl className="detail-list">
            <div>
              <dt>Status</dt>
              <dd>{titleCase(lab.availability_status)}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{lab.category ?? '—'}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{lab.owner?.full_name ?? 'Sirrat al-Ilm'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(lab.created_at)}</dd>
            </div>
            <div>
              <dt>Last update</dt>
              <dd>{formatDate(lab.updated_at)}</dd>
            </div>
          </dl>

          {lab.tags.length ? (
            <>
              <h2 className="panel__title">Stack &amp; topics</h2>
              <ul className="chip-row chip-row--wrap">
                {lab.tags.map((tag) => (
                  <li key={tag} className="chip">
                    {tag}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="panel__actions panel__actions--stacked">
            {lab.external_url ? (
              <a
                className="btn btn--primary btn--sm"
                href={lab.external_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View source ↗
              </a>
            ) : null}
            <Link className="btn btn--secondary btn--sm" to="/labs">
              Other labs
            </Link>
          </div>
        </aside>
      </div>

      {/* -------------------------------------------------------- lightbox */}
      {activeImage ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Image: ${activeImage.caption ?? lab.title}`}
          onClick={(event) => event.target === event.currentTarget && closeLightbox()}
        >
          <div className="lightbox__inner">
            <img src={activeImage.url} alt={activeImage.alt ?? activeImage.caption ?? lab.title} />
            <div className="lightbox__bar">
              <p>{activeImage.caption ?? lab.title}</p>
              <div className="lightbox__actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLightbox((current) => ((current ?? 0) + 1) % Math.max(1, lab.gallery.length))
                  }
                  aria-label="Next image"
                >
                  Next →
                </Button>
                <Button variant="secondary" size="sm" onClick={closeLightbox}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
