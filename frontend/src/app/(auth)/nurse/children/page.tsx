'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Baby, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCampChildren } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { SupervisedChild } from '@/lib/api/supervisor';

// Extend SupervisedChild with the deletion field
type ChildWithDeletion = SupervisedChild & { deletion_requested_at?: string | null };

const STATUS_OPTIONS = [
  { value: '',       label: 'All statuses' },
  { value: 'SAM',    label: 'SAM'    },
  { value: 'MAM',    label: 'MAM'    },
  { value: 'NORMAL', label: 'Normal' },
];

const SEX_OPTIONS = [
  { value: '',  label: 'All sexes' },
  { value: 'M', label: 'Male'      },
  { value: 'F', label: 'Female'    },
];

const COLUMNS = [
  {
    key: 'full_name', header: 'Child', width: '220px',
    render: (v: unknown, row: unknown) => {
      const c = row as ChildWithDeletion;
      return (
        <Link
          href={`/nurse/children/${c.id}`}
          className="flex items-center gap-2 group"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-sm group-hover:underline" style={{ color: 'var(--ink)' }}>
                {v as string}
              </p>
              {c.deletion_requested_at && (
                <span title="Deletion pending"><AlertTriangle size={12} style={{ color: 'var(--danger)' }} /></span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.registration_number}</p>
          </div>
          <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        </Link>
      );
    },
  },
  { key: 'age_display', header: 'Age',  width: '90px' },
  {
    key: 'sex', header: 'Sex', width: '70px',
    render: (v: unknown) => <Badge variant="default">{(v as string) === 'M' ? 'Male' : 'Female'}</Badge>,
  },
  { key: 'camp_name',     header: 'Camp',     width: '140px', render: (v: unknown) => (v as string) || '—' },
  { key: 'guardian_name', header: 'Guardian', width: '160px', render: (v: unknown) => (v as string) || '—' },
  { key: 'guardian_phone', header: 'Phone',   width: '130px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'id', header: '', width: '80px',
    render: (_: unknown, row: unknown) => {
      const c = row as SupervisedChild;
      return (
        <Link
          href={`/nurse/children/${c.id}`}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          View
        </Link>
      );
    },
  },
];

export default function NurseChildrenPage() {
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? undefined;
  const [statusFilter, setStatusFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCampChildren(campId, statusFilter || undefined, page, search || undefined);

  const displayed = sexFilter
    ? (data?.items ?? []).filter((c: SupervisedChild) => c.sex === sexFilter)
    : (data?.items ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Children
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {data ? `${data.count.toLocaleString()} registered` : 'Registered children in your camp.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Baby size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or parent…"
          className="text-sm px-3 py-1.5 rounded-lg border outline-none flex-1 min-w-[200px]"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Search children"
        />
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
          onChange={(e) => { setSexFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by sex"
        >
          {SEX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={COLUMNS as Parameters<typeof DataTable>[0]['columns']}
        data={displayed }
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No children found"
        emptyDescription="No children match the selected filters in your camp."
        pagination={
          data && data.count > 20 && !sexFilter
            ? { page, pageSize: 20, total: data.count, onPageChange: setPage }
            : undefined
        }
      />
    </div>
  );
}

