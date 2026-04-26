import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useSignOut } from '../../src/features/auth/hooks';
import { useUpdatePreferences, useUserPreferences } from '../../src/features/onboarding/hooks';
import { useProfile } from '../../src/features/profile/hooks';

/**
 * Settings shell (FSD § 3.13.2). Most subsections are deep links to
 * existing flows or simple inline toggles for MVP. The richer panes
 * (subscription, content prefs slider, data export) ship in later phases.
 */
export default function Settings() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: prefs } = useUserPreferences();
  const updatePrefs = useUpdatePreferences();
  const signOut = useSignOut();

  return (
    <Screen title={t('settings.title')}>
      <Section title={t('settings.account')}>
        <Row
          label={t('settings.profile')}
          value={profile?.handle ?? profile?.display_name ?? '—'}
          onPress={() => router.push('/(app)/profile')}
        />
        <Row
          label={t('settings.region')}
          value={profile?.region ?? '—'}
          onPress={() => router.push('/(app)/profile')}
        />
        <Row
          label={t('settings.language')}
          value={profile?.language ?? '—'}
          onPress={() => router.push('/(app)/profile')}
        />
      </Section>

      <Section title={t('settings.preferences')}>
        <Row
          label={t('settings.services')}
          value={t('settings.servicesCount', { count: prefs?.selected_services?.length ?? 0 })}
          onPress={() => router.push('/(onboarding)/services')}
        />
        <Row
          label={t('settings.genres')}
          value={t('settings.genresCount', { count: prefs?.selected_genres?.length ?? 0 })}
          onPress={() => router.push('/(onboarding)/genres')}
        />
      </Section>

      <Section title={t('settings.notifications')}>
        <View style={styles.row}>
          <Text variant="body-m">{t('settings.notificationsEnabled')}</Text>
          <Switch
            value={!!prefs?.notifications_enabled}
            onValueChange={(v) => updatePrefs.mutate({ notifications_enabled: v })}
            accessibilityLabel={t('settings.notificationsEnabled')}
          />
        </View>
      </Section>

      <Section title={t('settings.about')}>
        <Row label={t('settings.version')} value={Constants.expoConfig?.version ?? 'dev'} />
        <Row label={t('settings.privacy')} value="" onPress={() => undefined} />
        <Row label={t('settings.terms')} value="" onPress={() => undefined} />
      </Section>

      <View style={{ marginTop: 16 }}>
        <Button
          label={t('auth.signOut')}
          variant="secondary"
          loading={signOut.isPending}
          onPress={() => signOut.mutate()}
        />
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text variant="caption" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }: { pressed?: boolean }) => [
        styles.row,
        onPress && pressed && { opacity: 0.7 },
      ]}
    >
      <Text variant="body-m">{label}</Text>
      <Text variant="body-s" style={{ color: '#A1A1AA' }}>
        {value}
      </Text>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  card: { backgroundColor: '#15151B', borderRadius: 16, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#26262B',
  },
});
