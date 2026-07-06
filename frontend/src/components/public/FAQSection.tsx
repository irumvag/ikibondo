'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ_DATA } from '@/data/faq';
import type { FAQItem } from '@/lib/api/public';
import { useFaq } from '@/lib/api/queries';
import { useIntersection } from '@/hooks/useIntersection';
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
    <div className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
        id={`faq-btn-${item.id}`}
      >
        <span className="text-sm sm:text-base font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
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
          <p className="pb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
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
  const hasRw = items.some((i) => i.question_rw?.trim());
  const hasFr = items.some((i) => i.question_fr?.trim());
  if (!hasRw && !hasFr) return null;

  return (
    <div
      className="flex gap-1 p-1 rounded-xl self-center"
      style={{ backgroundColor: 'var(--bg-sand)', border: '1px solid var(--border)' }}
      role="group"
      aria-label="Language"
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
  const { data: apiItems, isLoading } = useFaq();
  const [lang, setLang] = useState<Lang>('en');

  const source = apiItems && apiItems.length > 0 ? apiItems : FAQ_DATA;
  const published = source
    .filter((i) => i.is_published)
    .sort((a, b) => a.order - b.order);

  const [openId, setOpenId] = useState<string | null>(null);
  const { ref, visible } = useIntersection<HTMLElement>(0.08);
  const reduced = useReducedMotion();

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  const inner = isLoading ? (
    <FAQSkeleton />
  ) : (
    <div className="flex flex-col gap-4">
      <LangSwitcher lang={lang} onChange={setLang} items={published} />
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="px-6">
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
      ref={ref}
      className="py-20 sm:py-28"
      style={{ background: 'var(--bg)' }}
      aria-labelledby="faq-heading"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="text-center mb-12"
          style={{
            opacity: visible || reduced ? 1 : 0,
            transform: visible || reduced ? 'none' : 'translateY(20px)',
            transition: reduced ? 'none' : 'opacity 0.5s ease, transform 0.5s ease',
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5"
            style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)', border: '1px solid var(--border)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--accent)' }} aria-hidden="true" />
            FAQ
          </div>
          <h2
            id="faq-heading"
            className="text-3xl sm:text-4xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Frequently asked questions
          </h2>
          <p className="text-base" style={{ color: 'var(--text-muted)' }}>
            Can&apos;t find what you&apos;re looking for? Reach out to your camp supervisor.
          </p>
        </div>

        <div
          style={{
            opacity: visible || reduced ? 1 : 0,
            transform: visible || reduced ? 'none' : 'translateY(20px)',
            transition: reduced ? 'none' : 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
          }}
        >
          {inner}
        </div>
      </div>
    </section>
  );
}
