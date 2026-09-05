/**
 * Footer — site map, contact and the "free forever" promise.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const FOOTER_COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Library',
    links: [
      { label: 'Wisdom shelf', to: '/shelf/wisdom' },
      { label: 'Programming shelf', to: '/shelf/programming' },
      { label: 'Tools & deep work', to: '/shelf/tools' },
      { label: 'Free books', to: '/books' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { label: 'Labs', to: '/labs' },
      { label: 'Blog', to: '/blog' },
      { label: 'About me', to: '/about' },
      { label: 'My dashboard', to: '/dashboard' },
    ],
  },
];

export function Footer(): JSX.Element {
  const { isAdmin } = useAuth();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <p className="footer__name">Sirrat al-Ilm</p>
          <p className="footer__arabic" lang="ar" dir="rtl">
            سرّ العلم
          </p>
          <p className="footer__note">
            Religion, technology, life and code — kept on one quiet shelf. Everything here is free
            to read, watch and download.
          </p>
          <p className="footer__meta">
            © {year} Rehan Rae Essayyed · Built with FastAPI, React &amp; PostgreSQL
          </p>
        </div>

        <div className="footer__columns">
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} className="footer__column" aria-label={column.title}>
              <h2 className="footer__column-title">{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <nav className="footer__column" aria-label="Account">
            <h2 className="footer__column-title">Account</h2>
            <ul>
              <li>
                <Link to="/dashboard">Progress</Link>
              </li>
              <li>
                <Link to="/dashboard?tab=settings">Settings</Link>
              </li>
              {isAdmin ? (
                <li>
                  <Link to="/admin">Admin console</Link>
                </li>
              ) : null}
              <li>
                <a href="mailto:rehanraeessayyed786@gmail.com">Contact</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
