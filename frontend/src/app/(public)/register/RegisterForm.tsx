'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import {
  registerSchema,
  type RegisterFormValues,
  LANGUAGE_LABELS,
} from '@/lib/schemas/auth';
import { registerUser } from '@/lib/api/auth';
import { usePublicCamps } from '@/lib/api/queries';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const SELECT_CLASS =
  'w-full px-3 py-2.5 rounded-xl border text-sm transition-colors ' +
  'bg-[var(--bg-elev)] text-[var(--text)] ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:border-transparent';

export function RegisterForm() {
  const [success,  setSuccess]  = useState(false);
  const [apiError, setApiError] = useState('');
  const { data: camps = [] }    = usePublicCamps();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(registerSchema) as any,
    defaultValues: { preferred_language: 'rw' as const },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setApiError('');
    try {
      await registerUser({
        full_name:          values.full_name,
        phone_number:       values.phone_number,
        password:           values.password,
        role:               'PARENT', // self-signup is always PARENT
        preferred_language: values.preferred_language ?? 'rw',
        ...(values.email ? { email: values.email } : {}),
        ...(values.camp  ? { camp:  values.camp  } : {}),
      });
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as {
        response?: {
          data?: Record<string, unknown> & {
            error?: { detail?: string };
            detail?: string;
          };
        };
      };
      const d = e?.response?.data;
      const msg =
        d?.error?.detail ??
        d?.detail ??
        (d
          ? Object.entries(d)
              .filter(([k]) => !['status', 'error'].includes(k))
              .flatMap(([, v]) => (Array.isArray(v) ? v : [String(v)]))
              .slice(0, 3)
              .join(' ')
          : 'Registration failed. Please try again.');
      setApiError(String(msg));
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <div
        className="p-8 rounded-2xl text-center"
        style={{
          backgroundColor: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <CheckCircle
          size={48}
          className="mx-auto mb-4"
          style={{ color: 'var(--success)' }}
          aria-hidden="true"
        />
        <h2
          className="text-xl font-bold mb-3"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Account created!
        </h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Your account is pending approval by your camp supervisor or
          administrator. You&apos;ll receive an email once your account is activated.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="p-8 rounded-2xl"
      style={{
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div className="mb-6 text-center">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Parent / guardian sign-up
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Create your account — pending supervisor approval.
        </p>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Health workers (CHW, Nurse, Supervisor)? Ask your supervisor or admin to create your account.
        </p>
      </div>

      {apiError && (
        <div
          className="mb-5 px-4 py-3 rounded-xl text-sm"
          role="alert"
          style={{
            backgroundColor: 'var(--high-bg)',
            color: 'var(--danger)',
            border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
          }}
        >
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">

        <Input
          label="Full name"
          type="text"
          placeholder="Gentille Tumukunde"
          autoComplete="name"
          required
          error={errors.full_name?.message}
          {...register('full_name')}
        />

        <Input
          label="Phone number"
          type="tel"
          placeholder="+250 7XX XXX XXX"
          autoComplete="tel"
          required
          hint="Used to log in — keep it reachable"
          error={errors.phone_number?.message}
          {...register('phone_number')}
        />

        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com (optional)"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Language preference */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Language preference
          </label>
          <select
            className={SELECT_CLASS}
            style={{ borderColor: 'var(--border)' }}
            {...register('preferred_language')}
          >
            {(
              Object.entries(LANGUAGE_LABELS) as [
                keyof typeof LANGUAGE_LABELS,
                string,
              ][]
            ).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* Camp */}
        {camps.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Camp{' '}
              <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                (where your child is registered)
              </span>
            </label>
            <select
              className={SELECT_CLASS}
              style={{ borderColor: 'var(--border)' }}
              {...register('camp')}
            >
              <option value="">Select camp…</option>
              {camps.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <Input
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirm password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          required
          error={errors.password_confirm?.message}
          {...register('password_confirm')}
        />

        <Button
          type="submit"
          loading={isSubmitting}
          variant="primary"
          size="lg"
          className="mt-2 w-full"
        >
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold underline-offset-2 hover:underline"
          style={{ color: 'var(--ink)' }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
