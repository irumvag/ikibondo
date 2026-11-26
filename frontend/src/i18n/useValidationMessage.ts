import { useTranslations } from 'next-intl';
import type { Messages } from './messages';

export type ValidationKey = keyof Messages['validation'];

/**
 * Form schemas (src/lib/schemas) use keys under "validation" in en.json as
 * their error messages; this turns such a key into the text to show.
 */
export function useValidationMessage() {
  const t = useTranslations('validation');
  return (message?: string) => (message ? t(message as ValidationKey) : undefined);
}
