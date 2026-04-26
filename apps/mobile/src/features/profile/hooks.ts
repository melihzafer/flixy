import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { LanguageCodeSchema, RegionCodeSchema } from '@flixy/shared';

import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';

/**
 * Row shape from `public.profiles` (snake_case to match Postgres).
 */
const ProfileRowSchema = z.object({
  id: z.string().uuid(),
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
