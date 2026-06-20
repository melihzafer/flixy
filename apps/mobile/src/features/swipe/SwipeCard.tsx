import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Info } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { SwipeDirection, Title } from '@flixy/shared';

import { SwipeStamp } from '../../components/SwipeStamp';
import { Text } from '../../components/Text';
import { toTitleDisplay } from '../../features/catalogue/display';
import { colors, fonts } from '../../theme/tokens';

const HORIZONTAL_THRESHOLD_RATIO = 0.35;
const VERTICAL_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 1100;
const SWIPE_OUT_DISTANCE_X = 600;
const SWIPE_OUT_DISTANCE_Y = 800;

export type SwipeCardProps = {
  title: Title;
  cardWidth: number;
  cardHeight: number;
  onCommit: (dir: SwipeDirection) => void;
  onTap?: () => void;
  zIndex?: number;
  disabled?: boolean;
};

export function SwipeCard({
  title,
  cardWidth,
  cardHeight,
  onCommit,
  onTap,
  zIndex = 0,
  disabled = false,
}: SwipeCardProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const isCommitting = useSharedValue(false);

  const display = useMemo(() => toTitleDisplay(title), [title]);

  const horizontalThreshold = cardWidth * HORIZONTAL_THRESHOLD_RATIO;

  const commit = useCallback((dir: SwipeDirection) => onCommit(dir), [onCommit]);
  const handleTap = useCallback(() => onTap?.(), [onTap]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);
      const horizontalWins = absX >= absY;

      let direction: SwipeDirection | null = null;
      if (horizontalWins) {
        if (e.translationX > horizontalThreshold || e.velocityX > VELOCITY_THRESHOLD) {
          direction = 'right';
        } else if (e.translationX < -horizontalThreshold || e.velocityX < -VELOCITY_THRESHOLD) {
          direction = 'left';
        }
      } else {
        if (e.translationY < -VERTICAL_THRESHOLD || e.velocityY < -VELOCITY_THRESHOLD) {
          direction = 'up';
        } else if (e.translationY > VERTICAL_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
          direction = 'down';
        }
      }

      if (direction) {
        isCommitting.value = true;
        const tox =
          direction === 'right'
            ? SWIPE_OUT_DISTANCE_X
            : direction === 'left'
              ? -SWIPE_OUT_DISTANCE_X
              : 0;
        const toy =
          direction === 'up'
            ? -SWIPE_OUT_DISTANCE_Y
            : direction === 'down'
              ? SWIPE_OUT_DISTANCE_Y
              : 0;
        tx.value = withTiming(tox, { duration: 280 });
        ty.value = withTiming(toy, { duration: 280 }, (finished) => {
          if (finished) runOnJS(commit)(direction);
        });
      } else {
        tx.value = withSpring(0, { damping: 18, stiffness: 220 });
        ty.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      if (onTap) runOnJS(handleTap)();
    });

  const composed = Gesture.Exclusive(pan, tap);

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(tx.value, [-cardWidth, 0, cardWidth], [-12, 0, 12]);
    return {
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${rotate}deg` }],
    };
  });

  const stampWatchlist = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, horizontalThreshold], [0, 1], 'clamp'),
  }));
  const stampPass = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-horizontalThreshold, 0], [1, 0], 'clamp'),
  }));
  const stampTop = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [-VERTICAL_THRESHOLD, 0], [1, 0], 'clamp'),
  }));
  const stampSeen = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [0, VERTICAL_THRESHOLD], [0, 1], 'clamp'),
  }));

  const meta = [display.year, display.runtime, display.rating].filter(Boolean).join('  \u00b7  ');

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        accessibilityRole="adjustable"
        accessibilityLabel={`${display.title}. Swipe right to add, left to pass, up to top, down to mark seen.`}
        testID="swipe-card"
        style={[
          {
            position: 'absolute',
            width: cardWidth,
            height: cardHeight,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: 'rgba(255,77,28,0.18)',
            shadowColor: colors.accent,
            shadowOpacity: 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 14 },
            elevation: 10,
            zIndex,
          },
          cardStyle,
        ]}
      >
        <LinearGradient
          colors={display.gradient as unknown as readonly [string, string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {display.posterUrl ? (
          <Image
            source={{ uri: display.posterUrl }}
            contentFit="cover"
            transition={180}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.9,
            }}
          />
        ) : null}

        <LinearGradient
          colors={[
            'rgba(10,10,11,0.01)',
            'rgba(10,10,11,0.1)',
            'rgba(10,10,11,0.68)',
            'rgba(10,10,11,0.98)',
          ]}
          locations={[0, 0.34, 0.66, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '42%',
            backgroundColor: 'rgba(255,77,28,0.035)',
          }}
        />

        {/* Info button */}
        {!disabled && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: 'rgba(10,10,11,0.48)',
              borderWidth: 1,
              borderColor: 'rgba(245,245,240,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
            }}
          >
            <Info size={16} color={colors.text} strokeWidth={2.1} />
          </View>
        )}

        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 21,
            gap: 5,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontFamily: fonts.bodySemi,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: 'rgba(255,120,77,0.78)',
            }}
          >
            {display.hook}
          </Text>

          <Text
            style={{
              color: colors.text,
              fontFamily: fonts.display,
              fontSize: 31,
              lineHeight: 32,
              letterSpacing: -0.7,
            }}
            numberOfLines={2}
          >
            {display.title}
          </Text>

          <Text
            style={{
              fontSize: 11,
              color: 'rgba(245,245,240,0.62)',
              fontFamily: fonts.body,
              marginBottom: 5,
            }}
          >
            {meta}
          </Text>

          <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
            {display.services.slice(0, 2).map((s) => (
              <View
                key={s}
                style={{
                  height: 22,
                  paddingHorizontal: 8,
                  borderRadius: 7,
                  backgroundColor: 'rgba(10,10,11,0.54)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,77,28,0.18)',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: fonts.bodyBold,
                    letterSpacing: 0.3,
                    color: 'rgba(245,245,240,0.85)',
                  }}
                >
                  {s}
                </Text>
              </View>
            ))}
            {display.genres.slice(0, 1).map((g) => (
              <View
                key={g}
                style={{
                  height: 22,
                  paddingHorizontal: 8,
                  borderRadius: 5,
                  backgroundColor: 'rgba(10,10,11,0.45)',
                  borderWidth: 1,
                  borderColor: 'rgba(245,245,240,0.1)',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: fonts.bodyBold,
                    letterSpacing: 0.3,
                    color: 'rgba(245,245,240,0.45)',
                  }}
                >
                  {g}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <SwipeStamp text="Watchlist" align="left" animatedStyle={stampWatchlist} />
        <SwipeStamp text="Pass" align="right" animatedStyle={stampPass} />
        <SwipeStamp text="Top Pick" align="center-top" animatedStyle={stampTop} />
        <SwipeStamp text="Seen" align="center-bottom" animatedStyle={stampSeen} />
      </Animated.View>
    </GestureDetector>
  );
}
