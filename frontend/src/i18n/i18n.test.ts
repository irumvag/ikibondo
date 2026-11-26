import { describe, expect, it } from 'vitest';
import { isLocale, localeFromAcceptLanguage } from './config';
import { en, mergeMessages } from './messages';
import fr from '../../messages/fr.json';
import rw from '../../messages/rw.json';

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keys(v, `${prefix}${k}.`),
  );
}

describe('locale detection', () => {
  it('accepts only the supported languages', () => {
    expect(isLocale('rw')).toBe(true);
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('picks the first supported browser language', () => {
    expect(localeFromAcceptLanguage('de-DE,fr-FR;q=0.8,en;q=0.5')).toBe('fr');
    expect(localeFromAcceptLanguage('rw-RW')).toBe('rw');
    expect(localeFromAcceptLanguage('de,es')).toBeNull();
    expect(localeFromAcceptLanguage(null)).toBeNull();
  });
});

describe('message fallback', () => {
  it('keeps English for any text not yet translated', () => {
    const merged = mergeMessages(
      { nav: { home: 'Home', about: 'About' } },
      { nav: { home: 'Ahabanza' } },
    );
    expect(merged).toEqual({ nav: { home: 'Ahabanza', about: 'About' } });
  });
});

describe('translation catalogs', () => {
  const english = new Set(keys(en as Tree));

  it.each([['fr', fr], ['rw', rw]])('%s.json only uses keys that exist in en.json', (_, catalog) => {
    const unknown = keys(catalog as Tree).filter((k) => !english.has(k));
    expect(unknown).toEqual([]);
  });
});
