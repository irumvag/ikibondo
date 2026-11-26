import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { HowItWorks } from '@/components/public/HowItWorks';
import { RoleHighlights } from '@/components/public/RoleHighlights';
import { FAQSection } from '@/components/public/FAQSection';
import { ContactSection } from '@/components/public/ContactSection';
import { fetchSiteContent, resolveSection, type Lang } from '@/lib/siteContent';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return { title: t('aboutTitle'), description: t('aboutDescription') };
}

export default async function AboutPage() {
  const stored = await fetchSiteContent();
  const lang = (await getLocale()) as Lang;
  const t = await getTranslations();
  const about = resolveSection(stored, 'about', lang);
  return (
    <main>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-20">
        <h1 className="text-[2.5rem] leading-[1.05] sm:text-[3.25rem] font-extrabold text-balance mb-6 max-w-3xl"
            style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>
          {about.title}
        </h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 max-w-5xl text-lg leading-relaxed"
             style={{ color: 'var(--text)' }}>
          <p>{about.intro_1}</p>
          <p>{about.intro_2}</p>
        </div>
      </section>

      <section className="border-y py-16 sm:py-20" style={{ background: 'var(--bg-elev)', borderColor: 'var(--rule)' }}
               aria-labelledby="principles-heading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="principles-heading" className="text-3xl sm:text-4xl font-extrabold text-balance mb-12"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {about.principles_title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {about.principles.map(({ title, body }, i) => (
              <div key={`${i}-${title}`}>
                <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--ink)' }}>{title}</h3>
                <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks content={resolveSection(stored, 'home.how_it_works', lang)} />
      <RoleHighlights content={resolveSection(stored, 'home.roles', lang)} />

      <section className="border-t py-16" style={{ borderColor: 'var(--rule)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <p className="text-lg max-w-xl" style={{ color: 'var(--text)' }}>{about.closing}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login"
                  className="inline-flex items-center h-12 px-7 rounded-[var(--radius-md)] font-bold transition-colors bg-[var(--ink)] hover:bg-[var(--ink-soft)]"
                  style={{ color: 'var(--bg)' }}>
              {t('nav.signIn')}
            </Link>
            <Link href="/register"
                  className="inline-flex items-center h-12 px-6 rounded-[var(--radius-md)] font-bold border-2 transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}>
              {t('public.registerAsParent')}
            </Link>
          </div>
        </div>
      </section>

      <ContactSection content={resolveSection(stored, 'contact', lang)} />
      <FAQSection />
    </main>
  );
}
