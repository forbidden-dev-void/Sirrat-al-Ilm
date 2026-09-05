/**
 * AuthLayout — the sign-in / sign-up split screen
 * ===============================================
 *
 * Left panel: the brand promise (quote, palette art, small facts).
 * Right panel: the form. On mobile the brand panel collapses into a header.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

const FACTS: { label: string; value: string }[] = [
  { label: 'Free books', value: '6 and growing' },
  { label: 'Curated videos', value: '27 across 3 shelves' },
  { label: 'Labs', value: '6 working projects' },
];

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps): JSX.Element {
  return (
    <div className="auth-layout">
      <aside className="auth-aside" aria-hidden="false">
        <div className="auth-aside__inner">
          <Link to="/signin" className="brand brand--light" aria-label="Sirrat al-Ilm">
            <span className="brand__mark" aria-hidden="true">
              س
            </span>
            <span className="brand__text">
              <span className="brand__name">Sirrat al-Ilm</span>
              <span className="brand__tagline">Slow brew. Deep insights.</span>
            </span>
          </Link>

          <blockquote className="auth-quote">
            <p lang="ar" dir="rtl" className="auth-quote__arabic">
              سرّ العلم
            </p>
            <p>
              “Knowledge is not what you collect. It is what changes how you act on Monday
              morning.”
            </p>
            <footer>— from <em>Notes on Seeking Knowledge</em></footer>
          </blockquote>

          <dl className="auth-facts">
            {FACTS.map((fact) => (
              <div key={fact.label} className="auth-facts__item">
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <p className="auth-aside__foot">
            Everything in the library is free. Sign in so your progress is remembered.
          </p>
        </div>
      </aside>

      <main className="auth-main" id="main-content" tabIndex={-1}>
        <div className="auth-card">
          <header className="auth-card__header">
            <h1 className="auth-card__title">{title}</h1>
            <p className="auth-card__subtitle">{subtitle}</p>
          </header>

          {children}

          <div className="auth-card__footer">{footer}</div>
        </div>
      </main>
    </div>
  );
}
