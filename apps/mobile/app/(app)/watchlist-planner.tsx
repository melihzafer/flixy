import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import {
  Check,
  ChevronLeft,
  Clock3,
  Film,
  RotateCcw,
  Sparkles,
  Users,
  X,
} from 'lucide-react-native';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, useWindowDimensions } from 'react-native';

import type { SwipeDirection, Title } from '@flixy/shared';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { toTitleDisplay } from '../../src/features/catalogue/display';
import { SwipeCard } from '../../src/features/swipe/SwipeCard';
import { type WatchlistEntry, useWatchlist } from '../../src/features/watchlist/hooks';
import {
  type GroupVote,
  WATCHLIST_PICK_BUDGETS,
  type WatchlistKindFilter,
  type WatchlistPickBudget,
  type WatchlistPlannerCandidate,
  type WatchlistRuntimeFilter,
  aggregateGroupVotes,
  rankTonightCandidates,
} from '../../src/features/watchlist/planner';
import { colors, fonts } from '../../src/theme/tokens';

type PlannerMode = 'tonight' | 'together';
type PlannerPhase = 'setup' | 'swiping' | 'handoff' | 'results';

const KIND_FILTERS: { id: WatchlistKindFilter; label: string }[] = [
  { id: 'all', label: 'watchlist.filter.all' },
  { id: 'movie', label: 'watchlist.filter.movies' },
  { id: 'tv', label: 'watchlist.filter.series' },
];

const RUNTIME_FILTERS: { id: WatchlistRuntimeFilter; label: string }[] = [
  { id: 'any', label: 'watchlist.planner.runtimeAny' },
  { id: 'short', label: 'watchlist.planner.runtimeShort' },
  { id: 'standard', label: 'watchlist.planner.runtimeStandard' },
  { id: 'epic', label: 'watchlist.planner.runtimeEpic' },
];

const PARTICIPANT_COUNTS = [2, 3, 4] as const;

export default function WatchlistPlannerScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<PlannerMode>(
    params.mode === 'together' ? 'together' : 'tonight',
  );
  const [kind, setKind] = useState<WatchlistKindFilter>('all');
  const [runtime, setRuntime] = useState<WatchlistRuntimeFilter>('any');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [rerollOffset, setRerollOffset] = useState(0);
  const [participantCount, setParticipantCount] = useState<(typeof PARTICIPANT_COUNTS)[number]>(2);
  const [pickBudget, setPickBudget] = useState<WatchlistPickBudget>(5);
  const [phase, setPhase] = useState<PlannerPhase>('setup');
  const [participantIndex, setParticipantIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votes, setVotes] = useState<GroupVote[]>([]);

  const { entries, isLoading, isError, refetch } = useWatchlist('all');
  const candidates = useMemo(
    () =>
      entries.filter(
        (entry): entry is WatchlistEntry & { title: Title } => !!entry.title,
      ) as WatchlistPlannerCandidate[],
    [entries],
  );
  const plannerFilter = useMemo(
    () => ({ kind, runtime, serviceId, excludeWatched: true }),
    [kind, runtime, serviceId],
  );
  const rankedPool = useMemo(
    () => rankTonightCandidates(candidates, plannerFilter, 50),
    [candidates, plannerFilter],
  );
  const serviceFilters = useMemo(() => {
    const services = new Set<string>();
    for (const candidate of candidates) {
      for (const availability of candidate.title.availability) services.add(availability.serviceId);
    }
    return Array.from(services).sort().slice(0, 5);
  }, [candidates]);
  const tonightCandidates = useMemo(() => {
    if (rankedPool.length === 0) return [];
    const offset = rerollOffset % rankedPool.length;
    const rotated = [...rankedPool.slice(offset), ...rankedPool.slice(0, offset)];
    return rotated.slice(0, 3);
  }, [rankedPool, rerollOffset]);
  const groupPool = useMemo(
    () => rankedPool.slice(0, Math.max(12, pickBudget * participantCount * 2)),
    [participantCount, pickBudget, rankedPool],
  );
  const currentCandidate = groupPool[currentIndex];
  const currentParticipantId = `participant-${participantIndex + 1}`;
  const currentParticipantPicks = useMemo(
    () =>
      new Set(
        votes
          .filter(
            (vote) => vote.participantId === currentParticipantId && vote.direction === 'right',
          )
          .map((vote) => vote.titleId),
      ).size,
    [currentParticipantId, votes],
  );
  const groupResults = useMemo(
    () => aggregateGroupVotes(groupPool, votes, participantCount, pickBudget),
    [groupPool, participantCount, pickBudget, votes],
  );
  const showServiceFilter = serviceFilters.length > 0;
  const cardWidth = Math.min(width - 36, 540);
  const cardHeight = Math.min(height * 0.58, 540);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)/watchlist');
  }, []);

  const startGroupRound = useCallback(() => {
    if (groupPool.length === 0) return;
    setVotes([]);
    setParticipantIndex(0);
    setCurrentIndex(0);
    setPhase('swiping');
  }, [groupPool.length]);

  const resetGroupRound = useCallback(() => {
    setVotes([]);
    setParticipantIndex(0);
    setCurrentIndex(0);
    setPhase('setup');
  }, []);

  const handleGroupCommit = useCallback(
    (direction: SwipeDirection) => {
      if (phase !== 'swiping' || !currentCandidate) return;
      const nextVotes =
        direction === 'right'
          ? [
              ...votes,
              {
                participantId: currentParticipantId,
                titleId: currentCandidate.title.id,
                direction: 'right' as const,
              },
            ]
          : votes;
      const nextIndex = currentIndex + 1;
      const nextPickCount = new Set(
        nextVotes
          .filter(
            (vote) => vote.participantId === currentParticipantId && vote.direction === 'right',
          )
          .map((vote) => vote.titleId),
      ).size;
      const participantFinished = nextPickCount >= pickBudget || nextIndex >= groupPool.length;

      setVotes(nextVotes);
      if (!participantFinished) {
        setCurrentIndex(nextIndex);
        return;
      }

      if (participantIndex + 1 < participantCount) {
        setParticipantIndex((value) => value + 1);
        setCurrentIndex(0);
        setPhase('handoff');
      } else {
        setPhase('results');
      }
    },
    [
      currentCandidate,
      currentIndex,
      currentParticipantId,
      groupPool.length,
      participantCount,
      participantIndex,
      phase,
      pickBudget,
      votes,
    ],
  );

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Text tone="muted">{t('common.loading', 'Loading…')}</Text>
          <Text tone="dim">{t('watchlist.planner.loading', 'Preparing your decision pool…')}</Text>
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scroll={false}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 26,
              color: colors.text,
              textAlign: 'center',
            }}
          >
            {t('watchlist.errorTitle', "Couldn't load watchlist")}
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
            {t(
              'watchlist.errorHint',
              'Check your connection and try again. Your saved titles are kept on your account.',
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('watchlist.retry', 'Retry loading watchlist')}
            onPress={() => void refetch()}
            style={{
              minHeight: 48,
              paddingHorizontal: 20,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
            }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, color: colors.onAccent }}>
              {t('common.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (phase === 'swiping') {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <PlannerHeader
            title={t('watchlist.planner.together', 'Together')}
            subtitle={t('watchlist.planner.passPhone', 'Pass the phone when you finish')}
            onBack={resetGroupRound}
            right={`${currentParticipantPicks}/${pickBudget}`}
          />
          <View
            style={{
              width: '100%',
              maxWidth: cardWidth,
              flex: 1,
              minHeight: 0,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
            }}
          >
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 2,
              }}
            >
              <Text style={{ fontFamily: fonts.bodySemi, color: colors.text }}>
                {t('watchlist.planner.person', 'Person {{number}}', {
                  number: participantIndex + 1,
                })}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {t('watchlist.planner.swipeHint', 'Right = pick · Left = skip')}
              </Text>
            </View>
            {currentCandidate ? (
              <View style={{ width: cardWidth, height: cardHeight, position: 'relative' }}>
                <SwipeCard
                  title={currentCandidate.title}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  onCommit={handleGroupCommit}
                  onTap={() =>
                    router.push({
                      pathname: '/(app)/title/[id]',
                      params: { id: currentCandidate.title.id },
                    })
                  }
                  overlayLabels={{
                    right: t('watchlist.planner.pick', 'Pick'),
                    left: t('watchlist.planner.skip', 'Skip'),
                  }}
                  recommendationReason={t('watchlist.planner.fromWatchlist', 'From your watchlist')}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <RoundAction
                label={t('watchlist.planner.skip', 'Skip')}
                icon={<X size={18} color={colors.left} strokeWidth={2.4} />}
                onPress={() => handleGroupCommit('left')}
                tone="negative"
              />
              <RoundAction
                label={t('watchlist.planner.pick', 'Pick')}
                icon={<Check size={18} color={colors.right} strokeWidth={2.4} />}
                onPress={() => handleGroupCommit('right')}
                tone="positive"
              />
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  if (phase === 'handoff') {
    return (
      <Screen scroll={false}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: colors.accentDim,
              borderWidth: 1,
              borderColor: colors.accentBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={30} color={colors.accent} strokeWidth={1.8} />
          </View>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 30,
              color: colors.text,
              textAlign: 'center',
            }}
          >
            {t('watchlist.planner.passTo', 'Pass the phone to Person {{number}}', {
              number: participantIndex + 1,
            })}
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
            {t(
              'watchlist.planner.privateVotes',
              'Their picks stay hidden until everyone is finished.',
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPhase('swiping')}
            style={{
              minHeight: 52,
              minWidth: 220,
              borderRadius: 14,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, color: colors.onAccent }}>
              {t('watchlist.planner.startTurn', 'Start their turn')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={resetGroupRound}
            style={{
              minHeight: 48,
              paddingHorizontal: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.textMuted }}>{t('common.cancel', 'Cancel')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (phase === 'results') {
    return (
      <Screen scroll>
        <PlannerHeader
          title={t('watchlist.planner.resultsTitle', 'Your shortlist')}
          subtitle={t('watchlist.planner.resultsSubtitle', 'The overlap, ranked for tonight')}
          onBack={resetGroupRound}
          right={`${participantCount} × ${pickBudget}`}
        />
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 10 }}>
          {groupResults.length > 0 ? (
            groupResults.map((result) => (
              <ResultRow
                key={result.title.id}
                result={result}
                onPress={() =>
                  router.push({ pathname: '/(app)/title/[id]', params: { id: result.title.id } })
                }
                t={t}
              />
            ))
          ) : (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 60 }}>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 26,
                  color: colors.text,
                  textAlign: 'center',
                }}
              >
                {t('watchlist.planner.noMatches', 'No shared picks yet')}
              </Text>
              <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
                {t(
                  'watchlist.planner.noMatchesHint',
                  'Try again with a wider context or choose more titles.',
                )}
              </Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={resetGroupRound}
            style={{
              minHeight: 52,
              marginTop: 8,
              borderRadius: 14,
              backgroundColor: colors.surface2,
              borderWidth: 1,
              borderColor: colors.border2,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <RotateCcw size={17} color={colors.text} strokeWidth={2} />
            <Text style={{ color: colors.text, fontFamily: fonts.bodySemi }}>
              {t('watchlist.planner.startAgain', 'Start again')}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <PlannerHeader
        title={t('watchlist.planner.title', 'Choose what to watch')}
        subtitle={t('watchlist.planner.subtitle', 'Turn the backlog into one clear next move')}
        onBack={goBack}
        right={String(rankedPool.length)}
      />
      <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ModeButton
            active={mode === 'tonight'}
            icon={
              <Sparkles size={17} color={mode === 'tonight' ? colors.onAccent : colors.textMuted} />
            }
            label={t('watchlist.planner.tonight', 'Tonight')}
            onPress={() => setMode('tonight')}
          />
          <ModeButton
            active={mode === 'together'}
            icon={
              <Users size={17} color={mode === 'together' ? colors.onAccent : colors.textMuted} />
            }
            label={t('watchlist.planner.together', 'Together')}
            onPress={() => setMode('together')}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.bodySemi, color: colors.text }}>
            {t('watchlist.planner.context', 'Set the context')}
          </Text>
          <FilterStrip values={KIND_FILTERS} selected={kind} onSelect={setKind} t={t} />
          <FilterStrip values={RUNTIME_FILTERS} selected={runtime} onSelect={setRuntime} t={t} />
          {showServiceFilter && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {t('watchlist.planner.service', 'Where can we watch?')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <FilterChip
                  label={t('watchlist.planner.anyService', 'Any service')}
                  active={!serviceId}
                  onPress={() => setServiceId(null)}
                />
                {serviceFilters.map((id) => (
                  <FilterChip
                    key={id}
                    label={prettyService(id)}
                    active={serviceId === id}
                    onPress={() => setServiceId(id)}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {mode === 'tonight' ? (
          <TonightMode
            candidates={tonightCandidates}
            poolCount={rankedPool.length}
            onReroll={() => setRerollOffset((value) => value + 3)}
            onOpen={(title) =>
              router.push({ pathname: '/(app)/title/[id]', params: { id: title.id } })
            }
            t={t}
          />
        ) : (
          <TogetherSetup
            participantCount={participantCount}
            pickBudget={pickBudget}
            poolCount={groupPool.length}
            onParticipantCountChange={setParticipantCount}
            onPickBudgetChange={setPickBudget}
            onStart={startGroupRound}
            t={t}
          />
        )}
      </View>
    </Screen>
  );
}

function PlannerHeader({
  title,
  subtitle,
  right,
  onBack,
}: { title: string; subtitle: string; right: string; onBack: () => void }) {
  return (
    <View
      style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 14,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <ChevronLeft size={23} color={colors.text} strokeWidth={2.3} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontFamily: fonts.display, fontSize: 25, color: colors.text }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View
        style={{
          minWidth: 44,
          minHeight: 32,
          paddingHorizontal: 8,
          borderRadius: 10,
          backgroundColor: colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.textMuted, fontFamily: fonts.bodySemi, fontSize: 11 }}>
          {right}
        </Text>
      </View>
    </View>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onPress,
}: { active: boolean; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: active ? colors.accentBorder : colors.border,
        backgroundColor: active ? colors.accent : colors.surface2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      {icon}
      <Text style={{ fontFamily: fonts.bodySemi, color: active ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterStrip<T extends string>({
  values,
  selected,
  onSelect,
  t,
}: {
  values: { id: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
  t: TFunction;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {values.map((value) => (
        <FilterChip
          key={value.id}
          label={t(value.label, value.id)}
          active={selected === value.id}
          onPress={() => onSelect(value.id)}
        />
      ))}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? colors.accentBorder : colors.border,
        backgroundColor: active ? colors.accentDim : colors.surface2,
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          color: active ? colors.text : colors.textMuted,
          fontFamily: fonts.bodySemi,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TonightMode({
  candidates,
  poolCount,
  onReroll,
  onOpen,
  t,
}: {
  candidates: WatchlistPlannerCandidate[];
  poolCount: number;
  onReroll: () => void;
  onOpen: (title: Title) => void;
  t: TFunction;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text }}>
            {t('watchlist.planner.shortlistTitle', 'Three worth your time')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {t('watchlist.planner.poolCount', '{{count}} unwatched titles in this pool', {
              count: poolCount,
            })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('watchlist.planner.reroll', 'Reroll shortlist')}
          onPress={onReroll}
          style={{
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: colors.surface2,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <RotateCcw size={15} color={colors.accent} strokeWidth={2} />
          <Text style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 12 }}>
            {t('watchlist.planner.reroll', 'Reroll')}
          </Text>
        </Pressable>
      </View>
      {candidates.length > 0 ? (
        candidates.map((candidate, index) => (
          <TonightCandidateRow
            key={candidate.title.id}
            candidate={candidate}
            rank={index + 1}
            onOpen={onOpen}
            t={t}
          />
        ))
      ) : (
        <EmptyPlannerState
          title={t('watchlist.planner.noPool', 'No titles fit this context')}
          body={t(
            'watchlist.planner.noPoolHint',
            'Widen the runtime or service filter and try again.',
          )}
        />
      )}
    </View>
  );
}

function TonightCandidateRow({
  candidate,
  rank,
  onOpen,
  t,
}: {
  candidate: WatchlistPlannerCandidate;
  rank: number;
  onOpen: (title: Title) => void;
  t: TFunction;
}) {
  const display = toTitleDisplay(candidate.title);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('watchlist.planner.openChoice', 'Open {{title}}', {
        title: display.title,
      })}
      onPress={() => onOpen(candidate.title)}
      style={({ pressed }) => ({
        minHeight: 128,
        borderRadius: 18,
        padding: 10,
        borderWidth: 1,
        borderColor: pressed ? colors.accentBorder : colors.border,
        backgroundColor: pressed ? colors.accentDim : colors.surface2,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
      })}
    >
      <View
        style={{
          width: 72,
          height: 106,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: display.gradient[0],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {display.posterUrl ? (
          <Image
            source={{ uri: display.posterUrl }}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Text style={{ color: colors.accent, fontFamily: fonts.display, fontSize: 26 }}>
            {rank}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text style={{ color: colors.textMuted, fontFamily: fonts.bodySemi, fontSize: 11 }}>
          {rank === 1
            ? t('watchlist.planner.bestFit', 'Best fit')
            : t('watchlist.planner.alsoWorthIt', 'Also worth it')}
        </Text>
        <Text
          style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 17, lineHeight: 21 }}
          numberOfLines={2}
        >
          {display.title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {[display.year, display.runtime, display.rating].filter(Boolean).join(' · ')}
        </Text>
        <Text style={{ color: colors.accent, fontFamily: fonts.bodySemi, fontSize: 12 }}>
          {candidate.item.priority === 'top'
            ? t('watchlist.badgeTop', 'Top pick')
            : t('watchlist.planner.fromWatchlist', 'From your watchlist')}
        </Text>
      </View>
      <ChevronLeft size={18} color={colors.textDim} style={{ transform: [{ rotate: '180deg' }] }} />
    </Pressable>
  );
}

function TogetherSetup({
  participantCount,
  pickBudget,
  poolCount,
  onParticipantCountChange,
  onPickBudgetChange,
  onStart,
  t,
}: {
  participantCount: number;
  pickBudget: WatchlistPickBudget;
  poolCount: number;
  onParticipantCountChange: (count: 2 | 3 | 4) => void;
  onPickBudgetChange: (budget: WatchlistPickBudget) => void;
  onStart: () => void;
  t: TFunction;
}) {
  const canStart = poolCount >= pickBudget;
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          padding: 18,
          borderRadius: 20,
          backgroundColor: colors.surface2,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 8,
        }}
      >
        <Text style={{ fontFamily: fonts.display, fontSize: 23, color: colors.text }}>
          {t('watchlist.planner.togetherTitle', 'Decide together')}
        </Text>
        <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
          {t(
            'watchlist.planner.togetherHint',
            'Each person gets the same pool and a fair number of picks. Votes stay private until the reveal.',
          )}
        </Text>
      </View>
      <ChoiceGroup
        title={t('watchlist.planner.people', 'People')}
        values={PARTICIPANT_COUNTS.map((value) => ({ value, label: String(value) }))}
        selected={participantCount}
        onSelect={(value) => onParticipantCountChange(value as 2 | 3 | 4)}
      />
      <ChoiceGroup
        title={t('watchlist.planner.picksEach', 'Picks per person')}
        values={WATCHLIST_PICK_BUDGETS.map((value) => ({ value, label: String(value) }))}
        selected={pickBudget}
        onSelect={(value) => onPickBudgetChange(value as WatchlistPickBudget)}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Clock3 size={16} color={colors.textMuted} strokeWidth={2} />
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {t('watchlist.planner.poolCount', '{{count}} titles ready in this pool', {
            count: poolCount,
          })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canStart }}
        disabled={!canStart}
        onPress={onStart}
        style={({ pressed }) => ({
          minHeight: 54,
          borderRadius: 14,
          backgroundColor: canStart ? colors.accent : colors.surface3,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <Text
          style={{
            color: canStart ? colors.onAccent : colors.textMuted,
            fontFamily: fonts.bodyBold,
          }}
        >
          {t('watchlist.planner.startTogether', 'Start group picks')}
        </Text>
      </Pressable>
      {!canStart && (
        <Text style={{ color: colors.warning, fontSize: 12, textAlign: 'center' }}>
          {t('watchlist.planner.needPool', 'Widen the context to start with enough titles.')}
        </Text>
      )}
    </View>
  );
}

function ChoiceGroup({
  title,
  values,
  selected,
  onSelect,
}: {
  title: string;
  values: { value: number; label: string }[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodySemi }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {values.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            active={selected === option.value}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

function RoundAction({
  label,
  icon,
  onPress,
  tone,
}: { label: string; icon: ReactNode; onPress: () => void; tone: 'positive' | 'negative' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tone === 'positive' ? 'rgba(61,214,140,0.3)' : 'rgba(224,92,75,0.3)',
        backgroundColor: tone === 'positive' ? colors.rightBg : colors.leftBg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon}
      <Text style={{ color: colors.text, fontFamily: fonts.bodySemi }}>{label}</Text>
    </Pressable>
  );
}

function ResultRow({
  result,
  onPress,
  t,
}: { result: ReturnType<typeof aggregateGroupVotes>[number]; onPress: () => void; t: TFunction }) {
  const display = toTitleDisplay(result.title);
  const label =
    result.label === 'match'
      ? t('watchlist.planner.resultMatch', 'Match')
      : result.label === 'contender'
        ? t('watchlist.planner.resultContender', 'Strong contender')
        : t('watchlist.planner.resultOnePerson', 'One-person pick');
  const voteLabel =
    result.voteCount === 1
      ? t('watchlist.planner.voteOne', '{{count}} vote', { count: result.voteCount })
      : t('watchlist.planner.voteMany', '{{count}} votes', { count: result.voteCount });
  const services = Array.from(
    new Set(result.title.availability.map((entry) => prettyService(entry.serviceId))),
  )
    .slice(0, 2)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('watchlist.planner.openChoice', 'Open {{title}}', {
        title: display.title,
      })}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 92,
        borderRadius: 16,
        backgroundColor: pressed ? colors.accentDim : colors.surface2,
        borderWidth: 1,
        borderColor: pressed ? colors.accentBorder : colors.border,
        padding: 10,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
      })}
    >
      <View
        style={{
          width: 50,
          height: 70,
          borderRadius: 9,
          overflow: 'hidden',
          backgroundColor: display.gradient[0],
        }}
      >
        {display.posterUrl ? (
          <Image
            source={{ uri: display.posterUrl }}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text
          style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 }}
          numberOfLines={2}
        >
          {display.title}
        </Text>
        <Text
          style={{
            color: result.label === 'match' ? colors.right : colors.textMuted,
            fontFamily: fonts.bodySemi,
            fontSize: 11,
          }}
        >
          {label} · {voteLabel}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          {[display.year, display.runtime, services].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Check size={18} color={result.label === 'match' ? colors.right : colors.textDim} />
    </Pressable>
  );
}

function EmptyPlannerState({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 }}>
      <Film size={24} color={colors.textMuted} strokeWidth={1.8} />
      <Text
        style={{
          color: colors.text,
          fontFamily: fonts.bodySemi,
          fontSize: 17,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text style={{ color: colors.textMuted, lineHeight: 19, textAlign: 'center' }}>{body}</Text>
    </View>
  );
}

function prettyService(id: string): string {
  return id
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
