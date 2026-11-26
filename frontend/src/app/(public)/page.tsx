import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { HeroSection } from '@/components/public/HeroSection';
import { MuacExplainer } from '@/components/public/MuacExplainer';
import { HowItWorks } from '@/components/public/HowItWorks';
import { RoleHighlights } from '@/components/public/RoleHighlights';
import { CampsSection } from '@/components/public/CampsSection';
import { FAQSection } from '@/components/public/FAQSection';
import { fetchSiteContent, resolveSection, type Lang } from '@/lib/siteContent';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return { title: t('homeTitle'), description: t('homeDescription') };
}

export default async function HomePage() {
  const stored = await fetchSiteContent();
  const lang = (await getLocale()) as Lang;
  return (
    <>
      <HeroSection content={resolveSection(stored, 'home.hero', lang)} />
      <MuacExplainer content={resolveSection(stored, 'home.muac', lang)} />
      <HowItWorks content={resolveSection(stored, 'home.how_it_works', lang)} />
      <RoleHighlights content={resolveSection(stored, 'home.roles', lang)} />
      <CampsSection />
      <FAQSection />
    </>
  );
}
