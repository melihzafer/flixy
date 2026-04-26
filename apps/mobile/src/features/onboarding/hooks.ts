import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import {
  GenreSchema,
  LanguageCodeSchema,
  RegionCodeSchema,
  StreamingServiceIdSchema,
  StreamingServiceSchema,
} from '@flixy/shared';

import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';

/**
 * Onboarding state queries + mutations (FSD § 3.2).
 *
 * Reads: streaming services for the current region + genre catalogue.
 * Writes: incremental updates to `public.user_preferences` so onboarding is
 * resumable per FSD § 3.2.4.
 */

const PrefsRowSchema = z.object({
  user_id: z.string().uuid(),
  selected_services: z.array(z.string()),
  selected_genres: z.array(z.string()),
  notifications_enabled: z.boolean(),
  onboarding_completed_at: z.string().nullable(),
  cold_start_completed_at: z.string().nullable(),
  updated_at: z.string(),
});

export type PrefsRow = z.infer<typeof PrefsRowSchema>;

export function useUserPreferences() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  return useQuery({
    queryKey: ['user_preferences', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return PrefsRowSchema.parse(data);
    },
  });
}

const ServiceRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo_url: z.string().nullable(),
  regions: z.array(RegionCodeSchema),
  display_rank: z.number(),
});

export function useStreamingServices(region: string | undefined) {
  return useQuery({
    queryKey: ['streaming_services', region ?? 'all'],
    enabled: !!region,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streaming_services')
        .select('*')
        .contains('regions', [region])
        .order('display_rank', { ascending: true });
      if (error) throw error;
      return z
        .array(ServiceRowSchema)
        .parse(data)
        .map((r) =>
          StreamingServiceSchema.parse({
            id: r.id,
            name: r.name,
            logoUrl: r.logo_url,
            regions: r.regions,
            displayRank: r.display_rank,
          }),
        );
    },
  });
}

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .order('display_rank', { ascending: true });
      if (error) throw error;
      return z
        .array(z.object({ id: z.string(), display_rank: z.number() }))
        .parse(data)
        .map((g) => GenreSchema.parse({ id: g.id, displayRank: g.display_rank }));
    },
  });
}

type PrefsPatch = {
  selected_services?: string[];
  selected_genres?: string[];
  notifications_enabled?: boolean;
  onboarding_completed_at?: string | null;
  cold_start_completed_at?: string | null;
};

export function useUpdatePreferences() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  return useMutation({
    mutationFn: async (patch: PrefsPatch) => {
      if (!userId) throw new Error('not authenticated');
      const { data, error } = await supabase
        .from('user_preferences')
        .update(patch)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return PrefsRowSchema.parse(data);
    },
    onSuccess: (row) => {
      if (userId) qc.setQueryData(['user_preferences', userId], row);
    },
    onError: (e) => logger.warn('prefs.update failed', { message: (e as Error).message }),
  });
}

export function useUpdateProfileRegion() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  return useMutation({
    mutationFn: async (input: { region: string; language: string }) => {
      if (!userId) throw new Error('not authenticated');
      const safe = z
        .object({ region: RegionCodeSchema, language: LanguageCodeSchema })
        .parse(input);
      const { error } = await supabase.from('profiles').update(safe).eq('id', userId);
      if (error) throw error;
      return safe;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}

/**
 * Convenience: have we completed onboarding yet?
 */
export function useOnboardingStatus() {
  const { data: prefs, isLoading } = useUserPreferences();
  return {
    isLoading,
    isOnboarded: !!prefs?.onboarding_completed_at,
    prefs,
  };
}

export const __schemas = { StreamingServiceIdSchema };
