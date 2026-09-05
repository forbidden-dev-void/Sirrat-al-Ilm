/**
 * useProgressLibrary — client-side learning progress store
 * ========================================================
 *
 * Loads every progress row for the signed-in user once, keeps it in a lookup
 * map (`video:12` -> entry) so any card can render its state without extra
 * requests, and exposes typed mutators that update the map optimistically.
 *
 * This is the piece that makes the user dashboard meaningful: watching a video
 * on the home page immediately shows up under "Continue watching".
 */

import { useCallback, useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { progressApi } from '../api/endpoints';
import { useToast } from '../context/ToastContext';
import type { Book, Lab, PostSummary, ProgressEntry, ShelfResource, TrackedResourceType } from '../types';
import { useApi } from './useApi';

export function progressKey(type: TrackedResourceType, id: number): string {
  return `${type}:${id}`;
}

export interface ProgressLibrary {
  entries: Record<string, ProgressEntry>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  busyKey: string | null;
  forVideo: (resource: ShelfResource) => ProgressEntry | null;
  forBook: (book: Book) => ProgressEntry | null;
  forPost: (post: PostSummary) => ProgressEntry | null;
  forLab: (lab: Lab) => ProgressEntry | null;
  markVideoOpened: (resource: ShelfResource) => Promise<void>;
  markComplete: (type: TrackedResourceType, id: number) => Promise<void>;
  setPercent: (type: TrackedResourceType, id: number, percent: number) => Promise<void>;
  saveNotes: (entry: ProgressEntry, notes: string) => Promise<void>;
  undo: (entry: ProgressEntry) => Promise<void>;
  remove: (entry: ProgressEntry) => Promise<void>;
}

export function useProgressLibrary(): ProgressLibrary {
  const { success, error: notifyError } = useToast();
  const { data, loading, error, reload, setData } = useApi<ProgressEntry[]>(
    () => progressApi.entries({ limit: 500 }),
    [],
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const entries = useMemo<Record<string, ProgressEntry>>(() => {
    const map: Record<string, ProgressEntry> = {};
    for (const entry of data ?? []) {
      map[progressKey(entry.resource_type as TrackedResourceType, entry.resource_id)] = entry;
    }
    return map;
  }, [data]);

  /** Replace one row in the local cache after a mutation. */
  const applyEntry = useCallback(
    (entry: ProgressEntry | null, key?: string): void => {
      setData((current) => {
        const list = current ?? [];
        if (entry === null && key) return list.filter((row) => progressKey(row.resource_type, row.resource_id) !== key);
        if (!entry) return list;
        const index = list.findIndex(
          (row) => row.resource_type === entry.resource_type && row.resource_id === entry.resource_id,
        );
        if (index === -1) return [entry, ...list];
        const next = [...list];
        next[index] = entry;
        return next;
      });
    },
    [setData],
  );

  const run = useCallback(
    async (
      key: string,
      action: () => Promise<ProgressEntry | void>,
      successMessage?: string,
    ): Promise<void> => {
      setBusyKey(key);
      try {
        const result = await action();
        if (result && typeof result === 'object' && 'resource_type' in result) {
          applyEntry(result as ProgressEntry);
        }
        if (successMessage) success('Saved', successMessage);
      } catch (caught) {
        const message = caught instanceof ApiError ? caught.message : 'Could not save your progress.';
        notifyError('Progress not saved', message);
      } finally {
        setBusyKey(null);
      }
    },
    [applyEntry, notifyError, success],
  );

  const markVideoOpened = useCallback(
    (resource: ShelfResource): Promise<void> => {
      const key = progressKey('video', resource.id);
      const existing = entries[key];
      // Opening a video for the first time starts it at 10%; re-opening keeps
      // the learner's furthest point instead of resetting it.
      const percent = existing ? Math.max(existing.progress_percent, 10) : 10;
      return run(key, () =>
        progressApi.track({
          resource_type: 'video',
          resource_id: resource.id,
          progress_percent: percent,
          status: percent >= 100 ? 'completed' : 'in_progress',
        }),
      );
    },
    [entries, run],
  );

  const markComplete = useCallback(
    (type: TrackedResourceType, id: number): Promise<void> =>
      run(progressKey(type, id), () => progressApi.track({ resource_type: type, resource_id: id, progress_percent: 100, status: 'completed' }), 'Marked as completed.'),
    [run],
  );

  const setPercent = useCallback(
    (type: TrackedResourceType, id: number, percent: number): Promise<void> =>
      run(progressKey(type, id), () =>
        progressApi.track({
          resource_type: type,
          resource_id: id,
          progress_percent: percent,
          status: percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started',
        }),
      ),
    [run],
  );

  const saveNotes = useCallback(
    (entry: ProgressEntry, notes: string): Promise<void> =>
      run(
        progressKey(entry.resource_type, entry.resource_id),
        () => progressApi.saveNotes(entry, notes),
        'Note saved.',
      ),
    [run],
  );

  const undo = useCallback(
    (entry: ProgressEntry): Promise<void> =>
      run(
        progressKey(entry.resource_type, entry.resource_id),
        () =>
          progressApi.track({
            resource_type: entry.resource_type,
            resource_id: entry.resource_id,
            progress_percent: 0,
            status: 'not_started',
          }),
        'Moved back to saved.',
      ),
    [run],
  );

  const remove = useCallback(
    (entry: ProgressEntry): Promise<void> =>
      run(
        progressKey(entry.resource_type, entry.resource_id),
        async () => {
          await progressApi.remove(entry.id);
          applyEntry(null, progressKey(entry.resource_type, entry.resource_id));
        },
        'Removed from your history.',
      ),
    [applyEntry, run],
  );

  return {
    entries,
    loading,
    error,
    reload,
    busyKey,
    forVideo: (resource) => entries[progressKey('video', resource.id)] ?? null,
    forBook: (book) => entries[progressKey('book', book.id)] ?? null,
    forPost: (post) => entries[progressKey('blog', post.id)] ?? null,
    forLab: (lab) => entries[progressKey('lab', lab.id)] ?? null,
    markVideoOpened,
    markComplete,
    setPercent,
    saveNotes,
    undo,
    remove,
  };
}
