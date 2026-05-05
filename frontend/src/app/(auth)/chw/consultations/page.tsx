'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, CheckCircle2, Loader2 } from 'lucide-react';
import {
  listConsultations, sendConsultationMessage, resolveConsultation,
  type Consultation,
} from '@/lib/api/chw';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CHWConsultationsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [reply, setReply] = useState('');

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
    mutationFn: ({ id, rating }: { id: string; rating?: number }) => resolveConsultation(id, rating),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['chw', 'consultations'] });
      setSelected(updated);
    },
  });

  const open = consultations.filter((c) => c.status === 'OPEN');
  const resolved = consultations.filter((c) => c.status !== 'OPEN');

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)] max-w-4xl">
      {/* Thread list */}
      <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
        <h1 className="text-xl font-bold text-gray-900 shrink-0">Consultations</h1>

        {isLoading ? (
          <>{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</>
        ) : consultations.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={24} />}
            title="No consultations"
            description="Open a consultation from a child's health record after a visit."
          />
        ) : (
          <>
            {open.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">Open</p>
            )}
            {open.map((c) => (
              <ConsultationRow key={c.id} c={c} selected={selected?.id === c.id} onSelect={() => setSelected(c)} />
            ))}
            {resolved.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-3">Resolved</p>
            )}
            {resolved.map((c) => (
              <ConsultationRow key={c.id} c={c} selected={selected?.id === c.id} onSelect={() => setSelected(c)} />
            ))}
          </>
        )}
      </div>

      {/* Thread detail */}
      <div className="flex-1 flex flex-col border border-gray-200 rounded-2xl overflow-hidden bg-white">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Select a consultation to view messages
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{selected.child_name}</p>
                <p className="text-xs text-gray-500">
                  {selected.assigned_nurse_name ? `Nurse: ${selected.assigned_nurse_name}` : 'Unassigned'} · {selected.status}
                </p>
              </div>
              {selected.status === 'OPEN' && (
                <button
                  onClick={() => resolveMut.mutate({ id: selected.id, rating: 5 })}
                  disabled={resolveMut.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {resolveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Mark resolved
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {selected.messages.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-8">No messages yet.</p>
              )}
              {selected.messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-0.5">
                  <p className="text-xs text-gray-400">{msg.author_name} · {new Date(msg.created_at).toLocaleString()}</p>
                  <div className="inline-block rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-800 max-w-[80%]">
                    {msg.body}
                  </div>
                </div>
              ))}
            </div>

            {selected.status === 'OPEN' && (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder="Type your message…"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => { if (reply.trim()) replyMut.mutate({ id: selected.id, body: reply }); }}
                  disabled={replyMut.isPending || !reply.trim()}
                  className="self-end rounded-xl bg-blue-600 p-2.5 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {replyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConsultationRow({ c, selected, onSelect }: { c: Consultation; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <p className="text-sm font-medium text-gray-900 truncate">{c.child_name}</p>
      <p className="text-xs text-gray-500">{c.message_count} message{c.message_count !== 1 ? 's' : ''} · {new Date(c.created_at).toLocaleDateString()}</p>
    </button>
  );
}
