'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Send, CheckCircle2, Loader2, Star,
  Plus, ArrowLeft, Search, UserCircle, Clock, CheckCheck,
} from 'lucide-react';
import {
  listConsultations, openConsultation, sendConsultationMessage, resolveConsultation,
  listCHWFamilies,
  type Consultation, type CHWChildSummary,
} from '@/lib/api/chw';
import { useAuthStore } from '@/store/authStore';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtMsgTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtThreadTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function CHWConsultationsPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [reply, setReply]             = useState('');
  const [rating, setRating]           = useState(0);
  const [showNew, setShowNew]         = useState(false);      // new-consultation modal
  const [mobileView, setMobileView]   = useState<'list' | 'chat'>('list');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // Main list — poll every 15s
  const { data: consultations = [], isLoading } = useQuery({
    queryKey: ['chw', 'consultations'],
    queryFn: listConsultations,
    refetchInterval: 15_000,
  });

  const selected = consultations.find((c) => c.id === selectedId) ?? null;

  // When a thread is active, poll faster (5s)
  useQuery({
    queryKey: ['chw', 'consultations'],
    queryFn: listConsultations,
    refetchInterval: 5_000,
    enabled: !!selectedId,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages.length]);

  const selectThread = (id: string) => {
    setSelectedId(id);
    setReply('');
    setRating(0);
    setMobileView('chat');
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // Send message
  const replyMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => sendConsultationMessage(id, body),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['chw', 'consultations'] });
    },
  });

  const sendReply = useCallback(() => {
    if (!selectedId || !reply.trim() || replyMut.isPending) return;
    replyMut.mutate({ id: selectedId, body: reply.trim() });
  }, [selectedId, reply, replyMut]);

  // Resolve consultation
  const resolveMut = useMutation({
    mutationFn: ({ id, r }: { id: string; r: number }) => resolveConsultation(id, r),
    onSuccess: () => {
      setRating(0);
      qc.invalidateQueries({ queryKey: ['chw', 'consultations'] });
    },
  });

  // Open new consultation
  const openMut = useMutation({
    mutationFn: (childId: string) => openConsultation(childId),
    onSuccess: (newThread) => {
      qc.invalidateQueries({ queryKey: ['chw', 'consultations'] });
      setShowNew(false);
      selectThread(newThread.id);
    },
  });

  const openList  = consultations.filter((c) => c.status === 'OPEN');
  const doneList  = consultations.filter((c) => c.status !== 'OPEN');

  return (
    <div className="flex max-w-5xl mx-auto w-full" style={{ height: 'calc(100vh - 7rem)' }}>

      {/* ── Sidebar (thread list) ─────────────────────────────────────────── */}
      <div
        className={`flex flex-col border-r shrink-0 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}
        style={{ width: 280, borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        {/* Sidebar header */}
        <div
          className="px-4 pt-4 pb-3 border-b flex items-center justify-between gap-2 shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2
            className="font-bold text-base"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Ask Nurse
          </h2>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            <Plus size={13} />
            New
          </button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 px-3 py-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : consultations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>No consultations yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Tap <strong>New</strong> to ask a nurse about a child.
              </p>
            </div>
          ) : (
            <>
              {openList.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-2 pb-1" style={{ color: 'var(--text-muted)' }}>
                    Open · {openList.length}
                  </p>
                  {openList.map((c) => (
                    <ThreadItem
                      key={c.id}
                      c={c}
                      active={selectedId === c.id}
                      meId={me?.id ?? ''}
                      onSelect={() => selectThread(c.id)}
                    />
                  ))}
                </>
              )}
              {doneList.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider px-4 pt-3 pb-1" style={{ color: 'var(--text-muted)' }}>
                    Resolved · {doneList.length}
                  </p>
                  {doneList.map((c) => (
                    <ThreadItem
                      key={c.id}
                      c={c}
                      active={selectedId === c.id}
                      meId={me?.id ?? ''}
                      onSelect={() => selectThread(c.id)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col overflow-hidden ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}
        style={{ background: 'var(--bg)' }}
      >
        {!selected ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--bg-elev)' }}
            >
              <MessageSquare size={28} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>Select a conversation</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Choose a thread on the left, or start a new consultation with a nurse.
              </p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <Plus size={15} />
              Ask a nurse
            </button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div
              className="px-4 py-3 border-b shrink-0 flex items-center gap-3"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              {/* Back button (mobile) */}
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-sand)]"
                onClick={() => setMobileView('list')}
              >
                <ArrowLeft size={18} style={{ color: 'var(--ink)' }} />
              </button>

              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--bg-elev)' }}
              >
                <UserCircle size={20} style={{ color: 'var(--text-muted)' }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>
                    {selected.child_name}
                  </p>
                  <Badge variant={selected.status === 'OPEN' ? 'info' : 'success'}>
                    {selected.status}
                  </Badge>
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {selected.assigned_nurse_name
                    ? `Nurse: ${selected.assigned_nurse_name}`
                    : 'Awaiting nurse assignment'}
                  {' · '}Opened {fmtThreadTime(selected.created_at)}
                </p>
              </div>

              {/* Resolve controls */}
              {selected.status === 'OPEN' && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex gap-0.5" title="Rate helpfulness">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setRating(n)} className="p-0.5 hover:opacity-80">
                        <Star
                          size={13}
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
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-60 hover:opacity-80"
                    style={{ background: 'var(--success)', color: '#fff' }}
                  >
                    {resolveMut.isPending
                      ? <Loader2 size={12} className="animate-spin" />
                      : <CheckCircle2 size={12} />}
                    Resolve
                  </button>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
              {selected.messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-12">
                  <Clock size={24} style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No messages yet.
                    {selected.assigned_nurse_name
                      ? ` ${selected.assigned_nurse_name} will respond soon.`
                      : ' A nurse will be assigned shortly.'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Start the conversation by describing your concern below.
                  </p>
                </div>
              )}

              {/* Date separators + bubbles */}
              {(() => {
                const items = selected.messages;
                const rendered: React.ReactNode[] = [];
                let lastDateStr = '';

                items.forEach((msg, idx) => {
                  const msgDate = new Date(msg.created_at);
                  const dateStr = msgDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
                  const isMe = msg.author === me?.id;
                  const prevMsg = idx > 0 ? items[idx - 1] : null;
                  const nextMsg = idx < items.length - 1 ? items[idx + 1] : null;
                  const showAuthor = !prevMsg || prevMsg.author !== msg.author;
                  const isLastInGroup = !nextMsg || nextMsg.author !== msg.author;

                  // Date separator
                  if (dateStr !== lastDateStr) {
                    lastDateStr = dateStr;
                    rendered.push(
                      <div key={`sep-${msg.id}`} className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                        <span className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>{dateStr}</span>
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                      </div>
                    );
                  }

                  rendered.push(
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isLastInGroup ? 'mb-3' : 'mb-0.5'}`}
                    >
                      {/* Author label */}
                      {showAuthor && !isMe && (
                        <p className="text-xs font-medium mb-1 ml-1" style={{ color: 'var(--text-muted)' }}>
                          {msg.author_name ?? 'Nurse'}
                        </p>
                      )}

                      <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} max-w-[75%]`}>
                        {/* Avatar (only last in group) */}
                        {!isMe && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-0.5"
                            style={{
                              background: isLastInGroup ? 'var(--primary)' : 'transparent',
                              visibility: isLastInGroup ? 'visible' : 'hidden',
                            }}
                          >
                            {isLastInGroup && (
                              <UserCircle size={16} style={{ color: '#fff' }} />
                            )}
                          </div>
                        )}

                        {/* Bubble */}
                        <div
                          className="px-4 py-2.5 text-sm"
                          style={{
                            background: isMe ? 'var(--primary)' : 'var(--card)',
                            color:      isMe ? '#fff' : 'var(--ink)',
                            border:     isMe ? 'none' : '1px solid var(--border)',
                            borderRadius: isMe
                              ? `18px 18px 4px 18px`
                              : `18px 18px 18px 4px`,
                            maxWidth: '100%',
                            wordBreak: 'break-word',
                          }}
                        >
                          {msg.body}
                        </div>
                      </div>

                      {/* Time (only last in group) */}
                      {isLastInGroup && (
                        <div className={`flex items-center gap-1 mt-1 ${isMe ? 'pr-1' : 'pl-9'}`}>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {fmtMsgTime(msg.created_at)}
                          </span>
                          {isMe && (
                            <CheckCheck size={12} style={{ color: 'var(--success)' }} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                });

                return rendered;
              })()}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            {selected.status === 'OPEN' ? (
              <div
                className="px-4 py-3 border-t shrink-0 flex items-end gap-2"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
              >
                <textarea
                  ref={textareaRef}
                  value={reply}
                  onChange={(e) => {
                    setReply(e.target.value);
                    // Auto-resize
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  rows={1}
                  placeholder="Message… (Enter to send, Shift+Enter for newline)"
                  className="flex-1 rounded-2xl border px-4 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--ink)',
                    minHeight: 42,
                    maxHeight: 120,
                    overflowY: 'auto',
                  }}
                />
                <button
                  onClick={sendReply}
                  disabled={replyMut.isPending || !reply.trim()}
                  className="rounded-full p-2.5 shrink-0 transition-all disabled:opacity-40 hover:opacity-80"
                  style={{ background: 'var(--primary)', color: '#fff' }}
                >
                  {replyMut.isPending
                    ? <Loader2 size={18} className="animate-spin" />
                    : <Send size={18} />}
                </button>
              </div>
            ) : (
              <div
                className="px-4 py-3 border-t shrink-0 text-center text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--card)' }}
              >
                <CheckCircle2 size={14} className="inline mr-1.5" style={{ color: 'var(--success)' }} />
                This consultation was resolved
                {selected.resolved_at ? ` on ${fmtThreadTime(selected.resolved_at)}` : ''}.
                {selected.helpful_rating && (
                  <span className="ml-2">
                    {'★'.repeat(selected.helpful_rating)}{'☆'.repeat(5 - selected.helpful_rating)}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── New Consultation modal ────────────────────────────────────────── */}
      {showNew && (
        <NewConsultationModal
          onOpen={(childId) => openMut.mutate(childId)}
          onClose={() => setShowNew(false)}
          isOpening={openMut.isPending}
        />
      )}
    </div>
  );
}

// ── ThreadItem ─────────────────────────────────────────────────────────────────

function ThreadItem({
  c, active, meId, onSelect,
}: {
  c: Consultation;
  active: boolean;
  meId: string;
  onSelect: () => void;
}) {
  const lastMsg = c.messages[c.messages.length - 1];
  const lastBody = lastMsg?.body ?? '';
  const isOwnLast = lastMsg?.author === meId;

  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-4 py-3 transition-colors hover:bg-[var(--bg-sand)]"
      style={{
        background: active ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
        borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
          {c.child_name}
        </p>
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
          {c.messages.length > 0 ? fmtThreadTime(lastMsg.created_at) : fmtThreadTime(c.created_at)}
        </span>
      </div>
      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
        {lastBody
          ? `${isOwnLast ? 'You: ' : ''}${lastBody}`
          : c.assigned_nurse_name
          ? `Nurse: ${c.assigned_nurse_name}`
          : 'No messages yet'}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
          style={{
            background: c.status === 'OPEN' ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--bg-elev)',
            color: c.status === 'OPEN' ? 'var(--primary)' : 'var(--text-muted)',
          }}
        >
          {c.status === 'OPEN' ? 'Open' : 'Resolved'}
        </span>
        {c.message_count > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {c.message_count} msg{c.message_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  );
}

// ── NewConsultationModal ───────────────────────────────────────────────────────

function NewConsultationModal({
  onOpen, onClose, isOpening,
}: {
  onOpen: (childId: string) => void;
  onClose: () => void;
  isOpening: boolean;
}) {
  const [search, setSearch] = useState('');
  const [pickedChild, setPickedChild] = useState<CHWChildSummary | null>(null);

  const { data: families = [], isLoading } = useQuery({
    queryKey: ['chw-families'],
    queryFn: listCHWFamilies,
    staleTime: 2 * 60 * 1000,
  });

  const allChildren: (CHWChildSummary & { guardian_name: string })[] = families.flatMap((f) =>
    f.children.map((c) => ({ ...c, guardian_name: f.full_name }))
  );

  const filtered = search.trim()
    ? allChildren.filter(
        (c) =>
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.registration_number.toLowerCase().includes(search.toLowerCase()) ||
          c.guardian_name.toLowerCase().includes(search.toLowerCase())
      )
    : allChildren;

  const RISK_COLOR: Record<string, string> = {
    HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)', UNKNOWN: 'var(--text-muted)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border flex flex-col shadow-xl overflow-hidden"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
        >
          <div>
            <p className="font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              Ask a nurse
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Pick the child you want advice about
            </p>
          </div>
          <button onClick={onClose} className="text-xl leading-none px-2" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search child or parent name…"
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* Child list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No children found"
              description="Try a different name or check your caseload."
            />
          ) : (
            filtered.map((child) => {
              const picked = pickedChild?.id === child.id;
              return (
                <button
                  key={child.id}
                  onClick={() => setPickedChild(picked ? null : child)}
                  className="w-full text-left px-4 py-3 border-b flex items-center gap-3 hover:bg-[var(--bg-sand)] transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    background: picked ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
                  }}
                >
                  {/* Risk dot */}
                  <span
                    className="shrink-0 mt-0.5"
                    style={{
                      display: 'inline-block',
                      width: 8, height: 8,
                      borderRadius: '50%',
                      background: RISK_COLOR[child.risk_level] ?? 'var(--text-muted)',
                      marginTop: 6,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                      {child.full_name}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {child.age_display} · {child.guardian_name}
                      {child.zone_name ? ` · ${child.zone_name}` : ''}
                    </p>
                  </div>
                  {picked && (
                    <CheckCircle2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 flex gap-2" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => pickedChild && onOpen(pickedChild.id)}
            disabled={!pickedChild || isOpening}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium disabled:opacity-40 transition-opacity hover:opacity-80 flex items-center justify-center gap-2"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {isOpening && <Loader2 size={14} className="animate-spin" />}
            Open consultation
          </button>
        </div>
      </div>
    </div>
  );
}
