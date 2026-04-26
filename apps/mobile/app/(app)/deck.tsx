import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import type { DeckCard, SwipeDirection, SwipeEvent } from '@flixy/shared';

import { Screen } from '../../src/components/Screen';
import { useDeck } from '../../src/features/deck/hooks';
import { SwipeCard } from '../../src/features/swipe/SwipeCard';
import {
  useFlushOnReconnect,
  useRecordSwipe,
  useSwipeQueueBoot,
  useSwipeStats,
  useUndoSwipe,
} from '../../src/features/swipe/hooks';

/**
 * Discover / Swipe deck screen (FSD section 4.4). The visible card is the
 * top of the deck; the next two are layered behind for the spec'd 2-3-card
 * stack effect.
 */
export default function DeckScreen() {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, 380);
  const cardHeight = Math.min(height * 0.62, 580);

  const { deck, isLoading, isError, refetch } = useDeck();
  const recordSwipe = useRecordSwipe();
  const undoSwipe = useUndoSwipe();
  const stats = useSwipeStats();

  useSwipeQueueBoot();
  // NetInfo wiring lands in Phase 3.9 with notifications; for now treat as online.
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
        // queue absorbs failures; advance regardless so UX stays fluid.
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
      <Screen title={t('deck.loadingTitle', 'Finding tonight\u2019s picks')}>
        <Text style={{ color: '#A1A1AA' }}>
          {t('deck.loadingHint', 'Composing your deck\u2026')}
        </Text>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen title={t('deck.errorTitle', 'Something went wrong')}>
        <Pressable
          onPress={() => refetch()}
          style={{ padding: 12, backgroundColor: '#15151B', borderRadius: 12 }}
        >
          <Text style={{ color: 'white' }}>{t('common.retry')}</Text>
        </Pressable>
      </Screen>
    );
  }

  if (visible.length === 0) {
    return (
      <Screen title={t('deck.emptyTitle', 'You\u2019ve seen them all')}>
        <Text style={{ color: '#A1A1AA', marginBottom: 16 }}>
          {t('deck.emptyHint', 'Broaden your filters to see more picks.')}
        </Text>
        <Pressable
          onPress={() => router.push('/(app)/settings')}
          style={{ padding: 12, backgroundColor: '#15151B', borderRadius: 12 }}
        >
          <Text style={{ color: 'white' }}>{t('settings.title')}</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen title={t('deck.title', 'Discover')}>
      {stats.queued > 0 ? (
        <Text style={{ color: '#71717A', textAlign: 'center', marginBottom: 8 }}>
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

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 }}>
        <ActionButton
          label={t('deck.actionPass', 'Pass')}
          onPress={() => handleCommit('left')}
          color="#ff5252"
        />
        <ActionButton
          label={t('deck.actionSeen', 'Seen')}
          onPress={() => handleCommit('down')}
          color="#4dabf7"
        />
        <ActionButton
          label={t('deck.actionTop', 'Top')}
          onPress={() => handleCommit('up')}
          color="#ffd166"
        />
        <ActionButton
          label={t('deck.actionAdd', 'Add')}
          onPress={() => handleCommit('right')}
          color="#3ddc84"
        />
      </View>

      <Pressable
        onPress={handleUndo}
        disabled={position === 0}
        style={{
          marginTop: 12,
          padding: 10,
          alignSelf: 'center',
          opacity: position === 0 ? 0.4 : 1,
        }}
      >
        <Text style={{ color: 'white' }}>{t('deck.undo', 'Undo')}</Text>
      </Pressable>
    </Screen>
  );
}

function ActionButton({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: color,
      }}
    >
      <Text style={{ color, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
