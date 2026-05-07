'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, CheckCircle2, Loader2, Star } from 'lucide-react';
import {
  listConsultations, sendConsultationMessage, resolveConsultation,
  type Consultation,
} from '@/lib/api/chw';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function CHWConsultationsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [reply, setReply] = useState('');
  const [rating, setRating] = useState(0);

  const { data: consultations = [], isLoading } = useQuery({
    queryKey: ['chw', 'consultations'],
    queryFn: listConsultations,
    refetchInterval: 20_000,
  });

  const replyMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => sendConsultationMessage(id, body),
    onSuccess: (msg) => {
      qc.invalidateQueries({ queryKey: ['chw', 'consultations'] });
      setReply('');
      setSelected((prev) => prev ? {
        ...prev,
        messages: [...prev.messages, msg],
        message_count: prev.message_count + 1,
      } : prev);
    },
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, r }: { id: string; r: number }) => resolveConsultation(id, r),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['chw', 'consultations'] });
      setSelected(updated);
      setRating(0);
    },
  });

  const open     = consultations.filter((c) => c.status === 'OPEN');
  const resolved = consultations.filter((c) => c.status !== 'OPEN');

  return (
    <div className="flex gap-4 max-w-5xl mx-auto w-full" style={{ height: 'calc(100vh - 8rem)' }}>

      {/* ── Thread list ── */}
      <div
        className="w-64 shrink-0 flex flex-col gap-1 overflow-y-auto rounded-2xl border p-3"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <h2
          className="text-lg font-bold px-1 pb-2 shrink-0"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Consultations
        </h2>

        {isLoading ? (
          <>{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</>
        ) : consultations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={24} />}
            title="No consultations"
            description="Start one from a child record after a visit."
          />
        ) : (
          <>
            {open.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wider px-1 pt-1 pb-0.5" style={{ color: 'var(--text-muted)' }}>
                Open
              </p>
            )}
            {open.map((c) => (
              <ThreadRow key={c.id} c={c} active={selected?.id === c.id} onSelect={() => setSelected(c)} />
            ))}
            {resolved.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wider px-1 pt-3 pb-0.5" style={{ color: 'var(--text-muted)' }}>
                Resolved
              </p>
            )}
            {resolved.map((c) => (
              <ThreadRow key={c.id} c={c} active={selected?.id === c.id} onSelect={() => setSelected(c)} />
            ))}
          </>
        )}
      </div>

      {/* ── Thread detail ── */}
      <div
        className="flex-1 flex flex-col rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Select a consultation to view messages
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              className="px-5 py-3.5 flex items-center justify-between gap-3 border-b shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{selected.child_name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {selected.assigned_nurse_name ? `Nurse: ${selected.assigned_nurse_name}` : 'Unassigned'}
                  {' · '}
                  <span
                    className="font-medium"
                    style={{ color: selected.status === 'OPEN' ? 'var(--primary)' : 'var(--success)' }}
                  >
                    {selected.status}
                  </span>
                </p>
              </div>

              {selected.status === 'OPEN' && (
                <div className="flex items-center gap-2 shrink-0">
                  {/* Star rating */}
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setRating(n)}
                        className="transition-opacity hover:opacity-80"
                      >
                        <Star
                          size={14}
                          style={{
                            color: n <= rating ? 'var(--warn)' : 'var(--border)',
                            fill:  n <= rating ? 'var(--warn)' : 'none',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => resolveMut.mutate({ id: selected.id, r: rating || 5 })}
                    disabled={resolveMut.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-60"
                    style={{ background: 'var(--success)', color: '#fff' }}
                  >
                    {resolveMut.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Resolve
                  </button>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {selected.messages.length === 0 && (
                <p className="text-sm text-center mt-8" style={{ color: 'var(--text-muted)' }}>
                  No messages yet. Send the first one below.
                </p>
              )}
              {selected.messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-0.5 max-w-[80%]">
                  <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                    {msg.author_name} · {fmtTime(msg.created_at)}
                  </p>
                  <div
                    className="rounded-xl px-4 py-2.5 text-sm"
                    style={{ background: 'var(--bg-elev)', color: 'var(--ink)' }}
                  >
                    {msg.body}
                  </div>
                </div>
              ))}
            </div>

            {/* Reply box */}
            {selected.status === 'OPEN' && (
              <div
                className="px-4 py-3 flex gap-2 border-t shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && reply.trim()) {
                      e.preventDefault();
                      replyMut.mutate({ id: selected.id, body: reply });
                    }
                  }}
                  rows={2}
                  placeholder="Type your message… (Enter to send)"
                  className="flex-1 rounded-xl border px-3 py-2 text-sm resize-none outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--ink)',
                  }}
                />
                <button
                  onClick={() => { if (reply.trim()) replyMut.mutate({ id: selected.id, body: reply }); }}
                  disabled={replyMut.isPending || !reply.trim()}
                  className="self-end rounded-xl p-2.5 transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--primary)', color: '#fff' }}
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
  );
}

function ThreadRow({ c, active, onSelect }: { c: Consultation; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl border px-3 py-2.5 transition-colors"
      style={{
        borderColor: active ? 'var(--primary)' : 'var(--border)',
        background:  active ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
      }}
    >
      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{c.child_name}</p>
      <p className="text-xs mt-0.5 flex gap-1" style={{ color: 'var(--text-muted)' }}>
        <span>{c.message_count} msg{c.message_count !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{new Date(c.created_at).toLocaleDateString()}</span>
      </p>
    </button>
  );
}
