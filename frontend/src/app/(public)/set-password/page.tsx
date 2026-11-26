import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { SetPasswordForm } from './SetPasswordForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('meta'))('setPassword'), robots: { index: false } };
}

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
