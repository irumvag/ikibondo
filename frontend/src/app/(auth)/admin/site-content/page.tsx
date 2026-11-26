'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { getSiteContent, resetSiteSection, saveSiteSection } from '@/lib/api/content';
import {
  DEFAULTS, SECTIONS, resolveSection,
  type FieldDef, type Lang, type SectionKey, type StoredContent,
} from '@/lib/siteContent';
import { HeroSection } from '@/components/public/HeroSection';
import { HowItWorks } from '@/components/public/HowItWorks';
import { RoleHighlights } from '@/components/public/RoleHighlights';
import { MuacExplainer } from '@/components/public/MuacExplainer';
import { ContactSection } from '@/components/public/ContactSection';

type Values = Record<string, unknown>;
const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Kinyarwanda' },
];

const inputStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' };

export default function SiteContentPage() {
  const { data: stored, isLoading } = useQuery({ queryKey: ['site-content'], queryFn: getSiteContent });
  const [open, setOpen] = useState<SectionKey | null>(null);

  if (open) {
    return <SectionEditor key={open} sectionKey={open} stored={stored ?? {}} onBack={() => setOpen(null)} />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Site content</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Text on the public website. Sections you have not edited show the built-in text.
          The FAQ is edited on its own page; camp descriptions under Camps.
        </p>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <ul className="flex flex-col gap-2 stagger">
          {SECTIONS.map((sec) => {
            const row = stored?.[sec.key];
            return (
              <li key={sec.key}>
                <button type="button" onClick={() => setOpen(sec.key)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{sec.label}</span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {row
                        ? `Edited${row.updated_by_name ? ` by ${row.updated_by_name}` : ''}${row.updated_at ? ` · ${new Date(row.updated_at).toLocaleDateString()}` : ''}`
                        : 'Built-in text'}
                    </span>
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Edit</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SectionEditor({ sectionKey, stored, onBack }: { sectionKey: SectionKey; stored: StoredContent; onBack: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const section = SECTIONS.find((s) => s.key === sectionKey)!;
  const row = stored[sectionKey];
  const [lang, setLang] = useState<Lang>('en');
  // English starts from what visitors see now; other languages start empty (= fall back to English)
  const [values, setValues] = useState<Record<Lang, Values>>(() => ({
    en: resolveSection(stored, sectionKey, 'en') as unknown as Values,
    fr: { ...(row?.content_fr ?? {}) },
    rw: { ...(row?.content_rw ?? {}) },
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const current = values[lang];
  const setField = (name: string, value: unknown) =>
    setValues((v) => ({ ...v, [lang]: { ...v[lang], [name]: value } }));

  const preview = useMemo(() => {
    const draft: StoredContent = {
      [sectionKey]: { key: sectionKey, content_en: values.en, content_fr: values.fr, content_rw: values.rw },
    };
    return resolveSection(draft, sectionKey, lang);
  }, [values, lang, sectionKey]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveSiteSection(sectionKey, { content_en: values.en, content_fr: values.fr, content_rw: values.rw });
      await qc.invalidateQueries({ queryKey: ['site-content'] });
      toast.success('Saved. The public site shows it within a minute.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Could not save. Check the text and try again.');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Go back to the built-in text for this section, in every language?')) return;
    try {
      await resetSiteSection(sectionKey);
      await qc.invalidateQueries({ queryKey: ['site-content'] });
      toast.success('Back to the built-in text');
      onBack();
    } catch {
      toast.error('Could not reset this section.');
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={14} aria-hidden="true" /> All sections
          </button>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{section.label}</h2>
        </div>
        <div className="flex gap-2">
          {section.page && (
            <Link href={section.page} target="_blank" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}>
              <ExternalLink size={14} aria-hidden="true" /> View page
            </Link>
          )}
          {row && (
            <Button variant="secondary" size="sm" onClick={reset}>
              <RotateCcw size={14} className="mr-1.5" aria-hidden="true" /> Built-in text
            </Button>
          )}
          <Button variant="primary" size="sm" loading={saving} onClick={save}>Save</Button>
        </div>
      </div>

      <div role="tablist" aria-label="Language" className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--bg-sand)' }}>
        {LANGS.map((l) => (
          <button key={l.code} role="tab" aria-selected={lang === l.code} type="button" onClick={() => setLang(l.code)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            style={lang === l.code ? { backgroundColor: 'var(--bg-elev)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}>
            {l.label}
          </button>
        ))}
      </div>
      {lang !== 'en' && (
        <p className="text-xs -mt-3" style={{ color: 'var(--text-muted)' }}>
          Empty fields use the English text. Translations of health guidance should be written or checked by a native speaker.
        </p>
      )}

      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6 items-start">
        <div className="flex flex-col gap-4 rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          {section.fields.map((f) => (
            <FieldInput key={f.name} field={f} value={current[f.name]}
              placeholder={lang === 'en' ? undefined : (values.en[f.name] as string | undefined)}
              onChange={(v) => setField(f.name, v)} />
          ))}
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <p className="px-4 py-2 text-xs font-semibold border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
            Preview
          </p>
          {/* Shown at about 60% so a full-width section fits the panel */}
          <div className="pointer-events-none" aria-hidden="true" style={{ zoom: 0.6 }}>
            <Preview sectionKey={sectionKey} content={preview} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Preview({ sectionKey, content }: { sectionKey: SectionKey; content: unknown }) {
  switch (sectionKey) {
    case 'home.hero': return <HeroSection content={content as typeof DEFAULTS['home.hero']} />;
    case 'home.how_it_works': return <HowItWorks content={content as typeof DEFAULTS['home.how_it_works']} />;
    case 'home.roles': return <RoleHighlights content={content as typeof DEFAULTS['home.roles']} />;
    case 'home.muac': return <MuacExplainer content={content as typeof DEFAULTS['home.muac']} />;
    case 'contact': return <ContactSection content={content as typeof DEFAULTS['contact']} />;
    case 'footer': {
      const c = content as typeof DEFAULTS['footer'];
      return (
        <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span className="font-extrabold" style={{ color: 'var(--ink)' }}>Ikibondo</span> {c.tagline}
        </p>
      );
    }
    case 'app.parent_home':
    case 'app.certificate':
    case 'app.feeding':
    case 'app.baby_care': {
      const c = content as typeof DEFAULTS['app.certificate'];
      // Rough phone preview of how the app shows this card
      return (
        <div className="p-6 flex justify-center" style={{ backgroundColor: 'var(--bg)' }}>
          <div className="w-72 rounded-2xl border p-4 flex flex-col gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Mobile app</p>
            <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{c.title}</h3>
            <p className="text-sm" style={{ color: 'var(--text)' }}>{c.body}</p>
            {(c.steps ?? []).map((st, i) => (
              <p key={i} className="text-sm" style={{ color: 'var(--text)' }}>
                <span className="font-semibold">{i + 1}. {st.title}</span> — {st.description}
              </p>
            ))}
          </div>
        </div>
      );
    }
    case 'about': {
      const c = content as typeof DEFAULTS['about'];
      return (
        <div className="p-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--bg)' }}>
          <h1 className="text-3xl font-extrabold" style={{ color: 'var(--ink)' }}>{c.title}</h1>
          <p style={{ color: 'var(--text)' }}>{c.intro_1}</p>
          <p style={{ color: 'var(--text)' }}>{c.intro_2}</p>
          <h2 className="text-xl font-extrabold mt-2" style={{ color: 'var(--ink)' }}>{c.principles_title}</h2>
          {c.principles.map((p, i) => (
            <div key={i}>
              <h3 className="font-bold" style={{ color: 'var(--ink)' }}>{p.title}</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{p.body}</p>
            </div>
          ))}
          <p style={{ color: 'var(--text)' }}>{c.closing}</p>
        </div>
      );
    }
  }
}

function TextInput({ kind, label, hint, value, placeholder, onChange }: {
  kind: 'text' | 'textarea'; label: string; hint?: string; value: string; placeholder?: string; onChange: (v: string) => void;
}) {
  const common = {
    value, placeholder, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    className: 'text-sm px-3 py-2 rounded-lg border outline-none w-full', style: inputStyle,
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
      {kind === 'textarea' ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
      {hint && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</span>}
    </label>
  );
}

function FieldInput({ field, value, placeholder, onChange }: {
  field: FieldDef; value: unknown; placeholder?: string; onChange: (v: unknown) => void;
}) {
  if (field.kind !== 'list') {
    return <TextInput kind={field.kind} label={field.label} hint={field.hint}
      value={(value as string) ?? ''} placeholder={placeholder} onChange={onChange} />;
  }
  const items = (Array.isArray(value) ? value : []) as Values[];
  const update = (i: number, name: string, v: string) =>
    onChange(items.map((it, k) => (k === i ? { ...it, [name]: v } : it)));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>{field.label}</legend>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{field.itemLabel} {i + 1}</span>
            <button type="button" aria-label={`Remove ${field.itemLabel.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(items.filter((_, k) => k !== i))}>
              <Trash2 size={14} style={{ color: 'var(--danger)' }} />
            </button>
          </div>
          {field.fields.map((sub) => (
            <TextInput key={sub.name} kind={sub.kind} label={sub.label} hint={sub.hint}
              value={(it[sub.name] as string) ?? ''} onChange={(v) => update(i, sub.name, v)} />
          ))}
        </div>
      ))}
      {items.length < 12 && (
        <button type="button" onClick={() => onChange([...items, Object.fromEntries(field.fields.map((s) => [s.name, '']))])}
          className="flex items-center gap-1.5 text-sm font-semibold w-fit" style={{ color: 'var(--ink)' }}>
          <Plus size={14} aria-hidden="true" /> Add {field.itemLabel.toLowerCase()}
        </button>
      )}
      {placeholder !== undefined && items.length === 0 && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Empty lists use the English items.</span>
      )}
    </fieldset>
  );
}
