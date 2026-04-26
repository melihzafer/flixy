import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Chip, ChipGroup } from '../../src/components/Chip';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { SectionLabel } from '../../src/components/SectionLabel';
import { Text } from '../../src/components/Text';
import { useSession } from '../../src/features/auth/useSession';
import { uploadAvatar, useProfile, useUpdateProfile } from '../../src/features/profile/hooks';
import { logger } from '../../src/lib/logger';
import { colors, fonts } from '../../src/theme/tokens';

const REGIONS = ['US', 'TR', 'BG', 'ES', 'DE', 'FR', 'BR'] as const;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [region, setRegion] = useState<string>('US');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setHandle(profile.handle ?? '');
    setDisplayName(profile.display_name ?? '');
    setRegion(profile.region);
  }, [profile]);

  const onSave = () => {
    update.mutate({
      handle: handle.trim() ? handle.trim().toLowerCase() : null,
      display_name: displayName.trim() || null,
      region,
    });
  };

  const onPickAvatar = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('profile.permissionDenied'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    if (!asset.base64) return;

    setUploading(true);
    try {
      const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
      const bytes = base64ToArrayBuffer(asset.base64);
      const url = await uploadAvatar({
        userId,
        bytes,
        contentType: asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        ext: ext === 'jpg' ? 'jpeg' : ext,
      });
      update.mutate({ avatar_url: url });
    } catch (e) {
      logger.warn('avatar.upload failed', { message: (e as Error).message });
      Alert.alert(t('profile.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Screen title={t('profile.title')}>
        <Text tone="muted">{t('common.loading')}</Text>
      </Screen>
    );
  }

  return (
    <Screen title={t('profile.title')} subtitle={t('profile.subtitle')}>
      <View style={{ alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Pressable
          onPress={onPickAvatar}
          accessibilityLabel={t('profile.avatarLabel')}
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: colors.surface2,
            borderWidth: 2,
            borderColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.accent, fontFamily: fonts.display, fontSize: 36 }}>
            {(profile?.display_name ?? profile?.handle ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </Pressable>
        <Button
          label={t('profile.changeAvatar')}
          variant="ghost"
          loading={uploading}
          fullWidth={false}
          onPress={onPickAvatar}
        />
      </View>

      <Input
        label={t('profile.handle')}
        value={handle}
        onChangeText={setHandle}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="yourname"
      />
      <Input
        label={t('profile.displayName')}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder={t('profile.displayNamePlaceholder')}
      />

      <SectionLabel>{t('profile.region')}</SectionLabel>
      <ChipGroup>
        {REGIONS.map((r) => (
          <Chip key={r} label={r} selected={r === region} onPress={() => setRegion(r)} />
        ))}
      </ChipGroup>

      <View style={{ marginTop: 16, gap: 10 }}>
        <Button label={t('common.save')} loading={update.isPending} onPress={onSave} />
        <Button
          label={t('settings.title')}
          variant="secondary"
          onPress={() => router.push('/(app)/settings')}
        />
      </View>
    </Screen>
  );
}
