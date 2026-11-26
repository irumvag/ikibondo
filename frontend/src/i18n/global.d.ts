import type en from '../../messages/en.json';
import type { Locale } from './config';

// Lets TypeScript check every t('…') key against messages/en.json.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
