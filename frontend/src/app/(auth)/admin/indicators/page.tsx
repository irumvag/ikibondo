'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Target } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import {
  listIndicatorSettings, resetIndicatorSetting, saveIndicatorSetting, type IndicatorSetting,
} from '@/lib/api/insights';

const input = { borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' };

const HOW_JUDGED: Record<IndicatorSetting['kind'], string> = {
  wasting: 'Judged by the WHO/UNICEF wasting bands (fixed)',
  stunting: 'Judged by the WHO/UNICEF stunting bands (fixed)',
  target: 'Judged against the target below',
  info: 'Shown for information, no target',
};

/**
 * The indicators government and partner users see (Statistics): what each is called,
 * its target and the explanation under it. Built-in values follow WHO/UNICEF, UNHCR
 * and Sphere; change them to the Ministry's or the programme's own targets.
 */
export default function IndicatorsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['indicator-settings'], queryFn: listIndicatorSettings });

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Indicators</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          The indicators on the Statistics page and in reports. Change a name, a target or the explanation to match the
          Ministry&apos;s or your programme&apos;s standards. Changes show to every government and partner account straight away.
        </p>
      </div>
      {isLoading
        ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)
        : (data ?? []).map((s) => <IndicatorEditor key={`${s.key}-${s.edited}-${s.current.label}`} setting={s} />)}
    </div>
  );
}

function IndicatorEditor({ setting }: { setting: IndicatorSetting }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [label, setLabel] = useState(setting.current.label);
  const [target, setTarget] = useState(setting.current.target?.toString() ?? '');
  const [benchmark, setBenchmark] = useState(setting.current.benchmark);
  const [busy, setBusy] = useState(false);
  const isTarget = setting.kind === 'target';
  const dirty = label !== setting.current.label || benchmark !== setting.current.benchmark
    || target !== (setting.current.target?.toString() ?? '');

  const save = async () => {
    setBusy(true);
    try {
      await saveIndicatorSetting(setting.key, { label, benchmark, target: isTarget && target !== '' ? Number(target) : null });
      await qc.invalidateQueries({ queryKey: ['indicator-settings'] });
      await qc.invalidateQueries({ queryKey: ['insights'] });
      toast.success(`${label} saved`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await resetIndicatorSetting(setting.key);
      await qc.invalidateQueries({ queryKey: ['indicator-settings'] });
      await qc.invalidateQueries({ queryKey: ['insights'] });
      toast.success('Back to the built-in settings');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}>
          <Target size={18} aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-[12rem]">
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{setting.current.label}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {HOW_JUDGED[setting.kind]}
            {isTarget && ` · ${setting.higher_is_better ? 'higher is better' : 'lower is better'}`}
          </p>
        </div>
        {setting.edited && <Badge variant="info">Edited</Badge>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium" style={{ color: 'var(--ink)' }}>Name shown</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80}
            className="px-3 py-2 rounded-lg border outline-none" style={input} placeholder={setting.default.label} />
        </label>
        {isTarget && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium" style={{ color: 'var(--ink)' }}>Target (%)</span>
            <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal"
              className="px-3 py-2 rounded-lg border outline-none" style={input} placeholder={String(setting.default.target ?? '')} />
          </label>
        )}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium" style={{ color: 'var(--ink)' }}>Explanation (benchmark and source)</span>
        <textarea value={benchmark} onChange={(e) => setBenchmark(e.target.value)} rows={2} maxLength={300}
          className="px-3 py-2 rounded-lg border outline-none" style={input} placeholder={setting.default.benchmark} />
      </label>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Built-in: “{setting.default.label}”{setting.default.target != null && `, target ${setting.default.target}%`}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" loading={busy} disabled={!dirty || !label.trim()} onClick={save}>Save</Button>
        {setting.edited && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={reset}>
            <RotateCcw size={14} className="mr-1.5" aria-hidden="true" /> Built-in
          </Button>
        )}
      </div>
    </section>
  );
}
