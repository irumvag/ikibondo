'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ_DATA, type FAQItem } from '@/data/faq';
import { useIntersection } from '@/hooks/useIntersection';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// ── Single accordion item ──────────────────────────────────────────────────────
function FAQRow({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  const reduced = useReducedMotion();

  return (
    <div
      className="border-b last:border-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
        id={`faq-btn-${item.id}`}
      >
        <span
          className="text-sm sm:text-base font-semibold leading-snug"
          style={{ color: 'var(--ink)' }}
        >
          {item.question}
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

      {/* Animated body */}
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
          <p
            className="pb-5 text-sm leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────────
interface FAQSectionProps {
  /** Override data — used by About page to pass the same FAQ_DATA for now;
   *  replaced by an API call in Phase 3 without changing this component. */
  items?: FAQItem[];
  /** Visual variant: 'standalone' (own padding + heading) or 'embedded' (no padding, no heading). */
  variant?: 'standalone' | 'embedded';
}

export function FAQSection({ items, variant = 'standalone' }: FAQSectionProps) {
  const published = (items ?? FAQ_DATA)
    .filter(i => i.is_published)
    .sort((a, b) => a.order - b.order);

  const [openId, setOpenId] = useState<string | null>(null);
  const { ref, visible } = useIntersection<HTMLElement>(0.08);
  const reduced = useReducedMotion();

  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id));

  const inner = (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="px-6">
        {published.map(item => (
          <FAQRow
            key={item.id}
            item={item}
            isOpen={openId === item.id}
            onToggle={() => toggle(item.id)}
          />
        ))}
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
