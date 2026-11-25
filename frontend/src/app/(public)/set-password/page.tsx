import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SetPasswordForm } from './SetPasswordForm';

export const metadata: Metadata = { title: 'Set your password', robots: { index: false } };

export default function SetPasswordPage() {
  return (
    <main
      className="min-h-[calc(100vh-7rem)] flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="w-full max-w-md">
        <Suspense>
          <SetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
