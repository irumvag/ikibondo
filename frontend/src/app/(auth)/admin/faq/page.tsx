'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, Check, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminFaq, QK } from '@/lib/api/queries';
import {
  createFaqItem, updateFaqItem, deleteFaqItem,
} from '@/lib/api/admin';
import type { FAQItem } from '@/lib/api/public';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

type Lang = 'en' | 'rw' | 'fr';

const LANG_LABELS: Record<Lang, string> = { en: 'English', rw: 'Kinyarwanda', fr: 'Français' };

// ── Inline editor ──────────────────────────────────────────────────────────────
type FAQPayload = Pick<FAQItem,
  'question' | 'answer' |
  'question_rw' | 'answer_rw' |
  'question_fr' | 'answer_fr' |
  'order' | 'is_published'
>;

interface EditorProps {
  initial?: Partial<FAQItem>;
  onSave: (payload: FAQPayload) => Promise<void>;
  onCancel: () => void;
}

function FAQEditor({ initial, onSave, onCancel }: EditorProps) {
  const [lang, setLang] = useState<Lang>('en');

  const [question,    setQuestion]    = useState(initial?.question    ?? '');
  const [answer,      setAnswer]      = useState(initial?.answer      ?? '');
  const [questionRw,  setQuestionRw]  = useState(initial?.question_rw ?? '');
  const [answerRw,    setAnswerRw]    = useState(initial?.answer_rw   ?? '');
  const [questionFr,  setQuestionFr]  = useState(initial?.question_fr ?? '');
  const [answerFr,    setAnswerFr]    = useState(initial?.answer_fr   ?? '');
  const [order,       setOrder]       = useState(initial?.order       ?? 0);
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) {
      setError('English question and answer are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        question: question.trim(),
        answer: answer.trim(),
        question_rw: questionRw.trim(),
        answer_rw: answerRw.trim(),
        question_fr: questionFr.trim(),
        answer_fr: answerFr.trim(),
        order,
        is_published: isPublished,
      });
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.75rem',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    color: 'var(--ink)',
    fontSize: '0.875rem',
    outline: 'none',
  };

  const currentQuestion = lang === 'en' ? question   : lang === 'rw' ? questionRw : questionFr;
  const currentAnswer   = lang === 'en' ? answer     : lang === 'rw' ? answerRw   : answerFr;
  const setCurrentQ = lang === 'en' ? setQuestion   : lang === 'rw' ? setQuestionRw : setQuestionFr;
  const setCurrentA = lang === 'en' ? setAnswer     : lang === 'rw' ? setAnswerRw   : setAnswerFr;

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      {/* Lang tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-sand)' }}>
        {(['en', 'rw', 'fr'] as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: lang === l ? 'var(--bg-elev)' : 'transparent',
              color: lang === l ? 'var(--ink)' : 'var(--text-muted)',
            }}
          >
            {LANG_LABELS[l]}
            {l !== 'en' && (
              <span
                className="ml-1 text-[10px] px-1 rounded-full"
                style={{
                  backgroundColor: (l === 'rw' ? questionRw : questionFr).trim() ? '#f0fdf4' : 'var(--bg-sand)',
                  color: (l === 'rw' ? questionRw : questionFr).trim() ? 'var(--success)' : 'var(--text-muted)',
                }}
              >
                {(l === 'rw' ? questionRw : questionFr).trim() ? '✓' : '—'}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Question {lang !== 'en' && <span className="font-normal opacity-70">({LANG_LABELS[lang]})</span>}
          {lang !== 'en' && <span className="ml-1 font-normal opacity-50">optional</span>}
        </label>
        <input
          value={currentQuestion}
          onChange={(e) => setCurrentQ(e.target.value)}
          placeholder={lang === 'en' ? 'Enter question…' : `${LANG_LABELS[lang]} translation…`}
          style={inputStyle}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Answer {lang !== 'en' && <span className="font-normal opacity-70">({LANG_LABELS[lang]})</span>}
        </label>
        <textarea
          value={currentAnswer}
          onChange={(e) => setCurrentA(e.target.value)}
          placeholder={lang === 'en' ? 'Enter answer…' : `${LANG_LABELS[lang]} translation…`}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Order</label>
          <input
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            style={{ ...inputStyle, width: '5rem' }}
          />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button
            type="button"
            onClick={() => setIsPublished((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: isPublished ? 'var(--success)' : 'var(--text-muted)' }}
          >
            {isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
            {isPublished ? 'Published' : 'Draft'}
          </button>
        </div>
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
          <Check size={14} className="mr-1.5" />
          Save
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          <X size={14} className="mr-1.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── FAQ row ────────────────────────────────────────────────────────────────────
function FAQRow({
  item,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  item: FAQItem;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
  const hasRw = !!(item.question_rw?.trim());
  const hasFr = !!(item.question_fr?.trim());

  return (
    <div
      className="flex items-start gap-3 px-4 py-4 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <GripVertical size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: item.is_published ? '#f0fdf4' : 'var(--bg-sand)',
              color: item.is_published ? 'var(--success)' : 'var(--text-muted)',
            }}
          >
            {item.is_published ? 'Published' : 'Draft'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>#{item.order}</span>
          {/* i18n coverage dots */}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#f0fdf4', color: 'var(--success)' }}>EN</span>
          {hasRw && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#f0fdf4', color: 'var(--success)' }}>RW</span>}
          {hasFr && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#f0fdf4', color: 'var(--success)' }}>FR</span>}
          {!hasRw && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>RW</span>}
          {!hasFr && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>FR</span>}
        </div>
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
          {item.question}
        </p>
        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
          {item.answer}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onTogglePublish}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-sand)]"
          style={{ color: 'var(--text-muted)' }}
          title={item.is_published ? 'Unpublish' : 'Publish'}
        >
          {item.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-sand)]"
          style={{ color: 'var(--text-muted)' }}
          title="Edit"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--high-bg)]"
          style={{ color: 'var(--text-muted)' }}
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AdminFAQPage() {
  const qc = useQueryClient();
  const { data: items, isLoading } = useAdminFaq();

  const [creating,   setCreating]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const allItems = items ?? [];
  const sorted = [...allItems].sort((a, b) => a.order - b.order);

  const refresh = () => qc.invalidateQueries({ queryKey: QK.adminFaq });

  const handleCreate = async (payload: FAQPayload) => {
    await createFaqItem(payload);
    await refresh();
    setCreating(false);
  };

  const handleUpdate = async (id: string, payload: FAQPayload) => {
    await updateFaqItem(id, payload);
    await refresh();
    setEditingId(null);
  };

  const handleTogglePublish = async (item: FAQItem) => {
    await updateFaqItem(item.id, { is_published: !item.is_published });
    await refresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFaqItem(id);
      await refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            FAQ Management
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isLoading
              ? '—'
              : `${allItems.length} item${allItems.length !== 1 ? 's' : ''} · ${allItems.filter((i) => i.is_published).length} published`}
          </p>
        </div>
        {!creating && (
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={15} className="mr-1.5" />
            New item
          </Button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <FAQEditor
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div
          className="rounded-2xl border px-6 py-12 text-center"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>No FAQ items yet</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Click &ldquo;New item&rdquo; to add your first question.
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          {sorted.map((item) =>
            editingId === item.id ? (
              <div key={item.id} className="border-b last:border-b-0 p-4" style={{ borderColor: 'var(--border)' }}>
                <FAQEditor
                  initial={item}
                  onSave={(payload) => handleUpdate(item.id, payload)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <FAQRow
                key={item.id}
                item={item}
                onEdit={() => setEditingId(item.id)}
                onDelete={() => deletingId !== item.id && handleDelete(item.id)}
                onTogglePublish={() => handleTogglePublish(item)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
