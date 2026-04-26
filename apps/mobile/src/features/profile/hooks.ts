import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { HandleSchema, LanguageCodeSchema, RegionCodeSchema } from '@flixy/shared';

import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';

/**
 * Row shape from `public.profiles` (snake_case to match Postgres).
 */
const ProfileRowSchema = z.object({
  id: z.string().uuid(),
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
  return useQuery({
    queryKey: ['profile', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      return ProfileRowSchema.parse(data);
    },
  });
}

export const ProfileUpdateSchema = z
  .object({
    handle: HandleSchema.nullable(),
    display_name: z.string().min(1).max(80).nullable(),
    avatar_url: z.string().url().nullable(),
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
      const { data, error } = await supabase
        .from('profiles')
        .update(safe)
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return ProfileRowSchema.parse(data);
    },
    onSuccess: (row) => {
      if (userId) qc.setQueryData(profileKey(userId), row);
    },
    onError: (e) => logger.warn('profile.update failed', { message: (e as Error).message }),
  });
}

/**
 * Check whether a handle is currently free. Returns true when nobody owns it
 * (or only the current user does). Profanity filtering is deferred to a
 * server-side moderation pass; this is just the uniqueness check.
 */
export async function isHandleAvailable(handle: string, currentUserId: string | null) {
  const safe = HandleSchema.parse(handle);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', safe)
    .maybeSingle();
  if (error) throw error;
  if (!data) return true;
  return data.id === currentUserId;
}

/**
 * Upload avatar bytes to Storage. The path is owner-scoped (`<userId>/...`)
 * to match the Storage RLS policy in migration 0003. Returns the public URL.
 */
export async function uploadAvatar(params: {
  userId: string;
  bytes: ArrayBuffer;
  contentType: string;
  ext: string;
}) {
  const { userId, bytes, contentType, ext } = params;
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
