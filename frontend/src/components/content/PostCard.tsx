/**
 * PostCard — blog teaser (religion / tech / life / programming / books).
 */

import { Link } from 'react-router-dom';
import type { PostSummary } from '../../types';
import { formatDate, titleCase } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { CoverArt } from '../ui/CoverArt';

export interface PostCardProps {
  post: PostSummary;
  layout?: 'shelf' | 'grid' | 'list';
}

export function PostCard({ post, layout = 'shelf' }: PostCardProps): JSX.Element {
  return (
    <article className={`card post-card post-card--${layout}`}>
      <Link className="post-card__media" to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}>
        <CoverArt
          src={post.cover_image}
          alt=""
          fallbackLabel={post.title}
          tone="latte"
        />
      </Link>

      <div className="post-card__body">
        <div className="post-card__meta">
          <Badge tone="chocolate">{titleCase(post.category)}</Badge>
          <span className="post-card__date">{formatDate(post.published_at)}</span>
          <span className="post-card__reading">{post.reading_minutes} min read</span>
        </div>

        <h3 className="post-card__title">
          <Link to={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <p className="post-card__excerpt">{post.excerpt}</p>

        <div className="post-card__footer">
          {post.author ? <span className="post-card__author">by {post.author.full_name}</span> : null}
          <Link className="btn btn--quiet btn--sm" to={`/blog/${post.slug}`}>
            Read article →
          </Link>
        </div>
      </div>
    </article>
  );
}
