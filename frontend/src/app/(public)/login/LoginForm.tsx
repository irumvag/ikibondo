'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { loginSchema, type LoginFormValues } from '@/lib/schemas/auth';
import { loginUser } from '@/lib/api/auth';
import { useAuthStore, type UserRole } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const ROLE_ROUTES: Record<UserRole, string> = {
  ADMIN:      '/admin',
  SUPERVISOR: '/supervisor',
  NURSE:      '/nurse',
  CHW:        '/chw',
  PARENT:     '/parent',
};

export function LoginForm() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPw,   setShowPw]   = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setApiError('');
    try {
      const { access, refresh, user } = await loginUser(values);
      setAuth(user, access, refresh);
      if (user.must_change_password) {
        router.push('/profile?force=1');
      } else {
        router.push(ROLE_ROUTES[user.role] ?? '/');
      }
    } catch (err: unknown) {
      const e = err as {
        response?: {
          data?: {
            error?: { detail?: string };
            detail?: string;
            non_field_errors?: string[];
          };
        };
      };
      const d = e?.response?.data;
      const msg =
        d?.error?.detail ??
        d?.detail ??
        d?.non_field_errors?.[0] ??
        'Invalid credentials. Please try again.';
      setApiError(msg);
    }
  };

  return (
    <div
      className="p-8 rounded-2xl"
      style={{
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Welcome back
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sign in to your Ikibondo account
        </p>
      </div>

      {/* API error */}
      {apiError && (
        <div className="mb-5">
          <Alert variant="danger">{apiError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input
          label="Email or phone number"
          type="text"
          placeholder="you@example.com or +250 7XX XXX XXX"
          autoComplete="username"
          required
          error={errors.identifier?.message}
          {...register('identifier')}
        />

        {/* Password with show/hide */}
        <div className="relative">
          <Input
            label="Password"
            type={showPw ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            className="absolute right-3 transition-colors"
            style={{
              top: errors.password ? '2.05rem' : '2.3rem',
              color: 'var(--text-muted)',
            }}
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <Button
          type="submit"
          loading={isSubmitting}
          variant="primary"
          size="lg"
          className="mt-2 w-full"
        >
          <LogIn size={18} aria-hidden="true" />
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-semibold underline-offset-2 hover:underline"
          style={{ color: 'var(--ink)' }}
        >
          Request access
        </Link>
      </p>
    </div>
  );
}
