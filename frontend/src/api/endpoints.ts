/**
 * Typed API endpoints
 * ===================
 *
 * One function per backend route. Components import these instead of calling
 * `fetch` directly, which keeps URLs, payloads and return types in one place.
 */

import { api, downloadFile, toQuery } from './client';
import type {
  About,
  AdminCounters,
  AdminPersonRow,
  AdminStats,
  AuthResponse,
  BlogCategory,
  Book,
  BookPayload,
  HealthResponse,
  HomeOverview,
  Lab,
  LabPayload,
  LoginPayload,
  Post,
  PostPayload,
  PostSummary,
  ProfileUpdate,
  ProgressDashboard,
  ProgressEntry,
  ProgressPayload,
  ResourcePayload,
  ServiceInfo,
  Shelf,
  ShelfPayload,
  ShelfResource,
  ShelfSummary,
  SignupPayload,
  TrackedResourceType,
  User,
} from '../types';

/* ---------------------------------------------------------------- auth & me */
export const authApi = {
  signup: (payload: SignupPayload): Promise<AuthResponse> =>
    api<AuthResponse>('/api/auth/signup', { method: 'POST', body: payload }),

  login: (payload: LoginPayload): Promise<AuthResponse> =>
    api<AuthResponse>('/api/auth/login', { method: 'POST', body: payload }),

  me: (): Promise<User> => api<User>('/api/auth/me'),

  updateProfile: (payload: ProfileUpdate): Promise<User> =>
    api<User>('/api/users/me', { method: 'PATCH', body: payload }),

  changePassword: (currentPassword: string, newPassword: string): Promise<User> =>
    api<User>('/api/users/me/password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
    }),

  deleteAccount: (): Promise<void> => api<void>('/api/users/me', { method: 'DELETE' }),
};

/* ------------------------------------------------------------------ content */
export const contentApi = {
  home: (): Promise<HomeOverview> => api<HomeOverview>('/api/content/home'),
  about: (): Promise<About> => api<About>('/api/content/about'),

  shelves: (kind?: string): Promise<Shelf[]> =>
    api<Shelf[]>(`/api/shelves${toQuery({ kind })}`),
  shelf: (slug: string): Promise<Shelf> => api<Shelf>(`/api/shelves/${encodeURIComponent(slug)}`),
  resource: (id: number): Promise<ShelfResource> => api<ShelfResource>(`/api/resources/${id}`),

  books: (params: { category?: string; search?: string } = {}): Promise<Book[]> =>
    api<Book[]>(`/api/books${toQuery(params)}`),
  book: (slug: string): Promise<Book> => api<Book>(`/api/books/${encodeURIComponent(slug)}`),
  downloadBook: (slug: string): Promise<void> =>
    downloadFile(`/api/books/${encodeURIComponent(slug)}/download`, `${slug}.pdf`),

  labs: (category?: string): Promise<Lab[]> =>
    api<Lab[]>(`/api/labs${toQuery({ category })}`),
  lab: (slug: string): Promise<Lab> => api<Lab>(`/api/labs/${encodeURIComponent(slug)}`),

  posts: (
    params: { category?: BlogCategory | ''; search?: string; limit?: number } = {},
  ): Promise<PostSummary[]> => api<PostSummary[]>(`/api/posts${toQuery(params)}`),
  post: (slug: string): Promise<Post> => api<Post>(`/api/posts/${encodeURIComponent(slug)}`),
};

/* ----------------------------------------------------------------- progress */
export const progressApi = {
  dashboard: (): Promise<ProgressDashboard> => api<ProgressDashboard>('/api/progress'),

  entries: (
    params: { resource_type?: TrackedResourceType; status?: string; limit?: number } = {},
  ): Promise<ProgressEntry[]> => api<ProgressEntry[]>(`/api/progress/entries${toQuery(params)}`),

  track: (payload: ProgressPayload): Promise<ProgressEntry> =>
    api<ProgressEntry>('/api/progress', { method: 'PUT', body: payload }),

  complete: (entryId: number): Promise<ProgressEntry> =>
    api<ProgressEntry>(`/api/progress/${entryId}/complete`, { method: 'POST' }),

  /** The entry is identified by the path, so only the note travels in the body. */
  saveNotes: (entry: ProgressEntry, notes: string): Promise<ProgressEntry> =>
    api<ProgressEntry>(`/api/progress/${entry.id}/notes`, {
      method: 'PATCH',
      body: { notes },
    }),

  remove: (entryId: number): Promise<void> =>
    api<void>(`/api/progress/${entryId}`, { method: 'DELETE' }),
};

/* -------------------------------------------------------------------- admin */
export const adminApi = {
  stats: (): Promise<AdminStats> => api<AdminStats>('/api/admin/stats'),
  counters: (): Promise<AdminCounters> =>
    api<AdminStats>('/api/admin/stats').then((stats) => stats.counters),

  /* people */
  people: (search?: string): Promise<AdminPersonRow[]> =>
    api<AdminPersonRow[]>(`/api/admin/people${toQuery({ search })}`),
  setRole: (userId: number, role: 'admin' | 'user'): Promise<AdminPersonRow> =>
    api<AdminPersonRow>(`/api/admin/people/${userId}/role`, { method: 'PATCH', body: { role } }),
  setActive: (userId: number, isActive: boolean): Promise<AdminPersonRow> =>
    api<AdminPersonRow>(`/api/admin/people/${userId}/active`, {
      method: 'PATCH',
      body: { is_active: isActive },
    }),
  deletePerson: (userId: number): Promise<void> =>
    api<void>(`/api/admin/people/${userId}`, { method: 'DELETE' }),

  /* shelves */
  shelves: (): Promise<ShelfSummary[]> => api<ShelfSummary[]>('/api/admin/shelves'),
  /** One shelf including its unpublished cards (admin card editor). */
  shelf: (id: number): Promise<Shelf> => api<Shelf>(`/api/admin/shelves/${id}`),
  createShelf: (payload: ShelfPayload): Promise<Shelf> =>
    api<Shelf>('/api/admin/shelves', { method: 'POST', body: payload }),
  updateShelf: (id: number, payload: Partial<ShelfPayload>): Promise<Shelf> =>
    api<Shelf>(`/api/admin/shelves/${id}`, { method: 'PATCH', body: payload }),
  deleteShelf: (id: number): Promise<void> =>
    api<void>(`/api/admin/shelves/${id}`, { method: 'DELETE' }),

  /* shelf resources */
  createResource: (payload: ResourcePayload): Promise<ShelfResource> =>
    api<ShelfResource>('/api/admin/resources', { method: 'POST', body: payload }),
  updateResource: (id: number, payload: Partial<ResourcePayload>): Promise<ShelfResource> =>
    api<ShelfResource>(`/api/admin/resources/${id}`, { method: 'PATCH', body: payload }),
  deleteResource: (id: number): Promise<void> =>
    api<void>(`/api/admin/resources/${id}`, { method: 'DELETE' }),

  /* books */
  books: (): Promise<Book[]> => api<Book[]>('/api/admin/books'),
  createBook: (payload: BookPayload): Promise<Book> =>
    api<Book>('/api/admin/books', { method: 'POST', body: payload }),
  updateBook: (id: number, payload: BookPayload): Promise<Book> =>
    api<Book>(`/api/admin/books/${id}`, { method: 'PATCH', body: payload }),
  deleteBook: (id: number): Promise<void> => api<void>(`/api/admin/books/${id}`, { method: 'DELETE' }),

  /* labs */
  labs: (): Promise<Lab[]> => api<Lab[]>('/api/admin/labs'),
  createLab: (payload: LabPayload): Promise<Lab> =>
    api<Lab>('/api/admin/labs', { method: 'POST', body: payload }),
  updateLab: (id: number, payload: LabPayload): Promise<Lab> =>
    api<Lab>(`/api/admin/labs/${id}`, { method: 'PATCH', body: payload }),
  deleteLab: (id: number): Promise<void> => api<void>(`/api/admin/labs/${id}`, { method: 'DELETE' }),

  /* posts */
  posts: (): Promise<Post[]> => api<Post[]>('/api/admin/posts'),
  createPost: (payload: PostPayload): Promise<Post> =>
    api<Post>('/api/admin/posts', { method: 'POST', body: payload }),
  updatePost: (id: number, payload: PostPayload): Promise<Post> =>
    api<Post>(`/api/admin/posts/${id}`, { method: 'PATCH', body: payload }),
  deletePost: (id: number): Promise<void> => api<void>(`/api/admin/posts/${id}`, { method: 'DELETE' }),

  /* editable landing copy */
  siteContent: (): Promise<{ hero: HomeOverview['hero']; about: About }> =>
    api<{ hero: HomeOverview['hero']; about: About }>('/api/admin/site-content'),
  updateHero: (hero: HomeOverview['hero']): Promise<HomeOverview['hero']> =>
    api<HomeOverview['hero']>('/api/admin/site-content/hero', { method: 'PUT', body: hero }),
  updateAbout: (about: About): Promise<About> =>
    api<About>('/api/admin/site-content/about', { method: 'PUT', body: about }),

  /* maintenance */
  reseed: (): Promise<{ reseeded: Record<string, unknown>; note: string }> =>
    api<{ reseeded: Record<string, unknown>; note: string }>('/api/admin/reseed', { method: 'POST' }),
};

/* ------------------------------------------------------------------- system */
export const systemApi = {
  health: (): Promise<HealthResponse> => api<HealthResponse>('/api/health', { anonymous: true }),

  /**
   * Public service card. Also carries the demo learner credentials when the
   * server seeded one, which is how the sign-in page can offer a one-click
   * demo login without hard-coding anything.
   */
  info: (): Promise<ServiceInfo> => api<ServiceInfo>('/api/info', { anonymous: true }),
};
