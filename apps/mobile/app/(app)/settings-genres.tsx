import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ONBOARDING } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import {
  useGenres,
  useUpdatePreferences,
  useUserPreferences,
} from '../../src/features/onboarding/hooks';
import { FALLBACK_GENRES_PARSED } from '../../src/lib/fallbackCatalogue';
import { colors, fonts } from '../../src/theme/tokens';

export default function EditGenresScreen() {
  const { t } = useTranslation();
  const { data: genres } = useGenres();
  const { data: prefs } = useUserPreferences();
  const update = useUpdatePreferences();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!prefs || hydratedRef.current) return;
    setSelected(new Set(prefs?.selected_genres ?? []));
    hydratedRef.current = true;
  }, [prefs]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < ONBOARDING.MAX_GENRES) next.add(id);
      return next;
    });
  };

  const save = () => {
    update.mutate(
      { selected_genres: Array.from(selected).slice(0, ONBOARDING.MAX_GENRES) },
      { onSuccess: () => router.back() },
    );
  };

  const canSave = selected.size >= ONBOARDING.MIN_GENRES;
  const genreOptions = genres ?? FALLBACK_GENRES_PARSED;

  return (
    <SettingsPage
      title={t('settingsPages.genres.title', 'Favourite genres')}
      subtitle={t(
        'settingsPages.genres.subtitle',
        'Pick {{min}}-{{max}}. Discover will still leave room for surprises.',
        {
          min: ONBOARDING.MIN_GENRES,
          max: ONBOARDING.MAX_GENRES,
        },
      )}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {genreOptions.map((genre) => {
          const active = selected.has(genre.id);
          const label = t(`genres.${genre.id}`, genre.id.replace(/_/g, ' '));
          return (
            <Pressable
              key={genre.id}
              testID={`settings-genre-${genre.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}${active ? ', selected' : ''}`}
              onPress={() => toggle(genre.id)}
              style={{
                minHeight: 36,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: active ? colors.accentBorder : colors.border,
                backgroundColor: active ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 13,
                  color: active ? colors.text : colors.textMuted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 8 }}>
        <Button
          testID="settings-genres-save"
          label={t('settingsPages.genres.save', 'Save genres')}
          onPress={save}
          loading={update.isPending}
          disabled={!canSave}
        />
        <Button
          label={t('settingsPages.genres.cancel', 'Cancel')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </View>
    </SettingsPage>
  );
}
