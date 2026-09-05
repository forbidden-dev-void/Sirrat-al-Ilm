/**
 * Navbar — primary navigation + account menu
 * ==========================================
 *
 * - semantic <nav> with aria-current handled by NavLink
 * - the Admin link is rendered *only* for the owner (role === "admin")
 * - mobile: a disclosure button controls a panel (aria-expanded/aria-controls)
 * - a "skip to content" link is rendered by AppShell, not here
 */

import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';

interface NavItem {
  to: string;
  label: string;
  adminOnly?: boolean;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/shelves', label: 'Shelves' },
  { to: '/books', label: 'Books' },
  { to: '/labs', label: 'Labs' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/admin', label: 'Admin', adminOnly: true },
];

export function Navbar(): JSX.Element {
  const { user, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile panel + account menu on navigation.
  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="brand" aria-label="Sirrat al-Ilm — home">
          <span className="brand__mark" aria-hidden="true">
            س
          </span>
          <span className="brand__text">
            <span className="brand__name">Sirrat al-Ilm</span>
            <span className="brand__tagline">Slow brew. Deep insights.</span>
          </span>
        </Link>

        <nav className="navbar__nav" aria-label="Primary">
          <ul className="nav-list">
            {visibleItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="navbar__actions">
          {user ? (
            <div className="account">
              <button
                type="button"
                className="account__trigger"
                onClick={() => setMenuOpen((value) => !value)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls="account-menu"
              >
                <Avatar name={user.full_name} src={user.avatar_url} size={34} />
                <span className="account__name">{user.full_name.split(' ')[0]}</span>
                <span className="account__chevron" aria-hidden="true">
                  ▾
                </span>
              </button>

              {menuOpen ? (
                <div className="account__menu" id="account-menu" role="menu" aria-label="Account">
                  <div className="account__header">
                    <p className="account__email">{user.email}</p>
                    <p className="account__role">{isAdmin ? 'Owner · full access' : 'Learner'}</p>
                  </div>
                  <Link role="menuitem" className="account__item" to="/dashboard">
                    My dashboard
                  </Link>
                  <Link role="menuitem" className="account__item" to="/dashboard?tab=settings">
                    Profile settings
                  </Link>
                  {isAdmin ? (
                    <Link role="menuitem" className="account__item" to="/admin">
                      Admin console
                    </Link>
                  ) : null}
                  <button
                    role="menuitem"
                    type="button"
                    className="account__item account__item--danger"
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="navbar__toggle"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <span aria-hidden="true">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {open ? (
        <nav className="navbar__mobile" id="mobile-nav" aria-label="Mobile">
          <ul className="nav-list nav-list--column">
            {visibleItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
