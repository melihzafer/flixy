import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { events } from '../features/telemetry/events';
import { colors, fonts } from '../theme/tokens';
import { Text } from './Text';

export function SaveNudge({
  visible,
  watchlistCount,
  onDismiss,
}: {
  visible: boolean;
  watchlistCount: number;
  onDismiss: () => void;
}) {
  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { display: visible ? 'flex' : 'none', pointerEvents: visible ? 'box-none' : 'none' },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
          backgroundColor: '#111113',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,77,28,0.24)',
          padding: 16,
          shadowColor: colors.accent,
          shadowOpacity: 0.14,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
        }}
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 22,
            color: colors.accent,
            marginBottom: 4,
          }}
        >
          Flixy
        </Text>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 18,
            color: colors.text,
            marginBottom: 4,
          }}
        >
          Keep your watchlist?
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: 'rgba(245,245,240,0.45)',
            lineHeight: 20,
            marginBottom: 14,
            fontFamily: fonts.body,
          }}
        >
          Create a free account so the titles you save stay with you on your next device.
        </Text>

        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: 12,
            paddingHorizontal: 14,
            marginBottom: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontFamily: fonts.bodyBold,
              color: colors.accent,
            }}
          >
            {watchlistCount}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: 'rgba(245,245,240,0.5)',
              lineHeight: 18,
            }}
          >
            swipes shaped tonight's taste profile{'\n'}
            <Text style={{ color: colors.accent }}>Save the list you started</Text>
          </Text>
        </View>

        <Pressable
          onPress={() => {
            events.anonymousUpgradeCompleted('deck');
            onDismiss();
            router.push('/(auth)/sign-up');
          }}
          style={{
            width: '100%',
            height: 50,
            backgroundColor: colors.accent,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bodySemi,
              fontSize: 15,
              color: colors.text,
            }}
          >
            Create free account
          </Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={{ width: '100%', height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 13,
              color: 'rgba(245,245,240,0.42)',
            }}
          >
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
