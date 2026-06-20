import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Clapperboard, Heart, Search, UserRound } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '../../src/lib/analytics';
import { colors, fonts } from '../../src/theme/tokens';

const TABS = [
  { name: 'deck', Icon: Clapperboard, label: 'Discover' },
  { name: 'watchlist', Icon: Heart, label: 'Watchlist' },
  { name: 'search', Icon: Search, label: 'Search' },
  { name: 'profile', Icon: UserRound, label: 'Profile' },
];

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: 'rgba(10,10,11,0.97)',
        borderTopColor: 'rgba(255,77,28,0.12)',
        borderTopWidth: 1,
        minHeight: 60 + insets.bottom,
        paddingTop: 10,
        paddingBottom: Math.max(10, insets.bottom),
        paddingLeft: insets.left + 12,
        paddingRight: insets.right + 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        overflow: 'visible',
        shadowColor: colors.accent,
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: -6 },
      }}
    >
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => route.name === t.name);
        if (!tab) return null;

        const isFocused = state.index === index;
        const descriptor = descriptors[route.key];
        const options = descriptor?.options ?? {};
        const Icon = tab.Icon;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          track('tab_pressed', { tab: route.name });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={
              (options.tabBarAccessibilityLabel as string | undefined) ?? tab.label
            }
            testID={`${route.name}-button`}
            style={({ pressed }) => ({
              transform: [{ translateY: pressed ? 1 : 0 }],
            })}
          >
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                minHeight: 48,
                minWidth: 56,
                overflow: 'visible',
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 30,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isFocused ? 'rgba(255,77,28,0.14)' : 'transparent',
                  borderWidth: 1,
                  borderColor: isFocused ? 'rgba(255,77,28,0.28)' : 'transparent',
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={2.1}
                  color={isFocused ? colors.accent : colors.textMuted}
                />
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 10,
                  letterSpacing: 0.4,
                  lineHeight: 13,
                  textAlign: 'center',
                  flexShrink: 1,
                  minWidth: 0,
                  color: isFocused ? colors.accent : colors.textMuted,
                }}
              >
                {tab.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
