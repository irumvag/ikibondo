'use client';

import { usePublicCamps } from '@/lib/api/queries';
import { Skeleton } from '@/components/ui/Skeleton';

export function CampsSection() {
  const { data: camps = [], isLoading } = usePublicCamps();

  return (
    <section className="py-16 sm:py-24 border-t" style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--rule)' }}
             aria-labelledby="camps-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-10">
        <div>
          <h2 id="camps-heading" className="text-3xl sm:text-4xl font-extrabold text-balance mb-3"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Where Ikibondo is used
          </h2>
          <p className="text-base" style={{ color: 'var(--text-muted)' }}>
            Camps and settlements in Rwanda currently recording visits.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : camps.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>The camp list isn&apos;t available right now.</p>
        ) : (
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b-2" style={{ borderColor: 'var(--ink)' }}>
                <th scope="col" className="py-2 pr-4 text-sm font-bold" style={{ color: 'var(--ink)' }}>Camp</th>
                <th scope="col" className="py-2 text-sm font-bold" style={{ color: 'var(--ink)' }}>District</th>
              </tr>
            </thead>
            <tbody>
              {camps.map((camp) => (
                <tr key={camp.id} className="border-b" style={{ borderColor: 'var(--rule)' }}>
                  <td className="py-3 pr-4 font-bold" style={{ color: 'var(--text)' }}>{camp.name}</td>
                  <td className="py-3" style={{ color: 'var(--text-muted)' }}>{camp.district ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
