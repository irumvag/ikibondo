'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { downloadInsightsCsv, getInsights } from '@/lib/api/insights';

const DEFINITIONS: [string, string][] = [
  ['Children', 'Active children registered in the camp.'],
  ['SAM / MAM', 'Children whose latest visit showed severe / moderate acute malnutrition (WHO weight-for-height, MUAC or oedema).'],
  ['Malnutrition rate', 'SAM + MAM as a share of children measured at least once.'],
  ['High risk', 'Children whose latest risk score is HIGH. The score supports, and never replaces, a clinician.'],
  ['Vaccination coverage', 'Doses given as a share of doses that were due by today.'],
  ['Visits (30 days)', 'Measurements recorded in the last 30 days.'],
  ['Open referrals', 'Referrals to a health facility that are not yet completed.'],
];

export default function InsightsReportsPage() {
  const toast = useToast();
  const [camp, setCamp] = useState('');
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ['insights', ''], queryFn: () => getInsights() });

  const download = async () => {
    setBusy(true);
    try {
      await downloadInsightsCsv(camp || undefined);
      toast.success('Report downloaded');
    } catch {
      toast.error('The report could not be downloaded. Try again later.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl w-full">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Reports</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Download the figures as a spreadsheet (CSV) for planning and reporting.
        </p>
      </div>

      <div className="rounded-2xl border p-5 flex flex-wrap items-end gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium" style={{ color: 'var(--ink)' }}>Camp</span>
          <select value={camp} onChange={(e) => setCamp(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border outline-none min-w-[14rem]"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
            <option value="">All my camps</option>
            {(data?.camps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <Button variant="primary" loading={busy} onClick={download} disabled={!data?.camps.length}>
          <Download size={15} className="mr-2" aria-hidden="true" /> Download CSV
        </Button>
      </div>

      <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
        <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--ink)' }}>What each figure means</h3>
        <dl className="flex flex-col gap-2.5 text-sm">
          {DEFINITIONS.map(([term, def]) => (
            <div key={term} className="grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)] gap-1 sm:gap-4">
              <dt className="font-semibold" style={{ color: 'var(--ink)' }}>{term}</dt>
              <dd style={{ color: 'var(--text)' }}>{def}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Counts from 1 to 4 appear as &ldquo;&lt;5&rdquo; so that no child can be identified. Individual records
          stay with the camp&apos;s health workers and are never part of these reports.
        </p>
      </section>
    </div>
  );
}
