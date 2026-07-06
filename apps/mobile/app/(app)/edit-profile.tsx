import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { HandleSchema } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { useSession } from '../../src/features/auth/useSession';
import {
  AvatarIcon,
  type AvatarId,
  PROFILE_AVATARS,
  isAvatarId,
} from '../../src/features/profile/avatars';
import { isHandleAvailable, useProfile, useUpdateProfile } from '../../src/features/profile/hooks';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';

export default function EditProfile() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: session } = useSession();
  const update = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [avatarId, setAvatarId] = useState<AvatarId | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [handleTaken, setHandleTaken] = useState(false);
  const [checkingHandle, setCheckingHandle] = useState(false);

  useEffect(() => {
    if (profile && !hydrated) {
      setDisplayName(profile.display_name ?? '');
      setHandle(profile.handle ?? '');
      setAvatarId(isAvatarId(profile.avatar_url) ? (profile.avatar_url as AvatarId) : null);
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const currentUserId = session?.user?.id ?? null;

  // Validate handle format locally (matches HandleSchema: 3–20, [a-z0-9_]).
  const trimmedHandle = handle.trim().toLowerCase();
  const handleFormatOk =
    trimmedHandle.length === 0 || HandleSchema.safeParse(trimmedHandle).success;
  const nameTrimmed = displayName.trim();
  const nameOk = nameTrimmed.length > 0 && nameTrimmed.length <= 80;

  // Check handle availability when it's format-valid, non-empty, and changed.
  useEffect(() => {
    if (!hydrated) return;
    if (trimmedHandle.length === 0) {
      setHandleTaken(false);
      return;
    }
    if (!handleFormatOk) {
      setHandleTaken(false);
      return;
    }
    if (trimmedHandle === (profile?.handle ?? '')) {
      setHandleTaken(false);
      return;
    }
    let cancelled = false;
    setCheckingHandle(true);
    void isHandleAvailable(trimmedHandle, currentUserId).then((available) => {
      if (cancelled) return;
      setHandleTaken(!available);
      setCheckingHandle(false);
    });
    return () => {
      cancelled = true;
    };
  }, [trimmedHandle, handleFormatOk, profile?.handle, currentUserId, hydrated]);

  const handleError = !handleFormatOk
    ? t(
        'settingsPages.editProfile.handleInvalid',
        'Use 3–20 lowercase letters, numbers, or underscores.',
      )
    : handleTaken
      ? t('settingsPages.editProfile.handleTaken', 'That handle is already taken.')
      : null;
  const nameError =
    hydrated && !nameOk
      ? t('settingsPages.editProfile.nameRequired', "Display name can't be empty.")
      : null;

  const initialAvatarId = isAvatarId(profile?.avatar_url)
    ? (profile?.avatar_url as AvatarId)
    : null;
  const nothingChanged =
    hydrated &&
    nameTrimmed === (profile?.display_name ?? '') &&
    trimmedHandle === (profile?.handle ?? '') &&
    avatarId === initialAvatarId;

  const canSave =
    hydrated && nameOk && handleFormatOk && !handleTaken && !checkingHandle && !nothingChanged;

  const save = () => {
    if (!canSave) return;
    update.mutate(
      {
        display_name: nameTrimmed || null,
        handle: trimmedHandle || null,
        avatar_url: avatarId,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <SettingsPage
      title={t('settingsPages.editProfile.title', 'Edit profile')}
      subtitle={t(
        'settingsPages.editProfile.subtitle',
        'Set the name, handle, and avatar shown inside Flixy.',
      )}
    >
      {/* Avatar picker — curated cinematic icon set.
          No photo upload: zero permissions, zero storage, instant load,
          deterministic across devices (Norman: visibility + affordance —
          the user sees all options at once and taps to select). */}
      <View style={styles.avatarSection}>
        <AvatarIcon
          avatarId={avatarId}
          size={88}
          fallbackInitial={nameTrimmed.charAt(0).toUpperCase()}
        />
        <Text style={styles.avatarHint}>
          {t('settingsPages.editProfile.avatarHint', 'Pick your cinema avatar')}
        </Text>
        <View style={styles.avatarGrid}>
          {PROFILE_AVATARS.map((avatar) => {
            const selected = avatarId === avatar.id;
            return (
              <Pressable
                key={avatar.id}
                accessibilityRole="button"
                accessibilityLabel={avatar.id}
                accessibilityState={{ selected }}
                hitSlop={4}
                onPress={() => setAvatarId(avatar.id)}
                style={[
                  styles.avatarCell,
                  {
                    backgroundColor: avatar.bg,
                    borderColor: selected ? avatar.color : avatar.border,
                    borderWidth: selected ? 2.5 : 1.5,
                  },
                ]}
              >
                <avatar.Icon size={24} color={avatar.color} strokeWidth={2.1} />
                {selected ? (
                  <View style={[styles.avatarCheck, { backgroundColor: avatar.color }]}>
                    <Check size={11} color={colors.bg} strokeWidth={3.2} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Input
        label={t('settingsPages.editProfile.displayName', 'Display name')}
        value={displayName}
        onChangeText={setDisplayName}
        error={nameError}
        accessibilityLabel={t('settingsPages.editProfile.displayName', 'Display name')}
      />
      <Input
        label={t('settingsPages.editProfile.handle', 'Handle')}
        value={handle}
        onChangeText={(value) => setHandle(value.toLowerCase())}
        autoCapitalize="none"
        autoCorrect={false}
        helperText={
          handleError
            ? null
            : t(
                'settingsPages.editProfile.handleHint',
                'Lowercase letters, numbers, and underscores.',
              )
        }
        error={handleError}
        accessibilityLabel={t('settingsPages.editProfile.handle', 'Handle')}
      />

      <Button
        label={t('settingsPages.editProfile.save', 'Save profile')}
        onPress={save}
        loading={update.isPending}
        disabled={!canSave}
      />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  avatarHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[2],
  },
  avatarCell: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
