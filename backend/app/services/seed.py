"""
Seed data & bootstrap
=====================

Everything the site needs to look *alive* on first run:

1.  ``ensure_admin``  -> the owner account (e-mail from ``ADMIN_EMAIL``)
2.  ``seed_shelves``  -> wisdom + programming + tools YouTube shelves
3.  ``seed_books``    -> free books (downloadable PDFs generated on demand)
4.  ``seed_labs``     -> Lab listings with gallery placeholders
5.  ``seed_posts``    -> blog posts across the four categories
6.  site copy         -> hero + About defaults (editable in Admin)

All functions are **idempotent**: re-running never duplicates content, which
makes them safe to call on every container start.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import normalise_email
from app.models.blog import BlogPost
from app.models.book import Book
from app.models.item import AvailabilityStatus, Item
from app.models.progress import ProgressEntry
from app.models.shelf import Resource, Shelf
from app.models.user import User, UserRole
from app.services.art import artwork_url
from app.services.site_content import ABOUT_KEY, HERO_KEY, DEFAULT_ABOUT, DEFAULT_HERO, get_setting
from app.services.slug import unique_slug

logger = logging.getLogger("sirrat.seed")


def youtube_thumbnail(video_id: Optional[str], token: str, label: str) -> str:
    """Real YouTube thumbnail when we know the video id, else generated artwork."""
    if video_id:
        return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
    return artwork_url(token, label=label, palette="walnut")


# --------------------------------------------------------------------------- #
# 1. Owner / administrator                                                     #
# --------------------------------------------------------------------------- #
def ensure_admin(db: Session) -> User:
    """
    Guarantee the owner account exists and holds the ``admin`` role.

    * If a user with ``ADMIN_EMAIL`` already exists, they are promoted (the
      owner can never be locked out of their own site).
    * Otherwise the account is created. The password comes from
      ``ADMIN_SEED_PASSWORD`` (development bootstrap only). When it is empty a
      random password is generated and logged once, so nothing secret is ever
      written into the repository.
    """
    email = normalise_email(settings.admin_email)
    admin = db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none()

    if admin is None:
        password = settings.admin_seed_password
        generated = False
        if not password:
            import secrets

            password = secrets.token_urlsafe(12)
            generated = True
        admin = User(email=email, full_name=settings.admin_full_name, role=UserRole.ADMIN.value)
        admin.set_password(password)
        db.add(admin)
        db.commit()
        db.refresh(admin)
        if generated:
            logger.warning(
                "Created administrator %s with a generated password: %s "
                "(set ADMIN_SEED_PASSWORD in .env, or run `python -m app.cli create-admin` to choose one)",
                email,
                password,
            )
        else:
            logger.info("Created administrator account %s from ADMIN_SEED_PASSWORD", email)
    else:
        changed = False
        if admin.role != UserRole.ADMIN.value:
            admin.role = UserRole.ADMIN.value
            changed = True
        if not admin.is_active:
            admin.is_active = True
            changed = True
        if settings.admin_seed_password and not admin.verify_password(settings.admin_seed_password):
            # Keep the local bootstrap password in sync with .env during development.
            admin.set_password(settings.admin_seed_password)
            changed = True
        if changed:
            db.commit()
            db.refresh(admin)
    return admin


def ensure_demo_learner(db: Session) -> Optional[User]:
    """A friendly demo account so reviewers can see a filled-in user dashboard.

    Credentials come from settings (``DEMO_LEARNER_EMAIL`` / ``DEMO_LEARNER_PASSWORD``)
    and are shown on the sign-in page, so they are public by design. The e-mail
    must be a *valid* address: Pydantic's e-mail validator rejects reserved TLDs
    such as ``.test``, which would make the account impossible to sign in with.
    """
    email = settings.demo_learner_email.strip().lower()
    user = db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none()
    if user is not None:
        return user
    user = User(
        email=email,
        full_name="Aisha Learner",
        role=UserRole.USER.value,
        bio="Curious about everything: deen, code and good coffee.",
        occupation="Student",
        location="Online",
    )
    user.set_password(settings.demo_learner_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# --------------------------------------------------------------------------- #
# 2. Shelves (YouTube references)                                              #
# --------------------------------------------------------------------------- #
SHELF_SEED: List[Dict[str, Any]] = [
    {
        "title": "Religion & Self-Improvement",
        "slug": "wisdom",
        "kind": "wisdom",
        "subtitle": "Reminders that rebuild the heart and the habits",
        "description": (
            "A curated shelf of lectures and reminders on faith, character, discipline and "
            "mental clarity. Every card opens the original YouTube page in a new tab, and "
            "marking it complete keeps your learning history in one place."
        ),
        "accent": "chocolate",
        "sort_order": 1,
        "resources": [
            {
                "title": "Seerah of the Prophet ﷺ — full series (Dr. Yasir Qadhi)",
                "description": (
                    "The definitive, detailed series on the life of the Prophet Muhammad ﷺ. "
                    "Start with the genealogy and the Year of the Elephant, then follow the "
                    "Makkan and Madinan years episode by episode."
                ),
                "video_id": "629isa8LujE",
                "external_url": "https://www.youtube.com/watch?v=629isa8LujE",
                "channel": "East Plano Masjid / Yasir Qadhi",
                "duration_label": "Series · 100+ episodes",
                "level": "All levels",
                "language": "English",
                "resource_type": "playlist",
                "is_featured": True,
                "sort_order": 1,
            },
            {
                "title": "Transform Your Life: Habit Building Strategies — Mufti Menk",
                "description": (
                    "Practical, faith-grounded habit building: how to start small, stay "
                    "consistent and make the good deeds beloved to you."
                ),
                "video_id": "jtL650KaUFI",
                "external_url": "https://www.youtube.com/watch?v=jtL650KaUFI",
                "channel": "Mufti Menk",
                "duration_label": "32:10",
                "level": "Beginner",
                "language": "English",
                "sort_order": 2,
            },
            {
                "title": "Reflection & Self-Improvement — Mufti Menk (Manchester)",
                "description": (
                    "A full lecture on muhasabah: auditing yourself before you are audited, "
                    "and turning reflection into action."
                ),
                "video_id": "NBPBSLr5j5E",
                "external_url": "https://www.youtube.com/watch?v=NBPBSLr5j5E",
                "channel": "Mufti Menk",
                "duration_label": "1:04:22",
                "level": "All levels",
                "language": "English",
                "sort_order": 3,
            },
            {
                "title": "When You Lose Motivation (How To Be Unshakable) — Nouman Ali Khan",
                "description": (
                    "Why iman fluctuates, and the Quranic framework for rebuilding momentum "
                    "when the feeling fades."
                ),
                "external_url": (
                    "https://www.youtube.com/results?search_query="
                    "Nouman+Ali+Khan+when+you+lose+motivation+how+to+be+unshakable"
                ),
                "channel": "Nouman Ali Khan / Bayyinah",
                "duration_label": "30:59",
                "level": "All levels",
                "language": "English",
                "sort_order": 4,
            },
            {
                "title": "The Cycle of Sin — Nouman Ali Khan",
                "description": (
                    "A short, illustrated reminder on how sin repeats itself, and the three "
                    "doors out of it."
                ),
                "external_url": (
                    "https://www.youtube.com/results?search_query="
                    "cycle+of+sin+nouman+ali+khan+illustrated"
                ),
                "channel": "Bayyinah Institute",
                "duration_label": "08:14",
                "level": "Beginner",
                "language": "English",
                "sort_order": 5,
            },
            {
                "title": "Daily Routine to Become a Better Muslim — Nouman Ali Khan",
                "description": (
                    "A realistic daily schedule: prayer anchors, Quran time, work and rest — "
                    "built for students and working people."
                ),
                "external_url": (
                    "https://www.youtube.com/results?search_query="
                    "daily+routine+to+become+a+better+muslim+nouman+ali+khan"
                ),
                "channel": "Nouman Ali Khan",
                "duration_label": "12:40",
                "level": "Beginner",
                "language": "English",
                "sort_order": 6,
            },
            {
                "title": "Tafsir of Surah Al-Kahf — weekly reminders",
                "description": (
                    "The four trials of Surah Al-Kahf and what they mean for your week: faith, "
                    "wealth, knowledge and power."
                ),
                "external_url": (
                    "https://www.youtube.com/results?search_query=surah+al+kahf+tafsir+reminder"
                ),
                "channel": "Various scholars",
                "duration_label": "Playlist",
                "resource_type": "playlist",
                "level": "Intermediate",
                "language": "English",
                "sort_order": 7,
            },
            {
                "title": "Adab of Seeking Knowledge (Talib al-Ilm)",
                "description": (
                    "The manners of the student: intention, patience with the teacher, notes, "
                    "and acting on what you learn. The idea this website is named after."
                ),
                "external_url": (
                    "https://www.youtube.com/results?search_query=adab+of+seeking+knowledge+islamic+lecture"
                ),
                "channel": "Study circle recording",
                "duration_label": "45:03",
                "level": "All levels",
                "language": "English / Urdu",
                "sort_order": 8,
            },
            {
                "title": "Discipline Your Life — illustrated reminder",
                "description": (
                    "Self-control as worship: fasting of the limbs, guarding the tongue and "
                    "protecting your time."
                ),
                "external_url": (
                    "https://www.youtube.com/results?search_query=discipline+your+life+nouman+ali+khan+illustrated"
                ),
                "channel": "Bayyinah Institute",
                "duration_label": "06:52",
                "level": "Beginner",
                "language": "English",
                "sort_order": 9,
            },
            {
                "title": "Gratitude & Contentment (Shukr and Qana'ah)",
                "description": (
                    "How gratitude rewires comparison — the spiritual and psychological case "
                    "for being content with what is in your hand."
                ),
                "external_url": (
                    "https://www.youtube.com/results?search_query=gratitude+contentment+islam+lecture+shukr"
                ),
                "channel": "Various scholars",
                "duration_label": "24:18",
                "level": "All levels",
                "language": "English",
                "sort_order": 10,
            },
        ],
    },
    {
        "title": "Programming Language Courses",
        "slug": "programming",
        "kind": "programming",
        "subtitle": "Full, free, project-based courses — in the right order",
        "description": (
            "The path I recommend to every beginner: Python first for thinking, then HTML/CSS "
            "and JavaScript for the browser, then React and the backend. Each card is a "
            "complete free course on YouTube — click to open it, then mark your progress here."
        ),
        "accent": "latte",
        "sort_order": 2,
        "resources": [
            {
                "title": "Python Full Course for Beginners — Dave Gray",
                "description": (
                    "Nine hours, 23 chapters, one final Flask project. The most complete free "
                    "Python course I have found — start here if you have never coded."
                ),
                "video_id": "H2EJuAcrZYU",
                "external_url": "https://www.youtube.com/watch?v=H2EJuAcrZYU",
                "channel": "Dave Gray",
                "duration_label": "8:58:26",
                "lesson_count": 23,
                "level": "Beginner",
                "language": "English",
                "is_featured": True,
                "sort_order": 1,
            },
            {
                "title": "Python Full Course for Free — Bro Code",
                "description": (
                    "Fast-paced, example-heavy Python from zero to OOP, file handling and "
                    "small projects. Great if you learn by watching someone type."
                ),
                "video_id": "XKHEtdqhLK8",
                "external_url": "https://www.youtube.com/watch?v=XKHEtdqhLK8",
                "channel": "Bro Code",
                "duration_label": "7:06:52",
                "level": "Beginner",
                "language": "English",
                "sort_order": 2,
            },
            {
                "title": "Python Full Course (2024 refresh) — Bro Code",
                "description": (
                    "The updated 2024 edition with modern tooling, virtual environments and "
                    "current best practices."
                ),
                "video_id": "ix9cRaBkVe0",
                "external_url": "https://www.youtube.com/watch?v=ix9cRaBkVe0",
                "channel": "Bro Code",
                "duration_label": "10:36:39",
                "level": "Beginner",
                "language": "English",
                "sort_order": 3,
            },
            {
                "title": "HTML & CSS Full Course — Beginner to Pro (SuperSimpleDev)",
                "description": (
                    "Build real websites: layout, hovers, transitions, responsive design and "
                    "the CSS mental model that everything else depends on."
                ),
                "video_id": "G3e-cpL7ofc",
                "external_url": "https://www.youtube.com/watch?v=G3e-cpL7ofc",
                "channel": "SuperSimpleDev",
                "duration_label": "6:31:24",
                "level": "Beginner",
                "language": "English",
                "sort_order": 4,
            },
            {
                "title": "JavaScript Full Course — Beginner to Pro (SuperSimpleDev)",
                "description": (
                    "Project-based JavaScript: variables to DOM manipulation to async, with "
                    "exercises after every lesson and a public repo of solutions."
                ),
                "video_id": "EerdGm-ehJQ",
                "external_url": "https://www.youtube.com/watch?v=EerdGm-ehJQ",
                "channel": "SuperSimpleDev",
                "duration_label": "11:57:16",
                "level": "Beginner",
                "language": "English",
                "is_featured": True,
                "sort_order": 5,
            },
            {
                "title": "React Course — Beginner's Tutorial (freeCodeCamp)",
                "description": (
                    "Eight real-world projects and 140+ coding challenges. The clearest "
                    "introduction to components, props, state and hooks."
                ),
                "video_id": "bMknfKXIFA8",
                "external_url": "https://www.youtube.com/watch?v=bMknfKXIFA8",
                "channel": "freeCodeCamp.org",
                "duration_label": "8:16:02",
                "level": "Intermediate",
                "language": "English",
                "sort_order": 6,
            },
            {
                "title": "React JS Full Course in 12 Hours — Clever Programmer",
                "description": (
                    "A marathon build-along: multiple apps, routing, state patterns and "
                    "deployment. Watch it in chapters, not in one sitting."
                ),
                "video_id": "-cMqr9HpZ-Y",
                "external_url": "https://www.youtube.com/watch?v=-cMqr9HpZ-Y",
                "channel": "Clever Programmer",
                "duration_label": "12:03:35",
                "level": "Intermediate",
                "language": "English",
                "sort_order": 7,
            },
            {
                "title": "React Crash Course for Beginners — Academind",
                "description": (
                    "Short, dense and modern: the mental model of React in one sitting, with "
                    "a full project included."
                ),
                "video_id": "Dorf8i6lCuk",
                "external_url": "https://www.youtube.com/watch?v=Dorf8i6lCuk",
                "channel": "Academind",
                "duration_label": "1:27:38",
                "level": "Intermediate",
                "language": "English",
                "sort_order": 8,
            },
            {
                "title": "TypeScript Course for Beginners — freeCodeCamp",
                "description": (
                    "Types, interfaces, generics and how to add TypeScript to an existing "
                    "React codebase without rewriting everything."
                ),
                "external_url": (
                    "https://www.youtube.com/results?search_query=typescript+course+for+beginners+freecodecamp"
                ),
                "channel": "freeCodeCamp.org",
                "duration_label": "5:00:42",
                "level": "Intermediate",
                "language": "English",
                "sort_order": 9,
            },
            {
                "title": "SQL & PostgreSQL Full Course",
                "description": (
                    "Relational thinking: joins, indexes, constraints and transactions — the "
                    "skills that make an API fast and correct."
                ),
                "external_url": (
                    "https://www.youtube.com/results?search_query=postgresql+full+course+for+beginners"
                ),
                "channel": "freeCodeCamp.org",
                "duration_label": "4:20:15",
                "level": "Intermediate",
                "language": "English",
                "sort_order": 10,
            },
            {
                "title": "FastAPI — Python Backend Framework Course",
                "description": (
                    "The exact stack behind this website: routing, Pydantic validation, "
                    "dependency injection, JWT auth and deployment."
                ),
                "external_url": "https://www.youtube.com/results?search_query=fastapi+course+full+python+backend",
                "channel": "Eric Roby / freeCodeCamp",
                "duration_label": "9:24:47",
                "level": "Advanced",
                "language": "English",
                "sort_order": 11,
            },
            {
                "title": "Git & GitHub for Beginners — Crash Course",
                "description": (
                    "Version control you will actually use: branches, pull requests, resolving "
                    "conflicts and shipping without fear."
                ),
                "external_url": "https://www.youtube.com/results?search_query=git+and+github+for+beginners+crash+course",
                "channel": "Traversy Media",
                "duration_label": "1:46:12",
                "level": "Beginner",
                "language": "English",
                "sort_order": 12,
            },
        ],
    },
    {
        "title": "Tools, Tech & Deep Work",
        "slug": "tools",
        "kind": "tech",
        "subtitle": "The workflow layer: editors, Linux, Docker and focus",
        "description": (
            "Short, high-leverage videos on the tools around the code — plus the deep-work "
            "habits that make long study sessions possible."
        ),
        "accent": "walnut",
        "sort_order": 3,
        "resources": [
            {
                "title": "VS Code in 100 Seconds + full setup guide",
                "description": "Extensions, keybindings and settings.json for a fast editor.",
                "external_url": "https://www.youtube.com/results?search_query=vscode+setup+guide+for+developers",
                "channel": "Fireship / Traversy Media",
                "duration_label": "18:07",
                "level": "Beginner",
                "language": "English",
                "sort_order": 1,
            },
            {
                "title": "Linux Command Line for Beginners",
                "description": "Live in the terminal: navigation, pipes, permissions and ssh.",
                "external_url": "https://www.youtube.com/results?search_query=linux+command+line+for+beginners+full+course",
                "channel": "freeCodeCamp.org",
                "duration_label": "1:09:22",
                "level": "Beginner",
                "language": "English",
                "sort_order": 2,
            },
            {
                "title": "Docker in 100 Seconds + Docker Compose walkthrough",
                "description": "Containerise an app the way this project is containerised.",
                "external_url": "https://www.youtube.com/results?search_query=docker+compose+crash+course",
                "channel": "Fireship / TechWorld with Nana",
                "duration_label": "22:41",
                "level": "Intermediate",
                "language": "English",
                "sort_order": 3,
            },
            {
                "title": "Deep Work — how to focus for four hours",
                "description": "Attention as a skill: environment design, single-tasking and rest.",
                "external_url": "https://www.youtube.com/results?search_query=deep+work+how+to+focus+study+habits",
                "channel": "Cal Newport / Ali Abdaal",
                "duration_label": "14:56",
                "level": "All levels",
                "language": "English",
                "sort_order": 4,
            },
            {
                "title": "Note-taking that actually works (Zettelkasten for students)",
                "description": "Link your notes to your projects: a system for lifelong learning.",
                "external_url": "https://www.youtube.com/results?search_query=zettelkasten+note+taking+for+students",
                "channel": "Shu Omi",
                "duration_label": "12:30",
                "level": "All levels",
                "language": "English",
                "sort_order": 5,
            },
        ],
    },
]


# --------------------------------------------------------------------------- #
# 3. Books written by the owner                                                #
# --------------------------------------------------------------------------- #
BOOK_SEED: List[Dict[str, Any]] = [
    {
        "title": "Sirrat al-Ilm: Notes on Seeking Knowledge",
        "slug": "notes-on-seeking-knowledge",
        "subtitle": "Adab, intention and the manners of the student",
        "category": "Religion",
        "language": "English",
        "pages": 96,
        "edition": "First edition",
        "published_on": date(2024, 3, 1),
        "tags": ["adab", "knowledge", "intention", "study"],
        "is_featured": True,
        "sort_order": 1,
        "description": (
            "The book this website is named after. A short, practical companion on the manners "
            "of the seeker: how to fix your intention before you open a book, how to sit with a "
            "teacher, how to take notes that survive ten years, and how to turn what you learn "
            "into action.\n\n"
            "Written in short chapters you can finish in one sitting — because knowledge that "
            "is never applied is a trust we will be asked about."
        ),
        "table_of_contents": [
            {"chapter": "01", "title": "Why we seek knowledge", "pages": "1—9"},
            {"chapter": "02", "title": "Intention before information", "pages": "10—19"},
            {"chapter": "03", "title": "The manners of the student", "pages": "20—31"},
            {"chapter": "04", "title": "Notebooks that outlive you", "pages": "32—45"},
            {"chapter": "05", "title": "Acting on what you learn", "pages": "46—59"},
            {"chapter": "06", "title": "Teaching it forward", "pages": "60—72"},
            {"chapter": "07", "title": "A weekly knowledge routine", "pages": "73—96"},
        ],
    },
    {
        "title": "The Quiet Code",
        "slug": "the-quiet-code",
        "subtitle": "Discipline for developers who feel behind",
        "category": "Self-improvement",
        "language": "English",
        "pages": 128,
        "edition": "Second edition",
        "published_on": date(2024, 9, 15),
        "tags": ["discipline", "habits", "career", "focus"],
        "is_featured": True,
        "sort_order": 2,
        "description": (
            "A field guide to consistency: why motivation is a bad project manager, how to build "
            "a practice that survives busy weeks, and how to measure progress in shipped work "
            "instead of hours watched.\n\n"
            "Includes the exact weekly template I use to balance deen, work and learning — plus "
            "a chapter on burnout written the hard way."
        ),
        "table_of_contents": [
            {"chapter": "01", "title": "Motivation is not a plan", "pages": "1—12"},
            {"chapter": "02", "title": "The minimum viable day", "pages": "13—27"},
            {"chapter": "03", "title": "Deep work for normal people", "pages": "28—44"},
            {"chapter": "04", "title": "Shipping beats perfection", "pages": "45—61"},
            {"chapter": "05", "title": "Burnout: early warning signs", "pages": "62—79"},
            {"chapter": "06", "title": "A weekly template for deen and code", "pages": "80—101"},
            {"chapter": "07", "title": "Reviewing your own year", "pages": "102—128"},
        ],
    },
    {
        "title": "Python from Zero",
        "slug": "python-from-zero",
        "subtitle": "A companion notebook for your first 100 hours",
        "category": "Programming",
        "language": "English",
        "pages": 184,
        "edition": "First edition",
        "published_on": date(2025, 1, 10),
        "tags": ["python", "beginner", "exercises", "backend"],
        "sort_order": 3,
        "description": (
            "The notebook version of the Python shelf on this site. Every chapter pairs a "
            "concept with runnable code, three exercises and one small project — from variables "
            "to FastAPI.\n\n"
            "Designed to be read with an editor open, not on a couch."
        ),
        "table_of_contents": [
            {"chapter": "01", "title": "Setup, terminals and your first script", "pages": "1—18"},
            {"chapter": "02", "title": "Types, operators and control flow", "pages": "19—42"},
            {"chapter": "03", "title": "Functions and modules", "pages": "43—64"},
            {"chapter": "04", "title": "Data structures in practice", "pages": "65—90"},
            {"chapter": "05", "title": "Objects, classes and composition", "pages": "91—116"},
            {"chapter": "06", "title": "Files, JSON and error handling", "pages": "117—138"},
            {"chapter": "07", "title": "Your first FastAPI service", "pages": "139—166"},
            {"chapter": "08", "title": "Testing and shipping", "pages": "167—184"},
        ],
    },
    {
        "title": "Ramadan Reset",
        "slug": "ramadan-reset",
        "subtitle": "30 days of small, permanent wins",
        "category": "Religion",
        "language": "English / Urdu",
        "pages": 74,
        "edition": "First edition",
        "published_on": date(2025, 2, 20),
        "tags": ["ramadan", "habits", "quran", "reflection"],
        "sort_order": 4,
        "description": (
            "A day-by-day workbook for Ramadan that focuses on one small change per day instead "
            "of an impossible list. Each day has a verse, a reflection, one action and one "
            "question to journal.\n\n"
            "The goal is not a perfect month — it is a month that changes the eleven after it."
        ),
        "table_of_contents": [
            {"chapter": "01", "title": "Before the moon is sighted", "pages": "1—8"},
            {"chapter": "02", "title": "Days 1—10: mercy and rhythm", "pages": "9—28"},
            {"chapter": "03", "title": "Days 11—20: forgiveness and focus", "pages": "29—48"},
            {"chapter": "04", "title": "Days 21—30: freedom and the last nights", "pages": "49—66"},
            {"chapter": "05", "title": "After Eid: keeping what you built", "pages": "67—74"},
        ],
    },
    {
        "title": "The Web Developer's Field Guide",
        "slug": "web-developers-field-guide",
        "subtitle": "HTML, CSS, JavaScript and React without the noise",
        "category": "Programming",
        "language": "English",
        "pages": 210,
        "edition": "First edition",
        "published_on": date(2025, 6, 5),
        "tags": ["web", "react", "css", "career"],
        "sort_order": 5,
        "description": (
            "What to learn, in what order, and what to ignore for the first two years. Includes "
            "the exact project ladder I give students: five builds that end with a deployed "
            "full-stack app.\n\n"
            "Half handbook, half opinion — with the reasoning shown."
        ),
        "table_of_contents": [
            {"chapter": "01", "title": "The map: what actually matters", "pages": "1—20"},
            {"chapter": "02", "title": "HTML & CSS you can rely on", "pages": "21—54"},
            {"chapter": "03", "title": "JavaScript: the language, not the framework", "pages": "55—92"},
            {"chapter": "04", "title": "React without the religion", "pages": "93—130"},
            {"chapter": "05", "title": "APIs, databases and auth", "pages": "131—168"},
            {"chapter": "06", "title": "The project ladder", "pages": "169—192"},
            {"chapter": "07", "title": "Portfolio, interviews and first job", "pages": "193—210"},
        ],
    },
    {
        "title": "Letters to a Young Learner",
        "slug": "letters-to-a-young-learner",
        "subtitle": "Advice I wish someone had sent me at 19",
        "category": "Life",
        "language": "English",
        "pages": 64,
        "edition": "First edition",
        "published_on": date(2026, 1, 18),
        "tags": ["life", "advice", "students", "letters"],
        "sort_order": 6,
        "description": (
            "Twenty short letters on study, friendship, money, faith and failure — written to "
            "the version of me that was trying to do everything at once.\n\n"
            "Read one letter a week. They are short on purpose."
        ),
        "table_of_contents": [
            {"chapter": "01", "title": "On being behind", "pages": "1—8"},
            {"chapter": "02", "title": "On teachers and mentors", "pages": "9—17"},
            {"chapter": "03", "title": "On money and skills", "pages": "18—27"},
            {"chapter": "04", "title": "On friends who pull you up", "pages": "28—38"},
            {"chapter": "05", "title": "On faith in hard years", "pages": "39—49"},
            {"chapter": "06", "title": "On failure and starting again", "pages": "50—64"},
        ],
    },
]


# --------------------------------------------------------------------------- #
# 4. Labs                                                                      #
# --------------------------------------------------------------------------- #
LAB_SEED: List[Dict[str, Any]] = [
    {
        "title": "Sirrat al-Ilm Knowledge Engine",
        "slug": "sirrat-al-ilm-platform",
        "category": "Full-stack",
        "availability_status": AvailabilityStatus.AVAILABLE.value,
        "summary": "This website: FastAPI + React + PostgreSQL with JWT auth, role-based admin and learning progress tracking.",
        "description": (
            "## What it is\n\n"
            "The platform you are reading this on. A production-shaped full-stack app: a typed "
            "FastAPI backend (SQLAlchemy 2.0, Pydantic v2, JWT) and a React + TypeScript front "
            "end built with Vite.\n\n"
            "## Why I built it\n\n"
            "Free content is everywhere; *remembered* content is rare. Every video, book and "
            "post on this site writes a progress row for the signed-in learner, so the dashboard "
            "always knows what was started and what was finished.\n\n"
            "## Interesting decisions\n\n"
            "- Passwords are hashed with PBKDF2-HMAC-SHA256 from the standard library: no native "
            "build step, and the cost factor travels inside the hash so it can be raised later.\n"
            "- Admin access is a role in the database *and* an e-mail allow-list from the "
            "environment, so the owner can never be locked out.\n"
            "- Book PDFs are generated at request time by a 200-line pure-Python writer — no "
            "binary assets to store or serve.\n"
            "- Placeholder artwork is deterministic SVG, so the site looks finished with zero "
            "external image dependencies."
        ),
        "tags": ["FastAPI", "React", "TypeScript", "PostgreSQL", "JWT", "Docker"],
        "is_featured": True,
        "sort_order": 1,
        "external_url": "https://github.com/forbidden-dev-void/Sirrat-al-Ilm",
        "gallery": [
            {"token": "sirrat-home", "label": "Landing page", "palette": "chocolate"},
            {"token": "sirrat-dashboard", "label": "User dashboard", "palette": "walnut"},
            {"token": "sirrat-admin", "label": "Admin console", "palette": "latte"},
            {"token": "sirrat-shelf", "label": "Video shelf", "palette": "cream"},
        ],
    },
    {
        "title": "Noor — Qur'an Revision Tracker",
        "slug": "noor-quran-tracker",
        "category": "Productivity",
        "availability_status": AvailabilityStatus.IN_PROGRESS.value,
        "summary": "A spaced-repetition planner for hifz: log what you recited, get reminded before you forget it.",
        "description": (
            "## The problem\n\n"
            "Memorisation decays on a predictable curve, but most people revise by feeling. Noor "
            "replaces feeling with a schedule.\n\n"
            "## How it works\n\n"
            "You log a page with a quality score (1—5). The app schedules the next revision using "
            "an SM-2 style interval, protects your Fajr slot for new memorisation, and shows a "
            "heat-map of consistency across the year.\n\n"
            "## Status\n\n"
            "Core scheduling engine and the offline-first UI are working; sync and family accounts "
            "are next."
        ),
        "tags": ["Spaced repetition", "Hifz", "Offline-first", "PWA"],
        "sort_order": 2,
        "gallery": [
            {"token": "noor-dashboard", "label": "Revision dashboard", "palette": "latte"},
            {"token": "noor-heatmap", "label": "Consistency heat map", "palette": "walnut"},
            {"token": "noor-schedule", "label": "Fajr slot planner", "palette": "chocolate"},
        ],
    },
    {
        "title": "Ilm Notes — Markdown Study Notebook",
        "slug": "ilm-notes",
        "category": "Tools",
        "availability_status": AvailabilityStatus.AVAILABLE.value,
        "summary": "A local-first notebook that turns lecture notes into linked, searchable knowledge.",
        "description": (
            "## What it is\n\n"
            "A markdown notebook with wiki-links, backlinks and full-text search. Files stay on "
            "your disk as plain ``.md`` — no lock-in, no subscription.\n\n"
            "## Design rules\n\n"
            "1. Everything is a file you can open in another editor.\n"
            "2. Linking is one keystroke; searching is instant.\n"
            "3. Export to PDF or HTML for sharing with a study circle.\n\n"
            "Built as a companion to the note-taking video on the Tools shelf."
        ),
        "tags": ["Markdown", "Local-first", "Search", "Export"],
        "sort_order": 3,
        "gallery": [
            {"token": "ilm-editor", "label": "Editor with backlinks", "palette": "cream"},
            {"token": "ilm-graph", "label": "Note graph", "palette": "walnut"},
            {"token": "ilm-export", "label": "PDF export", "palette": "latte"},
        ],
    },
    {
        "title": "Habit Compass — Ramadan Habit Stacker",
        "slug": "habit-compass",
        "category": "Self-improvement",
        "availability_status": AvailabilityStatus.AVAILABLE.value,
        "summary": "Anchor new habits to prayer times instead of clock times, with a 30-day streak view.",
        "description": (
            "## The idea\n\n"
            "Clock-based habit apps fail for people whose day is structured around salah. Habit "
            "Compass anchors each habit to an anchor event: after Fajr, before Maghrib, after "
            "Isha.\n\n"
            "## What shipped\n\n"
            "- Prayer-time aware scheduling with city selection\n"
            "- Streaks that forgive one missed day per week (a mercy rule)\n"
            "- Weekly review that writes a markdown summary you can paste into your journal\n\n"
            "Companion project to the book *Ramadan Reset*."
        ),
        "tags": ["Habits", "Prayer times", "Streaks", "Mobile web"],
        "sort_order": 4,
        "gallery": [
            {"token": "habit-today", "label": "Today view", "palette": "chocolate"},
            {"token": "habit-streak", "label": "30-day streak", "palette": "latte"},
            {"token": "habit-review", "label": "Weekly review", "palette": "cream"},
        ],
    },
    {
        "title": "Masjid Map — Prayer Times & Qibla API",
        "slug": "masjid-map-api",
        "category": "Backend",
        "availability_status": AvailabilityStatus.IN_PROGRESS.value,
        "summary": "A tiny, fast JSON API for prayer times, qibla bearing and nearby masjids.",
        "description": (
            "## Why\n\n"
            "Most prayer-time integrations are heavyweight or unreliable. This is a single FastAPI "
            "service that answers in a few milliseconds from a pre-computed table.\n\n"
            "## Endpoints\n\n"
            "- ``GET /times?lat=&lon=&date=`` — five daily times for any coordinate\n"
            "- ``GET /qibla?lat=&lon=`` — bearing in degrees\n"
            "- ``GET /masjids?lat=&lon=&radius=`` — nearest masjids with jumu'ah times\n\n"
            "## Notes\n\n"
            "Calculation methods are configurable (MWL, ISNA, Umm al-Qura, Karachi). The Karachi "
            "method is the default for this project's audience."
        ),
        "tags": ["API", "Astronomy", "PostGIS", "Caching"],
        "sort_order": 5,
        "gallery": [
            {"token": "masjid-docs", "label": "API documentation", "palette": "walnut"},
            {"token": "masjid-map", "label": "Masjid map", "palette": "latte"},
        ],
    },
    {
        "title": "Code Sutra — Python Practice Arena",
        "slug": "code-sutra",
        "category": "Education",
        "availability_status": AvailabilityStatus.AVAILABLE.value,
        "summary": "Beginner Python drills with instant feedback, built from the Python from Zero chapters.",
        "description": (
            "## What it is\n\n"
            "A browser practice arena: 120 small Python problems grouped by the chapters of "
            "*Python from Zero*, with tests that run in the browser and hints that never give the "
            "answer away.\n\n"
            "## Teaching philosophy\n\n"
            "Each problem has three levels of hint — a nudge, a direction, and a skeleton — so "
            "students struggle productively instead of copy-pasting.\n\n"
            "## Stack\n\n"
            "Pyodide for in-browser execution, React for the shell, and the same progress API as "
            "this site so completion carries over."
        ),
        "tags": ["Python", "Pyodide", "Exercises", "Teaching"],
        "sort_order": 6,
        "gallery": [
            {"token": "sutra-problem", "label": "Problem view", "palette": "chocolate"},
            {"token": "sutra-hints", "label": "Hint ladder", "palette": "cream"},
            {"token": "sutra-progress", "label": "Chapter progress", "palette": "latte"},
        ],
    },
]


# --------------------------------------------------------------------------- #
# 5. Blog posts                                                                #
# --------------------------------------------------------------------------- #
POST_SEED: List[Dict[str, Any]] = [
    {
        "title": "The adab of opening a book",
        "slug": "the-adab-of-opening-a-book",
        "category": "religion",
        "excerpt": (
            "Before the first page there is an intention. Three short practices that changed how "
            "I read — and how much of it stayed."
        ),
        "reading_minutes": 6,
        "tags": ["adab", "knowledge", "reading"],
        "is_featured": True,
        "days_ago": 4,
        "body": (
            "The classical scholars wrote whole books about the manners of the student before they "
            "wrote about the subject itself. That always struck me as inefficient — until I counted "
            "how many books I had started and abandoned.\n\n"
            "## 1. Name the intention out loud\n\n"
            "Not \"I should read this\". Something closer to: *I am reading this chapter to understand "
            "one thing, and I intend to act on it this week.* An intention you can name is an "
            "intention you can check later.\n\n"
            "## 2. Read less, twice\n\n"
            "Ten pages read once is a screenshot. Ten pages read twice — once for the argument, once "
            "for what it demands of you — is knowledge. The second pass is where the barakah lives.\n\n"
            "## 3. Write one sentence of your own\n\n"
            "At the end of every session I write one sentence that did not exist before: my summary, "
            "my objection, my next action. If I cannot write it, I did not understand it. That "
            "sentence goes into the notebook, and the notebook is what I actually revise.\n\n"
            "None of this is slow. It is the only reading that compounds.\n\n"
            "*This post expands chapter 3 of Notes on Seeking Knowledge — free in the library.*"
        ),
    },
    {
        "title": "Why I chose FastAPI + React (and not a framework-of-the-month)",
        "slug": "why-fastapi-and-react",
        "category": "tech",
        "excerpt": (
            "A boring stack, chosen on purpose: typed Python, typed TypeScript, PostgreSQL, and "
            "no server-side rendering complexity I did not need."
        ),
        "reading_minutes": 8,
        "tags": ["fastapi", "react", "architecture", "postgresql"],
        "is_featured": True,
        "days_ago": 9,
        "body": (
            "Every project starts with a stack argument. Here is the one I had with myself, and how "
            "it ended.\n\n"
            "## Requirements, honestly written\n\n"
            "1. Authentication with roles: one owner, many learners.\n"
            "2. Content CRUD from an admin panel I control.\n"
            "3. Per-user progress tracking with a dashboard.\n"
            "4. Deployable by one person, on a small budget, with Docker.\n\n"
            "Notice what is missing: SEO-critical marketing pages, real-time collaboration, offline "
            "mobile. Those are the things that would have justified a heavier architecture.\n\n"
            "## What the stack became\n\n"
            "- **FastAPI** — Pydantic gives me one source of truth for validation, and the OpenAPI "
            "docs are free.\n"
            "- **SQLAlchemy 2.0** — typed models, portable across SQLite (dev) and PostgreSQL (prod).\n"
            "- **React + Vite + TypeScript** — fast builds, and the type system catches the mistakes "
            "I make at 1 a.m.\n"
            "- **JWT in memory, refresh in localStorage** — simple, and honest about its trade-offs.\n\n"
            "## The trade-off I accepted\n\n"
            "The whole site sits behind sign-in, so there is no crawlable content. For a personal "
            "library that is a feature: it keeps the reading experience private and the analytics "
            "meaningful. When I want public articles later, I will add a thin public layer — not "
            "rewrite the app.\n\n"
            "Boring technology is a choice you make on purpose, so you can spend your creativity on "
            "the content instead of the plumbing."
        ),
    },
    {
        "title": "Six months of shipping one thing a week",
        "slug": "six-months-one-thing-a-week",
        "category": "life",
        "excerpt": (
            "What a small, weekly promise did to my confidence, my code and my calendar — including "
            "the weeks I failed."
        ),
        "reading_minutes": 5,
        "tags": ["habits", "consistency", "life update"],
        "days_ago": 15,
        "body": (
            "The rule was simple: every Friday, publish one thing. A post, a feature, a chapter, a "
            "recording. Small enough to survive a bad week, public enough that I could not quietly "
            "drop it.\n\n"
            "## What worked\n\n"
            "Volume killed perfectionism. By week nine I stopped rewriting openings four times, "
            "because there was always another Friday coming.\n\n"
            "## What did not\n\n"
            "Weeks 12 and 13 I shipped almost nothing — travel, family, and a stubborn bug. The "
            "system only survived because I had already decided, in advance, that missing one week "
            "is allowed and missing two is a signal to shrink the promise. So the promise shrank to "
            "\"one paragraph\" for two weeks, and then grew back.\n\n"
            "## The number that mattered\n\n"
            "Not streaks. The ratio of weeks where I published to weeks where I planned to: 22 of "
            "26. That is a system, not luck.\n\n"
            "If you want a version of this, the Habit Compass lab in the Labs section is the tool I "
            "built for it."
        ),
    },
    {
        "title": "A study path for absolute beginners: 12 weeks to a deployed app",
        "slug": "12-week-beginner-path",
        "category": "programming",
        "excerpt": (
            "The exact order I teach — Python, then the browser, then React, then an API — with the "
            "free courses from the programming shelf mapped to each week."
        ),
        "reading_minutes": 10,
        "tags": ["learning path", "python", "javascript", "react"],
        "is_featured": True,
        "days_ago": 21,
        "body": (
            "Most beginners do not have an information problem. They have an ordering problem. Here "
            "is the order.\n\n"
            "## Weeks 1—4: Python for thinking\n\n"
            "Dave Gray's full course, chapters 1—14. Goal: write 300 lines a week without looking up "
            "a loop. Deliverable: a CLI quiz that stores scores in a JSON file.\n\n"
            "## Weeks 5—7: HTML & CSS for structure\n\n"
            "SuperSimpleDev's HTML/CSS course. Goal: build a layout from a screenshot without a "
            "template. Deliverable: a one-page personal site.\n\n"
            "## Weeks 8—10: JavaScript for behaviour\n\n"
            "SuperSimpleDev's JavaScript course plus the DOM chapters. Deliverable: make that "
            "personal site interactive — theme toggle, filterable project list.\n\n"
            "## Weeks 11—12: React + an API\n\n"
            "freeCodeCamp's React course, first four projects, then a FastAPI backend with three "
            "endpoints. Deliverable: deploy it. A live URL you can send to someone is worth ten "
            "local tutorials.\n\n"
            "## The rule underneath all of it\n\n"
            "Every week ends with something that runs. Mark each course complete on the programming "
            "shelf and your dashboard will show you the ladder you have already climbed."
        ),
    },
    {
        "title": "How the free library works (and why it stays free)",
        "slug": "how-the-free-library-works",
        "category": "books",
        "excerpt": (
            "No paywall, no email funnel, no ads. A short explanation of how the books are made, "
            "distributed and paid for."
        ),
        "reading_minutes": 4,
        "tags": ["books", "open knowledge", "behind the scenes"],
        "days_ago": 30,
        "body": (
            "People ask how a free library survives. Short answer: it costs almost nothing to run, "
            "and it returns things money cannot.\n\n"
            "## The mechanics\n\n"
            "Books are written in markdown, assembled into PDFs by this site's own generator, and "
            "served straight from the API. There is no print run, no warehouse and no distributor. "
            "Hosting is a single small container with a PostgreSQL database.\n\n"
            "## Why no paywall\n\n"
            "Knowledge I benefited from was given to me freely — by teachers who were not paid, by "
            "books that were passed around, by videos that cost nothing to watch. Charging for the "
            "same material would break the chain.\n\n"
            "## What I ask instead\n\n"
            "Read it, use it, tell one person. If a chapter helps you, send it to the friend who "
            "needs it. That is the entire business model."
        ),
    },
    {
        "title": "Notes on focus: the four-hour window",
        "slug": "notes-on-focus-four-hour-window",
        "category": "life",
        "excerpt": (
            "A realistic deep-work setup for people with jobs, families and five daily prayers — "
            "built around anchors, not willpower."
        ),
        "reading_minutes": 7,
        "tags": ["focus", "deep work", "productivity"],
        "days_ago": 42,
        "body": (
            "I do not have eight uninterrupted hours. Nobody I know does. What I have is a "
            "four-hour window, defended like a meeting.\n\n"
            "## Anchor, do not schedule\n\n"
            "The window is anchored to Fajr, not to 09:00. Anchors survive travel, daylight saving "
            "and bad sleep; clock times do not.\n\n"
            "## One input before the window\n\n"
            "No feeds, no messages, no news before the first block. The mind spends its sharpest "
            "minutes on whatever it touched first — I would rather that be my own work.\n\n"
            "## Two blocks, one review\n\n"
            "Ninety minutes on the hardest task, a short break with no screen, seventy minutes on "
            "the second, then ten minutes writing what is true now and what is next. That last part "
            "is what makes tomorrow fast.\n\n"
            "## The mercy rule\n\n"
            "One missed day per week is planned, not failed. Systems without forgiveness get "
            "abandoned after the first bad week."
        ),
    },
]


# --------------------------------------------------------------------------- #
# Seeding functions                                                            #
# --------------------------------------------------------------------------- #
def seed_shelves(db: Session) -> int:
    """Create the YouTube shelves + their resources once."""
    existing = db.execute(select(func.count()).select_from(Shelf)).scalar_one()
    if existing:
        return 0

    created = 0
    for shelf_data in SHELF_SEED:
        resources_data: List[Dict[str, Any]] = shelf_data.pop("resources", [])
        shelf = Shelf(**shelf_data)
        db.add(shelf)
        db.flush()  # need shelf.id for the resources

        for index, resource in enumerate(resources_data):
            token = f"{shelf.slug}-{index + 1}"
            db.add(
                Resource(
                    shelf_id=shelf.id,
                    thumbnail_url=youtube_thumbnail(
                        resource.get("video_id"), token, resource["title"][:40]
                    ),
                    **resource,
                )
            )
            created += 1
        shelf_data["resources"] = resources_data  # keep the seed constant intact
    db.commit()
    return created


def seed_books(db: Session) -> int:
    """Create the free books once (downloads are generated on demand)."""
    existing = db.execute(select(func.count()).select_from(Book)).scalar_one()
    if existing:
        return 0

    for data in BOOK_SEED:
        slug = data.get("slug") or unique_slug(db, Book, data["title"])
        book = Book(
            slug=slug,
            cover_url=artwork_url(f"book-{slug}", label=data["title"][:34], palette="chocolate"),
            file_url=f"/api/books/{slug}/download",
            download_count=0,
            **{key: value for key, value in data.items() if key != "slug"},
        )
        db.add(book)
    db.commit()
    return len(BOOK_SEED)


def seed_labs(db: Session, owner: User) -> int:
    """Create Lab listings (Items) with gallery placeholder artwork."""
    existing = db.execute(select(func.count()).select_from(Item)).scalar_one()
    if existing:
        return 0

    for data in LAB_SEED:
        payload = dict(data)
        gallery_tokens: List[Dict[str, str]] = payload.pop("gallery", [])
        slug = payload.get("slug") or unique_slug(db, Item, payload["title"])
        gallery = [
            {
                "url": artwork_url(entry["token"], label=entry.get("label", ""), palette=entry.get("palette")),
                "caption": entry.get("label", ""),
                "alt": entry.get("label", payload["title"]),
            }
            for entry in gallery_tokens
        ]
        db.add(
            Item(
                owner_id=owner.id,
                slug=slug,
                image_url=artwork_url(f"lab-{slug}", label=payload["title"][:32], palette="walnut"),
                gallery=gallery,
                **{key: value for key, value in payload.items() if key != "slug"},
            )
        )
    db.commit()
    return len(LAB_SEED)


def seed_posts(db: Session, author: User) -> int:
    """Create blog posts once, with staggered publish dates."""
    existing = db.execute(select(func.count()).select_from(BlogPost)).scalar_one()
    if existing:
        return 0

    now = datetime.now(timezone.utc)
    for data in POST_SEED:
        payload = dict(data)
        days_ago = payload.pop("days_ago", 0)
        slug = payload.get("slug") or unique_slug(db, BlogPost, payload["title"])
        db.add(
            BlogPost(
                author_id=author.id,
                slug=slug,
                cover_image=artwork_url(f"post-{slug}", label=payload["title"][:30], palette="latte"),
                published_at=now - timedelta(days=days_ago),
                view_count=(days_ago * 7) + 23,
                **{key: value for key, value in payload.items() if key != "slug"},
            )
        )
    db.commit()
    return len(POST_SEED)


def seed_demo_progress(db: Session, user: User) -> int:
    """Give the demo learner a realistic, partially-completed history."""
    existing = db.execute(
        select(func.count()).select_from(ProgressEntry).where(ProgressEntry.user_id == user.id)
    ).scalar_one()
    if existing:
        return 0

    now = datetime.now(timezone.utc)
    created = 0

    videos = db.execute(
        select(Resource).join(Shelf).order_by(Resource.sort_order).limit(40)
    ).scalars().all()
    # A believable spread: two finished, four in progress, rest untouched.
    plan = {0: 100, 1: 100, 2: 64, 3: 38, 4: 22, 5: 12}
    for index, percent in plan.items():
        if index >= len(videos):
            break
        video = videos[index]
        created += _upsert_demo(
            db,
            user,
            resource_type="video",
            resource_id=video.id,
            title=video.title,
            slug=video.shelf.slug,
            percent=percent,
            meta={
                "thumbnail_url": video.thumbnail_url,
                "external_url": video.external_url,
                "channel": video.channel,
                "duration_label": video.duration_label,
                "shelf": video.shelf.title,
            },
            accessed=now - timedelta(days=index * 2, hours=index),
        )

    books = db.execute(select(Book).order_by(Book.sort_order).limit(6)).scalars().all()
    for index, percent in {0: 100, 1: 45, 3: 20}.items():
        if index >= len(books):
            break
        book = books[index]
        created += _upsert_demo(
            db,
            user,
            resource_type="book",
            resource_id=book.id,
            title=book.title,
            slug=book.slug,
            percent=percent,
            meta={"cover_url": book.cover_url, "category": book.category, "pages": book.pages},
            accessed=now - timedelta(days=index + 1, hours=5),
        )

    posts = db.execute(select(BlogPost).order_by(BlogPost.published_at.desc()).limit(3)).scalars().all()
    for index, post in enumerate(posts):
        created += _upsert_demo(
            db,
            user,
            resource_type="blog",
            resource_id=post.id,
            title=post.title,
            slug=post.slug,
            percent=100 if index < 2 else 55,
            meta={"category": post.category, "reading_minutes": post.reading_minutes},
            accessed=now - timedelta(hours=index * 9 + 2),
        )

    db.commit()
    return created


def _upsert_demo(
    db: Session,
    user: User,
    *,
    resource_type: str,
    resource_id: int,
    title: str,
    slug: Optional[str],
    percent: int,
    meta: Dict[str, Any],
    accessed: datetime,
) -> int:
    """Insert one demo progress row (returns 1 when created)."""
    status = "completed" if percent >= 100 else ("in_progress" if percent > 0 else "not_started")
    db.add(
        ProgressEntry(
            user_id=user.id,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_title=title,
            resource_slug=slug,
            meta=meta,
            status=status,
            progress_percent=percent,
            completed_at=accessed if percent >= 100 else None,
            last_accessed_at=accessed,
        )
    )
    return 1


def bootstrap_database(db: Session, *, seed: bool = True) -> Dict[str, Any]:
    """
    Full first-run bootstrap: owner account, site copy and content.

    Returns a summary dict so the CLI and the startup log can report it.
    """
    summary: Dict[str, Any] = {"admin": None, "resources": 0, "books": 0, "labs": 0, "posts": 0}

    admin = ensure_admin(db)
    summary["admin"] = admin.email

    # Persist the editable hero/about defaults so Admin -> Site content works.
    get_setting(db, HERO_KEY, DEFAULT_HERO)
    get_setting(db, ABOUT_KEY, DEFAULT_ABOUT)

    if seed:
        summary["resources"] = seed_shelves(db)
        summary["books"] = seed_books(db)
        summary["labs"] = seed_labs(db, admin)
        summary["posts"] = seed_posts(db, admin)
        if settings.demo_account_enabled:
            demo_user = ensure_demo_learner(db)
            if demo_user is not None:
                summary["demo_progress"] = seed_demo_progress(db, demo_user)

    logger.info(
        "Bootstrap complete (admin=%s, resources=%s, books=%s, labs=%s, posts=%s)",
        summary["admin"],
        summary["resources"],
        summary["books"],
        summary["labs"],
        summary["posts"],
    )
    return summary
