import { PublicNav } from '@/components/layout/PublicNav';
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner';
import { getLocale, getTranslations } from 'next-intl/server';
import { fetchSiteContent, resolveSection, type Lang } from '@/lib/siteContent';
import { Logo } from '@/components/ui/Logo';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const footer = resolveSection(await fetchSiteContent(), 'footer', (await getLocale()) as Lang);
  const t = await getTranslations('footer');
  return (
    <>
      <AnnouncementBanner where="public" />
      <PublicNav />
      {children}
      <footer className="border-t py-10" style={{ borderColor: 'var(--rule)', backgroundColor: 'var(--bg-elev)' }}>
        <div
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:justify-between gap-2 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <p>
            <span className="inline-flex align-middle mr-1"><Logo size={22} /></span>
            {' '}{footer.tagline}
          </p>
          <p>{t('copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </>
  );
}
