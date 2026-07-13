import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { LanguageCodeSchema, RegionCodeSchema, StreamingServiceIdSchema } from '@flixy/shared';

import { FALLBACK_GENRES_PARSED, FALLBACK_STREAMING_SERVICES } from '../../lib/fallbackCatalogue';
import { localDb } from '../../lib/localDb';
import { useSession } from '../auth/useSession';

/**
 * Onboarding state queries + mutations (FSD § 3.2).
 *
 * Reads: streaming services for the current region + genre catalogue.
 * Writes: incremental updates to `public.user_preferences` so onboarding is
 * resumable per FSD § 3.2.4.
 */

const LocalUserIdSchema = z.string().min(1);

const PrefsRowSchema = z.object({
  user_id: LocalUserIdSchema,
  selected_services: z.array(z.string()),
  selected_genres: z.array(z.string()),
  excluded_genres: z.array(z.string()).default([]),
  preferred_languages: z.array(z.string()).default([]),
  excluded_languages: z.array(z.string()).default([]),
  notifications_enabled: z.boolean(),
  onboarding_completed_at: z.string().nullable(),
  cold_start_completed_at: z.string().nullable(),
  updated_at: z.string(),
});

export type PrefsRow = z.infer<typeof PrefsRowSchema>;

export function useUserPreferences() {
  const { data: auth } = useSession();
  const userId = auth?.user?.id ?? null;
  return useQuery({
    queryKey: ['user_preferences', userId ?? 'anon'],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const data = await localDb.getPreferences(userId);
      if (!data) return bootstrapUserPreferences(userId);
      return PrefsRowSchema.parse(data);
    },
  });
}

async function bootstrapUserPreferences(userId: string): Promise<PrefsRow> {
  await localDb.upsertProfile(userId, { id: userId });
  const data = await localDb.upsertPreferences(userId, {});
  return PrefsRowSchema.parse(data);
}

export function useStreamingServices(region: string | undefined) {
  return useQuery({
    queryKey: ['streaming_services', region ?? 'all'],
    enabled: !!region,
    queryFn: async () => {
      if (!region) return [];
      return FALLBACK_STREAMING_SERVICES.filter((s) => s.regions.includes(region));
    },
  });
}

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      return FALLBACK_GENRES_PARSED;
    },
  });
}

type PrefsPatch = {
  selected_services?: string[];
  selected_genres?: string[];
  excluded_genres?: string[];
  preferred_languages?: string[];
  excluded_languages?: string[];
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
      const data = await localDb.upsertPreferences(userId, patch);
      return PrefsRowSchema.parse(data);
    },
    onMutate: async (patch) => {
      if (!userId) return undefined;
      // Optimistic update so the SettingsRow / deck filter reflects the
      // new value the instant the user taps Save (instead of waiting for
      // the AsyncStorage round-trip + refetch).
      const key = ['user_preferences', userId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PrefsRow | null>(key) ?? null;
      if (previous) {
        qc.setQueryData<PrefsRow>(key, { ...previous, ...(patch as Partial<PrefsRow>) });
      }
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (userId && context?.previous) {
        qc.setQueryData(['user_preferences', userId], context.previous);
      }
    },
    onSuccess: (row) => {
      if (userId) qc.setQueryData(['user_preferences', userId], row);
    },
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
      await localDb.upsertProfile(userId, safe);
      return safe;
    },
    onSuccess: (safe) => {
      if (!userId) return;
      const key = ['profile', userId];
      const previous = qc.getQueryData<{ region?: string; language?: string } | null>(key);
      if (previous) {
        qc.setQueryData(key, { ...previous, region: safe.region, language: safe.language });
      } else {
        qc.invalidateQueries({ queryKey: key });
      }
      qc.invalidateQueries({ queryKey: ['user_preferences', userId] });
    },
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

export const __schemas = { PrefsRowSchema, StreamingServiceIdSchema };
