import { router } from 'expo-router';
import { Compass, Heart, RotateCcw, Star, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View, useWindowDimensions } from 'react-native';

import type { DeckCard, SwipeDirection, SwipeEvent } from '@flixy/shared';

import { ActionButton } from '../../src/components/ActionButton';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { FilterSheet } from '../../src/features/deck/FilterSheet';
import { useDeckFilters } from '../../src/features/deck/filterStore';
import { useDeck } from '../../src/features/deck/hooks';
import { SwipeCard } from '../../src/features/swipe/SwipeCard';
import {
  useFlushOnReconnect,
  useRecordSwipe,
  useSwipeQueueBoot,
  useSwipeStats,
  useUndoSwipe,
} from '../../src/features/swipe/hooks';
import { colors, fonts } from '../../src/theme/tokens';

/**
 * Discover / Swipe deck (FSD section 4.4). Top card is interactive; the next
 * two are layered behind for the spec'd 2-3 card stack.
 */
export default function DeckScreen() {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, 380);
  const cardHeight = Math.min(height * 0.62, 580);

  const { deck, isLoading, isError, refetch } = useDeck({
    mood: useDeckFilters((s) => s.mood),
    extraFilter: {
      kinds: useDeckFilters((s) => s.kinds),
      minYear: useDeckFilters((s) => s.minYear) ?? undefined,
      maxYear: useDeckFilters((s) => s.maxYear) ?? undefined,
    },
  });
  const recordSwipe = useRecordSwipe();
  const undoSwipe = useUndoSwipe();
  const stats = useSwipeStats();
  const [showFilters, setShowFilters] = useState(false);

  useSwipeQueueBoot();
  useFlushOnReconnect(true);

  const [position, setPosition] = useState(0);
  const lastEventRef = useRef<SwipeEvent | null>(null);

  const cards: DeckCard[] = deck?.cards ?? [];
  const visible = useMemo(() => cards.slice(position, position + 3), [cards, position]);

  const handleCommit = useCallback(
    async (dir: SwipeDirection) => {
      const card = cards[position];
      if (!card) return;
      try {
        const ev = await recordSwipe.mutateAsync({
          titleId: card.title.id,
          direction: dir,
          deckPosition: position,
        });
        lastEventRef.current = ev;
      } catch {
        /* queue absorbs failures; advance regardless */
      }
      setPosition((p) => p + 1);
    },
    [cards, position, recordSwipe],
  );

  const handleUndo = useCallback(async () => {
    const last = lastEventRef.current;
    if (!last || position === 0) return;
    await undoSwipe.mutateAsync(last);
    lastEventRef.current = null;
    setPosition((p) => Math.max(0, p - 1));
  }, [position, undoSwipe]);

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <ActivityIndicator color={colors.accent} />
          <Text variant="body-m" tone="muted">
            {t('deck.loadingHint', 'Composing your deck\u2026')}
          </Text>
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen title={t('deck.errorTitle', 'Something went wrong')}>
        <Pressable
          onPress={() => refetch()}
          style={{
            padding: 14,
            backgroundColor: colors.surface2,
            borderRadius: 14,
            alignItems: 'center',
          }}
        >
          <Text>{t('common.retry')}</Text>
        </Pressable>
      </Screen>
    );
  }

  if (visible.length === 0) {
    return (
      <Screen title={t('deck.emptyTitle', 'You\u2019ve seen them all')}>
        <Text tone="muted" style={{ marginBottom: 16 }}>
          {t('deck.emptyHint', 'Broaden your filters to see more picks.')}
        </Text>
        <Pressable
          onPress={() => setShowFilters(true)}
          style={{
            padding: 14,
            backgroundColor: colors.accent,
            borderRadius: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.bodySemi }}>{t('filters.open', 'Filters')}</Text>
        </Pressable>
        <FilterSheet visible={showFilters} onClose={() => setShowFilters(false)} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text style={{ fontFamily: fonts.display, fontSize: 32, color: colors.text }}>Flixy</Text>
        <Pressable
          onPress={() => setShowFilters(true)}
          accessibilityRole="button"
          accessibilityLabel={t('filters.title', 'Filters')}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: colors.border2,
          }}
        >
          <Text variant="body-s" tone="muted" style={{ fontFamily: fonts.bodySemi }}>
            {t('filters.open', 'Filters')}
          </Text>
        </Pressable>
      </View>

      {stats.queued > 0 ? (
        <Text variant="caption" tone="dim" style={{ textAlign: 'center', marginBottom: 8 }}>
          {t('deck.syncing', 'Syncing {{count}} swipe(s)\u2026', { count: stats.queued })}
        </Text>
      ) : null}

      <View
        style={{ alignItems: 'center', justifyContent: 'center', height: cardHeight + 40 }}
        accessibilityLabel="swipe deck"
      >
        {visible
          .slice()
          .reverse()
          .map((card, idx) => {
            const indexInStack = visible.length - 1 - idx;
            const isTop = indexInStack === 0;
            return (
              <SwipeCard
                key={`${card.title.id}-${position + indexInStack}`}
                title={card.title}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                onCommit={handleCommit}
                onTap={() =>
                  router.push({ pathname: '/(app)/title/[id]', params: { id: card.title.id } })
                }
                disabled={!isTop}
                zIndex={10 - indexInStack}
              />
            );
          })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          marginTop: 8,
        }}
      >
        <ActionButton
          accessibilityLabel={t('deck.actionPass', 'Pass')}
          onPress={() => handleCommit('left')}
          borderColor={colors.left}
        >
          <X size={22} color={colors.left} strokeWidth={2.5} />
        </ActionButton>
        <ActionButton
          accessibilityLabel={t('deck.actionSeen', 'Seen')}
          onPress={() => handleCommit('down')}
          borderColor={colors.down}
        >
          <Compass size={22} color={colors.down} strokeWidth={2.5} />
        </ActionButton>
        <ActionButton
          accessibilityLabel={t('deck.actionAdd', 'Add')}
          onPress={() => handleCommit('right')}
          variant="accent"
          size="lg"
        >
          <Heart size={26} color={colors.text} strokeWidth={2.5} fill={colors.text} />
        </ActionButton>
        <ActionButton
          accessibilityLabel={t('deck.actionTop', 'Top')}
          onPress={() => handleCommit('up')}
          borderColor={colors.up}
        >
          <Star size={22} color={colors.up} strokeWidth={2.5} fill={colors.up} />
        </ActionButton>
        <ActionButton
          accessibilityLabel={t('deck.undo', 'Undo')}
          onPress={handleUndo}
          disabled={position === 0}
        >
          <RotateCcw size={20} color={colors.textMuted} strokeWidth={2.5} />
        </ActionButton>
      </View>

      <FilterSheet visible={showFilters} onClose={() => setShowFilters(false)} />
    </Screen>
  );
}
