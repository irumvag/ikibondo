import { describe, expect, it } from 'vitest';
import { resolveSection, type StoredContent } from './siteContent';

describe('resolveSection languages', () => {
  it('shows the built-in French and Kinyarwanda home text', () => {
    expect(resolveSection({}, 'home.hero', 'fr').primary_cta).toBe('Se connecter');
    expect(resolveSection({}, 'home.hero', 'rw').primary_cta).toBe('Injira');
    expect(resolveSection({}, 'home.hero', 'en').primary_cta).toBe('Sign in');
  });

  it("keeps French when an admin edited only the English", () => {
    const stored = { 'home.hero': { key: 'home.hero', content_en: { title: 'New English title' }, content_fr: {}, content_rw: {} } } as StoredContent;
    expect(resolveSection(stored, 'home.hero', 'en').title).toBe('New English title');
    expect(resolveSection(stored, 'home.hero', 'fr').title).toMatch(/^Repérer/);
  });

  it("uses the admin's own translation over the built-in one", () => {
    const stored = { 'home.hero': { key: 'home.hero', content_en: {}, content_fr: { title: 'Titre admin' }, content_rw: {} } } as StoredContent;
    expect(resolveSection(stored, 'home.hero', 'fr').title).toBe('Titre admin');
  });

  it('falls back to English where there is no translation', () => {
    expect(resolveSection({}, 'app.feeding', 'fr').title).toBe(resolveSection({}, 'app.feeding', 'en').title);
  });
});
