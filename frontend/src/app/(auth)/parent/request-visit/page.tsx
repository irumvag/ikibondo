'use client';

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

// ── constants ──────────────────────────────────────────────────────────────────

const SYMPTOM_OPTIONS = [
  'Fever', 'Diarrhoea', 'Vomiting', 'Cough', 'Difficulty breathing',
  'Rash', 'Swollen limbs', 'Not eating', 'Lethargic / weak', 'Other',
];

const URGENCY_CONFIG: Record<VisitUrgency, {
  label: string; desc: string; icon: string;
  border: string; bg: string; textColor: string;
}> = {
  ROUTINE: {
    label: 'Routine', icon: '📋',
    desc: 'No immediate concern, general check-up.',
    border: 'var(--border)', bg: 'var(--bg-elev)', textColor: 'var(--ink)',
  },
  SOON: {
    label: 'Soon', icon: '⏰',
    desc: 'Within the next week — something needs checking.',
    border: 'var(--warn)', bg: 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))', textColor: 'var(--ink)',
  },
  URGENT: {
    label: 'Urgent', icon: '🚨',
    desc: 'Within 24 hours — child needs immediate attention.',
    border: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))', textColor: 'var(--danger)',
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'Pending',   color: '#d97706', bg: '#fefce8' },
  ACCEPTED:  { label: 'Accepted',  color: '#2563eb', bg: '#eff6ff' },
  DECLINED:  { label: 'Declined',  color: '#dc2626', bg: '#fef2f2' },
  COMPLETED: { label: 'Completed', color: '#16a34a', bg: '#f0fdf4' },
  WITHDRAWN: { label: 'Withdrawn', color: '#6b7280', bg: '#f9fafb' },
};

const schema = z.object({
  child:         z.string().min(1, 'Please select a child'),
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
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  if (requests.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <History size={15} style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Your visit requests
        </h3>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {requests.map((vr) => {
          const cfg = STATUS_CONFIG[vr.status] ?? STATUS_CONFIG.PENDING;
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
                    {cfg.label}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
                  >
                    {urgCfg.label}
                  </span>
                </div>

                {vr.concern_text && (
                  <p className="text-xs italic mb-1" style={{ color: 'var(--text-muted)' }}>
                    &ldquo;{vr.concern_text}&rdquo;
                  </p>
                )}

                {vr.symptom_flags?.length > 0 && (
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    Symptoms: {vr.symptom_flags.join(', ')}
                  </p>
                )}

                <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>Submitted {fmtDate(vr.created_at)}</span>
                  {vr.assigned_chw_name && (
                    <span>CHW: {vr.assigned_chw_name}</span>
                  )}
                  {vr.eta && (
                    <span>ETA: {fmtDate(vr.eta)}</span>
                  )}
                  {vr.decline_reason && (
                    <span style={{ color: 'var(--danger)' }}>Reason: {vr.decline_reason}</span>
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
                  title="Withdraw this request"
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
          <ArrowLeft size={14} /> My children
        </Link>

        <div
          className="rounded-2xl p-6 flex flex-col items-center gap-4 text-center border"
          style={{ background: 'color-mix(in srgb, var(--success) 8%, var(--bg-elev))', borderColor: 'var(--success)' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--success) 16%, transparent)' }}>
            <CheckCircle2 size={28} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              Request sent!
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Your community health worker has been notified and will be in touch.
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 flex flex-col gap-3"
          style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Request summary</p>
          {([
            ['Child',   submitted.child_name],
            ['Urgency', `${cfg.icon} ${cfg.label}`],
            ['Status',  'Pending — awaiting CHW response'],
            ['Submitted', fmtDate(submitted.created_at)],
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
          >
            View all requests
          </button>
          <Link
            href="/parent"
            className="flex-1 flex items-center justify-center py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            Done
          </Link>
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
          <ArrowLeft size={14} /> My children
        </Link>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
          Home visit requests
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Request your assigned community health worker to visit you at home.
        </p>
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
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No requests yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Switch to &ldquo;New request&rdquo; to submit your first visit request.
              </p>
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
                <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                  {activeForSelected.length} active request{activeForSelected.length !== 1 ? 's' : ''} already open for this child
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  You can withdraw them in the History tab before submitting a new one.
                </p>
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
              <span style={{ color: 'var(--ink)' }}>Failed to submit. Please try again.</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">

            {/* Step 1: child */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                1 · Which child?
              </h3>
              {childrenLoading ? (
                <div className="flex flex-col gap-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
              ) : children.length === 0 ? (
                <div className="rounded-2xl p-4 text-sm" style={{ background: 'var(--bg-elev)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  No children linked to your account yet. Ask your health worker.
                </div>
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
                                {c.age_display} · {c.sex === 'M' ? 'Boy' : 'Girl'}
                              </p>
                            </div>
                            {c.risk_level === 'HIGH' && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                                style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}>
                                ⚠ High risk
                              </span>
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
              {errors.child && <p className="text-xs" style={{ color: 'var(--danger)' }}>{errors.child.message}</p>}
            </section>

            {/* Step 2: urgency */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                2 · How urgent?
              </h3>
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
                            <p className="font-semibold text-sm" style={{ color: active ? cfg.textColor : 'var(--ink)' }}>{cfg.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{cfg.desc}</p>
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
                <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  3 · Symptoms noticed
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Select all that apply (optional)</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SYMPTOM_OPTIONS.map((sym) => {
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
                      {sym}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 4: details */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                4 · Additional details
                <span className="normal-case ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </h3>
              <textarea
                {...register('concern_text')}
                rows={4}
                placeholder="Describe what you have noticed or any other concerns…"
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
                  <p className="font-semibold" style={{ color: 'var(--danger)' }}>Urgent request</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    If this is a life-threatening emergency, go directly to the nearest health facility — do not wait for a home visit.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pb-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 py-3 rounded-2xl border text-sm font-medium transition-colors hover:bg-[var(--bg-sand)]"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMut.isPending || children.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                {createMut.isPending && <Loader2 size={16} className="animate-spin" />}
                Submit request
              </button>
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
