'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Syringe } from 'lucide-react';

/**
 * /nurse/vaccines — redirects to the clinic session page.
 * The sidebar links to both this route and /nurse/vaccines/session;
 * this page is just a passthrough to avoid a 404.
 */
export default function NurseVaccinesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/nurse/vaccines/session');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Syringe size={32} style={{ color: 'var(--text-muted)' }} />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Redirecting to clinic session…
      </p>
    </div>
  );
}
