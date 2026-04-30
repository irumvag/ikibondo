import type { Metadata } from 'next';
import { HeroSection } from '@/components/public/HeroSection';
import { StatsSection } from '@/components/public/StatsSection';
import { CampsSection } from '@/components/public/CampsSection';

export const metadata: Metadata = {
  title: 'Ikibondo — Child Health Platform',
  description:
    'Child nutrition and health monitoring for displacement camps in Rwanda.',
};

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <StatsSection />
      <CampsSection />
    </>
  );
}
