'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { type Theme, THEME_KEY, resolveTheme } from '@/lib/theme';
import { apiClient } from '@/lib/api/client';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');

  // On mount, read from localStorage
  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'system';
    setThemeState(stored);
    document.documentElement.setAttribute('data-theme', resolveTheme(stored));
  }, []);

  // Listen to OS preference change when in "system" mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.setAttribute('data-theme', resolveTheme('system'));
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      localStorage.setItem(THEME_KEY, t);
      document.documentElement.setAttribute('data-theme', resolveTheme(t));

      // Persist to backend if authenticated
      try {
        apiClient.patch('/auth/me/', { theme_preference: t }).catch(() => {});
      } catch {
        // Not authenticated — ignore
      }
    },
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
