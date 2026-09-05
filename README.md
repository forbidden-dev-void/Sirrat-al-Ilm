# Sirrat al-Ilm · سرّ العلم

> *Slow brew. Deep insights.* — a private knowledge library: curated YouTube
> course shelves, free books, project labs and long-form writing, with a
> sign-in gate and real progress tracking for every learner.

FastAPI + PostgreSQL on the back, React + TypeScript on the front, served as a
single origin. The owner gets an admin console; everybody else gets a dashboard
that remembers what they watched, read and started.

---

## Contents

- [What is inside](#what-is-inside)
- [Quick start (5 minutes)](#quick-start-5-minutes)
- [Accounts](#accounts)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [Scripts & Make targets](#scripts--make-targets)
- [Testing](#testing)
- [Docker](#docker)
- [API overview](#api-overview)
- [Design system](#design-system)
- [Security notes](#security-notes)
- [Prompt audit](#prompt-audit)

---

## What is inside

| Area | What you get |
|---|---|
| **Shelves** | Horizontal, snap-scrolling rows of YouTube course cards (religion & self-improvement, programming languages, tools & deep work). Clicking a card opens the real YouTube page **and** records progress. |
| **Books** | Free, author-written books with covers, a table of contents, tags and an authenticated PDF download (generated server-side when no file is supplied). |
| **Labs** | Projects with markdown write-ups, tech tags, status and an image gallery rendered as an accessible grid + lightbox. |
| **Writing** | Blog posts in four categories (religion, technology, life, programming) with reading time, view counts and drafts. |
| **Learner dashboard** | Continue-learning, completions, saved items, per-item notes, a 0–100% slider, learning paths by type, recent activity, account settings. **No admin features.** |
| **Admin console** | Counters, most-engaged resources, live activity, and CRUD for shelves, cards, books (+TOC), labs (+gallery), posts (+live markdown preview), people, and the landing-page copy. |
| **Auth** | Sign-in gate for the whole app, JWT access + rotating refresh tokens, client-side validation that mirrors the server, password strength meter, demo account. |

Seed data ships with the app: 27 video cards across 3 shelves, 6 books, 6 labs,
6 posts, the owner account and a demo learner with 12 progress entries — so the
UI is fully populated on first boot.

---

## Quick start (5 minutes)

**Requirements:** Python 3.11+, Node 20+, and `make` (or run the commands by hand).

```bash
git clone https://github.com/forbidden-dev-void/Sirrat-al-Ilm.git
cd Sirrat-al-Ilm

cp .env.example .env          # then edit .env (see Configuration)

make install                  # python venv + npm dependencies
make build                    # type-check, bundle React, copy into backend/app/static
make serve                    # http://localhost:8000
```

Open <http://localhost:8000>. The database (SQLite by default) is created and
seeded automatically on first boot.

Prefer two processes with hot reload?

```bash
make dev                      # API on :8000 + Vite on :5173 (proxies /api)
```

Then browse <http://localhost:5173>.

No `make`? The equivalents are:

```bash
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..
cp -R frontend/dist/. backend/app/static/
cd backend && ../.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Accounts

| Account | Credentials | Lands on |
|---|---|---|
| **Owner / admin** | the e-mail in `ADMIN_EMAIL` + the password in `ADMIN_SEED_PASSWORD` (or `python -m app.cli create-admin`) | `/admin` |
| **Demo learner** | `learner@example.com` / `Learner123` — printed on the sign-in card, with a one-click "fill" button | `/dashboard` |
| **New learner** | the *Create account* form | `/` |

The demo learner exists so a reviewer can see a populated dashboard immediately.
It is **public by design** and is skipped when `ENVIRONMENT=production` or
`SEED_DEMO_LEARNER=false`. The owner's password is never displayed, seeded into
fixtures, or committed — see [Security notes](#security-notes).

Admin rights are granted when `role == admin` **or** the account e-mail equals
`ADMIN_EMAIL`, so the owner can never be locked out of their own site. Admins can
promote other accounts (helpers) from **Admin → People**.

---

## Configuration

All configuration is environment-driven; `.env.example` documents every key.
The important ones:

| Variable | Default | Purpose |
|---|---|---|
| `ENVIRONMENT` | `development` | `development` \| `staging` \| `production` |
| `JWT_SECRET_KEY` | random per boot | **Set this.** Tokens are invalidated when it changes |
| `DATABASE_URL` | `sqlite:///./data/sirrat_al_ilm.db` | Use `postgresql+psycopg://user:pass@host:5432/db` in production |
| `ADMIN_EMAIL` | owner address | Which e-mail always holds admin rights |
| `ADMIN_SEED_PASSWORD` | *(empty)* | Dev-only bootstrap password. Leave empty in production and use the CLI |
| `CORS_ORIGINS` | localhost origins | Comma-separated; only needed if the SPA is served from another origin |
| `SEED_CONTENT_ON_STARTUP` | `true` | Idempotent library seeding on boot |
| `SEED_DEMO_LEARNER` | `true` | Seed the public demo learner |
| `DEMO_LEARNER_EMAIL` / `DEMO_LEARNER_PASSWORD` | `learner@example.com` / `Learner123` | Demo credentials (must be a validatable domain) |
| `SITE_OWNER`, `SITE_YOUTUBE_CHANNEL`, `SITE_CONTACT_EMAIL` | — | Footer / meta copy |

Generate a strong secret:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## Project layout

```text
backend/
  app/
    api/routes/        auth, users, content, shelves, books, labs, posts,
                       progress, admin, media, health
    core/              config, security (hashing + JWT), dependencies, logging
    db/                engine/session, UTC-safe SQLite types, Base
    models/            User, Shelf, ShelfResource, Book, Lab, Post,
                       ProgressEntry, Setting
    schemas/           Pydantic request/response models
    services/          seeding, progress, pdf generation, artwork, stats
    static/            compiled SPA (generated by scripts/build.sh, git-ignored)
    cli.py             create-admin, promote, demote, users, seed, reset, run
    main.py            app factory, middleware, error handlers, SPA catch-all
  tests/               pytest suite (auth, content, progress, admin, security)
  requirements.txt
frontend/
  src/
    api/               typed fetch client + endpoint map
    components/        ui/ content/ layout/ dashboard/ admin/
    context/           AuthContext, ToastContext
    hooks/             useApi, useProgress, useDocumentTitle, useDebouncedValue,
                       useLockBodyScroll
    lib/               format, validation, markdown, youtube (+ unit tests)
    pages/             one file per route
    styles/            tokens.css, global.css, components.css, pages.css
    types/             the shared API contract
docs/REWRITTEN_PROMPT.md   prompt audit + the rewritten specification
scripts/build.sh           build the SPA into backend/app/static
scripts/dev.sh             run API + Vite together
```

---

## Scripts & Make targets

| Command | What it does |
|---|---|
| `make install` | Create `.venv`, install Python deps, `npm install` |
| `make dev` | API (`:8000`, reload) + Vite (`:5173`) together |
| `make serve` | Build the SPA, then serve everything from `:8000` |
| `make build` | Type-check + bundle React, copy into `backend/app/static` |
| `make test` | Backend pytest **and** frontend Vitest |
| `make test-backend` / `make test-frontend` | Run one suite |
| `make seed` | Idempotent re-seed of the library |
| `make reset` | Drop, recreate and re-seed the database |
| `make admin` | Interactive owner-account creation |
| `make docker-up` / `make docker-down` | docker compose with PostgreSQL |
| `make clean` | Remove build artefacts and caches |

CLI (run inside `backend/` with the venv python):

```bash
python -m app.cli create-admin       # create/repair the owner account
python -m app.cli promote EMAIL      # grant admin
python -m app.cli demote EMAIL       # remove admin
python -m app.cli users              # list accounts
python -m app.cli seed               # idempotent content seed
python -m app.cli reset --yes        # wipe + reseed
```

---

## Testing

```bash
make test            # 83 backend tests + 37 frontend unit tests
```

- **Backend (pytest + TestClient):** sign-up/login/refresh, role escalation,
  deactivated accounts, progress upserts and aggregation, every content
  endpoint, every admin guard (403 for learners), PDF generation, generated
  artwork, path-traversal blocking, and the validation-error contract.
- **Frontend (Vitest):** the pure helpers every page leans on — date/relative
  formatting, labels, number compaction, percentage clamping, reading-time
  estimation, the validation rules that mirror the server, and YouTube URL
  parsing for every URL shape an admin might paste.

---

## Docker

```bash
cp .env.example .env       # set JWT_SECRET_KEY, ADMIN_EMAIL, ADMIN_SEED_PASSWORD
make docker-up             # build + start app (:8000) and PostgreSQL 16
```

The image is multi-stage: Node builds the SPA, Python serves it — so the runtime
image contains no Node toolchain. Postgres data lives in the `pgdata` volume.

```bash
docker compose logs -f app
make docker-down           # stop (add: docker volume rm to discard data)
```

To use SQLite inside Docker instead, set
`DATABASE_URL=sqlite:///./data/sirrat_al_ilm.db` and drop the `db` service.

---

## API overview

Interactive docs: <http://localhost:8000/api/docs> (ReDoc at `/api/redoc`).

| Group | Endpoints |
|---|---|
| Health | `GET /api/health`, `GET /api/info` |
| Auth | `POST /api/auth/signup` · `login` · `refresh`, `GET /api/auth/me` |
| Content | `GET /api/content/home` · `about` · `meta` |
| Library | `GET /api/shelves[/{slug}]`, `/api/resources/{id}`, `/api/books[/{slug}][/download]`, `/api/labs[/{slug}]`, `/api/posts[/{slug}]` |
| Progress | `GET/PUT /api/progress`, `GET /api/progress/entries`, `POST /api/progress/{id}/complete`, `PATCH /api/progress/{id}/notes`, `DELETE /api/progress/{id}` |
| Account | `GET/PATCH/DELETE /api/users/me`, `POST /api/users/me/password` |
| Admin | `GET /api/admin/stats` · `people` · `shelves[/{id}]` · `books` · `labs` · `posts` · `site-content`, create/update/delete for each, `PATCH /api/admin/people/{id}/role|active`, `PUT /api/admin/site-content/hero|about`, `POST /api/admin/reseed` |
| Media | `GET /api/media/art/{token}.svg` (generated placeholder artwork) |

Errors are always JSON: `{ "detail": "...", "errors": [{ "field", "message", "type" }] }`,
which the SPA maps straight onto the offending form fields.

---

## Design system

| Token | Value | Used for |
|---|---|---|
| `--color-bg` | `#F7F3EE` | page background |
| `--color-surface` | `#EFEAE2` | cards, panels |
| `--color-chocolate` | `#3E1E12` | headings, primary buttons, active tabs |
| `--color-walnut` | `#5C463C` | body text |
| `--color-latte` | `#A48675` | highlights, secondary detail |
| `--color-border` | `#E2DACF` | hairlines, inactive arrows |

Playfair Display for headings, Inter for body text. Every value lives in
`frontend/src/styles/tokens.css` — components never hard-code a colour, so a
re-theme is a one-file change.

Accessibility is built in rather than bolted on: semantic landmarks, one `h1` per
page, WAI-ARIA tabs/dialog/radiogroup patterns, visible focus rings, a skip link,
`aria-live` toasts, keyboard-operable shelves and lightbox, and
`prefers-reduced-motion` support.

---

## Security notes

- **No secret is committed.** `.env` is git-ignored; `.env.example` documents the
  keys without values. The owner password arrives via `ADMIN_SEED_PASSWORD` or the
  interactive CLI.
- Passwords: salted **PBKDF2-SHA256** with a configurable iteration count and
  transparent rehashing on login when parameters change.
- JWT access tokens (12 h) + rotating refresh tokens (30 d). Refresh verifies the
  account still exists and is active before minting a new pair.
- The access token is accepted in `Authorization: Bearer <t>` **or**
  `X-Access-Token: <t>`, because some reverse proxies (including hosted preview
  tunnels) strip `Authorization` — without the fallback every visitor is silently
  signed out in a `401 → refresh → 401` loop. The client also stops that loop by
  signing out when a *refreshed* token is rejected.
- Admin routes are guarded server-side on every request; the client guard is a
  convenience, never the control.
- Security headers on every response: CSP, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. Static file serving
  is path-traversal guarded.
- The owner account cannot be demoted, deactivated or deleted — not even by
  another admin.

---

## Prompt audit

[`docs/REWRITTEN_PROMPT.md`](docs/REWRITTEN_PROMPT.md) lists the thirteen
ambiguities and contradictions in the original brief (a password written into the
specification, a single generic `Item` table asked to hold four content types,
"redirect to YouTube" versus "track watched courses", seed data on a reserved
e-mail TLD that cannot sign in, …) together with the decision taken for each, and
then restates the whole project as a self-contained specification.

---

## Licence

See [LICENSE](LICENSE).
