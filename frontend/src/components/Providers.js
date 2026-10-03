'use client';

import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';

export default function Providers({ children }) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontSize: '14px', color: '#0f172a' },
        }}
      />
    </AuthProvider>
  );
}