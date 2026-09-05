/**
 * LabManager — CRUD for Labs (the `Item` model), including the gallery rows.
 */

import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { formatDate, pluralise, titleCase } from '../../lib/format';
import { validateRequired, validateSlug, validateUrl } from '../../lib/validation';
import type { AvailabilityStatus, GalleryImage, Lab } from '../../types';
import { Badge, toneForStatus } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../ui/Field';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { ErrorState } from '../ui/States';
import { DataTable, type Column } from './DataTable';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'archived', label: 'Archived' },
  { value: 'draft', label: 'Draft (hidden)' },
];

interface LabFormState {
  title: string;
  slug: string;
  category: string;
  kind: string;
  availability_status: AvailabilityStatus;
  summary: string;
  description: string;
  tags: string;
  image_url: string;
  external_url: string;
  is_featured: boolean;
  sort_order: string;
  gallery: GalleryImage[];
}

const EMPTY_LAB: LabFormState = {
  title: '',
  slug: '',
  category: '',
  kind: 'lab',
  availability_status: 'available',
  summary: '',
  description: '',
  tags: '',
  image_url: '',
  external_url: '',
  is_featured: false,
  sort_order: '0',
  gallery: [],
};

export function LabManager(): JSX.Element {
  const { success, error: notifyError } = useToast();
  const { data: labs, loading, error, reload } = useApi<Lab[]>(() => adminApi.labs(), []);

  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; lab: Lab | null } | null>(null);
  const [form, setForm] = useState<LabFormState>(EMPTY_LAB);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Lab | null>(null);

  function openCreate(): void {
    setForm({ ...EMPTY_LAB, sort_order: String((labs?.length ?? 0) + 1) });
    setErrors({});
    setEditing({ mode: 'create', lab: null });
  }

  function openEdit(lab: Lab): void {
    setForm({
      title: lab.title,
      slug: lab.slug,
      category: lab.category ?? '',
      kind: lab.kind,
      availability_status: lab.availability_status,
      summary: lab.summary ?? '',
      description: lab.description,
      tags: lab.tags.join(', '),
      image_url: lab.image_url ?? '',
      external_url: lab.external_url ?? '',
      is_featured: lab.is_featured,
      sort_order: String(lab.sort_order),
      gallery: lab.gallery ?? [],
    });
    setErrors({});
    setEditing({ mode: 'edit', lab });
  }

  function updateGallery(index: number, patch: Partial<GalleryImage>): void {
    setForm((current) => ({
      ...current,
      gallery: current.gallery.map((image, position) =>
        position === index ? { ...image, ...patch } : image,
      ),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors: Record<string, string | undefined> = {
      title: validateRequired('Title')(form.title) ?? undefined,
      slug: validateSlug(form.slug) ?? undefined,
      image_url: validateUrl(form.image_url) ?? undefined,
      external_url: validateUrl(form.external_url) ?? undefined,
    };
    form.gallery.forEach((image, index) => {
      const message = validateUrl(image.url);
      if (message) nextErrors[`gallery-${index}`] = message;
    });
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      category: form.category || null,
      kind: form.kind || 'lab',
      availability_status: form.availability_status,
      summary: form.summary || null,
      description: form.description,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      image_url: form.image_url || null,
      external_url: form.external_url || null,
      is_featured: form.is_featured,
      sort_order: Number(form.sort_order) || 0,
      gallery: form.gallery.filter((image) => image.url.trim()),
    };

    setSaving(true);
    try {
      if (editing?.mode === 'edit' && editing.lab) {
        await adminApi.updateLab(editing.lab.id, payload);
        success('Lab updated', payload.title);
      } else {
        await adminApi.createLab(payload);
        success('Lab created', payload.title);
      }
      setEditing(null);
      reload();
    } catch (caught) {
      notifyError('Could not save lab', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await adminApi.deleteLab(pendingDelete.id);
      success('Lab deleted', pendingDelete.title);
      setPendingDelete(null);
      reload();
    } catch (caught) {
      notifyError('Could not delete lab', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Lab>[] = [
    {
      key: 'lab',
      header: 'Lab',
      render: (row) => (
        <div className="cell-person">
          <strong>{row.title}</strong>
          <span>/labs/{row.slug}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <Badge tone="latte">{row.category ?? '—'}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={toneForStatus(row.availability_status)}>
          {titleCase(row.availability_status)}
        </Badge>
      ),
    },
    { key: 'gallery', header: 'Images', align: 'right', render: (row) => <span className="cell-numbers">{row.gallery.length}</span> },
    { key: 'updated', header: 'Updated', render: (row) => <span className="cell-muted">{formatDate(row.updated_at)}</span> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="cell-actions">
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
    <section className="manager" aria-labelledby="labs-admin-title">
      <header className="manager__head">
        <div>
          <h2 className="manager__title" id="labs-admin-title">
            Labs
          </h2>
          <p className="manager__subtitle">{pluralise(labs?.length ?? 0, 'lab')} in the workshop.</p>
        </div>
        <div className="manager__actions">
          <Button size="sm" onClick={openCreate}>
            + New lab
          </Button>
          <Button size="sm" variant="ghost" onClick={reload}>
            Refresh
          </Button>
        </div>
      </header>

      <DataTable
        rows={labs ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Lab listings"
        loading={loading}
        emptyMessage="No labs yet — add your first project."
      />

      <Modal
        open={editing !== null}
        title={editing?.mode === 'edit' ? `Edit “${editing.lab?.title ?? ''}”` : 'New lab'}
        description="The description accepts Markdown. Gallery images can point at generated artwork or any image URL."
        onClose={() => setEditing(null)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button form="lab-form" type="submit" loading={saving}>
              {editing?.mode === 'edit' ? 'Save changes' : 'Create lab'}
            </Button>
          </>
        }
      >
        <form id="lab-form" className="form-grid form-grid--2" onSubmit={submit} noValidate>
          <TextField
            label="Title"
            id="lab-form-title"
            required
            value={form.title}
            error={errors.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <TextField
            label="Slug"
            id="lab-form-slug"
            placeholder="auto-generated when blank"
            value={form.slug}
            error={errors.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
          />
          <TextField
            label="Category"
            id="lab-form-category"
            placeholder="Full-stack, Backend, Education…"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
          <SelectField
            label="Availability"
            id="lab-form-status"
            options={STATUS_OPTIONS}
            value={form.availability_status}
            onChange={(event) =>
              setForm({ ...form, availability_status: event.target.value as AvailabilityStatus })
            }
          />
          <TextField
            label="Cover image URL"
            id="lab-form-image"
            value={form.image_url}
            error={errors.image_url}
            hint="Blank = generated artwork"
            onChange={(event) => setForm({ ...form, image_url: event.target.value })}
          />
          <TextField
            label="Source / demo URL"
            id="lab-form-external"
            value={form.external_url}
            error={errors.external_url}
            onChange={(event) => setForm({ ...form, external_url: event.target.value })}
          />
          <TextField
            label="Tags"
            id="lab-form-tags"
            placeholder="FastAPI, React, Docker"
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
          />
          <TextField
            label="Sort order"
            id="lab-form-order"
            type="number"
            value={form.sort_order}
            onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
          />
          <TextField
            label="Short summary"
            id="lab-form-summary"
            value={form.summary}
            hint="One line shown on the card."
            onChange={(event) => setForm({ ...form, summary: event.target.value })}
          />
          <div className="form-grid__span checkbox-row">
            <CheckboxField
              label="Feature on the home page"
              checked={form.is_featured}
              onChange={(event) => setForm({ ...form, is_featured: event.target.checked })}
            />
          </div>
          <div className="form-grid__span">
            <TextAreaField
              label="Description"
              id="lab-form-description"
              rows={10}
              hint="Markdown: ## headings, - lists, **bold**, `code`."
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>

          {/* -------------------------------------------------- gallery editor */}
          <div className="form-grid__span">
            <div className="sub-editor">
              <div className="sub-editor__head">
                <h3>Gallery</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm({
                      ...form,
                      gallery: [
                        ...form.gallery,
                        { url: `/api/media/art/lab-${form.slug || 'new'}-${form.gallery.length + 1}.svg`, caption: '' },
                      ],
                    })
                  }
                >
                  + Add image
                </Button>
              </div>

              {form.gallery.length === 0 ? (
                <p className="panel__muted">No gallery images — the lab card will use generated artwork.</p>
              ) : (
                <ul className="sub-editor__list">
                  {form.gallery.map((image, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={index} className="sub-editor__row">
                      <input
                        className="input input--sm"
                        aria-label={`Image URL ${index + 1}`}
                        placeholder="/api/media/art/….svg or https://…"
                        value={image.url}
                        onChange={(event) => updateGallery(index, { url: event.target.value })}
                      />
                      <input
                        className="input input--sm"
                        aria-label={`Caption ${index + 1}`}
                        placeholder="Caption"
                        value={image.caption ?? ''}
                        onChange={(event) => updateGallery(index, { caption: event.target.value })}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove image ${index + 1}`}
                        onClick={() =>
                          setForm({ ...form, gallery: form.gallery.filter((_, position) => position !== index) })
                        }
                      >
                        ✕
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete “${pendingDelete?.title ?? ''}”?`}
        message="The lab page and its gallery will be removed."
        confirmLabel="Delete lab"
        busy={saving}
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
