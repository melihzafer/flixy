import type { ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { colors, fonts } from '../theme/tokens';

export type StampAlign = 'left' | 'right' | 'center-top' | 'center-bottom';

const POSITIONS: Record<StampAlign, ViewStyle> = {
  left: { top: 22, left: 22, transform: [{ rotate: '-12deg' }] },
  right: { top: 22, right: 22, transform: [{ rotate: '12deg' }] },
  'center-top': { top: 22, alignSelf: 'center' },
  'center-bottom': { bottom: 110, alignSelf: 'center' },
};

/**
 * Decision stamp shown on top of a SwipeCard while the user drags.
 * 2.5px border + tight rotation matches the prototype.
 */
export function SwipeStamp({
  text,
  color,
  align,
  animatedStyle,
}: {
  text: string;
  color: string;
  align: StampAlign;
  animatedStyle: AnimatedStyle<ViewStyle>;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderWidth: 2.5,
          borderColor: color,
          borderRadius: 10,
          backgroundColor: 'rgba(0,0,0,0.35)',
        },
        POSITIONS[align],
        animatedStyle,
      ]}
    >
      <Animated.Text
        style={{
          color,
          fontFamily: fonts.bodyBold,
          fontSize: 28,
          letterSpacing: 2,
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 12,
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
