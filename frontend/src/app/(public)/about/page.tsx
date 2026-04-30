import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Activity, Users, BookOpen, ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'About' };

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Community Health Worker visits',
    body: 'CHWs visit children in their zones regularly, recording anthropometric measurements, vital signs, and clinical symptoms using the Ikibondo mobile app — even offline.',
    icon: Users,
  },
  {
    step: '02',
    title: 'ML-powered risk classification',
    body: 'Each visit triggers an automatic risk assessment using a WHO-calibrated Random Forest model. Children are classified LOW, MEDIUM, or HIGH risk, with the top contributing factors explained in plain language.',
    icon: Activity,
  },
  {
    step: '03',
    title: 'Timely interventions',
    body: "Supervisors and nurses receive instant alerts for high-risk children. Parents receive SMS notifications about their child's health status and upcoming vaccinations.",
    icon: BookOpen,
  },
];

const WHO_USES = [
  {
    role: 'Community Health Workers',
    description:
      'Register children, conduct visits, administer vaccines, and work from a mobile-first offline-ready interface with large touch targets.',
  },
  {
    role: 'Nurses & Clinicians',
    description:
      'Review detailed health records, add clinical notes, view SHAP explanations for model decisions, and generate growth charts with WHO reference bands.',
  },
  {
    role: 'Zone Supervisors',
    description:
      'Monitor CHW activity, view zone-level KPIs, manage high-risk alerts, and export reports for camp leadership.',
  },
  {
    role: 'Parents & Guardians',
    description:
      "Track your child's growth journey, receive vaccination reminders, and view health milestones in a calm, parent-friendly interface.",
  },
];

export default function AboutPage() {
  return (
    <main className="py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Hero */}
        <div className="text-center mb-20">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{
              backgroundColor: 'var(--bg-sand)',
              color: 'var(--ink)',
              border: '1px solid var(--border)',
            }}
          >
            <Shield size={12} aria-hidden="true" />
            About Ikibondo
          </div>
          <h1
            className="text-4xl sm:text-5xl font-bold mb-5 leading-tight"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Every child deserves a healthy start
          </h1>
          <p
            className="text-lg leading-relaxed mx-auto"
            style={{ color: 'var(--text-muted)', maxWidth: '38rem' }}
          >
            Ikibondo is a child nutrition and health monitoring platform built for
            UNHCR-supported refugee camps in Rwanda — combining community health
            worker workflows with machine learning to detect malnutrition early.
          </p>
        </div>

        {/* How it works */}
        <section className="mb-20" aria-labelledby="how-heading">
          <h2
            id="how-heading"
            className="text-2xl sm:text-3xl font-bold mb-10 text-center"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            How it works
          </h2>
          <div className="flex flex-col gap-4">
            {HOW_IT_WORKS.map(({ step, title, body, icon: Icon }) => (
              <div
                key={step}
                className="flex gap-5 p-6 rounded-2xl"
                style={{
                  backgroundColor: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                  style={{
                    backgroundColor: 'var(--bg-sand)',
                    color: 'var(--ink)',
                    fontFamily: 'var(--font-fraunces)',
                  }}
                  aria-hidden="true"
                >
                  {step}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon
                      size={18}
                      aria-hidden="true"
                      style={{ color: 'var(--ink)' }}
                    />
                    <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                      {title}
                    </h3>
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Who uses it */}
        <section className="mb-20" aria-labelledby="users-heading">
          <h2
            id="users-heading"
            className="text-2xl sm:text-3xl font-bold mb-10 text-center"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Who uses Ikibondo
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {WHO_USES.map(({ role, description }) => (
              <div
                key={role}
                className="p-5 rounded-2xl"
                style={{
                  backgroundColor: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <h3
                  className="font-semibold mb-2"
                  style={{
                    color: 'var(--ink)',
                    fontFamily: 'var(--font-fraunces)',
                  }}
                >
                  {role}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div
          className="text-center p-10 rounded-2xl"
          style={{
            backgroundColor: 'var(--bg-sand)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Ready to get started?
          </h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Contact your camp supervisor to receive access credentials, or
            register below to request access.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
              style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
            >
              Sign in
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-[var(--bg-elev)]"
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
            >
              Request access
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
