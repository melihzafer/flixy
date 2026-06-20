import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { colors, fonts } from '../../src/theme/tokens';

export default function OnboardingWelcome() {
  return (
    <Screen scroll={false}>
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
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 170,
            height: 230,
            borderRadius: 34,
            backgroundColor: 'rgba(255,77,28,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,77,28,0.18)',
            transform: [{ rotate: '-7deg' }, { translateY: -18 }],
          }}
        />
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 74,
            color: colors.accent,
            lineHeight: 78,
            letterSpacing: -1.1,
            paddingHorizontal: 16,
          }}
        >
          Flixy
        </Text>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 24,
            color: colors.text,
            textAlign: 'center',
            lineHeight: 28,
          }}
        >
          Stop browsing.{'\n'}Start watching.
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
          Swipe through films and shows. Right to save, left to skip. Your watchlist builds itself.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        <Pressable
          onPress={() => router.push('/(onboarding)/region')}
          style={{
            width: '100%',
            height: 54,
            backgroundColor: colors.accent,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bodySemi,
              fontSize: 16,
              color: colors.onAccent,
            }}
          >
            Get started
          </Text>
          <ArrowRight size={18} color={colors.onAccent} strokeWidth={2.4} />
        </Pressable>
      </View>
    </Screen>
  );
}
