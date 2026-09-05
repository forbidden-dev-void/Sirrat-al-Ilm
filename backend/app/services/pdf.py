"""
Tiny, dependency-free PDF writer
================================

Sirrat al-Ilm gives away free books, so the "Download PDF" button must really
produce a PDF. Rather than pulling in a heavy binary dependency (reportlab /
weasyprint), this module emits a valid **PDF 1.4** file by hand:

* base-14 fonts only (Helvetica + Helvetica-Bold) -> nothing to embed
* one page per chapter, plus cover / about / contents pages
* correct xref offsets so every reader (Chrome, Preview, Acrobat) accepts it

Only ASCII Latin-1 text is supported; anything else is transliterated, because
base-14 fonts use the WinAnsi encoding.
"""

from __future__ import annotations

import unicodedata
from typing import Iterable, List, Sequence, Tuple

PAGE_WIDTH = 595.0   # A4 portrait in points
PAGE_HEIGHT = 842.0
MARGIN = 64.0

# Chocolate / walnut / latte palette from the design system.
COLOUR_TITLE: Tuple[float, float, float] = (0.243, 0.118, 0.071)   # #3E1E12
COLOUR_BODY: Tuple[float, float, float] = (0.361, 0.275, 0.235)    # #5C463C
COLOUR_ACCENT: Tuple[float, float, float] = (0.643, 0.525, 0.459)  # #A48675


def _ascii(text: str) -> str:
    """Fold unicode to the closest WinAnsi-safe characters."""
    folded = unicodedata.normalize("NFKD", text or "")
    folded = folded.encode("ascii", "ignore").decode("ascii")
    return folded.replace("\r", " ")


def _escape(text: str) -> str:
    """Escape the three special characters inside a PDF literal string."""
    return _ascii(text).replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def _wrap(text: str, max_chars: int) -> List[str]:
    """Greedy word wrap that keeps the layout predictable without font metrics."""
    words = _ascii(text).split()
    lines: List[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            # Very long single words are hard-split so they never overflow.
            while len(word) > max_chars:
                lines.append(word[:max_chars])
                word = word[max_chars:]
            current = word
    if current:
        lines.append(current)
    return lines or [""]


class _Line:
    """One styled line of text on a page."""

    __slots__ = ("text", "size", "bold", "gap", "colour", "indent")

    def __init__(
        self,
        text: str,
        size: float = 11,
        *,
        bold: bool = False,
        gap: float = 8,
        colour: Tuple[float, float, float] = COLOUR_BODY,
        indent: float = 0,
    ) -> None:
        self.text = text
        self.size = size
        self.bold = bold
        self.gap = gap
        self.colour = colour
        self.indent = indent


def _content_stream(lines: Sequence[_Line]) -> bytes:
    """Render lines into a PDF page content stream."""
    out: List[str] = []
    y = PAGE_HEIGHT - MARGIN - 20
    max_chars_by_size = {9: 96, 10: 88, 11: 78, 12: 72, 14: 60, 18: 46, 26: 32, 30: 27}
    for line in lines:
        wrap_at = max_chars_by_size.get(int(line.size), 74)
        for index, wrapped in enumerate(_wrap(line.text, wrap_at)):
            if y < MARGIN:  # page overflow guard (callers paginate themselves)
                break
            r, g, b = line.colour
            font = "/F2" if line.bold else "/F1"
            indent = line.indent if index == 0 else line.indent + 10
            out.append(f"{r:.3f} {g:.3f} {b:.3f} rg")
            out.append("BT")
            out.append(f"{font} {line.size:.1f} Tf")
            out.append(f"1 0 0 1 {MARGIN + indent:.1f} {y:.1f} Tm")
            out.append(f"({_escape(wrapped)}) Tj")
            out.append("ET")
            y -= line.size * 0.45 + (line.gap if index == 0 else line.gap * 0.55)
        y -= 2
    return ("\n".join(out) + "\n").encode("latin-1", "ignore")


def _paginate(pages: Iterable[Sequence[_Line]]) -> List[bytes]:
    return [_content_stream(page) for page in pages]


def build_pdf(pages: Iterable[Sequence[_Line]], *, title: str, author: str) -> bytes:
    """Assemble a complete PDF document from styled page content."""
    streams = _paginate(pages)
    objects: List[bytes] = []

    font_regular_id = 3
    font_bold_id = 4
    pages_id = 2
    first_page_id = 5

    page_ids = [first_page_id + (2 * i) for i in range(len(streams))]
    content_ids = [pid + 1 for pid in page_ids]

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects.append(
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("latin-1")
    )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    objects.append(
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
    )

    for pid, cid, stream in zip(page_ids, content_ids, streams):
        objects.append(
            (
                f"<< /Type /Page /Parent {pages_id} 0 R "
                f"/MediaBox [0 0 {PAGE_WIDTH:.0f} {PAGE_HEIGHT:.0f}] "
                f"/Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R >> >> "
                f"/Contents {cid} 0 R >>"
            ).encode("latin-1")
        )
        objects.append(
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"\nendstream"
        )

    body = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: List[int] = []
    for number, payload in enumerate(objects, start=1):
        offsets.append(len(body))
        body += f"{number} 0 obj\n".encode("latin-1") + payload + b"\nendobj\n"

    xref_start = len(body)
    body += f"xref\n0 {len(objects) + 1}\n".encode("latin-1")
    body += b"0000000000 65535 f \n"
    for offset in offsets:
        body += f"{offset:010d} 00000 n \n".encode("latin-1")
    body += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R /Info << /Title ({_escape(title)}) "
        f"/Author ({_escape(author)}) /Producer (Sirrat al-Ilm) >> >>\n"
        f"startxref\n{xref_start}\n%%EOF\n"
    ).encode("latin-1")
    return bytes(body)


def build_book_pdf(
    *,
    title: str,
    subtitle: str | None,
    author: str,
    description: str,
    language: str,
    pages: int | None,
    edition: str | None,
    table_of_contents: Sequence[dict],
) -> bytes:
    """Compose the free-download book PDF (cover, about, contents, chapters)."""
    document: List[List[_Line]] = []

    # --- Cover -------------------------------------------------------------
    cover: List[_Line] = [
        _Line("SIRRAT AL-ILM", 10, bold=True, colour=COLOUR_ACCENT, gap=34),
        _Line(title, 26, bold=True, colour=COLOUR_TITLE, gap=14),
    ]
    if subtitle:
        cover.append(_Line(subtitle, 14, colour=COLOUR_ACCENT, gap=26))
    cover += [
        _Line(f"by {author}", 12, colour=COLOUR_BODY, gap=10),
        _Line(edition or "First edition", 10, colour=COLOUR_ACCENT, gap=10),
        _Line(f"Language: {language}" + (f"   |   {pages} pages" if pages else ""), 10, colour=COLOUR_ACCENT),
    ]
    document.append(cover)

    # --- About this book ---------------------------------------------------
    about: List[_Line] = [
        _Line("About this book", 18, bold=True, colour=COLOUR_TITLE, gap=16),
    ]
    for paragraph in [p.strip() for p in (description or "").split("\n\n") if p.strip()]:
        about.append(_Line(paragraph, 11, gap=14))
    about.append(
        _Line(
            "This book is free to read, share and print. If it benefits you, "
            "share it with someone who needs it.",
            10,
            colour=COLOUR_ACCENT,
            gap=10,
        )
    )
    document.append(about)

    # --- Contents ----------------------------------------------------------
    contents: List[_Line] = [_Line("Contents", 18, bold=True, colour=COLOUR_TITLE, gap=16)]
    if table_of_contents:
        for entry in table_of_contents:
            chapter = str(entry.get("chapter", "")).strip()
            entry_title = str(entry.get("title", "")).strip()
            page_label = str(entry.get("pages", "")).strip()
            label = f"{chapter}  {entry_title}".strip()
            if page_label:
                label = f"{label}  —  {page_label}"
            contents.append(_Line(label, 11, gap=10))
    else:
        contents.append(_Line("Chapters will be listed here.", 11))
    document.append(contents)

    # --- One page per chapter ---------------------------------------------
    for entry in table_of_contents:
        chapter = str(entry.get("chapter", "")).strip()
        entry_title = str(entry.get("title", "")).strip()
        document.append(
            [
                _Line(chapter, 10, bold=True, colour=COLOUR_ACCENT, gap=12),
                _Line(entry_title, 18, bold=True, colour=COLOUR_TITLE, gap=18),
                _Line(
                    f"Notes for '{entry_title}' will appear in the published edition. "
                    "This downloadable preview keeps the structure of the book so readers "
                    "can follow along while the full manuscript is prepared.",
                    11,
                    gap=12,
                ),
            ]
        )

    return build_pdf(document, title=title, author=author)
