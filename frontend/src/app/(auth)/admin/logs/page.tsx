'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, Search } from 'lucide-react';
import { listAuditLog } from '@/lib/api/admin';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const ACTION_LABELS: Record<string, string> = {
  '0': 'Create',
  '1': 'Update',
  '2': 'Delete',
};

function actionVariant(action: string) {
  if (action === '0') return 'success';
  if (action === '2') return 'danger';
  return 'default';
}

const PAGE_SIZE = 25;

export default function SystemLogsPage() {
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-log', page, userFilter, actionFilter],
    queryFn: () =>
      listAuditLog({
        page,
        page_size: PAGE_SIZE,
        user: userFilter || undefined,
        action: actionFilter || undefined,
      }),
  });

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          System Logs
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Audit trail for all create, update, and delete actions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Filter by user ID"
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
            className="text-sm pl-9 pr-3 py-2 rounded-lg border outline-none w-52"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-2 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          <option value="0">Create</option>
          <option value="1">Update</option>
          <option value="2">Delete</option>
        </select>
        <span className="text-sm ml-auto" style={{ color: 'var(--text-muted)' }}>
          {data ? `${data.count.toLocaleString()} records` : ''}
        </span>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-sand)' }}>
                {['Timestamp', 'User', 'Action', 'Model', 'Object', 'Changes'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      {[0, 1, 2, 3, 4, 5].map((j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 rounded" /></td>
                      ))}
                    </tr>
                  ))
                : (data?.results ?? []).length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        <FileText size={24} className="mx-auto mb-2 opacity-40" />
                        No audit log entries found.
                      </td>
                    </tr>
                  )
                : (data?.results ?? []).map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t hover:bg-[var(--bg-sand)] transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[140px] truncate" style={{ color: 'var(--ink)' }}>
                        {entry.user_name || entry.user || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={actionVariant(entry.action)}>
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {entry.model}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[180px] truncate" style={{ color: 'var(--ink)' }}>
                        {entry.object_repr || entry.object_id}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[200px]">
                        {entry.changes && Object.keys(entry.changes).length > 0 ? (
                          <details>
                            <summary
                              className="cursor-pointer text-xs"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {Object.keys(entry.changes).length} field(s)
                            </summary>
                            <pre
                              className="mt-1 text-xs overflow-auto max-h-24 p-2 rounded"
                              style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
                            >
                              {JSON.stringify(entry.changes, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} aria-hidden="true" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
