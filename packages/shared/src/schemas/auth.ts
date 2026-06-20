import { z } from 'zod';

import { LanguageCodeSchema, RegionCodeSchema, UserIdSchema } from './user';

/**
 * Auth credential and session schemas.
 * Used both by the mobile app (form validation via react-hook-form + zod
 * resolver) and by any future server-side / edge handlers.
 */

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address.');

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.');

export const SignUpInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  // Region/language collected upfront so we can localise immediately.
  region: RegionCodeSchema.optional(),
  language: LanguageCodeSchema.optional(),
});

export const SignInInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Please enter your password.'),
});

export const ResetPasswordInputSchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const UpdatePasswordInputSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignUpInput = z.infer<typeof SignUpInputSchema>;
export type SignInInput = z.infer<typeof SignInInputSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordInputSchema>;

/**
 * The shape we persist for a session in client state. Refresh tokens live in
 * expo-secure-store; access tokens flow through Supabase's auth client.
 */
export const SessionUserSchema = z.object({
  id: UserIdSchema,
  email: z.string().email().nullable(),
  isAnonymous: z.boolean(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;
