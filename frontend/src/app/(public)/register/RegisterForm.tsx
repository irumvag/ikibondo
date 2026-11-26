'use client';

import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useValidationMessage } from '@/i18n/useValidationMessage';
import {
  registerSchema,
  type RegisterFormValues,
  LANGUAGE_LABELS,
} from '@/lib/schemas/auth';
import { registerUser } from '@/lib/api/auth';
import { usePublicCamps } from '@/lib/api/queries';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';

export function RegisterForm() {
  const t = useTranslations('register');
  const tv = useValidationMessage();
  const [success,  setSuccess]  = useState(false);
  const [apiError, setApiError] = useState('');
  const { data: camps = [] }    = usePublicCamps();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    // zodResolver's generic can't see through the .refine() wrapper; a typed
    // Resolver cast keeps field-name safety without falling back to `any`.
    resolver: zodResolver(registerSchema) as Resolver<RegisterFormValues>,
    defaultValues: { preferred_language: 'rw' as const },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setApiError('');
    try {
      await registerUser({
        full_name:          values.full_name,
        phone_number:       values.phone_number,
        password:           values.password,
        role:               'PARENT',
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
          : t('failed'));
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
          {t('successTitle')}
        </h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t('successBody')}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
        >
          {t('backToSignIn')}
        </Link>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  const langOptions = (
    Object.entries(LANGUAGE_LABELS) as [keyof typeof LANGUAGE_LABELS, string][]
  ).map(([value, label]) => ({ value, label }));

  const campOptions = [
    { value: '', label: t('selectCamp') },
    ...camps.map((c) => ({ value: String(c.id), label: c.name })),
  ];

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
          {t('title')}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t('subtitle')}
        </p>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t('staffNote')}
        </p>
      </div>

      {apiError && (
        <div className="mb-5">
          <Alert variant="danger">{apiError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">

        <Input
          label={t('fullName')}
          type="text"
          placeholder={t('fullNamePlaceholder')}
          autoComplete="name"
          required
          error={tv(errors.full_name?.message)}
          {...register('full_name')}
        />

        <Input
          label={t('phone')}
          type="tel"
          placeholder={t('phonePlaceholder')}
          autoComplete="tel"
          required
          hint={t('phoneHint')}
          error={tv(errors.phone_number?.message)}
          {...register('phone_number')}
        />

        <Input
          label={t('email')}
          type="email"
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          error={tv(errors.email?.message)}
          {...register('email')}
        />

        <Select
          label={t('language')}
          options={langOptions}
          error={tv(errors.preferred_language?.message)}
          {...register('preferred_language')}
        />

        {camps.length > 0 && (
          <Select
            label={t('camp')}
            hint={t('campHint')}
            options={campOptions}
            error={tv(errors.camp?.message)}
            {...register('camp')}
          />
        )}

        <Input
          label={t('password')}
          type="password"
          placeholder={t('passwordPlaceholder')}
          autoComplete="new-password"
          required
          error={tv(errors.password?.message)}
          {...register('password')}
        />

        <Input
          label={t('confirmPassword')}
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          required
          error={tv(errors.password_confirm?.message)}
          {...register('password_confirm')}
        />

        <Button
          type="submit"
          loading={isSubmitting}
          variant="primary"
          size="lg"
          className="mt-2 w-full"
        >
          {t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('haveAccount')}{' '}
        <Link
          href="/login"
          className="font-semibold underline-offset-2 hover:underline"
          style={{ color: 'var(--ink)' }}
        >
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
