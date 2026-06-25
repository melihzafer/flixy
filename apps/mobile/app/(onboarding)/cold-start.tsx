import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Heart } from 'lucide-react-native';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { ONBOARDING } from '@flixy/shared';
import type { SwipeDirection } from '@flixy/shared';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useTitlesQuery } from '../../src/features/catalogue/hooks';
import { useUpdatePreferences } from '../../src/features/onboarding/hooks';
import { SwipeCard } from '../../src/features/swipe/SwipeCard';
import { useRecordSwipe } from '../../src/features/swipe/hooks';
import { track } from '../../src/lib/analytics';
import { logger } from '../../src/lib/logger';
import { colors, fonts } from '../../src/theme/tokens';

export default function ColdStartStep() {
  const { width, height } = useWindowDimensions();
  const cardWidth = width - 32;
  const cardHeight = Math.min(height * 0.55, 480);

  const {
    data: titleResult,
    isLoading,
    isError,
    refetch,
  } = useTitlesQuery({
    limit: ONBOARDING.COLD_START_CARDS,
  });
  const update = useUpdatePreferences();
  const recordSwipe = useRecordSwipe();

  const [position, setPosition] = useState(0);
  const [completed, setCompleted] = useState(false);

  const deck = useMemo(
    () => titleResult?.titles?.slice(0, ONBOARDING.COLD_START_CARDS) ?? [],
    [titleResult],
  );
  const visible = useMemo(() => deck.slice(position, position + 2), [deck, position]);

  const handleCommit = useCallback(
    async (direction: SwipeDirection) => {
      const title = deck[position];
      if (title) {
        try {
          await recordSwipe.mutateAsync({
            titleId: title.id,
            direction,
            deckPosition: position,
          });
        } catch (error) {
          logger.warn('cold-start swipe record failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const next = position + 1;
      setPosition(next);
      if (next >= Math.min(ONBOARDING.COLD_START_CARDS, deck.length)) {
        setTimeout(() => setCompleted(true), 350);
      }
    },
    [deck, position, recordSwipe],
  );

  const onFinish = () => {
    update.mutate(
      { cold_start_completed_at: new Date().toISOString() },
      { onSuccess: () => router.push('/(onboarding)/notifications') },
    );
  };

  const onSkip = () => {
    track('onboarding_taste_skipped', { swipes_completed: position });
    router.replace('/(onboarding)/notifications');
  };

  if (completed) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <CheckCircle2 size={48} color={colors.accent} strokeWidth={2.2} />
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text }}>
            Taste captured
          </Text>
        </View>
        <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <Pressable
            onPress={onFinish}
            style={{
              width: '100%',
              height: 54,
              backgroundColor: colors.accent,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent }}>
              Continue
            </Text>
            <ArrowRight size={18} color={colors.onAccent} strokeWidth={2.4} />
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen scroll={false} style={{ paddingHorizontal: 0 }}>
        <ColdStartShell progress="0/10">
          <View
            style={{
              flex: 1,
              marginHorizontal: 16,
              borderRadius: 24,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: 'rgba(255,77,28,0.12)',
              overflow: 'hidden',
            }}
          >
            <View style={{ flex: 1, backgroundColor: colors.surface2 }} />
            <View style={{ padding: 18, gap: 10 }}>
              <View
                style={{
                  width: '40%',
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.surface3,
                }}
              />
              <View
                style={{
                  width: '74%',
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: colors.surface3,
                }}
              />
              <Text tone="muted">Preparing your first swipe round…</Text>
            </View>
          </View>
        </ColdStartShell>
      </Screen>
    );
  }

  if (isError || deck.length === 0) {
    return (
      <Screen scroll={false}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 }}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 29,
              lineHeight: 33,
              color: colors.text,
              textAlign: 'center',
            }}
          >
            We could not load the taste round
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
            Check your connection and try again.
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={{
              height: 44,
              paddingHorizontal: 20,
              borderRadius: 12,
              backgroundColor: colors.accent,
              borderWidth: 1,
              borderColor: colors.accentBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.bodySemi, color: colors.onAccent }}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} style={{ paddingHorizontal: 0 }}>
      <ColdStartShell progress={`${position}/${ONBOARDING.COLD_START_CARDS}`} onSkip={onSkip}>
        <View
          style={{
            flex: 1,
            position: 'relative',
            marginHorizontal: 16,
            marginTop: 4,
          }}
        >
          {visible
            .slice()
            .reverse()
            .map((title, idx) => {
              const indexInStack = visible.length - 1 - idx;
              const isTop = indexInStack === 0;
              const depth = indexInStack;
              const scale = 1 - depth * 0.04;
              const translateY = depth * 10;

              return (
                <View
                  key={`${title.id}-${position + indexInStack}`}
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
                    title={title}
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    onCommit={handleCommit}
                    onTap={() => {}}
                    disabled={!isTop}
                    zIndex={10 - depth}
                  />
                </View>
              );
            })}
        </View>

        <View
          style={{
            paddingVertical: 12,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <ArrowLeft size={12} color="rgba(245,245,240,0.32)" strokeWidth={2.2} />
            <Text style={{ fontSize: 11, color: 'rgba(245,245,240,0.32)' }}>Pass</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Heart size={12} color="rgba(245,245,240,0.32)" strokeWidth={2.2} />
            <Text style={{ fontSize: 11, color: 'rgba(245,245,240,0.32)' }}>Watchlist</Text>
            <ArrowRight size={12} color="rgba(245,245,240,0.32)" strokeWidth={2.2} />
          </View>
        </View>
      </ColdStartShell>
    </Screen>
  );
}

function ColdStartShell({
  progress,
  children,
  onSkip,
}: {
  progress: string;
  children: ReactNode;
  onSkip?: () => void;
}) {
  return (
    <>
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 27,
              lineHeight: 30,
              color: colors.text,
            }}
          >
            Quick taste
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            Swipe what feels right. No overthinking.
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontSize: 12, color: 'rgba(245,245,240,0.35)' }}>{progress}</Text>
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip taste round"
              hitSlop={8}
              onPress={onSkip}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 12,
                  color: 'rgba(245,245,240,0.6)',
                }}
              >
                Skip for now
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {children}
    </>
  );
}
