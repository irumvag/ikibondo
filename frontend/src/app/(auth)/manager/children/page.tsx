'use client';

import { useState } from 'react';
import { Search, Baby } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { listCampChildren, type SupervisedChild } from '@/lib/api/supervisor';
import { DataTable } from '@/components/ui/DataTable';
import { Skeleton } from '@/components/ui/Skeleton';

const SEX_OPTIONS = [
  { value: '',  label: 'All' },
  { value: 'M', label: 'Boys' },
  { value: 'F', label: 'Girls' },
];

const COLUMNS = [
  { key: 'full_name',           header: 'Name',           width: '180px' },
  { key: 'registration_number', header: 'Reg #',          width: '130px' },
  { key: 'age_display',         header: 'Age',            width: '90px'  },
  {
    key: 'sex', header: 'Sex', width: '70px',
    render: (v: unknown) => (v as string) === 'M' ? 'Male' : 'Female',
  },
  {
    key: 'guardian_name', header: 'Guardian', width: '160px',
    render: (v: unknown) => (v as string) || '—',
  },
  {
    key: 'guardian_phone', header: 'Phone', width: '140px',
    render: (v: unknown) => (v as string) || '—',
  },
];

export default function ManagerChildrenPage() {
  const user   = useAuthStore((s) => s.user);
  const campId = user?.camp ?? '';

  const [search, setSearch] = useState('');
  const [sex,    setSex]    = useState('');
  const [page,   setPage]   = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as unknown as { t?: ReturnType<typeof setTimeout> }).t);
    (handleSearch as unknown as { t?: ReturnType<typeof setTimeout> }).t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['manager', 'children', campId, debouncedSearch, sex, page],
    queryFn:  () => listCampChildren({
      camp: campId || undefined,
      search: debouncedSearch || undefined,
      sex:    sex || undefined,
      page,
      page_size: 20,
    }),
    enabled: !!campId,
    placeholderData: (prev) => prev,
  });

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
          {data ? `${data.count.toLocaleString()} registered children` : 'All children in your camp'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Baby size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name or reg #…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
            aria-label="Search children"
          />
        </div>

        {/* Sex filter */}
        {SEX_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => { setSex(o.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
            style={{
              borderColor:     sex === o.value ? 'var(--ink)' : 'var(--border)',
              backgroundColor: sex === o.value ? 'var(--ink)' : 'transparent',
              color:           sex === o.value ? 'var(--bg)'  : 'var(--text-muted)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={COLUMNS as Parameters<typeof DataTable>[0]['columns']}
        data={data?.items ?? []}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No children found"
        emptyDescription={
          debouncedSearch
            ? `No children match "${debouncedSearch}".`
            : 'No children registered in this camp yet.'
        }
        pagination={
          data && data.count > 20
            ? { page, pageSize: 20, total: data.count, onPageChange: setPage }
            : undefined
        }
      />
    </div>
  );
}
