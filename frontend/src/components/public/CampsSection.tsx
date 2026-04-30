'use client';

import { MapPin, Users } from 'lucide-react';
import { usePublicCamps } from '@/lib/api/queries';
import { useIntersection } from '@/hooks/useIntersection';
import { Skeleton } from '@/components/ui/Skeleton';

export function CampsSection() {
  const { data: camps = [], isLoading } = usePublicCamps();
  const { ref, visible } = useIntersection<HTMLElement>(0.05);

  return (
    <section
      ref={ref}
      className="py-16 sm:py-24"
      style={{ backgroundColor: 'var(--bg)' }}
      aria-label="Refugee camps served"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading */}
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Serving Rwanda&apos;s refugee camps
          </h2>
          <p className="text-base" style={{ color: 'var(--text-muted)' }}>
            Ikibondo is deployed across UNHCR-supported displacement sites
          </p>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : camps.length === 0 ? (
          <p className="text-center" style={{ color: 'var(--text-muted)' }}>
            Camp information currently unavailable.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {camps.map((camp, i) => (
              <div
                key={camp.id}
                className="p-5 rounded-2xl border transition-all duration-500"
                style={{
                  backgroundColor: 'var(--bg-elev)',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(16px)',
                  transitionDelay: `${i * 60}ms`,
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3
                    className="font-semibold text-base leading-snug"
                    style={{
                      color: 'var(--ink)',
                      fontFamily: 'var(--font-fraunces)',
                    }}
                  >
                    {camp.name}
                  </h3>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-md shrink-0"
                    style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
                  >
                    {camp.code}
                  </span>
                </div>

                {camp.district && (
                  <div
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <MapPin size={13} aria-hidden="true" />
                    <span>{camp.district}, {camp.country}</span>
                  </div>
                )}

                {camp.estimated_population != null && (
                  <div
                    className="flex items-center gap-1.5 mt-2 text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Users size={13} aria-hidden="true" />
                    <span>~{camp.estimated_population.toLocaleString()} residents</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
