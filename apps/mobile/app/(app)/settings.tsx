import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  Bell,
  Clapperboard,
  FileText,
  Globe2,
  HelpCircle,
  Languages,
  Shield,
  Tv,
  UserCircle2,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { SettingsRow } from '../../src/components/ListRow';
import { SettingsGroup, SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { useStreamingServices, useUserPreferences } from '../../src/features/onboarding/hooks';
import { toProfilePreferenceDisplay } from '../../src/features/profile/display';
import { useProfile } from '../../src/features/profile/hooks';
import { events } from '../../src/features/telemetry/events';
import { FALLBACK_STREAMING_SERVICES } from '../../src/lib/fallbackCatalogue';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';

/**
 * Unified settings hub. Reachable from the Profile tab via the "Settings" row.
 * Owns every preference subpage link + About. Sign-out lives on the Profile
 * tab and the Account-management page (one label, one behavior) to avoid the
 * three-divergent-sign-out antipattern.
 */
export default function Settings() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: prefs } = useUserPreferences();
  const { data: services } = useStreamingServices(profile?.region);
  const selectedServiceCount = prefs?.selected_services?.length ?? 0;
  const selectedGenreCount = prefs?.selected_genres?.length ?? 0;
  const setupCount = [
    profile?.region,
    profile?.language,
    selectedServiceCount,
    selectedGenreCount,
  ].filter(Boolean).length;
  const display = toProfilePreferenceDisplay({
    profile,
    prefs,
    services: services ?? FALLBACK_STREAMING_SERVICES,
    signedIn: !!profile && !profile.is_anonymous,
    isPreviewUser: !!profile?.is_anonymous,
    t,
  });

  const open = (detail: string, href: Parameters<typeof router.push>[0]) => {
    events.settingsDetailOpened(detail);
    router.push(href);
  };

  return (
    <SettingsPage
      title={t('settings.title', 'Settings')}
      subtitle={t('settings.subtitle')}
      bodyInset={false}
    >
      <View style={styles.setupCard}>
        <View style={styles.setupTopRow}>
          <View>
            <Text style={styles.setupEyebrow}>{t('settings.setupEyebrow', 'TONIGHT PROFILE')}</Text>
            <Text style={styles.setupTitle}>{display.profileSummary}</Text>
          </View>
          <View style={styles.setupBadge}>
            <Text style={styles.setupBadgeText}>{setupCount}/4</Text>
          </View>
        </View>
        <Text style={styles.setupCopy}>
          {t(
            'settings.setupCopy',
            'These choices shape Discover, availability, language, and reminders.',
          )}
        </Text>
        <View style={styles.pillRow}>
          <StatusPill label={display.regionText} />
          <StatusPill
            label={t('settings.servicesCount', '{{count}} services', {
              count: selectedServiceCount,
            })}
          />
          <StatusPill
            label={t('settings.genresCount', '{{count}} genres', { count: selectedGenreCount })}
          />
        </View>
      </View>

      <SettingsGroup title={t('settings.account')}>
        <SettingsRow
          label={t('settings.profileSummary', 'Profile summary')}
          value={display.profileSummary}
          subtitle={t('settings.profileSummarySub', 'Edit display name and handle')}
          leading={<SettingsIcon Icon={UserCircle2} tone="accent" />}
          accessibilityLabel={`${t('settings.profileSummary')}, ${display.profileSummary}`}
          onPress={() => open('edit_profile', '/(app)/edit-profile')}
          valueNumberOfLines={2}
        />
        <SettingsRow
          label={t('settings.accountManagement', 'Account management')}
          value={
            profile?.is_anonymous
              ? t('profile.row.accountPreview', 'Preview')
              : t('profile.row.accountFree', 'Free')
          }
          subtitle={t('settings.accountManagementSub', 'Sign-in, password, subscription')}
          leading={<SettingsIcon Icon={Shield} />}
          onPress={() => open('account', '/(app)/settings-account')}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.preferences')}>
        <SettingsRow
          label={t('settings.region')}
          value={display.regionText}
          subtitle={t('settings.regionSub', 'Used for availability')}
          leading={<SettingsIcon Icon={Globe2} />}
          accessibilityLabel={`${t('settings.region')}, ${display.regionText}`}
          onPress={() => open('region', '/(app)/settings-region')}
          valueNumberOfLines={1}
        />
        <SettingsRow
          label={t('settings.language')}
          value={display.languageText}
          subtitle={t('settings.languageSub', 'App language')}
          leading={<SettingsIcon Icon={Languages} />}
          accessibilityLabel={`${t('settings.language')}, ${display.languageText}`}
          onPress={() => open('language', '/(app)/settings-language')}
          valueNumberOfLines={1}
        />
        <SettingsRow
          testID="settings-services-row"
          label={t('settings.services')}
          value={display.servicesSummary}
          subtitle={t('settings.servicesSub', 'Where your picks can play')}
          leading={<SettingsIcon Icon={Tv} />}
          accessibilityLabel={`${t('settings.services')}, ${display.servicesSummary}`}
          onPress={() => open('services', '/(app)/settings-services')}
          valueNumberOfLines={2}
        />
        <SettingsRow
          testID="settings-genres-row"
          label={t('settings.genres')}
          value={display.genresSummary}
          subtitle={t('settings.genresSub', 'What Discover should favor')}
          leading={<SettingsIcon Icon={Clapperboard} />}
          accessibilityLabel={`${t('settings.genres')}, ${display.genresSummary}`}
          onPress={() => open('genres', '/(app)/settings-genres')}
          valueNumberOfLines={2}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.notifications')}>
        <SettingsRow
          label={t('settings.notificationsEnabled')}
          value={prefs?.notifications_enabled ? t('profile.on', 'On') : t('profile.off', 'Off')}
          subtitle={t('settings.notificationsSub', 'Quiet by default, useful when enabled')}
          leading={<SettingsIcon Icon={Bell} />}
          onPress={() => open('notifications', '/(app)/settings-notifications')}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.about')}>
        <SettingsRow
          label={t('settings.version')}
          value={Constants.expoConfig?.version ?? 'dev'}
          leading={<SettingsIcon Icon={FileText} />}
        />
        <SettingsRow
          label={t('settings.help', 'Help & support')}
          value={t('settings.open', 'Open')}
          leading={<SettingsIcon Icon={HelpCircle} />}
          onPress={() => open('help', '/(app)/settings-help')}
        />
        <SettingsRow
          label={t('settings.privacy')}
          value={t('settings.read', 'Read')}
          leading={<SettingsIcon Icon={Shield} />}
          onPress={() => open('privacy', '/(app)/settings-privacy')}
        />
        <SettingsRow
          label={t('settings.terms')}
          value={t('settings.read', 'Read')}
          leading={<SettingsIcon Icon={FileText} />}
          onPress={() => open('terms', '/(app)/terms')}
        />
      </SettingsGroup>

      <View style={{ height: 16 }} />
    </SettingsPage>
  );
}

function SettingsIcon({
  Icon,
  tone = 'default',
}: {
  Icon: typeof UserCircle2;
  tone?: 'default' | 'accent';
}) {
  const isAccent = tone === 'accent';
  return (
    <View style={[styles.iconShell, isAccent ? styles.iconShellAccent : null]}>
      <Icon
        size={18}
        color={isAccent ? colors.accent : 'rgba(245,245,240,0.74)'}
        strokeWidth={2.1}
      />
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View style={styles.statusPill}>
      <Text numberOfLines={1} style={styles.statusPillText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  setupCard: {
    overflow: 'hidden',
    marginHorizontal: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: 'rgba(255,77,28,0.11)',
    padding: spacing[5],
    gap: spacing[4],
  },
  setupTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  setupEyebrow: {
    color: 'rgba(245,245,240,0.58)',
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    lineHeight: 16,
  },
  setupTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    letterSpacing: -0.35,
    lineHeight: 28,
    marginTop: spacing[1],
  },
  setupBadge: {
    minWidth: 46,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  setupBadgeText: {
    color: colors.onAccent,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  setupCopy: {
    maxWidth: 320,
    color: 'rgba(245,245,240,0.68)',
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  statusPill: {
    minHeight: 32,
    maxWidth: '100%',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(245,245,240,0.12)',
    backgroundColor: 'rgba(10,10,11,0.36)',
    paddingHorizontal: spacing[3],
  },
  statusPillText: {
    color: 'rgba(245,245,240,0.78)',
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
  },
  iconShell: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(245,245,240,0.1)',
    backgroundColor: 'rgba(245,245,240,0.06)',
  },
  iconShellAccent: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentDim,
  },
});
