import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SwipeDirection, Title } from '@flixy/shared';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { SwipeCard } from '../../src/features/swipe/SwipeCard';
import {
  useMarkWatched,
  useRemoveFromWatchlist,
  useSetPriority,
  useWatchlist,
} from '../../src/features/watchlist/hooks';
import { colors, fonts } from '../../src/theme/tokens';

export default function WatchlistTriageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const cardWidth = width - 36;
  const isCompactWidth = width < 380;
  const cardHeight = Math.min(height * (isCompactWidth ? 0.54 : 0.58), 540);

  const { entries, isLoading, isError, refetch } = useWatchlist('all');
  const markWatched = useMarkWatched();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const setPriority = useSetPriority();

  // Active backlog consists of watchlist items that are NOT watched yet
  const triageCandidates = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e): e is typeof e & { title: Title } => !!e.title && !e.item.watchedAt);
  }, [entries]);

  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const swipedSet = useMemo(() => new Set(swipedIds), [swipedIds]);

  const remaining = useMemo(
    () => triageCandidates.filter((entry) => !swipedSet.has(entry.title.id)),
    [triageCandidates, swipedSet],
  );

  const visible = useMemo(() => remaining.slice(0, 3), [remaining]);

  const handleCommit = useCallback(
    async (dir: SwipeDirection) => {
      const activeEntry = remaining[0];
      if (!activeEntry) return;

      const titleId = activeEntry.title.id;
      const id = activeEntry.item.id;

      // Swipe Direction mapping:
      // - Right: High Priority (top)
      // - Left: Normal/Keep (normal)
      // - Down: Marked Watched
      // - Up: Remove
      try {
        if (dir === 'right') {
          await setPriority.mutateAsync({ id, titleId, priority: 'top' });
        } else if (dir === 'left') {
          await setPriority.mutateAsync({ id, titleId, priority: 'normal' });
        } else if (dir === 'down') {
          await markWatched.mutateAsync({ id, titleId });
        } else if (dir === 'up') {
          await removeFromWatchlist.mutateAsync({ id, titleId });
        }
      } catch (_e) {
        // error logged by hooks
      }

      setSwipedIds((prev) => [...prev, titleId]);
    },
    [remaining, setPriority, markWatched, removeFromWatchlist],
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)/watchlist');
    }
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Text tone="muted">{t('common.loading', 'Loading…')}</Text>
        <Text tone="dim" style={{ fontSize: 12 }}>
          {t('watchlist.triageLoading', 'Loading backlog items…')}
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <Screen scroll={false}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 12,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 24,
              color: colors.text,
              textAlign: 'center',
            }}
          >
            {t('watchlist.errorTitle', "Couldn't load watchlist")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => refetch()}
            style={{
              paddingHorizontal: 20,
              minHeight: 44,
              minWidth: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: colors.onAccent, fontFamily: fonts.bodyBold }}>
              {t('common.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: Math.max(12, insets.top),
          paddingBottom: 10,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={goBack}
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: 44,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
            gap: 4,
          })}
        >
          <ChevronLeft size={22} color={colors.text} strokeWidth={2.4} />
          <Text style={{ fontFamily: fonts.bodySemi, color: colors.textMuted, fontSize: 13 }}>
            Back
          </Text>
        </Pressable>

        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.text }}>
          Triage Backlog
        </Text>

        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text
            style={{ fontSize: 11, color: 'rgba(245,245,240,0.4)', fontFamily: fonts.bodySemi }}
          >
            {remaining.length} left
          </Text>
        </View>
      </View>

      {/* Guide Triage Legend banner */}
      {remaining.length > 0 && (
        <View
          style={{
            marginHorizontal: 18,
            marginTop: 4,
            padding: 10,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
            flexDirection: 'row',
            justifyContent: 'space-around',
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontFamily: fonts.bodyBold, color: colors.right }}>
              👉 Priority
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontFamily: fonts.bodyBold, color: colors.textMuted }}>
              👈 Keep
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontFamily: fonts.bodyBold, color: colors.down }}>
              👇 Watched
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontFamily: fonts.bodyBold, color: colors.left }}>
              👆 Remove
            </Text>
          </View>
        </View>
      )}

      {/* Card stack container */}
      <View
        style={{
          flex: 1,
          position: 'relative',
          marginHorizontal: 18,
          marginTop: 12,
          marginBottom: 20,
        }}
      >
        {visible.length > 0 ? (
          visible
            .slice()
            .reverse()
            .map((entry, idx) => {
              const indexInStack = visible.length - 1 - idx;
              const isTop = indexInStack === 0;
              const depth = indexInStack;
              const scale = 1 - depth * 0.04;
              const translateY = depth * 10;

              return (
                <View
                  key={entry.title.id}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    transform: [{ scale }, { translateY }],
                    zIndex: 10 - depth,
                    pointerEvents: isTop ? 'auto' : 'none',
                  }}
                >
                  <SwipeCard
                    title={entry.title}
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    onCommit={handleCommit}
                    onTap={() =>
                      router.push({ pathname: '/(app)/title/[id]', params: { id: entry.title.id } })
                    }
                    disabled={!isTop}
                    zIndex={10 - depth}
                    allowUp
                    overlayLabels={{
                      right: 'Priority',
                      left: 'Keep',
                      down: 'Watched',
                      up: 'Removed',
                    }}
                  />
                </View>
              );
            })
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(61,214,140,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(61,214,140,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={28} color={colors.right} strokeWidth={2.4} />
            </View>
            <View style={{ gap: 6, alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 22,
                  color: colors.text,
                  textAlign: 'center',
                }}
              >
                Backlog Clear!
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  textAlign: 'center',
                  paddingHorizontal: 24,
                  lineHeight: 18,
                }}
              >
                All saved items have been triaged. Your watchlist is clean and action-ready.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => ({
                height: 46,
                paddingHorizontal: 24,
                backgroundColor: colors.accent,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
                marginTop: 10,
              })}
            >
              <Text style={{ fontFamily: fonts.bodyBold, color: colors.onAccent, fontSize: 14 }}>
                Back to Watchlist
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}
