import type { Metadata } from 'next';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Request access' };

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
