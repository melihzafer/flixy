import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, Heart, Share2, Volume2, VolumeX, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Platform,
  Pressable,
  View,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer, { PLAYER_STATES } from 'react-native-youtube-iframe';

import { Screen } from '../../src/components/Screen';
import { ShareCardModal } from '../../src/components/ShareCardModal';

import { type Title, personalizationScore } from '@flixy/shared';
import { Text } from '../../src/components/Text';
import { useSession } from '../../src/features/auth/useSession';
import { type TitleDisplay, toTitleDisplay } from '../../src/features/catalogue/display';
import { useDeckExclusions, useTasteSignal } from '../../src/features/deck/hooks';
import { useUserPreferences } from '../../src/features/onboarding/hooks';
import { useProfile } from '../../src/features/profile/hooks';
import { useRecordSwipe } from '../../src/features/swipe/hooks';
import { useRecordTasteEvent } from '../../src/features/taste/hooks';
import { events } from '../../src/features/telemetry/events';
import { normalizeGenreId } from '../../src/lib/fallbackCatalogue';
import { titleShareLinks } from '../../src/lib/share';
import { discoverTmdbTitles, fetchTmdbTitlesByIds } from '../../src/lib/tmdb';
import { colors, fonts } from '../../src/theme/tokens';

/** Upper bound on TMDB discover pages the feed will walk (20 titles/page). */
const MAX_FEED_PAGES = 15;

export default function TrailersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const region = profile?.region ?? 'US';
  const recordSwipe = useRecordSwipe();
  const recordTasteEvent = useRecordTasteEvent();
  const listRef = useRef<FlatList<Title>>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [erroredIds, setErroredIds] = useState<Record<string, boolean>>({});
  const watchedTitleIdsRef = useRef<Set<string>>(new Set());

  // Portrait cover math
  const playerWidth = height * (16 / 9);
  const playerLeft = -(playerWidth - width) / 2;

  // ---- For You feed composition -------------------------------------------
  // TikTok-style FYP: an infinite, personalized trailer stream.
  //  - Candidates come from TMDB discover, one page at a time (infinite).
  //  - Already swiped / watchlisted titles never appear (deck exclusions).
  //  - "Never show" genre & language preferences apply here too.
  //  - Each new batch is ranked by the shared taste signal, so the feed
  //    leans toward what the user likes and adapts as they react.
  const { data: session } = useSession();
  const userId = session?.user?.id ?? 'anon';
  const { taste, isLoading: tasteLoading } = useTasteSignal();
  const { exclusions, isReady: exclusionsReady } = useDeckExclusions();
  const { data: prefs } = useUserPreferences();

  const blockedGenres = useMemo(
    () => new Set((prefs?.excluded_genres ?? []).map(normalizeGenreId)),
    [prefs?.excluded_genres],
  );
  const blockedLanguages = useMemo(
    () => new Set((prefs?.excluded_languages ?? []).map((l) => l.toLowerCase())),
    [prefs?.excluded_languages],
  );

  const {
    data: pagedData,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['trailers_feed', region, userId],
    enabled: exclusionsReady && !tasteLoading,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const discovered = await discoverTmdbTitles({
        region,
        kinds: ['movie', 'tv'],
        limit: 20,
        page: pageParam,
      });
      const fullTitles = await fetchTmdbTitlesByIds(discovered.map((t) => t.id));
      return fullTitles.filter((t) => !!t.trailerKey);
    },
    getNextPageParam: (_lastPage, pages) =>
      pages.length >= MAX_FEED_PAGES ? undefined : pages.length + 1,
    staleTime: 1000 * 60 * 30, // 30 mins cache
  });

  // Append-only feed: new candidates are filtered + taste-ranked, then
  // appended. Items already in the feed never move or disappear — a Like
  // invalidates exclusions, and live-filtering would yank the card the user
  // is looking at.
  const feedRef = useRef<{ key: string; ids: string[]; byId: Map<string, Title> }>({
    key: '',
    ids: [],
    byId: new Map(),
  });
  const titles = useMemo(() => {
    const feedKey = `${region}:${userId}`;
    if (feedRef.current.key !== feedKey) {
      feedRef.current = { key: feedKey, ids: [], byId: new Map() };
    }
    const feed = feedRef.current;
    const known = new Set(feed.ids);
    const fresh: Title[] = [];
    for (const candidate of pagedData?.pages.flat() ?? []) {
      if (known.has(candidate.id)) {
        feed.byId.set(candidate.id, candidate);
        continue;
      }
      known.add(candidate.id);
      if (exclusions.excludeIds.has(candidate.id)) continue;
      if (candidate.genres.some((g) => blockedGenres.has(normalizeGenreId(g)))) continue;
      if (candidate.language && blockedLanguages.has(candidate.language.toLowerCase())) continue;
      fresh.push(candidate);
    }
    if (fresh.length > 0) {
      // Taste first, popularity as the tie-breaker — the FYP ordering.
      fresh.sort(
        (a, b) =>
          personalizationScore(b, taste) +
          0.3 * Math.min(1, b.popularity / 1000) -
          (personalizationScore(a, taste) + 0.3 * Math.min(1, a.popularity / 1000)),
      );
      feed.ids = [...feed.ids, ...fresh.map((t) => t.id)];
      for (const t of fresh) feed.byId.set(t.id, t);
    }
    const list: Title[] = [];
    for (const id of feed.ids) {
      const t = feed.byId.get(id);
      if (t) list.push(t);
    }
    return list;
  }, [pagedData, exclusions.excludeIds, blockedGenres, blockedLanguages, taste, region, userId]);

  // Keep the stream going well before the user reaches the end.
  const maybeFetchMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    // Covers both "user is near the end" and "the whole first batch was
    // filtered out by exclusions/blocks" — keep pulling until content lands.
    if (pagedData && titles.length - activeIndex <= 5) {
      maybeFetchMore();
    }
  }, [activeIndex, titles.length, pagedData, maybeFetchMore]);

  const feedPending =
    isLoading ||
    !exclusionsReady ||
    tasteLoading ||
    (!pagedData && !isError) ||
    // Everything fetched so far was filtered out but more pages exist —
    // keep the spinner up instead of flashing the error state.
    (titles.length === 0 && !isError && (hasNextPage || isFetchingNextPage));

  useEffect(() => {
    events.trailerFeedOpened();
  }, []);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)');
    }
  };

  const handleLike = (title: Title, index: number) => {
    events.trailerFeedSaved({ titleId: title.id });
    events.watchlistAdded(title.id);
    recordSwipe.mutate({
      titleId: title.id,
      direction: 'right',
      deckPosition: index,
      titleSnapshot: { genres: title.genres, language: title.language, kind: title.kind },
    });
    advanceFeed(index);
  };

  const handlePass = (title: Title, index: number) => {
    events.trailerFeedSkipped({ titleId: title.id });
    recordSwipe.mutate({
      titleId: title.id,
      direction: 'left',
      deckPosition: index,
      titleSnapshot: { genres: title.genres, language: title.language, kind: title.kind },
    });
    advanceFeed(index);
  };

  const advanceFeed = (currentIndex: number) => {
    if (titles && currentIndex < titles.length - 1) {
      listRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (newMuted) {
      events.trailerFeedMuted();
    } else {
      events.trailerFeedUnmuted();
    }
  };

  const [shareItem, setShareItem] = useState<{
    display: TitleDisplay;
    url: string | null;
    trailerUrl: string | null;
    titleId: string;
  } | null>(null);

  const openShareCard = (title: Title) => {
    const display = toTitleDisplay(title);
    const links = titleShareLinks(title);
    events.titleShared({ titleId: title.id, hasImage: !!display.posterUrl });
    setShareItem({
      display,
      url: links.webUrl,
      trailerUrl: links.trailerUrl,
      titleId: title.id,
    });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0]) {
      const index = viewableItems[0].index ?? 0;
      setActiveIndex(index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const getItemLayout = useCallback(
    (_data: ArrayLike<Title> | null | undefined, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height],
  );

  useEffect(() => {
    if (Platform.OS === 'web' && titles && titles[activeIndex]) {
      const activeTitle = titles[activeIndex];
      if (activeTitle?.trailerKey && !watchedTitleIdsRef.current.has(activeTitle.id)) {
        watchedTitleIdsRef.current.add(activeTitle.id);
        void recordTasteEvent('watch_trailer', activeTitle);
        events.trailerFeedStarted({ titleId: activeTitle.id });
      }
    }
  }, [activeIndex, titles, recordTasteEvent]);

  if (feedPending) {
    return (
      <Screen scroll={false}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Text tone="muted">{t('common.loading', 'Loading…')}</Text>
          <Text tone="dim" style={{ fontSize: 12 }}>
            {t('trailers.loadingHint', 'Curating live trailers feed…')}
          </Text>
        </View>
      </Screen>
    );
  }

  if (isError || !titles || titles.length === 0) {
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
            {t('trailers.errorTitle', "Couldn't load trailers")}
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
            {t('trailers.errorHint', 'Make sure your network is connected and try again.')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => refetch()}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: colors.accent,
              borderRadius: 12,
              marginTop: 10,
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Paged Video/Trailer List */}
      <FlatList
        ref={listRef}
        data={titles}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={maybeFetchMore}
        onEndReachedThreshold={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        renderItem={({ item, index }) => {
          const meta = [
            item.releaseYear,
            item.runtimeMinutes ? `${item.runtimeMinutes}m` : null,
            item.imdbRating ? `★ ${item.imdbRating.toFixed(1)}` : null,
          ]
            .filter(Boolean)
            .join('  \u00b7  ');

          const showPlayer = index === activeIndex && !erroredIds[item.id];
          const isErrored = !!erroredIds[item.id];

          return (
            <View
              style={{
                width,
                height,
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#000',
              }}
            >
              {/* Cinematic full-screen backdrop / poster fallback */}
              {item.backdropUrl || item.posterUrl ? (
                <Image
                  source={{ uri: item.backdropUrl || item.posterUrl || undefined }}
                  contentFit="cover"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: 0.35,
                  }}
                  blurRadius={10}
                />
              ) : (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#0a0a0b',
                  }}
                />
              )}

              {/* Bottom Gradient overlay — pointerEvents="none" so it doesn't block scroll */}
              <LinearGradient
                colors={[
                  'rgba(10,10,11,0.01)',
                  'rgba(10,10,11,0.3)',
                  'rgba(10,10,11,0.82)',
                  'rgba(10,10,11,1)',
                ]}
                locations={[0, 0.25, 0.6, 1]}
                pointerEvents="none"
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }}
              />

              {/* Inline YouTube player in portrait cover mode */}
              {showPlayer && item.trailerKey ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: playerLeft,
                    width: playerWidth,
                    height: height,
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                  }}
                >
                  {Platform.OS === 'web' ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${item.trailerKey}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1`}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                      }}
                      allow="autoplay; encrypted-media"
                      title={item.title}
                    />
                  ) : (
                    <YoutubePlayer
                      videoId={item.trailerKey}
                      height={height}
                      width={playerWidth}
                      play={showPlayer}
                      mute={muted}
                      forceAndroidAutoplay
                      initialPlayerParams={{
                        preventFullScreen: true,
                        controls: false,
                        cc_load_policy: 0,
                        rel: 0,
                        modestbranding: 1,
                        iv_load_policy: 3,
                        mute: 1,
                      }}
                      webViewProps={{
                        allowsInlineMediaPlayback: true,
                        mediaPlaybackRequiresUserAction: false,
                      }}
                      onChangeState={(state: PLAYER_STATES) => {
                        if (state === PLAYER_STATES.PLAYING) {
                          if (!watchedTitleIdsRef.current.has(item.id)) {
                            watchedTitleIdsRef.current.add(item.id);
                            void recordTasteEvent('watch_trailer', item);
                            events.trailerFeedStarted({ titleId: item.id });
                          }
                        } else if (state === PLAYER_STATES.ENDED) {
                          advanceFeed(index);
                        }
                      }}
                      onError={(e: unknown) => {
                        setErroredIds((prev) => ({ ...prev, [item.id]: true }));
                        events.trailerFeedError({ titleId: item.id, error: String(e) });
                      }}
                      webViewStyle={{ backgroundColor: 'transparent' }}
                    />
                  )}
                </View>
              ) : null}

              {/* YouTube error fallback view */}
              {isErrored && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(10,10,11,0.85)',
                    padding: 24,
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 20,
                      color: colors.text,
                      textAlign: 'center',
                    }}
                  >
                    {t('trailers.unavailableTitle', 'Trailer Unavailable')}
                  </Text>
                  <Text
                    style={{
                      color: colors.textMuted,
                      textAlign: 'center',
                      fontSize: 13,
                      lineHeight: 18,
                      maxWidth: 240,
                    }}
                  >
                    {t(
                      'trailers.unavailableHint',
                      'This trailer cannot be played. Skip to the next one.',
                    )}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setErroredIds((prev) => {
                          const next = { ...prev };
                          delete next[item.id];
                          return next;
                        });
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                      }}
                    >
                      <Text
                        style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 12 }}
                      >
                        {t('common.retry', 'Retry')}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => advanceFeed(index)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        backgroundColor: colors.accent,
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{ color: colors.onAccent, fontFamily: fonts.bodySemi, fontSize: 12 }}
                      >
                        {t('trailers.skip', 'Skip')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Movie Details Info Overlay (Bottom) — press to open details screen */}
              <Pressable
                onPress={() => {
                  router.push({
                    pathname: '/(app)/title/[id]',
                    params: { id: item.id },
                  });
                }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 76, // Leave space for side action buttons
                  paddingHorizontal: 20,
                  paddingBottom: Math.max(34, insets.bottom + 12),
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: fonts.display,
                    fontSize: 28,
                    lineHeight: 32,
                    letterSpacing: -0.5,
                  }}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>

                <Text
                  style={{ fontSize: 12, color: 'rgba(245,245,240,0.6)', fontFamily: fonts.body }}
                >
                  {meta}
                </Text>

                {item.overview ? (
                  <Text
                    style={{
                      fontSize: 13,
                      color: 'rgba(245,245,240,0.75)',
                      lineHeight: 18,
                      fontFamily: fonts.body,
                    }}
                    numberOfLines={3}
                  >
                    {item.overview}
                  </Text>
                ) : null}

                {/* Genres */}
                <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                  {item.genres.slice(0, 3).map((g) => (
                    <View
                      key={g}
                      style={{
                        height: 20,
                        paddingHorizontal: 7,
                        borderRadius: 5,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontFamily: fonts.bodyBold,
                          color: colors.textMuted,
                          textTransform: 'capitalize',
                        }}
                      >
                        {t(`genres.${g}`, g.replace(/_/g, ' '))}
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>

              {/* Side Floating Action Panel */}
              <View
                style={{
                  position: 'absolute',
                  bottom: Math.max(34, insets.bottom + 12),
                  right: 16,
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                {/* Like Button */}
                <Pressable
                  onPress={() => handleLike(item, index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('trailers.addWatchlistA11y', 'Add to Watchlist')}
                  style={({ pressed }) => ({
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.8 : 1,
                    elevation: 5,
                  })}
                >
                  <Heart size={22} color={colors.onAccent} fill={colors.onAccent} />
                </Pressable>

                {/* Pass Button */}
                <Pressable
                  onPress={() => handlePass(item, index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('trailers.skipA11y', 'Skip this title')}
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(10,10,11,0.6)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.8 : 1,
                    elevation: 3,
                  })}
                >
                  <X size={20} color={colors.text} />
                </Pressable>

                {/* Share Button */}
                <Pressable
                  onPress={() => openShareCard(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t('trailers.shareA11y', 'Share this title')}
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(10,10,11,0.6)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.8 : 1,
                    elevation: 3,
                  })}
                >
                  <Share2 size={18} color="rgba(245,245,240,0.8)" />
                </Pressable>

                {/* Mute/Unmute Button */}
                <Pressable
                  onPress={toggleMute}
                  accessibilityRole="button"
                  accessibilityLabel={
                    muted
                      ? t('trailers.unmuteA11y', 'Unmute trailer')
                      : t('trailers.muteA11y', 'Mute trailer')
                  }
                  style={({ pressed }) => ({
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(10,10,11,0.6)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.8 : 1,
                    elevation: 3,
                  })}
                >
                  {muted ? (
                    <VolumeX size={18} color="rgba(245,245,240,0.8)" />
                  ) : (
                    <Volume2 size={18} color="rgba(245,245,240,0.8)" />
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {/* Floating Back Button Header */}
      <View
        style={{
          position: 'absolute',
          top: Math.max(16, insets.top),
          left: 16,
          right: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'box-none',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('trailers.backA11y', 'Back to Discover')}
          hitSlop={12}
          onPress={goBack}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(10,10,11,0.7)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <ChevronLeft size={22} color={colors.text} strokeWidth={2.4} />
        </Pressable>

        <View
          style={{
            backgroundColor: 'rgba(10,10,11,0.6)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bodyBold,
              fontSize: 11,
              color: colors.accent,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {t('trailers.title', 'Trailers')}
          </Text>
        </View>
      </View>

      {/* Swipe scroll signifier overlay */}
      {activeIndex === 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: Math.max(105, insets.bottom + 70),
            left: 0,
            right: 0,
            alignItems: 'center',
            pointerEvents: 'none',
            gap: 4,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontFamily: fonts.bodyBold,
              color: 'rgba(255,255,255,0.36)',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}
          >
            {t('trailers.swipeUp', 'Swipe Up for Next')}
          </Text>
          <ChevronDown size={16} color="rgba(255,255,255,0.36)" style={{ marginTop: -2 }} />
        </View>
      )}

      <ShareCardModal
        visible={!!shareItem}
        onClose={() => setShareItem(null)}
        display={shareItem?.display ?? null}
        shareUrl={shareItem?.url ?? null}
        trailerUrl={shareItem?.trailerUrl ?? null}
      />
    </View>
  );
}
