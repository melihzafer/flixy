import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { HandleSchema, LanguageCodeSchema, RegionCodeSchema } from '@flixy/shared';

import { localDb } from '../../lib/localDb';
import { logger } from '../../lib/logger';
import { useSession } from '../auth/useSession';

/**
 * Row shape from `public.profiles` (snake_case to match Postgres).
 */
const ProfileRowSchema = z.object({
  id: z.string().min(1),
  handle: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  region: RegionCodeSchema,
  language: LanguageCodeSchema,
  is_anonymous: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ProfileRow = z.infer<typeof ProfileRowSchema>;

const profileKey = (userId: string) => ['profile', userId] as const;

export function useProfile() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const isAnonymous = session?.isAnonymous ?? false;
  return useQuery({
    queryKey: ['profile', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const data = await localDb.getProfile(userId);
      if (!data) {
        const created = await localDb.upsertProfile(userId, {
          id: userId,
          region: 'US',
          language: 'en',
        });
        return ProfileRowSchema.parse({
          ...created,
          handle: null,
          display_name: null,
          avatar_url: null,
          is_anonymous: isAnonymous,
          updated_at: new Date().toISOString(),
        });
      }
      return ProfileRowSchema.parse({
        ...data,
        handle: data.handle ?? null,
        display_name: data.name ?? null,
        avatar_url: data.avatar_url ?? null,
        is_anonymous: isAnonymous,
        updated_at: new Date().toISOString(),
      });
    },
  });
}

export const ProfileUpdateSchema = z
  .object({
    handle: HandleSchema.nullable(),
    display_name: z.string().min(1).max(80).nullable(),
    avatar_url: z.string().nullable(), // Allow file:// URIs as well
    region: RegionCodeSchema,
    language: LanguageCodeSchema,
  })
  .partial();

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      if (!userId) throw new Error('not authenticated');
      const safe = ProfileUpdateSchema.parse(patch);

      // Only carry through fields that were actually provided in the patch.
      // upsertProfile merges with `{...existing, ...updates}`, so passing
      // `undefined` for region/language (as a `.partial()` schema yields when
      // the caller only edits name/handle/avatar) would OVERWRITE the user's
      // existing region/language with undefined — silently wiping them.
      // Build the upsert from present keys only.
      const upsert: Record<string, unknown> = {};
      if (safe.region !== undefined) upsert.region = safe.region;
      if (safe.language !== undefined) upsert.language = safe.language;
      if (safe.display_name !== undefined) upsert.name = safe.display_name ?? undefined;
      if (safe.handle !== undefined) upsert.handle = safe.handle ?? undefined;
      if (safe.avatar_url !== undefined) upsert.avatar_url = safe.avatar_url ?? undefined;

      const updated = await localDb.upsertProfile(userId, upsert);

      return ProfileRowSchema.parse({
        ...updated,
        handle: updated.handle ?? null,
        display_name: updated.name ?? null,
        avatar_url: updated.avatar_url ?? null,
        is_anonymous: session?.isAnonymous ?? false,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: (row) => {
      if (userId) qc.setQueryData(profileKey(userId), row);
    },
    onError: (e) => logger.warn('profile.update failed', { message: (e as Error).message }),
  });
}

/**
 * Check whether a handle is currently free.
 */
export async function isHandleAvailable(handle: string, currentUserId: string | null) {
  const safe = HandleSchema.parse(handle);
  const taken = await localDb.isHandleTaken(safe, currentUserId || '');
  return !taken;
}
