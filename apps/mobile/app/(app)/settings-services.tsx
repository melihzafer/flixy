import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import {
  useStreamingServices,
  useUpdatePreferences,
  useUserPreferences,
} from '../../src/features/onboarding/hooks';
import { useProfile } from '../../src/features/profile/hooks';
import { FALLBACK_STREAMING_SERVICES } from '../../src/lib/fallbackCatalogue';
import { colors, fonts } from '../../src/theme/tokens';

export default function EditServicesScreen() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: prefs } = useUserPreferences();
  const region = profile?.region ?? 'US';
  const { data: services } = useStreamingServices(region);
  const update = useUpdatePreferences();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set(prefs?.selected_services ?? []));
  }, [prefs?.selected_services]);

  const serviceOptions = useMemo(
    () =>
      services ?? FALLBACK_STREAMING_SERVICES.filter((service) => service.regions.includes(region)),
    [region, services],
  );

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = () => {
    update.mutate({ selected_services: Array.from(selected) }, { onSuccess: () => router.back() });
  };

  return (
    <SettingsPage
      title={t('settingsPages.services.title', 'Streaming services')}
      subtitle={t(
        'settingsPages.services.subtitle',
        'Keep this current so Discover only recommends titles you can actually play.',
      )}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {serviceOptions.map((service) => {
          const active = selected.has(service.id);
          return (
            <Pressable
              key={service.id}
              testID={`settings-service-${service.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${service.name}${active ? ', selected' : ''}`}
              onPress={() => toggle(service.id)}
              style={{
                width: '48%',
                minHeight: 52,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: active ? colors.accentBorder : colors.border,
                backgroundColor: active ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 13,
                  color: active ? colors.text : colors.textMuted,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {service.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 8 }}>
        <Button
          testID="settings-services-save"
          label={t('settingsPages.services.save', 'Save services')}
          onPress={save}
          loading={update.isPending}
          disabled={selected.size === 0}
        />
        <Button
          label={t('settingsPages.services.cancel', 'Cancel')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </View>
    </SettingsPage>
  );
}
