'use client';

import { useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pin, PinOff, ClipboardList, TrendingUp } from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useGrowthData, useChild, useChildHistory, useChildNotes, QK } from '@/lib/api/queries';
import { createChildNote } from '@/lib/api/nurse';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { GrowthData, HealthRecordDetail, ClinicalNote } from '@/lib/api/nurse';

// ── Growth chart helpers ──────────────────────────────────────────────────────

type ChartMode = 'weight' | 'height';

function buildChartData(growth: GrowthData, mode: ChartMode) {
  const who = mode === 'weight' ? growth.who_percentiles.weight_for_age : growth.who_percentiles.height_for_age;
  const allAges = new Map<number, Record<string, number | null>>();

  (['p3', 'p50', 'p97'] as const).forEach((band) => {
    (who[band] ?? []).forEach((p) => {
      const entry = allAges.get(p.age_months) ?? { age: p.age_months };
      entry[band] = p.value;
      allAges.set(p.age_months, entry);
    });
  });

  growth.measurements.forEach((m) => {
    const val = mode === 'weight' ? m.weight_kg : m.height_cm;
    if (val == null) return;
    const entry = allAges.get(m.age_months) ?? { age: m.age_months };
    entry.actual = val;
    allAges.set(m.age_months, entry);
  });

  return Array.from(allAges.values()).sort((a, b) => (a.age as number) - (b.age as number));
}

function GrowthChart({ growth }: { growth: GrowthData }) {
  const [mode, setMode] = useState<ChartMode>('weight');
  const data = buildChartData(growth, mode);
  const yLabel = mode === 'weight' ? 'Weight (kg)' : 'Height (cm)';

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        {(['weight', 'height'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: mode === m ? 'var(--ink)' : 'var(--bg-sand)',
              color: mode === m ? 'var(--bg)' : 'var(--text-muted)',
            }}
          >
            {m === 'weight' ? 'Weight for age' : 'Height for age'}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="age"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickCount={8}
            label={{ value: 'Age (months)', position: 'insideBottom', offset: -2, fontSize: 11 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
            tick={{ fontSize: 11 }}
            width={48}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              value != null ? value.toFixed(1) : '—',
              name === 'actual' ? 'Measurement'
                : name === 'p3' ? 'p3 (low)'
                : name === 'p50' ? 'p50 (median)'
                : 'p97 (high)',
            ]}
            labelFormatter={(v) => `Age: ${v} months`}
          />
          <Legend
            formatter={(v) =>
              v === 'actual' ? 'Measurement' : v === 'p3' ? 'p3' : v === 'p50' ? 'Median (p50)' : 'p97'
            }
          />
          {/* WHO reference lines */}
          <Line type="monotone" dataKey="p3"     stroke="#94a3b8" strokeDasharray="4 3" dot={false} strokeWidth={1} connectNulls />
          <Line type="monotone" dataKey="p50"    stroke="#64748b" strokeDasharray="6 3" dot={false} strokeWidth={1.5} connectNulls />
          <Line type="monotone" dataKey="p97"    stroke="#94a3b8" strokeDasharray="4 3" dot={false} strokeWidth={1} connectNulls />
          {/* Actual measurements */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="var(--ink)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--ink)', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Health history row ────────────────────────────────────────────────────────

function riskVariant(r: string) {
  if (r === 'HIGH') return 'danger';
  if (r === 'MEDIUM') return 'warn';
  if (r === 'LOW') return 'success';
  return 'default';
}

function HistoryRow({ record }: { record: HealthRecordDetail }) {
  const [open, setOpen] = useState(false);
  const factors = record.risk_factors as Record<string, number> | string[] | null;

  const factorEntries: [string, number][] = Array.isArray(factors)
    ? factors.map((f) => [f, 1])
    : factors
      ? Object.entries(factors as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 5)
      : [];

  const maxFactor = factorEntries[0]?.[1] ?? 1;

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-sand)] transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="text-sm shrink-0 w-24" style={{ color: 'var(--text-muted)' }}>
          {new Date(record.measurement_date).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <Badge variant={riskVariant(record.risk_level)}>{record.risk_level}</Badge>
          <span className="text-sm" style={{ color: 'var(--ink)' }}>
            {record.nutrition_status_display || record.nutrition_status}
          </span>
          {record.weight_kg && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {parseFloat(record.weight_kg).toFixed(1)} kg
            </span>
          )}
          {record.height_cm && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {parseFloat(record.height_cm).toFixed(1)} cm
            </span>
          )}
          {record.muac_cm && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              MUAC {parseFloat(record.muac_cm).toFixed(1)} cm
            </span>
          )}
        </div>
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
          {open ? 'Hide' : 'SHAP'}
        </span>
      </button>

      {/* SHAP / risk factor panel */}
      {open && (
        <div className="px-4 pb-4 pt-2" style={{ backgroundColor: 'var(--bg-sand)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Feature contributions to {record.risk_level} risk
          </p>
          {factorEntries.length > 0 ? (
            <div className="flex flex-col gap-2">
              {factorEntries.map(([name, val]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs w-44 truncate" style={{ color: 'var(--ink)' }}>{name.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((val / maxFactor) * 100, 100)}%`,
                        backgroundColor: record.risk_level === 'HIGH' ? 'var(--danger, #ef4444)' : 'var(--ink)',
                      }}
                    />
                  </div>
                  <span className="text-xs w-12 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                    {typeof val === 'number' ? val.toFixed(3) : val}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No feature breakdown available for this record.</p>
          )}
          {record.ml_confidence && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Model confidence: <strong style={{ color: 'var(--ink)' }}>{Math.round(parseFloat(record.ml_confidence) * 100)}%</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────

const NOTE_TYPES = [
  { value: 'GENERAL',     label: 'General'           },
  { value: 'OBSERVATION', label: 'Observation'        },
  { value: 'FOLLOW_UP',   label: 'Follow-Up Required' },
  { value: 'REFERRAL',    label: 'Referral'           },
];

function NotesPanel({ childId }: { childId: string }) {
  const qc = useQueryClient();
  const { data: notes, isLoading } = useChildNotes(childId);
  const [noteType, setNoteType] = useState('GENERAL');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await createChildNote(childId, { note_type: noteType, content: content.trim() });
      setContent('');
      qc.invalidateQueries({ queryKey: QK.childNotes(childId) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Add note form */}
      <div className="flex flex-col gap-2">
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
          aria-label="Note type"
        >
          {NOTE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a clinical note..."
          rows={3}
          className="text-sm px-3 py-2 rounded-lg border outline-none resize-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        />
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={!content.trim()}>
          Save note
        </Button>
      </div>

      {/* Note list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : notes && notes.length > 0 ? (
        <div className="flex flex-col gap-2">
          {notes.map((note: ClinicalNote) => (
            <div
              key={note.id}
              className="rounded-xl p-3 flex flex-col gap-1"
              style={{ backgroundColor: note.is_pinned ? 'var(--warn-bg, #fffbeb)' : 'var(--bg-sand)' }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={
                  note.note_type === 'FOLLOW_UP' ? 'warn' :
                  note.note_type === 'REFERRAL'  ? 'danger' :
                  'default'
                }>
                  {note.note_type_display}
                </Badge>
                {note.is_pinned && <Pin size={12} style={{ color: 'var(--warn)' }} aria-hidden="true" />}
                <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                  {note.author_name ?? '—'} · {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--ink)' }}>{note.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notes yet.</p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<'chart' | 'history' | 'notes'>('chart');

  const { data: child, isLoading: childLoading }     = useChild(id);
  const { data: growth, isLoading: growthLoading }   = useGrowthData(id);
  const { data: history, isLoading: historyLoading } = useChildHistory(id);

  if (childLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const c = child as Record<string, unknown> | undefined;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Back link */}
      <Link
        href="/nurse/children"
        className="flex items-center gap-1.5 text-sm w-fit"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Children
      </Link>

      {/* Child card */}
      <div
        className="rounded-2xl border p-5 flex flex-wrap gap-6"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        {/* Avatar */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
          style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
          aria-hidden="true"
        >
          {(c?.full_name as string)?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            {(c?.full_name as string) ?? '—'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {(c?.registration_number as string) ?? ''} &middot; {(c?.age_display as string) ?? ''} &middot;{' '}
            {(c?.sex as string) === 'M' ? 'Male' : (c?.sex as string) === 'F' ? 'Female' : '—'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Guardian: {(c?.guardian_name as string) || '—'}
            {c?.guardian_phone ? ` · ${c.guardian_phone}` : ''}
          </p>
        </div>
        <div className="flex items-start">
          <Badge variant={(c?.is_active as boolean) ? 'success' : 'default'}>
            {(c?.is_active as boolean) ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {[
          { key: 'chart',   label: 'Growth chart', icon: TrendingUp },
          { key: 'history', label: 'Visit history', icon: ClipboardList },
          { key: 'notes',   label: 'Clinical notes', icon: Pin },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as typeof activeTab)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: activeTab === key ? 'var(--ink)' : 'transparent',
              color: activeTab === key ? 'var(--ink)' : 'var(--text-muted)',
            }}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'chart' && (
          growthLoading
            ? <Skeleton className="h-72 rounded-2xl" />
            : growth
              ? (
                <div
                  className="rounded-2xl border p-5"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
                >
                  <GrowthChart growth={growth} />
                  <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                    Dashed lines show WHO reference percentiles (p3, p50, p97). Solid line = this child&apos;s measurements.
                  </p>
                </div>
              )
              : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No growth data available yet.</p>
        )}

        {activeTab === 'history' && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            {historyLoading
              ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 m-2 rounded-lg" />)
              : history && history.length > 0
                ? history.map((r: HealthRecordDetail) => <HistoryRow key={r.id} record={r} />)
                : <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No visit history yet.</p>
            }
          </div>
        )}

        {activeTab === 'notes' && (
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <NotesPanel childId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
