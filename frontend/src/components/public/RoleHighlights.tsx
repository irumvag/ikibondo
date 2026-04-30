'use client';

import { Smartphone, Stethoscope, BarChart2, Heart } from 'lucide-react';
import { useIntersection } from '@/hooks/useIntersection';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const ROLES = [
  {
    icon: Smartphone,
    role: 'Community Health Workers',
    tagline: 'Offline-first field app',
    description:
      'Register children, conduct visits, record vitals, and administer vaccines — all from a mobile-first interface with large touch targets that works with no internet connection.',
    features: ['Offline sync queue', 'QR child lookup', 'Visit result with risk badge'],
    accent: 'var(--success)',
    accentBg: 'var(--low-bg)',
  },
  {
    icon: Stethoscope,
    role: 'Nurses & Clinicians',
    tagline: 'Clinical decision support',
    description:
      'Review detailed health records, add structured clinical notes, view SHAP explanations for every ML decision, and generate WHO growth charts with reference bands.',
    features: ['SHAP top-5 factors', 'Clinical notes thread', 'WHO growth charts'],
    accent: 'var(--warn)',
    accentBg: 'var(--med-bg)',
  },
  {
    icon: BarChart2,
    role: 'Zone Supervisors',
    tagline: 'Zone-level oversight',
    description:
      'Monitor CHW activity, view zone KPIs, track high-risk alerts, and export health reports for camp leadership — all scoped to your assigned zones.',
    features: ['CHW activity tracker', 'Risk alert dashboard', 'Exportable reports'],
    accent: 'var(--ink)',
    accentBg: 'var(--bg-sand)',
  },
  {
    icon: Heart,
    role: 'Parents & Guardians',
    tagline: 'Child health at a glance',
    description:
      "Track your child's growth journey, receive SMS vaccination reminders, and view health milestones in a calm, parent-friendly interface — no medical jargon.",
    features: ['Traffic-light growth chart', 'Vaccination card', 'SMS reminders'],
    accent: 'var(--danger)',
    accentBg: 'var(--high-bg)',
  },
] as const;

export function RoleHighlights() {
  const { ref, visible } = useIntersection<HTMLElement>(0.08);
  const reduced = useReducedMotion();

  return (
    <section
      ref={ref}
      className="relative py-20 sm:py-28"
      style={{ background: 'var(--bg)' }}
      aria-labelledby="roles-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div
          className="text-center mb-14"
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
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--success)' }} aria-hidden="true" />
            Built for everyone
          </div>
          <h2
            id="roles-heading"
            className="text-3xl sm:text-4xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            One platform, every role
          </h2>
          <p className="text-base sm:text-lg mx-auto max-w-xl" style={{ color: 'var(--text-muted)' }}>
            Ikibondo adapts to the needs of every person in the care chain —
            from the CHW in the field to the parent at home.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ROLES.map(({ icon: Icon, role, tagline, description, features, accent, accentBg }, i) => (
            <div
              key={role}
              className="group flex flex-col gap-4 p-6 rounded-2xl transition-shadow"
              style={{
                backgroundColor: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                opacity: visible || reduced ? 1 : 0,
                transform: visible || reduced ? 'none' : 'translateY(32px)',
                transition: reduced
                  ? 'none'
                  : `opacity 0.5s ease ${i * 0.09}s, transform 0.5s ease ${i * 0.09}s, box-shadow 0.2s ease`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: accentBg }}
              >
                <Icon size={22} style={{ color: accent }} aria-hidden="true" />
              </div>

              <div className="flex flex-col gap-1 flex-1">
                {/* Tagline */}
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: accent }}
                >
                  {tagline}
                </span>
                {/* Role */}
                <h3
                  className="text-base font-semibold leading-snug"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
                >
                  {role}
                </h3>
                {/* Description */}
                <p className="text-sm leading-relaxed mt-1" style={{ color: 'var(--text-muted)' }}>
                  {description}
                </p>
              </div>

              {/* Feature chips */}
              <ul className="flex flex-col gap-1.5 mt-auto" aria-label={`Key features for ${role}`}>
                {features.map(f => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: accent }}
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
