export type Theme = 'system' | 'light' | 'dark';

export const THEME_KEY = 'ikibondo-theme';

export function resolveTheme(pref: Theme): 'light' | 'dark' {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  // system
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/** Inline script string injected before first paint to prevent theme flash. */
export const THEME_SCRIPT = `
(function() {
  try {
    var pref = localStorage.getItem('${THEME_KEY}') || 'system';
    var resolved = pref === 'dark' ? 'dark'
      : pref === 'light' ? 'light'
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
  } catch(e) {}
})();
`.trim();
