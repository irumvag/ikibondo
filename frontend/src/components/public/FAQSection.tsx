'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { FAQ_DATA } from '@/data/faq';
import type { FAQItem } from '@/lib/api/public';
import { useFaq } from '@/lib/api/queries';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Lang = 'en' | 'rw' | 'fr';
const LANG_LABELS: Record<Lang, string> = { en: 'EN', rw: 'RW', fr: 'FR' };

function getLocalised(item: FAQItem, lang: Lang): { question: string; answer: string } {
  if (lang === 'rw' && item.question_rw?.trim()) {
    return { question: item.question_rw, answer: item.answer_rw ?? item.answer };
  }
  if (lang === 'fr' && item.question_fr?.trim()) {
    return { question: item.question_fr, answer: item.answer_fr ?? item.answer };
  }
  return { question: item.question, answer: item.answer };
}

// ── Single accordion item ──────────────────────────────────────────────────────
function FAQRow({
  item,
  lang,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  lang: Lang;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const reduced = useReducedMotion();
  const { question, answer } = getLocalised(item, lang);

  return (
    <div className="border-b" style={{ borderColor: 'var(--rule)' }}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
        id={`faq-btn-${item.id}`}
      >
        <span className="text-base sm:text-lg font-bold leading-snug" style={{ color: 'var(--ink)' }}>
          {question}
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="shrink-0"
          style={{
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: reduced ? 'none' : 'transform 0.22s ease',
          }}
        />
      </button>

      <div
        id={`faq-answer-${item.id}`}
        role="region"
        aria-labelledby={`faq-btn-${item.id}`}
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: reduced ? 'none' : 'grid-template-rows 0.25s ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <p className="pb-6 text-base leading-relaxed max-w-prose" style={{ color: 'var(--text)' }}>
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

function FAQSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden px-6" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="py-5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
          <div className="h-4 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-sand)', width: `${55 + i * 7}%` }} />
        </div>
      ))}
    </div>
  );
}

// ── Language switcher ─────────────────────────────────────────────────────────
function LangSwitcher({
  lang,
  onChange,
  items,
}: {
  lang: Lang;
  onChange: (l: Lang) => void;
  items: FAQItem[];
}) {
  const t = useTranslations('faq');
  const hasRw = items.some((i) => i.question_rw?.trim());
  const hasFr = items.some((i) => i.question_fr?.trim());
  if (!hasRw && !hasFr) return null;

  return (
    <div
      className="flex gap-1 p-1 rounded-[var(--radius-md)] self-start"
      style={{ backgroundColor: 'var(--bg-sand)', border: '1px solid var(--border)' }}
      role="group"
      aria-label={t('language')}
    >
      {(['en', 'rw', 'fr'] as Lang[]).filter((l) => l === 'en' || (l === 'rw' && hasRw) || (l === 'fr' && hasFr)).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className="text-xs font-bold px-3 py-1 rounded-lg transition-colors"
          style={{
            backgroundColor: lang === l ? 'var(--bg-elev)' : 'transparent',
            color: lang === l ? 'var(--ink)' : 'var(--text-muted)',
          }}
          aria-pressed={lang === l}
        >
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────
interface FAQSectionProps {
  variant?: 'standalone' | 'embedded';
}

export function FAQSection({ variant = 'standalone' }: FAQSectionProps) {
  const t = useTranslations('faq');
  const { data: apiItems, isLoading } = useFaq();
  // Start in the visitor's language; questions without a translation stay in English.
  const [lang, setLang] = useState<Lang>(useLocale() as Lang);

  const source = apiItems && apiItems.length > 0 ? apiItems : FAQ_DATA;
  const published = source
    .filter((i) => i.is_published)
    .sort((a, b) => a.order - b.order);

  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  const inner = isLoading ? (
    <FAQSkeleton />
  ) : (
    <div className="flex flex-col gap-4">
      <LangSwitcher lang={lang} onChange={setLang} items={published} />
      <div className="border-t-2" style={{ borderColor: 'var(--ink)' }}>
        <div>
          {published.map((item) => (
            <FAQRow
              key={item.id}
              item={item}
              lang={lang}
              isOpen={openId === item.id}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (variant === 'embedded') return inner;

  return (
    <section
      id="faq"
      className="py-20 sm:py-28 border-t"
      style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
      aria-labelledby="faq-heading"
    >
      {/* Same left edge as every other section; the accordion keeps a readable measure */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
        <h2
          id="faq-heading"
          className="text-3xl sm:text-4xl font-extrabold text-balance mb-3"
          style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
        >
          {t('title')}
        </h2>
        <p className="text-base mb-10" style={{ color: 'var(--text-muted)' }}>
          {t('subtitle')}
        </p>
        {inner}
        </div>
      </div>
    </section>
  );
}
