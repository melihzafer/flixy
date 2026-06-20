import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useSession } from '../../src/features/auth/useSession';
import { useUpdatePreferences } from '../../src/features/onboarding/hooks';
import { track } from '../../src/lib/analytics';
import { logger } from '../../src/lib/logger';
import {
  requestPermissionOnly,
  requestPushPermissionAndRegister,
} from '../../src/lib/notifications';
import { colors, fonts } from '../../src/theme/tokens';

function Dots({ current, total }: { current: number; total: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 5,
        marginBottom: 28,
        paddingHorizontal: 20,
        paddingTop: 20,
      }}
    >
      {Array.from({ length: total }, (_, i) => `notifications-dot-${i}`).map((key, i) => (
        <View
          key={key}
          style={{
            height: 3,
            borderRadius: 2,
            flex: 1,
            backgroundColor:
              i < current
                ? colors.accent
                : i === current
                  ? 'rgba(255,77,28,0.5)'
                  : 'rgba(255,255,255,0.1)',
          }}
        />
      ))}
    </View>
  );
}

export default function NotificationsStep() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const update = useUpdatePreferences();
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);

  const finish = (enabled: boolean) => {
    update.mutate(
      {
        notifications_enabled: enabled,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onSuccess: () => router.replace('/(app)') },
    );
  };

  const onAllow = async () => {
    setBusy(true);
    try {
      const userId = session?.user?.id;
      if (userId) {
        const token = await requestPushPermissionAndRegister(userId);
        finish(!!token);
      } else {
        const granted = await requestPermissionOnly();
        finish(granted);
      }
    } catch (e) {
      logger.warn('notifications.request failed', { message: (e as Error).message });
      finish(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false}>
      <Dots current={4} total={5} />

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          gap: 14,
        }}
      >
        <View
          style={{
            width: 82,
            height: 82,
            borderRadius: 26,
            backgroundColor: colors.accentDim,
            borderWidth: 1,
            borderColor: colors.accentBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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
            F
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fonts.display,
            fontSize: 28,
            color: colors.text,
            textAlign: 'center',
            lineHeight: 34,
            maxWidth: 320,
            paddingHorizontal: 8,
            flexShrink: 0,
          }}
        >
          {t('onboarding.notificationsTitle')}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: 'rgba(245,245,240,0.45)',
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 280,
            fontFamily: fonts.body,
          }}
        >
          We'll let you know when titles leave your services, or when something new lands that
          you'll love.
        </Text>
      </View>

      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 0,
          gap: 10,
        }}
      >
        <Pressable
          onPress={onAllow}
          style={{
            width: '100%',
            height: 54,
            backgroundColor: colors.accent,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy || update.isPending ? 0.7 : 1,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bodySemi,
              fontSize: 16,
              color: colors.onAccent,
            }}
          >
            Enable notifications
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Maybe later"
          hitSlop={8}
          onPress={() => {
            track('onboarding_notifications_dismissed');
            finish(false);
          }}
          style={{
            width: '100%',
            minHeight: 44,
            paddingVertical: 16,
            marginBottom: insets.bottom + 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 14,
              color: 'rgba(245,245,240,0.6)',
            }}
          >
            Maybe later
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
