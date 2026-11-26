'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Info, AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getActiveAnnouncements } from '@/lib/api/content';

const DISMISSED_KEY = 'ikibondo_dismissed_announcements';

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** Site-wide messages set in Admin → Announcements. Each can be dismissed on this device. */
export function AnnouncementBanner({ where }: { where: 'public' | 'dashboard' }) {
  const { data = [] } = useQuery({
    queryKey: ['announcements', 'active', where],
    queryFn: () => getActiveAnnouncements(where),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [dismissed, setDismissed] = useState<string[]>(() => (typeof window === 'undefined' ? [] : readDismissed()));
  const t = useTranslations('announcement');

  const visible = data.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-50))); } catch { /* private mode */ }
  };

  return (
    <div className="flex flex-col">
      {visible.map((a) => {
        const warn = a.level === 'WARNING';
        const Icon = warn ? AlertTriangle : Info;
        return (
          <div key={a.id} role="status"
            className="animate-fade-up flex items-start gap-3 px-4 sm:px-6 py-2.5 text-sm border-b"
            style={{
              backgroundColor: warn ? 'var(--med-bg)' : 'var(--bg-sand)',
              borderColor: 'var(--border)',
              color: 'var(--ink)',
            }}>
            <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: warn ? 'var(--warn)' : 'var(--ink)' }} />
            <p className="flex-1">
              {a.message_en}
              {a.link_url && (
                <>
                  {' '}
                  <Link href={a.link_url} className="font-bold underline underline-offset-2">{t('learnMore')}</Link>
                </>
              )}
            </p>
            <button type="button" onClick={() => dismiss(a.id)} aria-label={t('dismiss')}
              className="p-0.5 rounded hover:opacity-70">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
