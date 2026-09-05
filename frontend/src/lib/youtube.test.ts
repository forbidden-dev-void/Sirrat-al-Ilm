/**
 * Unit tests for the YouTube helpers.
 *
 * The admin shelf form accepts whatever an admin pastes, so every common URL
 * shape has to resolve to the same 11-character video id — otherwise cards end
 * up without thumbnails or without a working "Watch on YouTube" link.
 */

import { describe, expect, it } from 'vitest';
import { parseYouTubeId, youTubeThumbnailUrl, youTubeWatchUrl } from './youtube';

describe('parseYouTubeId', () => {
  it('reads the id out of every common URL shape', () => {
    const cases: [string, string][] = [
      ['https://www.youtube.com/watch?v=H2EJuAcrZYU', 'H2EJuAcrZYU'],
      ['https://youtube.com/watch?v=XKHEtdqhLK8&t=120s', 'XKHEtdqhLK8'],
      ['https://www.youtube.com/watch?v=629isa8LujE&list=PLg-019lJ_yZt', '629isa8LujE'],
      ['https://youtu.be/EerdGm-ehJQ', 'EerdGm-ehJQ'],
      ['https://www.youtube.com/embed/bMknfKXIFA8', 'bMknfKXIFA8'],
      ['https://www.youtube.com/shorts/jtL650KaUFI', 'jtL650KaUFI'],
      ['https://www.youtube.com/live/NBPBSLr5j5E?feature=share', 'NBPBSLr5j5E'],
      ['http://m.youtube.com/watch?v=G3e-cpL7ofc', 'G3e-cpL7ofc'],
    ];

    for (const [url, id] of cases) {
      expect(parseYouTubeId(url)).toBe(id);
    }
  });

  it('accepts a bare id and ignores surrounding whitespace', () => {
    expect(parseYouTubeId('  H2EJuAcrZYU ')).toBe('H2EJuAcrZYU');
  });

  it('returns null rather than guessing', () => {
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
    expect(parseYouTubeId(undefined)).toBeNull();
    expect(parseYouTubeId('https://vimeo.com/76979871')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/playlist?list=PLg-019lJ')).toBeNull();
    expect(parseYouTubeId('too-short')).toBeNull();
  });
});

describe('url builders', () => {
  it('builds a canonical watch link', () => {
    expect(youTubeWatchUrl('H2EJuAcrZYU')).toBe('https://www.youtube.com/watch?v=H2EJuAcrZYU');
  });

  it('uses the thumbnail size that always exists', () => {
    expect(youTubeThumbnailUrl('H2EJuAcrZYU')).toBe(
      'https://img.youtube.com/vi/H2EJuAcrZYU/hqdefault.jpg',
    );
  });

  it('round-trips: parse then rebuild returns the same video', () => {
    const id = parseYouTubeId('https://youtu.be/EerdGm-ehJQ');
    expect(id).not.toBeNull();
    expect(parseYouTubeId(youTubeWatchUrl(id as string))).toBe(id);
  });
});
