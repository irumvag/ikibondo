'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pin, ClipboardList, TrendingUp, Cpu,
  Printer, Trash2, RotateCcw, AlertTriangle,
  Phone, UserCheck, Users, ExternalLink, Syringe,
  CheckCircle, Clock, XCircle, SkipForward, Bell, BellOff, QrCode,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
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
import { RiskExplainer } from '@/components/ui/RiskExplainer';
import { Tabs } from '@/components/ui/Tabs';
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
  if (!growth.who_percentiles) return [];
  const who = mode === 'weight'
    ? growth.who_percentiles.weight_for_age
    : growth.who_percentiles.height_for_age;
  if (!who) return [];
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

type PrintLabels = { noData: string; noMeasurements: string; axis: string };

function buildPrintSVG(growth: GrowthData, mode: ChartMode, labels: PrintLabels, w = 740, h = 280): string {
  const data = buildChartData(growth, mode);
  if (data.length === 0) return `<text x="10" y="20" font-size="12" fill="#999">${labels.noData}</text>`;

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
  if (allVals.length === 0) return `<text x="10" y="20" font-size="12" fill="#999">${labels.noMeasurements}</text>`;

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

  const yLabel = labels.axis;

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
  const tt = useTranslations('nurse.children.detail');
  const [mode, setMode] = useState<ChartMode>('weight');

  const data   = buildChartData(growth, mode);
  const yLabel = mode === 'weight' ? tt('print.weightAxis') : tt('print.heightAxis');
  const p3min  = Math.min(...data.map((d) => (d.p3  as number) ?? Infinity).filter(isFinite));
  const p97max = Math.max(...data.map((d) => (d.p97 as number) ?? -Infinity).filter(isFinite));

  const handlePrint = () => {
    // Generate both charts as pure SVG strings — no DOM capture needed
    const printLabels = { noData: tt('print.noData'), noMeasurements: tt('print.noMeasurements') };
    const weightSvg = buildPrintSVG(growth, 'weight', { ...printLabels, axis: tt('print.weightAxis') });
    const heightSvg = buildPrintSVG(growth, 'height', { ...printLabels, axis: tt('print.heightAxis') });

    const printWindow = window.open('', '_blank', 'width=860,height=800');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${tt('print.title', { name: childName })}</title>
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
  <h1>${tt('print.heading')}</h1>
  <p class="meta">${tt('print.printed', { date: new Date().toLocaleDateString() })}</p>
  <p class="name">${childName}</p>
  <p class="meta">${tt('print.subtitle')}</p>

  <p class="chart-title">${tt('print.weightForAge')}</p>
  ${weightSvg}

  <p class="chart-title">${tt('print.heightForAge')}</p>
  ${heightSvg}

  <div class="legend">
    <div class="li">
      <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#1d4ed8" stroke-width="2.5"/><circle cx="14" cy="3" r="3" fill="#1d4ed8"/></svg>
      ${tt('print.childMeasurements')}
    </div>
    <div class="li">
      <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#16a34a" stroke-width="2" stroke-dasharray="7,3"/></svg>
      ${tt('print.median')}
    </div>
    <div class="li">
      <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="5,3"/></svg>
      ${tt('print.limits')}
    </div>
    <div class="li"><div class="band-swatch"></div> ${tt('print.normalRange')}</div>
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
              {m === 'weight' ? tt('weightForAge') : tt('heightForAge')}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-sand)' }}
          title={tt('printBothChartsWeight')}
        >
          <Printer size={14} aria-hidden="true" />{tt('printCharts')}</button>
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
            labelFormatter={(v) => tt('ageMonthsTooltip', { months: String(v) })}
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
          { color: WHO.actual, label: tt('childMeasurements'), solid: true },
          { color: WHO.p50,    label: tt('p50MedianWho'),   solid: false },
          { color: WHO.p3,     label: tt('p3P97Limits'),   solid: false },
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
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('normalRangeP3P97')}</span>
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
  const tt = useTranslations('nurse.children.detail');
  const [open, setOpen] = useState(false);
  const factors = record.risk_factors as Record<string, number> | string[] | null;

  // Normalise to Record<string, number> for RiskExplainer
  const factorMap: Record<string, number> | null = Array.isArray(factors)
    ? Object.fromEntries(factors.map((f) => [f, 1]))
    : factors ?? null;

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
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('muacCm', { value: parseFloat(record.muac_cm).toFixed(1) })}</span>
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
          {open ? tt('hide') : 'SHAP'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2" style={{ backgroundColor: 'var(--bg-sand)' }}>
          {factorMap ? (
            <RiskExplainer factors={factorMap} riskLevel={record.risk_level ?? 'LOW'} limit={5} />
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('noFeatureBreakdownAvailable')}</p>
          )}
          {record.ml_confidence && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{tt('confidence')}{' '}<strong style={{ color: 'var(--ink)' }}>{Math.round(parseFloat(record.ml_confidence) * 100)}%</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────

// Saved as these codes; names: messages/en.json nurse.children.detail.noteTypes.<value>
const NOTE_TYPES = ['GENERAL', 'OBSERVATION', 'FOLLOW_UP', 'REFERRAL'] as const;

function NotesPanel({ childId }: { childId: string }) {
  const tt = useTranslations('nurse.children.detail');
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
          aria-label={tt('noteType')}
        >
          {NOTE_TYPES.map((v) => (
            <option key={v} value={v}>{tt(`noteTypes.${v}`)}</option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={tt('writeAClinicalNote')}
          rows={3}
          className="text-sm px-3 py-2 rounded-lg border outline-none resize-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        />
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={!content.trim()}>{tt('saveNote')}</Button>
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
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tt('noNotesYet')}</p>
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
  const tt = useTranslations('nurse.children.detail');
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

  return (
    <div className="flex flex-col gap-5">
      {/* Latest record summary */}
      {latestRecord ? (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sand)' }}>
          <p className="font-semibold mb-2" style={{ color: 'var(--ink)' }}>{tt('latestRecordFeatures')}</p>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {latestRecord.weight_kg && <span>{tt('weight')}{' '}<strong style={{ color: 'var(--ink)' }}>{latestRecord.weight_kg} kg</strong></span>}
            {latestRecord.height_cm && <span>{tt('height')}{' '}<strong style={{ color: 'var(--ink)' }}>{latestRecord.height_cm} cm</strong></span>}
            {latestRecord.muac_cm   && <span>{tt('muac')}{' '}<strong style={{ color: 'var(--ink)' }}>{latestRecord.muac_cm} cm</strong></span>}
            <span>{tt('date')}{' '}<strong style={{ color: 'var(--ink)' }}>{new Date(latestRecord.measurement_date).toLocaleDateString()}</strong></span>
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tt('noHealthRecordsAvailable')}</p>
      )}

      <Button variant="primary" onClick={handlePredict} loading={running} disabled={!latestRecord} className="self-start">
        <Cpu size={15} className="mr-1.5" aria-hidden="true" />{tt('runPredictions')}</Button>

      {/* Recent runs */}
      {runHistory.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('recentRuns')}</p>
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
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('riskAssessment')}</p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <Badge variant={riskResult.risk_level === 'HIGH' ? 'danger' : riskResult.risk_level === 'MEDIUM' ? 'warn' : 'success'} className="text-sm px-3 py-1">{tt('risk', { risk_level: riskResult.risk_level })}</Badge>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('confidence2')}</p>
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
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('model', { model_version: riskResult.model_version })}</p>
          {factorEntries.length > 0 && (
            <RiskExplainer
              factors={Object.fromEntries(factorEntries)}
              riskLevel={riskResult.risk_level}
              limit={8}
            />
          )}
        </div>
      )}

      {/* ── Card 2: Growth forecast ─────────────────────────────────────────── */}
      {growthError && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{growthError}</p>}
      {growthResult && (
        <div className="rounded-xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('growthForecast')}</p>
            {growthResult.risk_flag && (
              <Badge variant="warn">{tt('growthRiskFlagged')}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {growthResult.predicted_whz_30d != null && (
              <div className="flex flex-col">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('n30DayWhz')}</span>
                <span className="font-bold" style={{ color: 'var(--ink)' }}>{growthResult.predicted_whz_30d.toFixed(2)}</span>
              </div>
            )}
            {growthResult.predicted_whz_60d != null && (
              <div className="flex flex-col">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('n60DayWhz')}</span>
                <span className="font-bold" style={{ color: 'var(--ink)' }}>{growthResult.predicted_whz_60d.toFixed(2)}</span>
              </div>
            )}
            {growthResult.predicted_whz_90d != null && (
              <div className="flex flex-col">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('n90DayWhz')}</span>
                <span className="font-bold" style={{ color: 'var(--ink)' }}>{growthResult.predicted_whz_90d.toFixed(2)}</span>
              </div>
            )}
          </div>
          {growthResult.method && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('method', { method: growthResult.method })}</p>
          )}
        </div>
      )}

      {/* ── Card 3: Vaccination dropout ─────────────────────────────────────── */}
      {vaxError && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{vaxError}</p>}
      {vaxResult && (
        <div className="rounded-xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('vaccinationDropout')}</p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('dropoutProbability')}</span>
              <span className="text-2xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>
                {Math.round(vaxResult.dropout_probability * 100)}%
              </span>
            </div>
            <Badge variant={
              vaxResult.risk_tier === 'HIGH' ? 'danger' :
              vaxResult.risk_tier === 'MEDIUM' ? 'warn' : 'success'
            }>{tt('tier', { risk_tier: vaxResult.risk_tier })}</Badge>
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

// ── Vaccinations Tab ─────────────────────────────────────────────────────────

interface VaxRecord {
  id: string;
  vaccine: string;
  vaccine_name: string;
  vaccine_code: string;
  scheduled_date: string;
  administered_date: string | null;
  status: 'SCHEDULED' | 'DONE' | 'MISSED' | 'SKIPPED';
  batch_number: string | null;
  notes: string;
  dropout_probability: string | null;
  dropout_risk_tier: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  is_overdue: boolean;
}

// Status names: messages/en.json nurse.children.detail.vaxStatus.<STATUS>
const VAX_STATUS_META = {
  DONE:      { variant: 'success' as const, icon: CheckCircle,  bg: '#f0fdf4', border: '#86efac' },
  SCHEDULED: { variant: 'info'    as const, icon: Clock,        bg: '#eff6ff', border: '#93c5fd' },
  MISSED:    { variant: 'danger'  as const, icon: XCircle,      bg: '#fef2f2', border: '#fca5a5' },
  SKIPPED:   { variant: 'warn'    as const, icon: SkipForward,  bg: '#fffbeb', border: '#fcd34d' },
};

// Days until (positive) or since (negative) a date; shown with messages nurse.children.detail.due.*
function daysFromNow(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function VaccinationsTab({
  childId,
  childName,
  guardianPhone,
  guardianHasAccount,
}: {
  childId: string;
  childName: string;
  guardianPhone: string | null;
  guardianHasAccount: boolean;
}) {
  const tt = useTranslations('nurse.children.detail');
  const qc    = useQueryClient();
  const toast = useToast();
  const [filter, setFilter]         = useState<'ALL' | 'SCHEDULED' | 'DONE' | 'MISSED' | 'SKIPPED'>('ALL');
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set());
  const [reminding, setReminding]   = useState<string | null>(null);
  const [adminRec, setAdminRec]     = useState<VaxRecord | null>(null);
  const [adminDate, setAdminDate]   = useState(new Date().toISOString().split('T')[0]);
  const [adminBatch, setAdminBatch] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  const { data: records = [], isLoading } = useQuery<VaxRecord[]>({
    queryKey: ['child-vaccinations', childId],
    queryFn: async () => {
      const { data } = await apiClient.get('/vaccinations/', {
        params: { child: childId, page_size: 100 },
      });
      return data.data ?? data.results ?? [];
    },
    staleTime: 60_000,
  });

  const filtered = filter === 'ALL' ? records : records.filter((r) => r.status === filter);

  // Grouped sections
  const overdue   = records.filter((r) => r.is_overdue);
  const upcoming  = records.filter((r) => r.status === 'SCHEDULED' && !r.is_overdue);
  const given     = records.filter((r) => r.status === 'DONE');
  const missed    = records.filter((r) => r.status === 'MISSED');
  const skipped   = records.filter((r) => r.status === 'SKIPPED');

  const coveragePct = records.length
    ? Math.round((given.length / records.length) * 100)
    : 0;

  async function sendReminder(record: VaxRecord) {
    setReminding(record.id);
    try {
      await apiClient.post('/vaccinations/bulk-remind/', {});
      toast.success(tt('smsReminderQueuedFor'));
    } catch {
      toast.error(tt('couldNotQueueReminder'));
    }
    setReminderSent((s) => new Set([...s, record.id]));
    setReminding(null);
  }

  function openAdminModal(rec: VaxRecord) {
    setAdminRec(rec);
    setAdminDate(new Date().toISOString().split('T')[0]);
    setAdminBatch('');
    setAdminError('');
  }

  async function markAdministered() {
    if (!adminRec) return;
    setAdminLoading(true);
    setAdminError('');
    try {
      await apiClient.post(`/vaccinations/${adminRec.id}/administer/`, {
        administered_date: adminDate,
        ...(adminBatch ? { batch_number: adminBatch } : {}),
      });
      qc.invalidateQueries({ queryKey: ['child-vaccinations', childId] });
      toast.success(tt('recordedAsGiven', { vaccine: adminRec.vaccine_name }));
      setAdminRec(null);
      setAdminBatch('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string; error?: { detail?: string } } } })
        ?.response?.data?.error?.detail
        ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Failed to record dose. Please try again.';
      setAdminError(msg);
    } finally {
      setAdminLoading(false);
    }
  }

  // Summary pills
  const pills = [
    { label: tt('overdue'),  count: overdue.length,  color: 'var(--danger)' },
    { label: tt('upcoming'), count: upcoming.length,  color: 'var(--ink)' },
    { label: tt('given'),    count: given.length,     color: 'var(--success)' },
    { label: tt('missed'),   count: missed.length,    color: 'var(--danger)' },
    { label: tt('skipped'),  count: skipped.length,   color: 'var(--warn)' },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Coverage + summary */}
      <div className="rounded-2xl border p-4 flex flex-wrap gap-5 items-center" style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}>
        {/* Coverage ring */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle
              cx="36" cy="36" r="30" fill="none"
              stroke={coveragePct >= 80 ? 'var(--success)' : coveragePct >= 50 ? 'var(--warn)' : 'var(--danger)'}
              strokeWidth="8"
              strokeDasharray={`${(coveragePct / 100) * 188.5} 188.5`}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
            />
            <text x="36" y="40" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)">
              {coveragePct}%
            </text>
          </svg>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('coverage')}</p>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-2 flex-1">
          {pills.map(({ label, count, color }) => (
            <div key={label} className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)', minWidth: 60 }}>
              <span className="text-lg font-bold" style={{ color }}>{count}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Guardian reminder CTA */}
        {overdue.length > 0 && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{tt('overdueDoses', { count: overdue.length })}
            </p>
            {guardianHasAccount ? (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await apiClient.post('/vaccinations/bulk-remind/', {});
                    toast.success(tt('smsReminderQueuedFor'));
                  } catch { toast.error(tt('couldNotQueueReminder2')); }
                }}
              >
                <Bell size={13} className="mr-1" />{' '}{tt('sendSmsReminder')}</Button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <BellOff size={13} />{guardianPhone ? tt('noAppAccountCallPhone', { phone: guardianPhone }) : tt('noAppAccountCallGuardian')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(['ALL', 'SCHEDULED', 'MISSED', 'DONE', 'SKIPPED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="text-xs px-3 py-1.5 rounded-full border transition-colors"
            style={{
              background: filter === f ? 'var(--ink)' : 'var(--bg)',
              color:      filter === f ? '#fff' : 'var(--text-muted)',
              borderColor: filter === f ? 'var(--ink)' : 'var(--border)',
            }}
          >
            {tt(`vaxFilter.${f}`, { count:
              f === 'ALL' ? records.length :
              f === 'SCHEDULED' ? records.filter(r => r.status === 'SCHEDULED').length :
              f === 'MISSED' ? missed.length :
              f === 'DONE' ? given.length :
              skipped.length })}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>{tt('noVaccinationRecordsMatch')}</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}>
          {/* Header */}
          <div
            className="grid text-xs font-semibold px-4 py-2.5 border-b"
            style={{
              gridTemplateColumns: '1fr 90px 100px 80px 1fr',
              color: 'var(--text-muted)',
              borderColor: 'var(--border)',
              background: 'var(--bg)',
            }}
          >
            <span>{tt('vaccine')}</span>
            <span>{tt('scheduled')}</span>
            <span>{tt('status')}</span>
            <span>{tt('dropoutRisk')}</span>
            <span className="text-right">{tt('action')}</span>
          </div>

          {filtered.map((rec) => {
            const vaxStatus = rec.status in VAX_STATUS_META ? (rec.status as keyof typeof VAX_STATUS_META) : 'SCHEDULED';
            const meta = VAX_STATUS_META[vaxStatus];
            const Icon = meta.icon;
            const isOverdueRow = rec.is_overdue;
            const sent = reminderSent.has(rec.id);
            return (
              <div
                key={rec.id}
                className="grid px-4 py-3 border-b last:border-b-0 items-center gap-2 text-sm"
                style={{
                  gridTemplateColumns: '1fr 90px 100px 80px 1fr',
                  borderColor: 'var(--border)',
                  background: isOverdueRow ? '#fef2f2' : 'var(--bg-elev)',
                }}
              >
                {/* Vaccine */}
                <div>
                  <p className="font-medium" style={{ color: 'var(--ink)' }}>{rec.vaccine_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {rec.vaccine_code}
                    {rec.administered_date && tt('givenOn', { date: new Date(rec.administered_date).toLocaleDateString() })}
                    {rec.batch_number && tt('batchNo', { batch: rec.batch_number })}
                  </p>
                </div>

                {/* Scheduled date */}
                <div>
                  <p className="text-xs font-mono" style={{ color: isOverdueRow ? 'var(--danger)' : 'var(--ink)' }}>
                    {new Date(rec.scheduled_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </p>
                  {rec.status === 'SCHEDULED' && (
                    <p className="text-xs" style={{ color: isOverdueRow ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {(() => { const d = daysFromNow(rec.scheduled_date); return d === 0 ? tt('due.today') : d > 0 ? tt('due.inDays', { days: d }) : tt('due.daysAgo', { days: Math.abs(d) }); })()}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: meta.bg, color: meta.bg === '#f0fdf4' ? '#16a34a' : meta.bg === '#eff6ff' ? '#1d4ed8' : meta.bg === '#fef2f2' ? '#dc2626' : '#92400e', border: `1px solid ${meta.border}` }}
                  >
                    <Icon size={11} />
                    {tt(`vaxStatus.${vaxStatus}`)}
                    {isOverdueRow && rec.status === 'SCHEDULED' && tt('overdue2')}
                  </span>
                </div>

                {/* Dropout risk */}
                <div>
                  {rec.dropout_risk_tier ? (
                    <Badge variant={
                      rec.dropout_risk_tier === 'HIGH' ? 'danger' :
                      rec.dropout_risk_tier === 'MEDIUM' ? 'warn' : 'success'
                    }>
                      {rec.dropout_risk_tier}
                    </Badge>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>

                {/* Action */}
                <div className="flex gap-2 justify-end flex-wrap">
                  {rec.status === 'SCHEDULED' && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => openAdminModal(rec)}
                      >
                        <CheckCircle size={12} className="mr-1" />{' '}{tt('markGiven')}</Button>
                      {guardianHasAccount && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={sent || reminding === rec.id}
                          onClick={() => sendReminder(rec)}
                        >
                          {sent ? <><BellOff size={12} className="mr-1" /> Sent</> : reminding === rec.id ? tt('sending') : <><Bell size={12} className="mr-1" /> Remind</>}
                        </Button>
                      )}
                    </>
                  )}
                  {rec.status === 'DONE' && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--success)' }}>
                      <CheckCircle size={12} />{' '}{tt('completed')}</span>
                  )}
                  {rec.status === 'MISSED' && (
                    <Button size="sm" variant="ghost" onClick={() => openAdminModal(rec)}>
                      <CheckCircle size={12} className="mr-1" />{' '}{tt('recordLateDose')}</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Administer modal */}
      <Modal
        open={!!adminRec}
        onClose={() => !adminLoading && setAdminRec(null)}
        title={tt('recordDoseTitle', { name: childName })}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdminRec(null)} disabled={adminLoading}>{tt('cancel')}</Button>
            <Button variant="primary" onClick={markAdministered} loading={adminLoading}>{tt('saveDose')}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {adminRec && (
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{adminRec.vaccine_name}
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{adminRec.vaccine_code}</span>
            </p>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="children-administration-date" className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{tt('administrationDate')}</label>
            <input id="children-administration-date"
              type="date"
              value={adminDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setAdminDate(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--ink)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="children-batch-number-optional" className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{tt('batchNumberOptional')}</label>
            <input id="children-batch-number-optional"
              type="text"
              placeholder={tt('eGBcg2025')}
              value={adminBatch}
              onChange={(e) => setAdminBatch(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--ink)' }}
            />
          </div>
          {adminError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{adminError}</p>}
        </div>
      </Modal>
    </div>
  );
}

// ── Record Measurement Modal ──────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

function RecordMeasurementModal({ childId, onClose }: { childId: string; onClose: () => void }) {
  const tt = useTranslations('nurse.children.detail');
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
      setError(tt('failedToSaveMeasurement'));
    },
  });

  const handleSubmit = () => {
    setError('');
    const body: Record<string, unknown> = {
      child: childId,
      measurement_date: form.measurement_date,
      // How the values were taken (manual | iot) — the API rejects anything else
      data_source: 'manual',
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
    // Wrapping label: ties the visible text to the field for screen readers
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
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
    </label>
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
        <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{tt('recordMeasurement')}</h3>

        {field(tt('field.measurementDate'), 'measurement_date', 'date')}
        {field(tt('field.weightKg'), 'weight_kg', 'number', '0.1')}
        {field(tt('field.heightCm'), 'height_cm', 'number', '0.1')}
        {field(tt('field.muacCm'), 'muac_cm', 'number', '0.1')}
        {field(tt('field.temperature'), 'temperature_c', 'number', '0.1')}

        <div className="flex items-center gap-2">
          <input
            id="oedema-check"
            type="checkbox"
            checked={form.oedema}
            onChange={(e) => setForm((f) => ({ ...f, oedema: e.target.checked }))}
            className="w-4 h-4"
          />
          <label htmlFor="oedema-check" className="text-sm" style={{ color: 'var(--ink)' }}>{tt('oedemaPresent')}</label>
        </div>

        {field(tt('field.notesOptional'), 'notes', 'textarea')}

        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending} className="flex-1">{tt('cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} loading={mutation.isPending} className="flex-1">{tt('save')}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Referrals tab ─────────────────────────────────────────────────────────────

interface ReferralItem {
  id: string;
  target_facility: string;
  reason: string;
  urgency: 'ROUTINE' | 'SOON' | 'URGENT';
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  outcome: string;
  clinical_notes: string;
  referred_at: string;
  completed_at: string | null;
  referring_user_name: string | null;
}

const URGENCY_COLOR: Record<string, string> = {
  URGENT: '#ef4444',
  SOON: '#f59e0b',
  ROUTINE: '#10b981',
};

function ReferralsTab({ childId }: { childId: string }) {
  const tt = useTranslations('nurse.children.detail');
  const { data: referrals, isLoading } = useQuery<ReferralItem[]>({
    queryKey: ['child-referrals', childId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/children/${childId}/referrals/`);
      return data.data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (!referrals || referrals.length === 0) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tt('noReferralsOnRecord')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {referrals.map((r) => (
        <div key={r.id} className="rounded-2xl border p-5 flex flex-col gap-2"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{r.target_facility}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {r.referring_user_name ?? tt('unknown')} · {new Date(r.referred_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: URGENCY_COLOR[r.urgency] + '20', color: URGENCY_COLOR[r.urgency] }}>
                {r.urgency}
              </span>
              <Badge>{r.status}</Badge>
            </div>
          </div>
          <p className="text-sm">{r.reason}</p>
          {r.clinical_notes && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              {r.clinical_notes}
            </p>
          )}
          {r.outcome && (
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{tt('outcome', { outcome: r.outcome })}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── QR Card Panel ────────────────────────────────────────────────────────────

import dynamic from 'next/dynamic';
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false });

function ChildQRPanel({
  childId,
  childName,
  registrationNumber,
}: {
  childId: string;
  childName: string;
  registrationNumber: string;
}) {
  const tt = useTranslations('nurse.children.detail');
  const qrValue = childId; // UUID used for navigation after scan

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    if (!printWindow) return;
    const svgEl = document.getElementById('child-qr-svg');
    const svgHTML = svgEl ? svgEl.outerHTML : '';
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${tt('print.qrTitle', { name: childName })}</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    p  { font-size: 12px; color: #6b7280; margin: 2px 0; }
    svg { margin: 16px 0; }
    @media print { @page { size: 85mm 54mm; margin: 0; } body { padding: 8px; } }
  </style>
</head>
<body>
  <h1>${childName}</h1>
  <p>${registrationNumber}</p>
  ${svgHTML}
  <p style="font-size:10px;color:#9ca3af;">Scan to view health record · Ikibondo</p>
  <script>window.onload=function(){window.print();};<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="rounded-2xl border p-6 flex flex-col items-center gap-5 max-w-xs mx-auto"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
      <div className="text-center">
        <p className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{childName}</p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{registrationNumber}</p>
      </div>

      <div id="child-qr-svg" className="p-3 rounded-xl" style={{ backgroundColor: '#fff' }}>
        <QRCodeSVG
          value={qrValue}
          size={192}
          level="M"
          includeMargin={false}
        />
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{tt('scanWithIkibondoApp')}</p>

      <div className="flex gap-2 w-full">
        <Button variant="secondary" className="flex-1" onClick={handlePrint}>
          <Printer size={14} className="mr-1.5" />{' '}{tt('printCard')}</Button>
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
  const tt = useTranslations('nurse.children.detail');
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
      setError(tt('couldNotRequestDeletion'));
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
      setError(tt('couldNotCancelDeletion'));
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
            <p className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>{daysLeft > 0 ? tt('deletionDaysLeft', { count: daysLeft }) : tt('deletionDueToday')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tt('sRecordWillBe', { childName: childName, dueDate: dueDate?.toLocaleDateString() ?? '' })}</p>
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
        <Button variant="secondary" onClick={cancelDeletion} loading={loading}>
          <RotateCcw size={14} className="mr-1.5" aria-hidden="true" />{tt('cancelDeletion')}</Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
      <div>
        <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{tt('deleteChildRecord')}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tt('theRecordWillBe')}</p>
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="self-start flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)', backgroundColor: 'transparent' }}
        >
          <Trash2 size={13} aria-hidden="true" />{tt('requestDeletion')}</button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border p-3" style={{ borderColor: '#fca5a5', backgroundColor: 'var(--high-bg)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>{tt('areYouSureYou', { childName: childName })}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{tt('allAssociatedRecordsWill')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)} disabled={loading} className="flex-1">{tt('cancel')}</Button>
            <button
              type="button"
              onClick={requestDeletion}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
            >
              {loading ? tt('requesting') : tt('yesRequestDeletion')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tt = useTranslations('nurse.children.detail');
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<'chart' | 'vaccines' | 'history' | 'notes' | 'ml' | 'referrals' | 'qr'>('chart');
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

  // Typed shorthand helpers to avoid `unknown` leaking into JSX
  const str  = (k: string) => (c?.[k] as string)  ?? '';
  const bool = (k: string) => (c?.[k] as boolean) ?? false;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Back link */}
      <Link
        href="/nurse/children"
        className="no-print flex items-center gap-1.5 text-sm w-fit"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} aria-hidden="true" />{tt('children')}</Link>

      {/* Deletion pending banner */}
      {deletionRequestedAt && (
        <div className="no-print flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ backgroundColor: 'var(--high-bg)', color: 'var(--danger)' }}>
          <AlertTriangle size={15} aria-hidden="true" />{tt('thisRecordIsScheduled')}</div>
      )}

      {/* ── Child + Guardian card ───────────────────────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: deletionRequestedAt ? '#fca5a5' : 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        {/* Child identity row */}
        <div className="p-5 flex flex-wrap gap-4 items-start">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
            style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
            aria-hidden="true"
          >
            {str('full_name').charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              {str('full_name') || '—'}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {str('registration_number')} &middot; {str('age_display')} &middot;{' '}
              {str('sex') === 'M' ? tt('male') : str('sex') === 'F' ? tt('female') : '—'}
            </p>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {str('camp_name') && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {str('camp_name')}
                </span>
              )}
              {str('zone_name') && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{tt('zoneName', { zone: str('zone_name') })}
                </span>
              )}
            </div>
          </div>
          <Badge variant={bool('is_active') ? 'success' : 'default'}>
            {bool('is_active') ? tt('active') : tt('inactive')}
          </Badge>
        </div>

        {/* Guardian block — visually separated, prominent */}
        {str('guardian') && (
          <div
            className="border-t mx-0 px-5 py-4 flex flex-wrap items-center gap-4"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          >
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
              style={{ background: 'var(--ink)', color: 'var(--bg)', opacity: 0.9 }}
            >
              {str('guardian_name').charAt(0) || 'G'}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('parentGuardian')}</span>
                {bool('guardian_has_account') && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
                    <UserCheck size={11} />{' '}{tt('appAccount')}</span>
                )}
              </div>
              <p className="font-semibold text-sm mt-0.5" style={{ color: 'var(--ink)' }}>
                {str('guardian_name') || '—'}
              </p>
              <div className="flex flex-wrap gap-3 mt-1">
                {str('guardian_phone') && (
                  <a
                    href={`tel:${str('guardian_phone')}`}
                    className="flex items-center gap-1 text-xs hover:underline"
                    style={{ color: 'var(--ink)' }}
                  >
                    <Phone size={12} />
                    {str('guardian_phone')}
                  </a>
                )}
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Users size={12} />{tt('guardian')}</span>
              </div>
            </div>

            {/* View family profile CTA */}
            <Link
              href={`/nurse/guardians/${str('guardian')}`}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              <ExternalLink size={13} />{tt('familyProfile')}</Link>
          </div>
        )}
      </div>

      {/* ── Neonatal clinical details (shown only if any are recorded) ──── */}
      {(c?.birth_weight != null || c?.gestational_age != null || !!c?.feeding_type) && (
        <div
          className="rounded-2xl border px-5 py-4 no-print"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{tt('neonatalDetails')}</p>
          <div className="flex flex-wrap gap-6">
            {c?.birth_weight != null && (
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('birthWeight')}</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {Number(c.birth_weight).toFixed(2)} kg
                </p>
              </div>
            )}
            {c?.gestational_age != null && (
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('gestationalAge')}</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{tt('wks', { String: String(c.gestational_age) })}</p>
              </div>
            )}
            {!!c?.feeding_type && (
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('feedingType')}</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {{ BREAST: 'Breastfed', FORMULA: 'Formula', MIXED: 'Mixed' }[c.feeding_type as string] ?? String(c.feeding_type)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <Tabs
        className="no-print"
        active={activeTab}
        onChange={(k) => setActiveTab(k as typeof activeTab)}
        tabs={[
          { key: 'chart',    label: tt('growthChart'),   icon: <TrendingUp size={14} />    },
          { key: 'vaccines', label: tt('vaccinations'),   icon: <Syringe size={14} />       },
          { key: 'history',  label: tt('visitHistory'),  icon: <ClipboardList size={14} /> },
          { key: 'notes',    label: tt('clinicalNotes'), icon: <Pin size={14} />           },
          { key: 'ml',       label: tt('mlPrediction'),  icon: <Cpu size={14} />           },
          { key: 'referrals',label: tt('referrals'),      icon: <ExternalLink size={14} />  },
          { key: 'qr',       label: tt('qrCard'),        icon: <QrCode size={14} />        },
        ]}
      />

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div>
        {activeTab === 'chart' && (
          growthLoading
            ? <Skeleton className="h-72 rounded-2xl" />
            : growth?.who_percentiles
              ? (
                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
                  <GrowthChart growth={growth} childName={str('full_name')} />
                </div>
              )
              : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tt('noGrowthDataAvailable')}</p>
        )}

        {activeTab === 'vaccines' && (
          <VaccinationsTab
            childId={id}
            childName={str('full_name')}
            guardianPhone={str('guardian_phone') || null}
            guardianHasAccount={bool('guardian_has_account')}
          />
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setShowMeasurementModal(true)}>{tt('recordMeasurement')}</Button>
            </div>
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
              {historyLoading
                ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 m-2 rounded-lg" />)
                : history && history.length > 0
                  ? history.map((r: HealthRecordDetail) => <HistoryRow key={r.id} record={r} />)
                  : <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>{tt('noVisitHistoryYet')}</p>
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

        {activeTab === 'referrals' && (
          <ReferralsTab childId={id} />
        )}

        {activeTab === 'qr' && (
          <ChildQRPanel
            childId={id}
            childName={str('full_name')}
            registrationNumber={str('registration_number')}
          />
        )}
      </div>

      {/* ── Danger zone ─── */}
      <div className="no-print mt-4 flex flex-col gap-2">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{tt('dangerZone')}</p>
        <DeletePanel
          childId={id}
          childName={str('full_name') || 'this child'}
          deletionRequestedAt={deletionRequestedAt}
        />
      </div>

      {showMeasurementModal && (
        <RecordMeasurementModal childId={id} onClose={() => setShowMeasurementModal(false)} />
      )}
    </div>
  );
}
