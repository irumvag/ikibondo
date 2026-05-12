'use client';

import React, { use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, QrCode, ClipboardList, Activity, AlertTriangle,
  Phone, User, Calendar, Weight, Ruler, Heart,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useChild, useChildHistory, useChildNotes, useChildQR } from '@/lib/api/queries';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

// ── Dynamic QR (no SSR) ────────────────────────────────────────────────────────
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false });

// ── Helpers ────────────────────────────────────────────────────────────────────
function riskVariant(level?: string): 'danger' | 'warn' | 'success' {
  if (level === 'HIGH')   return 'danger';
  if (level === 'MEDIUM') return 'warn';
  return 'success';
}

function age(dob?: string) {
  if (!dob) return '—';
  const ms = Date.now() - new Date(dob).getTime();
  const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr ${months % 12} mo`;
}

function fmt(val?: string | number | null, unit = '') {
  if (val == null || val === '') return '—';
  return `${val}${unit}`;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function CHWChildDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: child,   isLoading: loadingChild }   = useChild(id);
  const { data: history, isLoading: loadingHistory } = useChildHistory(id);
  const { data: notes,   isLoading: loadingNotes }   = useChildNotes(id);
  const { data: qrData }                              = useChildQR(id);

  const latest = history?.[0];
  const typedChild = child as Record<string, unknown> | undefined;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-12">

      {/* Back */}
      <div className="flex items-center gap-3">
        <Link
          href="/chw"
          className="flex items-center gap-1.5 text-sm hover:opacity-75 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={15} />
          Dashboard
        </Link>
      </div>

      {/* ── Child header ── */}
      {loadingChild ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : typedChild ? (
        <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                {String(typedChild.full_name ?? '—')}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {String(typedChild.registration_number ?? '')}
              </p>
            </div>
            {latest?.risk_level && (
              <Badge variant={riskVariant(latest.risk_level)}>
                {String(latest.risk_level)} risk
              </Badge>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              { icon: Calendar, label: 'Age',  value: age(typedChild.date_of_birth as string) },
              { icon: User,     label: 'Sex',  value: typedChild.sex === 'M' ? 'Male' : typedChild.sex === 'F' ? 'Female' : '—' },
              { icon: Heart,    label: 'Status', value: String(typedChild.nutrition_status_display ?? typedChild.nutrition_status ?? '—') },
              { icon: ClipboardList, label: 'Records', value: `${history?.length ?? 0}` },
            ] as { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; value: string }[]).map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl p-3 flex flex-col gap-1" style={{ backgroundColor: 'var(--bg-sand)' }}>
                <div className="flex items-center gap-1.5">
                  <Icon size={13} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Guardian */}
          {!!typedChild.guardian_name && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Phone size={13} />
              <span>{String(typedChild.guardian_name)}</span>
              {!!typedChild.guardian_phone && (
                <a href={`tel:${String(typedChild.guardian_phone)}`} className="font-medium" style={{ color: 'var(--ink)' }}>
                  {String(typedChild.guardian_phone)}
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border p-5 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Child not found.</p>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/chw/visit?child=${id}`}
          className="flex items-center gap-3 rounded-2xl border p-4 font-semibold text-sm transition-colors hover:opacity-85"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
        >
          <ClipboardList size={18} style={{ color: 'var(--ink)' }} />
          Log visit
        </Link>
        <Link
          href={`/chw/records?child=${id}`}
          className="flex items-center gap-3 rounded-2xl border p-4 font-semibold text-sm transition-colors hover:opacity-85"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
        >
          <Activity size={18} style={{ color: 'var(--ink)' }} />
          Health data
        </Link>
      </div>

      {/* ── Latest health record ── */}
      <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Latest health record
          </p>
          {latest && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(latest.measurement_date).toLocaleDateString()}
            </span>
          )}
        </div>

        {loadingHistory ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : latest ? (
          <div className="flex flex-col gap-3">
            {/* Risk alert */}
            {(latest.risk_level === 'HIGH' || latest.risk_level === 'MEDIUM') && (
              <div
                className="flex items-start gap-2 rounded-xl p-3"
                style={{ backgroundColor: latest.risk_level === 'HIGH' ? 'var(--high-bg)' : 'var(--med-bg)' }}
              >
                <AlertTriangle size={15} style={{ color: latest.risk_level === 'HIGH' ? 'var(--danger)' : 'var(--warn)', flexShrink: 0 }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: latest.risk_level === 'HIGH' ? 'var(--danger)' : 'var(--warn)' }}>
                    {latest.nutrition_status_display} — {latest.risk_level} risk
                  </p>
                  {latest.symptom_flags?.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Flags: {latest.symptom_flags.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Measurements grid */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { icon: Weight, label: 'Weight', value: fmt(latest.weight_kg, ' kg') },
                { icon: Ruler,  label: 'Height', value: fmt(latest.height_cm, ' cm') },
                { icon: Activity, label: 'MUAC', value: fmt(latest.muac_cm, ' cm') },
              ] as { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; value: string }[]).map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl p-3 flex flex-col gap-1 text-center" style={{ backgroundColor: 'var(--bg-sand)' }}>
                  <Icon size={14} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{value}</p>
                </div>
              ))}
            </div>

            {latest.oedema && (
              <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>⚠ Oedema present</p>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No health records yet.</p>
        )}
      </div>

      {/* ── QR code ── */}
      <div className="rounded-2xl border p-5 flex flex-col items-center gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
        <div className="w-full flex items-center gap-2">
          <QrCode size={16} style={{ color: 'var(--ink)' }} />
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Child QR card
          </p>
        </div>

        {qrData?.png_base64 ? (
          <img
            src={`data:image/png;base64,${qrData.png_base64}`}
            alt="Child QR code"
            className="rounded-xl"
            style={{ width: 192, height: 192 }}
          />
        ) : (
          <QRCodeSVG value={id} size={192} />
        )}

        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          Show this to the nurse or scan during next visit.
        </p>
      </div>

      {/* ── Recent notes ── */}
      <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Clinical notes
        </p>

        {loadingNotes ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : notes && notes.length > 0 ? (
          <div className="flex flex-col gap-3">
            {notes.slice(0, 3).map((n) => (
              <div key={n.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>
                    {n.note_type_display}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {n.content}
                </p>
                {notes.indexOf(n) < notes.slice(0, 3).length - 1 && (
                  <hr style={{ borderColor: 'var(--border)' }} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No clinical notes yet.</p>
        )}
      </div>
    </div>
  );
}
