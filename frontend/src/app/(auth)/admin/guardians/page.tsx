'use client';

import { useState } from 'react';
import { Search, Users, Baby, X, UserCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listGuardians, assignCHWToGuardian } from '@/lib/api/admin';
import { useAdminUsers } from '@/lib/api/queries';
import type { Guardian } from '@/lib/api/admin';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AuthUser } from '@/store/authStore';

export default function GuardiansPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<Guardian | null>(null);
  const [selectedChw, setSelectedChw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: guardians = [], isLoading } = useQuery({
    queryKey: ['guardians', search],
    queryFn: () => listGuardians(search || undefined),
    staleTime: 30_000,
  });

  const { data: users = [] } = useAdminUsers('CHW');
  const chws = users as AuthUser[];

  const openAssign = (g: Guardian) => {
    setAssigning(g);
    setSelectedChw(g.assigned_chw ?? '');
    setError('');
  };

  const handleAssign = async () => {
    if (!assigning) return;
    setSaving(true);
    setError('');
    try {
      await assignCHWToGuardian(assigning.id, selectedChw || null);
      qc.invalidateQueries({ queryKey: ['guardians'] });
      setAssigning(null);
    } catch {
      setError('Failed to update assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Guardian families
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {isLoading ? '—' : `${guardians.length} famil${guardians.length !== 1 ? 'ies' : 'y'} · assign CHWs for home visit tracking`}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && guardians.length === 0 && (
        <div
          className="rounded-2xl border px-6 py-12 flex flex-col items-center gap-3 text-center"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <Users size={40} style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>No guardian families found</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {search ? 'Try a different search term.' : 'No families with registered children yet.'}
          </p>
        </div>
      )}

      {/* List */}
      {guardians.length > 0 && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          {guardians.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
              >
                {g.full_name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{g.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {g.phone_number} · {g.relationship}
                  </span>
                  <span
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
                  >
                    <Baby size={11} />
                    {g.children_count ?? 0} {(g.children_count ?? 0) === 1 ? 'child' : 'children'}
                  </span>
                  {g.has_account && (
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#f0fdf4', color: 'var(--success)' }}
                    >
                      <UserCheck size={11} />
                      Has app account
                    </span>
                  )}
                </div>
              </div>

              {/* CHW + action */}
              <div className="flex items-center gap-3 shrink-0">
                {g.assigned_chw_name ? (
                  <Badge variant="info">{g.assigned_chw_name}</Badge>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No CHW</span>
                )}
                <Button size="sm" variant="secondary" onClick={() => openAssign(g)}>
                  Assign CHW
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign CHW modal */}
      {assigning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setAssigning(null); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 shadow-xl"
            style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                Assign CHW
              </h3>
              <button type="button" onClick={() => setAssigning(null)}>
                <X size={18} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Assigning a CHW to <strong style={{ color: 'var(--ink)' }}>{assigning.full_name}</strong>&#8217;s family
              allows that CHW to view and record visits for their {assigning.children_count ?? 0}{' '}
              {(assigning.children_count ?? 0) === 1 ? 'child' : 'children'}.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>CHW</label>
              <select
                value={selectedChw}
                onChange={(e) => setSelectedChw(e.target.value)}
                className="text-sm px-3 py-2 rounded-lg border outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
              >
                <option value="">— Remove assignment —</option>
                {chws.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name} ({c.camp_name ?? 'no camp'})</option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

            <div className="flex gap-2">
              <Button variant="primary" loading={saving} onClick={handleAssign} className="flex-1">
                Save
              </Button>
              <Button variant="secondary" onClick={() => setAssigning(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
