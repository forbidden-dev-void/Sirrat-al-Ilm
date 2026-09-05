"""
Editable site copy (hero + About)
=================================

These dictionaries are the *defaults*. They are written into the
``site_settings`` table on first boot, and from then on the owner edits them in
Admin -> Site content. Nothing here is hard-coded in the React app.
"""

from __future__ import annotations

from typing import Any, Dict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.site_setting import SiteSetting

HERO_KEY = "hero"
ABOUT_KEY = "about"

DEFAULT_HERO: Dict[str, Any] = {
    "eyebrow": "Sirrat al-Ilm  ·  سرّ العلم",
    "title": "Slow brew.",
    "highlight": "Deep insights.",
    "subtitle": (
        "A quiet library for deen, technology, life and code — curated YouTube shelves, "
        "free books written by me, working labs and long-form writing. Sign in, pick a "
        "shelf, and your progress is remembered."
    ),
    "primary_cta_label": "Start with the wisdom shelf",
    "primary_cta_href": "/shelf/wisdom",
    "secondary_cta_label": "Read the free books",
    "secondary_cta_href": "/books",
}

DEFAULT_ABOUT: Dict[str, Any] = {
    "headline": "Assalamu alaikum — I'm Rehan.",
    "intro": (
        "I write code, I write books, and I collect the reminders that keep me honest. "
        "Sirrat al-Ilm (سرّ العلم — the secret of knowledge) is the shelf where all three "
        "meet: religion and self-improvement, programming courses, life updates, and the "
        "labs I build along the way. Everything here is free, and everything here is "
        "tracked — so you always know where you stopped.\n\n"
        "I believe knowledge is an amanah (trust). It is not meant to be hoarded behind a "
        "paywall or a login wall you cannot remember. So: read the books, watch the "
        "courses, take notes, and pass it on."
    ),
    "portrait_url": "/api/media/art/rehan-portrait.svg?label=Rehan+Rae+Essayyed&palette=chocolate",
    "education": [
        {
            "institution": "University programme",
            "degree": "Bachelor of Science",
            "field": "Computer Science & Software Engineering",
            "period": "2019 — 2023",
            "detail": (
                "Algorithms, databases, operating systems and human-computer interaction. "
                "Final-year project: a knowledge-sharing platform for students who cannot "
                "afford courses."
            ),
        },
        {
            "institution": "Self-directed Islamic studies",
            "degree": "Ongoing",
            "field": "Qur'an, Seerah & Arabic",
            "period": "2016 — present",
            "detail": (
                "Weekly halaqah, tafsir classes and a structured reading of the classical "
                "works on the etiquette of seeking knowledge — the source of this site's name."
            ),
        },
        {
            "institution": "Online certifications",
            "degree": "Professional certificates",
            "field": "Full-stack development, Cloud & UX",
            "period": "2021 — present",
            "detail": (
                "Continuous learning: backend engineering with FastAPI, front-end with React "
                "and TypeScript, and deployment with Docker and PostgreSQL."
            ),
        },
    ],
    "experience": [
        {
            "role": "Founder & Author",
            "organisation": "Sirrat al-Ilm",
            "period": "2023 — Present",
            "location": "Remote",
            "detail": (
                "Building a free library: books, curated video shelves, programming course "
                "paths and engineering labs — designed, written and shipped solo."
            ),
            "highlights": [
                "Wrote and published free books on knowledge, discipline and code",
                "Curated 30+ vetted YouTube courses into guided learning shelves",
                "Designed and shipped this platform end-to-end (FastAPI + React + PostgreSQL)",
            ],
        },
        {
            "role": "Full-Stack Engineer",
            "organisation": "Product & platform engineering",
            "period": "2021 — Present",
            "location": "Remote / hybrid",
            "detail": (
                "Designing REST APIs and React front ends: SQLAlchemy models, JWT auth, "
                "role-based access control, background jobs and CI/CD deployments."
            ),
            "highlights": [
                "FastAPI services with typed Pydantic contracts and pytest coverage",
                "React + TypeScript dashboards with accessible, design-token driven UI",
                "PostgreSQL schema design, migrations and query tuning",
            ],
        },
        {
            "role": "Programming Mentor & Instructor",
            "organisation": "Community classes, YouTube & study circles",
            "period": "2020 — Present",
            "location": "Online",
            "detail": (
                "Teaching Python, JavaScript and web development to beginners, and running "
                "study circles that pair technical skills with adab (manners)."
            ),
            "highlights": [
                "Mentored 100+ learners from first line of code to first deployment",
                "Recorded course walkthroughs and code-review sessions",
                "Built practice labs so students learn by shipping, not by watching",
            ],
        },
    ],
    "skills": [
        "Python",
        "FastAPI",
        "TypeScript",
        "React",
        "PostgreSQL",
        "SQLAlchemy",
        "REST API design",
        "System design",
        "Docker & CI/CD",
        "UI / UX design",
        "Technical writing",
        "Teaching & mentoring",
    ],
    "languages": ["English", "Urdu", "Arabic (reading)"],
    "socials": [
        {"label": "YouTube", "url": "https://www.youtube.com/@sirrat-al-ilm", "icon": "youtube"},
        {"label": "GitHub", "url": "https://github.com/forbidden-dev-void", "icon": "github"},
        {
            "label": "Email",
            "url": "mailto:rehanraeessayyed786@gmail.com",
            "icon": "mail",
        },
    ],
    "facts": {
        "Focus": "Deen, code & life",
        "Library": "Free forever",
        "Teaching since": "2020",
        "Availability": "Worldwide, online",
    },
}


def get_setting(db: Session, key: str, default: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch a JSON setting, falling back to (and persisting) the default."""
    row = db.execute(select(SiteSetting).where(SiteSetting.key == key)).scalar_one_or_none()
    if row is None:
        row = SiteSetting(key=key, value=default)
        db.add(row)
        db.commit()
        db.refresh(row)
    if not isinstance(row.value, dict):  # defensive: corrupted JSON
        row.value = default
        db.commit()
    return dict(row.value)


def set_setting(db: Session, key: str, value: Dict[str, Any]) -> Dict[str, Any]:
    """Create-or-update a JSON setting (used by the admin "Site content" form)."""
    row = db.execute(select(SiteSetting).where(SiteSetting.key == key)).scalar_one_or_none()
    if row is None:
        row = SiteSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
    return dict(row.value)
