import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeFromAcceptLanguage, type Locale } from './config';
import { en, mergeMessages } from './messages';

const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: object }>> = {
  fr: () => import('../../messages/fr.json'),
  rw: () => import('../../messages/rw.json'),
};

// Signed-in users: the cookie set from their account's preferred_language.
// Signed-out visitors: their browser's language, else English.
export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(fromCookie)
    ? fromCookie
    : localeFromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;

  if (locale === 'en') return { locale, messages: en };

  const translated = (await LOADERS[locale]()).default as Parameters<typeof mergeMessages>[1];
  // Until a language has any translated text, render (and announce, via <html lang>) English.
  if (Object.keys(translated).length === 0) return { locale: DEFAULT_LOCALE, messages: en };
  return { locale, messages: mergeMessages(en, translated) };
});
