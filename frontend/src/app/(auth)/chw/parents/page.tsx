'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Phone, MapPin, Baby, AlertTriangle, Syringe,
  Clock, ChevronDown, ChevronUp, Search, X, Calendar,
  CheckCircle2, Activity,
} from 'lucide-react';
import Link from 'next/link';
import { listCHWFamilies, type CHWFamily, type CHWChildSummary } from '@/lib/api/chw';
import { getChildHistory, getChildNotes, type HealthRecordDetail, type ClinicalNote } from '@/lib/api/nurse';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

// ── helpers ────────────────────────────────────────────────────────────────────

const RISK_DOT: Record<string, string> = {
  HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)', UNKNOWN: 'var(--text-muted)',
};
const RISK_VARIANT: Record<string, 'danger' | 'warn' | 'success' | 'default'> = {
  HIGH: 'danger', MEDIUM: 'warn', LOW: 'success', UNKNOWN: 'default',
};
const NOTE_TYPE_VARIANT: Record<string, 'danger' | 'warn' | 'info' | 'default'> = {
  REFERRAL: 'danger', FOLLOW_UP: 'warn', OBSERVATION: 'info', GENERAL: 'default',
};

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Child Profile Drawer ───────────────────────────────────────────────────────

function ChildDrawer({ child, onClose }: { child: CHWChildSummary; onClose: () => void }) {
  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['child-history', child.id],
    queryFn:  () => getChildHistory(child.id),
    staleTime: 30_000,
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['child-notes', child.id],
    queryFn:  () => getChildNotes(child.id),
    staleTime: 30_000,
  });

  const latest: HealthRecordDetail | null = history[0] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ml-auto h-full w-full max-w-lg flex flex-col shadow-2xl"
        style={{ backgroundColor: 'var(--bg)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              {child.full_name}
            </h3>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {child.age_display} · {child.sex === 'M' ? 'Boy' : 'Girl'}
              </span>
              {child.zone_name && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <MapPin size={10} /> {child.zone_name}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-sand)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          {/* Status chips */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={RISK_VARIANT[child.risk_level] ?? 'default'}>
              {child.risk_level} risk
            </Badge>
            {child.overdue_vaccines > 0 && (
              <Badge variant="warn">{child.overdue_vaccines} vaccine{child.overdue_vaccines !== 1 ? 's' : ''} overdue</Badge>
            )}
            {child.upcoming_vaccines > 0 && (
              <Badge variant="default">{child.upcoming_vaccines} upcoming</Badge>
            )}
            {child.last_visit_days_ago === null && (
              <Badge variant="danger">Never visited</Badge>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Last visit', value: child.last_visit_date ? fmtDate(child.last_visit_date) : 'Never', icon: Clock },
              { label: 'Days since visit', value: child.last_visit_days_ago !== null ? `${child.last_visit_days_ago}d ago` : '—', icon: Calendar },
              { label: 'Next vaccine', value: child.next_vaccine_name ?? 'None', icon: Syringe },
              { label: 'Vaccine date', value: child.next_vaccine_date ? fmtDate(child.next_vaccine_date) : '—', icon: Calendar },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl p-3" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={12} style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Latest measurement */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Latest health record
            </h4>
            {histLoading ? (
              <Skeleton className="h-28 rounded-xl" />
            ) : !latest ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No health records yet.</p>
            ) : (
              <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(latest.measurement_date)}
                  </span>
                  <Badge variant={RISK_VARIANT[latest.risk_level] ?? 'default'}>{latest.risk_level}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    ['Weight', latest.weight_kg ? `${latest.weight_kg} kg` : null],
                    ['Height', latest.height_cm ? `${latest.height_cm} cm` : null],
                    ['MUAC',   latest.muac_cm ? `${latest.muac_cm} cm` : null],
                    ['Temp',   latest.temperature_c ? `${latest.temperature_c}°C` : null],
                    ['Oedema', latest.oedema ? 'Yes' : null],
                    ['Status', latest.nutrition_status_display || null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string}>
                      <p style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{value}</p>
                    </div>
                  ))}
                </div>
                {latest.symptom_flags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {latest.symptom_flags.map((f) => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Visit history */}
          {history.length > 1 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Visit history
              </h4>
              <div className="flex flex-col gap-2">
                {history.slice(1, 6).map((hr: HealthRecordDetail) => (
                  <div
                    key={hr.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(hr.measurement_date)}</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        {[hr.weight_kg && `${hr.weight_kg}kg`, hr.height_cm && `${hr.height_cm}cm`, hr.muac_cm && `MUAC ${hr.muac_cm}`].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <Badge variant={RISK_VARIANT[hr.risk_level] ?? 'default'}>{hr.risk_level}</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Nurse notes */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Nurse notes &amp; advice
            </h4>
            {notesLoading ? (
              <Skeleton className="h-16 rounded-xl" />
            ) : notes.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notes from the nurse yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {notes.map((n: ClinicalNote) => (
                  <div
                    key={n.id}
                    className="rounded-xl p-3 flex flex-col gap-1.5 border"
                    style={{
                      borderColor: n.is_pinned ? 'var(--warn)' : 'var(--border)',
                      background: n.is_pinned ? 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))' : 'var(--bg-elev)',
                    }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={NOTE_TYPE_VARIANT[n.note_type] ?? 'default'}>{n.note_type_display}</Badge>
                      {n.is_pinned && <span className="text-xs font-medium" style={{ color: 'var(--warn)' }}>📌</span>}
                      <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(n.created_at)}</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>{n.content}</p>
                    {n.author_name && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>— {n.author_name}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Link
              href={`/chw/visit?child=${child.id}`}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              <Activity size={16} /> Log a Visit
            </Link>
            <Link
              href="/chw/consultations"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
            >
              Ask a Nurse
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Family Card ────────────────────────────────────────────────────────────────

function FamilyCard({ family }: { family: CHWFamily }) {
  const [open, setOpen]           = useState(false);
  const [selectedChild, setChild] = useState<CHWChildSummary | null>(null);

  const alertCount = family.children.filter((c) => c.risk_level === 'HIGH' || c.overdue_vaccines > 0).length;

  return (
    <>
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: alertCount > 0 ? 'var(--danger)' : 'var(--border)', background: 'var(--card)' }}
      >
        {/* Guardian header */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[var(--bg-sand)] transition-colors"
        >
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
            style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          >
            {family.full_name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{family.full_name}</p>
              {family.has_account && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}
                >
                  App user
                </span>
              )}
              {alertCount > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}
                >
                  <AlertTriangle size={10} className="inline mr-0.5" />{alertCount} alert{alertCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {family.relationship} · {family.children.length} child{family.children.length !== 1 ? 'ren' : ''}
              </span>
              {family.phone_number && (
                <a
                  href={`tel:${family.phone_number}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: 'var(--primary)' }}
                >
                  <Phone size={10} /> {family.phone_number}
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <Baby size={12} className="inline mr-0.5" />{family.children.length}
            </span>
            {open ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </button>

        {/* Children list */}
        {open && (
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            {family.children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => setChild(child)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0 hover:bg-[var(--bg-sand)] transition-colors text-left"
                style={{ borderColor: 'var(--border)' }}
              >
                {/* Risk dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: RISK_DOT[child.risk_level] ?? 'var(--text-muted)' }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{child.full_name}</p>
                    {child.zone_name && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={10} />{child.zone_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{child.age_display}</span>
                    {child.last_visit_days_ago !== null ? (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        <Clock size={10} className="inline mr-0.5" />
                        {child.last_visit_days_ago}d ago
                      </span>
                    ) : (
                      <span className="text-xs font-medium" style={{ color: 'var(--danger)' }}>Never visited</span>
                    )}
                    {child.overdue_vaccines > 0 && (
                      <span className="text-xs font-medium flex items-center gap-0.5" style={{ color: 'var(--warn)' }}>
                        <Syringe size={10} />{child.overdue_vaccines} overdue
                      </span>
                    )}
                  </div>
                </div>

                <Badge variant={RISK_VARIANT[child.risk_level] ?? 'default'} className="shrink-0">
                  {child.risk_level}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Child detail drawer */}
      {selectedChild && (
        <ChildDrawer child={selectedChild} onClose={() => setChild(null)} />
      )}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CHWParentsPage() {
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'ALL' | 'ALERT' | 'APP_USER'>('ALL');

  const { data: families = [], isLoading } = useQuery({
    queryKey: ['chw-families'],
    queryFn:  listCHWFamilies,
    staleTime: 5 * 60_000,
  });

  const filtered = families
    .filter((f) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchParent = f.full_name.toLowerCase().includes(q);
        const matchChild  = f.children.some((c) => c.full_name.toLowerCase().includes(q));
        if (!matchParent && !matchChild) return false;
      }
      if (filter === 'ALERT') {
        return f.children.some((c) => c.risk_level === 'HIGH' || c.overdue_vaccines > 0);
      }
      if (filter === 'APP_USER') return f.has_account;
      return true;
    });

  const totalChildren  = families.reduce((s, f) => s + f.children.length, 0);
  const appUsers       = families.filter((f) => f.has_account).length;
  const alertFamilies  = families.filter((f) => f.children.some((c) => c.risk_level === 'HIGH' || c.overdue_vaccines > 0)).length;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          My Families
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {isLoading ? '—' : `${families.length} families · ${totalChildren} children`}
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Families', value: families.length, icon: Users, color: 'var(--ink)' },
          { label: 'Need attention', value: alertFamilies, icon: AlertTriangle, color: alertFamilies > 0 ? 'var(--danger)' : 'var(--success)' },
          { label: 'App users', value: appUsers, icon: CheckCircle2, color: 'var(--success)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl p-4 flex flex-col gap-1 border"
            style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
          >
            <Icon size={16} style={{ color }} />
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>{value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parent or child name…"
            className="w-full pl-8 pr-8 py-2 rounded-xl border text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)', color: 'var(--ink)' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
        {/* Pills */}
        <div className="flex gap-1">
          {(['ALL', 'ALERT', 'APP_USER'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
              style={{
                borderColor: filter === f ? 'var(--ink)' : 'var(--border)',
                background:  filter === f ? 'var(--ink)' : 'transparent',
                color:       filter === f ? 'var(--bg)' : 'var(--text-muted)',
              }}
            >
              {f === 'ALL' ? 'All' : f === 'ALERT' ? '⚠ Needs attention' : '✓ App users'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title={search ? 'No matches found' : 'No families assigned yet'}
          description={search ? 'Try a different name.' : 'Your supervisor assigns families to you. Check back later.'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((family) => (
            <FamilyCard key={family.id} family={family} />
          ))}
        </div>
      )}
    </div>
  );
}
