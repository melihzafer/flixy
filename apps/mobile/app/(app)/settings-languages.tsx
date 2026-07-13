import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { useUpdatePreferences, useUserPreferences } from '../../src/features/onboarding/hooks';
import { LANGUAGE_OPTIONS } from '../../src/lib/languageOptions';
import { colors, fonts } from '../../src/theme/tokens';

/**
 * Default original-language preferences for movies & shows. These feed
 * `resolveDeckFilterPolicy` defaults, so Discover, For You, and the trailers
 * feed all respect them until a session filter overrides the include list
 * (blocks are always additive and can never be bypassed).
 */
export default function EditLanguagesScreen() {
  const { t } = useTranslation();
  const { data: prefs } = useUserPreferences();
  const update = useUpdatePreferences();
  const [preferred, setPreferred] = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'allow' | 'block'>('allow');
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!prefs || hydratedRef.current) return;
    setPreferred(new Set(prefs.preferred_languages ?? []));
    setBlocked(new Set(prefs.excluded_languages ?? []));
    hydratedRef.current = true;
  }, [prefs]);

  const toggle = (id: string) => {
    if (mode === 'allow') {
      setPreferred((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setBlocked((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return;
    }

    setBlocked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreferred((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const save = () => {
    update.mutate(
      {
        preferred_languages: Array.from(preferred),
        excluded_languages: Array.from(blocked),
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <SettingsPage
      title={t('settingsPages.languages.title', 'Content languages')}
      subtitle={t(
        'settingsPages.languages.subtitle',
        'Pick the original languages you want for movies and shows. Leave "Show me" empty for every language. Never show hides a language everywhere.',
      )}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ModeTab
          selected={mode === 'allow'}
          label={t('settingsPages.languages.showMe', 'Show me ({{count}})', {
            count: preferred.size,
          })}
          onPress={() => setMode('allow')}
        />
        <ModeTab
          selected={mode === 'block'}
          label={t('settingsPages.languages.neverShow', 'Never show ({{count}})', {
            count: blocked.size,
          })}
          onPress={() => setMode('block')}
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {LANGUAGE_OPTIONS.map((language) => {
          const active = mode === 'allow' ? preferred.has(language.id) : blocked.has(language.id);
          return (
            <Pressable
              key={language.id}
              testID={`settings-language-${language.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${language.label}${active ? ', selected' : ''}`}
              onPress={() => toggle(language.id)}
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
                {language.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textMuted }}>
        {mode === 'allow'
          ? t(
              'settingsPages.languages.allowHint',
              'With no selection, Discover stays open to every language and simply learns from your swipes.',
            )
          : t(
              'settingsPages.languages.blockHint',
              'Blocked languages never appear in Discover, For You, or Trailers — even inside recommendations.',
            )}
      </Text>

      <View style={{ gap: 8 }}>
        <Button
          testID="settings-languages-save"
          label={t('settingsPages.languages.save', 'Save languages')}
          onPress={save}
          loading={update.isPending}
        />
        <Button
          label={t('settingsPages.languages.cancel', 'Cancel')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </View>
    </SettingsPage>
  );
}

function ModeTab({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 38,
        paddingHorizontal: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected ? colors.accentBorder : colors.border,
        backgroundColor: selected ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bodySemi,
          color: selected ? colors.text : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
