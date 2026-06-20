import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  Check,
  Heart,
  Info,
  RotateCcw,
  Settings2,
  Star,
  X,
} from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DeckCard, SwipeDirection, SwipeEvent } from '@flixy/shared';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppHeader } from '../../../src/components/AppHeader';
import { SaveNudge } from '../../../src/components/SaveNudge';
import { Screen } from '../../../src/components/Screen';
import { Text } from '../../../src/components/Text';
import { useSession } from '../../../src/features/auth/useSession';
import { FilterSheet } from '../../../src/features/deck/FilterSheet';
import { useDeckFilters } from '../../../src/features/deck/filterStore';
import { type DeckDiagnostics, useDeck } from '../../../src/features/deck/hooks';
import { useUserPreferences } from '../../../src/features/onboarding/hooks';
import { SwipeCard } from '../../../src/features/swipe/SwipeCard';
import {
  useFlushOnReconnect,
  useRecordSwipe,
  useSwipeQueueBoot,
  useSwipeStats,
  useUndoSwipe,
} from '../../../src/features/swipe/hooks';
import { events } from '../../../src/features/telemetry/events';
import { ANON_UPGRADE_THRESHOLD, useAnonSwipeStore } from '../../../src/stores/anonSwipe';
import { colors, fonts } from '../../../src/theme/tokens';

export default function DeckScreen() {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = width - 36; // 18px margin each side
  const isCompactWidth = width < 380;
  const cardHeight = Math.min(height * (isCompactWidth ? 0.54 : 0.58), 540);
  const deckActionSize = isCompactWidth ? 46 : 50;
  const deckSaveSize = isCompactWidth ? 54 : 58;
  const deckActionGap = isCompactWidth ? 8 : 12;
  const activeMood = useDeckFilters((s) => s.mood);
  const kinds = useDeckFilters((s) => s.kinds);
  const minYear = useDeckFilters((s) => s.minYear);
  const maxYear = useDeckFilters((s) => s.maxYear);
  const resetFilters = useDeckFilters((s) => s.reset);
  const extraFilter = useMemo(
    () => ({
      kinds,
      minYear: minYear ?? undefined,
      maxYear: maxYear ?? undefined,
    }),
    [kinds, minYear, maxYear],
  );

  const { deck, diagnostics, isLoading, isError, error, refetch } = useDeck({
    mood: activeMood,
    extraFilter,
  });
  const { data: prefs } = useUserPreferences();
  const recordSwipe = useRecordSwipe();
  const undoSwipe = useUndoSwipe();
  const stats = useSwipeStats();
  const [showFilters, setShowFilters] = useState(false);

  useSwipeQueueBoot();
  useFlushOnReconnect(true);

  // Track swiped titles by id (in commit order) so background reorders/refetches
  // of the underlying `cards` array can't snap a different card under the user.
  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const swipedSet = useMemo(() => new Set(swipedIds), [swipedIds]);
  const position = swipedIds.length;
  const lastEventRef = useRef<SwipeEvent | null>(null);
  const nudgeFired = useRef(false);
  const [showNudge, setShowNudge] = useState(false);
  const { data: authState } = useSession();
  const isPreviewUser = !authState?.user || authState.isAnonymous;
  const bumpAnonSwipe = useAnonSwipeStore((s) => s.bumpSwipe);
  const shouldPromptAnonUpgrade = useAnonSwipeStore((s) => s.shouldPromptUpgrade);
  const dismissAnonPrompt = useAnonSwipeStore((s) => s.dismissPrompt);

  const cards: DeckCard[] = deck?.cards ?? [];
  const remaining = useMemo(
    () => cards.filter((c) => !swipedSet.has(c.title.id)),
    [cards, swipedSet],
  );
  const visible = useMemo(() => remaining.slice(0, 3), [remaining]);

  const handleCommit = useCallback(
    async (dir: SwipeDirection) => {
      const card = remaining[0];
      if (!card) return;
      const swipeIndex = swipedIds.length;
      try {
        const ev = await recordSwipe.mutateAsync({
          titleId: card.title.id,
          direction: dir,
          deckPosition: swipeIndex,
          genres: card.title.genres,
        });
        lastEventRef.current = ev;
      } catch {
        /* queue absorbs failures; advance regardless */
      }
      const nextPos = swipeIndex + 1;
      setSwipedIds((prev) => [...prev, card.title.id]);

      if (isPreviewUser && !nudgeFired.current) {
        if (authState?.isAnonymous) {
          bumpAnonSwipe();
        }
        const shouldPrompt =
          authState?.isAnonymous && shouldPromptAnonUpgrade()
            ? true
            : !authState?.user && nextPos >= ANON_UPGRADE_THRESHOLD;
        if (shouldPrompt) {
          nudgeFired.current = true;
          setTimeout(() => {
            events.anonymousUpgradeShown({ surface: 'deck', swipeCount: nextPos });
            setShowNudge(true);
          }, 400);
        }
      }
    },
    [
      authState,
      bumpAnonSwipe,
      isPreviewUser,
      recordSwipe,
      remaining,
      shouldPromptAnonUpgrade,
      swipedIds.length,
    ],
  );

  const handleUndo = useCallback(async () => {
    const last = lastEventRef.current;
    if (!last || swipedIds.length === 0) return;
    await undoSwipe.mutateAsync(last);
    lastEventRef.current = null;
    setSwipedIds((prev) => prev.slice(0, -1));
  }, [swipedIds.length, undoSwipe]);

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <DeckLoadingState
          title={t('deck.loadingTitle', "Finding tonight's picks")}
          hint={t('deck.loadingHint', 'Composing your deck…')}
        />
      </Screen>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : t('auth.errors.network');
    return (
      <Screen scroll={false}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: 28,
          }}
        >
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 24,
              backgroundColor: 'rgba(224,92,75,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(224,92,75,0.28)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={30} color={colors.left} strokeWidth={1.9} />
          </View>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 29,
              color: colors.text,
              textAlign: 'center',
            }}
          >
            {t('deck.errorTitle', 'Connection failed')}
          </Text>
          <Text
            style={{
              maxWidth: 300,
              color: colors.textMuted,
              textAlign: 'center',
              lineHeight: 20,
              fontFamily: fonts.body,
              fontSize: 13,
            }}
          >
            {message}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => ({
              padding: 14,
              paddingHorizontal: 22,
              backgroundColor: pressed ? colors.surface3 : colors.surface2,
              borderRadius: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border2,
            })}
          >
            <Text style={{ fontFamily: fonts.bodySemi, color: colors.text }}>
              {t('common.retry')}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (visible.length === 0) {
    const emptyCopy = getDeckEmptyCopy(diagnostics, t);
    const shouldRetryCatalogue =
      diagnostics?.emptyReason === 'live_empty' ||
      diagnostics?.emptyReason === 'query_failed' ||
      diagnostics?.emptyReason === 'supabase_unconfigured';
    const needsPersonalization =
      (prefs?.selected_services?.length ?? 0) === 0 || (prefs?.selected_genres?.length ?? 0) === 0;
    return (
      <Screen scroll={false}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 36 }}
        >
          <View style={{ width: 92, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                position: 'absolute',
                width: 68,
                height: 96,
                borderRadius: 16,
                backgroundColor: 'rgba(245,245,240,0.045)',
                borderWidth: 1,
                borderColor: colors.border,
                transform: [{ rotate: '7deg' }, { translateX: 10 }],
              }}
            />
            <View
              style={{
                width: 74,
                height: 106,
                borderRadius: 18,
                backgroundColor: colors.accentDim,
                borderWidth: 1,
                borderColor: colors.accentBorder,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: '-4deg' }],
              }}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.accent }}>
                F
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 30,
              lineHeight: 34,
              color: colors.text,
              textAlign: 'center',
            }}
          >
            {emptyCopy.title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textMuted,
              textAlign: 'center',
              lineHeight: 20,
              maxWidth: 280,
            }}
          >
            {emptyCopy.hint}
          </Text>
          {needsPersonalization ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('deck.personalizeA11y', 'Personalize your deck')}
              onPress={() => router.push('/(app)/settings-services')}
              style={({ pressed }) => ({
                marginTop: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: pressed ? 'rgba(255,77,28,0.18)' : 'rgba(255,77,28,0.12)',
                borderWidth: 1,
                borderColor: colors.accentBorder,
              })}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 13,
                  color: colors.accent,
                }}
              >
                {t('deck.personalize', 'Personalize your deck')} →
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={emptyCopy.secondaryAccessibilityLabel}
              onPress={() => {
                resetFilters();
                void refetch();
              }}
              style={({ pressed }) => ({
                height: 42,
                paddingHorizontal: 18,
                borderRadius: 12,
                backgroundColor: pressed ? 'rgba(255,77,28,0.08)' : 'rgba(245,245,240,0.045)',
                borderWidth: 1,
                borderColor: pressed ? colors.accentBorder : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 14,
                  color: colors.textMuted,
                }}
              >
                {emptyCopy.secondaryLabel}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={emptyCopy.primaryAccessibilityLabel}
              onPress={() => {
                if (shouldRetryCatalogue) {
                  void refetch();
                } else {
                  setShowFilters(true);
                }
              }}
              style={({ pressed }) => ({
                height: 42,
                paddingHorizontal: 22,
                borderRadius: 12,
                backgroundColor: pressed ? '#E84618' : colors.accent,
                borderWidth: 1,
                borderColor: colors.accentBorder,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 14,
                  color: colors.text,
                }}
              >
                {emptyCopy.primaryLabel}
              </Text>
            </Pressable>
          </View>
        </View>
        <FilterSheet visible={showFilters} onClose={() => setShowFilters(false)} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppHeader
        title="Flixy"
        status={
          stats.queued > 0
            ? t('deck.syncing', 'Syncing {{count}} swipe(s)…', { count: stats.queued })
            : stats.lastError
              ? t('deck.syncIssue', 'Saved offline. Retrying sync…')
              : diagnostics?.isRelaxed
                ? t('deck.relaxedStatus', 'Broadened filters for more picks')
                : diagnostics?.isFallback
                  ? t('deck.degradedStatus', 'Limited offline picks')
                  : t('deck.readyStatus', '{{count}} picks ready', {
                      count: remaining.length,
                    })
        }
        right={
          <>
            {activeMood && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('deck.editMoodFilter', 'Edit active mood filter: {{mood}}', {
                  mood: activeMood,
                })}
                accessibilityState={{ selected: true }}
                onPress={() => setShowFilters(true)}
                style={{
                  backgroundColor: 'rgba(255,77,28,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,77,28,0.3)',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: fonts.bodySemi,
                    color: colors.accent,
                  }}
                >
                  {activeMood}
                </Text>
                <X size={12} color={colors.accent} strokeWidth={2.4} />
              </Pressable>
            )}
            <Pressable
              onPress={() => setShowFilters(true)}
              testID="deck-filter-button"
              accessibilityRole="button"
              accessibilityLabel={t('deck.openFilters', 'Open filters')}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.09)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings2 size={17} color="rgba(245,245,240,0.7)" strokeWidth={2.1} />
            </Pressable>
          </>
        }
      />

      {/* Card stack */}
      <View
        style={{
          flex: 1,
          position: 'relative',
          marginHorizontal: 18,
          marginTop: 4,
        }}
      >
        {visible
          .slice()
          .reverse()
          .map((card, idx) => {
            const indexInStack = visible.length - 1 - idx;
            const isTop = indexInStack === 0;
            const depth = indexInStack;
            const scale = 1 - depth * 0.04;
            const translateY = depth * 10;

            return (
              <View
                key={card.title.id}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  transform: [{ scale }, { translateY }],
                  zIndex: 10 - depth,
                }}
                pointerEvents={isTop ? 'auto' : 'none'}
              >
                <SwipeCard
                  title={card.title}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  onCommit={handleCommit}
                  onTap={() =>
                    router.push({ pathname: '/(app)/title/[id]', params: { id: card.title.id } })
                  }
                  disabled={!isTop}
                  zIndex={10 - depth}
                />
              </View>
            );
          })}
      </View>

      {/* Action bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: deckActionGap,
          paddingHorizontal: isCompactWidth ? 16 : 20,
          paddingTop: 10,
          paddingBottom: Math.max(14, insets.bottom + 8),
          position: 'relative',
        }}
      >
        {position > 0 && (
          <Pressable
            onPress={handleUndo}
            testID="deck-undo-button"
            accessibilityRole="button"
            accessibilityLabel={t('deck.undoA11y', 'Undo last swipe')}
            style={{
              position: 'absolute',
              right: 20,
              top: -22,
              minHeight: 34,
              paddingHorizontal: 10,
              borderRadius: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <RotateCcw size={13} color="rgba(245,245,240,0.36)" strokeWidth={2.1} />
            <Text
              style={{
                fontSize: 11,
                fontFamily: fonts.bodySemi,
                color: 'rgba(245,245,240,0.3)',
              }}
            >
              {t('deck.undo', 'Undo')}
            </Text>
          </Pressable>
        )}

        <ActionButton
          onPress={() => handleCommit('left')}
          testID="deck-pass-button"
          label={t('deck.actionPass', 'Pass')}
          accessibilityLabel={t('deck.a11y.pass', 'Pass this title')}
          Icon={X}
          tone="pass"
          size={deckActionSize}
          iconSize={isCompactWidth ? 20 : 21}
          showLabel
        />

        <ActionButton
          onPress={() => handleCommit('down')}
          testID="deck-seen-button"
          label={t('deck.actionSeen', 'Seen')}
          accessibilityLabel={t('deck.a11y.seen', 'Mark this title as seen')}
          Icon={Check}
          tone="seen"
          size={deckActionSize}
          iconSize={isCompactWidth ? 19 : 20}
          showLabel
        />

        <ActionButton
          onPress={() => handleCommit('right')}
          testID="deck-save-button"
          label={t('deck.actionSave', 'Save')}
          accessibilityLabel={t('deck.a11y.save', 'Save this title')}
          Icon={Heart}
          tone="save"
          size={deckSaveSize}
          iconSize={isCompactWidth ? 22 : 24}
          showLabel
        />

        <ActionButton
          onPress={() => handleCommit('up')}
          testID="deck-top-button"
          label={t('deck.actionTop', 'Top')}
          accessibilityLabel={t('deck.a11y.top', 'Mark this title as a top pick')}
          Icon={Star}
          tone="top"
          size={deckActionSize}
          iconSize={isCompactWidth ? 20 : 21}
          showLabel
        />

        <ActionButton
          onPress={() => {
            const card = remaining[0];
            if (card) {
              router.push({ pathname: '/(app)/title/[id]', params: { id: card.title.id } });
            }
          }}
          testID="deck-info-button"
          label={t('deck.actionInfo', 'Info')}
          accessibilityLabel={t('deck.a11y.info', 'Open title details')}
          Icon={Info}
          tone="info"
          size={deckActionSize}
          iconSize={isCompactWidth ? 19 : 20}
          showLabel
        />
      </View>

      <FilterSheet visible={showFilters} onClose={() => setShowFilters(false)} />
      <SaveNudge
        visible={showNudge}
        watchlistCount={Math.max(1, position)}
        onDismiss={() => {
          events.anonymousUpgradeDismissed('deck');
          setShowNudge(false);
          if (authState?.isAnonymous) dismissAnonPrompt();
        }}
      />
    </Screen>
  );
}

function getDeckEmptyCopy(
  diagnostics: DeckDiagnostics | null,
  t: TFunction,
): {
  title: string;
  hint: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryAccessibilityLabel: string;
  secondaryAccessibilityLabel: string;
} {
  switch (diagnostics?.emptyReason) {
    case 'filter_overconstrained':
    case 'filtered_empty':
      return {
        title: t('deck.empty.filteredTitle'),
        hint: t('deck.empty.filteredHint'),
        primaryLabel: t('deck.empty.filteredPrimary'),
        secondaryLabel: t('deck.empty.clearFilters'),
        primaryAccessibilityLabel: t('deck.a11y.broadenFilters'),
        secondaryAccessibilityLabel: t('deck.a11y.clearFilters'),
      };
    case 'service_empty':
      return {
        title: t('deck.empty.serviceTitle'),
        hint: t('deck.empty.serviceHint'),
        primaryLabel: t('deck.empty.servicePrimary'),
        secondaryLabel: t('deck.empty.clearFilters'),
        primaryAccessibilityLabel: t('deck.a11y.changeServices'),
        secondaryAccessibilityLabel: t('deck.a11y.clearFilters'),
      };
    case 'live_empty':
    case 'query_failed':
    case 'supabase_unconfigured':
      return {
        title: t('deck.empty.fallbackTitle'),
        hint: t('deck.empty.fallbackHint'),
        primaryLabel: t('deck.empty.fallbackPrimary'),
        secondaryLabel: t('deck.empty.clearFilters'),
        primaryAccessibilityLabel: t('deck.a11y.retryCatalogue'),
        secondaryAccessibilityLabel: t('deck.a11y.clearFilters'),
      };
    case 'exhausted':
      return {
        title: t('deck.empty.exhaustedTitle'),
        hint: t('deck.empty.exhaustedHint'),
        primaryLabel: t('deck.empty.filters'),
        secondaryLabel: t('deck.empty.clearFilters'),
        primaryAccessibilityLabel: t('deck.a11y.openDeckFilters'),
        secondaryAccessibilityLabel: t('deck.a11y.clearFilters'),
      };
    default:
      return {
        title: t('deck.empty.defaultTitle'),
        hint: t('deck.empty.defaultHint'),
        primaryLabel: t('deck.empty.filters'),
        secondaryLabel: t('deck.empty.reset'),
        primaryAccessibilityLabel: t('deck.a11y.openDeckFilters'),
        secondaryAccessibilityLabel: t('deck.a11y.openDeckFilters', 'Reset deck filters and retry'),
      };
  }
}

function DeckLoadingState({ title, hint }: { title: string; hint: string }) {
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 24,
      }}
    >
      <View style={{ gap: 6, marginBottom: 18 }}>
        <View
          style={{
            width: 98,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.accentDim,
          }}
        />
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 30,
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            color: colors.textMuted,
            fontSize: 13,
          }}
        >
          {hint}
        </Text>
      </View>
      <View
        style={{
          flex: 1,
          borderRadius: 24,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#18181B' }} />
        <View style={{ padding: 20, gap: 10 }}>
          <View
            style={{ height: 10, width: '42%', borderRadius: 5, backgroundColor: colors.surface3 }}
          />
          <View
            style={{ height: 30, width: '76%', borderRadius: 8, backgroundColor: colors.surface3 }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View
              style={{ height: 24, width: 72, borderRadius: 7, backgroundColor: colors.surface2 }}
            />
            <View
              style={{ height: 24, width: 86, borderRadius: 7, backgroundColor: colors.surface2 }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
