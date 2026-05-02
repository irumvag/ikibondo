'use client';

import { useState } from 'react';
import { Baby } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCampChildren } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { SupervisedChild } from '@/lib/api/supervisor';

const STATUS_OPTIONS = [
  { value: '',       label: 'All statuses' },
  { value: 'SAM',    label: 'SAM'    },
  { value: 'MAM',    label: 'MAM'    },
  { value: 'NORMAL', label: 'Normal' },
];

const SEX_OPTIONS = [
  { value: '',  label: 'All' },
  { value: 'M', label: 'Male'   },
  { value: 'F', label: 'Female' },
];

const COLUMNS = [
  {
    key: 'full_name', header: 'Child name', width: '180px',
    render: (v: unknown, row: unknown) => {
      const c = row as SupervisedChild;
      return (
        <div>
          <p className="font-medium text-sm" style={{ color: 'var(--ink)' }}>{v as string}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.registration_number}</p>
        </div>
      );
    },
  },
  { key: 'age_display', header: 'Age',  width: '90px'  },
  {
    key: 'sex', header: 'Sex', width: '70px',
    render: (v: unknown) => (v === 'M' ? 'Male' : 'Female'),
  },
  { key: 'camp_name',     header: 'Camp',     width: '140px', render: (v: unknown) => (v as string) || '—' },
  { key: 'guardian_name', header: 'Guardian', width: '150px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'guardian_phone', header: 'Phone', width: '130px',
    render: (v: unknown) => (v as string) || '—',
  },
  {
    key: 'is_active', header: 'Active', width: '80px',
    render: (v: unknown) => <Badge variant={v ? 'success' : 'default'}>{v ? 'Yes' : 'No'}</Badge>,
  },
];

export default function ChildrenPage() {
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? undefined;
  const [statusFilter, setStatusFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCampChildren(
    campId,
    statusFilter || undefined,
    page,
  );

  // Client-side sex filter (ChildFilter handles camp + status server-side; sex is also server-side)
  const displayed = sexFilter
    ? (data?.items ?? []).filter((c: SupervisedChild) => c.sex === sexFilter)
    : (data?.items ?? []);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Children
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {data ? `${data.count.toLocaleString()} registered in your camp` : 'All registered children in your camp.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Baby size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by nutrition status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={sexFilter}
          onChange={(e) => setSexFilter(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by sex"
        >
          {SEX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label === 'All' ? 'All sexes' : o.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={COLUMNS as Parameters<typeof DataTable>[0]['columns']}
        data={displayed as Record<string, unknown>[]}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No children found"
        emptyDescription="No children match the selected filters."
        pagination={
          data && data.count > 20 && !sexFilter
            ? { page, pageSize: 20, total: data.count, onPageChange: setPage }
            : undefined
        }
      />
    </div>
  );
}
