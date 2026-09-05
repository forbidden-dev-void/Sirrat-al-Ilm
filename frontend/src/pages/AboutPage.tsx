/**
 * AboutPage — about myself, education, experience
 * ===============================================
 *
 * Rendered from the editable `about` setting (Admin -> Site content), so the
 * owner can rewrite this page without touching code.
 */

import { Link } from 'react-router-dom';
import { contentApi } from '../api/endpoints';
import { CoverArt } from '../components/ui/CoverArt';
import { ErrorState, PageLoader } from '../components/ui/States';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { renderMarkdown } from '../lib/markdown';
import type { About } from '../types';

export function AboutPage(): JSX.Element {
  useDocumentTitle('About');
  const { data, loading, error, reload } = useApi<About>(() => contentApi.about(), []);

  if (loading) return <PageLoader label="Loading the story…" />;
  if (error || !data) return <ErrorState message={error ?? 'Unknown error'} onRetry={reload} />;

  const about = data;

  return (
    <div className="page page--narrow about-page">
      <header className="page-header">
        <p className="section-eyebrow">About</p>
        <h1 className="page-title">{about.headline}</h1>
      </header>

      <section className="about-hero">
        <div className="about-hero__portrait">
          <CoverArt
            src={about.portrait_url}
            alt="Portrait of Rehan Rae Essayyed"
            fallbackLabel="Rehan Rae Essayyed"
            tone="chocolate"
          />
        </div>
        <div className="about-hero__intro prose">{renderMarkdown(about.intro)}</div>
      </section>

      {Object.keys(about.facts).length ? (
        <dl className="fact-grid">
          {Object.entries(about.facts).map(([label, value]) => (
            <div key={label} className="fact">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <section className="section" aria-labelledby="education-title">
        <h2 className="section-title" id="education-title">
          Education
        </h2>
        <ol className="timeline">
          {about.education.map((entry) => (
            <li key={`${entry.institution}-${entry.period}`} className="timeline__item">
              <div className="timeline__marker" aria-hidden="true" />
              <div className="timeline__content">
                <p className="timeline__period">{entry.period}</p>
                <h3 className="timeline__title">{entry.degree}</h3>
                <p className="timeline__subtitle">
                  {entry.institution}
                  {entry.field ? ` · ${entry.field}` : ''}
                </p>
                {entry.detail ? <p className="timeline__detail">{entry.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="experience-title">
        <h2 className="section-title" id="experience-title">
          Experience
        </h2>
        <ol className="timeline">
          {about.experience.map((entry) => (
            <li key={`${entry.role}-${entry.organisation}`} className="timeline__item">
              <div className="timeline__marker" aria-hidden="true" />
              <div className="timeline__content">
                <p className="timeline__period">
                  {entry.period}
                  {entry.location ? ` · ${entry.location}` : ''}
                </p>
                <h3 className="timeline__title">{entry.role}</h3>
                <p className="timeline__subtitle">{entry.organisation}</p>
                {entry.detail ? <p className="timeline__detail">{entry.detail}</p> : null}
                {entry.highlights?.length ? (
                  <ul className="timeline__highlights">
                    {entry.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="skills-title">
        <h2 className="section-title" id="skills-title">
          Skills &amp; languages
        </h2>
        <div className="panel">
          <h3 className="panel__label">What I work with</h3>
          <ul className="chip-row chip-row--wrap">
            {about.skills.map((skill) => (
              <li key={skill} className="chip">
                {skill}
              </li>
            ))}
          </ul>

          <h3 className="panel__label">Languages</h3>
          <ul className="chip-row chip-row--wrap">
            {about.languages.map((language) => (
              <li key={language} className="chip chip--latte">
                {language}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="connect-title">
        <h2 className="section-title" id="connect-title">
          Where to find me
        </h2>
        <ul className="social-list">
          {about.socials.map((social) => (
            <li key={social.url}>
              <a href={social.url} target="_blank" rel="noopener noreferrer">
                <span className="social-list__label">{social.label}</span>
                <span className="social-list__value">{social.url.replace(/^https?:\/\//, '').replace(/^mailto:/, '')}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="page-actions">
          <Link className="btn btn--primary" to="/shelves">
            Browse the shelves
          </Link>
          <Link className="btn btn--secondary" to="/books">
            Read a free book
          </Link>
        </div>
      </section>
    </div>
  );
}
