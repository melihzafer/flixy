import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pencil, Settings as SettingsIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppHeader } from '../../../src/components/AppHeader';
import { Button } from '../../../src/components/Button';
import { SettingsRow } from '../../../src/components/ListRow';
import { Screen } from '../../../src/components/Screen';
import { SettingsGroup } from '../../../src/components/SettingsPage';
import { Text } from '../../../src/components/Text';
import { useSignOut } from '../../../src/features/auth/hooks';
import { useSession } from '../../../src/features/auth/useSession';
import { toProfilePreferenceDisplay } from '../../../src/features/profile/display';
import { useProfile } from '../../../src/features/profile/hooks';
import { useSwipeCount } from '../../../src/features/swipe/hooks';
import { events } from '../../../src/features/telemetry/events';
import { useWatchlist } from '../../../src/features/watchlist/hooks';
import { colors, fonts } from '../../../src/theme/tokens';

const WELCOME_ROUTE = '/(auth)/welcome' as const;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { data: profile } = useProfile();
  const { entries: watchlist } = useWatchlist('all');
  const { data: swipeCount = 0 } = useSwipeCount();
  const signOut = useSignOut();

  const signedIn = !!session?.user && !session.isAnonymous;
  const isPreviewUser = !!session?.user && session.isAnonymous;

  const seenCount = watchlist.filter((entry) => !!entry.item.watchedAt).length;
  const savedCount = watchlist.filter((entry) => !entry.item.watchedAt).length;

  const display = toProfilePreferenceDisplay({
    profile,
    prefs: undefined,
    services: [],
    signedIn,
    isPreviewUser,
    t,
  });

  const openProfileRow = (row: string, href: Parameters<typeof router.push>[0]) => {
    events.profileRowTapped(row);
    router.push(href);
  };

  const handleSignOut = () => {
    events.profileRowTapped('sign_out');
    signOut.mutate(undefined, {
      onSuccess: () => {
        events.signedOut();
        router.replace(WELCOME_ROUTE);
      },
    });
  };

  const stats = [
    { n: savedCount, l: t('profile.stats.saved', 'Saved') },
    { n: seenCount, l: t('profile.stats.seen', 'Seen') },
    { n: swipeCount, l: t('profile.stats.swipes', 'Swipes') },
  ];

  return (
    <Screen scroll={true}>
      <AppHeader title={t('profile.title', 'Profile')} />

      {/* Anonymous banner — sign-up nudge for preview users */}
      {isPreviewUser && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>{t('profile.anonymousBanner.title')}</Text>
          <Text style={styles.bannerBody}>{t('profile.anonymousBanner.body')}</Text>
          <View style={styles.bannerActions}>
            <Button
              label={t('profile.anonymousBanner.signUp', 'Sign up free')}
              onPress={() => router.push('/(auth)/sign-up')}
              style={styles.bannerButton}
            />
            <Button
              label={t('profile.anonymousBanner.signIn', 'Sign in')}
              variant="secondary"
              onPress={() => router.push('/(auth)/sign-in')}
              style={styles.bannerButton}
            />
          </View>
        </View>
      )}

      {/* Profile header — tap to edit */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.row.editProfile', 'Edit profile')}
        onPress={() => openProfileRow('edit_profile', '/(app)/edit-profile')}
        style={styles.headerWrap}
      >
        <View style={styles.avatar}>
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.avatarInitial}>
              {signedIn ? display.displayName.charAt(0).toUpperCase() || 'F' : 'F'}
            </Text>
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.displayName} numberOfLines={1}>
            {display.displayName}
          </Text>
          <Text style={styles.handleText} numberOfLines={1}>
            {display.handleText}
          </Text>
        </View>
        <View style={styles.editPill}>
          <Pencil size={13} color={colors.accent} strokeWidth={2.2} />
          <Text style={styles.editPillText}>{t('profile.row.editProfile', 'Edit')}</Text>
        </View>
      </Pressable>

      {/* Stats card */}
      <View style={styles.statsCard}>
        {stats.map((stat, i) => (
          <View key={stat.l} style={[styles.statCell, i > 0 && styles.statCellDivider]}>
            <Text style={styles.statNumber}>{stat.n}</Text>
            <Text style={styles.statLabel}>{stat.l}</Text>
          </View>
        ))}
      </View>

      {/* Account section */}
      <SettingsGroup title={t('profile.section.account', 'Account')}>
        <SettingsRow
          label={t('profile.row.editProfile', 'Edit profile')}
          subtitle={t(
            'settingsPages.editProfile.subtitle',
            'Set the name, handle, and avatar shown inside Flixy.',
          )}
          onPress={() => openProfileRow('edit_profile', '/(app)/edit-profile')}
        />
        {(signedIn || isPreviewUser) && (
          <SettingsRow
            label={t('profile.row.email', 'Email')}
            value={session?.user?.email ?? t('settingsPages.account.noEmail', 'No email connected')}
            valueNumberOfLines={1}
          />
        )}
        {signedIn || isPreviewUser ? (
          <SettingsRow
            label={t('auth.signOut', 'Sign out')}
            value={signOut.isPending ? t('profile.row.signingOut', 'Signing out') : undefined}
            tone="danger"
            disabled={signOut.isPending}
            onPress={handleSignOut}
          />
        ) : (
          <>
            <SettingsRow
              label={t('profile.row.signUpFree', 'Sign up free')}
              onPress={() => openProfileRow('sign_up', '/(auth)/sign-up')}
            />
            <SettingsRow
              label={t('auth.signIn', 'Sign in')}
              onPress={() => openProfileRow('sign_in', '/(auth)/sign-in')}
            />
          </>
        )}
      </SettingsGroup>

      {/* Preferences — single entry to the unified Settings hub */}
      <SettingsGroup title={t('settings.preferences', 'Preferences')}>
        <SettingsRow
          testID="profile-settings-row"
          label={t('settings.title', 'Settings')}
          subtitle={t('settings.subtitle', 'Tune Flixy without leaving the cinema.')}
          leading={<SettingsIcon size={18} color={colors.accent} strokeWidth={2} />}
          onPress={() => openProfileRow('settings', '/(app)/settings')}
        />
      </SettingsGroup>

      <View style={{ height: 24 }} />
    </Screen>
  );
}

const styles = {
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(255,77,28,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,28,0.22)',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  bannerTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.text,
  },
  bannerBody: {
    fontSize: 12,
    color: 'rgba(245,245,240,0.45)',
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  bannerActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  bannerButton: {
    flex: 1,
  },
  headerWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,77,28,0.14)',
    borderWidth: 2,
    borderColor: 'rgba(255,77,28,0.35)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  avatarInitial: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: colors.accent,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  displayName: {
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    lineHeight: 23,
    color: colors.text,
  },
  handleText: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(245,245,240,0.45)',
    fontFamily: fonts.body,
  },
  editPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,77,28,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,28,0.28)',
  },
  editPillText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.accent,
  },
  statsCard: {
    marginHorizontal: 16,
    flexDirection: 'row' as const,
    backgroundColor: 'rgba(245,245,240,0.035)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  statCell: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  statCellDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  statNumber: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(245,245,240,0.5)',
    fontFamily: fonts.bodySemi,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.0,
    marginTop: 4,
  },
};
