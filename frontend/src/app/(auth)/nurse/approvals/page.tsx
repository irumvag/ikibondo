'use client';

import { useState } from 'react';
import { CheckCircle, UserCheck } from 'lucide-react';
import { usePendingApprovals } from '@/lib/api/queries';
import { approveUser } from '@/lib/api/admin';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';

export default function NurseApprovalsPage() {
  const queryClient = useQueryClient();
  const { data: pending, isLoading } = usePendingApprovals();
  const [approving, setApproving] = useState<string | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const handleApprove = async (userId: string) => {
    setApproving(userId);
    setError('');
    try {
      await approveUser(userId);
      setApproved((prev) => new Set([...prev, userId]));
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    } catch {
      setError('Failed to approve. Please try again.');
    } finally {
      setApproving(null);
    }
  };

  const visible = (pending ?? []).filter((u) => !approved.has(u.id) && u.role === 'PARENT');

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Parent approvals
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Review and approve pending parent accounts in your camp.
        </p>
      </div>

      {error && (
        <p className="text-sm rounded-xl px-4 py-3 border" style={{ color: 'var(--danger)', borderColor: 'var(--danger)', backgroundColor: 'color-mix(in srgb, var(--danger) 8%, transparent)' }}>
          {error}
        </p>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--bg-elev)' }} />
          ))}
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle size={40} style={{ color: 'var(--success, #22c55e)' }} />
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>All clear</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No pending parent approvals in your camp.</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="flex flex-col divide-y rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {visible.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between px-5 py-4"
              style={{ backgroundColor: 'var(--bg-elev)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                  style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
                >
                  {u.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{u.full_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {u.email} {u.phone_number ? `· ${u.phone_number}` : ''}
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                loading={approving === u.id}
                onClick={() => handleApprove(u.id)}
              >
                <UserCheck size={14} className="mr-1.5" />
                Approve
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
