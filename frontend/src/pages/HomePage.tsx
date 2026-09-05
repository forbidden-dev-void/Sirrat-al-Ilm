/**
 * HomePage — the landing page
 * ===========================
 *
 * Sections (top to bottom), matching the brief:
 *   1. Hero           — editorial serif headline + two CTAs + stat strip
 *   2. Shelves        — religion & self-improvement, programming courses, tools
 *   3. Books by me    — the free library shelf
 *   4. Labs           — projects with gallery placeholders
 *   5. About preview  — who I am, education, experience (links to /about)
 *   6. Latest writing — blog teasers
 *   7. Resume band    — "continue where you left off" -> dashboard
 *
 * All content comes from ONE request (GET /api/content/home) plus the learner's
 * progress library, so the page is interactive immediately.
 */

import { Link } from 'react-router-dom';
import { contentApi } from '../api/endpoints';
import { BookCard } from '../components/content/BookCard';
import { LabCard } from '../components/content/LabCard';
import { PostCard } from '../components/content/PostCard';
import { VideoCard } from '../components/content/VideoCard';
import { CoverArt } from '../components/ui/CoverArt';
import { Shelf } from '../components/ui/Shelf';
import { ErrorState, PageLoader, SkeletonShelf } from '../components/ui/States';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useProgressLibrary } from '../hooks/useProgress';
import { pluralise } from '../lib/format';
import type { Book, HomeOverview, ShelfResource } from '../types';

export function HomePage(): JSX.Element {
  useDocumentTitle('Home');
  const { success, error: notifyError } = useToast();
  const { data, loading, error, reload } = useApi<HomeOverview>(() => contentApi.home(), []);
  const progress = useProgressLibrary();

  function handleOpen(resource: ShelfResource): void {
    // Fire and forget: opening YouTube should never block the click.
    void progress.markVideoOpened(resource);
  }

  function handleComplete(resource: ShelfResource): void {
    void progress.markComplete('video', resource.id);
  }

  async function handleDownload(book: Book): Promise<void> {
    try {
      await contentApi.downloadBook(book.slug);
      success('Download started', `${book.title}.pdf is on its way.`);
      void progress.markComplete('book', book.id);
    } catch (caught) {
      notifyError('Download failed', caught instanceof Error ? caught.message : 'Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="home">
        <section className="hero hero--loading">
          <PageLoader label="Brewing your library…" />
        </section>
        <SkeletonShelf count={4} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="The library did not load"
        message={error ?? 'Unknown error'}
        onRetry={reload}
      />
    );
  }

  const { site, hero, about, stats, shelves, books, labs, posts } = data;
  const continueEntries = progress.loading ? [] : Object.values(progress.entries).filter(
    (entry) => entry.status === 'in_progress',
  );

  return (
    <div className="home">
      {/* ------------------------------------------------------------ 1. hero */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__content">
          <p className="hero__eyebrow">{hero.eyebrow}</p>
          <h1 className="hero__title" id="hero-title">
            {hero.title} <span className="hero__highlight">{hero.highlight}</span>
          </h1>
          <p className="hero__subtitle">{hero.subtitle}</p>

          <div className="hero__actions">
            <Link className="btn btn--primary btn--lg" to={hero.primary_cta_href}>
              {hero.primary_cta_label}
            </Link>
            <Link className="btn btn--secondary btn--lg" to={hero.secondary_cta_href}>
              {hero.secondary_cta_label}
            </Link>
          </div>

          <dl className="hero__stats">
            <div>
              <dt>Videos curated</dt>
              <dd>{stats.videos}</dd>
            </div>
            <div>
              <dt>Free books</dt>
              <dd>{stats.books}</dd>
            </div>
            <div>
              <dt>Labs</dt>
              <dd>{stats.labs}</dd>
            </div>
            <div>
              <dt>Articles</dt>
              <dd>{stats.posts}</dd>
            </div>
          </dl>
        </div>

        <div className="hero__art" aria-hidden="true">
          <div className="hero__cup">
            <span className="hero__steam" />
            <span className="hero__steam hero__steam--2" />
            <span className="hero__steam hero__steam--3" />
            <div className="hero__cup-body">
              <span className="hero__cup-mark" lang="ar" dir="rtl">
                سرّ العلم
              </span>
            </div>
            <div className="hero__saucer" />
          </div>
          <p className="hero__caption">A quiet shelf for what matters.</p>
        </div>
      </section>

      {/* ------------------------------------------------- continue watching */}
      {continueEntries.length > 0 ? (
        <section className="resume-band" aria-labelledby="resume-title">
          <div className="resume-band__inner">
            <div>
              <h2 id="resume-title" className="section-title section-title--sm">
                Pick up where you left off
              </h2>
              <p className="section-subtitle">
                {pluralise(continueEntries.length, 'item')} still in progress.
              </p>
            </div>
            <Link className="btn btn--primary btn--sm" to="/dashboard">
              Open my dashboard →
            </Link>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------- 2. shelves */}
      {shelves.map((shelf) => (
        <Shelf
          key={shelf.id}
          id={shelf.slug}
          eyebrow={shelf.kind === 'programming' ? 'Programming courses' : shelf.kind === 'wisdom' ? 'Religion & self-improvement' : 'Tools & deep work'}
          title={shelf.title}
          subtitle={shelf.subtitle}
          description={shelf.description}
          itemCount={shelf.resources.length}
          action={
            <Link className="btn btn--quiet btn--sm" to={`/shelf/${shelf.slug}`}>
              See all {shelf.resources.length} →
            </Link>
          }
        >
          {shelf.resources.map((resource) => (
            <VideoCard
              key={resource.id}
              resource={resource}
              progress={progress.forVideo(resource)}
              onOpen={handleOpen}
              onComplete={handleComplete}
              onUndo={(entry) => void progress.undo(entry)}
            />
          ))}
        </Shelf>
      ))}

      {/* ---------------------------------------------------------- 3. books */}
      <Shelf
        id="books-shelf"
        eyebrow="Written by me"
        title="Free books"
        subtitle="Read them, print them, share them — no paywall, no sign-up funnel."
        itemCount={books.length}
        action={
          <Link className="btn btn--quiet btn--sm" to="/books">
            Open the library →
          </Link>
        }
      >
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            progress={progress.forBook(book)}
            onDownload={(target) => void handleDownload(target)}
          />
        ))}
      </Shelf>

      {/* ----------------------------------------------------------- 4. labs */}
      <Shelf
        id="labs-shelf"
        eyebrow="Labs"
        title="Things I build"
        subtitle="Working projects with galleries, notes and the reasoning behind them."
        itemCount={labs.length}
        action={
          <Link className="btn btn--quiet btn--sm" to="/labs">
            All labs →
          </Link>
        }
      >
        {labs.map((lab) => (
          <LabCard key={lab.id} lab={lab} />
        ))}
      </Shelf>

      {/* --------------------------------------------------------- 5. about */}
      <section className="about-preview" aria-labelledby="about-preview-title">
        <div className="about-preview__portrait">
          <CoverArt
            src={about.portrait_url}
            alt={`Portrait of ${site.owner}`}
            fallbackLabel={site.owner}
            tone="chocolate"
          />
        </div>
        <div className="about-preview__body">
          <p className="section-eyebrow">About me</p>
          <h2 className="section-title" id="about-preview-title">
            {about.headline}
          </h2>
          <p className="about-preview__intro">{about.intro.split('\n\n')[0]}</p>

          <div className="about-preview__columns">
            <div>
              <h3>Education</h3>
              <ul className="mini-list">
                {about.education.slice(0, 3).map((entry) => (
                  <li key={entry.institution}>
                    <strong>{entry.degree}</strong>
                    <span>{entry.institution}</span>
                    {entry.period ? <em>{entry.period}</em> : null}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Experience</h3>
              <ul className="mini-list">
                {about.experience.slice(0, 3).map((entry) => (
                  <li key={`${entry.role}-${entry.organisation}`}>
                    <strong>{entry.role}</strong>
                    <span>{entry.organisation}</span>
                    {entry.period ? <em>{entry.period}</em> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link className="btn btn--secondary btn--sm" to="/about">
            Read the full story →
          </Link>
        </div>
      </section>

      {/* -------------------------------------------------------- 6. writing */}
      <section className="section" aria-labelledby="writing-title">
        <header className="section__header">
          <div>
            <p className="section-eyebrow">Writing</p>
            <h2 className="section-title" id="writing-title">
              Latest from the blog
            </h2>
            <p className="section-subtitle">
              Religion, technology, life updates and programming — long enough to be useful.
            </p>
          </div>
          <Link className="btn btn--quiet btn--sm" to="/blog">
            All articles →
          </Link>
        </header>

        <div className="grid grid--3">
          {posts.slice(0, 3).map((post) => (
            <PostCard key={post.id} post={post} layout="grid" />
          ))}
        </div>
      </section>
    </div>
  );
}
