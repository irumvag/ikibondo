'use client';

import { useState, useRef } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pin, ClipboardList, TrendingUp, Cpu,
  Printer, Trash2, RotateCcw, AlertTriangle,
} from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceArea,
} from 'recharts';
import { useGrowthData, useChild, useChildHistory, useChildNotes, QK } from '@/lib/api/queries';
import { createChildNote } from '@/lib/api/nurse';
import { apiClient } from '@/lib/api/client';
import { predictRisk, buildFeaturesFromRecord } from '@/lib/api/ml';
import type { PredictRiskResult } from '@/lib/api/ml';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { GrowthData, HealthRecordDetail, ClinicalNote } from '@/lib/api/nurse';

// ── WHO growth chart colours ──────────────────────────────────────────────────
// p3  / p97 = red boundary (below p3 = wasted/stunted; above p97 = obese)
// p50        = green median
// actual     = deep blue — child's real data
const WHO = {
  p3:     '#dc2626', // red
  p50:    '#16a34a', // green
  p97:    '#dc2626', // red
  actual: '#1d4ed8', // deep blue
  band:   'rgba(22,163,74,0.06)', // faint green fill between p3 and p97
};

type ChartMode = 'weight' | 'height';

function buildChartData(growth: GrowthData, mode: ChartMode) {
  const who = mode === 'weight'
    ? growth.who_percentiles.weight_for_age
    : growth.who_percentiles.height_for_age;
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

// ── Pure-SVG chart generator for print (no DOM capture, no Recharts) ──────────
// Generates a complete self-contained SVG string from raw data. Works in any
// context (new window, iframe, download) without needing React or CSS variables.

function buildPrintSVG(growth: GrowthData, mode: ChartMode, w = 740, h = 280): string {
  const data = buildChartData(growth, mode);
  if (data.length === 0) return '<text x="10" y="20" font-size="12" fill="#999">No data</text>';

  const ML = { top: 28, right: 20, bottom: 46, left: 54 }; // margins
  const cw = w - ML.left - ML.right;
  const ch = h - ML.top - ML.bottom;

  const ages    = data.map((d) => d.age as number);
  const minAge  = Math.min(...ages);
  const maxAge  = Math.max(...ages);

  const allVals = data.flatMap((d) =>
    (['p3', 'p50', 'p97', 'actual'] as const)
      .map((k) => d[k] as number | undefined)
      .filter((v): v is number => v != null && isFinite(v)),
  );
  if (allVals.length === 0) return '<text x="10" y="20" font-size="12" fill="#999">No measurements</text>';

  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const pad    = (rawMax - rawMin) * 0.08 || 1;
  const minVal = rawMin - pad;
  const maxVal = rawMax + pad;

  const xS = (age: number)  => ((age - minAge)  / (maxAge  - minAge  || 1)) * cw;
  const yS = (val: number)  => ch - ((val - minVal) / (maxVal - minVal || 1)) * ch;

  // Smooth polyline path for a series key
  const polyline = (key: string): string => {
    const pts = data
      .filter((d) => d[key] != null && isFinite(d[key] as number))
      .map((d) => `${xS(d.age as number).toFixed(1)},${yS(d[key] as number).toFixed(1)}`);
    return pts.length > 1 ? `M ${pts.join(' L ')}` : '';
  };

  // Shaded band between p3 and p97
  const p3pts  = data.filter((d) => d.p3  != null && isFinite(d.p3  as number));
  const p97pts = [...data.filter((d) => d.p97 != null && isFinite(d.p97 as number))].reverse();
  const band   = (p3pts.length > 1 && p97pts.length > 1)
    ? `M ${p3pts.map((d)  => `${xS(d.age as number).toFixed(1)},${yS(d.p3  as number).toFixed(1)}`).join(' L ')} ` +
      `L ${p97pts.map((d) => `${xS(d.age as number).toFixed(1)},${yS(d.p97 as number).toFixed(1)}`).join(' L ')} Z`
    : '';

  // Dots for actual measurements
  const dots = data
    .filter((d) => d.actual != null && isFinite(d.actual as number))
    .map((d) => `<circle cx="${xS(d.age as number).toFixed(1)}" cy="${yS(d.actual as number).toFixed(1)}" r="4" fill="#1d4ed8"/>`)
    .join('');

  // Grid ticks
  const yRange    = maxVal - minVal;
  const yStep     = yRange > 30 ? 10 : yRange > 10 ? 5 : yRange > 4 ? 2 : 1;
  const yTicksArr: number[] = [];
  for (let v = Math.ceil(minVal / yStep) * yStep; v <= maxVal + 0.001; v += yStep) yTicksArr.push(v);

  const xTickCount = Math.min(8, ages.length);
  const xStep  = Math.ceil((maxAge - minAge) / xTickCount) || 1;
  const xTicksArr: number[] = [];
  for (let a = Math.ceil(minAge / xStep) * xStep; a <= maxAge; a += xStep) xTicksArr.push(a);

  const yLabel = mode === 'weight' ? 'Weight (kg)' : 'Height (cm)';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#fff"/>
  <g transform="translate(${ML.left},${ML.top})">

    <!-- normal band -->
    ${band ? `<path d="${band}" fill="rgba(22,163,74,0.10)"/>` : ''}

    <!-- grid -->
    ${yTicksArr.map((v) => `<line x1="0" y1="${yS(v).toFixed(1)}" x2="${cw}" y2="${yS(v).toFixed(1)}" stroke="#f0f0f0" stroke-width="1"/>`).join('')}
    ${xTicksArr.map((a) => `<line x1="${xS(a).toFixed(1)}" y1="0" x2="${xS(a).toFixed(1)}" y2="${ch}" stroke="#f0f0f0" stroke-width="1"/>`).join('')}

    <!-- axes -->
    <line x1="0" y1="${ch}" x2="${cw}" y2="${ch}" stroke="#9ca3af" stroke-width="1"/>
    <line x1="0" y1="0"  x2="0"  y2="${ch}" stroke="#9ca3af" stroke-width="1"/>

    <!-- x tick labels -->
    ${xTicksArr.map((a) => `<text x="${xS(a).toFixed(1)}" y="${ch + 14}" text-anchor="middle" font-size="9" fill="#6b7280">${a}</text>`).join('')}
    <text x="${(cw / 2).toFixed(1)}" y="${ch + 32}" text-anchor="middle" font-size="10" fill="#6b7280">Age (months)</text>

    <!-- y tick labels -->
    ${yTicksArr.map((v) => `<text x="-6" y="${(yS(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#6b7280">${v % 1 === 0 ? v : v.toFixed(1)}</text>`).join('')}
    <text x="-${(ch / 2).toFixed(1)}" y="-40" text-anchor="middle" font-size="10" fill="#6b7280" transform="rotate(-90)">${yLabel}</text>

    <!-- p3 -->
    ${polyline('p3')  ? `<path d="${polyline('p3')}"  fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="5,3"/>` : ''}
    <!-- p50 -->
    ${polyline('p50') ? `<path d="${polyline('p50')}" fill="none" stroke="#16a34a" stroke-width="2"   stroke-dasharray="8,3"/>` : ''}
    <!-- p97 -->
    ${polyline('p97') ? `<path d="${polyline('p97')}" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="5,3"/>` : ''}
    <!-- actual line -->
    ${polyline('actual') ? `<path d="${polyline('actual')}" fill="none" stroke="#1d4ed8" stroke-width="2.5"/>` : ''}
    <!-- actual dots -->
    ${dots}
  </g>
</svg>`;
}

function GrowthChart({ growth, childName }: { growth: GrowthData; childName: string }) {
  const [mode, setMode] = useState<ChartMode>('weight');

  const data   = buildChartData(growth, mode);
  const yLabel = mode === 'weight' ? 'Weight (kg)' : 'Height (cm)';
  const p3min  = Math.min(...data.map((d) => (d.p3  as number) ?? Infinity).filter(isFinite));
  const p97max = Math.max(...data.map((d) => (d.p97 as number) ?? -Infinity).filter(isFinite));

  const handlePrint = () => {
    // Generate both charts as pure SVG strings — no DOM capture needed
    const weightSvg = buildPrintSVG(growth, 'weight');
    const heightSvg = buildPrintSVG(growth, 'height');

    const printWindow = window.open('', '_blank', 'width=860,height=800');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>WHO Growth Chart — ${childName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 24px 32px; color: #111; background: #fff; }
    h1  { font-size: 20px; font-weight: 700; margin-bottom: 3px; }
    .meta { font-size: 11px; color: #6b7280; margin-bottom: 18px; }
    .name { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
    .chart-title { font-size: 12px; font-weight: 600; color: #374151; margin: 14px 0 4px; }
    svg { display: block; }
    .legend { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 16px; align-items: center; }
    .li { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #6b7280; }
    .band-swatch { width: 18px; height: 9px; border-radius: 2px;
                   background: rgba(22,163,74,0.12); border: 1px solid #16a34a; }
    @media print {
      body { padding: 8px 10px; }
      @page { size: A4 landscape; margin: 0.5cm; }
    }
  </style>
</head>
<body>
  <h1>WHO Growth Chart</h1>
  <p class="meta">Printed ${new Date().toLocaleDateString()}</p>
  <p class="name">${childName}</p>
  <p class="meta">Weight-for-age and Height-for-age vs WHO Child Growth Standards (p3/p50/p97)</p>

  <p class="chart-title">Weight for age</p>
  ${weightSvg}

  <p class="chart-title">Height for age</p>
  ${heightSvg}

  <div class="legend">
    <div class="li">
      <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#1d4ed8" stroke-width="2.5"/><circle cx="14" cy="3" r="3" fill="#1d4ed8"/></svg>
      Child measurements
    </div>
    <div class="li">
      <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#16a34a" stroke-width="2" stroke-dasharray="7,3"/></svg>
      p50 median (WHO)
    </div>
    <div class="li">
      <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="5,3"/></svg>
      p3 / p97 limits
    </div>
    <div class="li"><div class="band-swatch"></div> Normal range (p3–p97)</div>
  </div>
  <script>window.onload=function(){window.print();};<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2">
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
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-sand)' }}
          title="Print both charts (weight + height)"
        >
          <Printer size={14} aria-hidden="true" />
          Print charts
        </button>
      </div>

      {/* Interactive chart (ResponsiveContainer — visible on screen) */}
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 16, left: 0 }}>
          {isFinite(p3min) && isFinite(p97max) && (
            <ReferenceArea y1={p3min} y2={p97max} fill={WHO.band} />
          )}
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="age" type="number" domain={['dataMin', 'dataMax']} tickCount={8}
            label={{ value: 'Age (months)', position: 'insideBottom', offset: -6, fontSize: 11 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 12, fontSize: 11 }}
            tick={{ fontSize: 11 }} width={48}
          />
          <Tooltip
            formatter={(value, name) => [
              value != null ? Number(value).toFixed(1) : '—',
              name === 'actual' ? 'Measurement'
                : name === 'p3'  ? 'p3 — lower limit'
                : name === 'p50' ? 'p50 — median'
                : 'p97 — upper limit',
            ]}
            labelFormatter={(v) => `Age: ${v} months`}
          />
          <Legend
            formatter={(v) =>
              v === 'actual' ? 'Child measurement'
                : v === 'p3'  ? 'p3 (3rd %ile)'
                : v === 'p50' ? 'p50 median'
                : 'p97 (97th %ile)'}
          />
          <Line type="monotone" dataKey="p3"  stroke={WHO.p3}  strokeDasharray="5 3" dot={false} strokeWidth={1.5} connectNulls name="p3" />
          <Line type="monotone" dataKey="p50" stroke={WHO.p50} strokeDasharray="8 3" dot={false} strokeWidth={2}   connectNulls name="p50" />
          <Line type="monotone" dataKey="p97" stroke={WHO.p97} strokeDasharray="5 3" dot={false} strokeWidth={1.5} connectNulls name="p97" />
          <Line type="monotone" dataKey="actual" stroke={WHO.actual} strokeWidth={2.5}
            dot={{ r: 4, fill: WHO.actual, strokeWidth: 0 }}
            activeDot={{ r: 6 }} connectNulls name="actual" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend explainer */}
      <div className="flex flex-wrap gap-4 mt-3">
        {[
          { color: WHO.actual, label: 'Child measurements', solid: true },
          { color: WHO.p50,    label: 'p50 median (WHO)',   solid: false },
          { color: WHO.p3,     label: 'p3 / p97 limits',   solid: false },
        ].map(({ color, label, solid }) => (
          <div key={label} className="flex items-center gap-1.5">
            <svg width="24" height="4" aria-hidden="true">
              {solid
                ? <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth="2.5" />
                : <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth="2" strokeDasharray="5 3" />
              }
            </svg>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-3 rounded-sm" style={{ backgroundColor: WHO.band, border: `1px solid ${WHO.p50}` }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Normal range (p3–p97)</span>
        </div>
      </div>

      {/* Charts rendered via buildPrintSVG() on demand — no hidden DOM refs needed */}
    </div>
  );
}

// ── Health history row ────────────────────────────────────────────────────────

function riskVariant(r: string) {
  if (r === 'HIGH')   return 'danger';
  if (r === 'MEDIUM') return 'warn';
  if (r === 'LOW')    return 'success';
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
          {record.zone_name && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {record.zone_name}
            </span>
          )}
        </div>
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
          {open ? 'Hide' : 'SHAP'}
        </span>
      </button>

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
                        backgroundColor: record.risk_level === 'HIGH' ? 'var(--danger)' : 'var(--ink)',
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
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No feature breakdown available.</p>
          )}
          {record.ml_confidence && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Confidence: <strong style={{ color: 'var(--ink)' }}>{Math.round(parseFloat(record.ml_confidence) * 100)}%</strong>
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
              style={{ backgroundColor: note.is_pinned ? 'var(--med-bg)' : 'var(--bg-sand)' }}
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

// ── ML Predict panel ──────────────────────────────────────────────────────────

interface GrowthForecastResult {
  predicted_whz_30d: number | null;
  predicted_whz_60d: number | null;
  predicted_whz_90d: number | null;
  risk_flag: boolean;
  method: string;
}

interface VaxDropoutResult {
  dropout_probability: number;
  risk_tier: string;
}

interface RunHistoryEntry {
  ts: string;
  risk: string;
  confidence: number;
}

function MLPredictPanel({ history, childId }: { history: HealthRecordDetail[] | undefined; childId: string }) {
  const [riskResult, setRiskResult]     = useState<PredictRiskResult | null>(null);
  const [growthResult, setGrowthResult] = useState<GrowthForecastResult | null>(null);
  const [vaxResult, setVaxResult]       = useState<VaxDropoutResult | null>(null);
  const [riskError, setRiskError]       = useState('');
  const [growthError, setGrowthError]   = useState('');
  const [vaxError, setVaxError]         = useState('');
  const [running, setRunning]           = useState(false);
  const [runHistory, setRunHistory]     = useState<RunHistoryEntry[]>([]);

  const latestRecord = history?.[0];

  const handlePredict = async () => {
    if (!latestRecord) return;
    setRunning(true);
    setRiskError('');
    setGrowthError('');
    setVaxError('');

    // ── 1. Risk assessment (existing endpoint) ────────────────────────────────
    let newRisk: PredictRiskResult | null = null;
    try {
      const features = buildFeaturesFromRecord({
        weight_kg: latestRecord.weight_kg,
        height_cm: latestRecord.height_cm,
        muac_cm: latestRecord.muac_cm,
        oedema: latestRecord.oedema ?? false,
        temperature_c: latestRecord.temperature_c,
      });
      if (latestRecord.weight_for_height_z) features.weight_for_height_z = parseFloat(latestRecord.weight_for_height_z);
      if (latestRecord.height_for_age_z)    features.height_for_age_z    = parseFloat(latestRecord.height_for_age_z);
      if (latestRecord.weight_for_age_z)    features.weight_for_age_z    = parseFloat(latestRecord.weight_for_age_z);
      const flags = latestRecord.symptom_flags ?? [];
      if (flags.includes('fever'))    features.has_fever    = 1;
      if (flags.includes('cough'))    features.has_cough    = 1;
      if (flags.includes('diarrhea')) features.has_diarrhea = 1;
      if (flags.includes('vomiting')) features.has_vomiting = 1;
      if (latestRecord.oedema)        features.has_oedema   = 1;
      newRisk = await predictRisk(features);
      setRiskResult(newRisk);
    } catch {
      setRiskError('Risk prediction failed. Ensure the ML model is loaded.');
    }

    // ── 2. Growth forecast ────────────────────────────────────────────────────
    try {
      const { data } = await apiClient.post('/ml/predict/growth/', { child_id: childId });
      setGrowthResult(data.data ?? data);
    } catch {
      setGrowthError('Growth forecast unavailable.');
    }

    // ── 3. Vaccination dropout ────────────────────────────────────────────────
    try {
      const { data } = await apiClient.post('/ml/predict/vaccination/', {
        child_id: childId,
        vaccine_id: '00000000-0000-0000-0000-000000000000',
      });
      setVaxResult(data.data ?? data);
    } catch {
      setVaxError('No scheduled vaccines or vaccination model unavailable.');
    }

    // ── Append to local run history ───────────────────────────────────────────
    if (newRisk) {
      setRunHistory((prev) => [
        { ts: new Date().toLocaleTimeString(), risk: newRisk!.risk_level, confidence: newRisk!.confidence },
        ...prev,
      ].slice(0, 5));
    }

    setRunning(false);
  };

  const barColor = (level: string) =>
    level === 'HIGH' ? 'var(--danger)' : level === 'MEDIUM' ? 'var(--warn)' : 'var(--success)';

  const factorEntries = riskResult
    ? Object.entries(riskResult.top_factors)
        .map(([k, v]) => [k, typeof v === 'number' ? v : parseFloat(String(v))] as [string, number])
        .filter(([, v]) => isFinite(v))
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 8)
    : [];
  const maxFactor = factorEntries.length > 0 ? Math.max(...factorEntries.map(([, v]) => Math.abs(v))) : 1;

  return (
    <div className="flex flex-col gap-5">
      {/* Latest record summary */}
      {latestRecord ? (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sand)' }}>
          <p className="font-semibold mb-2" style={{ color: 'var(--ink)' }}>Latest record features</p>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {latestRecord.weight_kg && <span>Weight: <strong style={{ color: 'var(--ink)' }}>{latestRecord.weight_kg} kg</strong></span>}
            {latestRecord.height_cm && <span>Height: <strong style={{ color: 'var(--ink)' }}>{latestRecord.height_cm} cm</strong></span>}
            {latestRecord.muac_cm   && <span>MUAC: <strong style={{ color: 'var(--ink)' }}>{latestRecord.muac_cm} cm</strong></span>}
            <span>Date: <strong style={{ color: 'var(--ink)' }}>{new Date(latestRecord.measurement_date).toLocaleDateString()}</strong></span>
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No health records available to run prediction. Record a visit first.
        </p>
      )}

      <Button variant="primary" onClick={handlePredict} loading={running} disabled={!latestRecord} className="self-start">
        <Cpu size={15} className="mr-1.5" aria-hidden="true" />
        Run predictions
      </Button>

      {/* Recent runs */}
      {runHistory.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Recent runs</p>
          <div className="flex flex-wrap gap-2">
            {runHistory.map((entry, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  backgroundColor: entry.risk === 'HIGH' ? 'var(--high-bg)' : entry.risk === 'MEDIUM' ? 'var(--med-bg)' : 'var(--bg-sand)',
                  color: entry.risk === 'HIGH' ? 'var(--danger)' : entry.risk === 'MEDIUM' ? 'var(--warn)' : 'var(--success)',
                  border: '1px solid var(--border)',
                }}
              >
                {entry.ts} · {entry.risk} {Math.round(entry.confidence * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Card 1: Risk assessment ─────────────────────────────────────────── */}
      {riskError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{riskError}</p>}
      {riskResult && (
        <div className="rounded-xl border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Risk assessment</p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <Badge variant={riskResult.risk_level === 'HIGH' ? 'danger' : riskResult.risk_level === 'MEDIUM' ? 'warn' : 'success'} className="text-sm px-3 py-1">
                {riskResult.risk_level} risk
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Confidence</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>
                {Math.round(riskResult.confidence * 100)}%
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round(riskResult.confidence * 100)}%`, backgroundColor: barColor(riskResult.risk_level) }} />
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Model: {riskResult.model_version}</p>
          {factorEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>SHAP feature contributions</p>
              <div className="flex flex-col gap-2">
                {factorEntries.map(([feature, value]) => (
                  <div key={feature} className="flex items-center gap-3">
                    <span className="text-xs w-40 truncate" style={{ color: 'var(--text-muted)' }}>{feature.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(Math.abs(value) / maxFactor) * 100}%`, backgroundColor: value > 0 ? barColor(riskResult.risk_level) : 'var(--text-muted)' }} />
                    </div>
                    <span className="text-xs font-mono w-14 text-right" style={{ color: 'var(--ink)' }}>
                      {value > 0 ? '+' : ''}{value.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Card 2: Growth forecast ─────────────────────────────────────────── */}
      {growthError && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{growthError}</p>}
      {growthResult && (
        <div className="rounded-xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Growth forecast</p>
            {growthResult.risk_flag && (
              <Badge variant="warn">Growth risk flagged</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {growthResult.predicted_whz_30d != null && (
              <div className="flex flex-col">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>30-day WHZ</span>
                <span className="font-bold" style={{ color: 'var(--ink)' }}>{growthResult.predicted_whz_30d.toFixed(2)}</span>
              </div>
            )}
            {growthResult.predicted_whz_60d != null && (
              <div className="flex flex-col">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>60-day WHZ</span>
                <span className="font-bold" style={{ color: 'var(--ink)' }}>{growthResult.predicted_whz_60d.toFixed(2)}</span>
              </div>
            )}
            {growthResult.predicted_whz_90d != null && (
              <div className="flex flex-col">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>90-day WHZ</span>
                <span className="font-bold" style={{ color: 'var(--ink)' }}>{growthResult.predicted_whz_90d.toFixed(2)}</span>
              </div>
            )}
          </div>
          {growthResult.method && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Method: {growthResult.method}</p>
          )}
        </div>
      )}

      {/* ── Card 3: Vaccination dropout ─────────────────────────────────────── */}
      {vaxError && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{vaxError}</p>}
      {vaxResult && (
        <div className="rounded-xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Vaccination dropout</p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Dropout probability</span>
              <span className="text-2xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>
                {Math.round(vaxResult.dropout_probability * 100)}%
              </span>
            </div>
            <Badge variant={
              vaxResult.risk_tier === 'HIGH' ? 'danger' :
              vaxResult.risk_tier === 'MEDIUM' ? 'warn' : 'success'
            }>
              {vaxResult.risk_tier} tier
            </Badge>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(vaxResult.dropout_probability * 100)}%`,
                backgroundColor: vaxResult.risk_tier === 'HIGH' ? 'var(--danger)' : vaxResult.risk_tier === 'MEDIUM' ? 'var(--warn)' : 'var(--success)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Record Measurement Modal ──────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

function RecordMeasurementModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    measurement_date: TODAY,
    weight_kg: '',
    height_cm: '',
    muac_cm: '',
    oedema: false,
    temperature_c: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post('/health-records/', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.childHistory(childId) });
      qc.invalidateQueries({ queryKey: QK.growthData(childId) });
      onClose();
    },
    onError: () => {
      setError('Failed to save measurement. Please check your inputs and try again.');
    },
  });

  const handleSubmit = () => {
    setError('');
    const body: Record<string, unknown> = {
      child: childId,
      measurement_date: form.measurement_date,
      data_source: 'FACILITY',
      oedema: form.oedema,
    };
    if (form.weight_kg)    body.weight_kg    = parseFloat(form.weight_kg);
    if (form.height_cm)    body.height_cm    = parseFloat(form.height_cm);
    if (form.muac_cm)      body.muac_cm      = parseFloat(form.muac_cm);
    if (form.temperature_c) body.temperature_c = parseFloat(form.temperature_c);
    if (form.notes.trim()) body.notes        = form.notes.trim();
    mutation.mutate(body);
  };

  const field = (label: string, key: keyof typeof form, type: 'number' | 'date' | 'textarea', step?: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={form[key] as string}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          rows={2}
          className="text-sm px-3 py-2 rounded-lg border outline-none resize-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        />
      ) : (
        <input
          type={type}
          value={form[key] as string}
          step={step}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="text-sm px-3 py-2 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        />
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl border w-full max-w-md flex flex-col gap-4 p-6 max-h-[90vh] overflow-y-auto"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
          Record measurement
        </h3>

        {field('Measurement date', 'measurement_date', 'date')}
        {field('Weight (kg)', 'weight_kg', 'number', '0.1')}
        {field('Height (cm)', 'height_cm', 'number', '0.1')}
        {field('MUAC (cm)', 'muac_cm', 'number', '0.1')}
        {field('Temperature (°C, optional)', 'temperature_c', 'number', '0.1')}

        <div className="flex items-center gap-2">
          <input
            id="oedema-check"
            type="checkbox"
            checked={form.oedema}
            onChange={(e) => setForm((f) => ({ ...f, oedema: e.target.checked }))}
            className="w-4 h-4"
          />
          <label htmlFor="oedema-check" className="text-sm" style={{ color: 'var(--ink)' }}>
            Oedema present
          </label>
        </div>

        {field('Notes (optional)', 'notes', 'textarea')}

        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={mutation.isPending} className="flex-1">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete panel ──────────────────────────────────────────────────────────────

function DeletePanel({ childId, childName, deletionRequestedAt }: {
  childId: string;
  childName: string;
  deletionRequestedAt: string | null;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dueDate = deletionRequestedAt
    ? new Date(new Date(deletionRequestedAt).getTime() + 3 * 24 * 60 * 60 * 1000)
    : null;
  const msLeft = dueDate ? dueDate.getTime() - Date.now() : 0;
  const daysLeft = dueDate ? Math.ceil(msLeft / (1000 * 60 * 60 * 24)) : 0;

  const requestDeletion = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/children/${childId}/request-deletion/`);
      qc.invalidateQueries({ queryKey: QK.child(childId) });
      setConfirm(false);
    } catch {
      setError('Could not request deletion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cancelDeletion = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/children/${childId}/cancel-deletion/`);
      qc.invalidateQueries({ queryKey: QK.child(childId) });
    } catch {
      setError('Could not cancel deletion.');
    } finally {
      setLoading(false);
    }
  };

  if (deletionRequestedAt) {
    return (
      <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: '#fca5a5', backgroundColor: 'var(--high-bg)' }}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} style={{ color: 'var(--danger)', marginTop: 2 }} aria-hidden="true" />
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>
              Deletion pending — {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` : 'due today'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {childName}&apos;s record will be permanently deleted on {dueDate?.toLocaleDateString()}.
              All health records, visit history, and notes will be removed. This cannot be undone.
            </p>
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
        <Button variant="secondary" onClick={cancelDeletion} loading={loading}>
          <RotateCcw size={14} className="mr-1.5" aria-hidden="true" />
          Cancel deletion
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
      <div>
        <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Delete child record</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          The record will be permanently removed after a 3-day grace period. You can cancel at any time before then.
        </p>
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="self-start flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)', backgroundColor: 'transparent' }}
        >
          <Trash2 size={13} aria-hidden="true" />
          Request deletion
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border p-3" style={{ borderColor: '#fca5a5', backgroundColor: 'var(--high-bg)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
              Are you sure you want to delete {childName}?
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              All associated records will be permanently removed after 3 days. This action affects all linked health data.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <button
              type="button"
              onClick={requestDeletion}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
            >
              {loading ? 'Requesting…' : 'Yes, request deletion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<'chart' | 'history' | 'notes' | 'ml'>('chart');
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);

  const { data: child, isLoading: childLoading }     = useChild(id);
  const { data: growth, isLoading: growthLoading }   = useGrowthData(id);
  const { data: history, isLoading: historyLoading } = useChildHistory(id);

  if (childLoading) {
    return (
      <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const c = child as Record<string, unknown> | undefined;
  const deletionRequestedAt = (c?.deletion_requested_at as string) ?? null;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Back link */}
      <Link
        href="/nurse/children"
        className="no-print flex items-center gap-1.5 text-sm w-fit"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Children
      </Link>

      {/* Deletion pending banner */}
      {deletionRequestedAt && (
        <div className="no-print flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ backgroundColor: 'var(--high-bg)', color: 'var(--danger)' }}>
          <AlertTriangle size={15} aria-hidden="true" />
          This record is scheduled for deletion.
        </div>
      )}

      {/* Child card */}
      <div
        className="rounded-2xl border p-5 flex flex-wrap gap-6"
        style={{ borderColor: deletionRequestedAt ? '#fca5a5' : 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
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
      <div className="no-print flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {[
          { key: 'chart',   label: 'Growth chart',   icon: TrendingUp   },
          { key: 'history', label: 'Visit history',  icon: ClipboardList },
          { key: 'notes',   label: 'Clinical notes', icon: Pin           },
          { key: 'ml',      label: 'ML Prediction',  icon: Cpu           },
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
                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
                  <GrowthChart growth={growth} childName={(c?.full_name as string) ?? ''} />
                </div>
              )
              : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No growth data available yet.</p>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setShowMeasurementModal(true)}>
                Record measurement
              </Button>
            </div>
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
              {historyLoading
                ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 m-2 rounded-lg" />)
                : history && history.length > 0
                  ? history.map((r: HealthRecordDetail) => <HistoryRow key={r.id} record={r} />)
                  : <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No visit history yet.</p>
              }
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
            <NotesPanel childId={id} />
          </div>
        )}

        {activeTab === 'ml' && (
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
            <MLPredictPanel history={history} childId={id} />
          </div>
        )}
      </div>

      {/* ── Danger zone ─── */}
      <div className="no-print mt-4 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Danger zone
        </p>
        <DeletePanel
          childId={id}
          childName={(c?.full_name as string) ?? 'this child'}
          deletionRequestedAt={deletionRequestedAt}
        />
      </div>

      {showMeasurementModal && (
        <RecordMeasurementModal childId={id} onClose={() => setShowMeasurementModal(false)} />
      )}
    </div>
  );
}
