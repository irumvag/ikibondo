import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RegisterForm } from './RegisterForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('meta'))('register') };
}

export default function RegisterPage() {
  return (
    <main
      className="min-h-[calc(100vh-7rem)] flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="w-full max-w-lg">
        <RegisterForm />
      </div>
    </main>
  );
}
