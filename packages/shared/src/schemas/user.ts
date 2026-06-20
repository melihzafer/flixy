import { z } from 'zod';

export const RegionCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2 region code');

export const LanguageCodeSchema = z.enum(['en', 'tr', 'bg', 'es', 'de', 'fr', 'pt-BR']);

export const UserIdSchema = z.string().min(1).max(256);

export const HandleSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, and underscores only.');

export const UserProfileSchema = z.object({
  id: UserIdSchema,
  handle: HandleSchema.nullable(),
  displayName: z.string().min(1).max(80).nullable(),
  avatarUrl: z.string().url().nullable(),
  region: RegionCodeSchema,
  language: LanguageCodeSchema,
  isAnonymous: z.boolean(),
  createdAt: z.string().datetime(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type RegionCode = z.infer<typeof RegionCodeSchema>;
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;
