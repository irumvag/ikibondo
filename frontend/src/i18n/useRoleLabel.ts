import { useTranslations } from 'next-intl';
import type { UserRole } from '@/store/authStore';

/** The role's name in the reader's language (messages/en.json roles.name.<ROLE>). */
export function useRoleLabel() {
  const t = useTranslations('roles.name');
  return (role: UserRole) => t(role);
}
