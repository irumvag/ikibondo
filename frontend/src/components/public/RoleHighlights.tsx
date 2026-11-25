import { DEFAULTS, type SiteContent } from '@/lib/siteContent';

export function RoleHighlights({ content = DEFAULTS['home.roles'] }: { content?: SiteContent['home.roles'] }) {
  return (
    <section className="py-20 sm:py-28 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
             aria-labelledby="roles-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 id="roles-heading" className="text-3xl sm:text-4xl font-extrabold text-balance mb-12 max-w-2xl"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {content.title}
        </h2>

        <dl className="border-t" style={{ borderColor: 'var(--rule)' }}>
          {content.roles.map(({ role, description, features }, i) => (
            <div key={`${i}-${role}`}
                 className="grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)_16rem] gap-3 md:gap-8 py-7 border-b"
                 style={{ borderColor: 'var(--rule)' }}>
              <dt className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{role}</dt>
              <dd className="text-base leading-relaxed max-w-prose" style={{ color: 'var(--text)' }}>{description}</dd>
              <dd>
                <ul className="flex flex-col gap-1 text-sm" style={{ color: 'var(--text-muted)' }}
                    aria-label={`Features for ${role.toLowerCase()}`}>
                  {features.split(';').map((f) => f.trim()).filter(Boolean).map((f) => <li key={f}>{f}</li>)}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
