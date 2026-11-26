'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import {
  createAnnouncement, deleteAnnouncement, listAnnouncements, updateAnnouncement,
  type Announcement, type AnnouncementInput,
} from '@/lib/api/content';

const EMPTY: AnnouncementInput = {
  message_en: '', message_fr: '', message_rw: '', link_url: '', level: 'INFO',
  show_public: true, show_dashboard: true, starts_at: null, ends_at: null, is_active: true,
};

const inputStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' };

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time
const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

// State of an announcement; its name is messages/en.json admin.announcements.state.<label>
function status(a: Announcement): { label: 'off' | 'scheduled' | 'ended' | 'showing'; variant: 'success' | 'warn' | 'default' } {
  const now = Date.now();
  if (!a.is_active) return { label: 'off', variant: 'default' };
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return { label: 'scheduled', variant: 'warn' };
  if (a.ends_at && new Date(a.ends_at).getTime() <= now) return { label: 'ended', variant: 'default' };
  return { label: 'showing', variant: 'success' };
}

export default function AnnouncementsPage() {
  const t = useTranslations('admin.announcements');
  const qc = useQueryClient();
  const toast = useToast();
  const { data = [], isLoading } = useQuery({ queryKey: ['announcements', 'all'], queryFn: listAnnouncements });
  const [editing, setEditing] = useState<{ id: string | null; form: AnnouncementInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['announcements'] });

  const save = async () => {
    if (!editing) return;
    if (!editing.form.message_en.trim()) { setError(t('writeTheMessageIn')); return; }
    setSaving(true); setError('');
    try {
      if (editing.id) await updateAnnouncement(editing.id, editing.form);
      else await createAnnouncement(editing.form);
      await refresh();
      toast.success(editing.id ? t('announcementUpdated') : t('announcementPublished'));
      setEditing(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('couldNotSaveThe'));
    } finally { setSaving(false); }
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm(t('deleteThisAnnouncement'))) return;
    setRemoving(a.id);
    // Let the row animate out before the list refreshes
    setTimeout(async () => {
      try {
        await deleteAnnouncement(a.id);
        await refresh();
        toast.success(t('announcementDeleted'));
      } catch {
        toast.error(t('couldNotDeleteThe'));
      } finally { setRemoving(null); }
    }, 260);
  };

  const set = (patch: Partial<AnnouncementInput>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{t('announcements')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('shortMessagesShownAs')}</p>
        </div>
        <Button variant="primary" onClick={() => { setError(''); setEditing({ id: null, form: EMPTY }); }}>
          <Plus size={15} className="mr-1.5" aria-hidden="true" />{' '}{t('newAnnouncement')}</Button>
      </div>

      {editing && (
        <div className="rounded-2xl border p-5 flex flex-col gap-4 animate-pop" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('messageEnglish')}</span>
            <textarea rows={2} maxLength={280} value={editing.form.message_en} onChange={(e) => set({ message_en: e.target.value })}
              className="text-sm px-3 py-2 rounded-lg border outline-none" style={inputStyle}
              placeholder={t('eGVaccinationDay')} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('franAisOptional')}</span>
              <textarea rows={2} maxLength={280} value={editing.form.message_fr} onChange={(e) => set({ message_fr: e.target.value })}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('kinyarwandaOptional')}</span>
              <textarea rows={2} maxLength={280} value={editing.form.message_rw} onChange={(e) => set({ message_rw: e.target.value })}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={inputStyle} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('linkOptional')}</span>
              <input value={editing.form.link_url} onChange={(e) => set({ link_url: e.target.value })}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={inputStyle} placeholder="/about or https://…" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('style')}</span>
              <select value={editing.form.level} onChange={(e) => set({ level: e.target.value as AnnouncementInput['level'] })}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={inputStyle}>
                <option value="INFO">{t('information')}</option>
                <option value="WARNING">{t('important')}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('startsOptional')}</span>
              <input type="datetime-local" value={toLocal(editing.form.starts_at)} onChange={(e) => set({ starts_at: fromLocal(e.target.value) })}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('endsOptional')}</span>
              <input type="datetime-local" value={toLocal(editing.form.ends_at)} onChange={(e) => set({ ends_at: fromLocal(e.target.value) })}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={inputStyle} />
            </label>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" style={{ color: 'var(--ink)' }}>
            {([['show_public', 'Public website'], ['show_dashboard', 'Dashboards'], ['is_active', 'Switched on']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4" checked={editing.form[k]} onChange={(e) => set({ [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-2">
            <Button variant="primary" loading={saving} onClick={save}>{editing.id ? t('save') : t('publish')}</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>{t('cancel')}</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <Megaphone size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noAnnouncementsYet')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 stagger">
          {data.map((a) => {
            const s = status(a);
            return (
              <li key={a.id} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${removing === a.id ? 'animate-item-out' : ''}`}
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{a.message_en}</p>
                  <p className="text-xs mt-1 flex flex-wrap gap-x-2" style={{ color: 'var(--text-muted)' }}>
                    <span>{[a.show_public && 'Public site', a.show_dashboard && 'Dashboards'].filter(Boolean).join(' + ') || t('nowhere')}</span>
                    {a.ends_at && <span>{t('until', { value: new Date(a.ends_at).toLocaleString() })}</span>}
                  </p>
                </div>
                <Badge variant={s.variant}>{t(`state.${s.label}`)}</Badge>
                <button type="button" aria-label={t('editAnnouncement')}
                  onClick={() => { setError(''); const { id, created_at, ...form } = a; void created_at; setEditing({ id, form }); }}>
                  <Pencil size={15} style={{ color: 'var(--text-muted)' }} />
                </button>
                <button type="button" aria-label={t('deleteAnnouncement')} onClick={() => remove(a)}>
                  <Trash2 size={15} style={{ color: 'var(--danger)' }} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
