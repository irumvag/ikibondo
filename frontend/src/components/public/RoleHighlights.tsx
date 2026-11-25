const ROLES = [
  {
    role: 'Community health workers',
    description:
      'Register visits, record measurements and look a child up by scanning their QR card. Works offline in the field.',
    features: ['Offline visit queue', 'QR child lookup', 'Risk result after every visit'],
  },
  {
    role: 'Nurses',
    description:
      'Review records, add clinical notes, run vaccination sessions and see why the model scored a child the way it did.',
    features: ['Top factors behind each score', 'Clinical notes', 'WHO growth charts'],
  },
  {
    role: 'Supervisors',
    description:
      'Follow CHW activity across zones, respond to high-risk alerts and prepare reports for camp leadership.',
    features: ['CHW activity', 'High-risk alerts', 'Exportable reports'],
  },
  {
    role: 'Parents and guardians',
    description:
      "See your child's growth and vaccination card, get SMS reminders and request a visit from your health worker.",
    features: ['Growth in plain language', 'Vaccination card', 'SMS reminders'],
  },
] as const;

export function RoleHighlights() {
  return (
    <section className="py-20 sm:py-28 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
             aria-labelledby="roles-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 id="roles-heading" className="text-3xl sm:text-4xl font-extrabold text-balance mb-12 max-w-2xl"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          What each person sees when they sign in
        </h2>

        <dl className="border-t" style={{ borderColor: 'var(--rule)' }}>
          {ROLES.map(({ role, description, features }) => (
            <div key={role}
                 className="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)_16rem] gap-3 md:gap-8 py-7 border-b"
                 style={{ borderColor: 'var(--rule)' }}>
              <dt className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{role}</dt>
              <dd className="text-base leading-relaxed max-w-prose" style={{ color: 'var(--text)' }}>{description}</dd>
              <dd>
                <ul className="flex flex-col gap-1 text-sm" style={{ color: 'var(--text-muted)' }}
                    aria-label={`Features for ${role.toLowerCase()}`}>
                  {features.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
