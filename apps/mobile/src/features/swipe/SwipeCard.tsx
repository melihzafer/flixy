import { LinearGradient } from 'expo-linear-gradient';
import { useCallback } from 'react';
import { Image, View } from 'react-native';
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

import { ServiceBadge } from '../../components/ServiceBadge';
import { SwipeStamp, stampColors } from '../../components/SwipeStamp';
import { Text } from '../../components/Text';
import { colors, fonts } from '../../theme/tokens';

/**
 * SwipeCard - gesture + Reanimated v3 implementation per FSD section 4.4.2.
 *
 * Animations run on the UI thread (worklet-only); haptics + the JS-side
 * `onCommit` callback fire via `runOnJS`. This is the path to the 60fps budget
 * (NFR-PERF-002).
 */

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

  const meta = [
    title.releaseYear,
    title.runtimeMinutes ? `${title.runtimeMinutes}m` : null,
    title.kind === 'tv' ? 'Series' : 'Movie',
  ]
    .filter(Boolean)
    .join('  \u00b7  ');

  const services = Array.from(new Set(title.availability.map((a) => a.serviceId))).slice(0, 4);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        accessibilityRole="adjustable"
        accessibilityLabel={`${title.title}. Swipe right to add, left to pass, up to top, down to mark seen.`}
        testID="swipe-card"
        style={[
          {
            position: 'absolute',
            width: cardWidth,
            height: cardHeight,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            zIndex,
          },
          cardStyle,
        ]}
      >
        {title.posterUrl ? (
          <Image source={{ uri: title.posterUrl }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.surface2 }} />
        )}

        <LinearGradient
          colors={[
            'transparent',
            'rgba(10,10,11,0.0)',
            'rgba(10,10,11,0.85)',
            'rgba(10,10,11,0.97)',
          ]}
          locations={[0, 0.45, 0.85, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }}
        />

        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 22,
            gap: 8,
          }}
        >
          {title.genres && title.genres.length > 0 ? (
            <Text variant="overline" tone="accent" style={{ textTransform: 'uppercase' }}>
              {title.genres[0]}
            </Text>
          ) : null}
          <Text
            style={{
              color: colors.text,
              fontFamily: fonts.display,
              fontSize: 28,
              lineHeight: 32,
              letterSpacing: -0.4,
            }}
            numberOfLines={2}
          >
            {title.title}
          </Text>
          <Text variant="body-s" tone="muted">
            {meta}
          </Text>
          {services.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              {services.map((s) => (
                <ServiceBadge key={s} serviceId={s} size="sm" />
              ))}
            </View>
          ) : null}
        </View>

        <SwipeStamp
          text="WATCHLIST"
          color={stampColors.right}
          align="left"
          animatedStyle={stampWatchlist}
        />
        <SwipeStamp text="PASS" color={stampColors.left} align="right" animatedStyle={stampPass} />
        <SwipeStamp text="TOP" color={stampColors.up} align="center-top" animatedStyle={stampTop} />
        <SwipeStamp
          text="SEEN"
          color={stampColors.down}
          align="center-bottom"
          animatedStyle={stampSeen}
        />
      </Animated.View>
    </GestureDetector>
  );
}
