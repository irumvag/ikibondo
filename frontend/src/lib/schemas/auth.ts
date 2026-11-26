import { z } from 'zod';

// Error messages are keys under "validation" in messages/en.json (see useValidationMessage).
export const loginSchema = z.object({
  identifier: z.string().min(1, 'identifierRequired'),
  password: z.string().min(1, 'passwordRequired'),
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

// Self-signup is PARENT only — role field is omitted from the form
export const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(2, 'fullNameMin')
      .trim(),
    email: z
      .union([z.string().email('emailInvalid'), z.literal('')])
      .optional(),
    phone_number: z
      .string()
      .min(10, 'phoneMin')
      .regex(/^\+?[\d\s\-()]{10,}$/, 'phoneFormat'),
    password: z.string().min(8, 'passwordMin'),
    password_confirm: z.string().min(1, 'passwordConfirm'),
    preferred_language: z.enum(LANGUAGES),
    camp: z
      .string()
      .optional()
      .or(z.literal('')),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'passwordsMatch',
    path: ['password_confirm'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
// Role is always PARENT for self-signup — added server-side
