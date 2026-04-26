import { useCallback } from 'react';
import { Image, Text, View } from 'react-native';
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

/**
 * SwipeCard — gesture + Reanimated v3 implementation per FSD section 4.4.2.
 *
 * Animations run on the UI thread (worklet-only); haptics + the JS-side
 * `onCommit` callback fire via `runOnJS`. This is the path to the 60fps budget
 * (NFR-PERF-002).
 */

const HORIZONTAL_THRESHOLD_RATIO = 0.35; // 35% of card width
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

  // Decision-stamp styles (FSD 4.4.1): high-opacity once past threshold.
  // Four explicit hook calls (no factory) to satisfy rules-of-hooks.
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

  const meta = [
    title.releaseYear,
    title.runtimeMinutes ? `${title.runtimeMinutes}m` : null,
    title.kind === 'tv' ? 'Series' : 'Movie',
  ]
    .filter(Boolean)
    .join('  •  ');

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        accessibilityRole="adjustable"
        accessibilityLabel={`${title.title}. Swipe right to add, left to pass, up to top, down to mark seen.`}
        style={[
          {
            position: 'absolute',
            width: cardWidth,
            height: cardHeight,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: '#111',
            zIndex,
          },
          cardStyle,
        ]}
      >
        {title.posterUrl ? (
          <Image source={{ uri: title.posterUrl }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#222' }} />
        )}

        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 20,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }} numberOfLines={2}>
            {title.title}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{meta}</Text>
          {title.availability.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 }}>
              {Array.from(new Set(title.availability.map((a) => a.serviceId)))
                .slice(0, 4)
                .map((serviceId) => (
                  <View
                    key={serviceId}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>
                      {serviceId.toUpperCase()}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}
        </View>

        <DecisionStamp
          animatedStyle={stampWatchlist}
          text="WATCHLIST"
          color="#3ddc84"
          align="left"
        />
        <DecisionStamp animatedStyle={stampPass} text="PASS" color="#ff5252" align="right" />
        <DecisionStamp animatedStyle={stampTop} text="TOP" color="#ffd166" align="center-top" />
        <DecisionStamp
          animatedStyle={stampSeen}
          text="SEEN"
          color="#4dabf7"
          align="center-bottom"
        />
      </Animated.View>
    </GestureDetector>
  );
}

type StampAlign = 'left' | 'right' | 'center-top' | 'center-bottom';

function DecisionStamp({
  animatedStyle,
  text,
  color,
  align,
}: {
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  text: string;
  color: string;
  align: StampAlign;
}) {
  const positional =
    align === 'left'
      ? { top: 32, left: 24, transform: [{ rotate: '-12deg' }] }
      : align === 'right'
        ? { top: 32, right: 24, transform: [{ rotate: '12deg' }] }
        : align === 'center-top'
          ? { top: 32, alignSelf: 'center' as const }
          : { bottom: 100, alignSelf: 'center' as const };
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderWidth: 4,
          borderColor: color,
          borderRadius: 8,
        },
        positional,
        animatedStyle,
      ]}
    >
      <Text style={{ color, fontSize: 32, fontWeight: '900', letterSpacing: 2 }}>{text}</Text>
    </Animated.View>
  );
}
