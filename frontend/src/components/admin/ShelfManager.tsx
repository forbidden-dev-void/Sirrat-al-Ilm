/**
 * ShelfManager — CRUD for shelves and the video cards inside them.
 *
 * Two levels of editing:
 *   1. the shelf itself (title, slug, kind, copy, visibility, order)
 *   2. its cards (title, YouTube URL / video id, channel, duration, level, …)
 *
 * Deleting a shelf removes its cards (the database cascades), which the confirm
 * dialog spells out before it happens.
 */

import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { pluralise, titleCase } from '../../lib/format';
import { validateRequired, validateSlug, validateUrl } from '../../lib/validation';
import { parseYouTubeId, youTubeWatchUrl } from '../../lib/youtube';
import type { Shelf, ShelfKind, ShelfResource, ShelfSummary } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../ui/Field';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { ErrorState } from '../ui/States';
import { DataTable, type Column } from './DataTable';

const KIND_OPTIONS: { value: ShelfKind; label: string }[] = [
  { value: 'wisdom', label: 'Religion & self-improvement' },
  { value: 'programming', label: 'Programming courses' },
  { value: 'tech', label: 'Tools & deep work' },
  { value: 'life', label: 'Life updates' },
  { value: 'books', label: 'Books' },
];

const ACCENT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'chocolate', label: 'Deep chocolate' },
  { value: 'walnut', label: 'Warm walnut' },
  { value: 'latte', label: 'Latte accent' },
  { value: 'cream', label: 'Cream' },
];

interface ShelfFormState {
  title: string;
  slug: string;
  kind: ShelfKind;
  subtitle: string;
  description: string;
  accent: string;
  sort_order: string;
  is_published: boolean;
}

const EMPTY_SHELF: ShelfFormState = {
  title: '',
  slug: '',
  kind: 'wisdom',
  subtitle: '',
  description: '',
  accent: '',
  sort_order: '0',
  is_published: true,
};

interface ResourceFormState {
  title: string;
  description: string;
  external_url: string;
  video_id: string;
  channel: string;
  duration_label: string;
  level: string;
  language: string;
  resource_type: 'video' | 'playlist' | 'link';
  sort_order: string;
  is_published: boolean;
  is_featured: boolean;
}

const EMPTY_RESOURCE: ResourceFormState = {
  title: '',
  description: '',
  external_url: '',
  video_id: '',
  channel: '',
  duration_label: '',
  level: '',
  language: 'English',
  resource_type: 'video',
  sort_order: '0',
  is_published: true,
  is_featured: false,
};

export function ShelfManager(): JSX.Element {
  const { success, error: notifyError } = useToast();
  const { data: shelves, loading, error, reload } = useApi<ShelfSummary[]>(() => adminApi.shelves(), []);

  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; shelf: ShelfSummary | null } | null>(null);
  const [form, setForm] = useState<ShelfFormState>(EMPTY_SHELF);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ShelfSummary | null>(null);

  // Card editor state
  const [cardShelf, setCardShelf] = useState<Shelf | null>(null);
  const [cards, setCards] = useState<ShelfResource[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardForm, setCardForm] = useState<ResourceFormState>(EMPTY_RESOURCE);
  const [editingCard, setEditingCard] = useState<ShelfResource | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [pendingCardDelete, setPendingCardDelete] = useState<ShelfResource | null>(null);

  /* ------------------------------------------------------------- shelves */
  function openCreate(): void {
    setForm({ ...EMPTY_SHELF, sort_order: String((shelves?.length ?? 0) + 1) });
    setFormErrors({});
    setEditing({ mode: 'create', shelf: null });
  }

  function openEdit(shelf: ShelfSummary): void {
    setForm({
      title: shelf.title,
      slug: shelf.slug,
      kind: shelf.kind,
      subtitle: shelf.subtitle ?? '',
      description: shelf.description ?? '',
      accent: shelf.accent ?? '',
      sort_order: String(shelf.sort_order ?? 0),
      is_published: shelf.is_published,
    });
    setFormErrors({});
    setEditing({ mode: 'edit', shelf });
  }

  async function saveShelf(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const errors: Record<string, string | undefined> = {
      title: validateRequired('Title')(form.title) ?? undefined,
      slug: validateSlug(form.slug) ?? undefined,
    };
    setFormErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      kind: form.kind,
      subtitle: form.subtitle || null,
      description: form.description,
      accent: form.accent || null,
      sort_order: Number(form.sort_order) || 0,
      is_published: form.is_published,
    };

    try {
      if (editing?.mode === 'edit' && editing.shelf) {
        await adminApi.updateShelf(editing.shelf.id, payload);
        success('Shelf updated', payload.title);
      } else {
        await adminApi.createShelf({ ...payload, slug: payload.slug ?? '' });
        success('Shelf created', `${payload.title} is ready — add its cards next.`);
      }
      setEditing(null);
      reload();
    } catch (caught) {
      notifyError('Could not save shelf', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function removeShelf(): Promise<void> {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await adminApi.deleteShelf(pendingDelete.id);
      success('Shelf deleted', `${pendingDelete.title} and its cards were removed.`);
      setPendingDelete(null);
      reload();
    } catch (caught) {
      notifyError('Could not delete shelf', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------------------------------------------- cards */
  async function openCards(shelfSummary: ShelfSummary): Promise<void> {
    setCardsLoading(true);
    setEditingCard(null);
    setCardForm({ ...EMPTY_RESOURCE, sort_order: String(shelfSummary.resource_count + 1) });
    try {
      // The admin endpoint also returns unpublished cards.
      const shelf = await adminApi.shelf(shelfSummary.id);
      setCardShelf(shelf);
      setCards(shelf.resources);
    } catch (caught) {
      notifyError('Could not open shelf', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setCardsLoading(false);
    }
  }

  function refreshCards(shelf: Shelf): void {
    void adminApi
      .shelf(shelf.id)
      .then((fresh) => {
        setCardShelf(fresh);
        setCards(fresh.resources);
      })
      .catch(() => undefined);
    reload();
  }

  function startEditCard(card: ShelfResource): void {
    setEditingCard(card);
    setCardForm({
      title: card.title,
      description: card.description,
      external_url: card.external_url ?? '',
      video_id: card.video_id ?? '',
      channel: card.channel ?? '',
      duration_label: card.duration_label ?? '',
      level: card.level ?? '',
      language: card.language ?? '',
      resource_type: card.resource_type,
      sort_order: String(card.sort_order),
      is_published: card.is_published,
      is_featured: card.is_featured,
    });
  }

  async function saveCard(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!cardShelf) return;

    const trimmedUrl = cardForm.external_url.trim();
    const typedVideoId = cardForm.video_id.trim();
    const errors: Record<string, string | undefined> = {
      title: validateRequired('Title')(cardForm.title) ?? undefined,
      external_url: validateUrl(trimmedUrl) ?? undefined,
    };
    if (!trimmedUrl && !typedVideoId) {
      errors.external_url = 'Paste a YouTube link, or the 11-character video id';
    }
    setFormErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    // Accept either input: a full URL (we pull the id out) or a bare id
    // (we build the canonical watch URL), so a card is never link-less.
    const derivedVideoId = typedVideoId || parseYouTubeId(trimmedUrl) || null;
    const payload = {
      title: cardForm.title.trim(),
      description: cardForm.description,
      external_url: trimmedUrl || (derivedVideoId ? youTubeWatchUrl(derivedVideoId) : null),
      video_id: derivedVideoId,
      channel: cardForm.channel.trim() || null,
      duration_label: cardForm.duration_label.trim() || null,
      level: cardForm.level.trim() || null,
      language: cardForm.language.trim() || null,
      resource_type: cardForm.resource_type,
      sort_order: Number(cardForm.sort_order) || 0,
      is_published: cardForm.is_published,
      is_featured: cardForm.is_featured,
    };

    setCardBusy(true);
    try {
      if (editingCard) {
        await adminApi.updateResource(editingCard.id, payload);
        success('Card updated', payload.title);
      } else {
        await adminApi.createResource({ ...payload, shelf_id: cardShelf.id });
        success('Card added', payload.title);
      }
      setEditingCard(null);
      setCardForm({ ...EMPTY_RESOURCE, sort_order: String(cards.length + 1) });
      refreshCards(cardShelf);
    } catch (caught) {
      notifyError('Could not save card', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setCardBusy(false);
    }
  }

  async function removeCard(): Promise<void> {
    if (!pendingCardDelete || !cardShelf) return;
    setCardBusy(true);
    try {
      await adminApi.deleteResource(pendingCardDelete.id);
      success('Card removed', pendingCardDelete.title);
      setPendingCardDelete(null);
      refreshCards(cardShelf);
    } catch (caught) {
      notifyError('Could not remove card', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setCardBusy(false);
    }
  }

  const columns: Column<ShelfSummary>[] = [
    {
      key: 'shelf',
      header: 'Shelf',
      render: (row) => (
        <div className="cell-person">
          <strong>{row.title}</strong>
          <span>/shelf/{row.slug}</span>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Kind',
      render: (row) => <Badge tone="latte">{titleCase(row.kind)}</Badge>,
    },
    {
      key: 'cards',
      header: 'Cards',
      align: 'right',
      render: (row) => <span className="cell-numbers">{row.resource_count}</span>,
    },
    {
      key: 'order',
      header: 'Order',
      align: 'right',
      render: (row) => <span className="cell-muted">{row.sort_order}</span>,
    },
    {
      key: 'published',
      header: 'Visibility',
      render: (row) => (
        <Badge tone={row.is_published ? 'success' : 'muted'}>
          {row.is_published ? 'Published' : 'Draft'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="cell-actions">
          <Button size="sm" variant="secondary" onClick={() => void openCards(row)}>
            Manage cards
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setPendingDelete(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <section className="manager" aria-labelledby="shelves-title">
      <header className="manager__head">
        <div>
          <h2 className="manager__title" id="shelves-title">
            Shelves
          </h2>
          <p className="manager__subtitle">
            {pluralise(shelves?.length ?? 0, 'shelf', 'shelves')} ·{' '}
            {pluralise((shelves ?? []).reduce((total, shelf) => total + shelf.resource_count, 0), 'card')}
          </p>
        </div>
        <div className="manager__actions">
          <Button size="sm" onClick={openCreate}>
            + New shelf
          </Button>
          <Button size="sm" variant="ghost" onClick={reload}>
            Refresh
          </Button>
        </div>
      </header>

      <DataTable
        rows={shelves ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Content shelves"
        loading={loading}
        emptyMessage="No shelves yet — create the first one."
      />

      {/* ------------------------------------------------ shelf create/edit */}
      <Modal
        open={editing !== null}
        title={editing?.mode === 'edit' ? 'Edit shelf' : 'New shelf'}
        description="Shelves are the rows on the home page. Cards can be added after saving."
        onClose={() => setEditing(null)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button form="shelf-form" type="submit" loading={saving}>
              {editing?.mode === 'edit' ? 'Save changes' : 'Create shelf'}
            </Button>
          </>
        }
      >
        <form id="shelf-form" className="form-grid form-grid--2" onSubmit={saveShelf} noValidate>
          <TextField
            label="Title"
            id="shelf-title"
            required
            value={form.title}
            error={formErrors.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <TextField
            label="Slug"
            id="shelf-slug"
            placeholder="auto-generated when left blank"
            value={form.slug}
            error={formErrors.slug}
            hint="Used in the URL: /shelf/your-slug"
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
          />
          <SelectField
            label="Kind"
            id="shelf-kind"
            options={KIND_OPTIONS}
            value={form.kind}
            onChange={(event) => setForm({ ...form, kind: event.target.value as ShelfKind })}
          />
          <SelectField
            label="Accent colour"
            id="shelf-accent"
            options={ACCENT_OPTIONS}
            value={form.accent}
            onChange={(event) => setForm({ ...form, accent: event.target.value })}
          />
          <TextField
            label="Subtitle"
            id="shelf-subtitle"
            value={form.subtitle}
            onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
          />
          <TextField
            label="Sort order"
            id="shelf-order"
            type="number"
            value={form.sort_order}
            onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
          />
          <TextAreaField
            label="Description"
            id="shelf-description"
            rows={4}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <div className="form-grid__span">
            <CheckboxField
              label="Published"
              description="Unpublished shelves are hidden from every reader."
              checked={form.is_published}
              onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete “${pendingDelete?.title ?? ''}”?`}
        message={`This removes the shelf and all ${pendingDelete?.resource_count ?? 0} of its cards. Learners keep their progress rows, but the links stop working.`}
        confirmLabel="Delete shelf"
        busy={saving}
        onConfirm={() => void removeShelf()}
        onCancel={() => setPendingDelete(null)}
      />

      {/* ------------------------------------------------------- card editor */}
      <Modal
        open={cardShelf !== null}
        title={`Cards — ${cardShelf?.title ?? ''}`}
        description="Every card links out to YouTube. Paste a watch URL and the video id is detected automatically."
        onClose={() => {
          setCardShelf(null);
          setEditingCard(null);
          reload();
        }}
        size="lg"
      >
        <div className="card-editor">
          <ul className="card-editor__list">
            {cardsLoading ? (
              <li className="card-editor__empty">Loading cards…</li>
            ) : cards.length === 0 ? (
              <li className="card-editor__empty">No cards yet — add the first one below.</li>
            ) : (
              cards.map((card) => (
                <li key={card.id} className="card-editor__item">
                  <div className="card-editor__info">
                    <strong>{card.title}</strong>
                    <span className="card-editor__meta">
                      {card.channel ? `${card.channel} · ` : ''}
                      {card.duration_label ? `${card.duration_label} · ` : ''}
                      {card.level ?? 'Any level'} · #{card.sort_order}
                      {!card.is_published ? ' · draft' : ''}
                    </span>
                    {card.external_url ? (
                      <a href={card.external_url} target="_blank" rel="noopener noreferrer">
                        {card.video_id ? `YouTube · ${card.video_id}` : 'Open link ↗'}
                      </a>
                    ) : null}
                  </div>
                  <div className="card-editor__actions">
                    <Button size="sm" variant="ghost" onClick={() => startEditCard(card)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setPendingCardDelete(card)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>

          <form className="card-editor__form form-grid form-grid--2" onSubmit={saveCard} noValidate>
            <h3 className="form-grid__title">
              {editingCard ? `Edit card #${editingCard.id}` : 'Add a card'}
            </h3>

            <TextField
              label="Title"
              id="card-title"
              required
              value={cardForm.title}
              error={formErrors.title}
              onChange={(event) => setCardForm({ ...cardForm, title: event.target.value })}
            />
            <TextField
              label="YouTube URL"
              id="card-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={cardForm.external_url}
              error={formErrors.external_url}
              hint="A search or playlist URL also works."
              onChange={(event) => setCardForm({ ...cardForm, external_url: event.target.value })}
            />
            <TextField
              label="Video ID"
              id="card-video-id"
              placeholder="auto-detected"
              value={cardForm.video_id}
              hint="Used for the thumbnail (11 characters)."
              onChange={(event) => setCardForm({ ...cardForm, video_id: event.target.value })}
            />
            <TextField
              label="Channel"
              id="card-channel"
              value={cardForm.channel}
              onChange={(event) => setCardForm({ ...cardForm, channel: event.target.value })}
            />
            <TextField
              label="Duration label"
              id="card-duration"
              placeholder="1:02:30 or 'Series'"
              value={cardForm.duration_label}
              onChange={(event) => setCardForm({ ...cardForm, duration_label: event.target.value })}
            />
            <TextField
              label="Level"
              id="card-level"
              placeholder="Beginner / Intermediate / Advanced"
              value={cardForm.level}
              onChange={(event) => setCardForm({ ...cardForm, level: event.target.value })}
            />
            <TextField
              label="Language"
              id="card-language"
              value={cardForm.language}
              onChange={(event) => setCardForm({ ...cardForm, language: event.target.value })}
            />
            <TextField
              label="Sort order"
              id="card-order"
              type="number"
              value={cardForm.sort_order}
              onChange={(event) => setCardForm({ ...cardForm, sort_order: event.target.value })}
            />
            <SelectField
              label="Type"
              id="card-type"
              options={[
                { value: 'video', label: 'Video' },
                { value: 'playlist', label: 'Playlist / series' },
                { value: 'link', label: 'Plain link' },
              ]}
              value={cardForm.resource_type}
              onChange={(event) =>
                setCardForm({ ...cardForm, resource_type: event.target.value as 'video' | 'playlist' | 'link' })
              }
            />
            <TextAreaField
              label="Description"
              id="card-description"
              rows={3}
              value={cardForm.description}
              onChange={(event) => setCardForm({ ...cardForm, description: event.target.value })}
            />
            <div className="form-grid__span checkbox-row">
              <CheckboxField
                label="Published"
                checked={cardForm.is_published}
                onChange={(event) => setCardForm({ ...cardForm, is_published: event.target.checked })}
              />
              <CheckboxField
                label="Featured"
                checked={cardForm.is_featured}
                onChange={(event) => setCardForm({ ...cardForm, is_featured: event.target.checked })}
              />
            </div>
            <div className="form-grid__span panel__actions">
              <Button type="submit" loading={cardBusy}>
                {editingCard ? 'Save card' : 'Add card'}
              </Button>
              {editingCard ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingCard(null);
                    setCardForm({ ...EMPTY_RESOURCE, sort_order: String(cards.length + 1) });
                  }}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingCardDelete !== null}
        title="Remove this card?"
        message={`“${pendingCardDelete?.title ?? ''}” will disappear from the shelf.`}
        confirmLabel="Remove card"
        busy={cardBusy}
        onConfirm={() => void removeCard()}
        onCancel={() => setPendingCardDelete(null)}
      />
    </section>
  );
}
