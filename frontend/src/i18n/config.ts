/**
 * Languages the web app can show. English is the source language and the
 * fallback: any text missing from fr.json or rw.json is shown in English, so
 * partial translations are safe to ship (docs/i18n.md).
 */
export const LOCALES = ['en', 'fr', 'rw'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie holding the language to render; set from the account's preferred_language. */
export const LOCALE_COOKIE = 'ikibondo_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** First supported language in an Accept-Language header, for signed-out visitors. */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase().split('-')[0];
    if (isLocale(tag)) return tag;
  }
  return null;
}
