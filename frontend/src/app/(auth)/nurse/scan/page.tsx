'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Search } from 'lucide-react';
import { QRScanner } from '@/components/ui/QRScanner';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/contexts/ToastContext';

export default function NurseScanPage() {
  const t = useTranslations('nurse.scan');
  const router = useRouter();
  const toast  = useToast();
  const [manualId,  setManualId]  = useState('');
  const [searching, setSearching] = useState(false);
  const [scanned,   setScanned]   = useState(false);

  async function handleScan(value: string) {
    if (scanned) return; // debounce double-scans
    setScanned(true);

    const trimmed = value.trim();

    // If it looks like a UUID — navigate directly
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(trimmed)) {
      router.push(`/nurse/children/${trimmed}`);
      return;
    }

    // Otherwise treat as registration number — search
    try {
      const { data } = await apiClient.get('/children/', { params: { search: trimmed, page_size: 1 } });
      const results = data.data?.results ?? data.results ?? [];
      if (results.length > 0) {
        router.push(`/nurse/children/${results[0].id}`);
      } else {
        toast.warn(t('noChildFound', { query: trimmed }));
        setTimeout(() => setScanned(false), 2000);
      }
    } catch {
      toast.error(t('searchFailedPleaseTry'));
      setTimeout(() => setScanned(false), 2000);
    }
  }

  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!manualId.trim()) return;
    setSearching(true);
    try {
      await handleScan(manualId.trim());
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-sm mx-auto w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{t('scanQrCard')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('scanAChildS')}</p>
      </div>

      {/* Scanner */}
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={16} style={{ color: 'var(--ink)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('cameraScan')}</p>
        </div>
        <QRScanner onScan={handleScan} onError={(e) => toast.error(e)} />
      </div>

      {/* Manual entry fallback */}
      <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
        <div className="flex items-center gap-2">
          <Search size={16} style={{ color: 'var(--ink)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('manualEntry')}</p>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('enterAChildS')}</p>
        <form onSubmit={handleManualSearch} className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder={t('eGIkb2024')}
            className="flex-1 text-sm px-3 py-2 rounded-xl border outline-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
          />
          <button
            type="submit"
            disabled={!manualId.trim() || searching}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-40"
            style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
          >
            {searching ? '…' : t('go')}
          </button>
        </form>
      </div>
    </div>
  );
}
