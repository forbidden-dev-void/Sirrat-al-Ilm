/**
 * SettingsPanel — profile settings for the signed-in learner.
 *
 * Deliberately contains **no** administrative controls: a regular user can edit
 * their own profile, change their own password and delete their own account.
 * Everything else (content, people, analytics) lives in /admin.
 */

import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../lib/format';
import {
  validateFullName,
  validatePassword,
  validateRequired,
  validateUrl,
} from '../../lib/validation';
import { Button } from '../ui/Button';
import { TextField, TextAreaField } from '../ui/Field';
import { ConfirmDialog } from '../ui/Modal';

export function SettingsPanel(): JSX.Element {
  const { user, setUser, signOut } = useAuth();
  const { success, error: notifyError } = useToast();

  const [profile, setProfile] = useState({
    full_name: user?.full_name ?? '',
    bio: user?.bio ?? '',
    occupation: user?.occupation ?? '',
    location: user?.location ?? '',
    avatar_url: user?.avatar_url ?? '',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string | undefined>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string | undefined>>({});
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return <p className="panel__muted">Loading your profile…</p>;

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const errors: Record<string, string | undefined> = {
      full_name: validateFullName(profile.full_name) ?? undefined,
      avatar_url: validateUrl(profile.avatar_url) ?? undefined,
    };
    setProfileErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setSavingProfile(true);
    try {
      const updated = await authApi.updateProfile({
        full_name: profile.full_name.trim(),
        bio: profile.bio || null,
        occupation: profile.occupation || null,
        location: profile.location || null,
        avatar_url: profile.avatar_url || null,
      });
      setUser(updated);
      success('Profile updated', 'Your details are saved.');
    } catch (caught) {
      notifyError('Could not save', caught instanceof ApiError ? caught.message : 'Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const errors: Record<string, string | undefined> = {
      current: validateRequired('Current password')(passwords.current) ?? undefined,
      next: validatePassword(passwords.next) ?? undefined,
      confirm: passwords.next === passwords.confirm ? undefined : 'Passwords do not match',
    };
    setPasswordErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setSavingPassword(true);
    try {
      await authApi.changePassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '', confirm: '' });
      success('Password changed', 'Use your new password next time you sign in.');
    } catch (caught) {
      notifyError('Could not change password', caught instanceof ApiError ? caught.message : 'Please try again.');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      success('Account deleted', 'Your history was removed.');
      signOut();
    } catch (caught) {
      notifyError('Could not delete account', caught instanceof ApiError ? caught.message : 'Please try again.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="settings">
      {/* ---------------------------------------------------------- profile */}
      <section className="panel" aria-labelledby="settings-profile">
        <h2 className="panel__title" id="settings-profile">
          Profile
        </h2>
        <p className="panel__muted">
          Member since {formatDate(user.created_at)} · {user.email}
        </p>

        <form className="form-grid" onSubmit={handleProfileSubmit} noValidate>
          <TextField
            label="Full name"
            id="settings-name"
            required
            value={profile.full_name}
            error={profileErrors.full_name}
            onChange={(event) => setProfile({ ...profile, full_name: event.target.value })}
          />
          <TextField
            label="Occupation"
            id="settings-occupation"
            placeholder="Student, engineer, teacher…"
            value={profile.occupation}
            onChange={(event) => setProfile({ ...profile, occupation: event.target.value })}
          />
          <TextField
            label="Location"
            id="settings-location"
            placeholder="City, country"
            value={profile.location}
            onChange={(event) => setProfile({ ...profile, location: event.target.value })}
          />
          <TextField
            label="Avatar URL"
            id="settings-avatar"
            type="url"
            placeholder="https://…"
            hint="Optional — leave blank to use your initials."
            value={profile.avatar_url}
            error={profileErrors.avatar_url}
            onChange={(event) => setProfile({ ...profile, avatar_url: event.target.value })}
          />
          <TextAreaField
            label="About you"
            id="settings-bio"
            rows={3}
            maxLength={1000}
            placeholder="A sentence or two about what you are learning."
            value={profile.bio}
            onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
          />
          <div className="panel__actions">
            <Button type="submit" loading={savingProfile}>
              Save profile
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setProfile({
                  full_name: user.full_name,
                  bio: user.bio ?? '',
                  occupation: user.occupation ?? '',
                  location: user.location ?? '',
                  avatar_url: user.avatar_url ?? '',
                })
              }
            >
              Reset
            </Button>
          </div>
        </form>
      </section>

      {/* --------------------------------------------------------- password */}
      <section className="panel" aria-labelledby="settings-password">
        <h2 className="panel__title" id="settings-password">
          Password
        </h2>
        <p className="panel__muted">
          Passwords are hashed with PBKDF2-SHA256. Changing it signs nothing else out, but you will
          need the new one next time.
        </p>

        <form className="form-grid" onSubmit={handlePasswordSubmit} noValidate>
          <TextField
            label="Current password"
            id="settings-current"
            type="password"
            autoComplete="current-password"
            required
            value={passwords.current}
            error={passwordErrors.current}
            onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
          />
          <TextField
            label="New password"
            id="settings-new"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters with a letter and a number."
            value={passwords.next}
            error={passwordErrors.next}
            onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
          />
          <TextField
            label="Confirm new password"
            id="settings-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={passwords.confirm}
            error={passwordErrors.confirm}
            onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
          />
          <div className="panel__actions">
            <Button type="submit" loading={savingPassword}>
              Update password
            </Button>
          </div>
        </form>
      </section>

      {/* -------------------------------------------------------- dangerous */}
      <section className="panel panel--danger" aria-labelledby="settings-danger">
        <h2 className="panel__title" id="settings-danger">
          Delete account
        </h2>
        <p className="panel__muted">
          This removes your profile and every progress row (watched videos, books, notes). It cannot
          be undone.
        </p>
        <div className="panel__actions">
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete my account
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete your account?"
        message={`This permanently removes ${user.email} and all of its learning history.`}
        confirmLabel="Yes, delete it"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
