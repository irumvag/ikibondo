'use client';

import { Users, Activity, Bell } from 'lucide-react';
import { useIntersection } from '@/hooks/useIntersection';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const STEPS = [
  {
    number: '01',
    icon: Users,
    title: 'Community health worker visits',
    description:
      'CHWs visit children in their assigned zones and record weight, height, MUAC, vital signs, and symptoms using the Ikibondo field app — fully offline, with large touch targets designed for field use.',
    colorBg: 'var(--low-bg)',
    colorIcon: 'var(--success)',
  },
  {
    number: '02',
    icon: Activity,
    title: 'Automated ML risk assessment',
    description:
      'Every visit triggers a WHO-calibrated Random Forest model that classifies the child as LOW, MEDIUM, or HIGH risk. The top five contributing factors are surfaced in plain language so clinicians can verify and understand each decision.',
    colorBg: 'var(--med-bg)',
    colorIcon: 'var(--warn)',
  },
  {
    number: '03',
    icon: Bell,
    title: 'Timely alerts & interventions',
    description:
      "Supervisors and nurses receive instant push and SMS alerts for high-risk children. Parents are notified about their child's status and upcoming vaccinations three days before each due date.",
    colorBg: 'var(--high-bg)',
    colorIcon: 'var(--danger)',
  },
] as const;

export function HowItWorks() {
  const { ref, visible } = useIntersection<HTMLElement>(0.12);
  const reduced = useReducedMotion();

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative py-20 sm:py-28 overflow-hidden"
      style={{ background: 'var(--bg-sand)' }}
      aria-labelledby="how-it-works-heading"
    >
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(var(--border) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
          opacity: 0.5,
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div
          className="text-center mb-16"
          style={{
            opacity: visible || reduced ? 1 : 0,
            transform: visible || reduced ? 'none' : 'translateY(20px)',
            transition: reduced ? 'none' : 'opacity 0.55s ease, transform 0.55s ease',
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5"
            style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--ink)', border: '1px solid var(--border)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--accent)' }} aria-hidden="true" />
            How it works
          </div>
          <h2
            id="how-it-works-heading"
            className="text-3xl sm:text-4xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            From visit to intervention in minutes
          </h2>
          <p className="text-base sm:text-lg mx-auto max-w-xl" style={{ color: 'var(--text-muted)' }}>
            Ikibondo closes the loop between frontline field visits and clinical
            decision-making — so no child in the camp is missed.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Connecting line (desktop only) */}
          <div
            className="hidden lg:block absolute top-[3.25rem] left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px pointer-events-none"
            style={{ background: 'linear-gradient(to right, var(--border) 60%, transparent)', opacity: 0.7 }}
            aria-hidden="true"
          />

          {STEPS.map(({ number, icon: Icon, title, description, colorBg, colorIcon }, i) => (
            <div
              key={number}
              className="relative flex flex-col gap-4 p-7 rounded-2xl"
              style={{
                backgroundColor: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                opacity: visible || reduced ? 1 : 0,
                transform: visible || reduced ? 'none' : 'translateY(28px)',
                transition: reduced
                  ? 'none'
                  : `opacity 0.5s ease ${i * 0.12}s, transform 0.5s ease ${i * 0.12}s`,
              }}
            >
              {/* Step number badge */}
              <div className="flex items-start justify-between">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: colorBg }}
                >
                  <Icon size={24} style={{ color: colorIcon }} aria-hidden="true" />
                </div>
                <span
                  className="text-4xl font-bold leading-none select-none"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--border)' }}
                  aria-hidden="true"
                >
                  {number}
                </span>
              </div>

              <div>
                <h3
                  className="text-base font-semibold mb-2"
                  style={{ color: 'var(--ink)' }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
