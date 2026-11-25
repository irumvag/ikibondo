import type { Metadata } from 'next';
import Link from 'next/link';
import { HowItWorks } from '@/components/public/HowItWorks';
import { RoleHighlights } from '@/components/public/RoleHighlights';
import { FAQSection } from '@/components/public/FAQSection';

export const metadata: Metadata = {
  title: 'About — Ikibondo',
  description:
    "Why Ikibondo exists and how it helps health workers in Rwanda's refugee camps find malnourished children early.",
};

const PRINCIPLES = [
  {
    title: 'The nurse decides',
    body: 'A risk score is a prompt to look closer, never a diagnosis. Every score lists the measurements behind it so a clinician can check the reasoning and overrule it.',
  },
  {
    title: 'Works where the network doesn’t',
    body: 'Health workers keep recording visits with no connection. Records are sent when the phone is back online, and nothing is lost in between.',
  },
  {
    title: 'Families stay in control',
    body: 'Parents give consent before records are kept, see their own child’s growth in plain language, and can ask for a visit at any time.',
  },
] as const;

export default function AboutPage() {
  return (
    <main>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-20">
        <h1 className="text-[2.5rem] leading-[1.05] sm:text-[3.25rem] font-extrabold text-balance mb-6 max-w-3xl"
            style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>
          Paper growth cards get lost. Children shouldn&apos;t.
        </h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 max-w-5xl text-lg leading-relaxed"
             style={{ color: 'var(--text)' }}>
          <p>
            In a busy camp, a child&apos;s weight might be written on a card at one visit and on a
            different card at the next. When the records are scattered, a child who is slowly
            falling behind can go unnoticed until they are seriously ill.
          </p>
          <p>
            Ikibondo keeps one record per child that every health worker, nurse and supervisor
            in the camp can see. Each new measurement is checked against WHO growth standards
            the moment it is saved, so the children who need help are visible the same day.
          </p>
        </div>
      </section>

      <section className="border-y py-16 sm:py-20" style={{ background: 'var(--bg-elev)', borderColor: 'var(--rule)' }}
               aria-labelledby="principles-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="principles-heading" className="text-3xl sm:text-4xl font-extrabold text-balance mb-12"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            What we hold to
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {PRINCIPLES.map(({ title, body }) => (
              <div key={title}>
                <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--ink)' }}>{title}</h3>
                <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />
      <RoleHighlights />

      <section className="border-t py-16" style={{ borderColor: 'var(--rule)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <p className="text-lg max-w-xl" style={{ color: 'var(--text)' }}>
            Health worker accounts are created by your camp supervisor. Parents can register and
            are approved by a nurse at their camp.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login"
                  className="inline-flex items-center h-12 px-7 rounded-[var(--radius-md)] font-bold transition-colors bg-[var(--ink)] hover:bg-[var(--ink-soft)]"
                  style={{ color: 'var(--bg)' }}>
              Sign in
            </Link>
            <Link href="/register"
                  className="inline-flex items-center h-12 px-6 rounded-[var(--radius-md)] font-bold border-2 transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}>
              Register as a parent
            </Link>
          </div>
        </div>
      </section>

      <FAQSection />
    </main>
  );
}
