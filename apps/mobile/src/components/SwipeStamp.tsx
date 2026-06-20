import type { ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { colors, fonts } from '../theme/tokens';

export type StampAlign = 'left' | 'right' | 'center-top' | 'center-bottom';

const POSITIONS: Record<StampAlign, ViewStyle> = {
  left: { top: 22, left: 18, transform: [{ rotate: '-12deg' }] },
  right: { top: 22, right: 18, transform: [{ rotate: '12deg' }] },
  'center-top': { top: 22, alignSelf: 'center', transform: [{ rotate: '-8deg' }] },
  'center-bottom': { top: 22, alignSelf: 'center', transform: [{ rotate: '8deg' }] },
};

const BG_COLORS: Record<StampAlign, string> = {
  left: 'rgba(61,214,140,0.1)',
  right: 'rgba(224,92,75,0.1)',
  'center-top': 'rgba(245,200,66,0.1)',
  'center-bottom': 'rgba(91,141,239,0.1)',
};

const TEXT_COLORS: Record<StampAlign, string> = {
  left: colors.right,
  right: colors.left,
  'center-top': colors.up,
  'center-bottom': colors.down,
};

/**
 * Decision stamp shown on top of a SwipeCard while the user drags.
 * Matches the HTML prototype exactly: 2.5px border, 7px radius,
 * 13px bold uppercase text with 0.1em tracking.
 */
export function SwipeStamp({
  text,
  align,
  animatedStyle,
}: {
  text: string;
  align: StampAlign;
  animatedStyle: AnimatedStyle<ViewStyle>;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderWidth: 2.5,
          borderColor: TEXT_COLORS[align],
          borderRadius: 7,
          backgroundColor: BG_COLORS[align],
        },
        POSITIONS[align],
        animatedStyle,
      ]}
    >
      <Animated.Text
        style={{
          color: TEXT_COLORS[align],
          fontFamily: fonts.bodyBold,
          fontSize: 13,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {text}
      </Animated.Text>
    </Animated.View>
  );
}

export const stampColors = {
  right: colors.right,
  left: colors.left,
  up: colors.up,
  down: colors.down,
};
