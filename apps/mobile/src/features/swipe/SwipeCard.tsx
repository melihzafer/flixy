import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Info, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useDeckFilters } from '../../features/deck/filterStore';

import type { SwipeDirection, Title } from '@flixy/shared';

import { Text } from '../../components/Text';
import { toTitleDisplay } from '../../features/catalogue/display';
import { colors, fonts } from '../../theme/tokens';

const HORIZONTAL_THRESHOLD_RATIO = 0.35;
const VERTICAL_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 1100;
const SWIPE_OUT_DISTANCE_X = 600;
const SWIPE_OUT_DISTANCE_Y = 800;
/** Drag distance before the gesture hard-locks to one axis (no diagonals). */
const AXIS_LOCK_DISTANCE = 14;

export type SwipeCardProps = {
  title: Title;
  cardWidth: number;
  cardHeight: number;
  onCommit: (dir: SwipeDirection) => void;
  onTap?: () => void;
  zIndex?: number;
  disabled?: boolean;
  /**
   * Enable upward swipes. The deck keeps up locked (Top Pick is button-only),
   * but watchlist triage maps swipe-up to Remove and needs the gesture.
   */
  allowUp?: boolean;
  /** Override the full-card overlay label per direction (triage semantics differ from the deck's). */
  overlayLabels?: Partial<Record<SwipeDirection, string>>;
  /** A short, user-facing explanation derived from the composer trace. */
  recommendationReason?: string;
};

export function SwipeCard({
  title,
  cardWidth,
  cardHeight,
  onCommit,
  onTap,
  zIndex = 0,
  disabled = false,
  allowUp = false,
  overlayLabels,
  recommendationReason,
}: SwipeCardProps) {
  const { t } = useTranslation();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const isCommitting = useSharedValue(false);
  // 0 = undecided, 1 = horizontal, 2 = vertical. Once a drag exceeds
  // AXIS_LOCK_DISTANCE it commits to a single axis for the rest of the
  // gesture so the card can never travel diagonally.
  const axis = useSharedValue(0);

  const blindDate = useDeckFilters((s) => s.blindDate);
  const [revealed, setRevealed] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset revealed state when active card changes
  useEffect(() => {
    setRevealed(false);
  }, [title.id]);

  const display = useMemo(() => toTitleDisplay(title), [title]);
  const isSeries = display.kind === 'tv';
  const typeLabel = isSeries ? t('detail.series', 'Series') : t('detail.movie', 'Movie');
  const seasonsLabel =
    isSeries && display.numberOfSeasons
      ? t('detail.seasons', '{{count}} seasons', { count: display.numberOfSeasons })
      : null;

  const horizontalThreshold = cardWidth * HORIZONTAL_THRESHOLD_RATIO;

  const commit = useCallback((dir: SwipeDirection) => onCommit(dir), [onCommit]);
  const handleTap = useCallback(() => {
    if (blindDate && !revealed) {
      setRevealed(true);
    } else {
      onTap?.();
    }
  }, [blindDate, revealed, onTap]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      axis.value = 0;
    })
    .onUpdate((e) => {
      if (axis.value === 0) {
        const absX = Math.abs(e.translationX);
        const absY = Math.abs(e.translationY);
        if (Math.max(absX, absY) >= AXIS_LOCK_DISTANCE) {
          axis.value = absX >= absY ? 1 : 2;
        }
      }
      // Hard axis lock: the non-dominant axis stays at 0 so the card can
      // never drift diagonally. Upward travel is clamped unless the screen
      // opted in (triage's swipe-up-to-remove).
      if (axis.value === 1) {
        tx.value = e.translationX;
        ty.value = 0;
      } else if (axis.value === 2) {
        tx.value = 0;
        ty.value = allowUp ? e.translationY : Math.max(0, e.translationY);
      } else {
        tx.value = e.translationX;
        ty.value = allowUp ? e.translationY : Math.max(0, e.translationY);
      }
    })
    .onEnd((e) => {
      if (isCommitting.value) {
        // A previous commit's fly-out is still running; snap back to rest so
        // a stray second flick can't double-commit the same card.
        tx.value = withSpring(0, { damping: 18, stiffness: 220 });
        ty.value = withSpring(0, { damping: 18, stiffness: 220 });
        return;
      }
      const lockedAxis = axis.value;
      axis.value = 0;
      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);
      const horizontalWins = lockedAxis === 1 || (lockedAxis === 0 && absX >= absY);

      let direction: SwipeDirection | null = null;
      if (horizontalWins) {
        if (e.translationX > horizontalThreshold || e.velocityX > VELOCITY_THRESHOLD) {
          direction = 'right';
        } else if (e.translationX < -horizontalThreshold || e.velocityX < -VELOCITY_THRESHOLD) {
          direction = 'left';
        }
      } else {
        if (e.translationY > VERTICAL_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
          direction = 'down';
        } else if (
          allowUp &&
          (e.translationY < -VERTICAL_THRESHOLD || e.velocityY < -VELOCITY_THRESHOLD)
        ) {
          direction = 'up';
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
          direction === 'down'
            ? SWIPE_OUT_DISTANCE_Y
            : direction === 'up'
              ? -SWIPE_OUT_DISTANCE_Y
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

  const overlayWatchlist = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, horizontalThreshold], [0, 0.85], 'clamp'),
  }));
  const overlayPass = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-horizontalThreshold, 0], [0.85, 0], 'clamp'),
  }));
  const overlaySeen = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [0, VERTICAL_THRESHOLD], [0, 0.85], 'clamp'),
  }));
  const overlayUp = useAnimatedStyle(() => ({
    opacity: allowUp ? interpolate(ty.value, [-VERTICAL_THRESHOLD, 0], [0.85, 0], 'clamp') : 0,
  }));

  const meta = [display.year, seasonsLabel ?? display.runtime, display.rating]
    .filter(Boolean)
    .join('  \u00b7  ');

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        accessibilityRole="adjustable"
        accessibilityLabel={`${display.title}. Swipe right to add, left to pass, down to mark watched.`}
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
          <>
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
            {blindDate && !revealed && (
              <BlurView
                intensity={80}
                tint="dark"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 2,
                }}
              />
            )}
          </>
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
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '42%',
            backgroundColor: 'rgba(255,77,28,0.035)',
          }}
        />

        {recommendationReason && !blindDate ? (
          <View
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              maxWidth: '72%',
              minHeight: 30,
              paddingHorizontal: 9,
              borderRadius: 999,
              backgroundColor: 'rgba(10,10,11,0.58)',
              borderWidth: 1,
              borderColor: 'rgba(255,77,28,0.28)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              zIndex: 5,
            }}
          >
            <Sparkles size={12} color={colors.accent} strokeWidth={2.2} />
            <Text
              numberOfLines={1}
              style={{
                color: 'rgba(245,245,240,0.82)',
                fontFamily: fonts.bodySemi,
                fontSize: 10,
              }}
            >
              {recommendationReason}
            </Text>
          </View>
        ) : null}

        {/* Info button */}
        {!disabled && (
          <View
            style={{
              pointerEvents: 'none',
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
            {blindDate && !revealed ? t('deck.blindDateHook', 'TAP TO REVEAL') : display.hook}
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
            {blindDate && !revealed ? t('deck.blindDateTitle', 'Mystery Pick') : display.title}
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
            <View
              style={{
                height: 22,
                paddingHorizontal: 8,
                borderRadius: 7,
                backgroundColor: 'rgba(255,77,28,0.16)',
                borderWidth: 1,
                borderColor: 'rgba(255,77,28,0.32)',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontFamily: fonts.bodyBold,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  color: 'rgba(255,150,120,0.95)',
                }}
              >
                {typeLabel}
              </Text>
            </View>
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

        {/* Tinder-style full-card colored overlays */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(61,214,140,0.85)', // Tinder green
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            },
            overlayWatchlist,
          ]}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: fonts.display,
              fontSize: 38,
              letterSpacing: 2,
              textTransform: 'uppercase',
              transform: [{ rotate: '-10deg' }],
              borderWidth: 4,
              borderColor: '#FFFFFF',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            {overlayLabels?.right ?? 'Watchlist'}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(224,92,75,0.85)', // Tinder red
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            },
            overlayPass,
          ]}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: fonts.display,
              fontSize: 38,
              letterSpacing: 2,
              textTransform: 'uppercase',
              transform: [{ rotate: '10deg' }],
              borderWidth: 4,
              borderColor: '#FFFFFF',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            {overlayLabels?.left ?? 'Passed'}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(91,141,239,0.85)', // Tinder blue
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            },
            overlaySeen,
          ]}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: fonts.display,
              fontSize: 38,
              letterSpacing: 2,
              textTransform: 'uppercase',
              transform: [{ rotate: '-5deg' }],
              borderWidth: 4,
              borderColor: '#FFFFFF',
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            {overlayLabels?.down ?? 'Watched'}
          </Text>
        </Animated.View>

        {allowUp ? (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(224,92,75,0.85)',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
              },
              overlayUp,
            ]}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: fonts.display,
                fontSize: 38,
                letterSpacing: 2,
                textTransform: 'uppercase',
                transform: [{ rotate: '5deg' }],
                borderWidth: 4,
                borderColor: '#FFFFFF',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 12,
              }}
            >
              {overlayLabels?.up ?? 'Top Pick'}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
