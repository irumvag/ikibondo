import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ── Register ────────────────────────────────────────────────────────────────

export const USER_ROLES = ['CHW', 'NURSE', 'SUPERVISOR', 'PARENT'] as const;
export const LANGUAGES   = ['rw', 'fr', 'en'] as const;

export const ROLE_LABELS: Record<(typeof USER_ROLES)[number], string> = {
  CHW:        'Community Health Worker',
  NURSE:      'Nurse / Clinician',
  SUPERVISOR: 'Zone Supervisor',
  PARENT:     'Parent / Guardian',
};

export const LANGUAGE_LABELS: Record<(typeof LANGUAGES)[number], string> = {
  rw: 'Kinyarwanda',
  fr: 'Français',
  en: 'English',
};

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .trim(),
    email: z
      .union([z.string().email('Invalid email address'), z.literal('')])
      .optional(),
    phone_number: z
      .string()
      .min(10, 'Phone number must be at least 10 digits')
      .regex(/^\+?[\d\s\-()]{10,}$/, 'Invalid phone number format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirm: z.string().min(1, 'Please confirm your password'),
    role: z.enum(USER_ROLES, { error: 'Please select a role' }),
    preferred_language: z.enum(LANGUAGES),
    camp: z
      .string()
      .optional()
      .or(z.literal('')),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: "Passwords don't match",
    path: ['password_confirm'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
