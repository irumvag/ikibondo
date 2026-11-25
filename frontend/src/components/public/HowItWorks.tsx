import { DEFAULTS, type SiteContent } from '@/lib/siteContent';

// The steps really are a sequence (visit → assessment → action), so they are numbered.
export function HowItWorks({ content = DEFAULTS['home.how_it_works'] }: { content?: SiteContent['home.how_it_works'] }) {
  return (
    <section id="how-it-works" className="py-20 sm:py-28" style={{ background: 'var(--bg)' }}
             aria-labelledby="how-it-works-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl font-extrabold text-balance mb-4 max-w-2xl"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {content.title}
        </h2>
        <p className="text-base sm:text-lg mb-14 max-w-2xl" style={{ color: 'var(--text-muted)' }}>
          {content.subtitle}
        </p>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {content.steps.map(({ title, description }, i) => (
            <li key={`${i}-${title}`} className="relative pt-6 border-t-2" style={{ borderColor: 'var(--ink)' }}>
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
