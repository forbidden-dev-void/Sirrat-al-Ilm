/**
 * PostPage — a single article.
 *
 * Reading a post is recorded server-side (the detail endpoint writes a
 * completed progress row), so the dashboard can show "articles read" without
 * any extra client work.
 */

import { Link, useParams } from 'react-router-dom';
import { contentApi } from '../api/endpoints';
import { Badge } from '../components/ui/Badge';
import { CoverArt } from '../components/ui/CoverArt';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatDate, pluralise, titleCase } from '../lib/format';
import { renderMarkdown } from '../lib/markdown';
import type { Post } from '../types';

export function PostPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data, loading, error, reload } = useApi<Post>(() => contentApi.post(slug), [slug]);

  useDocumentTitle(data?.title ?? 'Article');

  if (loading) return <PageLoader label="Opening the article…" />;
  if (error || !data) {
    return (
      <ErrorState
        title="Article unavailable"
        message={error ?? 'This article could not be loaded.'}
        onRetry={reload}
        action={
          <Link className="btn btn--secondary btn--sm" to="/blog">
            Back to the blog
          </Link>
        }
      />
    );
  }

  const post = data;

  return (
    <article className="page page--narrow post-detail">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/blog">Blog</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{titleCase(post.category)}</span>
      </nav>

      <header className="post-detail__header">
        <div className="post-detail__badges">
          <Badge tone="chocolate">{titleCase(post.category)}</Badge>
          <Badge tone="cream">{post.reading_minutes} min read</Badge>
          {post.published_at ? <Badge tone="cream">{formatDate(post.published_at)}</Badge> : null}
        </div>
        <h1 className="page-title">{post.title}</h1>
        <p className="post-detail__excerpt">{post.excerpt}</p>
        <p className="post-detail__meta">
          {post.author ? <>by {post.author.full_name} · </> : null}
          {pluralise(post.view_count, 'view')}
        </p>
      </header>

      <div className="post-detail__cover">
        <CoverArt src={post.cover_image} alt="" fallbackLabel={post.title} tone="latte" />
      </div>

      <div className="prose prose--article">{renderMarkdown(post.body)}</div>

      {post.tags.length ? (
        <footer className="post-detail__footer">
          <ul className="chip-row chip-row--wrap">
            {post.tags.map((tag) => (
              <li key={tag} className="chip">
                #{tag}
              </li>
            ))}
          </ul>

          <div className="page-actions">
            <Link className="btn btn--secondary" to="/blog">
              ← More articles
            </Link>
            <Link className="btn btn--quiet" to="/dashboard?tab=articles">
              My reading history
            </Link>
          </div>
        </footer>
      ) : null}
    </article>
  );
}
