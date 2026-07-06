import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, Heart, Play, Share2, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer, { PLAYER_STATES } from 'react-native-youtube-iframe';

import { Screen } from '../../src/components/Screen';
import { ShareCardModal } from '../../src/components/ShareCardModal';

import type { Title } from '@flixy/shared';
import { Text } from '../../src/components/Text';
import { type TitleDisplay, toTitleDisplay } from '../../src/features/catalogue/display';
import { useProfile } from '../../src/features/profile/hooks';
import { useRecordSwipe } from '../../src/features/swipe/hooks';
import { useRecordTasteEvent } from '../../src/features/taste/hooks';
import { events } from '../../src/features/telemetry/events';
import { discoverTmdbTitles, fetchTmdbTitlesByIds } from '../../src/lib/tmdb';
import { colors, fonts } from '../../src/theme/tokens';

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
  const [playIndex, setPlayIndex] = useState<number>(-1);

  // Fetch popular movies & TV shows across 2 pages in parallel to guarantee a rich trailer pool
  const {
    data: titles,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['trailers_feed', region],
    queryFn: async () => {
      const [page1, page2] = await Promise.all([
        discoverTmdbTitles({
          region,
          kinds: ['movie', 'tv'],
          limit: 20,
          page: 1,
        }),
        discoverTmdbTitles({
          region,
          kinds: ['movie', 'tv'],
          limit: 20,
          page: 2,
        }),
      ]);

      const discoverResults = [...page1, ...page2];
      const uuids = discoverResults.map((t) => t.id);
      const fullTitles = await fetchTmdbTitlesByIds(uuids);
      return fullTitles.filter((t) => !!t.trailerKey);
    },
    staleTime: 1000 * 60 * 30, // 30 mins cache
  });

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)');
    }
  };

  const handleLike = (title: Title, index: number) => {
    events.titleShared({ titleId: title.id, hasImage: false }); // track interaction
    recordSwipe.mutate({
      titleId: title.id,
      direction: 'right',
      deckPosition: index,
      genres: title.genres,
    });
    advanceFeed(index);
  };

  const handlePass = (title: Title, index: number) => {
    recordSwipe.mutate({
      titleId: title.id,
      direction: 'left',
      deckPosition: index,
      genres: title.genres,
    });
    advanceFeed(index);
  };

  const advanceFeed = (currentIndex: number) => {
    setPlayIndex(-1);
    if (titles && currentIndex < titles.length - 1) {
      listRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const openTrailer = async (title: Title, index: number) => {
    if (!title.trailerKey) return;
    events.trailerOpened(title.id);
    void recordTasteEvent('watch_trailer', title);
    setPlayIndex(index);
  };

  const [shareItem, setShareItem] = useState<{
    display: TitleDisplay;
    url: string | null;
    titleId: string;
  } | null>(null);

  const openShareCard = (title: Title) => {
    const display = toTitleDisplay(title);
    const url = title.trailerKey
      ? `https://www.youtube.com/watch?v=${title.trailerKey}`
      : title.tmdbId
        ? `https://www.themoviedb.org/${title.kind === 'tv' ? 'tv' : 'movie'}/${title.tmdbId}`
        : '';
    events.titleShared({ titleId: title.id, hasImage: !!display.posterUrl });
    setShareItem({ display, url: url || null, titleId: title.id });
  };

  if (isLoading) {
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
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.y / height);
          setActiveIndex(index);
          setPlayIndex(-1);
        }}
        renderItem={({ item, index }) => {
          const meta = [
            item.releaseYear,
            item.runtimeMinutes ? `${item.runtimeMinutes}m` : null,
            item.imdbRating ? `★ ${item.imdbRating.toFixed(1)}` : null,
          ]
            .filter(Boolean)
            .join('  \u00b7  ');

          return (
            <View style={{ width, height, position: 'relative', overflow: 'hidden' }}>
              {/* Cinematic full-screen backdrop */}
              {item.posterUrl ? (
                <Image
                  source={{ uri: item.posterUrl }}
                  contentFit="cover"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: playIndex === index ? 0 : 0.55,
                  }}
                />
              ) : (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#101012',
                  }}
                />
              )}

              {/* Bottom Gradient overlay — iframe tıklamalarını engellememek
                  için pointerEvents kapatıldı. */}
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

              {/* Inline YouTube player — yalnızca bu sayfa aktif ve
                  oynatma başlatılmışsa monte edilir. Tarayıcı autoplay
                  politikası gereği muted başlatılır; kullanıcı dokunuşu
                  zaten bir user-gesture sayıldığı için play tetiklenir.
                  Player sayfayı DİKEY doldurur (letterbox); info + aksiyon
                  butonları JSX'te sonra geldiği için üstte kalır. */}
              {playIndex === index && item.trailerKey ? (
                <View
                  pointerEvents="auto"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    backgroundColor: '#000',
                  }}
                >
                  <YoutubePlayer
                    videoId={item.trailerKey}
                    height={height}
                    width={width}
                    play
                    mute
                    forceAndroidAutoplay
                    initialPlayerParams={{ preventFullScreen: false }}
                    onChangeState={(state: PLAYER_STATES) => {
                      if (state === PLAYER_STATES.ENDED) setPlayIndex(-1);
                    }}
                    webViewStyle={{ backgroundColor: '#000' }}
                  />
                </View>
              ) : (
                /* Big Play Button Overlay — box-none: the container spans the
                   upper 75% of the page and was eating taps meant for the
                   side action buttons underneath it. */
                <View
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: '25%',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Pressable
                    onPress={() => openTrailer(item, index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Play trailer for ${item.title}`}
                    style={({ pressed }) => ({
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: colors.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.8 : 1,
                      shadowColor: colors.accent,
                      shadowRadius: 16,
                      shadowOpacity: 0.5,
                      elevation: 8,
                    })}
                  >
                    <Play
                      size={36}
                      color={colors.onAccent}
                      fill={colors.onAccent}
                      style={{ marginLeft: 4 }}
                    />
                  </Pressable>
                  <Text
                    style={{
                      fontFamily: fonts.bodySemi,
                      color: 'rgba(245,245,240,0.65)',
                      marginTop: 14,
                      fontSize: 13,
                    }}
                  >
                    {t('trailers.playHint', 'Tap to watch official trailer')}
                  </Text>
                </View>
              )}

              {/* Movie Details Info Overlay (Bottom) — box-none so the
                  text block never swallows taps aimed at the player below. */}
              <View
                pointerEvents="box-none"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  paddingHorizontal: 20,
                  paddingBottom: Math.max(34, insets.bottom + 12),
                  paddingRight: 76, // Leave space for side action buttons
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
              </View>

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
                  accessibilityLabel="Add to Watchlist"
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
                  accessibilityLabel="Skip"
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
                  accessibilityLabel="Share"
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
          accessibilityLabel="Back to Discover"
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
            Trailers
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
            Swipe Up for Next
          </Text>
          <ChevronDown size={16} color="rgba(255,255,255,0.36)" style={{ marginTop: -2 }} />
        </View>
      )}

      <ShareCardModal
        visible={!!shareItem}
        onClose={() => setShareItem(null)}
        display={shareItem?.display ?? null}
        shareUrl={shareItem?.url ?? null}
      />
    </View>
  );
}
