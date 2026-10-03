import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import PageLoader from '@/components/ui/PageLoader';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  );
}