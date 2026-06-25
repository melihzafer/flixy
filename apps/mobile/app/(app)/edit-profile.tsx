import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { HandleSchema } from '@flixy/shared';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { useSession } from '../../src/features/auth/useSession';
import {
  isHandleAvailable,
  uploadLocalAvatar,
  useProfile,
  useUpdateProfile,
} from '../../src/features/profile/hooks';
import { colors, fonts } from '../../src/theme/tokens';

export default function EditProfile() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: session } = useSession();
  const update = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [handleTaken, setHandleTaken] = useState(false);
  const [checkingHandle, setCheckingHandle] = useState(false);

  // Sync local form state once the profile loads (and only then, so the user
  // typing isn't clobbered by a re-render).
  useEffect(() => {
    if (profile && !hydrated) {
      setDisplayName(profile.display_name ?? '');
      setHandle(profile.handle ?? '');
      setAvatarUrl(profile.avatar_url ?? null);
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

  const nothingChanged =
    hydrated &&
    nameTrimmed === (profile?.display_name ?? '') &&
    trimmedHandle === (profile?.handle ?? '') &&
    avatarUrl === (profile?.avatar_url ?? null);

  const canSave =
    hydrated && nameOk && handleFormatOk && !handleTaken && !checkingHandle && !nothingChanged;

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('settingsPages.editProfile.permissionTitle', 'Permission required'),
          t(
            'settingsPages.editProfile.permissionBody',
            'Permission to access your photos is required to update your avatar.',
          ),
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const sourceUri = result.assets[0].uri;
        if (profile?.id) {
          const localPath = await uploadLocalAvatar(profile.id, sourceUri);
          setAvatarUrl(localPath);
        }
      }
    } catch {
      Alert.alert(
        t('settingsPages.editProfile.errorTitle', 'Something went wrong'),
        t(
          'settingsPages.editProfile.errorBody',
          'Failed to pick or process the image. Please try again.',
        ),
      );
    }
  };

  const save = () => {
    if (!canSave) return;
    update.mutate(
      {
        display_name: nameTrimmed || null,
        handle: trimmedHandle || null,
        avatar_url: avatarUrl,
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
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settingsPages.editProfile.changeAvatar', 'Change avatar image')}
          onPress={pickImage}
          style={({ pressed }) => ({
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: colors.accentDim,
            borderWidth: 1,
            borderColor: colors.accentBorder,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: fonts.display,
                fontSize: 38,
                lineHeight: 44,
                color: colors.accent,
                textAlign: 'center',
                includeFontPadding: false,
                textAlignVertical: 'center',
              }}
            >
              {nameTrimmed ? nameTrimmed.charAt(0).toUpperCase() : 'F'}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settingsPages.editProfile.changePhoto', 'Change photo')}
          onPress={pickImage}
          style={{ marginTop: 10, paddingVertical: 4, paddingHorizontal: 8 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: fonts.bodySemi,
              color: colors.accent,
            }}
          >
            {t('settingsPages.editProfile.changePhoto', 'Change photo')}
          </Text>
        </Pressable>
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
