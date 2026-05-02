import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from './Skeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  /** Custom cell renderer. Receives the row value keyed by `key`, plus the full row. */
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  /** Unique field used as React key */
  keyField: keyof T;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: Pagination;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DataTable<T extends object>({
  columns,
  data,
  keyField,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription,
  pagination,
  className = '',
}: DataTableProps<T>) {
  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.pageSize)
    : 1;

  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          {/* Head */}
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                  style={{
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-sand)',
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton className="h-4 rounded-md" style={{ width: col.width ?? '80%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
              ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-14 text-center">
                      <p
                        className="text-sm font-semibold mb-1"
                        style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
                      >
                        {emptyTitle}
                      </p>
                      {emptyDescription && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {emptyDescription}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              : data.map((row) => (
                  <tr
                    key={String((row as Record<string, unknown>)[keyField as string])}
                    className="transition-colors hover:bg-[var(--bg-sand)]"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 whitespace-nowrap"
                        style={{ color: 'var(--text)' }}
                      >
                        {col.render
                          ? col.render((row as Record<string, unknown>)[col.key], row)
                          : String((row as Record<string, unknown>)[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {pagination.page} of {totalPages} · {pagination.total} total
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--bg-sand)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: 'var(--ink)' }}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>

            {/* Page number pills */}
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const p = i + 1;
              const active = p === pagination.page;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => pagination.onPageChange(p)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--ink)' : 'transparent',
                    color: active ? 'var(--bg)' : 'var(--text-muted)',
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--bg-sand)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: 'var(--ink)' }}
              aria-label="Next page"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
