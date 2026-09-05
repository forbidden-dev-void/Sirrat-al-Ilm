/**
 * PostManager — CRUD for blog posts (religion / tech / life / programming / books).
 *
 * The body is Markdown; a live preview is rendered with the same safe renderer
 * the public article page uses, so what the owner writes is what readers see.
 */

import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { estimateReadingMinutes, formatDate, pluralise, titleCase } from '../../lib/format';
import { renderMarkdown } from '../../lib/markdown';
import { validateRequired, validateSlug } from '../../lib/validation';
import type { BlogCategory, Post } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../ui/Field';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { ErrorState } from '../ui/States';
import { DataTable, type Column } from './DataTable';

const CATEGORY_OPTIONS: { value: BlogCategory; label: string }[] = [
  { value: 'religion', label: 'Religion' },
  { value: 'tech', label: 'Technology' },
  { value: 'life', label: 'Life updates' },
  { value: 'programming', label: 'Programming' },
  { value: 'books', label: 'Books' },
];

interface PostFormState {
  title: string;
  slug: string;
  category: BlogCategory;
  excerpt: string;
  body: string;
  cover_image: string;
  tags: string;
  reading_minutes: string;
  is_published: boolean;
  is_featured: boolean;
}

const EMPTY_POST: PostFormState = {
  title: '',
  slug: '',
  category: 'life',
  excerpt: '',
  body: '',
  cover_image: '',
  tags: '',
  reading_minutes: '',
  is_published: true,
  is_featured: false,
};

export function PostManager(): JSX.Element {
  const { success, error: notifyError } = useToast();
  const { data: posts, loading, error, reload } = useApi<Post[]>(() => adminApi.posts(), []);

  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; post: Post | null } | null>(null);
  const [form, setForm] = useState<PostFormState>(EMPTY_POST);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Post | null>(null);

  function openCreate(): void {
    setForm(EMPTY_POST);
    setErrors({});
    setPreview(false);
    setEditing({ mode: 'create', post: null });
  }

  function openEdit(post: Post): void {
    setForm({
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt,
      body: post.body,
      cover_image: post.cover_image ?? '',
      tags: post.tags.join(', '),
      reading_minutes: String(post.reading_minutes),
      is_published: post.is_published,
      is_featured: post.is_featured,
    });
    setErrors({});
    setPreview(false);
    setEditing({ mode: 'edit', post });
  }

  async function togglePublish(post: Post): Promise<void> {
    try {
      await adminApi.updatePost(post.id, { is_published: !post.is_published });
      success('Visibility updated', `${post.title} is now ${post.is_published ? 'a draft' : 'published'}.`);
      reload();
    } catch (caught) {
      notifyError('Could not update', caught instanceof ApiError ? caught.message : 'Try again.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextErrors: Record<string, string | undefined> = {
      title: validateRequired('Title')(form.title) ?? undefined,
      slug: validateSlug(form.slug) ?? undefined,
      excerpt: form.excerpt.length > 500 ? 'Keep the excerpt under 500 characters' : undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      category: form.category,
      excerpt: form.excerpt,
      body: form.body,
      cover_image: form.cover_image || null,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      reading_minutes: form.reading_minutes
        ? Number(form.reading_minutes)
        : estimateReadingMinutes(form.body),
      is_published: form.is_published,
      is_featured: form.is_featured,
    };

    setSaving(true);
    try {
      if (editing?.mode === 'edit' && editing.post) {
        await adminApi.updatePost(editing.post.id, payload);
        success('Post updated', payload.title);
      } else {
        await adminApi.createPost(payload);
        success('Post created', payload.title);
      }
      setEditing(null);
      reload();
    } catch (caught) {
      notifyError('Could not save post', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await adminApi.deletePost(pendingDelete.id);
      success('Post deleted', pendingDelete.title);
      setPendingDelete(null);
      reload();
    } catch (caught) {
      notifyError('Could not delete post', caught instanceof ApiError ? caught.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Post>[] = [
    {
      key: 'post',
      header: 'Article',
      render: (row) => (
        <div className="cell-person">
          <strong>{row.title}</strong>
          <span>/blog/{row.slug}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <Badge tone="latte">{titleCase(row.category)}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.is_published ? 'success' : 'muted'}>{row.is_published ? 'Published' : 'Draft'}</Badge>
      ),
    },
    { key: 'views', header: 'Views', align: 'right', render: (row) => <span className="cell-numbers">{row.view_count}</span> },
    {
      key: 'published_at',
      header: 'Published',
      render: (row) => <span className="cell-muted">{row.published_at ? formatDate(row.published_at) : '—'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="cell-actions">
          <Button size="sm" variant="ghost" onClick={() => void togglePublish(row)}>
            {row.is_published ? 'Unpublish' : 'Publish'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
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
    <section className="manager" aria-labelledby="posts-admin-title">
      <header className="manager__head">
        <div>
          <h2 className="manager__title" id="posts-admin-title">
            Writing
          </h2>
          <p className="manager__subtitle">
            {pluralise(posts?.length ?? 0, 'post')} ·{' '}
            {pluralise((posts ?? []).filter((post) => !post.is_published).length, 'draft')}
          </p>
        </div>
        <div className="manager__actions">
          <Button size="sm" onClick={openCreate}>
            + New post
          </Button>
          <Button size="sm" variant="ghost" onClick={reload}>
            Refresh
          </Button>
        </div>
      </header>

      <DataTable
        rows={posts ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Blog posts"
        loading={loading}
        emptyMessage="Nothing written yet."
      />

      <Modal
        open={editing !== null}
        title={editing?.mode === 'edit' ? `Edit “${editing.post?.title ?? ''}”` : 'New post'}
        description="Markdown in the body: ## heading, - list, **bold**, [link](https://…)."
        onClose={() => setEditing(null)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="ghost" onClick={() => setPreview((value) => !value)}>
              {preview ? 'Hide preview' : 'Preview'}
            </Button>
            <Button form="post-form" type="submit" loading={saving}>
              {editing?.mode === 'edit' ? 'Save changes' : 'Create post'}
            </Button>
          </>
        }
      >
        <form id="post-form" className="form-grid form-grid--2" onSubmit={submit} noValidate>
          <TextField
            label="Title"
            id="post-form-title"
            required
            value={form.title}
            error={errors.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <TextField
            label="Slug"
            id="post-form-slug"
            placeholder="auto-generated when blank"
            value={form.slug}
            error={errors.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
          />
          <SelectField
            label="Category"
            id="post-form-category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value as BlogCategory })}
          />
          <TextField
            label="Reading minutes"
            id="post-form-reading"
            type="number"
            min={1}
            placeholder={form.body ? String(estimateReadingMinutes(form.body)) : 'auto'}
            value={form.reading_minutes}
            onChange={(event) => setForm({ ...form, reading_minutes: event.target.value })}
          />
          <TextField
            label="Cover image URL"
            id="post-form-cover"
            value={form.cover_image}
            hint="Blank = generated artwork"
            onChange={(event) => setForm({ ...form, cover_image: event.target.value })}
          />
          <TextField
            label="Tags"
            id="post-form-tags"
            placeholder="comma, separated"
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
          />

          <div className="form-grid__span">
            <TextAreaField
              label="Excerpt"
              id="post-form-excerpt"
              rows={2}
              maxLength={500}
              error={errors.excerpt}
              hint="Shown on cards and in search results."
              value={form.excerpt}
              onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
            />
          </div>

          <div className="form-grid__span">
            <TextAreaField
              label="Body"
              id="post-form-body"
              rows={16}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
          </div>

          {preview ? (
            <div className="form-grid__span">
              <div className="panel preview-panel">
                <h3 className="panel__title">Preview</h3>
                <div className="prose">{renderMarkdown(form.body)}</div>
              </div>
            </div>
          ) : null}

          <div className="form-grid__span checkbox-row">
            <CheckboxField
              label="Published"
              description="Drafts are only visible to you."
              checked={form.is_published}
              onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
            />
            <CheckboxField
              label="Featured"
              description="Show at the top of the blog index."
              checked={form.is_featured}
              onChange={(event) => setForm({ ...form, is_featured: event.target.checked })}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete “${pendingDelete?.title ?? ''}”?`}
        message="The article and its URL will be removed."
        confirmLabel="Delete post"
        busy={saving}
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
