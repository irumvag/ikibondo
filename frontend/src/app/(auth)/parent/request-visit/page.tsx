'use client';

import { useTranslations } from 'next-intl';
import { useValidationMessage } from '@/i18n/useValidationMessage';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, Loader2, AlertTriangle,
  Heart, Clock, History, XCircle,
} from 'lucide-react';
import {
  listMyChildren, createVisitRequest, listVisitRequests, withdrawVisitRequest,
  type VisitUrgency, type VisitRequest,
} from '@/lib/api/parent';
import { addLocalNotif } from '@/lib/localNotifs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

// ── constants ──────────────────────────────────────────────────────────────────

// Symptoms are saved in English (the CHW reads them); messages/en.json parent.requestVisit.symptom
// holds what the parent sees, keyed by a camelCase form of the English word.
const SYMPTOM_OPTIONS = {
  'Fever': 'fever', 'Diarrhoea': 'diarrhoea', 'Vomiting': 'vomiting', 'Cough': 'cough',
  'Difficulty breathing': 'difficultyBreathing', 'Rash': 'rash', 'Swollen limbs': 'swollenLimbs',
  'Not eating': 'notEating', 'Lethargic / weak': 'lethargicWeak', 'Other': 'other',
} as const;
type Symptom = keyof typeof SYMPTOM_OPTIONS;
const isSymptom = (v: string): v is Symptom => v in SYMPTOM_OPTIONS;

// Urgency and status text: messages/en.json parent.requestVisit.urgency.<U>.label/desc and .status.<S>
const URGENCY_CONFIG: Record<VisitUrgency, {
  icon: string;
  border: string; bg: string; textColor: string;
}> = {
  ROUTINE: {
    icon: '📋',
    border: 'var(--border)', bg: 'var(--bg-elev)', textColor: 'var(--ink)',
  },
  SOON: {
    icon: '⏰',
    border: 'var(--warn)', bg: 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))', textColor: 'var(--ink)',
  },
  URGENT: {
    icon: '🚨',
    border: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))', textColor: 'var(--danger)',
  },
};

const STATUS_CONFIG: Record<'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'WITHDRAWN', { color: string; bg: string }> = {
  PENDING:   { color: '#d97706', bg: '#fefce8' },
  ACCEPTED:  { color: '#2563eb', bg: '#eff6ff' },
  DECLINED:  { color: '#dc2626', bg: '#fef2f2' },
  COMPLETED: { color: '#16a34a', bg: '#f0fdf4' },
  WITHDRAWN: { color: '#6b7280', bg: '#f9fafb' },
};

const schema = z.object({
  child:         z.string().min(1, 'selectChild'),
  urgency:       z.enum(['ROUTINE', 'SOON', 'URGENT'] as const),
  concern_text:  z.string().max(1000),
  symptom_flags: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── History section ────────────────────────────────────────────────────────────

function VisitHistory({ requests, onWithdraw }: {
  requests: VisitRequest[];
  onWithdraw: (id: string, childName: string) => void;
}) {
  const tt = useTranslations('parent.requestVisit');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  if (requests.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <History size={15} style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('yourVisitRequests')}</h3>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {requests.map((vr) => {
          const status = vr.status in STATUS_CONFIG ? (vr.status as keyof typeof STATUS_CONFIG) : 'PENDING';
          const cfg = STATUS_CONFIG[status];
          const urgCfg = URGENCY_CONFIG[vr.urgency];
          const canWithdraw = vr.status === 'PENDING' || vr.status === 'ACCEPTED';

          return (
            <div
              key={vr.id}
              className="flex items-start gap-4 px-4 py-4 border-b last:border-b-0"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              {/* Urgency icon */}
              <span className="text-xl shrink-0 mt-0.5">{urgCfg.icon}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {vr.child_name}
                  </p>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: cfg.color, backgroundColor: cfg.bg }}
                  >
                    {tt(`status.${status}`)}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
                  >
                    {tt(`urgency.${vr.urgency}.label`)}
                  </span>
                </div>

                {vr.concern_text && (
                  <p className="text-xs italic mb-1" style={{ color: 'var(--text-muted)' }}>
                    &ldquo;{vr.concern_text}&rdquo;
                  </p>
                )}

                {vr.symptom_flags?.length > 0 && (
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{tt('symptoms')}{' '}{vr.symptom_flags.map((f) => (isSymptom(f) ? tt(`symptom.${SYMPTOM_OPTIONS[f]}`) : f)).join(', ')}
                  </p>
                )}

                <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{tt('submitted', { fmtDate: fmtDate(vr.created_at) })}</span>
                  {vr.assigned_chw_name && (
                    <span>{tt('chw', { assigned_chw_name: vr.assigned_chw_name })}</span>
                  )}
                  {vr.eta && (
                    <span>{tt('eta', { fmtDate: fmtDate(vr.eta) })}</span>
                  )}
                  {vr.decline_reason && (
                    <span style={{ color: 'var(--danger)' }}>{tt('reason', { decline_reason: vr.decline_reason })}</span>
                  )}
                </div>
              </div>

              {/* Withdraw */}
              {canWithdraw && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={withdrawingId === vr.id}
                  onClick={async () => {
                    setWithdrawingId(vr.id);
                    try {
                      await onWithdraw(vr.id, vr.child_name);
                    } finally {
                      setWithdrawingId(null);
                    }
                  }}
                  className="shrink-0"
                  style={{ color: 'var(--danger)' }}
                  title={tt('withdrawThisRequest')}
                >
                  <XCircle size={15} />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Inner form (needs useSearchParams so must be in Suspense) ──────────────────

function RequestVisitForm() {
  const tt = useTranslations('parent.requestVisit');
  const tv = useValidationMessage();
  const toast = useToast();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const preChild     = searchParams.get('child') ?? '';
  const qc           = useQueryClient();

  const [submitted, setSubmitted] = useState<VisitRequest | null>(null);
  const [view, setView] = useState<'form' | 'history'>('form');

  const { data: childrenData, isLoading: childrenLoading } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn:  async () => { const r = await listMyChildren(); return r.items; },
    staleTime: 60_000,
  });

  const { data: allRequests = [], isLoading: histLoading } = useQuery<VisitRequest[]>({
    queryKey: ['parent', 'visit-requests'],
    queryFn:  () => listVisitRequests(),
    staleTime: 20_000,
  });

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { child: preChild, urgency: 'ROUTINE', concern_text: '', symptom_flags: [] },
  });

  const selectedChild   = watch('child');
  const selectedFlags   = watch('symptom_flags');
  const selectedUrgency = watch('urgency');
  const children        = childrenData ?? [];

  // Active requests for selected child (for warning banner)
  const activeForSelected = allRequests.filter(
    (r) => r.child === selectedChild && (r.status === 'PENDING' || r.status === 'ACCEPTED'),
  );

  const createMut = useMutation({
    mutationFn: createVisitRequest,
    onSuccess: (result) => {
      toast.success(tt('requestSentToYour'));
      qc.invalidateQueries({ queryKey: ['parent', 'visit-requests'] });
      addLocalNotif(
        'VISIT_REQUESTED',
        'Visit request submitted',
        `Your request for a home visit for ${result.child_name} has been sent to your CHW.`,
        result.child_name,
      );
      setSubmitted(result);
    },
  });

  const withdrawMut = useMutation({
    mutationFn: ({ id }: { id: string; childName: string }) => withdrawVisitRequest(id),
    onSuccess: (_, vars) => {
      toast.success(tt('requestWithdrawn'));
      qc.invalidateQueries({ queryKey: ['parent', 'visit-requests'] });
      addLocalNotif(
        'VISIT_WITHDRAWN',
        'Visit request withdrawn',
        `You withdrew the home visit request for ${vars.childName}.`,
        vars.childName,
      );
    },
  });

  function toggleSymptom(sym: string) {
    const next = selectedFlags.includes(sym)
      ? selectedFlags.filter((s) => s !== sym)
      : [...selectedFlags, sym];
    setValue('symptom_flags', next);
  }

  const onSubmit = (values: FormValues) => {
    createMut.mutate({
      child:         values.child,
      urgency:       values.urgency,
      concern_text:  values.concern_text,
      symptom_flags: values.symptom_flags,
    });
  };

  const handleWithdraw = (id: string, childName: string) =>
    withdrawMut.mutateAsync({ id, childName });

  // ── Success state ────────────────────────────────────────────────────────────

  if (submitted) {
    const cfg = URGENCY_CONFIG[submitted.urgency];
    return (
      <div className="flex flex-col gap-6 max-w-xl mx-auto w-full">
        <Link href="/parent" className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} />{' '}{tt('myChildren')}</Link>

        <div
          className="rounded-2xl p-6 flex flex-col items-center gap-4 text-center border"
          style={{ background: 'color-mix(in srgb, var(--success) 8%, var(--bg-elev))', borderColor: 'var(--success)' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--success) 16%, transparent)' }}>
            <CheckCircle2 size={28} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{tt('requestSent')}</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{tt('yourCommunityHealthWorker')}</p>
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 flex flex-col gap-3"
          style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('requestSummary')}</p>
          {([
            [tt('summary.child'),     submitted.child_name],
            [tt('summary.urgency'),   `${cfg.icon} ${tt(`urgency.${submitted.urgency}.label`)}`],
            [tt('summary.status'),    tt('summary.statusPending')],
            [tt('summary.submitted'), fmtDate(submitted.created_at)],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
              style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{k}</span>
              <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
            </div>
          ))}
          {submitted.concern_text && (
            <p className="text-sm italic pt-1" style={{ color: 'var(--text-muted)' }}>&ldquo;{submitted.concern_text}&rdquo;</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setSubmitted(null); setView('history'); }}
            className="flex-1 py-3 rounded-2xl border text-sm font-medium transition-colors hover:bg-[var(--bg-sand)]"
            style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
          >{tt('viewAllRequests')}</button>
          <Link
            href="/parent"
            className="flex-1 flex items-center justify-center py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >{tt('done')}</Link>
        </div>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto w-full">
      {/* Header + tab toggle */}
      <div>
        <Link href="/parent" className="inline-flex items-center gap-1.5 text-sm mb-4 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} />{' '}{tt('myChildren')}</Link>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{tt('homeVisitRequests')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{tt('requestYourAssignedCommunity')}</p>
      </div>

      {/* Tab bar */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}
      >
        {(['form', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setView(t)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: view === t ? 'var(--bg)' : 'transparent',
              color: view === t ? 'var(--ink)' : 'var(--text-muted)',
              boxShadow: view === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t === 'form' ? <><Heart size={13} /> New request</> : <><History size={13} /> History {allRequests.length > 0 && `(${allRequests.length})`}</>}
          </button>
        ))}
      </div>

      {/* ── History tab ────────────────────────────────────────────────────── */}
      {view === 'history' && (
        <>
          {histLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : allRequests.length === 0 ? (
            <div
              className="rounded-2xl border px-6 py-12 text-center"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <History size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{tt('noRequestsYet')}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{tt('switchToNewRequest')}</p>
            </div>
          ) : (
            <VisitHistory requests={allRequests} onWithdraw={handleWithdraw} />
          )}
        </>
      )}

      {/* ── Form tab ───────────────────────────────────────────────────────── */}
      {view === 'form' && (
        <>
          {/* Active-request warning */}
          {activeForSelected.length > 0 && selectedChild && (
            <div
              className="flex items-start gap-3 p-4 rounded-2xl border text-sm"
              style={{ background: 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))', borderColor: 'var(--warn)' }}
            >
              <Clock size={16} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="font-semibold" style={{ color: 'var(--ink)' }}>{tt('activeRequests', { count: activeForSelected.length })}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tt('youCanWithdrawThem')}</p>
              </div>
            </div>
          )}

          {/* API error */}
          {createMut.isError && (
            <div
              className="flex items-center gap-3 p-4 rounded-2xl border text-sm"
              style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))', borderColor: 'var(--danger)' }}
            >
              <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              <span style={{ color: 'var(--ink)' }}>{tt('failedToSubmitPlease')}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">

            {/* Step 1: child */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('n1WhichChild')}</h3>
              {childrenLoading ? (
                <div className="flex flex-col gap-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
              ) : children.length === 0 ? (
                <div className="rounded-2xl p-4 text-sm" style={{ background: 'var(--bg-elev)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{tt('noChildrenLinkedTo')}</div>
              ) : (
                <Controller
                  control={control}
                  name="child"
                  render={({ field }) => (
                    <div className="flex flex-col gap-2">
                      {children.map((c) => {
                        const active = field.value === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => field.onChange(c.id)}
                            className="flex items-center gap-4 p-4 rounded-2xl border text-left transition-colors"
                            style={{
                              borderColor: active ? 'var(--ink)' : 'var(--border)',
                              background:  active ? 'var(--bg-sand)' : 'var(--bg-elev)',
                              boxShadow:   active ? '0 0 0 2px var(--ink)' : 'none',
                            }}
                          >
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: 'var(--bg-sand)' }}>
                              <Heart size={18} style={{ color: 'var(--ink)' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{c.full_name}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {c.age_display} · {c.sex === 'M' ? tt('boy') : tt('girl')}
                              </p>
                            </div>
                            {c.risk_level === 'HIGH' && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                                style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}>{tt('highRisk')}</span>
                            )}
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                              style={{ borderColor: active ? 'var(--ink)' : 'var(--border)' }}>
                              {active && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--ink)' }} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              )}
              {errors.child && <p className="text-xs" style={{ color: 'var(--danger)' }}>{tv(errors.child.message)}</p>}
            </section>

            {/* Step 2: urgency */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('n2HowUrgent')}</h3>
              <Controller
                control={control}
                name="urgency"
                render={({ field }) => (
                  <div className="flex flex-col gap-2">
                    {(Object.keys(URGENCY_CONFIG) as VisitUrgency[]).map((u) => {
                      const cfg = URGENCY_CONFIG[u];
                      const active = field.value === u;
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => field.onChange(u)}
                          className="flex items-start gap-3 p-4 rounded-2xl border text-left transition-colors"
                          style={{
                            borderColor: active ? cfg.border : 'var(--border)',
                            background:  active ? cfg.bg : 'var(--bg-elev)',
                          }}
                        >
                          <span className="text-xl shrink-0 mt-0.5">{cfg.icon}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-sm" style={{ color: active ? cfg.textColor : 'var(--ink)' }}>{tt(`urgency.${u}.label`)}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tt(`urgency.${u}.desc`)}</p>
                          </div>
                          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                            style={{ borderColor: active ? 'var(--ink)' : 'var(--border)' }}>
                            {active && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--ink)' }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </section>

            {/* Step 3: symptoms */}
            <section className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('n3SymptomsNoticed')}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tt('selectAllThatApply')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SYMPTOM_OPTIONS) as Symptom[]).map((sym) => {
                  const on = selectedFlags.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => toggleSymptom(sym)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors"
                      style={{
                        borderColor: on ? 'var(--ink)' : 'var(--border)',
                        background:  on ? 'var(--ink)' : 'var(--bg-elev)',
                        color:       on ? 'var(--bg)'  : 'var(--ink)',
                      }}
                    >
                      <span className="text-base leading-none shrink-0">{on ? '✓' : '·'}</span>
                      {tt(`symptom.${SYMPTOM_OPTIONS[sym]}`)}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 4: details */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('n4AdditionalDetails')}<span className="normal-case ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>{tt('optional')}</span>
              </h3>
              <textarea
                {...register('concern_text')}
                rows={4}
                placeholder={tt('describeWhatYouHave')}
                className="w-full px-4 py-3 rounded-2xl border text-sm resize-none focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)', color: 'var(--ink)' }}
              />
            </section>

            {/* Urgent warning */}
            {selectedUrgency === 'URGENT' && (
              <div
                className="flex items-start gap-3 p-4 rounded-2xl border text-sm"
                style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))', borderColor: 'var(--danger)' }}
              >
                <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--danger)' }}>{tt('urgentRequest')}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tt('ifThisIsA')}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pb-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 py-3 rounded-2xl border text-sm font-medium transition-colors hover:bg-[var(--bg-sand)]"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
              >{tt('cancel')}</button>
              <button
                type="submit"
                disabled={createMut.isPending || children.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                {createMut.isPending && <Loader2 size={16} className="animate-spin" />}{tt('submitRequest')}</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function RequestVisitPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6 max-w-xl mx-auto w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    }>
      <RequestVisitForm />
    </Suspense>
  );
}
