/**
 * SiteContentManager — edit the landing page copy without a redeploy.
 *
 * Two independent forms (hero + About) because they are stored as separate
 * JSON settings on the server. Everything typed here is validated by Pydantic
 * on the way in, so a malformed payload is rejected with field-level messages.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { validateRequired } from '../../lib/validation';
import type { About, EducationEntry, ExperienceEntry, Hero, SocialLink } from '../../types';
import { Button } from '../ui/Button';
import { TextAreaField, TextField } from '../ui/Field';
import { ErrorState, PageLoader } from '../ui/States';

interface FactRow {
  key: string;
  value: string;
}

export function SiteContentManager(): JSX.Element {
  const { success, error: notifyError } = useToast();

  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const [hero, setHero] = useState<Hero | null>(null);
  const [about, setAbout] = useState<About | null>(null);

  const [skills, setSkills] = useState('');
  const [languages, setLanguages] = useState('');
  const [facts, setFacts] = useState<FactRow[]>([]);

  const [savingHero, setSavingHero] = useState(false);
  const [savingAbout, setSavingAbout] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setFailure(null);
      try {
        const content = await adminApi.siteContent();
        if (cancelled) return;
        setHero(content.hero);
        setAbout(content.about);
        setSkills(content.about.skills.join(', '));
        setLanguages(content.about.languages.join(', '));
        setFacts(Object.entries(content.about.facts).map(([key, value]) => ({ key, value })));
      } catch (caught) {
        if (!cancelled) {
          setFailure(caught instanceof ApiError ? caught.message : 'Could not load site content.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <PageLoader label="Loading site content…" />;
  if (failure || !hero || !about) {
    return <ErrorState message={failure ?? 'Content unavailable'} onRetry={() => window.location.reload()} />;
  }

  async function submitHero(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!hero) return;
    const message = validateRequired('Headline')(hero.title);
    setHeroError(message);
    if (message) return;

    setSavingHero(true);
    try {
      const saved = await adminApi.updateHero(hero);
      setHero(saved);
      success('Hero updated', 'The landing page headline changed.');
    } catch (caught) {
      notifyError('Could not save hero', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setSavingHero(false);
    }
  }

  async function submitAbout(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!about) return;

    const payload: About = {
      ...about,
      skills: skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      languages: languages.split(',').map((language) => language.trim()).filter(Boolean),
      facts: facts.reduce<Record<string, string>>((accumulator, row) => {
        if (row.key.trim()) accumulator[row.key.trim()] = row.value.trim();
        return accumulator;
      }, {}),
      education: about.education.filter((entry) => entry.institution.trim()),
      experience: about.experience.filter((entry) => entry.role.trim()),
      socials: about.socials.filter((social) => social.url.trim()),
    };

    setSavingAbout(true);
    try {
      const saved = await adminApi.updateAbout(payload);
      setAbout(saved);
      success('About updated', 'Your story is live on the home and about pages.');
    } catch (caught) {
      notifyError('Could not save About', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setSavingAbout(false);
    }
  }

  function updateEducation(index: number, patch: Partial<EducationEntry>): void {
    setAbout((current) =>
      current
        ? {
            ...current,
            education: current.education.map((entry, position) =>
              position === index ? { ...entry, ...patch } : entry,
            ),
          }
        : current,
    );
  }

  function updateExperience(index: number, patch: Partial<ExperienceEntry>): void {
    setAbout((current) =>
      current
        ? {
            ...current,
            experience: current.experience.map((entry, position) =>
              position === index ? { ...entry, ...patch } : entry,
            ),
          }
        : current,
    );
  }

  function updateSocial(index: number, patch: Partial<SocialLink>): void {
    setAbout((current) =>
      current
        ? {
            ...current,
            socials: current.socials.map((social, position) =>
              position === index ? { ...social, ...patch } : social,
            ),
          }
        : current,
    );
  }

  return (
    <div className="site-content">
      {/* -------------------------------------------------------------- hero */}
      <section className="panel" aria-labelledby="hero-title">
        <h2 className="panel__title" id="hero-title">
          Landing hero
        </h2>
        <p className="panel__muted">The first thing every visitor reads.</p>

        <form className="form-grid form-grid--2" onSubmit={submitHero} noValidate>
          <TextField
            label="Eyebrow"
            id="hero-eyebrow"
            value={hero.eyebrow}
            onChange={(event) => setHero({ ...hero, eyebrow: event.target.value })}
          />
          <TextField
            label="Headline"
            id="hero-headline"
            required
            value={hero.title}
            error={heroError}
            onChange={(event) => setHero({ ...hero, title: event.target.value })}
          />
          <TextField
            label="Highlighted words"
            id="hero-highlight"
            hint="Shown in the accent colour next to the headline."
            value={hero.highlight}
            onChange={(event) => setHero({ ...hero, highlight: event.target.value })}
          />
          <TextField
            label="Portrait / art token"
            id="hero-portrait"
            value={about.portrait_url ?? ''}
            onChange={(event) => setAbout({ ...about, portrait_url: event.target.value })}
          />
          <div className="form-grid__span">
            <TextAreaField
              label="Subtitle"
              id="hero-subtitle"
              rows={3}
              value={hero.subtitle}
              onChange={(event) => setHero({ ...hero, subtitle: event.target.value })}
            />
          </div>
          <TextField
            label="Primary button label"
            id="hero-cta1"
            value={hero.primary_cta_label}
            onChange={(event) => setHero({ ...hero, primary_cta_label: event.target.value })}
          />
          <TextField
            label="Primary button link"
            id="hero-cta1-href"
            value={hero.primary_cta_href}
            onChange={(event) => setHero({ ...hero, primary_cta_href: event.target.value })}
          />
          <TextField
            label="Secondary button label"
            id="hero-cta2"
            value={hero.secondary_cta_label}
            onChange={(event) => setHero({ ...hero, secondary_cta_label: event.target.value })}
          />
          <TextField
            label="Secondary button link"
            id="hero-cta2-href"
            value={hero.secondary_cta_href}
            onChange={(event) => setHero({ ...hero, secondary_cta_href: event.target.value })}
          />
          <div className="form-grid__span panel__actions">
            <Button type="submit" loading={savingHero}>
              Save hero
            </Button>
          </div>
        </form>
      </section>

      {/* ------------------------------------------------------------- about */}
      <section className="panel" aria-labelledby="about-title">
        <h2 className="panel__title" id="about-title">
          About me
        </h2>
        <p className="panel__muted">
          Used on the home page preview and the full About page. Markdown works in the intro.
        </p>

        <form className="form-grid" onSubmit={submitAbout} noValidate>
          <TextField
            label="Headline"
            id="about-headline"
            value={about.headline}
            onChange={(event) => setAbout({ ...about, headline: event.target.value })}
          />
          <TextAreaField
            label="Intro"
            id="about-intro"
            rows={8}
            hint="Separate paragraphs with a blank line."
            value={about.intro}
            onChange={(event) => setAbout({ ...about, intro: event.target.value })}
          />

          {/* ---------------------------------------------------- education */}
          <div className="sub-editor">
            <div className="sub-editor__head">
              <h3>Education</h3>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setAbout({
                    ...about,
                    education: [
                      ...about.education,
                      { institution: '', degree: '', field: '', period: '', detail: '' },
                    ],
                  })
                }
              >
                + Add entry
              </Button>
            </div>
            <ul className="sub-editor__list sub-editor__list--stacked">
              {about.education.map((entry, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={index} className="sub-editor__block">
                  <div className="form-grid form-grid--2">
                    <TextField
                      label="Degree"
                      id={`edu-degree-${index}`}
                      value={entry.degree}
                      onChange={(event) => updateEducation(index, { degree: event.target.value })}
                    />
                    <TextField
                      label="Institution"
                      id={`edu-institution-${index}`}
                      value={entry.institution}
                      onChange={(event) => updateEducation(index, { institution: event.target.value })}
                    />
                    <TextField
                      label="Field"
                      id={`edu-field-${index}`}
                      value={entry.field ?? ''}
                      onChange={(event) => updateEducation(index, { field: event.target.value })}
                    />
                    <TextField
                      label="Period"
                      id={`edu-period-${index}`}
                      value={entry.period ?? ''}
                      onChange={(event) => updateEducation(index, { period: event.target.value })}
                    />
                  </div>
                  <TextAreaField
                    label="Detail"
                    id={`edu-detail-${index}`}
                    rows={2}
                    value={entry.detail ?? ''}
                    onChange={(event) => updateEducation(index, { detail: event.target.value })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setAbout({
                        ...about,
                        education: about.education.filter((_, position) => position !== index),
                      })
                    }
                  >
                    Remove entry
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {/* --------------------------------------------------- experience */}
          <div className="sub-editor">
            <div className="sub-editor__head">
              <h3>Experience</h3>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setAbout({
                    ...about,
                    experience: [
                      ...about.experience,
                      { role: '', organisation: '', period: '', location: '', detail: '', highlights: [] },
                    ],
                  })
                }
              >
                + Add entry
              </Button>
            </div>
            <ul className="sub-editor__list sub-editor__list--stacked">
              {about.experience.map((entry, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={index} className="sub-editor__block">
                  <div className="form-grid form-grid--2">
                    <TextField
                      label="Role"
                      id={`exp-role-${index}`}
                      value={entry.role}
                      onChange={(event) => updateExperience(index, { role: event.target.value })}
                    />
                    <TextField
                      label="Organisation"
                      id={`exp-org-${index}`}
                      value={entry.organisation}
                      onChange={(event) => updateExperience(index, { organisation: event.target.value })}
                    />
                    <TextField
                      label="Period"
                      id={`exp-period-${index}`}
                      value={entry.period ?? ''}
                      onChange={(event) => updateExperience(index, { period: event.target.value })}
                    />
                    <TextField
                      label="Location"
                      id={`exp-location-${index}`}
                      value={entry.location ?? ''}
                      onChange={(event) => updateExperience(index, { location: event.target.value })}
                    />
                  </div>
                  <TextAreaField
                    label="Summary"
                    id={`exp-detail-${index}`}
                    rows={2}
                    value={entry.detail ?? ''}
                    onChange={(event) => updateExperience(index, { detail: event.target.value })}
                  />
                  <TextAreaField
                    label="Highlights (one per line)"
                    id={`exp-highlights-${index}`}
                    rows={3}
                    value={(entry.highlights ?? []).join('\n')}
                    onChange={(event) =>
                      updateExperience(index, {
                        highlights: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setAbout({
                        ...about,
                        experience: about.experience.filter((_, position) => position !== index),
                      })
                    }
                  >
                    Remove entry
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {/* ------------------------------------------------------- socials */}
          <div className="sub-editor">
            <div className="sub-editor__head">
              <h3>Links</h3>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setAbout({ ...about, socials: [...about.socials, { label: '', url: '', icon: '' }] })
                }
              >
                + Add link
              </Button>
            </div>
            <ul className="sub-editor__list">
              {about.socials.map((social, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={index} className="sub-editor__row">
                  <input
                    className="input input--sm"
                    aria-label={`Link label ${index + 1}`}
                    placeholder="YouTube"
                    value={social.label}
                    onChange={(event) => updateSocial(index, { label: event.target.value })}
                  />
                  <input
                    className="input input--sm"
                    aria-label={`Link URL ${index + 1}`}
                    placeholder="https://…"
                    value={social.url}
                    onChange={(event) => updateSocial(index, { url: event.target.value })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove link ${index + 1}`}
                    onClick={() =>
                      setAbout({ ...about, socials: about.socials.filter((_, position) => position !== index) })
                    }
                  >
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {/* ------------------------------------------------- skills & facts */}
          <div className="form-grid form-grid--2">
            <TextField
              label="Skills (comma separated)"
              id="about-skills"
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
            />
            <TextField
              label="Languages (comma separated)"
              id="about-languages"
              value={languages}
              onChange={(event) => setLanguages(event.target.value)}
            />
          </div>

          <div className="sub-editor">
            <div className="sub-editor__head">
              <h3>Quick facts</h3>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setFacts([...facts, { key: '', value: '' }])}
              >
                + Add fact
              </Button>
            </div>
            <ul className="sub-editor__list">
              {facts.map((fact, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={index} className="sub-editor__row">
                  <input
                    className="input input--sm"
                    aria-label={`Fact label ${index + 1}`}
                    placeholder="Focus"
                    value={fact.key}
                    onChange={(event) =>
                      setFacts(facts.map((row, position) => (position === index ? { ...row, key: event.target.value } : row)))
                    }
                  />
                  <input
                    className="input input--sm"
                    aria-label={`Fact value ${index + 1}`}
                    placeholder="Deen, code & life"
                    value={fact.value}
                    onChange={(event) =>
                      setFacts(facts.map((row, position) => (position === index ? { ...row, value: event.target.value } : row)))
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove fact ${index + 1}`}
                    onClick={() => setFacts(facts.filter((_, position) => position !== index))}
                  >
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel__actions">
            <Button type="submit" loading={savingAbout}>
              Save About
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
