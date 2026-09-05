/**
 * LabCard — one project/experiment from the Labs section.
 */

import { Link } from 'react-router-dom';
import type { Lab } from '../../types';
import { Badge, toneForStatus } from '../ui/Badge';
import { CoverArt } from '../ui/CoverArt';
import { titleCase } from '../../lib/format';

export interface LabCardProps {
  lab: Lab;
  layout?: 'shelf' | 'grid';
}

export function LabCard({ lab, layout = 'shelf' }: LabCardProps): JSX.Element {
  return (
    <article className={`card lab-card lab-card--${layout}`}>
      <Link className="lab-card__media" to={`/labs/${lab.slug}`} aria-label={`Open ${lab.title}`}>
        <CoverArt
          src={lab.image_url}
          alt={`Cover image for the ${lab.title} lab`}
          fallbackLabel={lab.title}
          tone="walnut"
        />
      </Link>

      <div className="lab-card__body">
        <div className="lab-card__meta">
          {lab.category ? <Badge tone="latte">{lab.category}</Badge> : null}
          <Badge tone={toneForStatus(lab.availability_status)}>
            {titleCase(lab.availability_status)}
          </Badge>
        </div>

        <h3 className="lab-card__title">
          <Link to={`/labs/${lab.slug}`}>{lab.title}</Link>
        </h3>
        {lab.summary ? <p className="lab-card__summary">{lab.summary}</p> : null}

        {lab.tags.length ? (
          <ul className="chip-row" aria-label="Technologies used">
            {lab.tags.slice(0, 4).map((tag) => (
              <li key={tag} className="chip">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="lab-card__actions">
          <Link className="btn btn--primary btn--sm" to={`/labs/${lab.slug}`}>
            Open lab
          </Link>
          {lab.external_url ? (
            <a
              className="btn btn--quiet btn--sm"
              href={lab.external_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source ↗
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
