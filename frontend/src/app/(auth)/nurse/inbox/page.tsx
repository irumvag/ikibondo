'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, MessageSquare, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { Consultation, ConsultationMessage } from '@/lib/api/chw';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

async function listNurseConsultations(): Promise<Consultation[]> {
  const { data } = await apiClient.get('/consultations/');
  return data.data ?? data.results ?? [];
}

async function replyToConsultation(id: string, body: string): Promise<ConsultationMessage> {
  const { data } = await apiClient.post(`/consultations/${id}/reply/`, { body });
  return data.data;
}

async function resolveConsultation(id: string): Promise<void> {
  await apiClient.post(`/consultations/${id}/resolve/`, {});
}

export default function NurseInboxPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [reply, setReply] = useState('');

  const { data: consultations = [], isLoading } = useQuery({
    queryKey: ['nurse', 'consultations'],
    queryFn: listNurseConsultations,
    refetchInterval: 20_000,
  });

  const replyMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => replyToConsultation(id, body),
    onSuccess: (msg) => {
      qc.invalidateQueries({ queryKey: ['nurse', 'consultations'] });
      setReply('');
      setSelected((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg], message_count: prev.message_count + 1 } : prev,
      );
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => resolveConsultation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse', 'consultations'] });
      setSelected(null);
    },
  });

  const open    = consultations.filter((c) => c.status === 'OPEN');
  const others  = consultations.filter((c) => c.status !== 'OPEN');

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Page header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          CHW Inbox
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {open.length} open consultation{open.length !== 1 ? 's' : ''} from your field workers.
        </p>
      </div>

      <div className="flex gap-5" style={{ minHeight: '520px' }}>
        {/* ── Sidebar list ── */}
        <div
          className="w-64 shrink-0 flex flex-col gap-2 rounded-2xl border p-3 overflow-y-auto"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-elev)',
            maxHeight: 'calc(100vh - 240px)',
          }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wider px-1 mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Open ({open.length})
          </p>

          {isLoading ? (
            <>{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</>
          ) : consultations.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={22} />}
              title="No consultations"
              description="CHWs in your camp will send queries here."
            />
          ) : (
            <>
              {open.map((c) => (
                <ConsultationRow
                  key={c.id}
                  c={c}
                  active={selected?.id === c.id}
                  onSelect={() => setSelected(c)}
                />
              ))}

              {others.length > 0 && (
                <p
                  className="text-xs font-semibold uppercase tracking-wider px-1 mt-3 mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Resolved ({others.length})
                </p>
              )}
              {others.map((c) => (
                <ConsultationRow
                  key={c.id}
                  c={c}
                  active={selected?.id === c.id}
                  onSelect={() => setSelected(c)}
                />
              ))}
            </>
          )}
        </div>

        {/* ── Thread panel ── */}
        <div
          className="flex-1 flex flex-col rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
              <MessageSquare size={32} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Select a consultation from the list.
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div
                className="px-5 py-4 border-b flex items-start justify-between gap-4 flex-wrap"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                    {selected.child_name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    From: {selected.opened_by_name}
                    &nbsp;·&nbsp;
                    <span
                      className="inline-block px-1.5 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: selected.status === 'OPEN' ? 'var(--low-bg)' : 'var(--bg-sand)',
                        color: selected.status === 'OPEN' ? 'var(--success)' : 'var(--text-muted)',
                      }}
                    >
                      {selected.status}
                    </span>
                  </p>
                </div>

                {selected.status === 'OPEN' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => resolveMut.mutate(selected.id)}
                    loading={resolveMut.isPending}
                  >
                    <CheckCircle2 size={13} className="mr-1.5" aria-hidden="true" />
                    Resolve
                  </Button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                {selected.messages.length === 0 && (
                  <p className="text-sm text-center mt-8" style={{ color: 'var(--text-muted)' }}>
                    No messages yet.
                  </p>
                )}
                {selected.messages.map((msg) => {
                  const isNurse = msg.author_name !== selected.opened_by_name;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-0.5 ${isNurse ? 'items-end' : 'items-start'}`}
                    >
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {msg.author_name} · {new Date(msg.created_at).toLocaleString()}
                      </p>
                      <div
                        className="rounded-2xl px-4 py-2.5 text-sm max-w-[80%]"
                        style={{
                          backgroundColor: isNurse ? 'var(--ink)' : 'var(--bg-sand)',
                          color: isNurse ? 'var(--bg)' : 'var(--ink)',
                        }}
                      >
                        {msg.body}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply box */}
              {selected.status === 'OPEN' && (
                <div
                  className="px-4 py-3 border-t flex gap-2 items-end"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && reply.trim()) {
                        replyMut.mutate({ id: selected.id, body: reply });
                      }
                    }}
                    rows={2}
                    placeholder="Reply to CHW… (Ctrl+Enter to send)"
                    className="flex-1 rounded-xl border px-3 py-2 text-sm resize-none outline-none"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--ink)',
                    }}
                  />
                  <button
                    onClick={() => { if (reply.trim()) replyMut.mutate({ id: selected.id, body: reply }); }}
                    disabled={replyMut.isPending || !reply.trim()}
                    className="rounded-xl p-2.5 transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
                    aria-label="Send reply"
                  >
                    {replyMut.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConsultationRow({
  c, active, onSelect,
}: {
  c: Consultation;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-xl border px-3 py-2.5 transition-colors"
      style={{
        borderColor:     active ? 'var(--ink)' : 'var(--border)',
        backgroundColor: active ? 'var(--bg-sand)' : 'transparent',
      }}
    >
      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
        {c.child_name}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {c.opened_by_name} · {c.message_count} msg{c.message_count !== 1 ? 's' : ''}
      </p>
    </button>
  );
}
