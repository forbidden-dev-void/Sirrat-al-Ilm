/**
 * Shared TypeScript types
 * =======================
 *
 * These mirror the FastAPI/Pydantic schemas one-to-one, so the front end is
 * fully typed end to end. Keep this file in sync with `backend/app/schemas`.
 */

/* ------------------------------------------------------------------ users */
export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  bio: string | null;
  avatar_url: string | null;
  occupation: string | null;
  location: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface UserSummary {
  id: number;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
}

/* ------------------------------------------------------------------- auth */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in_minutes: number;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
  is_admin: boolean;
}

export interface SignupPayload {
  full_name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ProfileUpdate {
  full_name?: string;
  bio?: string | null;
  avatar_url?: string | null;
  occupation?: string | null;
  location?: string | null;
}

/* ------------------------------------------------------------------ shelves */
export type ShelfKind = 'wisdom' | 'programming' | 'tech' | 'books' | 'life';
export type ResourceType = 'video' | 'playlist' | 'link';

export interface ShelfResource {
  id: number;
  shelf_id: number;
  title: string;
  description: string;
  resource_type: ResourceType;
  external_url: string | null;
  video_id: string | null;
  thumbnail_url: string | null;
  channel: string | null;
  duration_label: string | null;
  lesson_count: number | null;
  level: string | null;
  language: string | null;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
}

export interface Shelf {
  id: number;
  title: string;
  slug: string;
  kind: ShelfKind;
  subtitle: string | null;
  description: string;
  cover_image: string | null;
  accent: string | null;
  is_published: boolean;
  sort_order: number;
  resources: ShelfResource[];
  created_at: string;
}

export interface ShelfSummary extends Omit<Shelf, 'resources'> {
  resource_count: number;
}

export interface ShelfPayload {
  title: string;
  slug: string;
  kind: ShelfKind;
  subtitle?: string | null;
  description?: string;
  cover_image?: string | null;
  accent?: string | null;
  is_published?: boolean;
  sort_order?: number;
  resources?: ResourcePayload[];
}

export interface ResourcePayload {
  shelf_id?: number;
  title: string;
  description?: string;
  resource_type?: ResourceType;
  external_url?: string | null;
  video_id?: string | null;
  thumbnail_url?: string | null;
  channel?: string | null;
  duration_label?: string | null;
  lesson_count?: number | null;
  level?: string | null;
  language?: string | null;
  is_published?: boolean;
  is_featured?: boolean;
  sort_order?: number;
}

/* ------------------------------------------------------------------- books */
export interface TocEntry {
  chapter: string;
  title: string;
  pages?: string | null;
}

export interface Book {
  id: number;
  title: string;
  slug: string;
  subtitle: string | null;
  author: string;
  description: string;
  cover_url: string | null;
  file_url: string | null;
  category: string | null;
  tags: string[];
  language: string;
  pages: number | null;
  edition: string | null;
  published_on: string | null;
  is_free: boolean;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  download_count: number;
  table_of_contents: TocEntry[];
  created_at: string;
  updated_at: string;
}

export type BookPayload = Partial<Omit<Book, 'id' | 'created_at' | 'updated_at' | 'download_count'>>;

/* -------------------------------------------------------------------- labs */
export type AvailabilityStatus = 'available' | 'in_progress' | 'archived' | 'draft';

export interface GalleryImage {
  url: string;
  caption?: string | null;
  alt?: string | null;
}

export interface Lab {
  id: number;
  owner_id: number;
  title: string;
  slug: string;
  description: string;
  summary: string | null;
  image_url: string | null;
  category: string | null;
  kind: string;
  availability_status: AvailabilityStatus;
  gallery: GalleryImage[];
  tags: string[];
  external_url: string | null;
  is_featured: boolean;
  sort_order: number;
  owner: UserSummary | null;
  created_at: string;
  updated_at: string;
}

export type LabPayload = Partial<Omit<Lab, 'id' | 'owner' | 'owner_id' | 'created_at' | 'updated_at'>>;

/* -------------------------------------------------------------------- blog */
export type BlogCategory = 'religion' | 'tech' | 'life' | 'programming' | 'books';

export interface PostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image: string | null;
  category: BlogCategory;
  tags: string[];
  reading_minutes: number;
  view_count: number;
  is_published: boolean;
  is_featured: boolean;
  published_at: string | null;
  author: UserSummary | null;
}

export interface Post extends PostSummary {
  body: string;
}

export type PostPayload = Partial<Omit<Post, 'id' | 'author' | 'created_at' | 'view_count'>>;

/* ---------------------------------------------------------------- progress */
export type TrackedResourceType = 'video' | 'book' | 'blog' | 'lab';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface ProgressEntry {
  id: number;
  user_id: number;
  resource_type: TrackedResourceType;
  resource_id: number;
  resource_title: string;
  resource_slug: string | null;
  meta: Record<string, unknown>;
  status: ProgressStatus;
  progress_percent: number;
  notes: string | null;
  last_accessed_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressPayload {
  resource_type: TrackedResourceType;
  resource_id: number;
  status?: ProgressStatus;
  progress_percent?: number;
  notes?: string | null;
}

export interface ProgressTotals {
  tracked: number;
  completed: number;
  in_progress: number;
  completion_rate: number;
  videos: number;
  books: number;
  blogs: number;
  labs: number;
}

export interface ProgressTypeStat {
  key: TrackedResourceType;
  label: string;
  available: number;
  started: number;
  completed: number;
  percent: number;
}

export interface ProgressDashboard {
  totals: ProgressTotals;
  by_type: ProgressTypeStat[];
  continue_learning: ProgressEntry[];
  completed: ProgressEntry[];
  saved: ProgressEntry[];
  recent_activity: ProgressEntry[];
}

/* ----------------------------------------------------------------- content */
export interface SiteMeta {
  app_name: string;
  tagline: string;
  version: string;
  owner: string;
  youtube_channel: string;
  contact_email: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field?: string | null;
  period?: string | null;
  detail?: string | null;
}

export interface ExperienceEntry {
  role: string;
  organisation: string;
  period?: string | null;
  location?: string | null;
  detail?: string | null;
  highlights?: string[];
}

export interface SocialLink {
  label: string;
  url: string;
  icon?: string | null;
}

export interface About {
  headline: string;
  intro: string;
  portrait_url: string | null;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  skills: string[];
  languages: string[];
  socials: SocialLink[];
  facts: Record<string, string>;
}

export interface Hero {
  eyebrow: string;
  title: string;
  highlight: string;
  subtitle: string;
  primary_cta_label: string;
  primary_cta_href: string;
  secondary_cta_label: string;
  secondary_cta_href: string;
}

export interface ContentStats {
  shelves: number;
  videos: number;
  books: number;
  labs: number;
  posts: number;
}

export interface HomeOverview {
  site: SiteMeta;
  hero: Hero;
  about: About;
  stats: ContentStats;
  shelves: Shelf[];
  books: Book[];
  labs: Lab[];
  posts: PostSummary[];
}

/* ------------------------------------------------------------------- admin */
export interface AdminCounters {
  users: number;
  admins: number;
  new_users_last_7_days: number;
  shelves: number;
  resources: number;
  books: number;
  labs: number;
  posts: number;
  drafts: number;
  progress_entries: number;
  completions: number;
  book_downloads: number;
  post_views: number;
}

export interface TopResource {
  resource_type: string;
  resource_id: number;
  title: string;
  engaged: number;
  completed: number;
}

export interface AdminActivityRow {
  id: number;
  user_id: number;
  user_name: string;
  resource_type: string;
  title: string;
  status: ProgressStatus;
  progress_percent: number;
  at: string;
}

export interface AdminStats {
  counters: AdminCounters;
  top_resources: TopResource[];
  recent_activity: AdminActivityRow[];
}

export interface AdminPersonRow {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  progress_count: number;
  completed_count: number;
}

/* -------------------------------------------------------------------- misc */
/** Shape of GET /api/info — the public service card. */
export interface DemoAccount {
  email: string;
  password: string;
}

export interface ServiceInfo {
  name: string;
  tagline: string;
  version: string;
  docs: string;
  health: string;
  /** Present only when the server seeded the public demo learner. */
  demo_account: DemoAccount | null;
}

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  environment: string;
  database: { ok: boolean; detail: string; backend: string };
}

/** Shape returned by the API's validation handler. */
export interface ApiErrorBody {
  detail: string;
  errors?: { field: string; message: string; type: string }[];
}
