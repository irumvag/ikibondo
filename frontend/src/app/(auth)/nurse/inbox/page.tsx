'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { Consultation, ConsultationMessage } from '@/lib/api/chw';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

async function listNurseConsultations(): Promise<Consultation[]> {
  const { data } = await apiClient.get('/consultations/');
  return data.data ?? data.results ?? [];
}

async function replyToConsultation(id: string, body: string): Promise<ConsultationMessage> {
  const { data } = await apiClient.post(`/consultations/${id}/reply/`, { body });
  return data.data;
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
      setSelected((prev) => prev ? { ...prev, messages: [...prev.messages, msg], message_count: prev.message_count + 1 } : prev);
    },
  });

  const open = consultations.filter((c) => c.status === 'OPEN');
  const others = consultations.filter((c) => c.status !== 'OPEN');

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)] max-w-4xl">
      <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
        <div>
          <h1 className="text-xl font-bold text-gray-900">CHW Inbox</h1>
          <p className="text-xs text-gray-500 mt-0.5">{open.length} open consultation{open.length !== 1 ? 's' : ''}</p>
        </div>
        {isLoading ? (
          <>{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</>
        ) : consultations.length === 0 ? (
          <EmptyState title="No consultations" description="CHWs in your camp will send queries here." />
        ) : (
          <>
            {open.map((c) => <Row key={c.id} c={c} selected={selected?.id === c.id} onSelect={() => setSelected(c)} />)}
            {others.length > 0 && <p className="text-xs text-gray-400 uppercase tracking-wider mt-3">Resolved</p>}
            {others.map((c) => <Row key={c.id} c={c} selected={selected?.id === c.id} onSelect={() => setSelected(c)} />)}
          </>
        )}
      </div>

      <div className="flex-1 flex flex-col border border-gray-200 rounded-2xl overflow-hidden bg-white">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Select a consultation</div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-900">{selected.child_name}</p>
              <p className="text-xs text-gray-500">From: {selected.opened_by_name} · {selected.status}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {selected.messages.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-8">No messages yet.</p>
              )}
              {selected.messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-0.5">
                  <p className="text-xs text-gray-400">{msg.author_name} · {new Date(msg.created_at).toLocaleString()}</p>
                  <div className="inline-block rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-800 max-w-[80%]">{msg.body}</div>
                </div>
              ))}
            </div>
            {selected.status === 'OPEN' && (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder="Reply to CHW…"
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

function Row({ c, selected, onSelect }: { c: Consultation; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
    >
      <p className="text-sm font-medium text-gray-900 truncate">{c.child_name}</p>
      <p className="text-xs text-gray-500">{c.opened_by_name} · {c.message_count} msg{c.message_count !== 1 ? 's' : ''}</p>
    </button>
  );
}
