'use client';

import { useState } from 'react';
import { KeyRound, Mail, Save, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';

function ProfileCard() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const unchanged = name.trim() === user.name && email.trim().toLowerCase() === user.email;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.patch('/auth/profile', { name: name.trim(), email: email.trim() });
      setUser(res.data.user);
      toast.success('Profile updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
      <p className="mt-1 text-sm text-slate-600">
        Your role is <strong>{ROLE_LABELS[user.role] || user.role}</strong>. Only an administrator can
        change roles.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <Field label="Full name" icon={UserIcon} value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Email" type="email" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" icon={Save} loading={saving} disabled={unchanged}>
          Save changes
        </Button>
      </form>
    </section>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await api.patch('/auth/change-password', form);
      toast.success('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
      <p className="mt-1 text-sm text-slate-600">
        Use at least 8 characters with a letter and a number. Other devices will be signed out.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <Field
          label="Current password"
          type="password"
          autoComplete="current-password"
          icon={KeyRound}
          value={form.currentPassword}
          onChange={update('currentPassword')}
        />
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          icon={KeyRound}
          value={form.newPassword}
          onChange={update('newPassword')}
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          icon={KeyRound}
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button
          type="submit"
          icon={Save}
          loading={saving}
          disabled={!form.currentPassword || !form.newPassword || !form.confirmPassword}
        >
          Update password
        </Button>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My profile</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
      </div>
    </div>
  );
}