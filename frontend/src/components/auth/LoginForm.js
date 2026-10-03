'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  PackagePlus,
  ScanBarcode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Logo from '@/components/ui/Logo';
import PageLoader from '@/components/ui/PageLoader';

// Only allow redirects to paths inside this app (prevents open-redirect attacks)
const safeNextPath = (value) => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
    return '/dashboard';
  }
  return value;
};

const STEPS = [
  {
    icon: PackagePlus,
    title: 'Add your products',
    text: 'Set up categories, brands, prices and stock levels.',
  },
  {
    icon: ScanBarcode,
    title: 'Sell from the POS',
    text: 'Search by name, SKU or barcode and print invoices.',
  },
  {
    icon: BarChart3,
    title: 'Track stock and reports',
    text: 'Watch inventory, purchases and revenue in real time.',
  },
];

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const { user, loading, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && user) router.replace(nextPath);
  }, [loading, user, nextPath, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const signedInUser = await login(email.trim(), password);
      toast.success(`Welcome back, ${signedInUser.name}`);
      router.replace(nextPath);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading || user) return <PageLoader label="Checking your session..." />;

  return (
    <main className="grid min-h-screen bg-night p-3 lg:grid-cols-2 lg:gap-6 lg:p-4">
      {/* Brand panel */}
      <section
        className="relative hidden overflow-hidden rounded-[32px] lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12"
        style={{
          background:
            'linear-gradient(180deg, #c9f7d6 0%, #3fd873 16%, #12803a 38%, #06200f 62%, #020805 100%)',
        }}
      >
        <Logo tone="light" size="lg" />
        <h1 className="mt-6 text-center text-4xl font-bold leading-tight text-white">
          Run your shop with confidence
        </h1>
        <p className="mt-3 max-w-sm text-center text-sm text-white/70">
          Three simple steps to manage inventory, sales and reports in one place.
        </p>

        <ol className="relative mt-10 w-full max-w-sm space-y-4 pl-9 before:absolute before:bottom-8 before:left-3 before:top-8 before:w-px before:bg-white/20">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="relative rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <span className="absolute -left-9 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/40 bg-night" />
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon className="h-4 w-4 text-brand-300" aria-hidden="true" />
                {title}
              </div>
              <p className="mt-1 text-xs text-white/60">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center p-4 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex justify-center lg:hidden">
            <Logo tone="light" />
          </div>

          <h2 className="text-center text-3xl font-bold tracking-tight text-white">Sign in to Stockify</h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Enter your details to access your account.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <Field
              tone="dark"
              label="Email address"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            <Field
              tone="dark"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded p-1.5 text-slate-400 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              }
            />
            <Button
              type="submit"
              variant="brand"
              size="lg"
              icon={LogIn}
              loading={submitting}
              className="w-full rounded-2xl"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Need an account? Ask your administrator to create one.
          </p>
        </div>
      </section>
    </main>
  );
}