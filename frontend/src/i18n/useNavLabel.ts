import { useTranslations } from 'next-intl';

/** Key under "navLabels" in messages/en.json for an English label: 'Camps & Zones' -> 'campsZones'. */
export function navLabelKey(english: string): string {
  const words = english.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ');
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('');
}

/**
 * Navigation and page-title labels stay written in English in the code
 * (Sidebar, Topbar) and are looked up under "navLabels"; a label with no
 * entry is shown as written.
 */
export function useNavLabel() {
  const t = useTranslations('navLabels');
  return (english: string) => {
    const key = navLabelKey(english) as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : english;
  };
}
