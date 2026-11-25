import type { Metadata } from 'next';
import { HeroSection } from '@/components/public/HeroSection';
import { MuacExplainer } from '@/components/public/MuacExplainer';
import { HowItWorks } from '@/components/public/HowItWorks';
import { RoleHighlights } from '@/components/public/RoleHighlights';
import { CampsSection } from '@/components/public/CampsSection';
import { FAQSection } from '@/components/public/FAQSection';

export const metadata: Metadata = {
  title: 'Ikibondo — Child Health Platform',
  description:
    'Child nutrition and health monitoring for displacement camps in Rwanda. Empowering community health workers with ML-powered malnutrition risk assessment.',
};

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <MuacExplainer />
      <HowItWorks />
      <RoleHighlights />
      <CampsSection />
      <FAQSection />
    </>
  );
}
