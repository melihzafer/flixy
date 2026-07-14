import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Dices, MoreVertical, SlidersHorizontal, Star, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';

import type { Title } from '@flixy/shared';
import { AppHeader } from '../../../src/components/AppHeader';
import { Screen } from '../../../src/components/Screen';
import { ShareCardModal } from '../../../src/components/ShareCardModal';
import { Text } from '../../../src/components/Text';
import { type TitleDisplay, toTitleDisplay } from '../../../src/features/catalogue/display';
import {
  type WatchlistEntry,
  type WatchlistFilter,
  useMarkWatched,
  useRemoveFromWatchlist,
  useSetPriority,
  useUnmarkWatched,
  useWatchlist,
} from '../../../src/features/watchlist/hooks';
import { track } from '../../../src/lib/analytics';
import { FALLBACK_STREAMING_SERVICES } from '../../../src/lib/fallbackCatalogue';
import { titleShareLinks } from '../../../src/lib/share';
import { colors, fonts } from '../../../src/theme/tokens';

const FILTERS: { id: WatchlistFilter; label: string }[] = [
  { id: 'all', label: 'watchlist.filter.all' },
  { id: 'top', label: 'watchlist.filter.top' },
  { id: 'watched', label: 'watchlist.filter.watched' },
];

type TypeFilter = 'all' | 'movie' | 'tv';
const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'watchlist.filter.all' },
  { id: 'movie', label: 'watchlist.filter.movies' },
  { id: 'tv', label: 'watchlist.filter.series' },
];

type WatchlistSort = 'recent' | 'az' | 'year' | 'rating';
const SORTS: { id: WatchlistSort; label: string; fallback: string }[] = [
  { id: 'recent', label: 'watchlist.sortRecent', fallback: 'Recently added' },
  { id: 'az', label: 'watchlist.sortAz', fallback: 'A to Z' },
  { id: 'year', label: 'watchlist.sortYear', fallback: 'Newest release' },
  { id: 'rating', label: 'watchlist.sortRating', fallback: 'Top rated' },
];

type ValidEntry = WatchlistEntry & { title: Title };

function sortEntries(entries: ValidEntry[], sort: WatchlistSort): ValidEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case 'az':
      sorted.sort((a, b) => a.title.title.localeCompare(b.title.title));
      break;
    case 'year':
      sorted.sort((a, b) => (b.title.releaseYear ?? 0) - (a.title.releaseYear ?? 0));
      break;
    case 'rating':
      sorted.sort(
        (a, b) =>
          (b.title.imdbRating ?? b.title.popularity / 1000) -
          (a.title.imdbRating ?? a.title.popularity / 1000),
      );
      break;
    default:
      sorted.sort(
        (a, b) => new Date(b.item.addedAt).getTime() - new Date(a.item.addedAt).getTime(),
      );
  }
  return sorted;
}

export default function WatchlistScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<WatchlistFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<WatchlistSort>('recent');
  const [genreFilter, setGenreFilter] = useState<Set<string>>(new Set());
  const [serviceFilter, setServiceFilter] = useState<Set<string>>(new Set());
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [shareItem, setShareItem] = useState<{
    display: TitleDisplay;
    url: string;
    trailerUrl: string | null;
  } | null>(null);
  const { entries, isLoading, isError, refetch } = useWatchlist(filter);
  const markWatched = useMarkWatched();
  const unmarkWatched = useUnmarkWatched();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const setPriority = useSetPriority();

  const openShare = (title: Title) => {
    const display = toTitleDisplay(title);
    const links = titleShareLinks(title);
    track('watchlist_row_action', { action: 'share' });
    setShareItem({ display, url: links.webUrl, trailerUrl: links.trailerUrl });
  };

  const advancedFilterCount =
    (genreFilter.size > 0 ? 1 : 0) + (serviceFilter.size > 0 ? 1 : 0) + (sort !== 'recent' ? 1 : 0);

  const clearAdvancedFilters = () => {
    setGenreFilter(new Set());
    setServiceFilter(new Set());
    setSort('recent');
  };

  // Streaming Roulette State (ZERO_COST feature)
  const [showRoulette, setShowRoulette] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rouletteCandidate, setRouletteCandidate] = useState<Title | null>(null);

  const startRoulette = () => {
    const pool = entries
      .filter((e): e is typeof e & { title: Title } => {
        if (!e.title || e.item.watchedAt) return false;
        if (typeFilter !== 'all' && e.title.kind !== typeFilter) return false;
        if (filter === 'top' && e.item.priority !== 'top') return false;
        return true;
      })
      .map((e) => e.title);

    if (pool.length === 0) {
      const hasFilters = typeFilter !== 'all' || filter !== 'all';
      Alert.alert(
        t('watchlist.rouletteEmptyTitle', 'Roulette Pool Empty'),
        hasFilters
          ? t(
              'watchlist.rouletteEmptyFiltered',
              'No unwatched items match your active filters. Try resetting tabs!',
            )
          : t('watchlist.rouletteEmpty', 'Add some titles to your watchlist first!'),
      );
      return;
    }

    setShowRoulette(true);
    setSpinning(true);
    setRouletteCandidate(pool[0] || null);

    const ticks = [50, 60, 80, 110, 150, 200, 260, 340, 440, 560, 700];
    let i = 0;

    const runTick = () => {
      if (i >= ticks.length) {
        setSpinning(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      const randomTitle = pool[Math.floor(Math.random() * pool.length)] ?? null;
      if (randomTitle) {
        setRouletteCandidate(randomTitle);
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setTimeout(() => {
        i++;
        runTick();
      }, ticks[i]);
    };

    runTick();
  };

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Text tone="muted">{t('common.loading')}</Text>
          <Text tone="dim">{t('watchlist.loadingHint', 'Syncing your saved titles…')}</Text>
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scroll={false}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 24,
              color: colors.text,
              textAlign: 'center',
            }}
          >
            {t('watchlist.errorTitle', 'Watchlist did not load')}
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
            onPress={() => refetch()}
          >
            <Text style={{ color: colors.accent }}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const typedEntries = entries
    .filter((e): e is ValidEntry => !!e.title)
    .filter((e) => typeFilter === 'all' || e.title.kind === typeFilter);

  const availableGenres = Array.from(new Set(typedEntries.flatMap((e) => e.title.genres))).sort();
  const availableServices = Array.from(
    new Set(typedEntries.flatMap((e) => e.title.availability.map((a) => a.serviceId))),
  ).sort();

  const validEntries = typedEntries
    .filter((e) => genreFilter.size === 0 || e.title.genres.some((g) => genreFilter.has(g)))
    .filter(
      (e) =>
        serviceFilter.size === 0 ||
        e.title.availability.some((a) => serviceFilter.has(a.serviceId)),
    );
  const top = sortEntries(
    validEntries.filter((e) => e.item.priority === 'top' && !e.item.watchedAt),
    sort,
  );
  const norm = sortEntries(
    validEntries.filter((e) => e.item.priority !== 'top' && !e.item.watchedAt),
    sort,
  );
  const watched = sortEntries(
    validEntries.filter((e) => !!e.item.watchedAt),
    sort,
  );

  return (
    <Screen scroll={true}>
      <AppHeader
        title={t('watchlist.title')}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {entries.length > 0 && (
              <>
                <Pressable
                  onPress={() => setFilterSheetOpen(true)}
                  testID="watchlist-filter-sheet-button"
                  accessibilityRole="button"
                  accessibilityLabel={t('watchlist.filterSort', 'Filter & sort')}
                  style={({ pressed }) => ({
                    width: 30,
                    height: 26,
                    borderRadius: 8,
                    backgroundColor:
                      advancedFilterCount > 0 ? 'rgba(255,77,28,0.16)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor:
                      advancedFilterCount > 0 ? colors.accentBorder : 'rgba(255,255,255,0.09)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <SlidersHorizontal
                    size={14}
                    color={advancedFilterCount > 0 ? colors.accent : 'rgba(245,245,240,0.7)'}
                    strokeWidth={2.2}
                  />
                </Pressable>
                <Pressable
                  onPress={startRoulette}
                  testID="watchlist-roulette-button"
                  accessibilityRole="button"
                  accessibilityLabel="Roulette pick"
                  style={({ pressed }) => ({
                    width: 30,
                    height: 26,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.09)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Dices size={14} color={colors.accent} strokeWidth={2.2} />
                </Pressable>

                <Pressable
                  onPress={() => router.push('/(app)/watchlist-triage')}
                  testID="watchlist-triage-button"
                  accessibilityRole="button"
                  accessibilityLabel="Triage backlog"
                  style={({ pressed }) => ({
                    height: 26,
                    paddingHorizontal: 9,
                    borderRadius: 8,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{ fontSize: 11, color: colors.onAccent, fontFamily: fonts.bodyBold }}
                  >
                    Triage
                  </Text>
                </Pressable>
              </>
            )}
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: 'rgba(245,245,240,0.4)',
                  fontFamily: fonts.bodySemi,
                }}
              >
                {t('watchlist.titlesCount', '{{count}} titles', { count: entries.length })}
              </Text>
            </View>
          </View>
        }
      />

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 }}>
        {FILTERS.map((it) => {
          const active = filter === it.id;
          return (
            <Pressable
              key={it.id}
              testID={`watchlist-filter-${it.id}`}
              accessibilityRole="button"
              accessibilityLabel={t(it.label)}
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(it.id)}
              style={{
                minHeight: 36,
                paddingHorizontal: 14,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? 'rgba(255,77,28,0.16)' : 'rgba(245,245,240,0.04)',
                borderWidth: 1,
                borderColor: active ? colors.accentBorder : colors.border,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 12,
                  color: active ? colors.text : colors.textMuted,
                }}
              >
                {t(it.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 4 }}>
        {TYPE_FILTERS.map((it) => {
          const active = typeFilter === it.id;
          return (
            <Pressable
              key={it.id}
              testID={`watchlist-type-${it.id}`}
              accessibilityRole="button"
              accessibilityLabel={t(it.label)}
              accessibilityState={{ selected: active }}
              onPress={() => setTypeFilter(it.id)}
              style={{
                minHeight: 32,
                paddingHorizontal: 12,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? 'rgba(255,77,28,0.16)' : 'rgba(245,245,240,0.04)',
                borderWidth: 1,
                borderColor: active ? colors.accentBorder : colors.border,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodySemi,
                  fontSize: 11,
                  color: active ? colors.text : colors.textMuted,
                }}
              >
                {t(it.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {top.length > 0 && (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 20,
              marginTop: 14,
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: fonts.bodySemi,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: 'rgba(245,245,240,0.28)',
              }}
            >
              {t('watchlist.sectionTop', 'Top Picks')}
            </Text>
            <Star size={12} color="rgba(245,200,66,0.54)" strokeWidth={2.1} />
          </View>
          {top.map((entry) => (
            <WatchlistRow
              key={entry.item.id}
              entry={entry}
              onPress={() =>
                router.push({ pathname: '/(app)/title/[id]', params: { id: entry.title.id } })
              }
              onToggleWatched={() =>
                markWatched.mutate({ id: entry.item.id, titleId: entry.item.titleId })
              }
              onTogglePriority={() =>
                setPriority.mutate({
                  id: entry.item.id,
                  titleId: entry.item.titleId,
                  priority: entry.item.priority === 'top' ? 'normal' : 'top',
                })
              }
              onRemove={() =>
                removeFromWatchlist.mutate({ id: entry.item.id, titleId: entry.item.titleId })
              }
              onShare={() => openShare(entry.title)}
            />
          ))}
        </>
      )}

      {norm.length > 0 && (
        <>
          <Text
            style={{
              fontSize: 10,
              fontFamily: fonts.bodySemi,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: 'rgba(245,245,240,0.28)',
              paddingHorizontal: 20,
              marginTop: 14,
              marginBottom: 6,
            }}
          >
            {top.length > 0
              ? t('watchlist.sectionWatchlist', 'Watchlist')
              : t('watchlist.sectionSaved', 'Saved')}
          </Text>
          {norm.map((entry) => (
            <WatchlistRow
              key={entry.item.id}
              entry={entry}
              onPress={() =>
                router.push({ pathname: '/(app)/title/[id]', params: { id: entry.title.id } })
              }
              onToggleWatched={() =>
                markWatched.mutate({ id: entry.item.id, titleId: entry.item.titleId })
              }
              onTogglePriority={() =>
                setPriority.mutate({
                  id: entry.item.id,
                  titleId: entry.item.titleId,
                  priority: entry.item.priority === 'top' ? 'normal' : 'top',
                })
              }
              onRemove={() =>
                removeFromWatchlist.mutate({ id: entry.item.id, titleId: entry.item.titleId })
              }
              onShare={() => openShare(entry.title)}
            />
          ))}
        </>
      )}

      {watched.length > 0 && (
        <>
          <Text
            style={{
              fontSize: 10,
              fontFamily: fonts.bodySemi,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: 'rgba(245,245,240,0.28)',
              paddingHorizontal: 20,
              marginTop: 14,
              marginBottom: 6,
            }}
          >
            {t('watchlist.sectionWatched', 'Watched')}
          </Text>
          {watched.map((entry) => (
            <WatchlistRow
              key={entry.item.id}
              entry={entry}
              onPress={() =>
                router.push({ pathname: '/(app)/title/[id]', params: { id: entry.title.id } })
              }
              onToggleWatched={() =>
                unmarkWatched.mutate({ id: entry.item.id, titleId: entry.item.titleId })
              }
              onTogglePriority={() =>
                setPriority.mutate({
                  id: entry.item.id,
                  titleId: entry.item.titleId,
                  priority: entry.item.priority === 'top' ? 'normal' : 'top',
                })
              }
              onRemove={() =>
                removeFromWatchlist.mutate({ id: entry.item.id, titleId: entry.item.titleId })
              }
              onShare={() => openShare(entry.title)}
            />
          ))}
        </>
      )}

      {validEntries.length === 0 && typedEntries.length > 0 && advancedFilterCount > 0 ? (
        <View style={{ alignItems: 'center', gap: 12, padding: 40 }}>
          <Text
            style={{
              fontSize: 13,
              color: 'rgba(245,245,240,0.38)',
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            {t(
              'watchlist.noMatches',
              'No titles match your filters. Clear them to see your full watchlist.',
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={clearAdvancedFilters}
            style={({ pressed }) => ({
              minHeight: 38,
              paddingHorizontal: 16,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,77,28,0.14)',
              borderWidth: 1,
              borderColor: colors.accentBorder,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text }}>
              {t('watchlist.clearFilters', 'Clear')}
            </Text>
          </Pressable>
        </View>
      ) : (
        validEntries.length === 0 && <WatchlistEmptyState filter={filter} />
      )}

      {/* Filter & sort sheet */}
      <Modal
        visible={filterSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetOpen(false)}
      >
        <Pressable
          accessibilityLabel={t('common.back', 'Dismiss')}
          onPress={() => setFilterSheetOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: '80%',
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,77,28,0.12)',
              paddingTop: 10,
              paddingBottom: 26,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.18)',
                marginBottom: 6,
              }}
            />
            <ScrollView style={{ paddingHorizontal: 18 }} contentContainerStyle={{ gap: 14 }}>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 20,
                  color: colors.text,
                  textAlign: 'center',
                }}
              >
                {t('watchlist.filterSort', 'Filter & sort')}
              </Text>

              <FilterSectionLabel label={t('watchlist.sortLabel', 'Sort')} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SORTS.map((option) => (
                  <FilterChip
                    key={option.id}
                    testID={`watchlist-sort-${option.id}`}
                    label={t(option.label, option.fallback)}
                    active={sort === option.id}
                    onPress={() => setSort(option.id)}
                  />
                ))}
              </View>

              {availableGenres.length > 0 ? (
                <>
                  <FilterSectionLabel label={t('watchlist.genresLabel', 'Genres')} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {availableGenres.map((genre) => (
                      <FilterChip
                        key={genre}
                        testID={`watchlist-genre-${genre}`}
                        label={t(`genres.${genre}`, genre.replace(/_/g, ' '))}
                        active={genreFilter.has(genre)}
                        onPress={() =>
                          setGenreFilter((current) => {
                            const next = new Set(current);
                            if (next.has(genre)) next.delete(genre);
                            else next.add(genre);
                            return next;
                          })
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {availableServices.length > 0 ? (
                <>
                  <FilterSectionLabel label={t('watchlist.servicesLabel', 'Services')} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {availableServices.map((serviceId) => (
                      <FilterChip
                        key={serviceId}
                        testID={`watchlist-service-${serviceId}`}
                        label={
                          FALLBACK_STREAMING_SERVICES.find((s) => s.id === serviceId)?.name ??
                          serviceId
                        }
                        active={serviceFilter.has(serviceId)}
                        onPress={() =>
                          setServiceFilter((current) => {
                            const next = new Set(current);
                            if (next.has(serviceId)) next.delete(serviceId);
                            else next.add(serviceId);
                            return next;
                          })
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={clearAdvancedFilters}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ fontFamily: fonts.bodySemi, color: colors.text, fontSize: 14 }}>
                    {t('watchlist.clearFilters', 'Clear')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID="watchlist-filters-apply"
                  onPress={() => setFilterSheetOpen(false)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 46,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.accent,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{ fontFamily: fonts.bodyBold, color: colors.onAccent, fontSize: 14 }}
                  >
                    {t('watchlist.applyFilters', 'Apply')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ShareCardModal
        visible={!!shareItem}
        onClose={() => setShareItem(null)}
        display={shareItem?.display ?? null}
        shareUrl={shareItem?.url ?? null}
        trailerUrl={shareItem?.trailerUrl ?? null}
      />

      {/* Roulette Picker Modal */}
      <Modal
        visible={showRoulette}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!spinning) setShowRoulette(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 340,
              backgroundColor: '#111113',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.accentBorder,
              padding: 24,
              alignItems: 'center',
              position: 'relative',
              gap: 16,
            }}
          >
            {/* Close button */}
            {!spinning && (
              <Pressable
                onPress={() => setShowRoulette(false)}
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={colors.textMuted} />
              </Pressable>
            )}

            <Text
              style={{
                fontFamily: fonts.bodyBold,
                fontSize: 12,
                color: colors.accent,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {spinning
                ? t('watchlist.rouletteSpinning', 'Selecting match…')
                : t('watchlist.rouletteWinner', 'Watch This Tonight!')}
            </Text>

            {rouletteCandidate ? (
              <View style={{ width: '100%', alignItems: 'center', gap: 12 }}>
                {/* Image poster */}
                <View
                  style={{
                    width: 140,
                    height: 210,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: colors.surface2,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  {rouletteCandidate.posterUrl ? (
                    <Image
                      source={{ uri: rouletteCandidate.posterUrl }}
                      contentFit="cover"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 8,
                      }}
                    >
                      <Text style={{ textAlign: 'center', fontSize: 11, color: colors.textMuted }}>
                        No Poster
                      </Text>
                    </View>
                  )}
                </View>

                {/* Title and details */}
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 22,
                      color: colors.text,
                      textAlign: 'center',
                    }}
                    numberOfLines={2}
                  >
                    {rouletteCandidate.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {rouletteCandidate.releaseYear} ·{' '}
                    {rouletteCandidate.kind === 'movie' ? 'Movie' : 'TV Show'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Actions */}
            <View style={{ width: '100%', gap: 8, marginTop: 10 }}>
              {!spinning && rouletteCandidate && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setShowRoulette(false);
                    router.push({
                      pathname: '/(app)/title/[id]',
                      params: { id: rouletteCandidate.id },
                    });
                  }}
                  style={{
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{ fontFamily: fonts.bodyBold, color: colors.onAccent, fontSize: 14 }}
                  >
                    View details
                  </Text>
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={spinning}
                onPress={startRoulette}
                style={{
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: spinning ? 0.5 : 1,
                }}
              >
                <Text style={{ fontFamily: fonts.bodySemi, color: colors.text, fontSize: 13 }}>
                  {spinning
                    ? t('watchlist.spinning', 'Spinning…')
                    : t('watchlist.spinAgain', 'Spin Again')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function WatchlistEmptyState({ filter }: { filter: WatchlistFilter }) {
  const { t } = useTranslation();
  const copyKey =
    filter === 'watched'
      ? 'watchlist.emptyWatched'
      : filter === 'top'
        ? 'watchlist.emptyTop'
        : 'watchlist.emptyAll';
  const copy =
    filter === 'watched'
      ? t('watchlist.emptyWatched', 'Mark a saved title as watched and it will settle here.')
      : filter === 'top'
        ? t('watchlist.emptyTop', 'Swipe up when a film feels like the one for tonight.')
        : t(copyKey, 'Swipe right on films you want to watch. They will appear here.');
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
      <View
        style={{
          width: 82,
          height: 116,
          borderRadius: 18,
          backgroundColor: 'rgba(255,77,28,0.12)',
          borderWidth: 1,
          borderColor: colors.accentBorder,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-3deg' }],
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: fonts.display,
            fontSize: 38,
            lineHeight: 44,
            color: colors.accent,
            textAlign: 'center',
            includeFontPadding: false,
            textAlignVertical: 'center',
          }}
        >
          F
        </Text>
      </View>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 26,
          lineHeight: 30,
          color: colors.text,
          textAlign: 'center',
        }}
      >
        {t('watchlist.emptyTitle', 'Your watchlist is waiting')}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: 'rgba(245,245,240,0.38)',
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        {copy}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('watchlist.emptyCtaLabel', 'Go to Discover to add titles')}
        onPress={() => router.push('/(app)/deck')}
        style={({ pressed }) => ({
          minHeight: 42,
          paddingHorizontal: 18,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accent,
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.bg }}>
          {t('deck.title')}
        </Text>
      </Pressable>
    </View>
  );
}

function FilterSectionLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 10,
        fontFamily: fonts.bodySemi,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: 'rgba(245,245,240,0.4)',
      }}
    >
      {label}
    </Text>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}${active ? ', selected' : ''}`}
      onPress={onPress}
      style={{
        minHeight: 34,
        paddingHorizontal: 12,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? 'rgba(255,77,28,0.16)' : 'rgba(245,245,240,0.04)',
        borderWidth: 1,
        borderColor: active ? colors.accentBorder : colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bodySemi,
          fontSize: 12,
          color: active ? colors.text : colors.textMuted,
          textTransform: 'capitalize',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function WatchlistRow({
  entry,
  onPress,
  onToggleWatched,
  onTogglePriority,
  onRemove,
  onShare,
}: {
  entry: WatchlistEntry & { title: NonNullable<WatchlistEntry['title']> };
  onPress: () => void;
  onToggleWatched: () => void;
  onTogglePriority: () => void;
  onRemove: () => void;
  onShare: () => void;
}) {
  const { t } = useTranslation();
  const display = toTitleDisplay(entry.title);
  const watched = !!entry.item.watchedAt;
  const primaryService =
    display.services[0] ?? t('watchlist.availabilityUnknown', 'Availability unknown');
  const isSeries = display.kind === 'tv';
  const typeLabel = isSeries ? t('detail.series', 'Series') : t('detail.movie', 'Movie');
  const seasonsLabel =
    isSeries && display.numberOfSeasons
      ? t('detail.seasons', '{{count}} seasons', { count: display.numberOfSeasons })
      : null;
  const [sheetOpen, setSheetOpen] = useState(false);

  const fire = (action: 'mark_watched' | 'mark_top' | 'remove' | 'share' | 'pass') => {
    track('watchlist_row_action', { action, watched: watched ? 1 : 0 });
    setSheetOpen(false);
    if (action === 'mark_watched') onToggleWatched();
    else if (action === 'mark_top') onTogglePriority();
    else if (action === 'remove') onRemove();
    else if (action === 'share') onShare();
  };

  return (
    <>
      <Pressable
        onPress={onPress}
        testID="watchlist-row"
        accessibilityRole="button"
        accessibilityLabel={`${display.title}, ${watched ? 'watched' : 'saved'}, ${primaryService}. Open details.`}
        style={({ pressed }) => ({
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: pressed ? colors.accentBorder : 'rgba(255,77,28,0.1)',
          backgroundColor: pressed ? 'rgba(255,77,28,0.08)' : 'rgba(245,245,240,0.035)',
          padding: 12,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 52,
              height: 74,
              borderRadius: 10,
              overflow: 'hidden',
              backgroundColor: display.gradient[0],
              borderWidth: 1,
              borderColor: 'rgba(245,245,240,0.08)',
            }}
          >
            {display.posterUrl ? (
              <Image
                source={{ uri: display.posterUrl }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: display.gradient[0],
                }}
              />
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: fonts.bodyMedium,
                fontSize: 17,
                color: colors.text,
                lineHeight: 21,
                marginBottom: 3,
              }}
              numberOfLines={2}
            >
              {display.title}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: 'rgba(245,245,240,0.42)',
                marginBottom: 7,
              }}
              numberOfLines={1}
            >
              {[display.year, seasonsLabel ?? display.runtime].filter(Boolean).join(' · ')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Badge label={typeLabel} accent />
              <Badge label={watched ? t('watchlist.badgeWatched', 'Watched') : primaryService} />
              {entry.item.priority === 'top' && (
                <Badge label={t('watchlist.badgeTop', 'Top pick')} />
              )}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('watchlist.openActions', 'Open actions for {{title}}', {
              title: display.title,
            })}
            hitSlop={10}
            onPress={(e) => {
              e.stopPropagation();
              setSheetOpen(true);
            }}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent',
            })}
          >
            <MoreVertical color="rgba(245,245,240,0.55)" size={18} strokeWidth={2.1} />
          </Pressable>
        </View>
      </Pressable>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          accessibilityLabel={t('common.back', 'Dismiss')}
          onPress={() => setSheetOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,77,28,0.12)',
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 34,
              gap: 8,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.18)',
                marginBottom: 6,
              }}
            />
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 19,
                color: colors.text,
                textAlign: 'center',
                paddingBottom: 10,
              }}
              numberOfLines={1}
            >
              {display.title}
            </Text>
            <SheetAction
              label={
                watched
                  ? t('watchlist.sheet.markUnwatched', 'Mark unwatched')
                  : t('watchlist.sheet.markWatched', 'Mark watched')
              }
              onPress={() => fire('mark_watched')}
            />
            <SheetAction
              label={
                entry.item.priority === 'top'
                  ? t('watchlist.sheet.removeTop', 'Remove top pick')
                  : t('watchlist.sheet.markTop', 'Mark as top pick')
              }
              onPress={() => fire('mark_top')}
            />
            <SheetAction
              label={t('watchlist.sheet.share', 'Share')}
              onPress={() => fire('share')}
            />
            <SheetAction
              label={t('watchlist.sheet.remove', 'Remove from watchlist')}
              onPress={() => fire('remove')}
              danger
            />
            <SheetAction
              label={t('watchlist.sheet.cancel', 'Cancel')}
              onPress={() => fire('pass')}
              subtle
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function SheetAction({
  label,
  onPress,
  danger = false,
  subtle = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  subtle?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 58,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(245,245,240,0.05)',
        borderWidth: 1,
        borderColor: danger ? 'rgba(224,92,75,0.34)' : colors.border,
      })}
    >
      <Text
        style={{
          fontFamily: fonts.bodySemi,
          fontSize: 16,
          color: danger ? colors.left : subtle ? colors.textMuted : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Badge({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: accent ? 'rgba(255,77,28,0.16)' : 'rgba(255,255,255,0.07)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: accent ? 'rgba(255,77,28,0.32)' : 'rgba(245,245,240,0.08)',
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontFamily: fonts.bodySemi,
          color: accent ? 'rgba(255,150,120,0.95)' : 'rgba(245,245,240,0.5)',
          maxWidth: 180,
          textTransform: accent ? 'uppercase' : 'none',
          letterSpacing: accent ? 0.3 : 0,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
