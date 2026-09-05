# Sirrat al-Ilm — what was wrong with the original brief, and the rewritten one

This document does two things:

1. **Audits the original request** — the ambiguities and contradictions that would
   have produced rework, and the decision taken for each one.
2. **Rewrites it** as a specification you can hand to any engineer (or agent) and
   get the same product back on the first pass.

---

## Part 1 — Mistakes and gaps in the original prompt

| # | Issue in the original brief | Why it is a problem | Decision taken here |
|---|---|---|---|
| 1 | **The admin password was written in the prompt** (redacted here — see `.env`). | A credential inside a specification ends up in git history, logs and screenshots forever. It is also the *only* thing standing between the internet and the delete buttons. | Never committed. Supplied via `ADMIN_SEED_PASSWORD` in a git-ignored `.env` (documented in `.env.example`), or created interactively with `python -m app.cli create-admin`. Hashed with salted PBKDF2-SHA256. |
| 2 | **Schema was `User` + `Item(owner_id, title, description, image_url, availability_status)`.** | One generic `Item` table cannot hold four different content types: a YouTube card needs a video id/channel/duration, a book needs an author/TOC/PDF/download count, a lab needs a gallery and a status, a blog post needs a markdown body, category and reading time. `availability_status` describes stock, not learning content. | `User` kept as specified (plus `role`, `is_active`, profile fields). `Item` is honoured as the ancestor of four purpose-built tables — `shelf_resource`, `book`, `lab`, `post` — that share the same title/description/image/owner ideas but carry the fields each type actually needs. |
| 3 | **"Admin only for one email" + "anyone can sign up"** with no role model. | Without an explicit rule, either everybody can be promoted or the owner can be locked out of their own site. | `role` column (`user` \| `admin`). `require_admin` grants access if `role == admin` **or** the e-mail equals `ADMIN_EMAIL`, so the owner can never be locked out and nobody can self-promote. The admin can promote other accounts (helpers) from the People tab. |
| 4 | **"Site opens with a sign-in gate for everyone."** | Taken literally this hides all content from search engines and from anyone deciding whether to register — the opposite of what a knowledge library wants. | The *app* is gated (every route except `/signin` and `/signup` requires a session), which is what was asked. The auth screens themselves carry the editorial voice so the gate still feels like the front door. Flip one guard in `App.tsx` to make the library public later. |
| 5 | **"YouTube shelf — cards redirect to YouTube"** and separately **"dashboard tracks watched courses"**. | Redirecting away means the site never learns that anything was watched; the two requirements silently contradict each other. | Cards open YouTube in a new tab **and** fire a progress write (`PUT /api/progress`) on click, plus a "Mark complete" button and a 0–100% slider. Progress is stored per user per resource, so the dashboard is real rather than decorative. |
| 6 | **"Books by author, free"** — no file handling specified. | "Free" says nothing about where the PDF lives, who may download it, or what happens when the author has no file yet. | Books store an optional `file_url`; when blank the server generates a typeset PDF of the book's own content (`app/services/pdf.py`). `GET /api/books/{slug}/download` is authenticated, increments `download_count` and records progress. |
| 7 | **"Labs: image gallery placeholder + description."** | "Placeholder" usually becomes a grey box that ships to production. | Labs have a real `gallery` (URL + caption, admin-editable) rendered as a keyboard-accessible grid with a lightbox. Where no image exists, the server generates deterministic placeholder artwork (`/api/media/art/<token>.svg`) so nothing looks broken. |
| 8 | **No authentication design.** | "Auth pages with validation" leaves token lifetime, storage, refresh and lockout undefined — the parts that actually cause bugs. | JWT access (12 h) + refresh (30 d) tokens, refresh rotation with single-flight de-duplication in the client, session persisted in `localStorage`, deactivated accounts rejected at both login and request time. |
| 9 | **No content contract for "blogs (religion, tech, life updates, programming courses)".** | Those four things overlap with the two shelves, so the same material could live in two places with no rule for which wins. | Blog categories are `religion`, `technology`, `life`, `programming`; shelves are for *external video courses*, posts are for *original writing*. The admin console keeps them in separate tabs so the boundary stays obvious. |
| 10 | **No error-handling, empty-state, loading or validation contract.** | Every page invents its own spinner and its own way of showing a 422. | One `ApiError` type (with `fieldErrors` mapped onto form fields), one `useApi` hook (loading/error/reload), shared `PageLoader`/`EmptyState`/`ErrorState` components, toasts for mutations, and an error boundary around the router. |
| 11 | **No non-functional requirements** (tests, seeding, deployment, responsive, a11y). | "Production-ready" is unmeasurable, so it never gets done. | 83 backend tests + 37 frontend unit tests, idempotent seed data (27 videos / 6 books / 6 labs / 6 posts), Docker + compose for PostgreSQL, semantic HTML with ARIA tabs/dialogs, focus-visible rings, `prefers-reduced-motion` support, security headers and CSP. |
| 12 | **Proxy/hosting reality not considered.** | Some reverse proxies (including hosted preview tunnels) strip `Authorization`, which silently signs every visitor out in a `401 → refresh → 401` loop. | The API accepts the token in `Authorization: Bearer` **or** `X-Access-Token`; the SPA sends both. A 401 *after* a successful refresh now signs the user out instead of looping. |
| 13 | **Reserved-TLD e-mail in seed data** (`learner@sirrat.test`). | `email-validator` rejects `.test`/`.local`, so the seeded demo account could not sign in at all — a 422 on the login form. | Demo learner is `learner@example.com`, configurable via `DEMO_LEARNER_EMAIL` / `DEMO_LEARNER_PASSWORD`, and advertised by `GET /api/info` so the sign-in page can never drift from the database. |

---

## Part 2 — The rewritten prompt

> Copy everything below the line. It is self-contained.

---

### Build "Sirrat al-Ilm" (سرّ العلم) — a private knowledge library

**Product.** A cosy, premium-feeling personal library where one owner publishes
curated YouTube course shelves, free books, project "labs" and long-form writing
for an audience of learners who sign in to track their progress.

#### 1. Stack and delivery

- **Frontend:** React 18 + TypeScript (strict), Vite, React Router 6. No UI kit —
  hand-written CSS from the tokens in §6.
- **Backend:** FastAPI + SQLAlchemy 2 + Pydantic v2, Python 3.11.
- **Database:** PostgreSQL in production; SQLite for zero-config local development
  (same models, switchable by `DATABASE_URL`).
- **Serving:** one origin. FastAPI serves the compiled SPA and the JSON API; Vite
  proxies `/api` in development.
- **Structure:** `frontend/src/{pages,components/{ui,content,layout,dashboard,admin},hooks,context,lib,api,types,styles}`
  and `backend/app/{api/routes,core,db,models,schemas,services}`.
- **Quality bar:** no `TODO`s, no placeholder components, no dead code. Every
  section of code carries a comment explaining *why*, not *what*. Fully typed
  TypeScript; `tsc --noEmit` and the test suites must pass.

#### 2. Roles and access

- Two roles: `user` (learner) and `admin` (owner).
- **The owner is the account whose e-mail equals `ADMIN_EMAIL`** (default
  `rehanraeessayyed786@gmail.com`). That account is granted admin on sign-up,
  on sign-in and by the `require_admin` dependency — it can never be locked out.
- The owner's password is supplied through `ADMIN_SEED_PASSWORD` (dev bootstrap)
  or `python -m app.cli create-admin`. **It must never appear in code, docs,
  fixtures or git history.**
- Admins may promote/demote/deactivate/delete other accounts; the owner account
  cannot be demoted, deactivated or deleted.
- **Learner dashboard contains no admin functionality whatsoever** — only
  navigation and progress tracking. Admin routes are guarded on the client *and*
  re-checked on every request (403 for non-admins).
- Every route except `/signin` and `/signup` requires a session; unauthenticated
  visitors are redirected to sign-in and returned to the page they asked for.
  After sign-in: admins land on `/admin`, learners on their dashboard.

#### 3. Features

**Shelves (YouTube).** Three or more shelves — at minimum *Religion &
self-improvement*, *Programming language courses*, *Tools, tech & deep work*.
Each shelf has a title, slug, kind, subtitle, description, accent and sort order.
Cards carry title, description, external URL, `video_id`, channel, duration label,
level, language, type (video/playlist), sort order, published and featured flags.
Clicking a card opens the original YouTube page in a new tab **and** records
progress. Shelves render as horizontal, snap-scrolling rows with arrow buttons
that disable at the ends.

**Books (free).** Author-written books with subtitle, author, category, cover,
description, markdown body, table of contents (chapter/title/pages), tags, page
count, publish date and download count. `GET /api/books/{slug}/download` returns
a real PDF (generated server-side when no file is supplied), requires a session,
increments the download count and records progress.

**Labs.** Projects with title, slug, summary, markdown description, cover,
category, status (`building` / `shipped` / `archived`), links, tech tags and an
admin-editable image gallery (URL + caption) shown as a grid with an accessible
lightbox. Missing images fall back to deterministic generated artwork.

**Writing (blog).** Posts with title, slug, excerpt, markdown body, category
(`religion` / `technology` / `life` / `programming`), tags, cover, author,
published flag, publish date, reading minutes (computed) and view count.

**Learner dashboard.** Continue-learning list, completions, saved items, notes
per item, a 0–100% slider per item, per-type learning paths, recent activity and
account settings (profile, password change, delete account). No admin features.

**Admin console.** Overview counters, most-engaged resources, live activity feed,
and full CRUD for shelves, shelf cards, books (incl. TOC rows), labs (incl.
gallery rows), posts (with a live markdown preview) and people — plus editable
landing-page copy (hero and About) and an idempotent re-seed action.

#### 4. Data model

```text
User(id, email UNIQUE, password_hash, full_name, role, is_active, bio,
     occupation, location, avatar_url, created_at, last_login_at)

Shelf(id, title, slug UNIQUE, kind, subtitle, description, accent,
      sort_order, is_published, created_at)
ShelfResource(id, shelf_id FK→Shelf ON DELETE CASCADE, title, description,
      external_url, video_id, channel, duration_label, level, language,
      resource_type, thumbnail_url, sort_order, is_published, is_featured)

Book(id, title, slug UNIQUE, subtitle, author, category, description, body_md,
     cover_url, file_url, tags[], pages, published_on, download_count,
     is_published, owner_id FK→User, toc[{chapter,title,pages}], created_at)

Lab(id, title, slug UNIQUE, summary, description_md, cover_url, category,
    status, links[], tech[], gallery[{url,caption}], owner_id FK→User,
    is_published, created_at)

Post(id, title, slug UNIQUE, excerpt, body_md, category, tags[], cover_url,
     author_id FK→User, is_published, published_at, reading_minutes,
     view_count, created_at)

ProgressEntry(id, user_id FK→User ON DELETE CASCADE, resource_type
     [video|book|blog|lab], resource_id, status [not_started|in_progress|
     completed], progress_percent 0–100, notes, last_accessed_at, created_at,
     UNIQUE(user_id, resource_type, resource_id))

Setting(key PK, value JSON)      # hero + About copy, editable by the admin
```

`ProgressEntry` is the single mechanism behind "watched courses / read books":
one row per learner per item, upserted on open, on "mark complete" and on slider
change.

#### 5. API contract

- Prefix `/api`; JSON everywhere; errors as `{ "detail": str, "errors": [{field,
  message, type}] }` with correct status codes (400/401/403/404/409/422).
- `POST /api/auth/{signup,login,refresh}`, `GET /api/auth/me`.
- `GET /api/content/{home,about,meta}` — one request powers the landing page.
- `GET /api/shelves[/{slug}]`, `/api/books[/{slug}][/download]`,
  `/api/labs[/{slug}]`, `/api/posts[/{slug}]`.
- `GET/PUT /api/progress`, `GET /api/progress/entries`,
  `POST /api/progress/{id}/complete`, `PATCH /api/progress/{id}/notes`,
  `DELETE /api/progress/{id}`.
- `GET/PATCH/DELETE /api/users/me`, `POST /api/users/me/password`.
- `GET /api/admin/{stats,people,shelves,books,labs,posts,site-content}` plus
  create/update/delete for each, `PATCH /api/admin/people/{id}/{role,active}`,
  `PUT /api/admin/site-content/{hero,about}`, `POST /api/admin/reseed`.
- `GET /api/health` (liveness + DB round-trip) and `GET /api/info` (service card
  that also advertises the demo learner when one is seeded).
- Auth: JWT access (12 h) + rotating refresh (30 d). Accept the access token in
  `Authorization: Bearer <t>` **or** `X-Access-Token: <t>` (some proxies strip
  `Authorization`). Passwords: salted PBKDF2-SHA256, minimum 8 characters with at
  least one letter and one number, transparent rehash on login when parameters
  change.
- Security headers on every response: CSP, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.

#### 6. Design system

- **Palette:** background `#F7F3EE`, cards `#EFEAE2`, headers/primary buttons
  `#3E1E12`, body text `#5C463C`, secondary detail `#A48675`, borders `#E2DACF`.
  Semantic colours for success/warning/danger/info derived from the same warmth.
- **Type:** Playfair Display for headings, Inter for body. Editorial, generous
  line-height, tight heading tracking.
- **Feel:** clean, cosy, premium — soft warm shadows, pill buttons, 12–26px radii,
  no hard greys, no neon.
- All values live in `frontend/src/styles/tokens.css`; components never hard-code
  a hex value.
- **Accessibility:** semantic landmarks, one `h1` per page, ARIA tabs/dialog/
  radiogroup patterns, visible `:focus-visible` rings, skip link, `aria-live`
  toasts, `prefers-reduced-motion` respected, AA contrast, keyboard-operable
  shelves and lightbox.

#### 7. Configuration and secrets

- Everything secret or environment-specific comes from environment variables:
  `JWT_SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_SEED_PASSWORD`, `DATABASE_URL`,
  `CORS_ORIGINS`, `ENVIRONMENT`, `SEED_CONTENT_ON_STARTUP`, `SEED_DEMO_LEARNER`,
  `DEMO_LEARNER_EMAIL`, `DEMO_LEARNER_PASSWORD`, `SITE_*`.
- Ship a `.env.example` documenting each variable; `.env` is git-ignored.
- **A demo learner account is public by design** (the sign-in page prints it):
  `learner@example.com` / `Learner123`, seeded with a realistic partial history.
  Use a validatable domain — reserved TLDs like `.test` are rejected by the
  e-mail validator. Disable with `SEED_DEMO_LEARNER=false`, and it is skipped
  automatically when `ENVIRONMENT=production`.

#### 8. Seed data

Idempotent (safe to re-run; never duplicates or overwrites edits): 3 shelves with
27 real YouTube course cards across the categories, 6 books with generated covers
and downloadable PDFs, 6 labs with galleries, 6 posts across all 4 categories,
the owner account and the demo learner with 12 progress entries.

#### 9. Testing and delivery

- Backend: pytest + TestClient covering auth (including role escalation and
  deactivation), progress upserts, content endpoints, every admin guard, PDF
  generation, path traversal and the validation-error contract.
- Frontend: Vitest unit tests for the pure helpers (dates, labels, validation,
  YouTube URL parsing) — the functions every page depends on.
- `scripts/build.sh` (type-check → bundle → copy into `backend/app/static`),
  `scripts/dev.sh` (API + Vite together), a `Makefile` for the common commands,
  a multi-stage `Dockerfile` and a `docker-compose.yml` with PostgreSQL 16.
- A `README.md` that gets a newcomer from clone to signed-in admin in under five
  minutes, without leaking a single secret.
