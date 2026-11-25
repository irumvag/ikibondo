import type { UserRole } from '@/store/authStore';

/** Where each role lands after signing in or switching role. */
export const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: '/admin',
  SUPERVISOR: '/supervisor',
  NURSE: '/nurse',
  CHW: '/chw',
  PARENT: '/parent',
  GOVERNMENT: '/insights',
  PARTNER: '/insights',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  SUPERVISOR: 'Zone Supervisor',
  NURSE: 'Nurse',
  CHW: 'Community Health Worker',
  PARENT: 'Parent / Guardian',
  GOVERNMENT: 'Government official',
  PARTNER: 'NGO / UN partner',
};

export const ALL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'NURSE', 'CHW', 'PARENT', 'GOVERNMENT', 'PARTNER'];
