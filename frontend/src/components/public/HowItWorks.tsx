// The three steps really are a sequence (visit → assessment → action), so they are numbered.
const STEPS = [
  {
    title: 'A health worker measures the child',
    description:
      'CHWs visit families in their zone and record weight, height, MUAC, oedema and symptoms on their phone. Visits are saved even without a connection and sync when the network returns.',
  },
  {
    title: 'Ikibondo checks the measurements',
    description:
      'Each visit is compared with WHO growth standards and scored LOW, MEDIUM or HIGH risk. The factors behind each score are listed in plain language so a nurse can check the reasoning.',
  },
  {
    title: 'The right person is told',
    description:
      'Nurses and supervisors are alerted about high-risk children the same day. Parents get reminders three days before each vaccine is due.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28" style={{ background: 'var(--bg)' }}
             aria-labelledby="how-it-works-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl font-extrabold text-balance mb-4 max-w-2xl"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          From a home visit to a referral
        </h2>
        <p className="text-base sm:text-lg mb-14 max-w-2xl" style={{ color: 'var(--text-muted)' }}>
          Every measurement a health worker takes reaches the people who can act on it.
        </p>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {STEPS.map(({ title, description }, i) => (
            <li key={title} className="relative pt-6 border-t-2" style={{ borderColor: 'var(--ink)' }}>
              <span className="block text-5xl font-extrabold tabular-nums leading-none mb-5"
                    style={{ color: 'var(--accent)' }} aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--ink)' }}>{title}</h3>
              <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
