"""
Placeholder artwork generator (SVG)
===================================

The brief asks for "image gallery placeholders". Instead of shipping binary
images or linking to a third-party placeholder service (which breaks offline
and leaks user IPs), the API renders deterministic SVG artwork on the fly:

* same ``token`` -> same colours, same geometry (cacheable, reproducible)
* palette comes from the Sirrat al-Ilm design tokens
* crisp at any size, a few hundred bytes, and works with no network access

Used for lab galleries, book covers, blog covers and shelf artwork.
"""

from __future__ import annotations

import hashlib
from typing import List, Tuple
from urllib.parse import unquote

# Design tokens (hex) from the brief's colour palette.
PALETTES: dict[str, List[Tuple[str, str]]] = {
    "linen": [("#EFEAE2", "#E2DACF")],
    "chocolate": [("#3E1E12", "#5C463C")],
    "walnut": [("#5C463C", "#A48675")],
    "latte": [("#A48675", "#EFEAE2")],
    "cream": [("#F7F3EE", "#E2DACF")],
}

_DEFAULT_TEXT = "#F7F3EE"


def _hash_ints(token: str, count: int) -> List[int]:
    """Deterministic pseudo-random integers in [0, 1000) derived from ``token``."""
    digest = hashlib.sha256(token.encode("utf-8")).digest()
    values: List[int] = []
    for index in range(count):
        chunk = digest[(index * 2) % len(digest) - 2 :] + digest[: (index % 4)]
        values.append(int.from_bytes(hashlib.blake2b(chunk, digest_size=2).digest(), "big") % 1000)
    return values


def _escape_xml(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def build_artwork_svg(
    token: str,
    *,
    label: str | None = None,
    width: int = 800,
    height: int = 500,
    palette: str | None = None,
) -> bytes:
    """Return an SVG document for ``token`` (used as an <img> source)."""
    token = unquote(token or "sirrat")
    numbers = _hash_ints(token, 8)

    palette_name = palette or list(PALETTES)[numbers[0] % len(PALETTES)]
    start, end = PALETTES.get(palette_name, PALETTES["walnut"])[0]
    gradient_id = f"g{numbers[1] % 997}"
    angle = 20 + (numbers[2] % 120)

    caption = _escape_xml(label or token.replace("-", " ").replace("_", " ").title())[:52]
    initials = "".join(part[0].upper() for part in caption.split()[:2]) or "SA"

    # A few soft circles give each tile a unique but calm "editorial" feel.
    blobs = "".join(
        f'<circle cx="{(numbers[i] % 100) * width // 100}" cy="{(numbers[i + 1] % 100) * height // 100}" '
        f'r="{60 + numbers[i + 2] % 110}" fill="#F7F3EE" opacity="{0.04 + (numbers[i + 3] % 7) / 100:.2f}" />'
        for i in range(0, 4)
    )

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{caption}">
  <defs>
    <linearGradient id="{gradient_id}" gradientTransform="rotate({angle} 0.5 0.5)">
      <stop offset="0%" stop-color="{start}" />
      <stop offset="100%" stop-color="{end}" />
    </linearGradient>
  </defs>
  <rect width="{width}" height="{height}" fill="url(#{gradient_id})" />
  {blobs}
  <g font-family="Georgia, 'Playfair Display', serif">
    <text x="{width / 2:.0f}" y="{height / 2 - 6:.0f}" font-size="{min(96, width // 7)}" fill="{_DEFAULT_TEXT}" opacity="0.92" text-anchor="middle" letter-spacing="4">{initials}</text>
    <text x="{width / 2:.0f}" y="{height / 2 + 52:.0f}" font-size="{max(15, width // 44)}" fill="{_DEFAULT_TEXT}" opacity="0.78" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif">{caption}</text>
  </g>
  <rect x="0.5" y="0.5" width="{width - 1}" height="{height - 1}" fill="none" stroke="#E2DACF" stroke-opacity="0.35" />
</svg>
""".encode("utf-8")
    return svg


def artwork_url(token: str, *, label: str | None = None, palette: str | None = None) -> str:
    """Helper used by the seed data to build a stable artwork URL."""
    query: List[str] = []
    if label:
        query.append(f"label={label}")
    if palette:
        query.append(f"palette={palette}")
    suffix = f"?{'&'.join(query)}" if query else ""
    return f"/api/media/art/{token}.svg{suffix}"
